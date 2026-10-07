"""Curated demonstration data, deliberately separate from live inventory."""
from dataclasses import dataclass
from math import asin, ceil, cos, radians, sin, sqrt

DATASET_VERSION = 'madurai-sample-2026-10-07'
DISCLAIMER = 'Illustrative opening hours, fares and travel times. Confirm locally before traveling. No tickets or transport are booked.'


@dataclass(frozen=True)
class Place:
    id: str
    name: str
    tamil_name: str
    category: str
    lat: float
    lon: float
    windows: tuple[tuple[int, int], ...]
    dwell_minutes: int
    description: str


HUB = Place('madurai-station', 'Madurai Junction', 'மதுரை சந்திப்பு', 'hub', 9.9196, 78.1107,
            ((0, 1440),), 0, 'Begin your day from the city railway station.')
PLACES = {p.id: p for p in [
    Place('meenakshi', 'Meenakshi Amman Temple', 'மீனாட்சி அம்மன் கோவில்', 'temple', 9.9195, 78.1193,
          ((300, 750), (960, 1260)), 65, 'Leave time for a meaningful visit in the heart of Madurai.'),
    Place('palace', 'Thirumalai Nayakkar Palace', 'திருமலை நாயக்கர் அரண்மனை', 'heritage', 9.9150, 78.1238,
          ((540, 1020),), 50, 'A slower moment to explore the city’s architectural heritage.'),
    Place('gandhi', 'Gandhi Memorial Museum', 'காந்தி நினைவு அருங்காட்சியகம்', 'museum', 9.9297, 78.1397,
          ((600, 780), (840, 1020)), 50, 'Make room for history and a quieter change of pace.'),
    Place('teppakulam', 'Vandiyur Mariamman Teppakulam', 'வண்டியூர் மாரியம்மன் தெப்பக்குளம்', 'outdoors', 9.9125, 78.1494,
          ((360, 1200),), 35, 'A gentle outdoor pause beside the temple tank.'),
    Place('alagar', 'Alagar Kovil', 'அழகர் கோவில்', 'temple', 10.0741, 78.2131,
          ((360, 750), (960, 1200)), 65, 'An excursion beyond the city, with extra time for travel.'),
    Place('pazhamudircholai', 'Pazhamudircholai', 'பழமுதிர்சோலை', 'temple', 10.0936, 78.2228,
          ((360, 1080),), 50, 'A hill-side visit that pairs naturally with the Alagar area.'),
]}


def catalog() -> dict:
    from dataclasses import asdict
    return {'dataset_version': DATASET_VERSION, 'disclaimer': DISCLAIMER,
            'region': 'Madurai, Tamil Nadu', 'timezone': 'Asia/Kolkata',
            'hub': asdict(HUB), 'places': [asdict(p) for p in PLACES.values()],
            'paces': ['standard', 'relaxed'], 'transports': ['balanced', 'bus', 'cab']}


def travel_options(origin: Place, target: Place, party_size: int, transport: str):
    dlat, dlon = radians(target.lat - origin.lat), radians(target.lon - origin.lon)
    a = sin(dlat / 2) ** 2 + cos(radians(origin.lat)) * cos(radians(target.lat)) * sin(dlon / 2) ** 2
    km = 6371 * 2 * asin(min(1, sqrt(a))) * 1.35
    options = []
    if transport in ('balanced', 'cab'):
        options.append(('cab', max(8, ceil(km / .48) + 5), (70 + ceil(km * 18)) * ceil(party_size / 4)))
    if transport in ('balanced', 'bus'):
        options.append(('bus', max(15, ceil(km / .35) + 15), (20 + ceil(km * 3)) * party_size))
    return options
