import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const load = f => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const loadI = f => JSON.parse(fs.readFileSync(new URL(`../i18n/${f}`, import.meta.url), 'utf8'));

test('DONKI archive: real events with date, link and retrieval date', () => {
  const d = load('donki_events.json');
  assert.match(d.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(d.events.length >= 20);
  for (const e of d.events) {
    assert.ok(['FLR', 'CME', 'SEP'].includes(e.type));
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(e.link, /^https:\/\/(kauai\.)?ccmc\.gsfc\.nasa\.gov\/DONKI\//);
    if (e.type === 'FLR') assert.match(e.classType, /^[CMX]\d/);
    if (e.type === 'CME') assert.ok(e.speed > 0);
  }
});
test('OSDR facts: 8–12, each with study ID, fetched title, URL and kid text in both languages', () => {
  const o = load('osdr_facts.json');
  assert.ok(o.facts.length >= 8 && o.facts.length <= 12);
  for (const f of o.facts) {
    assert.match(f.id, /^OSD-\d+$/);
    assert.ok(f.title && f.title.length > 10);
    assert.match(f.url, /^https:\/\/osdr\.nasa\.gov\//);
    assert.ok(f.en && f.pt && f.topic);
  }
});
test('site facts and CSA facts all cite a URL', () => {
  const s = load('sites.json');
  for (const site of ['moon', 'mars']) { assert.ok(s[site].facts.length >= 3); for (const f of s[site].facts) assert.match(f.url, /^https:\/\//); }
  for (const f of load('csa_food.json').facts) assert.match(f.url, /^https:\/\/www\.asc-csa\.gc\.ca\//);
});
test('i18n: Portuguese has every English key', () => {
  const en = loadI('en.json'), pt = loadI('pt.json');
  const missing = Object.keys(en).filter(k => !(k in pt));
  assert.deepEqual(missing, []);
});
