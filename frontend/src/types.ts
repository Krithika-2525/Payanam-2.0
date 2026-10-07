export interface Preferences {date:string;start_time:string;end_time:string;budget_inr:number;party_size:number;required_place_ids:string[];optional_place_ids:string[];pace:'standard'|'relaxed';transport:'balanced'|'bus'|'cab';max_stops:number}
export interface Place {id:string;name:string;tamil_name:string;category:string;lat:number;lon:number;windows:[number,number][];dwell_minutes:number;description:string}
export interface Catalog {dataset_version:string;disclaimer:string;region:string;timezone:string;hub:Place;places:Place[]}
export interface Stop {place_id:string;name:string;tamil_name:string;arrival_min:number;departure_min:number;dwell_minutes:number;rest_minutes:number;travel_minutes:number;wait_minutes:number;mode:'bus'|'cab';cost_inr:number;lat:number;lon:number;explanation:string}
export interface Plan {schema_version:1;feasible:boolean;status:'optimal'|'feasible'|'infeasible'|'timeout';request:Preferences;stops:Stop[];skipped_place_ids:string[];total_cost_inr:number;total_travel_minutes:number;finish_min:number;suggestions:string[];disclaimer:string;dataset_version:string;signature:string;completed_count:number;progress_min:number}
export interface SavedJourney {id:string;saved_at:string;plan:Plan}
export type Language = 'en'|'ta';
export const money=(amount:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(amount);
export const clock=(minute:number)=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
export const tripDate=(value:string)=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00+05:30`));
