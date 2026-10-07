"""Standalone planning API for Render. No booking or dispatch side effects."""
import asyncio
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from .catalog import DATASET_VERSION, catalog
from .models import PlanRequest, PlanResult, ReplanRequest
from .solver import replan, solve_plan


@asynccontextmanager
async def lifespan(app):
    if os.getenv('APP_ENV') == 'production' and len(os.getenv('PAYANAM_PLAN_SECRET', '')) < 32:
        raise RuntimeError('Set PAYANAM_PLAN_SECRET to a generated secret of at least 32 characters.')
    app.state.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='payanam-solver')
    app.state.capacity = threading.BoundedSemaphore(2)
    yield
    app.state.executor.shutdown(wait=True, cancel_futures=True)


class BodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            size += len(chunk)
            if size > 65536:
                return await JSONResponse({'detail': 'Request exceeds the 64 KB limit.'}, status_code=413)(scope, receive, send)
            chunks.append(chunk)
            if not message.get('more_body', False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': b''.join(chunks), 'more_body': False}
            return await receive()

        await self.app(scope, replay, send)


def allowed_origins():
    raw = os.getenv('PAYANAM_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
    origins = [value.strip().rstrip('/') for value in raw.split(',') if value.strip()]
    for origin in origins:
        parsed = urlparse(origin)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.path or '*' in origin:
            raise RuntimeError('PAYANAM_ALLOWED_ORIGINS must contain explicit HTTP(S) origins.')
    return origins


app = FastAPI(title='Payanam Journey Planning', version='1.0.0',
              description='Family-paced itinerary planning using illustrative Madurai data. No bookings.', lifespan=lifespan)
app.add_middleware(BodyLimit)
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins(), allow_credentials=False,
                   allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'payanam-planning', 'mode': 'illustrative-planning', 'dataset_version': DATASET_VERSION}


@app.get('/api/v1/catalog')
def get_catalog():
    return catalog()


async def run_solver(function, request):
    if not app.state.capacity.acquire(blocking=False):
        raise HTTPException(503, 'Planning is busy. Please try again shortly.', headers={'Retry-After': '3'})
    future = asyncio.get_running_loop().run_in_executor(app.state.executor, function, request)
    future.add_done_callback(lambda _: app.state.capacity.release())
    try:
        return await asyncio.shield(future)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.post('/api/v1/plans/preview', response_model=PlanResult)
async def preview(request: PlanRequest):
    return await run_solver(solve_plan, request)


@app.post('/api/v1/plans/replan', response_model=PlanResult)
async def replan_preview(request: ReplanRequest):
    return await run_solver(replan, request)
