"""Refresh the licensed GeoNames city snapshot. Explicit manual action, no API key."""
import argparse
import gzip
import io
import json
from pathlib import Path
from datetime import datetime, timezone
import urllib.request
import zipfile

URL = 'https://download.geonames.org/export/dump/cities15000.zip'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='app/travel/data/cities.json.gz')
    args = parser.parse_args()
    request = urllib.request.Request(URL, headers={'User-Agent': 'Payanam-city-snapshot/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        archive = zipfile.ZipFile(io.BytesIO(response.read(32*1024*1024)))
    cities = []
    for line in archive.read('cities15000.txt').decode('utf-8').splitlines():
        row = line.split('\t')
        if len(row) != 19:
            raise ValueError('GeoNames source schema changed.')
        cities.append([row[0], row[1], row[2], row[3], float(row[4]), float(row[5]),
                       row[8], row[17], int(row[14]), row[18]])
    document = {'source': URL, 'license': 'CC-BY-4.0',
                'retrieved_at': datetime.now(timezone.utc).isoformat(), 'cities': cities}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(output, 'wt', encoding='utf-8', compresslevel=9) as file:
        json.dump(document, file, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(cities)} real cities written; {output.stat().st_size} compressed bytes. Attribution: GeoNames, CC BY 4.0.')


if __name__ == '__main__':
    main()
