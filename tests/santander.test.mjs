import test from 'node:test';
import assert from 'node:assert/strict';
import { lerFaturaSantander, LayoutError, paraNumero } from '../js/parsers/santander.js';
import { itensSinteticos } from './helpers/fatura-sintetica.mjs';
import { itensDaFaturaReal } from './helpers/pdf-real.mjs';

const soma = (ls, f) => Math.round(ls.filter(f).reduce((a, l) => a + l.valor, 0) * 100) / 100;

test('paraNumero entende o formato brasileiro', () => {
  assert.equal(paraNumero('R$ 29.543,72'), 29543.72);
  assert.equal(paraNumero('R$63.490,00'), 63490);
  assert.equal(paraNumero('-2.000,00'), -2000);
  assert.equal(paraNumero('9,90'), 9.9);
});

test('cabeçalho e histórico', () => {
  const f = lerFaturaSantander(itensSinteticos());
  assert.equal(f.id, '2026-09');
  assert.equal(f.vencimento, '2026-09-25');
  assert.equal(f.fechamento, '2026-09-18');
  assert.equal(f.total, 1722.54);
  assert.equal(f.limite, 10000);
  assert.equal(f.limiteUsado, 2000);
  assert.equal(f.limiteDisponivel, 8000);
  assert.deepEqual(f.historico, [
    { id: '2026-08', valor: 900, pago: 850 },
    { id: '2026-09', valor: 1722.54, pago: null },
  ]);
});

test('cartões, lançamentos e regras de leitura', () => {
  const f = lerFaturaSantander(itensSinteticos());
  assert.deepEqual(f.cartoes.map(c => [c.titular, c.final, c.virtual, c.pessoa, c.valorTotal]), [
    ['ANA SOUZA LIMA', '1111', false, 'Ana', 305],
    ['BRUNO LIMA', '2222', true, 'Bruno', 1377.54],
  ]);
  assert.equal(f.lancamentos.length, 11, 'nada depois do Resumo é lido');
  const moveis = f.lancamentos.find(l => l.descricao === 'LOJA DE MOVEIS');
  assert.equal(moveis.data, '2026-01-16');
  assert.equal(moveis.parcelaAtual, 9);
  assert.equal(moveis.parcelaTotal, 10);
  assert.equal(moveis.secao, 'parcelamentos');
  assert.equal(moveis.pessoa, 'Ana');
  assert.equal(f.lancamentos.find(l => l.descricao === 'CURSO ONLINE').data, '2025-11-20', 'mês após o vencimento = ano anterior');
  const pix = f.lancamentos.find(l => l.descricao === 'PIX FULANO DE TAL');
  assert.equal(pix.juros, 18.01);
  assert.equal(pix.iof, 0.46);
  assert.equal(pix.cartao, '2222');
  const estorno = f.lancamentos.find(l => l.descricao === 'EBN *TIKTOK SHOP');
  assert.equal(estorno.valor, -10);
  assert.equal(estorno.tipo, 'credito');
  assert.equal(estorno.secao, 'despesas');
  assert.ok(f.lancamentos.every(l => /^2026-09-\d{4}$/.test(l.id)));
});

test('resumo e conferência', () => {
  const f = lerFaturaSantander(itensSinteticos());
  assert.equal(f.resumo.despesasBrasil, 1682.54);
  assert.equal(f.resumo.pagamentos, 850);
  assert.equal(f.resumo.creditos, 10);
  assert.equal(f.resumo.obrigacoesFuturas, 177.64);
  assert.deepEqual(f.resumo.encargosParcelamentos, { juros: 18.01, iof: 0.46 });
  assert.equal(f.conferencia.ok, true, JSON.stringify(f.conferencia.checks));
});

test('conferência falha quando um valor não bate', () => {
  const f = lerFaturaSantander(itensSinteticos({ trocar: { ml: '81,00' } }));
  assert.equal(f.conferencia.ok, false);
  assert.ok(f.conferencia.checks.some(c => !c.ok && c.nome.startsWith('Compras')));
});

test('PDF de outro banco → LayoutError', () => {
  const itens = itensSinteticos().map(i => ({ ...i, s: i.s.replace('SANTANDER', 'OUTRO BANCO') }));
  assert.throws(() => lerFaturaSantander(itens), LayoutError);
});

test('sem detalhamento → LayoutError', () => {
  const itens = itensSinteticos().filter(i => !i.s.startsWith('Detalhamento'));
  assert.throws(() => lerFaturaSantander(itens), LayoutError);
});

// Sem valores fixos da fatura real no código (o repositório é público): a prova é bater com os totais
// que a própria fatura declara. Os números conferidos na exploração estão na spec, que fica só local.
test('fatura real bate ao centavo com os totais do banco', async t => {
  const itens = await itensDaFaturaReal();
  if (!itens) return t.skip('sem faturas/*.pdf ou FATURA_SENHA');
  const f = lerFaturaSantander(itens);
  assert.match(f.id, /^\d{4}-\d{2}$/);
  assert.ok(f.total > 0 && f.limite > 0 && f.limiteUsado > 0);
  assert.ok(f.cartoes.length >= 1 && f.cartoes.every(c => c.valorTotal != null));
  assert.ok(f.lancamentos.length > 100);
  assert.ok(f.historico.length >= 2 && f.historico.some(h => h.pago != null));
  assert.equal(soma(f.lancamentos, l => l.valor > 0), f.resumo.despesasBrasil + (f.resumo.despesasExterior ?? 0));
  assert.ok(f.resumo.obrigacoesFuturas > 0);
  assert.equal(f.conferencia.ok, true, JSON.stringify(f.conferencia.checks));
});
