#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
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
if (!Array.isArray(registry.languages) || registry.languages.length < 100) {
  errors.push(`Language registry contains ${registry.languages?.length ?? 0}; expected at least 100.`);
}

const codes = registry.languages?.map(x => x.code) || [];
if (new Set(codes).size !== codes.length) errors.push('Duplicate language codes detected.');
if (!codes.includes(registry.default)) errors.push(`Default language ${registry.default} is not registered.`);
if (!codes.includes(registry.fallback)) errors.push(`Fallback language ${registry.fallback} is not registered.`);

const base = await json(join(localeRoot, `${registry.fallback}/common.json`));
const baseFlat = flatten(base || {});

let realLocaleCount = 0;
for (const lang of registry.languages || []) {
  const path = join(localeRoot, lang.code, 'common.json');
  try {
    const data = await json(path);
    if (!data) continue;
    realLocaleCount++;
    const flat = flatten(data);
    const missing = Object.keys(baseFlat).filter(key => !(key in flat));
    const empty = Object.entries(flat).filter(([key, value]) => typeof value === 'string' && !value.trim());
    const extra = Object.keys(flat).filter(key => !(key in baseFlat));
    if (missing.length) warnings.push(`${lang.code}: ${missing.length} missing keys (fallback will be used).`);
    if (empty.length) errors.push(`${lang.code}: ${empty.length} empty translations.`);
    if (extra.length) warnings.push(`${lang.code}: ${extra.length} extra keys.`);
  } catch (_) {
    // A registered language without a locale file is intentional: runtime falls back safely.
  }
}

console.log('TecnoMath i18n validation');
console.log('=========================');
console.log(`Languages configured: ${codes.length}`);
console.log(`Locale files present: ${realLocaleCount}`);
console.log(`Default: ${registry.default}`);
console.log(`Fallback: ${registry.fallback}`);
console.log(`RTL languages: ${(registry.languages || []).filter(x => x.direction === 'rtl').map(x => x.code).join(', ') || 'none'}`);
console.log(`Missing/partial locale warnings: ${warnings.length}`);
console.log(`Errors: ${errors.length}`);

for (const warning of warnings) console.log(`⚠ ${warning}`);
for (const error of errors) console.error(`✗ ${error}`);

if (errors.length) {
  console.error('Validation: FAIL');
  process.exit(1);
}
console.log('Validation: PASS');
