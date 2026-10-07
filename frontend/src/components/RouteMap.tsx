import type {Plan} from '../types';
const ORIGIN={lat:9.9196,lon:78.1107};
export function RouteMap({plan}:{plan:Plan}){
 const points=[ORIGIN,...plan.stops];const lats=points.map(p=>p.lat),lons=points.map(p=>p.lon);const minLat=Math.min(...lats)-.009,maxLat=Math.max(...lats)+.009,minLon=Math.min(...lons)-.009,maxLon=Math.max(...lons)+.009;
 const xy=(p:{lat:number;lon:number})=>[32+(p.lon-minLon)/(maxLon-minLon)*256,235-(p.lat-minLat)/(maxLat-minLat)*198];
 return <div className="route-map"><div className="map-label"><span>YOUR DAY AT A GLANCE</span><small>Geographic sketch · not navigation</small></div><svg viewBox="0 0 320 272" role="img" aria-label="Geographic sketch of your selected Madurai visits">
 <rect width="320" height="272" fill="#e8ece1"/>{[50,110,175,230].map(v=><path key={v} d={`M0 ${v}Q100 ${v-35} 320 ${v+20}M${v} 0Q${v-25} 140 ${v+30} 272`} stroke="#f8f8ed" strokeWidth="12" fill="none"/>)}
 <path d="M0 130Q120 75 160 125T320 95" fill="none" stroke="#c4d9d1" strokeWidth="14"/>
 <polyline points={points.map(p=>xy(p).join(',')).join(' ')} fill="none" stroke="#467557" strokeWidth="3" strokeLinejoin="round" strokeDasharray="5 4"/>
 {points.map((p,i)=>{const [x,y]=xy(p);return <g key={i}><circle cx={x} cy={y} r="14" fill={i?'#2c5540':'#b87350'} stroke="#fffaf0" strokeWidth="3"/><text x={x} y={y+4} textAnchor="middle" fill="white" fontSize="11" fontFamily="sans-serif">{i||'S'}</text></g>})}
 <text x="20" y="259" fontSize="10" fill="#788471" fontFamily="sans-serif">MADURAI · TAMIL NADU</text></svg></div>
}
