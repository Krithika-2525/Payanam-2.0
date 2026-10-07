import {useEffect,useRef} from 'react';
export function useModal(open:boolean,busy:boolean,close:()=>void){
 const ref=useRef<HTMLElement>(null),busyRef=useRef(busy),closeRef=useRef(close);
 busyRef.current=busy;closeRef.current=close;
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const backgrounds=Array.from(document.querySelectorAll<HTMLElement>('.sidebar,.main-shell'));
  const previousInert=backgrounds.map(e=>e.inert);backgrounds.forEach(e=>{e.inert=true});
  ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!busyRef.current){event.preventDefault();closeRef.current();}
   if(event.key!=='Tab')return;
   const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,[tabindex="0"]')||[]).filter(e=>e.getClientRects().length>0);
   const first=items[0],last=items[items.length-1];if(!first){event.preventDefault();return;}
   if(event.shiftKey&&(document.activeElement===first||!ref.current?.contains(document.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!ref.current?.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',keyboard);
  return()=>{document.removeEventListener('keydown',keyboard);backgrounds.forEach((e,i)=>{e.inert=previousInert[i]});previous?.focus();};
 },[open]);
 return ref;
}
