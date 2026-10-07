import {lazy,Suspense} from 'react';
const Legacy=lazy(()=>import('./LegacyApp'));
const Travel=lazy(()=>import('./travel/TravelApp'));
export default function App(){
  const legacy=new URLSearchParams(location.search).get('mode')==='demo';
  return <Suspense fallback={<div role="status" className="app-loading">Opening your journey…</div>}>{legacy?<Legacy/>:<Travel/>}</Suspense>;
}
