import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/analysis.js';
import { lerFaturaSantander } from '../js/parsers/santander.js';
import { itensSinteticos } from './helpers/fatura-sintetica.mjs';
import { itensDaFaturaReal } from './helpers/pdf-real.mjs';

const fatura = () => lerFaturaSantander(itensSinteticos());
const lanc = (o) => ({ cartao: '1111', pessoa: 'Ana', virtual: false, secao: 'despesas', data: '2026-09-01', parcelaAtual: null, parcelaTotal: null, valorUSD: 0, tipo: 'compra', ...o });

test('addMeses atravessa o ano', () => {
  assert.equal(A.addMeses('2026-09', 4), '2027-01');
  assert.equal(A.addMeses('2026-09', 0), '2026-09');
  assert.equal(A.addMeses('2026-01', -1), '2025-12');
});

test('parceladas: faltam, saldo restante e término', () => {
  const f = fatura();
  const ps = A.parceladas(f, f.lancamentos);
  assert.equal(ps.length, 3);
  const moveis = ps.find(p => p.descricao === 'LOJA DE MOVEIS');
  assert.equal(moveis.restantes, 1);
  assert.equal(moveis.saldoRestante, 100);
  assert.equal(moveis.valorCompra, 1000);
  assert.equal(moveis.terminaEm, '2026-10');
  assert.equal(ps.find(p => p.descricao === 'CURSO ONLINE').restantes, 0);
  assert.equal(A.somar(ps, p => p.saldoRestante), 177.64, 'bate com obrigações futuras da fatura sintética');
});

test('bola de neve: soma por mês futuro', () => {
  const f = fatura();
  const b = A.bolaDeNeve(f, f.lancamentos, 3);
  assert.deepEqual(b, [
    { mes: '2026-10', valor: 177.64 },
    { mes: '2026-11', valor: 0 },
    { mes: '2026-12', valor: 0 },
  ]);
});

test('repetitivas: 3+ compras à vista no mesmo lugar', () => {
  const f = fatura();
  const r = A.repetitivas(f.lancamentos);
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, 'DL*UBERRIDES');
  assert.equal(r[0].qtd, 3);
  assert.equal(r[0].total, 75);
});

test('valores altos: parcelada conta pelo valor total da compra', () => {
  const f = fatura();
  const altos = A.valoresAltos(f.lancamentos, 300);
  assert.deepEqual(altos.map(a => [a.descricao, a.valorCompra]), [['SHOPEE *LOJA', 1200], ['LOJA DE MOVEIS', 1000], ['CURSO ONLINE', 500]]);
});

test('marketplaces: por plataforma, à vista x parcelado, por pessoa', () => {
  const f = fatura();
  const m = A.marketplaces(f.lancamentos);
  assert.deepEqual(m.map(x => [x.nome, x.qtd, x.total]), [['Shopee', 1, 1200], ['Mercado Livre', 1, 80]]);
  assert.deepEqual(m[0].porPessoa, { Bruno: 1200 });
  assert.equal(m[1].avista, 80);
  assert.equal(m[1].parcelado, 0);
});

test('assinaturas e filtros', () => {
  const f = fatura();
  assert.deepEqual(A.assinaturas(f.lancamentos).map(a => [a.nome, a.total]), [['Apple', 99.9]]);
  assert.equal(A.filtrar(f.lancamentos, { pessoa: 'Bruno' }).length, 3);
  assert.equal(A.filtrar(f.lancamentos, { cartao: '1111' }).length, 8);
  assert.equal(A.filtrar(f.lancamentos, {}).length, 11);
});

test('habituais precisa de 2+ faturas', () => {
  const f9 = fatura();
  assert.equal(A.habituais([f9], f9.id).disponivel, false);
  const f8 = { ...f9, id: '2026-08', lancamentos: [lanc({ descricao: 'DL*UBERRIDES', valor: 40 }), lanc({ descricao: 'ST MARCHE', valor: 200 })] };
  const h = A.habituais([f8, f9], '2026-09');
  assert.equal(h.disponivel, true);
  assert.deepEqual(h.itens.map(i => [i.nome, i.meses, i.mediaMensal]), [['DL*UBERRIDES', 2, 57.5]]);
});

test('resumo da fatura', () => {
  const f = fatura();
  const r = A.resumoFatura(f, f.lancamentos);
  assert.equal(r.compras, 1682.54);
  assert.equal(r.comprometidoFuturo, 177.64);
  assert.equal(r.proximaFatura, 177.64);
  assert.equal(r.usoLimite, 0.2);
  assert.deepEqual(A.porCartao(f, f.lancamentos).map(c => [c.final, c.total]), [['2222', 1377.54], ['1111', 305]]);
  assert.equal(A.porCategoria(f.lancamentos)[0].nome, 'Marketplaces');
});

test('listas vazias não quebram nada', () => {
  const f = fatura();
  const vazio = [];
  assert.deepEqual(A.parceladas(f, vazio), []);
  assert.deepEqual(A.bolaDeNeve(f, vazio, 2), [{ mes: '2026-10', valor: 0 }, { mes: '2026-11', valor: 0 }]);
  assert.deepEqual(A.repetitivas(vazio), []);
  assert.deepEqual(A.marketplaces(vazio), []);
  assert.deepEqual(A.valoresAltos(vazio), []);
  assert.equal(A.resumoFatura(f, vazio).compras, 0);
});

test('fatura real: parcelas futuras x valor informado pelo banco', async t => {
  const itens = await itensDaFaturaReal();
  if (!itens) return t.skip('sem faturas/*.pdf ou FATURA_SENHA');
  const f = lerFaturaSantander(itens);
  const calculado = A.resumoFatura(f, f.lancamentos).comprometidoFuturo;
  t.diagnostic(`calculado ${calculado} x banco ${f.resumo.obrigacoesFuturas}`);
  assert.ok(Math.abs(calculado - f.resumo.obrigacoesFuturas) / f.resumo.obrigacoesFuturas < 0.05, 'diferença acima de 5%');
});

test('filtros das parceladas: situação, faixa de valor e busca', () => {
  const f = fatura();
  const ps = A.parceladas(f, f.lancamentos);
  const nomes = l => l.map(p => p.descricao).sort();
  assert.deepEqual(nomes(A.filtrarParceladas(ps, { situacao: 'acabando' })), ['CURSO ONLINE', 'LOJA DE MOVEIS', 'PIX FULANO DE TAL']);
  assert.deepEqual(nomes(A.filtrarParceladas(ps, { situacao: 'recentes' })), ['PIX FULANO DE TAL']);
  assert.deepEqual(A.filtrarParceladas(ps, { situacao: 'longas' }), []);
  assert.deepEqual(nomes(A.filtrarParceladas(ps, { faixa: 'ate50' })), ['CURSO ONLINE']);
  assert.deepEqual(nomes(A.filtrarParceladas(ps, { faixa: 'de50a200' })), ['LOJA DE MOVEIS', 'PIX FULANO DE TAL']);
  assert.deepEqual(A.filtrarParceladas(ps, { faixa: 'acima200' }), []);
  assert.deepEqual(nomes(A.filtrarParceladas(ps, { busca: 'pix' })), ['PIX FULANO DE TAL']);
  assert.deepEqual(nomes(A.filtrarParceladas(ps, { situacao: 'acabando', faixa: 'de50a200', busca: 'loja' })), ['LOJA DE MOVEIS']);
  assert.equal(A.filtrarParceladas(ps, {}).length, 3);
});

test('limites das faixas de valor da parcela', () => {
  const p = v => ({ valor: v, restantes: 3, parcelaAtual: 3, descricao: 'X' });
  assert.equal(A.filtrarParceladas([p(50)], { faixa: 'ate50' }).length, 1);
  assert.equal(A.filtrarParceladas([p(50.01)], { faixa: 'de50a200' }).length, 1);
  assert.equal(A.filtrarParceladas([p(200)], { faixa: 'de50a200' }).length, 1);
  assert.equal(A.filtrarParceladas([p(200.01)], { faixa: 'acima200' }).length, 1);
});

test('ordenação das parceladas', () => {
  const f = fatura();
  const ps = A.parceladas(f, f.lancamentos);
  const ordem = c => A.ordenarParceladas(ps, c).map(p => p.descricao);
  assert.deepEqual(ordem('aPagar'), ['LOJA DE MOVEIS', 'PIX FULANO DE TAL', 'CURSO ONLINE']);
  assert.deepEqual(ordem('valor'), ['LOJA DE MOVEIS', 'PIX FULANO DE TAL', 'CURSO ONLINE']);
  assert.deepEqual(ordem('termina'), ['CURSO ONLINE', 'LOJA DE MOVEIS', 'PIX FULANO DE TAL']);
  assert.deepEqual(ordem('recentes'), ['PIX FULANO DE TAL', 'LOJA DE MOVEIS', 'CURSO ONLINE']);
  assert.deepEqual(ordem('loja'), ['CURSO ONLINE', 'LOJA DE MOVEIS', 'PIX FULANO DE TAL']);
  assert.notEqual(A.ordenarParceladas(ps, 'loja'), ps, 'não altera a lista original');
});

test('resumo das parceladas filtradas', () => {
  const f = fatura();
  const ps = A.filtrarParceladas(A.parceladas(f, f.lancamentos), { situacao: 'acabando' });
  assert.deepEqual(A.resumoParceladas(ps), { qtd: 3, porMes: 227.64, aPagar: 177.64, ultimoMes: '2026-10' });
  assert.deepEqual(A.resumoParceladas([]), { qtd: 0, porMes: 0, aPagar: 0, ultimoMes: null });
});
