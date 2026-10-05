import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extrairItens, PdfSenhaError } from '../js/pdf-items.js';
import { caminhoFaturaReal, itensDaFaturaReal, pdfjs } from './helpers/pdf-real.mjs';

test('fatura real: extrai itens com posição', async t => {
  const itens = await itensDaFaturaReal();
  if (!itens) return t.skip('sem faturas/*.pdf ou FATURA_SENHA');
  assert.ok(itens.length > 500);
  const titulo = itens.find(i => i.s.startsWith('Detalhamento da Fatura'));
  assert.ok(titulo && titulo.p === 2 && titulo.y > 290 && titulo.y < 320);
  assert.ok(itens.every(i => i.s === i.s.trim() && i.s.length > 0));
});

test('fatura real: sem senha → PdfSenhaError necessaria', async t => {
  const caminho = caminhoFaturaReal();
  if (!caminho) return t.skip('sem faturas/*.pdf');
  await assert.rejects(
    extrairItens(pdfjs, new Uint8Array(readFileSync(caminho))),
    e => e instanceof PdfSenhaError && e.motivo === 'necessaria');
});

test('fatura real: senha errada → PdfSenhaError incorreta', async t => {
  const caminho = caminhoFaturaReal();
  if (!caminho) return t.skip('sem faturas/*.pdf');
  await assert.rejects(
    extrairItens(pdfjs, new Uint8Array(readFileSync(caminho)), '000'),
    e => e instanceof PdfSenhaError && e.motivo === 'incorreta');
});

test('arquivo que não é PDF → erro comum, não PdfSenhaError', async () => {
  await assert.rejects(
    extrairItens(pdfjs, new TextEncoder().encode('não sou um pdf')),
    e => !(e instanceof PdfSenhaError));
});
