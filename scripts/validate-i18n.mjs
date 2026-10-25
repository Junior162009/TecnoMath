#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const root=new URL('..',import.meta.url).pathname,localeRoot=join(root,'locales'),errors=[],warnings=[];
function flatten(v,p='',o={}){if(!v||typeof v!=='object')return o;for(const[k,x]of Object.entries(v)){const q=p?`${p}.${k}`:k;if(x&&typeof x==='object'&&!Array.isArray(x))flatten(x,q,o);else o[q]=x}return o}
async function json(path,{optional=false}={}){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(optional&&e.code==='ENOENT')return undefined;errors.push(`Invalid JSON: ${path} — ${e.message}`);return null}}
const registry=await json(join(localeRoot,'index.json'));if(!registry)process.exit(1);const languages=Array.isArray(registry.languages)?registry.languages:[],codes=languages.map(x=>x.code);
if(languages.length<100)errors.push(`Language registry contains ${languages.length}; expected at least 100.`);if(new Set(codes).size!==codes.length)errors.push('Duplicate language codes detected.');if(!codes.includes(registry.default))errors.push(`Default language ${registry.default} is not registered.`);if(!codes.includes(registry.fallback))errors.push(`Fallback language ${registry.fallback} is not registered.`);
const base=await json(join(localeRoot,`${registry.fallback}/common.json`)),baseFlat=flatten(base||{});let localeFiles=0;
for(const lang of languages){const localePath=join(localeRoot,lang.code,'common.json');const data=await json(localePath,{optional:true});if(data===undefined){warnings.push(`${lang.code}: locale file not created yet; fallback ${registry.fallback} will be used.`);continue}if(!data)continue;localeFiles++;const flat=flatten(data),missing=Object.keys(baseFlat).filter(k=>!(k in flat)),empty=Object.entries(flat).filter(([,v])=>typeof v==='string'&&!v.trim());if(missing.length)warnings.push(`${lang.code}: ${missing.length} missing keys; fallback will be used.`);if(empty.length)errors.push(`${lang.code}: ${empty.length} empty translations.`)}

// Inspect real HTML/JS consumers as well as locale JSON. Missing keys are warnings,
// because some game screens intentionally keep their original language until migrated.
const sourceRoot=root;
let sourceFiles=0,translationKeys=0;
async function walk(dir){
  let entries;
  try{entries=await readdir(dir,{withFileTypes:true})}catch(_){return}
  for(const entry of entries){
    if(entry.name.startsWith('.')&&entry.name!=='.github')continue;
    if(['node_modules','vendor','dist','build'].includes(entry.name))continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory()){await walk(path);continue}
    if(!/\.(?:html|js|mjs|ts)$/.test(entry.name)||path.includes('/locales/'))continue;
    let source;
    try{source=await readFile(path,'utf8')}catch(_){continue}
    sourceFiles++;
    for(const match of source.matchAll(/data-i18n(?:-placeholder|-title|-aria-label|-html)?\s*=\s*["']([^"']+)["']/g)){
      const key=match[1].trim();
      if(!key)continue;
      translationKeys++;
      if(!(key in baseFlat))warnings.push(`Source key missing from fallback ${registry.fallback}: ${key} (${path.slice(root.length+1)})`);
    }
  }
}
await walk(sourceRoot);
console.log(`TecnoMath i18n validation: ${errors.length?'FAIL':'PASS'}`);console.log(`Languages configured: ${languages.length}`);console.log(`Locale files present: ${localeFiles}`);console.log(`Source files scanned: ${sourceFiles}`);console.log(`HTML translation attributes scanned: ${translationKeys}`);console.log(`Default: ${registry.default}`);console.log(`Fallback: ${registry.fallback}`);console.log(`RTL: ${languages.filter(x=>x.direction==='rtl').map(x=>x.code).join(', ')}`);console.log(`Warnings: ${warnings.length}`);console.log(`Errors: ${errors.length}`);warnings.forEach(x=>console.log(`⚠ ${x}`));errors.forEach(x=>console.error(`✗ ${x}`));if(errors.length)process.exit(1);
