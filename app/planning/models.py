from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .catalog import PLACES


def minutes(value: str) -> int:
    if len(value) != 5 or value[2] != ':':
        raise ValueError('Use HH:MM time.')
    try:
        hour, minute = int(value[:2]), int(value[3:])
    except ValueError as exc:
        raise ValueError('Use HH:MM time.') from exc
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        raise ValueError('Time must be between 00:00 and 23:59.')
    return hour * 60 + minute


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class PlanRequest(StrictModel):
    date: date
    start_time: str = '08:00'
    end_time: str = '19:00'
    budget_inr: int = Field(default=3500, ge=1, le=100000)
    party_size: int = Field(default=3, ge=1, le=20)
    required_place_ids: list[str] = Field(default_factory=lambda: ['meenakshi', 'palace'], max_length=6)
    optional_place_ids: list[str] = Field(default_factory=lambda: ['gandhi', 'teppakulam'], max_length=6)
    pace: Literal['standard', 'relaxed'] = 'relaxed'
    transport: Literal['balanced', 'bus', 'cab'] = 'balanced'
    max_stops: int = Field(default=6, ge=1, le=6)

    @field_validator('start_time', 'end_time')
    @classmethod
    def valid_time(cls, value):
        minutes(value)
        return value

    @model_validator(mode='after')
    def validate_preferences(self):
        ids = self.required_place_ids + self.optional_place_ids
        if not ids or len(ids) != len(set(ids)):
            raise ValueError('Choose distinct required and optional places.')
        if any(id not in PLACES for id in ids):
            raise ValueError('Choose a supported Madurai destination.')
        if minutes(self.end_time) <= minutes(self.start_time):
            raise ValueError('Finish time must be after departure on the same day.')
        if len(self.required_place_ids) > self.max_stops:
            raise ValueError('Required visits exceed the stop limit.')
        return self


class Stop(StrictModel):
    place_id: str
    name: str
    tamil_name: str
    arrival_min: int
    departure_min: int
    dwell_minutes: int
    rest_minutes: int
    travel_minutes: int
    wait_minutes: int
    mode: Literal['bus', 'cab']
    cost_inr: int
    lat: float
    lon: float
    explanation: str


class PlanResult(StrictModel):
    schema_version: Literal[1] = 1
    feasible: bool
    status: Literal['optimal', 'feasible', 'infeasible', 'timeout']
    request: PlanRequest
    stops: list[Stop] = Field(default_factory=list, max_length=6)
    skipped_place_ids: list[str] = Field(default_factory=list, max_length=6)
    total_cost_inr: int = 0
    total_travel_minutes: int = 0
    finish_min: int = 0
    suggestions: list[str] = Field(default_factory=list)
    disclaimer: str
    dataset_version: str
    completed_count: int = Field(default=0, ge=0, le=6)
    progress_min: int = Field(default=0, ge=0, le=2000)
    signature: str = ''


class ReplanRequest(StrictModel):
    original_plan: PlanResult
    completed_count: int = Field(default=0, ge=0, le=6)
    delay_minutes: int = Field(default=45, ge=5, le=240)
