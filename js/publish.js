// Publica e baixa o cofre da família no próprio repositório do GitHub.
import { paraBase64, deBase64 } from './vault.js';

export const CAMINHO_DADOS = 'data/familia.enc.json';
const API = 'https://api.github.com';

export class PublicarError extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.codigo = codigo; }
}

export function repoDaUrl(url) {
  const u = new URL(url);
  const m = u.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  if (!m) return null;
  const repo = u.pathname.split('/').filter(Boolean).find(p => !p.includes('.'));
  return { dono: m[1], repo: repo ?? `${m[1]}.github.io` };
}

const erroToken = () => new PublicarError('TOKEN', 'O GitHub recusou o token: ele está errado, expirou ou não tem permissão neste repositório. Gere um novo em Configurações.');
const cabecalhos = token => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
const urlDados = (dono, repo) => `${API}/repos/${dono}/${repo}/contents/${CAMINHO_DADOS}`;

// Lê o cofre publicado AGORA, com o token (sem cache do Pages). null = ainda não existe.
export async function lerRemoto({ dono, repo, token, ramo = 'main', fetch: f = globalThis.fetch }) {
  const r = await f(`${urlDados(dono, repo)}?ref=${ramo}&t=${Date.now()}`, { headers: cabecalhos(token), cache: 'no-store' });
  if (r.status === 401 || r.status === 403) throw erroToken();
  if (r.status === 404) return null;
  if (!r.ok) throw new PublicarError('HTTP', `O GitHub respondeu ${r.status} ao ler os dados publicados. Nada foi gravado.`);
  const corpo = await r.json();
  return { cofre: JSON.parse(deBase64(corpo.content)), sha: corpo.sha };
}

// Grava o cofre. `sha` é o da leitura feita imediatamente antes: se alguém publicou no meio, o GitHub recusa (conflito).
export async function publicar({ dono, repo, token, cofre, sha, ramo = 'main', fetch: f = globalThis.fetch }) {
  const corpo = { message: 'Atualiza dados da família', content: paraBase64(JSON.stringify(cofre)), branch: ramo };
  if (sha) corpo.sha = sha;
  const resp = await f(urlDados(dono, repo), { method: 'PUT', headers: { ...cabecalhos(token), 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  if (resp.status === 401 || resp.status === 403) throw erroToken();
  if (resp.status === 409 || resp.status === 422) throw new PublicarError('CONFLITO', 'Os dados publicados mudaram enquanto você publicava. Clique em publicar de novo.');
  if (!resp.ok) throw new PublicarError('HTTP', `O GitHub respondeu ${resp.status} ao gravar os dados.`);
  return (await resp.json()).commit?.sha ?? null;
}

// Para quem só vê. No GitHub Pages lê pela API (dados frescos); se a API falhar (limite de acessos, rede),
// tenta o arquivo do próprio site, que pode estar alguns minutos atrasado. Fora do Pages, caminho relativo.
export async function baixarCofre({ repo, fetch: f = globalThis.fetch }) {
  const doSite = async () => {
    const r = await f(`${CAMINHO_DADOS}?t=${Date.now()}`, { cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new PublicarError('HTTP', `Não consegui baixar os dados publicados (erro ${r.status}).`);
    return r.json();
  };
  if (!repo) return doSite();
  let r;
  try {
    r = await f(`${urlDados(repo.dono, repo.repo)}?t=${Date.now()}`, { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
  } catch {
    return doSite();
  }
  if (r.status === 404) return null;
  if (!r.ok) return doSite();
  return r.json();
}
