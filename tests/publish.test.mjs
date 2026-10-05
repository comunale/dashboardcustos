import test from 'node:test';
import assert from 'node:assert/strict';
import { repoDaUrl, publicar, baixarCofre, PublicarError, CAMINHO_DADOS } from '../js/publish.js';

const resposta = (status, corpo) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });

function fetchFalso(roteiro) {
  const chamadas = [];
  const f = async (url, opcoes = {}) => {
    chamadas.push({ url, opcoes });
    return roteiro(url, opcoes, chamadas.length);
  };
  f.chamadas = chamadas;
  return f;
}

test('repoDaUrl lê dono e repositório do endereço do GitHub Pages', () => {
  assert.deepEqual(repoDaUrl('https://comunale.github.io/dashboardcustos/'), { dono: 'comunale', repo: 'dashboardcustos' });
  assert.deepEqual(repoDaUrl('https://comunale.github.io/dashboardcustos/index.html?x=1'), { dono: 'comunale', repo: 'dashboardcustos' });
  assert.equal(repoDaUrl('http://localhost:8080/'), null);
});

test('publicar cria o arquivo quando ele ainda não existe (sem sha)', async () => {
  const f = fetchFalso(() => resposta(201, { commit: { sha: 'abc' } }));
  const sha = await publicar({ dono: 'd', repo: 'r', token: 't', cofre: { versao: 1 }, fetch: f });
  assert.equal(sha, 'abc');
  const put = f.chamadas[0];
  assert.equal(put.url, `https://api.github.com/repos/d/r/contents/${CAMINHO_DADOS}`);
  const corpo = JSON.parse(put.opcoes.body);
  assert.equal(corpo.sha, undefined);
  assert.equal(corpo.branch, 'main');
  assert.deepEqual(JSON.parse(Buffer.from(corpo.content, 'base64').toString('utf8')), { versao: 1 });
  assert.equal(put.opcoes.headers.Authorization, 'Bearer t');
});

test('token inválido → PublicarError TOKEN', async () => {
  const f = fetchFalso(() => resposta(401, {}));
  await assert.rejects(publicar({ dono: 'd', repo: 'r', token: 'x', cofre: {}, fetch: f }), e => e instanceof PublicarError && e.codigo === 'TOKEN');
});

test('baixarCofre: 404 → null (nada publicado ainda)', async () => {
  const f = fetchFalso(() => resposta(404, {}));
  assert.equal(await baixarCofre({ repo: { dono: 'd', repo: 'r' }, fetch: f }), null);
  assert.equal(await baixarCofre({ repo: null, fetch: f }), null);
});

test('baixarCofre usa a API (dados frescos) no GitHub Pages e caminho relativo em casa', async () => {
  const f = fetchFalso(() => resposta(200, { versao: 1 }));
  assert.deepEqual(await baixarCofre({ repo: { dono: 'd', repo: 'r' }, fetch: f }), { versao: 1 });
  assert.match(f.chamadas[0].url, /^https:\/\/api\.github\.com\/repos\/d\/r\/contents\/data\/familia\.enc\.json/);
  assert.equal(f.chamadas[0].opcoes.headers.Accept, 'application/vnd.github.raw+json');
  await baixarCofre({ repo: null, fetch: f });
  assert.match(f.chamadas[1].url, /^data\/familia\.enc\.json\?t=\d+$/);
});

test('lerRemoto: lê conteúdo e sha com o token; 404 → null', async () => {
  const { lerRemoto } = await import('../js/publish.js');
  const conteudo = Buffer.from(JSON.stringify({ versao: 1, x: 'ção' }), 'utf8').toString('base64').replace(/(.{20})/g, '$1\n');
  const f = fetchFalso(() => resposta(200, { sha: 'abc', content: conteudo, encoding: 'base64' }));
  assert.deepEqual(await lerRemoto({ dono: 'd', repo: 'r', token: 't', fetch: f }), { cofre: { versao: 1, x: 'ção' }, sha: 'abc' });
  assert.equal(f.chamadas[0].opcoes.headers.Authorization, 'Bearer t');
  assert.equal(await lerRemoto({ dono: 'd', repo: 'r', token: 't', fetch: fetchFalso(() => resposta(404, {})) }), null);
  await assert.rejects(lerRemoto({ dono: 'd', repo: 'r', token: 't', fetch: fetchFalso(() => resposta(500, {})) }), e => e instanceof PublicarError && e.codigo === 'HTTP');
});

test('publicar usa o sha lido na hora (sem GET extra) e acusa conflito', async () => {
  const f = fetchFalso(() => resposta(200, { commit: { sha: 'novo' } }));
  await publicar({ dono: 'd', repo: 'r', token: 't', cofre: {}, sha: 'lido', fetch: f });
  assert.equal(f.chamadas.length, 1);
  assert.equal(JSON.parse(f.chamadas[0].opcoes.body).sha, 'lido');
  const conflito = fetchFalso(() => resposta(409, {}));
  await assert.rejects(publicar({ dono: 'd', repo: 'r', token: 't', cofre: {}, sha: 'velho', fetch: conflito }), e => e instanceof PublicarError && e.codigo === 'CONFLITO');
});

test('baixarCofre: se a API falhar, tenta o arquivo do próprio site', async () => {
  const f = fetchFalso(url => (url.startsWith('https://api.github.com') ? resposta(403, {}) : resposta(200, { versao: 1 })));
  assert.deepEqual(await baixarCofre({ repo: { dono: 'd', repo: 'r' }, fetch: f }), { versao: 1 });
  assert.match(f.chamadas[1].url, /^data\/familia\.enc\.json\?t=\d+$/);
});
