// Read-aloud using the free, built-in browser SpeechSynthesis API (works offline on most devices).
import { getLang } from './i18n.js';
export const speechSupported = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
export function speak(text) {
  if (!speechSupported() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    const want = getLang() === 'pt' ? 'pt' : 'en';
    u.lang = want === 'pt' ? 'pt-BR' : 'en-US';
    const v = window.speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(want));
    if (v) u.voice = v;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
export function stopSpeaking() { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
