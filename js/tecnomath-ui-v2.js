/* TecnoMath UI V2 — presentación + navegación moderna */
(function(){'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentSearchTerm='';
function setup(){
 const header=$('header'),hero=$('.hero');
 if(header){header.classList.add('tm-ui-header');const content=$('.header-content',header)||header;compactHeaderLinks(header);if(!$('.tm-ui-nav',header)){const nav=document.createElement('nav');nav.className='tm-ui-nav';nav.setAttribute('aria-label','Navegación principal');nav.innerHTML='<a class="active" href="#tm-ui-hero">Inicio</a><a href="#projectsContainer">Juegos</a><a href="#sponsorsArea">Patrocinadores</a><a href="#tm-ui-stats">Estadísticas</a>';content.appendChild(nav)}if(!$('.tm-ui-controls',header)){const controls=document.createElement('div');controls.className='tm-ui-controls';controls.innerHTML='<button class="tm-ui-theme" id="tmUiTheme" type="button" aria-label="Cambiar modo de color" aria-pressed="false"><img class="tm-icon" src="https://api.iconify.design/lucide/moon.svg" alt="" onerror="this.onerror=null;this.src=&#39;/assets/icons/fallback.svg&#39;"></button><button class="tm-ui-menu" id="tmUiMenu" type="button" aria-label="Abrir menú" aria-expanded="false"><img class="tm-icon" src="https://api.iconify.design/lucide/menu.svg" alt="" onerror="this.onerror=null;this.src='/assets/icons/fallback.svg'"></button>';content.appendChild(controls)}const onScroll=()=>header.classList.toggle('tm-scrolled',window.scrollY>30);window.addEventListener('scroll',onScroll,{passive:true});onScroll()}
 if(hero){hero.id='tm-ui-hero';hero.classList.add('tm-ui-hero');if(!$('.tm-ui-badge',hero)){const badge=document.createElement('div');badge.className='tm-ui-badge';badge.innerHTML='<span class="tm-ui-dot"></span> PLATAFORMA EDUCATIVA GAMING';hero.insertBefore(badge,hero.firstChild)}if(!$('.tm-ui-hero-actions',hero)){const actions=document.createElement('div');actions.className='tm-ui-hero-actions';actions.innerHTML='<a class="tm-ui-btn tm-ui-primary" href="#projectsContainer"><img class="tm-icon" src="https://api.iconify.design/lucide/gamepad-2.svg" alt="" onerror="this.onerror=null;this.src=\'/assets/icons/fallback.svg\'"> EXPLORAR JUEGOS</a><a class="tm-ui-btn tm-ui-secondary" href="#sponsorsArea"><img class="tm-icon" src="https://api.iconify.design/lucide/handshake.svg" alt="" onerror="this.onerror=null;this.src=\'/assets/icons/fallback.svg\'"> PATROCINADORES</a>';hero.appendChild(actions)}if(!$('.tm-ui-search',hero)){const wrap=document.createElement('div');wrap.className='tm-ui-search';wrap.innerHTML='<img class="tm-icon" src="https://api.iconify.design/lucide/search.svg" alt="" aria-hidden="true" onerror="this.onerror=null;this.src=\'/assets/icons/fallback.svg\'"><input id="tmUiSearch" type="search" autocomplete="off" placeholder="Buscar un juego..." aria-label="Buscar un juego">';hero.appendChild(wrap);$('#tmUiSearch').addEventListener('input',()=>filtrarJuegos($('#tmUiSearch').value))}}
 const menu=$('#tmUiMenu'),nav=$('.tm-ui-nav');if(menu&&nav&&!menu.dataset.bound){menu.dataset.bound='1';menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');menu.textContent=open?'×':'☰'});$$('.tm-ui-nav a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')))}
 const theme=$('#tmUiTheme');if(theme&&!theme.dataset.bound){theme.dataset.bound='1';const saved=localStorage.getItem('tm-ui-theme');if(saved==='light')applyLight(theme,true);theme.addEventListener('click',()=>applyLight(theme,!document.body.classList.contains('tm-light')))}
 if(!$('#tm-ui-top')){const b=document.createElement('button');b.id='tm-ui-top';b.type='button';b.textContent='↑';b.setAttribute('aria-label','Volver arriba');document.body.appendChild(b);b.addEventListener('click',()=>window.scrollTo({top:0,behavior:reduced()?'auto':'smooth'}));window.addEventListener('scroll',()=>b.classList.toggle('visible',window.scrollY>500),{passive:true})}
 if(!$('#tm-ui-stats')){const stats=document.createElement('section');stats.id='tm-ui-stats';stats.className='tm-ui-stats';stats.setAttribute('aria-label','Estadísticas del portal');stats.innerHTML='<h3>TECNO<span>MATH</span> EN NÚMEROS</h3><div class="tm-ui-stat-grid"><div class="tm-ui-stat"><strong data-stat="games">0</strong><span>JUEGOS</span></div><div class="tm-ui-stat"><strong data-stat="categories">0</strong><span>CATEGORÍAS</span></div><div class="tm-ui-stat"><strong data-stat="sponsors">0</strong><span>PATROCINADORES</span></div></div>';const footer=$('footer'),projects=$('#projectsContainer');if(projects&&projects.parentNode)projects.parentNode.insertBefore(stats,projects);else if(footer)footer.parentNode.insertBefore(stats,footer)}
 actualizarEstadisticas();const observer=new MutationObserver(()=>{actualizarEstadisticas();filtrarJuegos(currentSearchTerm)});const projects=$('#projectsContainer'),sponsors=$('#sponsorsArea');if(projects)observer.observe(projects,{childList:true});if(sponsors)observer.observe(sponsors,{childList:true});
 loadAdminPortal();
}
function compactHeaderLinks(header){
 const area=$('.user-area',header);
 if(!area||$('.tm-ui-more',area))return;
 const links=Array.from(area.querySelectorAll('a.voting-home-btn'));
 if(!links.length)return;
 const details=document.createElement('details');
 details.className='tm-ui-more';
 const summary=document.createElement('summary');
 summary.textContent='Más';
 summary.setAttribute('aria-label','Más opciones: votaciones, ranking y Edugo');
 const panel=document.createElement('div');
 panel.className='tm-ui-more-panel';
 links.forEach(link=>{link.classList.add('tm-ui-more-link');panel.appendChild(link)});
 details.append(summary,panel);
 const auth=$('#authLink',area);
 if(auth)area.insertBefore(details,auth);else area.appendChild(details);
 document.addEventListener('click',event=>{if(!details.contains(event.target))details.open=false});
 details.addEventListener('keydown',event=>{if(event.key==='Escape'){details.open=false;summary.focus()}});
}
function applyLight(button,on){document.body.classList.toggle('tm-light',on);localStorage.setItem('tm-ui-theme',on?'light':'dark');button.innerHTML='<img class="tm-icon" src="https://api.iconify.design/lucide/'+(on?'sun':'moon')+'.svg" alt="" aria-hidden="true" onerror="this.onerror=null;this.src=\'/assets/icons/fallback.svg\'">';button.setAttribute('aria-pressed',String(on))}
function filtrarJuegos(term){currentSearchTerm=String(term||'').trim().toLowerCase();$('#projectsContainer .project-card').forEach(card=>{card.style.display=!currentSearchTerm||(card.textContent||'').toLowerCase().includes(currentSearchTerm)?'':'none'})}
function actualizarEstadisticas(){const projects=$$('#projectsContainer .project-card'),sponsors=$$('#sponsorsArea .sponsor-card'),categories=new Set();projects.forEach(card=>{const category=card.dataset.category;if(category)categories.add(category)});const values={games:projects.length,categories:categories.size,sponsors:sponsors.length};Object.entries(values).forEach(([key,target])=>{const el=$(`[data-stat="${key}"]`);if(el&&el.dataset.value!==String(target)){el.dataset.value=String(target);el.textContent=String(target)}})}
function loadAdminPortal(){
 if(window.__TECNO_MATH_ADMIN_PORTAL__)return;
 window.__TECNO_MATH_ADMIN_PORTAL__=true;
 const src='js/tecnomath-admin-portal.js?v=20260920';
 if(document.querySelector('script[data-tecnomath-admin-portal]'))return;
 const s=document.createElement('script');s.src=src;s.defer=false;s.dataset.tecnomathAdminPortal='true';s.onerror=()=>{console.warn('No se pudo cargar el controlador admin moderno.')};document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
