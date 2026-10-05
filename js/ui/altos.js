import * as A from '../analysis.js';
import { moeda, dataCurta } from '../format.js';
import { classificar } from '../classify.js';
import { h, secao, tabela } from './dom.js';

export function render(main, { estado, lancs, rerender }) {
  const altos = A.valoresAltos(lancs, estado.limiteAlto);
  const total = A.somar(A.compras(lancs));
  const nesta = A.somar(altos);
  const campo = h('input', { type: 'number', min: '0', step: '50', value: String(estado.limiteAlto), 'aria-label': 'Valor mínimo', style: 'width:110px' });
  campo.addEventListener('change', () => { const v = Number(campo.value); if (v >= 0) { estado.limiteAlto = v; rerender(); } });
  main.append(secao('Valores altos',
    `${altos.length} compras a partir do valor escolhido. Nesta fatura elas pesam ${moeda(nesta)}${total ? ` (${Math.round((nesta / total) * 100)}% das compras)` : ''}. Parceladas contam pelo valor total da compra.`,
    h('div', { class: 'busca' }, h('label', { class: 'campo' }, 'A partir de R$', campo)),
    tabela({
      colunas: [
        { titulo: 'Data', valor: l => l.data, mostrar: l => dataCurta(l.data) },
        { titulo: 'Loja', valor: l => l.descricao },
        { titulo: 'Quem', valor: l => l.pessoa, mostrar: l => `${l.pessoa} ${l.cartao}` },
        { titulo: 'Categoria', valor: l => classificar(l).categoria },
        { titulo: 'Como', valor: l => l.parcelaTotal ?? 1, mostrar: l => (A.ehParcelada(l) ? `${l.parcelaTotal}x de ${moeda(l.valor)}` : 'à vista') },
        { titulo: 'Valor da compra', valor: l => l.valorCompra, mostrar: l => moeda(l.valorCompra), numero: true },
      ],
      linhas: altos, ordenarPor: 5, vazio: 'Nenhuma compra a partir desse valor neste filtro.',
    })));
}
