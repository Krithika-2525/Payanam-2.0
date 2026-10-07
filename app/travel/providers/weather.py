from collections import OrderedDict
from datetime import datetime, timezone
import time
import httpx

class WeatherProvider:
    def __init__(self,client):self.client=client;self.cache=OrderedDict()
    async def forecast(self,city):
        key=str(city.id)
        if key in self.cache and time.monotonic()-self.cache[key][0]<1800:return self.cache[key][1]
        try:
            r=await self.client.get('https://api.open-meteo.com/v1/forecast',params={
                'latitude':city.latitude,'longitude':city.longitude,'timezone':city.timezone or 'UTC','forecast_days':14,
                'daily':'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'},timeout=8)
            r.raise_for_status()
            if len(r.content)>100000:raise ValueError('Forecast too large')
            d=r.json()['daily']
            days=[{'date':v,'code':d['weather_code'][i],'high':d['temperature_2m_max'][i],
                   'low':d['temperature_2m_min'][i],'rain_probability':d['precipitation_probability_max'][i]} for i,v in enumerate(d['time'])]
            result={'available':True,'source':'Open-Meteo','source_url':'https://open-meteo.com/',
                    'license':'CC-BY-4.0','retrieved_at':datetime.now(timezone.utc).isoformat(),
                    'units':{'temperature':'°C','rain_probability':'%'},'days':days,
                    'message':'Forecast, not guaranteed conditions. Available only for the displayed dates.'}
        except (httpx.HTTPError,ValueError,KeyError,TypeError,IndexError):
            result={'available':False,'days':[],'message':'The weather service is unavailable. Your itinerary still works.'}
        self.cache[key]=(time.monotonic(),result)
        while len(self.cache)>128:self.cache.popitem(last=False)
        return result
