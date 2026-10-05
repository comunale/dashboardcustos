import * as A from '../analysis.js';
import { moeda, mesCurto } from '../format.js';
import { secao, tabela, vazio } from './dom.js';

export function render(main, { estado, fatura, faturas, lancs }) {
  const rep = A.repetitivas(lancs);
  main.append(secao('Repetitivas', `Lugares com 3 ou mais compras à vista nesta fatura. ${rep.length ? `Juntos somam ${moeda(A.somar(rep, r => r.total))}.` : ''}`, tabela({
    colunas: [
      { titulo: 'Lugar', valor: r => r.nome },
      { titulo: 'Categoria', valor: r => r.categoria },
      { titulo: 'Vezes', valor: r => r.qtd, numero: true },
      { titulo: 'Total', valor: r => r.total, mostrar: r => moeda(r.total), numero: true },
      { titulo: 'Média por compra', valor: r => r.total / r.qtd, mostrar: r => moeda(r.total / r.qtd), numero: true },
    ],
    linhas: rep, ordenarPor: 3, vazio: 'Nenhum lugar com 3 ou mais compras neste filtro.',
  })));

  const ass = A.assinaturas(lancs);
  main.append(secao('Assinaturas', ass.length ? `${moeda(A.somar(ass, a => a.total))} por mês em serviços recorrentes.` : null, tabela({
    colunas: [
      { titulo: 'Serviço', valor: a => a.nome },
      { titulo: 'Cobranças', valor: a => a.qtd, numero: true },
      { titulo: 'Total no mês', valor: a => a.total, mostrar: a => moeda(a.total), numero: true },
    ],
    linhas: ass, ordenarPor: 2, vazio: 'Nenhuma assinatura conhecida neste filtro.',
  })));

  const filtro = ls => A.filtrar(ls, { pessoa: estado.pessoa, cartao: estado.cartao });
  const hab = A.habituais(faturas, fatura.id, filtro);
  main.append(secao('Habituais', 'Lugares onde vocês compram mês após mês (presentes em pelo menos 2 das últimas 3 faturas).',
    hab.disponivel
      ? tabela({
        colunas: [
          { titulo: 'Lugar', valor: x => x.nome },
          { titulo: 'Categoria', valor: x => x.categoria },
          { titulo: 'Meses', valor: x => x.meses, mostrar: x => `${x.meses} de ${hab.faturas.length}`, numero: true },
          { titulo: 'Média por mês', valor: x => x.mediaMensal, mostrar: x => moeda(x.mediaMensal), numero: true },
        ],
        linhas: hab.itens, ordenarPor: 3, vazio: 'Nenhum lugar se repetiu entre os meses neste filtro.',
      })
      : vazio(`Aparece a partir da 2ª fatura. Por enquanto só há ${hab.faturas.map(mesCurto).join(', ') || 'nenhuma'}.`)));
}
