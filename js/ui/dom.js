// Ajudantes de DOM: criar elementos, tabelas ordenáveis e blocos.
export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f instanceof Node ? f : String(f));
  return el;
}

export const vazio = texto => h('p', { class: 'vazio' }, texto);
export const secao = (titulo, ajuda, ...filhos) => h('section', { class: 'bloco' }, h('h2', {}, titulo), ajuda ? h('p', { class: 'ajuda' }, ajuda) : null, ...filhos);

export function tabela({ colunas, linhas, ordenarPor = null, desc = true, vazio: msgVazio = 'Nada por aqui.' }) {
  if (!linhas.length) return vazio(msgVazio);
  let col = ordenarPor;
  let decrescente = desc;
  const corpo = h('tbody');
  const cabecalhos = colunas.map((c, i) => h('th', { class: c.numero ? 'num' : null, scope: 'col', 'aria-sort': 'none' },
    h('button', { type: 'button', onclick: () => { decrescente = col === i ? !decrescente : true; col = i; desenhar(); } }, c.titulo)));
  function desenhar() {
    const ls = [...linhas];
    if (col != null) {
      const v = colunas[col].valor;
      ls.sort((a, b) => { const x = v(a), y = v(b); const r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR'); return decrescente ? -r : r; });
    }
    cabecalhos.forEach((th, i) => th.setAttribute('aria-sort', i === col ? (decrescente ? 'descending' : 'ascending') : 'none'));
    corpo.replaceChildren(...ls.map(l => h('tr', {}, colunas.map(c => h('td', { class: c.numero ? 'num' : null }, c.mostrar ? c.mostrar(l) : c.valor(l))))));
  }
  desenhar();
  return h('div', { class: 'tabela-rolagem' }, h('table', {}, h('thead', {}, h('tr', {}, cabecalhos)), corpo));
}

export function listaBarras(itens, { formatar }) {
  if (!itens.length) return vazio('Nenhuma compra neste filtro.');
  const max = Math.max(...itens.map(i => i.valor));
  return h('div', { class: 'barra-lista' }, itens.map(i => h('div', { class: 'barra-linha' },
    h('span', {}, i.nome),
    h('span', { class: 'trilho', 'aria-hidden': 'true' }, h('span', { class: 'cheio', style: `width:${Math.max(2, (i.valor / max) * 100)}%` })),
    h('span', { class: 'v' }, formatar(i.valor)))));
}
