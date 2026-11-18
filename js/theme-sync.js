/* TecnoMath — Motor global de temáticas v4 · Supabase */
(function(){'use strict';
const THEMES={normal:{emoji:'📚',name:'Normal',colors:{bg:'#060610',card:'#0d0d1a',border:'#1a1a2e',text:'#fff',muted:'#aaa',cyan:'#00FFFF',pink:'#FF00FF',green:'#39FF14',yellow:'#FFE600',gold:'#FFD700'}},halloween:{emoji:'🎃',name:'Halloween',colors:{bg:'#10050a',card:'#1b0b16',border:'#5b1f49',text:'#fff4e6',muted:'#d8b9c8',cyan:'#ff7a00',pink:'#ff3d00',green:'#b6ff00',yellow:'#ff9f00',gold:'#ff6a00'}},navidad:{emoji:'🎄',name:'Navidad',colors:{bg:'#06120d',card:'#0c2118',border:'#1e5b3b',text:'#fff',muted:'#b9d8c6',cyan:'#65e6ff',pink:'#ff3b5c',green:'#39ff7a',yellow:'#ffe66d',gold:'#ffd700'}},verano:{emoji:'☀️',name:'Verano',colors:{bg:'#071827',card:'#0c2438',border:'#1f6285',text:'#fff',muted:'#b7d1df',cyan:'#29d9ff',pink:'#ff5ea8',green:'#70ff9a',yellow:'#ffe66d',gold:'#ffd166'}},mundial:{emoji:'🏆',name:'Mundial',colors:{bg:'#07100a',card:'#0e1d11',border:'#355b3a',text:'#fff',muted:'#bfd3c2',cyan:'#4de1ff',pink:'#e8c547',green:'#4cff70',yellow:'#ffe600',gold:'#ffd700'}},regreso:{emoji:'🎒',name:'Regreso a clases',colors:{bg:'#10100a',card:'#1c1c0e',border:'#5d5a24',text:'#fff',muted:'#d0d0b4',cyan:'#5fd7ff',pink:'#ff72b6',green:'#75ff75',yellow:'#ffe600',gold:'#ffcc33'}},cumpleanos:{emoji:'🥳',name:'Cumpleaños',colors:{bg:'#130b18',card:'#21102b',border:'#703c85',text:'#fff',muted:'#d7c6df',cyan:'#55eaff',pink:'#ff66cc',green:'#75ff8a',yellow:'#ffe66d',gold:'#ffd166'}},feria:{emoji:'🎡',name:'Feria',colors:{bg:'#130b08',card:'#24130d',border:'#78401f',text:'#fff5e8',muted:'#dcc6b5',cyan:'#39e8ff',pink:'#ff4f81',green:'#7dff5c',yellow:'#ffe04b',gold:'#ffc400'}},feriaplus:{emoji:'🔥',name:'Feria Plus',colors:{bg:'#160604',card:'#280b08',border:'#8b2919',text:'#fff2e8',muted:'#dfc1b7',cyan:'#4deaff',pink:'#ff3b30',green:'#8cff4d',yellow:'#ffd000',gold:'#ff9d00'}},primavera:{emoji:'🌸',name:'Primavera',colors:{bg:'#100b14',card:'#1e1220',border:'#6f3d68',text:'#fff5fb',muted:'#d9c8d6',cyan:'#66eaff',pink:'#ff72b6',green:'#7dff9b',yellow:'#ffe66d',gold:'#ffd166'}},espacio:{emoji:'🚀',name:'Espacio',colors:{bg:'#050611',card:'#0b1022',border:'#273b72',text:'#f3f6ff',muted:'#bfc8df',cyan:'#55eaff',pink:'#a76bff',green:'#65ffbf',yellow:'#ffe66d',gold:'#ffd166'}},ciencia:{emoji:'🔬',name:'Ciencia',colors:{bg:'#06100e',card:'#0c1c18',border:'#245b4d',text:'#effff9',muted:'#bfd9d0',cyan:'#4deaff',pink:'#ff65c7',green:'#63ff9a',yellow:'#eaff66',gold:'#ffd166'}},amoramistad:{emoji:'💖',name:'Amor & Amistad',colors:{bg:'#fff0f7',card:'#ffffff',border:'#ffb4d5',text:'#351329',muted:'#76556b',cyan:'#c026d3',pink:'#ff4f9a',green:'#10b981',yellow:'#d97706',gold:'#f59e0b'}}};
const KEY='tecnomath:tema-activo',CSS_ID='tecnomath-amor-amistad-css',CSS_URL='/css/amor-amistad.css?v=4';let listening=false;
const valid=id=>{id=String(id||'').trim().toLowerCase();return THEMES[id]?id:null};let authPromise=null;function ensureAuth(){if(window.TecnomathAuth)return Promise.resolve(window.TecnomathAuth);if(!authPromise)authPromise=new Promise((resolve,reject)=>{let s=document.querySelector('script[data-tecnomath-theme-auth]');if(!s){s=document.createElement('script');s.src='/js/tecnomath-auth.js?v=20261117-theme';s.async=false;s.dataset.tecnomathThemeAuth='true'}s.addEventListener('load',()=>window.TecnomathAuth?resolve(window.TecnomathAuth):reject(new Error('TecnoMath Auth no quedó disponible.')),{once:true});s.addEventListener('error',()=>{authPromise=null;reject(new Error('No se pudo cargar TecnoMath Auth.'))},{once:true});if(!s.isConnected)document.head.appendChild(s);if(window.TecnomathAuth)resolve(window.TecnomathAuth)});return authPromise}
function syncCss(id){let global=document.getElementById('tecnomath-theme-global-css');if(!global){global=document.createElement('link');global.id='tecnomath-theme-global-css';global.rel='stylesheet';document.head.appendChild(global)}global.href='/css/theme-global.css?v=3';let l=document.getElementById(CSS_ID);if(id==='amoramistad'){if(!l){l=document.createElement('link');l.id=CSS_ID;l.rel='stylesheet';document.head.appendChild(l)}l.href=CSS_URL}else if(l)l.remove()}
const THEME_EMOJIS={
normal:['📚','✏️','🎓','🧠','✨','📝'],
halloween:['🎃','👻','🦇','🕸️','🧙','🧛','🕷️','💀'],
navidad:['🎄','🎅','🎁','❄️','⛄','🦌','🔔','🌟'],
verano:['☀️','🌴','🏖️','🍉','🌊','🕶️','🐚','🩴'],
mundial:['⚽','🏆','🥅','🌍','🎉','⭐','🏟️','🏅'],
regreso:['🎒','📚','✏️','📐','🧮','🚌','📝','🎓'],
cumpleanos:['🎂','🎈','🎉','🥳','🎁','🎊','⭐','🪅'],
feria:['🎡','🎠','🎪','🎟️','🍿','🎈','🏆','🎯'],
feriaplus:['🔥','🎡','🎢','🚀','⭐','🏆','💥','🎯'],
primavera:['🌸','🌷','🌼','🦋','🐝','🌿','🌺','🍃'],
espacio:['🚀','🪐','🌌','👽','🛰️','🌠','⭐','🌙'],
ciencia:['🔬','🧪','🧬','⚗️','🧠','🔭','💡','🧫'],
amoramistad:['💗','💖','💕','💘','💝','💓','♥️','🌹']
};
function decorations(id){
  const old=document.getElementById('aa-global-hearts');if(old)old.remove();
  let layer=document.getElementById('tm-theme-emoji-rain');
  // La lluvia decora el portal principal; no invade partidas, formularios ni paneles administrativos.
  if(!document.getElementById('projectsContainer')){
    if(layer)layer.remove();
    return;
  }
  if(!layer){layer=document.createElement('div');layer.id='tm-theme-emoji-rain';layer.className='tm-theme-emoji-rain';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer)}
  layer.replaceChildren();
  const emojis=THEME_EMOJIS[id]||THEME_EMOJIS.normal;
  const count= id==='normal'?12:20;
  for(let i=0;i<count;i++){
    const item=document.createElement('span');
    item.className='tm-theme-emoji';
    item.textContent=emojis[i%emojis.length];
    item.style.setProperty('--tm-left',`${(i*37+11)%100}%`);
    item.style.setProperty('--tm-size',`${17+(i%4)*6}px`);
    item.style.setProperty('--tm-duration',`${11+(i%7)*1.7}s`);
    item.style.setProperty('--tm-delay',`${-(i%12)*1.35}s`);
    item.style.setProperty('--tm-drift',`${i%2?42:-38}px`);
    layer.appendChild(item);
  }
}
function apply(id,persist=true){id=valid(id)||'normal';const t=THEMES[id],c=t.colors,r=document.documentElement;Object.entries({'--theme-bg':c.bg,'--theme-card':c.card,'--theme-border':c.border,'--theme-text':c.text,'--theme-muted':c.muted,'--neon-cyan':c.cyan,'--neon-pink':c.pink,'--neon-green':c.green,'--neon-yellow':c.yellow,'--gold':c.gold,'--primary-color':c.pink,'--secondary-color':c.cyan,'--accent-color':c.gold}).forEach(([k,v])=>r.style.setProperty(k,v));r.dataset.tecnomathTheme=id;r.dataset.theme=id;r.style.colorScheme=id==='amoramistad'?'light':'dark';if(document.body){document.body.dataset.tecnomathTheme=id;document.body.dataset.theme=id;document.body.classList.toggle('tema-amor-amistad',id==='amoramistad');decorations(id)}syncCss(id);if(persist)try{localStorage.setItem(KEY,id)}catch(_){}document.title=`${t.emoji} TecnoMath · Plataforma Educativa Interactiva`;window.TecnomathTheme={id,name:t.name,emoji:t.emoji,colors:{...c},apply};window.dispatchEvent(new CustomEvent('tecnomath:themechange',{detail:{id,theme:t}}))}
function cached(){try{return valid(localStorage.getItem(KEY))}catch(_){return null}}
async function load(){let id=cached()||'normal';try{const a=await ensureAuth();const db=await a.getClient();const {data,error}=await db.rpc('tecnomath_get_settings');if(error)throw error;if(data)id=valid(data.theme)||id}catch(e){console.warn('TecnoMath: no se pudo cargar configuración Supabase',e)}apply(id,false)}
async function listen(){try{const a=await ensureAuth();const db=await a.getClient();if(listening)return;listening=true;await load();db.channel('tecnomath-settings').on('postgres_changes',{event:'*',schema:'public',table:'tecnomath_settings',filter:'key=eq.theme'},()=>load()).subscribe()}catch(e){console.warn('TecnoMath: listener de configuración no disponible',e);window.setTimeout(listen,5000)}}
window.TecnomathThemes={list:()=>Object.keys(THEMES),get:id=>THEMES[valid(id)||'normal'],apply};
function start(){load();listen();window.addEventListener('focus',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});window.setInterval(()=>{if(!document.hidden)load()},45000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
