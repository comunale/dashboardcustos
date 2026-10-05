import * as A from '../analysis.js';
import { moeda, dataCurta } from '../format.js';
import { h, secao, tabela, listaBarras, vazio } from './dom.js';

export function render(main, { lancs }) {
  const ms = A.marketplaces(lancs);
  const total = A.somar(ms, m => m.total);
  const todas = A.somar(A.compras(lancs));
  if (!ms.length) { main.append(secao('Marketplaces', null, vazio('Nenhuma compra em marketplace neste filtro.'))); return; }
  main.append(secao('Marketplaces',
    `${ms.reduce((a, m) => a + m.qtd, 0)} compras em marketplaces somam ${moeda(total)} nesta fatura${todas ? `, ${Math.round((total / todas) * 100)}% de tudo o que foi comprado` : ''}.`,
    listaBarras(ms.map(m => ({ nome: m.nome, valor: m.total })), { formatar: moeda })));

  main.append(secao('Por plataforma', 'Parcelado = só a parcela que caiu nesta fatura.', tabela({
    colunas: [
      { titulo: 'Plataforma', valor: m => m.nome },
      { titulo: 'Compras', valor: m => m.qtd, numero: true },
      { titulo: 'À vista', valor: m => m.avista, mostrar: m => moeda(m.avista), numero: true },
      { titulo: 'Parcelado', valor: m => m.parcelado, mostrar: m => moeda(m.parcelado), numero: true },
      { titulo: 'Total', valor: m => m.total, mostrar: m => moeda(m.total), numero: true },
      { titulo: 'Quem', valor: m => Object.keys(m.porPessoa).join(), mostrar: m => Object.entries(m.porPessoa).sort((a, b) => b[1] - a[1]).map(([p, v]) => `${p} ${moeda(v)}`).join(', ') },
    ],
    linhas: ms, ordenarPor: 4, vazio: '',
  })));

  for (const m of ms) {
    main.append(h('details', { class: 'bloco mais' }, h('summary', {}, `${m.nome}: ${m.qtd} compras`), tabela({
      colunas: [
        { titulo: 'Data', valor: l => l.data, mostrar: l => dataCurta(l.data) },
        { titulo: 'Descrição', valor: l => l.descricao },
        { titulo: 'Quem', valor: l => l.pessoa },
        { titulo: 'Parcela', valor: l => l.parcelaAtual ?? 0, mostrar: l => (A.ehParcelada(l) ? `${l.parcelaAtual} de ${l.parcelaTotal}` : 'à vista') },
        { titulo: 'Valor', valor: l => l.valor, mostrar: l => moeda(l.valor), numero: true },
      ],
      linhas: m.lancamentos, ordenarPor: 4, vazio: '',
    })));
  }
}
