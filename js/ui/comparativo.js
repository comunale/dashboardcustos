import * as C from '../comparativo.js';
import { filtrar } from '../analysis.js';
import { moeda, moedaCurta, mesCurto, mesLongo, dataCurta } from '../format.js';
import { h, secao, tabela, vazio } from './dom.js';
import { graficoBarras, cores } from './graficos.js';

// Variação com seta e sinal escritos (nunca só cor). Para gastos, subir é ruim.
const variacao = v => h('span', { class: v > 0 ? 'sobe' : v < 0 ? 'desce' : null }, v > 0 ? `↑ +${moeda(v)}` : v < 0 ? `↓ −${moeda(-v)}` : '=');
const plural = (n, um, varios) => (n === 1 ? um : varios(n));
const pctTexto = p => (p == null ? 'novo' : `${p > 0 ? '+' : ''}${Math.round(p * 100)}%`);

function tabelaComparada(linhas, rotulos, vazioMsg) {
  return tabela({
    colunas: [
      { titulo: rotulos.nome, valor: x => x.nome },
      { titulo: mesCurto(rotulos.anterior), valor: x => x.anterior, mostrar: x => moeda(x.anterior), numero: true },
      { titulo: mesCurto(rotulos.atual), valor: x => x.atual, mostrar: x => moeda(x.atual), numero: true },
      { titulo: 'Diferença', valor: x => x.diferenca, mostrar: x => variacao(x.diferenca), numero: true },
      { titulo: '%', valor: x => x.pct ?? Infinity, mostrar: x => pctTexto(x.pct), numero: true },
    ],
    linhas, ordenarPor: null, vazio: vazioMsg,
  });
}

const listaParcelas = (lista, vazioMsg) => tabela({
  colunas: [
    { titulo: 'Loja', valor: p => p.descricao },
    { titulo: 'Quem', valor: p => p.pessoa, mostrar: p => `${p.pessoa} ${p.cartao}` },
    { titulo: 'Compra', valor: p => p.data, mostrar: p => dataCurta(p.data) },
    { titulo: 'Parcela', valor: p => p.parcelaTotal, mostrar: p => `${p.parcelaAtual} de ${p.parcelaTotal}`, numero: true },
    { titulo: 'Por mês', valor: p => p.valor, mostrar: p => moeda(p.valor), numero: true },
  ],
  linhas: lista, ordenarPor: null, vazio: vazioMsg,
});

export function render(main, { estado, fatura, faturas, lancs, todos }) {
  const anterior = C.faturaAnterior(faturas, fatura.id);
  if (!anterior) {
    main.append(secao('Comparativo', null, vazio(`Para comparar, suba e publique a fatura do mês anterior a ${mesLongo(fatura.id)}. Hoje só há: ${faturas.map(f => mesCurto(f.id)).join(', ')}.`)));
    return;
  }
  const filtro = ls => filtrar(ls, { pessoa: estado.pessoa, cartao: estado.cartao });
  const lancsAnt = filtro(anterior.lancamentos);
  const rotulos = { anterior: anterior.id, atual: fatura.id };

  // 1. Bola de neve
  const p = C.compararParcelas(anterior, fatura, lancsAnt, lancs);
  const ev = C.evolucaoParcelas(faturas, filtro, todos);
  const canvas = h('canvas', { role: 'img', 'aria-label': 'Total ainda a pagar em parcelas futuras em cada fatura' });
  const sentido = p.variacaoPorMes > 0 ? `A bola de neve cresceu ${moeda(p.variacaoPorMes)} por mês.`
    : p.variacaoPorMes < 0 ? `A bola de neve diminuiu ${moeda(-p.variacaoPorMes)} por mês.` : 'A bola de neve ficou do mesmo tamanho.';
  main.append(secao(`Bola de neve: ${mesCurto(anterior.id)} → ${mesCurto(fatura.id)}`,
    null,
    h('p', { class: 'destaque' }, `${plural(p.sairam.lista.length, 'Saiu 1 parcela', n => `Saíram ${n} parcelas`)} (−${moeda(p.sairam.porMes)}/mês) e ${plural(p.entraram.lista.length, 'entrou 1 parcelada nova', n => `entraram ${n} parceladas novas`)} (+${moeda(p.entraram.porMes)}/mês). ${sentido}`),
    h('div', { class: 'grafico' }, canvas),
    h('details', { class: 'mais' }, h('summary', {}, `Parcelas que saíram (${p.sairam.lista.length})`), listaParcelas(p.sairam.lista, 'Nenhuma parcela terminou.')),
    h('details', { class: 'mais' }, h('summary', {}, `Parceladas novas (${p.entraram.lista.length})`), listaParcelas(p.entraram.lista, 'Nenhuma compra parcelada nova.'))));
  graficoBarras(canvas, {
    rotulos: ev.map(e => mesCurto(e.id)),
    series: [{ nome: 'Ainda a pagar em parcelas', valores: ev.map(e => e.comprometido), cor: cores().s1 }],
    formatar: moeda, formatarEixo: moedaCurta,
  });

  // 2. Categoria e pessoa
  main.append(h('div', { class: 'grade-2' },
    secao('Categorias', 'O que mais subiu aparece primeiro.', tabelaComparada(C.compararCategorias(lancsAnt, lancs), { ...rotulos, nome: 'Categoria' }, 'Sem compras nos dois meses.')),
    secao('Pessoas', null, tabelaComparada(C.compararPessoas(lancsAnt, lancs), { ...rotulos, nome: 'Pessoa' }, 'Sem compras nos dois meses.'))));

  // 3. Lugares, assinaturas e marketplaces
  const lug = C.compararLugares(lancsAnt, lancs);
  const tabelaLugares = (lista, msg) => tabela({
    colunas: [
      { titulo: 'Lugar', valor: l => l.nome },
      { titulo: 'Categoria', valor: l => l.categoria },
      { titulo: 'Vezes', valor: l => l.qtd, numero: true },
      { titulo: 'Total', valor: l => l.total, mostrar: l => moeda(l.total), numero: true },
    ],
    linhas: lista, ordenarPor: null, vazio: msg,
  });
  main.append(h('div', { class: 'grade-2' },
    secao(`Lugares novos em ${mesCurto(fatura.id)}`, 'Compras à vista onde vocês não tinham comprado no mês anterior.', tabelaLugares(lug.novos.slice(0, 30), 'Nenhum lugar novo.')),
    secao(`Lugares que sumiram`, `Apareciam em ${mesCurto(anterior.id)} e não aparecem agora.`, tabelaLugares(lug.sumiram.slice(0, 30), 'Nenhum lugar sumiu.'))));

  const ass = C.compararAssinaturas(lancsAnt, lancs);
  const itensAss = [
    ...ass.novas.map(a => ({ nome: a.nome, situacao: 'nova', valor: a.total })),
    ...ass.canceladas.map(a => ({ nome: a.nome, situacao: 'não cobrada', valor: -a.total })),
    ...ass.mudaram.map(a => ({ nome: a.nome, situacao: `mudou de ${moeda(a.anterior)} para ${moeda(a.atual)}`, valor: a.diferenca })),
  ];
  main.append(h('div', { class: 'grade-2' },
    secao('Assinaturas', 'Novas, que não foram cobradas este mês, ou que mudaram de valor.', tabela({
      colunas: [
        { titulo: 'Serviço', valor: a => a.nome },
        { titulo: 'O que mudou', valor: a => a.situacao },
        { titulo: 'Efeito no mês', valor: a => a.valor, mostrar: a => variacao(a.valor), numero: true },
      ],
      linhas: itensAss, ordenarPor: null, vazio: 'As assinaturas não mudaram.',
    })),
    secao('Marketplaces', null, tabelaComparada(C.compararMarketplaces(lancsAnt, lancs), { ...rotulos, nome: 'Plataforma' }, 'Sem marketplaces nos dois meses.'))));
}
