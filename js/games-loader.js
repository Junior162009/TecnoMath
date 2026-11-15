/* TecnoMath · Catálogo dinámico */
(function(){'use strict';
const CATALOG='data/games.json';
let loaderDone=false;
function showLoader(){
  if(document.getElementById('tm-page-loader'))return;
  const s=document.createElement('style');s.id='tm-page-loader-style';s.textContent=`html.tm-loading,html.tm-loading body{overflow:hidden!important}html.tm-loading body>*:not(#tm-page-loader){visibility:hidden!important}#tm-page-loader{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#060610;color:#00ffff;font-family:Arial,sans-serif;transition:opacity .45s ease,visibility .45s ease}.tm-loader-box{text-align:center;width:min(88vw,360px)}.tm-loader-logo{font-size:34px;margin-bottom:18px;animation:tmLoaderPulse 1.3s ease-in-out infinite}.tm-loader-title{font:900 18px Arial,sans-serif;letter-spacing:2px;text-shadow:0 0 12px #00ffff}.tm-loader-text{margin-top:10px;color:#aaa;font:600 12px Arial,sans-serif}.tm-loader-track{height:5px;margin:22px 0 0;border-radius:99px;background:#17172a;overflow:hidden;border:1px solid #25253b}.tm-loader-bar{height:100%;width:35%;border-radius:99px;background:#00ffff;box-shadow:0 0 14px #00ffff;animation:tmLoaderBar 1.1s ease-in-out infinite}.tm-loader-dots{margin-top:12px;font:700 12px Arial,sans-serif;color:#ff00ff;letter-spacing:4px}@keyframes tmLoaderPulse{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.12);opacity:1}}@keyframes tmLoaderBar{0%{transform:translateX(-130%)}100%{transform:translateX(310%)}}#tm-page-loader.tm-loader-hide{opacity:0;visibility:hidden}`;document.head.appendChild(s);
  document.documentElement.classList.add('tm-loading');
  const d=document.createElement('div');d.id='tm-page-loader';d.innerHTML='<div class="tm-loader-box"><div class="tm-loader-logo">🎮</div><div class="tm-loader-title">TECNOMATH</div><div class="tm-loader-text">Cargando juegos y preparando la plataforma…</div><div class="tm-loader-track"><div class="tm-loader-bar"></div></div><div class="tm-loader-dots">•••</div></div>';document.body.appendChild(d);
}
function hideLoader(){if(loaderDone)return;loaderDone=true;const d=document.getElementById('tm-page-loader');if(d){d.classList.add('tm-loader-hide');setTimeout(()=>d.remove(),500)}document.documentElement.classList.remove('tm-loading')}
// La página principal se muestra de inmediato; las tareas secundarias cargan en segundo plano.
function loadAuth(){return new Promise((resolve,reject)=>{if(window.TecnomathAuth)return resolve();const old=document.querySelector('script[data-tecnomath-auth]');if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',()=>reject(new Error('No se pudo cargar la autenticación TecnoMath.')),{once:true});return}const s=document.createElement('script');s.src='js/tecnomath-auth.js?v=20260914';s.dataset.tecnomathAuth='true';s.onload=resolve;s.onerror=()=>reject(new Error('No se pudo cargar la autenticación TecnoMath.'));document.head.appendChild(s)});}
function loadAdminPortal(){return new Promise((resolve)=>{if(document.querySelector('script[data-tecnomath-admin-portal]'))return resolve();const s=document.createElement('script');s.src='js/tecnomath-admin-portal.js?v=20260914';s.dataset.tecnomathAdminPortal='true';s.onload=resolve;s.onerror=()=>resolve();document.head.appendChild(s)})}
function addMeta(property,content){let m=document.head.querySelector(`meta[property="${property}"]`);if(!m){m=document.createElement('meta');m.setAttribute('property',property);document.head.appendChild(m)}m.content=content}
addMeta('og:title','TecnoMath | Plataforma Educativa Interactiva');addMeta('og:description','Juegos educativos, retos matemáticos y experiencias interactivas en TecnoMath.');addMeta('og:image','https://tecnomath.online/img/mindmath.png');addMeta('og:type','website');
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){try{const u=typeof input==='string'?input:input&&input.url||'';if(/(?:^|\/)juegos\.json(?:\?|$)/i.test(u)){const replacement=new URL(CATALOG,location.href).href;return nativeFetch(replacement,init)}}catch(e){}return nativeFetch(input,init)};
async function loadCatalog(){try{const r=await nativeFetch(`${CATALOG}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();if(!Array.isArray(data))throw Error('games.json debe ser una lista');window.TecNoMathCatalog=data;console.log(`📚 Catálogo oficial: ${data.length} juegos`)}catch(e){console.warn('No se pudo cargar el catálogo oficial:',e.message)}}
function injectCardStyles(){if(document.getElementById('tm-card-number-styles'))return;const s=document.createElement('style');s.id='tm-card-number-styles';s.textContent=`#projectsContainer .project-card{position:relative;transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}#projectsContainer .project-card:hover{transform:translateY(-6px)}.tm-order-badge{position:absolute;top:10px;left:10px;z-index:30;padding:5px 8px;border-radius:999px;background:#060610dd;border:1px solid #00f5ff;color:#00f5ff;font:700 10px Arial,sans-serif;line-height:1;pointer-events:none}`;document.head.appendChild(s)}
function markCards(){const box=document.getElementById('projectsContainer');if(!box)return;const cards=[...box.querySelectorAll('.project-card')];cards.forEach((card,i)=>{let badge=card.querySelector('.tm-order-badge');if(!badge){badge=document.createElement('span');badge.className='tm-order-badge';card.appendChild(badge)}badge.textContent=`#${i+1}`})}
function waitForCards(timeout=7000){return new Promise(resolve=>{const started=Date.now();const check=()=>{const box=document.getElementById('projectsContainer');const cards=box?[...box.querySelectorAll('.project-card')]:[];if(cards.length||Date.now()-started>timeout){markCards();resolve()}else requestAnimationFrame(check)};check()})}
async function boot(){
  try{
    if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
    // El catálogo y la interfaz principal no esperan a autenticación ni al portal de administración.
    loadCatalog();
    loadAuth().then(()=>loadAdminPortal()).catch(error=>console.error('TecnoMath Auth:',error));
    waitForCards(2500).then(()=>{injectCardStyles();markCards()});
  }finally{hideLoader()}
}
boot();
window.TecnoMathCatalogReload=async()=>{await loadCatalog();markCards()};
})();
