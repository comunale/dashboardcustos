import * as A from '../analysis.js';
import { moeda, moedaCurta, mesCurto, dataCurta } from '../format.js';
import { h, secao, tabela } from './dom.js';
import { graficoBarras, cores } from './graficos.js';

export function render(main, { fatura, lancs, todos }) {
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

  main.append(secao('Todas as parceladas', 'Clique no título de uma coluna para ordenar.', tabela({
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
    linhas: ps, ordenarPor: 6, vazio: 'Nenhuma compra parcelada neste filtro.',
  })));
}
