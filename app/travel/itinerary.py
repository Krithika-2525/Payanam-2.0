"""Constraint-aware daily routes from real places, with explicitly estimated travel."""
from datetime import timedelta
import math
import re
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from .itinerary_models import ItineraryPlan, DayPlan, ScheduledStop
from .providers.hotspots import distance

DAYS=['Mo','Tu','We','Th','Fr','Sa','Su']

def minutes(value):
    h,m=value.split(':');return int(h)*60+int(m)

def clock(value):return f'{value//60:02d}:{value%60:02d}'

def opening_windows(expression,day):
    if not expression:return [(0,1440)],'unknown'
    if expression=='24/7':return [(0,1440)],'mapped'
    windows=[]
    for rule in expression.split(';'):
        m=re.fullmatch(r'\s*(?:(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+)?(off|closed|\d{2}:\d{2}-\d{2}:\d{2}(?:,\d{2}:\d{2}-\d{2}:\d{2})*)\s*',rule)
        if not m:return [(0,1440)],'unverified'
        first,last,value=m.groups()
        selected=list(range(7))
        if first:
            a,b=DAYS.index(first),DAYS.index(last or first)
            selected=[x%7 for x in range(a,(b if b>=a else b+7)+1)]
        if day.weekday() not in selected:continue
        windows=[]  # Later matching rules override normal weekly hours (e.g. We off).
        if value in ('off','closed'):continue
        for interval in value.split(','):
            a,b=map(minutes,interval.split('-'))
            if not 0<=a<b<=1440:return [(0,1440)],'unverified'
            windows.append((a,b))
    return (sorted(windows),'mapped') if windows else ([],'closed')

def travel(a,b,mode):
    meters=round(distance(a,b)*1.3)
    # A geometric estimate with detour allowance, not a road-route or live traffic claim.
    return max(1,math.ceil(meters/(4500 if mode=='walk' else 25000)*60)),meters


def plan_day(request,city,places,day,index,required):
    start,end=minutes(request.day_start),minutes(request.day_end)
    cap={'relaxed':3,'balanced':5,'packed':7}[request.pace]
    candidates=[]
    for p in places:
        windows,status=opening_windows(p.opening_hours,day)
        if not windows:continue
        duration=p.recommended_duration_minutes or 60
        if request.pace=='relaxed':duration=math.ceil(duration*1.2)
        valid=[]
        for a,b in windows:
            # Visiting and a full lunch/rest break never overlap.
            for x,y in [(start,min(end,780)),(max(start,840),end)]:
                lo,hi=max(a,x),min(b,y)-duration
                if hi>=lo:valid.append((lo,hi))
        if valid:candidates.append((p,duration,valid,status))
    candidates.sort(key=lambda x:(x[0].id not in required,x[0].category not in request.interests,
        not bool(x[0].wikipedia),x[0].distance_m or 0))
    candidates=candidates[:35]
    if not candidates:return DayPlan(day_index=index,date=day,stops=[],distance_m=0,travel_minutes=0,return_minutes=0,return_at=clock(start),theme='Room to explore')
    points=[city]+[v[0] for v in candidates]
    matrix=[[travel(a,b,request.mode)[0] if i!=j else 0 for j,b in enumerate(points)] for i,a in enumerate(points)]
    manager=pywrapcp.RoutingIndexManager(len(points),1,0)
    routing=pywrapcp.RoutingModel(manager)
    def transit(a,b):
        i,j=manager.IndexToNode(a),manager.IndexToNode(b)
        return matrix[i][j]+(candidates[i-1][1] if i else 0)
    callback=routing.RegisterTransitCallback(transit)
    routing.SetArcCostEvaluatorOfAllVehicles(callback)
    routing.AddDimension(callback,1440,end,False,'Time')
    times=routing.GetDimensionOrDie('Time')
    times.CumulVar(routing.Start(0)).SetRange(start,start)
    times.CumulVar(routing.End(0)).SetRange(start,end)
    if start <= 780 and end >= 840:
        lunch_interval=routing.solver().FixedDurationIntervalVar(780,780,60,False,'Lunch')
        times.SetBreakIntervalsOfVehicle([lunch_interval],0,
            [candidates[manager.IndexToNode(i)-1][1] if manager.IndexToNode(i) else 0
             for i in range(routing.Size())])
    counter=routing.RegisterUnaryTransitCallback(lambda i:int(manager.IndexToNode(i)!=0))
    routing.AddDimensionWithVehicleCapacity(counter,0,[cap],True,'Stops')
    for i,(p,duration,windows,status) in enumerate(candidates,1):
        idx=manager.NodeToIndex(i)
        cumul=times.CumulVar(idx)
        cumul.SetRange(windows[0][0],windows[-1][1])
        for (_,b),(a,_) in zip(windows,windows[1:]):
            if a>b+1:cumul.RemoveInterval(b+1,a-1)
        penalty=100000 if p.id in required else 300+(100 if p.category in request.interests else 0)+(50 if p.wikipedia else 0)
        routing.AddDisjunction([idx],penalty)
        routing.AddVariableMinimizedByFinalizer(cumul)
    routing.AddVariableMinimizedByFinalizer(times.CumulVar(routing.End(0)))
    params=pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy=routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    params.local_search_metaheuristic=routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromMilliseconds(120)
    solution=routing.SolveWithParameters(params)
    stops=[];total_distance=0;total_travel=0;previous=city
    if solution:
        idx=solution.Value(routing.NextVar(routing.Start(0)))
        while not routing.IsEnd(idx):
            node=manager.IndexToNode(idx)
            p,duration,_,status=candidates[node-1]
            arrival=solution.Value(times.CumulVar(idx))
            duration_travel,meters=travel(previous,p,request.mode)
            total_distance+=meters;total_travel+=duration_travel
            stops.append(ScheduledStop(place=p,arrival=clock(arrival),departure=clock(arrival+duration),
                duration_minutes=duration,travel_minutes=duration_travel,distance_m=meters,hours_status=status,
                reason=('Matches your '+p.category+' interest' if p.category in request.interests else 'Adds variety nearby')+(' · a must-visit' if p.id in required else '')))
            previous=p;idx=solution.Value(routing.NextVar(idx))
        return_at=solution.Value(times.CumulVar(routing.End(0)))
    else:return_at=start
    return_minutes,return_meters=travel(previous,city,request.mode) if stops else (0,0)
    lunch=bool(stops) and return_at>=840 and start<=780
    counts={p.place.category:sum(s.place.category==p.place.category for s in stops) for p in stops}
    theme=(max(counts,key=counts.get).replace('_',' ').title()+' & discovery') if counts else 'Room to explore'
    return DayPlan(day_index=index,date=day,stops=stops,distance_m=total_distance+return_meters,
        travel_minutes=total_travel+return_minutes,return_minutes=return_minutes,return_at=clock(return_at),
        lunch_start='13:00' if lunch else None,lunch_end='14:00' if lunch else None,theme=theme)


def schedule_order(request,city,places,day,index):
    lookup={p.id:p for p in places}
    stops=[];now=minutes(request.day_start);end=minutes(request.day_end);previous=city
    total_distance=0;total_travel=0
    for id in request.fixed_order[index]:
        p=lookup.get(id)
        if not p:continue
        windows,status=opening_windows(p.opening_hours,day)
        duration=p.recommended_duration_minutes or 60
        if request.pace=='relaxed':duration=math.ceil(duration*1.2)
        t,meters=travel(previous,p,request.mode)
        arrival=None
        for a,b in windows:
            travel_end=now+t
            if now<840 and travel_end>780 and minutes(request.day_start)<=780:
                travel_end=max(840,travel_end+60)
            candidate=max(travel_end,a)
            if candidate<840 and candidate+duration>780:candidate=max(840,a)
            departure=candidate+duration
            returned=departure+travel(p,city,request.mode)[0]
            if departure<840 and returned>780 and minutes(request.day_start)<=780:
                returned=max(840,returned+60)
            if departure<=b and returned<=end:
                arrival=candidate;break
        if arrival is None:continue
        stops.append(ScheduledStop(place=p,arrival=clock(arrival),departure=clock(arrival+duration),duration_minutes=duration,
            travel_minutes=t,distance_m=meters,hours_status=status,reason='Your chosen stop and order'))
        total_distance+=meters;total_travel+=t;now=arrival+duration;previous=p
    t,meters=travel(previous,city,request.mode) if stops else (0,0)
    returned=now+t
    if stops and now<840 and returned>780 and minutes(request.day_start)<=780:
        returned=max(840,returned+60)
    lunch=bool(stops) and returned>=840 and minutes(request.day_start)<=780
    return DayPlan(day_index=index,date=day,stops=stops,distance_m=total_distance+meters,travel_minutes=total_travel+t,
        return_minutes=t,return_at=clock(returned),theme='Your own route',lunch_start='13:00' if lunch else None,lunch_end='14:00' if lunch else None)


def generate_itinerary(request,city,places):
    remaining=[p for p in places if p.id not in set(request.exclude)]
    required=set(request.must_visit)
    if request.fixed_order is not None:required.update(id for day in request.fixed_order for id in day)
    days=[]
    for i in range(request.days):
        day=(schedule_order(request,city,places,request.start_date+timedelta(days=i),i)
             if request.fixed_order is not None else plan_day(request,city,remaining,request.start_date+timedelta(days=i),i,required))
        days.append(day)
        used={s.place.id for s in day.stops}
        remaining=[p for p in remaining if p.id not in used]
        required-=used
    warnings=['Travel distances and times are geometric estimates, including a detour allowance. Confirm real routes before travelling.',
              'Mapped opening hours are community records, not verified availability. Ticket prices and bookings are not included.']
    for id in sorted(required,key=str):
        place=next((p for p in places if p.id==id),None)
        warnings.append((place.name if place else 'A required stop')+' could not fit the dates, opening hours or travel time. Extend the trip, change mode or adjust the daily window.')
    if any(not d.stops for d in days):warnings.append('Some days have no feasible unvisited stops. Use that time to rest, widen your interests, or add your own confirmed places.')
    return ItineraryPlan(city=city,preferences=request,days=days,warnings=warnings,
        attributions=sorted({city.attribution,*[s.place.attribution for d in days for s in d.stops]}))
