export function TempleArt(){return <svg className="temple-art" viewBox="0 0 600 440" role="img" aria-label="An original illustration of a Tamil temple tower under a warm sun">
<defs><linearGradient id="sky" x2="0" y2="1"><stop stopColor="#e6eedf"/><stop offset="1" stopColor="#f4e6c9"/></linearGradient><linearGradient id="tower" x2="1" y2="0"><stop stopColor="#b56e47"/><stop offset="1" stopColor="#dda273"/></linearGradient></defs>
<rect width="600" height="440" rx="18" fill="url(#sky)"/><circle cx="383" cy="133" r="73" fill="#e2ae66" opacity=".8"/><circle cx="383" cy="133" r="92" stroke="#e2ae66" strokeWidth="1" fill="none" opacity=".35"/>
<path d="M0 323Q90 277 175 313T350 315T600 282V440H0" fill="#c5d0b2"/><path d="M0 356Q85 300 220 354T455 330T600 350V440H0" fill="#90a681"/>
<path d="M66 435Q147 310 274 373T558 396" fill="none" stroke="#e6dfc6" strokeWidth="32"/>
<path d="M112 423Q208 344 340 376T509 399" fill="none" stroke="#f8f0d9" strokeWidth="2" strokeDasharray="4 7"/>
<g transform="translate(160 70)"><path d="M30 280H250L210 28H70Z" fill="url(#tower)"/>
{Array.from({length:8},(_,i)=>{const y=43+i*30,w=145+i*9,x=140-w/2;return <g key={i}><rect x={x-8} y={y+19} width={w+16} height="6" rx="2" fill="#8d5138"/><rect x={x} y={y} width={w} height="18" fill="#d99966"/>{Array.from({length:5},(_,j)=><g key={j}><path d={`M${x+12+j*(w-20)/5} ${y+16}v-9q4-6 8 0v9`} fill="#6f674d"/><circle cx={x+16+j*(w-20)/5} cy={y+1} r="2" fill="#ead4a0"/></g>)}</g>})}
<path d="M85 25Q140 1 195 25V37H85Z" fill="#ad6f49"/>{[102,121,140,159,178].map(x=><g key={x}><rect x={x-2} y="8" width="4" height="19" fill="#7d643f"/><circle cx={x} cy="7" r="3" fill="#b99554"/></g>)}
<rect x="23" y="280" width="234" height="13" fill="#976d48"/><path d="M111 293V257Q140 214 169 257V293" fill="#3a5d49"/><path d="M119 293V259Q140 229 161 259V293" fill="#293e32"/></g>
<g fill="#355a44"><path d="M49 336q-30-75 14-113q45 43 2 118Z"/><path d="M506 337q-30-80 12-120q44 40 6 122Z"/></g><path d="M60 254v106m460-111v114" stroke="#616444" strokeWidth="5"/>
<g transform="translate(426 286)"><rect width="136" height="53" rx="10" fill="#fffaf0"/><circle cx="22" cy="26" r="13" fill="#e8eddf"/><path d="m16 26 4 4 8-9" fill="none" stroke="#3b6147" strokeWidth="2"/><text x="44" y="23" fontSize="10" fill="#264d3d" fontFamily="sans-serif">A little more wonder.</text><text x="44" y="37" fontSize="9" fill="#677262" fontFamily="sans-serif">A little less hurry.</text></g>
<path d="m430 84 5-4 5 4m-305 37 5-4 5 4" stroke="#667760" fill="none" strokeWidth="2"/></svg>}
