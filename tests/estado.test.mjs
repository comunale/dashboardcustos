import test from 'node:test';
import assert from 'node:assert/strict';
import { criarEstado, adicionarFatura, carregarDoCofre, paraCofre, podePublicar, faturasOrdenadas, pessoasDa } from '../js/estado.js';

const f = (id, ok = true, extra = {}) => ({ id, conferencia: { ok }, cartoes: [{ pessoa: 'Ana' }, { pessoa: 'Bruno' }, { pessoa: 'Ana' }], lancamentos: [], ...extra });

test('subir a mesma fatura de novo substitui, não duplica', () => {
  const e = criarEstado();
  adicionarFatura(e, f('2026-09', true, { total: 1 }));
  adicionarFatura(e, f('2026-09', true, { total: 2 }));
  assert.equal(e.faturas.size, 1);
  assert.equal(e.faturas.get('2026-09').total, 2);
  assert.equal(e.alterado, true);
});

test('carregar do cofre e seleciona a fatura mais recente', () => {
  const e = criarEstado();
  carregarDoCofre(e, { versao: 1, faturas: [f('2026-08'), f('2026-09')] });
  assert.equal(e.faturaId, '2026-09');
  assert.equal(e.alterado, false);
  assert.deepEqual(faturasOrdenadas(e).map(x => x.id), ['2026-09', '2026-08']);
});

test('paraCofre devolve as faturas em ordem', () => {
  const e = criarEstado();
  adicionarFatura(e, f('2026-09'));
  adicionarFatura(e, f('2026-07'));
  const c = paraCofre(e);
  assert.equal(c.versao, 1);
  assert.deepEqual(c.faturas.map(x => x.id), ['2026-07', '2026-09']);
});

test('não publica com conferência falhando nem sem mudanças', () => {
  const e = criarEstado();
  assert.equal(podePublicar(e).ok, false);
  adicionarFatura(e, f('2026-09', false));
  const r = podePublicar(e);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /2026-09|setembro/);
  adicionarFatura(e, f('2026-09', true));
  assert.equal(podePublicar(e).ok, true);
});

test('pessoas da fatura sem repetição', () => {
  assert.deepEqual(pessoasDa(f('2026-09')), ['Ana', 'Bruno']);
});

test('mesclar: meses alterados aqui vencem, o resto vem do remoto lido agora', async () => {
  const { mesclar } = await import('../js/estado.js');
  const e = criarEstado();
  carregarDoCofre(e, { versao: 1, faturas: [f('2026-07', true, { v: 'antigo' }), f('2026-08', true, { v: 'antigo' })] });
  adicionarFatura(e, f('2026-09', true, { v: 'novo-local' }));
  // remoto mudou depois que esta aba abriu: corrigiram 08 e alguém publicou 10
  mesclar(e, { versao: 1, faturas: [f('2026-07', true, { v: 'antigo' }), f('2026-08', true, { v: 'corrigido' }), f('2026-10', true, { v: 'outro-aparelho' })] });
  assert.deepEqual(paraCofre(e).faturas.map(x => [x.id, x.v]), [
    ['2026-07', 'antigo'], ['2026-08', 'corrigido'], ['2026-09', 'novo-local'], ['2026-10', 'outro-aparelho'],
  ]);
});

test('publicação concluída zera as alterações pendentes', async () => {
  const { marcarPublicado } = await import('../js/estado.js');
  const e = criarEstado();
  adicionarFatura(e, f('2026-09'));
  assert.deepEqual([...e.alteradas], ['2026-09']);
  marcarPublicado(e);
  assert.equal(e.alteradas.size, 0);
  assert.equal(podePublicar(e).ok, false);
});
