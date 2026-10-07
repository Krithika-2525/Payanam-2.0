from datetime import date, datetime
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import pycountry
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False)


class PlaceQuery(StrictModel):
    q: str = Field(min_length=2, max_length=200)
    language: str = Field(default='en', pattern=r'^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$')
    country: str | None = Field(default=None, pattern=r'^[A-Z]{2}$')
    limit: int = Field(default=10, ge=1, le=10)


class ResolvedPlace(StrictModel):
    id: UUID
    provider: str
    source_id: str
    name: str
    local_name: str | None = None
    address: str | None = None
    country: str | None = None
    country_code: str | None = None
    region: str | None = None
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    timezone: str | None = None
    kind: str = 'place'
    retrieved_at: datetime
    observed_at: datetime | None = None
    source_url: str | None = None
    license: str = 'ODbL-1.0'
    attribution: str = '© OpenStreetMap contributors · Powered by Geoapify'


class TripCreate(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    timezone: str = 'Asia/Kolkata'
    currency: str = 'INR'

    @field_validator('timezone')
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError('Choose a valid IANA timezone.') from exc
        return value

    @field_validator('currency')
    @classmethod
    def valid_currency(cls, value):
        if not pycountry.currencies.get(alpha_3=value):
            raise ValueError('Choose a valid ISO currency.')
        return value

    @model_validator(mode='after')
    def valid_range(self):
        if not 0 <= (self.end_date-self.start_date).days < 30:
            raise ValueError('Trips support 1–30 calendar days.')
        return self


class TripChange(StrictModel):
    kind: Literal['update_metadata', 'add_item', 'move_item', 'update_item', 'remove_item']
    place_id: UUID | None = None
    item_id: UUID | None = None
    day_index: int | None = Field(default=None, ge=0, le=29)
    position: int | None = Field(default=None, ge=0, le=199)
    notes: str | None = Field(default=None, max_length=4000)
    metadata: TripCreate | None = None

    @model_validator(mode='after')
    def required_fields(self):
        if self.kind == 'update_metadata' and self.metadata is None:
            raise ValueError('Trip metadata is required.')
        if self.kind == 'add_item' and (self.place_id is None or self.day_index is None):
            raise ValueError('A place and day are required.')
        if self.kind in ('move_item', 'update_item', 'remove_item') and self.item_id is None:
            raise ValueError('An item ID is required.')
        if self.kind == 'move_item' and self.day_index is None:
            raise ValueError('A destination day is required.')
        if self.kind == 'update_item' and self.notes is None:
            raise ValueError('Notes are required.')
        allowed = {
            'update_metadata': {'metadata'}, 'add_item': {'place_id','day_index','notes'},
            'move_item': {'item_id','day_index','position'}, 'update_item': {'item_id','notes'},
            'remove_item': {'item_id'},
        }[self.kind]
        if any(getattr(self, key) is not None for key in self.model_fields_set - allowed - {'kind'}):
            raise ValueError('Unsupported fields for this change.')
        return self


class TripItem(StrictModel):
    id: UUID
    day_index: int
    position: int
    place: ResolvedPlace
    notes: str = ''


class TripDocument(TripCreate):
    schema_version: Literal[2] = 2
    id: UUID
    version: int
    created_at: datetime
    updated_at: datetime
    items: list[TripItem] = Field(default_factory=list)
    origin: str = 'user'


class Actor(StrictModel):
    id: UUID
    issuer: str
    subject: str


class PlaceSearchResult(StrictModel):
    places: list[ResolvedPlace]
    request_id: str
    source: str
    partial: bool = False
    cached: bool = False
    message: str | None = None
