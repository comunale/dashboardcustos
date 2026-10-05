// Inicialização e fluxos: destrancar, subir fatura, publicar, filtros e abas.
import { extrairItens, PdfSenhaError } from './pdf-items.js';
import { lerFaturaSantander, LayoutError } from './parsers/santander.js';
import { filtrar } from './analysis.js';
import { trancar, destrancar, senhaForte, CofreError } from './vault.js';
import { publicar, lerRemoto, baixarCofre, repoDaUrl, PublicarError } from './publish.js';
import { criarEstado, adicionarFatura, carregarDoCofre, mesclar, marcarPublicado, paraCofre, podePublicar, faturasOrdenadas, pessoasDa } from './estado.js';
import { mesLongo, mesCurto, moeda } from './format.js';
import { h } from './ui/dom.js';
import { destruirGraficos } from './ui/graficos.js';
import * as resumo from './ui/resumo.js';
import * as parceladas from './ui/parceladas.js';
import * as habitos from './ui/habitos.js';
import * as altos from './ui/altos.js';
import * as marketplaces from './ui/marketplaces.js';
import * as compras from './ui/compras.js';

const ABAS = { resumo, parceladas, habitos, altos, marketplaces, compras };
const PDFJS = new URL('../vendor/pdf.min.mjs', import.meta.url).href;
const PDFJS_WORKER = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

const $ = id => document.getElementById(id);
const estado = criarEstado();
let cofreRemoto = null;
let situacaoRemoto = 'carregando'; // 'ok' | 'vazio' (nada publicado) | 'erro'
let erroRemoto = '';

const guardar = {
  ler: k => { try { return localStorage.getItem(`dc.${k}`); } catch { return null; } },
  gravar: (k, v) => { try { v == null ? localStorage.removeItem(`dc.${k}`) : localStorage.setItem(`dc.${k}`, v); } catch { /* armazenamento indisponível */ } },
};

function configRepo() {
  return repoDaUrl(location.href) ?? (guardar.ler('dono') && guardar.ler('repo') ? { dono: guardar.ler('dono'), repo: guardar.ler('repo') } : null);
}

function avisar(texto, { erro = false, ms = 6000 } = {}) {
  const el = $('aviso');
  el.textContent = texto;
  el.classList.toggle('erro-aviso', erro);
  el.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- Renderização ----------
function render() {
  destruirGraficos();
  const main = $('conteudo');
  const fatura = estado.faturas.get(estado.faturaId);
  const temDados = !!fatura;
  $('filtros').hidden = !temDados;
  $('abas').hidden = !temDados;
  const pub = podePublicar(estado);
  $('btn-publicar').hidden = !estado.alterado;
  $('btn-publicar').title = pub.ok ? '' : pub.motivo;
  if (!temDados) {
    $('subtitulo').textContent = '';
    main.replaceChildren(telaInicial());
    return;
  }
  $('subtitulo').textContent = `Fatura de ${mesLongo(fatura.id)}, vence em ${fatura.vencimento.split('-').reverse().join('/')}`;
  renderFiltros(fatura);
  for (const b of $('abas').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.aba === estado.aba));
  const ctx = {
    estado, fatura, faturas: faturasOrdenadas(estado),
    lancs: filtrar(fatura.lancamentos, { pessoa: estado.pessoa, cartao: estado.cartao }),
    todos: estado.pessoa === 'todos' && estado.cartao === 'todos',
    rerender: render,
  };
  main.replaceChildren();
  if (!fatura.conferencia.ok) main.append(avisoConferencia(fatura));
  ABAS[estado.aba].render(main, ctx);
}

function avisoConferencia(fatura) {
  const ruins = fatura.conferencia.checks.filter(c => !c.ok);
  return h('div', { class: 'alerta', role: 'alert' }, h('span', { class: 'icone', 'aria-hidden': 'true' }, '!'),
    h('div', {}, h('p', {}, h('strong', {}, 'Os números desta fatura não bateram com os totais do banco. '), 'O painel abre para conferência, mas publicar está bloqueado.'),
      h('p', {}, ruins.map(c => `${c.nome}: banco ${c.esperado == null ? '—' : moeda(c.esperado)}, lido ${moeda(c.obtido)}`).join('; '))));
}

function renderFiltros(fatura) {
  const sel = $('f-fatura');
  sel.replaceChildren(...faturasOrdenadas(estado).map(f => h('option', { value: f.id, selected: f.id === estado.faturaId }, mesCurto(f.id))));
  const pessoas = ['todos', ...pessoasDa(fatura)];
  $('f-pessoa').replaceChildren(...pessoas.map(p => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(estado.pessoa === p),
    onclick: () => { estado.pessoa = p; estado.cartao = 'todos'; render(); },
  }, p === 'todos' ? 'Todos' : p)));
  const cartoes = fatura.cartoes.filter(c => estado.pessoa === 'todos' || c.pessoa === estado.pessoa);
  $('f-cartao').replaceChildren(h('option', { value: 'todos' }, 'Todos'),
    ...cartoes.map(c => h('option', { value: c.final, selected: c.final === estado.cartao }, `${c.pessoa} final ${c.final}${c.virtual ? ' (virtual)' : ''}`)));
}

function telaInicial() {
  if (cofreRemoto && !estado.faturas.size) return telaTrava();
  const subir = h('button', { class: 'botao', type: 'button', onclick: () => abrirSubir() }, 'Subir uma fatura');
  if (situacaoRemoto === 'erro') {
    return h('section', { class: 'soltar' },
      h('h2', {}, 'Não consegui buscar os dados publicados'),
      h('p', { class: 'ajuda centro' }, `${erroRemoto} Confira a internet e tente de novo.`),
      h('div', { class: 'acoes centro' }, h('button', { class: 'botao primario', type: 'button', onclick: () => location.reload() }, 'Tentar de novo'), subir));
  }
  return h('section', { class: 'soltar' },
    h('h2', {}, 'Ainda não há faturas publicadas'),
    h('p', { class: 'ajuda centro' }, 'Quando a fatura do mês for publicada, ela aparece aqui. Quem publica: arraste o PDF para esta tela ou use o botão abaixo. A fatura é lida aqui no navegador e não é enviada para lugar nenhum.'),
    h('div', { class: 'acoes centro' }, subir));
}

function telaTrava() {
  const entrada = h('input', { type: 'password', id: 'trava-senha', autocomplete: 'current-password' });
  const lembrar = h('input', { type: 'checkbox' });
  const erro = h('p', { class: 'erro', role: 'alert', hidden: true });
  const tentar = async ev => {
    ev.preventDefault();
    erro.hidden = true;
    try {
      await abrirCofre(entrada.value);
      if (lembrar.checked) guardar.gravar('senhaFamilia', entrada.value);
      render();
    } catch (e) {
      erro.textContent = e instanceof CofreError ? e.message : `Não consegui abrir os dados: ${e.message}`;
      erro.hidden = false;
    }
  };
  setTimeout(() => entrada.focus(), 0);
  return h('section', { class: 'bloco trava' }, h('h2', {}, 'Digite a senha da família'),
    h('p', { class: 'ajuda' }, 'Os dados das faturas estão protegidos. A senha é a mesma combinada entre vocês dois.'),
    h('form', { onsubmit: tentar },
      h('label', { class: 'campo-bloco' }, 'Senha da família', entrada),
      h('label', { class: 'marcar' }, lembrar, 'Lembrar neste aparelho'),
      erro,
      h('button', { class: 'botao primario', type: 'submit' }, 'Abrir painel')));
}

async function abrirCofre(senha) {
  const dados = await destrancar(cofreRemoto, senha);
  estado.senhaFamilia = senha;
  carregarDoCofre(estado, dados);
}

// ---------- Subir fatura ----------
let pdfjsCarregado = null;
async function pdfjs() {
  if (!pdfjsCarregado) {
    pdfjsCarregado = import(PDFJS).then(m => { m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return m; });
  }
  return pdfjsCarregado;
}

function abrirSubir(arquivo) {
  const dlg = $('dlg-subir');
  $('erro-subir').hidden = true;
  $('in-senha-pdf').value = '';
  if (arquivo) {
    const dt = new DataTransfer();
    dt.items.add(arquivo);
    $('in-pdf').files = dt.files;
  }
  dlg.showModal();
  (arquivo ? $('in-senha-pdf') : $('in-pdf')).focus();
}

async function lerFatura() {
  const arquivo = $('in-pdf').files[0];
  const erro = $('erro-subir');
  const botao = $('btn-ler');
  erro.hidden = true;
  if (!arquivo) { erro.textContent = 'Escolha o arquivo PDF da fatura.'; erro.hidden = false; return; }
  botao.disabled = true;
  botao.textContent = 'Lendo…';
  try {
    const dados = new Uint8Array(await arquivo.arrayBuffer());
    const itens = await extrairItens(await pdfjs(), dados, $('in-senha-pdf').value);
    const fatura = lerFaturaSantander(itens);
    adicionarFatura(estado, fatura);
    estado.aba = 'resumo';
    $('dlg-subir').close();
    render();
    avisar(fatura.conferencia.ok
      ? `Fatura de ${mesLongo(fatura.id)} lida: ${fatura.lancamentos.length} lançamentos, totais conferidos com o banco.`
      : `Fatura de ${mesLongo(fatura.id)} lida, mas os totais não bateram. Veja o aviso no topo.`, { erro: !fatura.conferencia.ok });
  } catch (e) {
    erro.textContent = e instanceof PdfSenhaError
      ? (e.motivo === 'incorreta' ? 'Senha do PDF incorreta. Confira e tente de novo.' : 'Este PDF pede senha. Digite a senha da fatura.')
      : e instanceof LayoutError ? e.message
      : `Não consegui ler este arquivo como PDF (${e.message}).`;
    erro.hidden = false;
    if (e instanceof PdfSenhaError) $('in-senha-pdf').focus();
  } finally {
    botao.disabled = false;
    botao.textContent = 'Ler fatura';
  }
}

// ---------- Publicar ----------
function pedirSenhaFamilia({ criar }) {
  return new Promise(resolve => {
    const dlg = $('dlg-senha');
    $('senha-titulo').textContent = criar ? 'Criar a senha da família' : 'Senha da família';
    $('senha-ajuda').textContent = criar
      ? 'Ela protege os dados publicados. Use 4 palavras aleatórias (ex.: "tigre azul janela pipoca") e combine com sua esposa pessoalmente. Se for esquecida, os dados publicados não podem ser recuperados; basta subir as faturas de novo.'
      : 'A mesma senha usada para abrir o painel.';
    $('bloco-confirmar').hidden = !criar;
    $('in-senha-familia').value = '';
    $('in-senha-confirmar').value = '';
    $('in-lembrar').checked = false;
    $('erro-senha').hidden = true;
    dlg.returnValue = '';
    const ok = () => {
      const s = $('in-senha-familia').value;
      const falha = criar && !senhaForte(s) ? 'Use 4 palavras diferentes, ou 16 caracteres sem repetições óbvias.'
        : criar && s !== $('in-senha-confirmar').value ? 'As duas senhas não são iguais.'
        : !s ? 'Digite a senha.' : null;
      if (falha) { $('erro-senha').textContent = falha; $('erro-senha').hidden = false; return; }
      dlg.close('ok');
      resolve({ senha: s, lembrar: $('in-lembrar').checked }); // só é gravada depois de conferida
    };
    $('btn-senha-ok').onclick = ok;
    dlg.onclose = () => { if (dlg.returnValue !== 'ok') resolve(null); };
    dlg.showModal();
  });
}

async function publicarAgora() {
  const pode = podePublicar(estado);
  if (!pode.ok) { avisar(pode.motivo, { erro: true }); return; }
  const token = guardar.ler('token');
  const repo = configRepo();
  if (!token || !repo) { avisar('Para publicar, configure o token do GitHub primeiro.'); abrirConfig(); return; }
  const botao = $('btn-publicar');
  botao.disabled = true;
  botao.textContent = 'Publicando…';
  try {
    // Relê o que está publicado AGORA (com o token, sem cache). Qualquer falha aqui aborta: nunca
    // gravar às cegas, para não apagar meses nem trocar a senha da família por engano.
    const remoto = await lerRemoto({ ...repo, token });
    let senha = estado.senhaFamilia;
    let lembrar = false;
    if (!senha) {
      const resposta = await pedirSenhaFamilia({ criar: !remoto });
      if (!resposta) return;
      ({ senha, lembrar } = resposta);
    }
    let dadosRemotos = null;
    if (remoto) {
      try { dadosRemotos = await destrancar(remoto.cofre, senha); } catch { avisar('Senha da família incorreta.', { erro: true }); return; }
    }
    estado.senhaFamilia = senha;
    if (lembrar) guardar.gravar('senhaFamilia', senha);
    if (dadosRemotos) mesclar(estado, dadosRemotos);
    const cofre = await trancar(paraCofre(estado), senha);
    await publicar({ ...repo, token, cofre, sha: remoto?.sha });
    cofreRemoto = cofre;
    situacaoRemoto = 'ok';
    marcarPublicado(estado);
    render();
    avisar('Publicado. Sua esposa já vê os dados novos ao abrir o link.');
  } catch (e) {
    avisar(e instanceof PublicarError ? e.message : `Não consegui publicar: ${e.message}`, { erro: true, ms: 10000 });
  } finally {
    botao.disabled = false;
    botao.textContent = 'Publicar para a família';
  }
}

// ---------- Configurações ----------
function abrirConfig() {
  const repo = configRepo();
  $('in-token').value = guardar.ler('token') ?? '';
  $('in-dono').value = repo?.dono ?? '';
  $('in-repo').value = repo?.repo ?? '';
  const noPages = !!repoDaUrl(location.href);
  $('in-dono').disabled = noPages;
  $('in-repo').disabled = noPages;
  $('dlg-config').showModal();
}

function salvarConfig() {
  guardar.gravar('token', $('in-token').value.trim() || null);
  if (!repoDaUrl(location.href)) {
    guardar.gravar('dono', $('in-dono').value.trim() || null);
    guardar.gravar('repo', $('in-repo').value.trim() || null);
  }
  $('dlg-config').close();
  avisar('Configurações salvas neste aparelho.');
}

// ---------- Eventos ----------
function ligarEventos() {
  $('btn-subir').addEventListener('click', () => abrirSubir());
  $('btn-ler').addEventListener('click', lerFatura);
  $('form-subir').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'in-senha-pdf') { e.preventDefault(); lerFatura(); } });
  $('btn-publicar').addEventListener('click', publicarAgora);
  $('btn-config').addEventListener('click', abrirConfig);
  $('btn-config-ok').addEventListener('click', salvarConfig);
  $('btn-esquecer').addEventListener('click', () => {
    guardar.gravar('token', null);
    guardar.gravar('senhaFamilia', null);
    $('in-token').value = '';
    avisar('Senha e token apagados deste aparelho.');
  });
  $('f-fatura').addEventListener('change', e => { estado.faturaId = e.target.value; estado.pessoa = 'todos'; estado.cartao = 'todos'; render(); });
  $('f-cartao').addEventListener('change', e => { estado.cartao = e.target.value; render(); });
  $('abas').addEventListener('click', e => {
    const b = e.target.closest('button[data-aba]');
    if (!b) return;
    estado.aba = b.dataset.aba;
    render();
    $('conteudo').focus({ preventScroll: true });
  });
  addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('arrastando'); });
  addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('arrastando'); });
  addEventListener('drop', e => {
    e.preventDefault();
    document.body.classList.remove('arrastando');
    const arquivo = [...e.dataTransfer.files].find(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (arquivo) abrirSubir(arquivo);
    else avisar('Solte um arquivo PDF da fatura.', { erro: true });
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
}

async function iniciar() {
  ligarEventos();
  try {
    cofreRemoto = await baixarCofre({ repo: repoDaUrl(location.href) });
    situacaoRemoto = cofreRemoto ? 'ok' : 'vazio';
  } catch (e) {
    situacaoRemoto = 'erro';
    erroRemoto = e.message;
  }
  const lembrada = guardar.ler('senhaFamilia');
  if (cofreRemoto && lembrada) {
    try { await abrirCofre(lembrada); } catch { guardar.gravar('senhaFamilia', null); }
  }
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
