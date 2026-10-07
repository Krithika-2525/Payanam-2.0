import gzip
import json
from functools import lru_cache
from pathlib import Path
import unicodedata
from uuid import NAMESPACE_URL, uuid5

import pycountry

from ..models import PlaceQuery, ResolvedPlace


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value.casefold()) if not unicodedata.combining(c))


@lru_cache(maxsize=1)
def city_data():
    with gzip.open(Path(__file__).parent.parent/'data/cities.json.gz', 'rt', encoding='utf-8') as file:
        document = json.load(file)
    rows = []
    for row in document['cities']:
        rows.append((row, normalized(row[1]), normalized(row[2]), [normalized(n) for n in row[3].split(',')]))
    lookup = {uuid5(NAMESPACE_URL,'geonames:'+row[0]):row for row,*_ in rows}
    return document, rows, lookup


class CityProvider:
    def __init__(self):
        self.document, self.rows, self.lookup = city_data()

    def place(self, row):
        country = pycountry.countries.get(alpha_2=row[6])
        return ResolvedPlace(id=uuid5(NAMESPACE_URL,'geonames:'+row[0]),provider='geonames',source_id=row[0],
            name=row[1],country=country.name if country else row[6],country_code=row[6],
            longitude=row[5],latitude=row[4],timezone=row[7] or None,kind='city',
            retrieved_at=self.document['retrieved_at'],observed_at=None,
            source_url='https://www.geonames.org/'+row[0],license='CC-BY-4.0',attribution='GeoNames · CC BY 4.0')

    def search(self, query: PlaceQuery):
        q = normalized(query.q)
        matches = []
        for row,name,ascii_name,aliases in self.rows:
            if query.country and row[6] != query.country:
                continue
            names = [name,ascii_name,*aliases]
            if q in names:
                rank=0
            elif name.startswith(q) or ascii_name.startswith(q):
                rank=1
            elif any(q in n for n in names):
                rank=2
            else:
                continue
            matches.append((rank,-row[8],row))
        matches.sort(key=lambda x:(x[0],x[1],x[2][0]))
        return [self.place(row) for _,_,row in matches[:query.limit]]

    def resolve(self, place_id):
        row = self.lookup.get(place_id)
        return self.place(row) if row else None
