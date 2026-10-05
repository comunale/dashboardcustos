import test from 'node:test';
import assert from 'node:assert/strict';
import { moeda, moedaCurta, mesCurto, mesLongo, dataCurta, pct } from '../js/format.js';

test('formatos brasileiros', () => {
  assert.equal(moeda(1234.5).replace(/\s/g, ' '), 'R$ 1.234,50');
  assert.equal(moeda(-10).replace(/\s/g, ' '), '-R$ 10,00');
  assert.equal(moedaCurta(33273.88), 'R$ 33,3 mil');
  assert.equal(moedaCurta(850), 'R$ 850');
  assert.equal(mesCurto('2026-10'), 'out/26');
  assert.equal(mesLongo('2026-01'), 'janeiro de 2026');
  assert.equal(dataCurta('2026-08-21'), '21/08');
  assert.equal(pct(0.9757), '98%');
});
