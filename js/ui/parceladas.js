import * as A from '../analysis.js';
import { moeda, moedaCurta, mesCurto, mesLongo, dataCurta } from '../format.js';
import { h, secao, tabela } from './dom.js';
import { graficoBarras, cores } from './graficos.js';

const SITUACOES = [['todas', 'Todas'], ['acabando', 'Acabando'], ['recentes', 'Recentes'], ['longas', 'Longas']];
const FAIXAS = [['todas', 'Todas'], ['ate50', 'até R$ 50'], ['de50a200', 'R$ 50 a 200'], ['acima200', 'acima de R$ 200']];
const ORDENS = [['aPagar', 'Ainda a pagar'], ['valor', 'Valor da parcela'], ['termina', 'Termina primeiro'], ['recentes', 'Mais recentes'], ['loja', 'Loja (A-Z)']];

export function render(main, { estado, fatura, lancs, todos }) {
  const ps = A.parceladas(fatura, lancs);
  const bola = A.bolaDeNeve(fatura, lancs);
  const futuro = A.somar(ps, p => p.saldoRestante);
  const canvas = h('canvas', { role: 'img', 'aria-label': 'Total de parcelas em cada um dos próximos 12 meses' });
  const tabelaBola = tabela({
    colunas: [{ titulo: 'Mês', valor: b => b.mes, mostrar: b => mesCurto(b.mes) }, { titulo: 'Parcelas', valor: b => b.valor, mostrar: b => moeda(b.valor), numero: true }],
    linhas: bola, vazio: 'Sem parcelas futuras.',
  });
  main.append(secao('Bola de neve', `${ps.length} compras parceladas somam ${moeda(A.somar(ps))} nesta fatura e ainda faltam ${moeda(futuro)}.`
    + (todos && fatura.resumo.obrigacoesFuturas != null ? ` O banco informa ${moeda(fatura.resumo.obrigacoesFuturas)} em parcelas futuras.` : ''),
  h('div', { class: 'grafico alto' }, canvas),
  h('details', { class: 'mais' }, h('summary', {}, 'Ver em tabela'), tabelaBola)));
  graficoBarras(canvas, { rotulos: bola.map(b => mesCurto(b.mes)), series: [{ nome: 'Parcelas', valores: bola.map(b => b.valor), cor: cores().s1 }], formatar: moeda, formatarEixo: moedaCurta });

  // Filtros e ordenação: redesenham só a lista, para não perder o foco do campo de busca.
  const f = estado.parc;
  const resumo = h('p', { class: 'destaque' });
  const lista = h('div');
  const grupoChips = (rotulo, opcoes, campo) => {
    const botoes = opcoes.map(([valor, texto]) => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(f[campo] === valor),
      onclick: () => { f[campo] = valor; botoes.forEach((b, i) => b.setAttribute('aria-pressed', String(opcoes[i][0] === valor))); desenhar(); },
    }, texto));
    return h('div', { class: 'filtro-grupo' }, h('span', { class: 'filtro-rotulo' }, rotulo), h('div', { class: 'chips', role: 'group', 'aria-label': rotulo }, botoes));
  };
  const busca = h('input', { type: 'search', placeholder: 'Buscar loja', 'aria-label': 'Buscar loja', value: f.busca });
  busca.addEventListener('input', () => { f.busca = busca.value; desenhar(); });
  const ordem = h('select', { 'aria-label': 'Ordenar por' }, ORDENS.map(([valor, texto]) => h('option', { value: valor, selected: f.ordem === valor }, texto)));
  ordem.addEventListener('change', () => { f.ordem = ordem.value; desenhar(); });

  function desenhar() {
    const filtradas = A.ordenarParceladas(A.filtrarParceladas(ps, f), f.ordem);
    const r = A.resumoParceladas(filtradas);
    resumo.textContent = !r.qtd ? ''
      : f.situacao === 'acabando'
        ? `${r.qtd} parcelas acabando: ${moeda(r.porMes)} por mês que deixam de ser cobrados até ${mesLongo(r.ultimoMes)}.`
        : `${r.qtd} compras: ${moeda(r.porMes)} por mês nesta fatura e ainda faltam ${moeda(r.aPagar)}. A última termina em ${mesLongo(r.ultimoMes)}.`;
    lista.replaceChildren(tabela({
      colunas: [
        { titulo: 'Loja', valor: p => p.descricao },
        { titulo: 'Quem', valor: p => p.pessoa, mostrar: p => `${p.pessoa} ${p.cartao}` },
        { titulo: 'Compra', valor: p => p.data, mostrar: p => dataCurta(p.data) + (p.data.slice(0, 4) !== fatura.id.slice(0, 4) ? `/${p.data.slice(2, 4)}` : '') },
        { titulo: 'Parcela', valor: p => p.parcelaAtual / p.parcelaTotal, mostrar: p => `${p.parcelaAtual} de ${p.parcelaTotal}`, numero: true },
        { titulo: 'Valor da parcela', valor: p => p.valor, mostrar: p => moeda(p.valor), numero: true },
        { titulo: 'Faltam', valor: p => p.restantes, mostrar: p => (p.restantes === 0 ? 'última' : String(p.restantes)), numero: true },
        { titulo: 'Ainda a pagar', valor: p => p.saldoRestante, mostrar: p => moeda(p.saldoRestante), numero: true },
        { titulo: 'Termina', valor: p => p.terminaEm, mostrar: p => mesCurto(p.terminaEm), numero: true },
      ],
      linhas: filtradas, ordenarPor: null, vazio: 'Nenhuma parcelada com esses filtros.',
    }));
  }
  desenhar();

  main.append(secao('Todas as parceladas', 'Acabando: faltam 2 parcelas ou menos. Recentes: 1ª ou 2ª parcela. Longas: faltam 6 ou mais. O filtro de pessoa fica no topo da página.',
    h('div', { class: 'filtros-parc' },
      grupoChips('Situação', SITUACOES, 'situacao'),
      grupoChips('Valor da parcela', FAIXAS, 'faixa'),
      h('div', { class: 'busca' }, busca, h('label', { class: 'campo' }, 'Ordenar por', ordem))),
    resumo, lista));
}
