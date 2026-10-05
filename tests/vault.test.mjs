import test from 'node:test';
import assert from 'node:assert/strict';
import { trancar, destrancar, CofreError, senhaForte, paraBase64 } from '../js/vault.js';

const rapido = { iteracoes: 1000 };
const dados = { versao: 1, faturas: [{ id: '2026-09', lancamentos: [{ descricao: 'PADARIA SÃO JOÃO', valor: 12.5 }] }] };

test('tranca e destranca com a mesma senha', async () => {
  const cofre = await trancar(dados, 'tigre azul janela pipoca', rapido);
  assert.deepEqual(await destrancar(cofre, 'tigre azul janela pipoca'), dados);
});

test('o cofre não contém o texto original e muda a cada vez', async () => {
  const a = await trancar(dados, 'tigre azul janela pipoca', rapido);
  const b = await trancar(dados, 'tigre azul janela pipoca', rapido);
  assert.ok(!JSON.stringify(a).includes('PADARIA'));
  assert.notEqual(a.dados, b.dados);
  assert.notEqual(a.sal, b.sal);
  assert.equal(a.kdf, 'PBKDF2-SHA256');
});

test('padrão de 600 mil iterações', async () => {
  const cofre = await trancar({ ok: 1 }, 'tigre azul janela pipoca');
  assert.equal(cofre.iteracoes, 600000);
});

test('senha errada → CofreError SENHA', async () => {
  const cofre = await trancar(dados, 'tigre azul janela pipoca', rapido);
  await assert.rejects(destrancar(cofre, 'outra senha qualquer aqui'), e => e instanceof CofreError && e.codigo === 'SENHA');
});

test('arquivo desconhecido → CofreError FORMATO', async () => {
  await assert.rejects(destrancar({ versao: 99 }, 'x'), e => e instanceof CofreError && e.codigo === 'FORMATO');
});

test('senha forte: 16+ caracteres ou 4+ palavras', () => {
  assert.equal(senhaForte('tigre azul janela pipoca'), true);
  assert.equal(senhaForte('umasenhabemlonga1'), true);
  assert.equal(senhaForte('123456'), false);
  assert.equal(senhaForte('tigre azul mesa'), false);
  assert.equal(senhaForte(''), false);
});

test('paraBase64 preserva acentos (UTF-8)', () => {
  assert.equal(Buffer.from(paraBase64('ação'), 'base64').toString('utf8'), 'ação');
});

test('senha forte recusa repetições triviais (o cofre é público e fica no histórico)', () => {
  assert.equal(senhaForte('aaa aaa aaa aaa'), false);
  assert.equal(senhaForte('1111111111111111'), false);
  assert.equal(senhaForte('senha senha senha senha'), false);
  assert.equal(senhaForte('abababababababab'), false);
  assert.equal(senhaForte('tigre azul janela pipoca'), true);
});
