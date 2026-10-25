#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const localeRoot = join(root, 'locales');
const errors = [];
const warnings = [];

function flatten(value, prefix = '', out = {}) {
  if (!value || typeof value !== 'object') return out;
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) flatten(item, path, out);
    else out[path] = item;
  }
  return out;
}

async function json(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { errors.push(`Invalid JSON: ${path} — ${error.message}`); return null; }
}

const registry = await json(join(localeRoot, 'index.json'));
if (!registry) process.exit(1);
const languages = Array.isArray(registry.languages) ? registry.languages : [];
if (languages.length < 100) errors.push(`Language registry contains ${languages.length}; expected at least 100.`);
const codes = languages.map(x => x.code);
if (new Set(codes).size !== codes.length) errors.push('Duplicate language codes detected.');
if (!codes.includes(registry.default)) errors.push(`Default language ${registry.default} is not registered.`);
if (!codes.includes(registry.fallback)) errors.push(`Fallback language ${registry.fallback} is not registered.`);

const base = await json(join(localeRoot, `${registry.fallback}/common.json`));
const baseFlat = flatten(base || {});
let localeFiles = 0;
for (const lang of languages) {
  try {
    const data = await json(join(localeRoot, lang.code, 'common.json'));
    if (!data) continue;
    localeFiles++;
    const flat = flatten(data);
    const missing = Object.keys(baseFlat).filter(key => !(key in flat));
    const empty = Object.entries(flat).filter(([, value]) => typeof value === 'string' && !value.trim());
    const extra = Object.keys(flat).filter(key => !(key in baseFlat));
    if (missing.length) warnings.push(`${lang.code}: ${missing.length} missing keys; fallback will be used.`);
    if (empty.length) errors.push(`${lang.code}: ${empty.length} empty translations.`);
    if (extra.length) warnings.push(`${lang.code}: ${extra.length} extra keys.`);
  } catch (_) {}
}

console.log(`TecnoMath i18n validation: ${errors.length ? 'FAIL' : 'PASS'}`);
console.log(`Languages configured: ${languages.length}`);
console.log(`Locale files present: ${localeFiles}`);
console.log(`Default: ${registry.default}`);
console.log(`Fallback: ${registry.fallback}`);
console.log(`RTL: ${languages.filter(x => x.direction === 'rtl').map(x => x.code).join(', ')}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Errors: ${errors.length}`);
warnings.forEach(x => console.log(`⚠ ${x}`));
errors.forEach(x => console.error(`✗ ${x}`));
if (errors.length) process.exit(1);
