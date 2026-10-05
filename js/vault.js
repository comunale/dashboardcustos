// Cofre da família: criptografa o histórico com uma senha (PBKDF2-SHA256 + AES-GCM 256).
// Funciona no navegador e no Node 20+ (globalThis.crypto.subtle).

const ITERACOES = 600_000;
const cod = new TextEncoder();
const decod = new TextDecoder();

export class CofreError extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.codigo = codigo; }
}

// O cofre fica público (e no histórico do git para sempre): recusa senhas longas porém triviais.
export function senhaForte(senha) {
  const s = (senha ?? '').trim();
  const palavras = new Set(s.toLowerCase().split(/[\s-]+/).filter(p => p.length >= 3));
  return (s.length >= 16 && new Set(s.toLowerCase().replace(/\s/g, '')).size >= 8) || palavras.size >= 4;
}

function bytesParaBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function base64ParaBytes(texto) {
  const s = atob(texto);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
export const paraBase64 = texto => bytesParaBase64(cod.encode(texto));
export const deBase64 = texto => decod.decode(base64ParaBytes(texto.replace(/\s/g, '')));

async function derivarChave(senha, sal, iteracoes) {
  const base = await crypto.subtle.importKey('raw', cod.encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function trancar(dados, senha, { iteracoes = ITERACOES } = {}) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await derivarChave(senha, sal, iteracoes);
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, cod.encode(JSON.stringify(dados)));
  return { versao: 1, kdf: 'PBKDF2-SHA256', iteracoes, sal: bytesParaBase64(sal), iv: bytesParaBase64(iv), dados: bytesParaBase64(new Uint8Array(cifrado)) };
}

export async function destrancar(cofre, senha) {
  if (cofre?.versao !== 1 || cofre.kdf !== 'PBKDF2-SHA256') throw new CofreError('FORMATO', 'O arquivo de dados está num formato que este site não conhece.');
  const chave = await derivarChave(senha, base64ParaBytes(cofre.sal), cofre.iteracoes);
  let claro;
  try {
    claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ParaBytes(cofre.iv) }, chave, base64ParaBytes(cofre.dados));
  } catch {
    throw new CofreError('SENHA', 'Senha da família incorreta.');
  }
  return JSON.parse(decod.decode(claro));
}
