// Tiny i18n: strings live in /i18n/<lang>.json. t('key', {n: 3}) replaces {n}.
let dict = {}, fallback = {}, lang = 'en';
export const LANGS = ['en', 'pt'];

export async function initI18n(preferred) {
  const nav = (navigator.language || 'en').toLowerCase();
  lang = LANGS.includes(preferred) ? preferred : nav.startsWith('pt') ? 'pt' : 'en';
  fallback = await (await fetch('i18n/en.json')).json();
  dict = lang === 'en' ? fallback : await (await fetch(`i18n/${lang}.json`)).json();
  document.documentElement.lang = lang === 'pt' ? 'pt' : 'en';
  return lang;
}
export async function setLang(l) { return initI18n(l); }
export const getLang = () => lang;

export function t(key, params) {
  let s = dict[key] ?? fallback[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? m));
  return s;
}
/** Pick the current language from a {en, pt} object coming from /data. */
export function L(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] ?? obj.en ?? '';
}
export function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
  catch { return String(iso).slice(0, 10); }
}
