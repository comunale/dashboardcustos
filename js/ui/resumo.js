import * as A from '../analysis.js';
import { moeda, moedaCurta, mesCurto, mesLongo, pct } from '../format.js';
import { h, secao, listaBarras, vazio } from './dom.js';
import { graficoBarras, cores } from './graficos.js';

export function render(main, { fatura, faturas, lancs, todos }) {
  const r = A.resumoFatura(fatura, lancs);
  const bola = A.bolaDeNeve(fatura, lancs);
  const c = cores();
  const res = fatura.resumo;
  // Com o filtro "Todos", o valor oficial é o do banco; com filtro, o calculado por compra.
  const comprometido = todos && res.obrigacoesFuturas != null ? res.obrigacoesFuturas : r.comprometidoFuturo;

  // 1º: o valor desta fatura (é o número que se procura primeiro)
  main.append(h('section', { class: 'bloco' }, h('h2', {}, `Fatura de ${mesLongo(fatura.id)}`), h('div', { class: 'numeros' },
    todos
      ? numero(moeda(fatura.total), `total a pagar, vence ${fatura.vencimento.split('-').reverse().join('/')}`, true)
      : numero(moeda(r.compras), 'em compras neste filtro', true),
    numero(String(r.qtdCompras), 'compras e parcelas nesta fatura'),
    numero(moeda(r.parceladoNestaFatura), 'só de parcelas nesta fatura'),
    todos && r.usoLimite != null ? numero(pct(r.usoLimite), `do limite usado (${moeda(fatura.limiteDisponivel)} livres)`) : null),
    todos ? h('p', { class: fatura.conferencia.ok ? 'conferido' : 'erro' }, fatura.conferencia.ok ? 'Totais conferidos com a fatura do banco.' : 'Os totais não bateram com o banco.') : null));

  // Alerta de juros (só faz sentido para a fatura inteira). Só fala em rotativo quando houve juros de rotativo.
  if (todos && r.jurosEncargos > 0) {
    main.append(h('div', { class: 'alerta', role: 'note' }, h('span', { class: 'icone', 'aria-hidden': 'true' }, '!'),
      h('p', {}, h('strong', {}, `Esta fatura cobrou ${moeda(r.jurosEncargos)} de juros e IOF. `),
        res.jurosRotativo > 0
          ? `A fatura anterior (${moeda(res.saldoAnterior)}) não foi paga inteira: entraram ${moeda(res.pagamentos)}. O que sobra vai para o rotativo, com juros de mais de 15% ao mês.`
          : 'Confira na fatura do banco de onde vieram esses encargos.')));
  }

  // Parcelas futuras: deixa explícito que NÃO é o valor desta fatura
  const canvasBola = h('canvas', { role: 'img', 'aria-label': 'Parcelas que caem em cada um dos próximos 12 meses' });
  main.append(h('section', { class: 'bloco manchete' }, h('h2', {}, 'Parcelas futuras'),
    h('p', { class: 'frase' }, h('span', { class: 'numero' }, moeda(comprometido)), 'ainda a pagar em parcelas nas próximas faturas.'),
    h('p', { class: 'apoio' }, `Não é o valor desta fatura: é a soma das parcelas que ainda vão cair nos próximos meses. `
      + (r.proximaFatura > 0 ? `A fatura de ${mesLongo(bola[0].mes)} já começa com ${moeda(r.proximaFatura)} só de parcelas.` : 'Neste filtro, nenhuma parcela cai nos próximos meses.')),
    h('div', { class: 'grafico' }, canvasBola)));
  graficoBarras(canvasBola, { rotulos: bola.map(b => mesCurto(b.mes)), series: [{ nome: 'Parcelas', valores: bola.map(b => b.valor), cor: c.s1 }], formatar: moeda, formatarEixo: moedaCurta });

  // Por pessoa/cartão e por categoria
  const cartoes = A.porCartao(fatura, lancs).map(x => ({ nome: `${x.pessoa} final ${x.final}${x.virtual ? ' (virtual)' : ''}`, valor: x.total }));
  const categorias = A.porCategoria(lancs).map(x => ({ nome: x.nome, valor: x.total }));
  main.append(h('div', { class: 'grade-2' },
    secao('Quem gastou', 'Compras desta fatura por cartão.', listaBarras(cartoes, { formatar: moeda })),
    secao('Em quê', 'Categorias definidas pelo nome da loja.', listaBarras(categorias, { formatar: moeda }))));

  // Histórico: fatura x pagamento
  const hist = historico(faturas, fatura.id);
  if (hist.length >= 2) {
    const canvas = h('canvas', { role: 'img', 'aria-label': 'Valor de cada fatura e quanto foi pago' });
    main.append(secao('Mês a mês', 'Valor de cada fatura e quanto foi pago. Quando o pagamento fica abaixo da fatura, a diferença vira rotativo com juros.', h('div', { class: 'grafico alto' }, canvas)));
    graficoBarras(canvas, {
      rotulos: hist.map(x => mesCurto(x.id)),
      series: [{ nome: 'Fatura', valores: hist.map(x => x.valor), cor: c.s1 }, { nome: 'Pago', valores: hist.map(x => x.pago), cor: c.s2 }],
      formatar: v => (v == null ? 'ainda não pago' : moeda(v)), formatarEixo: moedaCurta,
    });
  } else {
    main.append(secao('Mês a mês', null, vazio('Aparece quando houver mais de um mês de histórico.')));
  }
}

const numero = (valor, rotulo, principal = false) => h('div', { class: principal ? 'numero-item principal' : 'numero-item' }, h('div', { class: 'valor' }, valor), h('div', { class: 'rotulo' }, rotulo));

// Junta o histórico impresso em todas as faturas carregadas, sem a fatura aberta (futura).
function historico(faturas, ateId) {
  const m = new Map();
  for (const f of [...faturas].sort((a, b) => a.id.localeCompare(b.id))) for (const x of f.historico ?? []) if (x.id <= ateId && x.valor != null) m.set(x.id, x);
  return [...m.values()].sort((a, b) => a.id.localeCompare(b.id)).slice(-12);
}
