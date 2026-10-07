from datetime import date
from typing import Literal
from uuid import UUID
from pydantic import Field, model_validator
from .models import StrictModel, ResolvedPlace

Category=Literal['attraction','museum','heritage','temple','nature','viewpoint','food']

class ItineraryRequest(StrictModel):
    city_id: UUID
    start_date: date
    days: int=Field(default=3,ge=1,le=14)
    interests: list[Category]=Field(default_factory=lambda:['heritage','museum','nature'],max_length=7)
    pace: Literal['relaxed','balanced','packed']='balanced'
    mode: Literal['walk','drive']='drive'
    day_start: str=Field(default='09:00',pattern=r'^(0[6-9]|1\d|2[0-2]):[0-5]\d$')
    day_end: str=Field(default='18:00',pattern=r'^(0[6-9]|1\d|2[0-3]):[0-5]\d$')
    must_visit: list[UUID]=Field(default_factory=list,max_length=100)
    exclude: list[UUID]=Field(default_factory=list,max_length=100)
    fixed_order: list[list[UUID]] | None = Field(default=None,max_length=14)
    @model_validator(mode='after')
    def valid_times(self):
        start=sum(a*b for a,b in zip(map(int,self.day_start.split(':')),[60,1]))
        end=sum(a*b for a,b in zip(map(int,self.day_end.split(':')),[60,1]))
        if end-start<120:raise ValueError('Leave at least two hours to explore.')
        if set(self.must_visit)&set(self.exclude):raise ValueError('A required stop cannot also be excluded.')
        if self.fixed_order is not None:
            ids=[id for day in self.fixed_order for id in day]
            if len(self.fixed_order)!=self.days or len(ids)>100 or any(len(day)>20 for day in self.fixed_order):
                raise ValueError('Recalculation supports at most 20 stops per day and 100 visits.')
        return self

class ScheduledStop(StrictModel):
    place: ResolvedPlace
    arrival: str
    departure: str
    duration_minutes: int
    travel_minutes: int
    distance_m: int
    travel_source: Literal['estimate']='estimate'
    hours_status: Literal['mapped','unverified','unknown']
    reason: str

class DayPlan(StrictModel):
    day_index: int
    date: date
    stops: list[ScheduledStop]
    distance_m: int
    travel_minutes: int
    return_minutes: int
    return_at: str
    lunch_start: str|None=None
    lunch_end: str|None=None
    theme: str

class ItineraryPlan(StrictModel):
    city: ResolvedPlace
    preferences: ItineraryRequest
    days: list[DayPlan]
    warnings: list[str]
    algorithm: str='OR-Tools time-window route optimization'
    attributions: list[str]
