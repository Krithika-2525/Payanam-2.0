import type {Plan, SavedJourney} from './types';
const KEY='payanam.saved.v1';
const IDS=['meenakshi','palace','gandhi','teppakulam','alagar','pazhamudircholai'];
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=500):v is string=>typeof v==='string'&&v.length<=max;
const integer=(v:unknown,max=100000)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=max;
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=6&&v.every(x=>typeof x==='string'&&IDS.includes(x))&&new Set(v).size===v.length;
const choice=(v:unknown,values:string[])=>typeof v==='string'&&values.includes(v);
const minute=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3));
export function isPlan(value:unknown):value is Plan{
  if(!object(value)||value.schema_version!==1||typeof value.feasible!=='boolean'||!choice(value.status,['optimal','feasible','infeasible','timeout'])||!object(value.request))return false;
  const r=value.request;
  if(!text(r.date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||!text(r.start_time,5)||!text(r.end_time,5)||![r.start_time,r.end_time].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||r.end_time<=r.start_time)return false;
  if(!integer(r.budget_inr)||Number(r.budget_inr)<1||!integer(r.party_size,20)||Number(r.party_size)<1||!integer(r.max_stops,6)||Number(r.max_stops)<1||!ids(r.required_place_ids)||!ids(r.optional_place_ids)||!choice(r.pace,['standard','relaxed'])||!choice(r.transport,['balanced','bus','cab']))return false;
  const candidates=[...r.required_place_ids,...r.optional_place_ids];
  if(!candidates.length||new Set(candidates).size!==candidates.length||r.required_place_ids.length>Number(r.max_stops))return false;
  if(!Array.isArray(value.stops)||value.stops.length>Number(r.max_stops)||!ids(value.skipped_place_ids)||!integer(value.total_cost_inr)||!integer(value.total_travel_minutes,2000)||!integer(value.finish_min,2000)||!integer(value.completed_count,6)||!integer(value.progress_min,2000)||!text(value.disclaimer)||!text(value.dataset_version,100)||!text(value.signature,64)||!/^[a-f0-9]{64}$/.test(value.signature)||!Array.isArray(value.suggestions)||value.suggestions.length>10||!value.suggestions.every(s=>text(s)))return false;
  if(!value.stops.every(s=>object(s)&&typeof s.place_id==='string'&&candidates.includes(s.place_id)&&text(s.name,150)&&text(s.tamil_name,150)&&text(s.explanation)&&choice(s.mode,['bus','cab'])&&['arrival_min','departure_min','dwell_minutes','rest_minutes','travel_minutes','wait_minutes'].every(k=>integer(s[k],2000))&&integer(s.cost_inr)&&typeof s.lat==='number'&&Number.isFinite(s.lat)&&Math.abs(s.lat)<=90&&typeof s.lon==='number'&&Number.isFinite(s.lon)&&Math.abs(s.lon)<=180))return false;
  const plan=value as unknown as Plan;
  if(!plan.feasible)return ['infeasible','timeout'].includes(plan.status)&&plan.stops.length===0;
  if(!['optimal','feasible'].includes(plan.status)||!plan.stops.length||plan.completed_count>plan.stops.length||plan.total_cost_inr>plan.request.budget_inr)return false;
  const visited=plan.stops.map(s=>s.place_id);
  if(new Set(visited).size!==visited.length||!plan.request.required_place_ids.every(id=>visited.includes(id))||plan.skipped_place_ids.some(id=>visited.includes(id)||!candidates.includes(id))||candidates.some(id=>!visited.includes(id)&&!plan.skipped_place_ids.includes(id)))return false;
  let previous=minute(plan.request.start_time);
  for(const stop of plan.stops){if(stop.arrival_min<previous+stop.travel_minutes+stop.wait_minutes||stop.departure_min!==stop.arrival_min+stop.dwell_minutes+stop.rest_minutes||stop.departure_min>minute(plan.request.end_time))return false;previous=stop.departure_min;}
  return plan.finish_min===previous&&plan.total_cost_inr===plan.stops.reduce((sum,s)=>sum+s.cost_inr,0)&&plan.total_travel_minutes===plan.stops.reduce((sum,s)=>sum+s.travel_minutes,0);
}
export function loadSaved():SavedJourney[]{
  try{const raw=localStorage.getItem(KEY);if(!raw||raw.length>1000000)return [];const values:unknown=JSON.parse(raw);return Array.isArray(values)?values.filter((v):v is SavedJourney=>object(v)&&text(v.id,100)&&text(v.saved_at,40)&&Number.isFinite(Date.parse(v.saved_at))&&isPlan(v.plan)).slice(0,50):[];}catch{return [];}
}
export function persistSaved(values:SavedJourney[]){try{localStorage.setItem(KEY,JSON.stringify(values.slice(0,50)));}catch{throw new Error('This browser could not save the journey. Export a backup instead.');}}
export function importPlan(raw:string):Plan{if(raw.length>65536)throw new Error('Choose a valid Payanam journey file smaller than 64 KB.');try{const parsed:unknown=JSON.parse(raw);if(object(parsed)&&parsed.kind==='payanam-journey'&&parsed.version===1&&isPlan(parsed.plan))return parsed.plan;}catch{/* report one clear error */}throw new Error('Choose a valid Payanam journey backup exported from this app.');}
export function exportPlan(plan:Plan){const blob=new Blob([JSON.stringify({kind:'payanam-journey',version:1,plan},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`payanam-${plan.request.date}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
