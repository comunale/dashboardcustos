import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/comparativo.js';

const lanc = o => ({ cartao: '1111', pessoa: 'Ana', virtual: false, secao: 'despesas', data: '2026-09-01', parcelaAtual: null, parcelaTotal: null, valorUSD: 0, tipo: 'compra', ...o });
const parc = (descricao, data, atual, total, valor, extra = {}) => lanc({ descricao, data, parcelaAtual: atual, parcelaTotal: total, valor, secao: 'parcelamentos', ...extra });
const fat = (id, lancamentos, extra = {}) => ({ id, lancamentos, resumo: {}, cartoes: [], ...extra });

const set = fat('2026-09', [
  parc('LOJA A', '2026-07-10', 2, 3, 100),
  parc('LOJA B', '2026-06-05', 3, 3, 50),            // última parcela em setembro
  parc('LOJA C', '2026-08-20', 1, 10, 30),
  parc('COMPRA ANTIGA', '2025-10-15', 12, 13, 20),   // compra de 12+ meses atrás
  lanc({ descricao: 'ST MARCHE', valor: 300 }),
  lanc({ descricao: 'DL*UBERRIDES', valor: 40, pessoa: 'Bruno', cartao: '2222' }),
  lanc({ descricao: 'NETFLIX COM', valor: 39.9 }),
  lanc({ descricao: 'SPOTIFY', valor: 21.9 }),
  lanc({ descricao: 'MERCADOLIVRE*LOJA', valor: 80 }),
  lanc({ descricao: 'PAGAMENTO DE FATURA', valor: -1000, tipo: 'credito' }),
]);
const out = fat('2026-10', [
  parc('LOJA A', '2026-07-10', 3, 3, 100),
  parc('LOJA C', '2026-08-20', 2, 10, 30),
  parc('COMPRA ANTIGA', '2026-10-15', 13, 13, 20),   // na fatura de outubro o leitor pode datar como 2026: tem de casar mesmo assim
  parc('LOJA D', '2026-09-25', 1, 2, 250),
  lanc({ descricao: 'ST MARCHE', valor: 450 }),
  lanc({ descricao: 'BARBEARIA DO ZE', valor: 60 }),
  lanc({ descricao: 'NETFLIX COM', valor: 44.9 }),
  lanc({ descricao: 'DISNEY PLUS', valor: 33.9 }),
  lanc({ descricao: 'SHOPEE *X', valor: 120 }),
], { resumo: { obrigacoesFuturas: 999 } });

test('fatura anterior é a mais recente antes da escolhida', () => {
  assert.equal(C.faturaAnterior([out, set], '2026-10').id, '2026-09');
  assert.equal(C.faturaAnterior([out, set], '2026-09'), null);
});

test('parcelas: saíram e entraram, casando a mesma compra entre meses', () => {
  const r = C.compararParcelas(set, out, set.lancamentos, out.lancamentos);
  assert.deepEqual(r.sairam.lista.map(p => p.descricao), ['LOJA B']);
  assert.equal(r.sairam.porMes, 50);
  assert.deepEqual(r.entraram.lista.map(p => p.descricao), ['LOJA D']);
  assert.equal(r.entraram.porMes, 250);
  assert.equal(r.variacaoPorMes, 200, 'a bola de neve cresceu R$ 200/mês');
});

test('evolução do total comprometido mês a mês', () => {
  const ev = C.evolucaoParcelas([out, set], ls => ls, false);
  assert.deepEqual(ev.map(e => [e.id, e.comprometido, e.parcelado]), [
    ['2026-09', 100 + 30 * 9 + 20, 200],
    ['2026-10', 30 * 8 + 250, 400],
  ]);
  assert.equal(C.evolucaoParcelas([out, set], ls => ls, true).at(-1).comprometido, 999, 'com "Todos" usa o valor do banco');
});

test('comparar grupos: diferença em R$ e %, maiores altas primeiro', () => {
  const r = C.compararGrupos([{ nome: 'Mercado', total: 300 }, { nome: 'Transporte', total: 40 }], [{ nome: 'Mercado', total: 450 }, { nome: 'Lazer', total: 60 }]);
  assert.deepEqual(r, [
    { nome: 'Mercado', anterior: 300, atual: 450, diferenca: 150, pct: 0.5 },
    { nome: 'Lazer', anterior: 0, atual: 60, diferenca: 60, pct: null },
    { nome: 'Transporte', anterior: 40, atual: 0, diferenca: -40, pct: -1 },
  ]);
});

test('categorias e pessoas entre os meses', () => {
  const cat = C.compararCategorias(set.lancamentos, out.lancamentos);
  assert.deepEqual(cat.find(c => c.nome === 'Mercado'), { nome: 'Mercado', anterior: 300, atual: 450, diferenca: 150, pct: 0.5 });
  const pes = C.compararPessoas(set.lancamentos, out.lancamentos);
  assert.deepEqual(pes.find(p => p.nome === 'Bruno'), { nome: 'Bruno', anterior: 40, atual: 0, diferenca: -40, pct: -1 });
});

test('lugares novos e que sumiram (só à vista, sem assinaturas e marketplaces)', () => {
  const r = C.compararLugares(set.lancamentos, out.lancamentos);
  assert.deepEqual(r.novos.map(l => [l.nome, l.total]), [['BARBEARIA DO ZE', 60]]);
  assert.deepEqual(r.sumiram.map(l => [l.nome, l.total]), [['DL*UBERRIDES', 40]]);
});

test('assinaturas novas, canceladas e com preço diferente', () => {
  const r = C.compararAssinaturas(set.lancamentos, out.lancamentos);
  assert.deepEqual(r.novas.map(a => a.nome), ['Disney+']);
  assert.deepEqual(r.canceladas.map(a => a.nome), ['Spotify']);
  assert.deepEqual(r.mudaram, [{ nome: 'Netflix', anterior: 39.9, atual: 44.9, diferenca: 5 }]);
});

test('marketplaces entre os meses', () => {
  assert.deepEqual(C.compararMarketplaces(set.lancamentos, out.lancamentos).map(m => [m.nome, m.anterior, m.atual]), [
    ['Shopee', 0, 120], ['Mercado Livre', 80, 0],
  ]);
});
