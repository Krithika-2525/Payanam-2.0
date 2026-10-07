import type {Catalog,Plan,Preferences} from './types';
import {isPlan} from './storage';
const configured=(import.meta as unknown as {env:Record<string,string>}).env;
const base=(configured.VITE_API_BASE_URL||(configured.DEV?'http://127.0.0.1:8000':'')).replace(/\/$/,'');
async function call<T>(path:string,body?:unknown):Promise<T>{
 if(!base)throw new Error('The planner connection is being prepared. Please try again soon.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
 try{const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:controller.signal});
  const data=await response.json();if(!response.ok){const detail=data.detail;throw new Error(typeof detail==='string'?detail:response.status===422?'Please check your date, times and visit choices.':'We could not reach the planner. Please try again shortly.');}return data as T;
 }catch(error){if(error instanceof TypeError||error instanceof DOMException)throw new Error('We could not reach the planner. Your preferences are still here. Please try again.');throw error;}finally{clearTimeout(timer);}
}
export const fetchCatalog=()=>call<Catalog>('/api/v1/catalog');
export async function preview(preferences:Preferences){const plan=await call<Plan>('/api/v1/plans/preview',preferences);if(!isPlan(plan))throw new Error('The planner returned an unreadable itinerary. Please try again.');return plan;}
export async function delayPlan(plan:Plan,completed:number,delay:number){const result=await call<Plan>('/api/v1/plans/replan',{original_plan:plan,completed_count:completed,delay_minutes:delay});if(!isPlan(result))throw new Error('The revised itinerary could not be read. Please try again.');return result;}
