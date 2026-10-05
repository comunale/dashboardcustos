// Lê a fatura real de faturas/ (nunca versionada). Senha via variável FATURA_SENHA.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extrairItens } from '../../js/pdf-items.js';

export function caminhoFaturaReal() {
  const dir = new URL('../../faturas/', import.meta.url);
  if (!existsSync(dir)) return null;
  const nome = readdirSync(dir).find(n => /\.pdf$/i.test(n));
  return nome ? new URL(nome, dir) : null;
}

export async function itensDaFaturaReal() {
  const caminho = caminhoFaturaReal();
  if (!caminho || !process.env.FATURA_SENHA) return null;
  return extrairItens(pdfjs, new Uint8Array(readFileSync(caminho)), process.env.FATURA_SENHA);
}

export { pdfjs };
