/* TecnoMath Global i18n — lazy, non-destructive, RTL-aware */
(function () {
  'use strict';
  if (window.TecnoMathI18n) return;

  const STORAGE_KEY = 'tecnomath_language';
  const ROOT = new URL('..', document.currentScript?.src || `${location.origin}/js/i18n.js`).href;
  const LOCALE_ROOT = new URL('locales/', ROOT).href;
  const REGISTRY_URL = new URL('index.json', LOCALE_ROOT).href;
  const cache = new Map();
  let registry = null;
  let active = null;
  let fallback = 'es';
  let observer = null;

  function flatten(obj, prefix = '', out = {}) {
    if (!obj || typeof obj !== 'object') return out;
    Object.entries(obj).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
      else out[path] = value;
    });
    return out;
  }

  function interpolate(value, vars) {
    if (typeof value !== 'string') return value;
    return value.replace(/\{([\w.-]+)\}/g, (_, key) => {
      const v = vars && Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{${key}}`;
      return String(v);
    });
  }

  function normalize(code) {
    return String(code || '').trim().replace('_', '-').toLowerCase();
  }

  function findLanguage(code) {
    const requested = normalize(code);
    if (!registry?.languages?.length) return null;
    return registry.languages.find(l => l.code === requested)
      || registry.languages.find(l => normalize(l.code) === requested.split('-')[0])
      || registry.languages.find(l => l.code === registry.default)
      || registry.languages[0];
  }

  async function loadLocale(code) {
    const lang = findLanguage(code);
    const resolved = lang?.code || fallback;
    if (cache.has(resolved)) return cache.get(resolved);
    const promise = fetch(new URL(`${resolved}/common.json`, LOCALE_ROOT), { cache: 'force-cache' })
      .then(r => {
        if (!r.ok) throw new Error(`Locale ${resolved}: HTTP ${r.status}`);
        return r.json();
      })
      .then(flatten);
    cache.set(resolved, promise);
    try { return await promise; }
    catch (error) {
      cache.delete(resolved);
      if (resolved !== fallback) return loadLocale(fallback);
      console.warn('[TecnoMath i18n] Locale unavailable:', resolved, error);
      return {};
    }
  }

  function getValue(key, vars) {
    const value = active?.messages?.[key] ?? active?.fallbackMessages?.[key] ?? key;
    return interpolate(value, vars);
  }

  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = getValue(key);
    const htmlKey = el.getAttribute('data-i18n-html');
    if (htmlKey) el.innerHTML = getValue(htmlKey);
    const placeholder = el.getAttribute('data-i18n-placeholder');
    if (placeholder) el.setAttribute('placeholder', getValue(placeholder));
    const title = el.getAttribute('data-i18n-title');
    if (title) el.setAttribute('title', getValue(title));
    const aria = el.getAttribute('data-i18n-aria-label');
    if (aria) el.setAttribute('aria-label', getValue(aria));
  }

  function translatePage() {
    document.documentElement.lang = active?.language?.code || fallback;
    document.documentElement.dir = active?.language?.direction || 'ltr';
    document.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]')
      .forEach(translateElement);
    document.dispatchEvent(new CustomEvent('tecnomath:languagechange', { detail: { code: active?.language?.code, direction: document.documentElement.dir } }));
  }

  function detectInitialLanguage() {
    const stored = normalize(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
    const browser = normalize(navigator.languages?.[0] || navigator.language || '');
    return browser || fallback;
  }

  function saveLanguage(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch (_) {}
  }

  function ensureStyles() {
    if (document.getElementById('tecnomath-i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'tecnomath-i18n-styles';
    style.textContent = `
      .tecnomath-language-selector{position:relative;display:inline-flex;align-items:center;z-index:10001;font-family:inherit}
      .tecnomath-language-button{border:1px solid currentColor;background:transparent;color:inherit;border-radius:7px;padding:7px 9px;cursor:pointer;font:inherit;line-height:1.2}
      .tecnomath-language-menu{position:absolute;right:0;top:calc(100% + 7px);width:min(290px,85vw);max-height:min(60vh,420px);overflow:auto;padding:6px;margin:0;list-style:none;background:#0d0d1a;border:1px solid #00ffff;border-radius:10px;box-shadow:0 0 20px rgba(0,255,255,.22)}
      .tecnomath-language-menu[hidden]{display:none}
      .tecnomath-language-option{display:block;width:100%;text-align:start;background:transparent;border:0;color:#fff;padding:8px;border-radius:6px;cursor:pointer;font:inherit;font-size:12px}
      .tecnomath-language-option:hover,.tecnomath-language-option:focus-visible{background:rgba(0,255,255,.12);outline:none}
      [dir="rtl"] .tecnomath-language-menu{right:auto;left:0}
    `;
    document.head.appendChild(style);
  }

  function mountSelector() {
    if (document.getElementById('tecnomathLanguageSelector')) return;
    ensureStyles();
    const host = document.querySelector('[data-tecnomath-language-selector]') || document.querySelector('.user-area') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'tecnomathLanguageSelector';
    wrap.className = 'tecnomath-language-selector';
    wrap.innerHTML = '<button type="button" class="tecnomath-language-button" aria-haspopup="listbox" aria-expanded="false">🌐 <span></span></button><ul class="tecnomath-language-menu" role="listbox" hidden></ul>';
    const button = wrap.querySelector('button');
    const label = wrap.querySelector('span');
    const menu = wrap.querySelector('ul');
    registry.languages.forEach(lang => {
      const li = document.createElement('li');
      const option = document.createElement('button');
      option.type = 'button'; option.className = 'tecnomath-language-option'; option.role = 'option';
      option.dataset.lang = lang.code;
      option.textContent = `${lang.nativeName} — ${lang.name}`;
      option.addEventListener('click', () => { setLanguage(lang.code); menu.hidden = true; button.setAttribute('aria-expanded', 'false'); });
      li.appendChild(option); menu.appendChild(li);
    });
    button.addEventListener('click', () => { menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); } });
    host.appendChild(wrap);
    window.requestAnimationFrame(() => updateSelectorLabel(label));
  }

  function updateSelectorLabel(label) {
    const lang = active?.language;
    if (label && lang) label.textContent = `${lang.nativeName}`;
  }

  async function setLanguage(code) {
    const lang = findLanguage(code);
    if (!lang) return false;
    const messages = await loadLocale(lang.code);
    let fallbackMessages = {};
    if (lang.code !== fallback) fallbackMessages = await loadLocale(fallback);
    active = { language: lang, messages, fallbackMessages };
    saveLanguage(lang.code);
    translatePage();
    const label = document.querySelector('#tecnomathLanguageSelector .tecnomath-language-button span');
    updateSelectorLabel(label);
    return true;
  }

  async function init() {
    try {
      registry = await fetch(REGISTRY_URL, { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error(`Registry HTTP ${r.status}`); return r.json(); });
      fallback = registry.fallback || 'es';
      const initial = detectInitialLanguage();
      await setLanguage(initial);
      mountSelector();
      if (observer) observer.disconnect();
      observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          translateElement(node);
          node.querySelectorAll?.('[data-i18n],[data-i18n-html],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label]').forEach(translateElement);
        }
      })));
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (error) {
      console.error('[TecnoMath i18n] Initialization failed:', error);
    }
  }

  window.TecnoMathI18n = Object.freeze({
    init, setLanguage, getLanguage: () => active?.language?.code || fallback,
    getDirection: () => active?.language?.direction || 'ltr',
    t: getValue,
    translatePage,
    getLanguages: () => registry?.languages ? [...registry.languages] : []
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
