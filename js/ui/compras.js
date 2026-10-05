import * as A from '../analysis.js';
import { moeda, dataCurta } from '../format.js';
import { classificar } from '../classify.js';
import { h, secao, tabela } from './dom.js';

export function render(main, { fatura, lancs }) {
  const categorias = [...new Set(lancs.map(l => classificar(l).categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const busca = h('input', { type: 'search', placeholder: 'Buscar loja', 'aria-label': 'Buscar loja' });
  const cat = h('select', { 'aria-label': 'Categoria' }, h('option', { value: '' }, 'Todas as categorias'), categorias.map(c => h('option', { value: c }, c)));
  const tipo = h('select', { 'aria-label': 'Tipo' },
    h('option', { value: '' }, 'Compras e créditos'), h('option', { value: 'avista' }, 'Só à vista'),
    h('option', { value: 'parcelada' }, 'Só parceladas'), h('option', { value: 'credito' }, 'Só pagamentos e créditos'));
  const baixar = h('button', { type: 'button', class: 'botao' }, 'Baixar planilha (Excel)');
  const area = h('div');
  const resumo = h('p', { class: 'ajuda' });

  const filtrados = () => lancs.filter(l => {
    const t = busca.value.trim().toUpperCase();
    if (t && !l.descricao.toUpperCase().includes(t)) return false;
    if (cat.value && classificar(l).categoria !== cat.value) return false;
    if (tipo.value === 'avista') return l.valor > 0 && !A.ehParcelada(l);
    if (tipo.value === 'parcelada') return A.ehParcelada(l);
    if (tipo.value === 'credito') return l.valor < 0;
    return true;
  });

  function desenhar() {
    const ls = filtrados();
    const creditos = ls.filter(l => l.valor < 0);
    resumo.textContent = `${ls.length} lançamentos: ${moeda(A.somar(A.compras(ls)))} em compras`
      + (creditos.length ? ` e ${moeda(-A.somar(creditos))} em pagamentos e créditos.` : '.');
    area.replaceChildren(tabela({
      colunas: [
        { titulo: 'Data', valor: l => l.data, mostrar: l => dataCurta(l.data) },
        { titulo: 'Descrição', valor: l => l.descricao },
        { titulo: 'Quem', valor: l => l.pessoa, mostrar: l => `${l.pessoa} ${l.cartao}` },
        { titulo: 'Categoria', valor: l => classificar(l).categoria, mostrar: l => h('span', { class: 'etiqueta' }, classificar(l).categoria) },
        { titulo: 'Parcela', valor: l => l.parcelaAtual ?? 0, mostrar: l => (A.ehParcelada(l) ? `${l.parcelaAtual} de ${l.parcelaTotal}` : '') },
        { titulo: 'Valor', valor: l => l.valor, mostrar: l => moeda(l.valor), numero: true },
      ],
      linhas: ls, ordenarPor: 0, desc: false, vazio: 'Nenhum lançamento com esses filtros.',
    }));
  }
  for (const el of [busca, cat, tipo]) el.addEventListener('input', desenhar);
  baixar.addEventListener('click', () => exportar(fatura, filtrados()));
  desenhar();
  main.append(secao('Todas as compras', null, h('div', { class: 'busca' }, busca, cat, tipo, baixar), resumo, area));
}

function exportar(fatura, ls) {
  if (!window.XLSX) return;
  const linhas = ls.map(l => ({
    Data: l.data.split('-').reverse().join('/'), Descrição: l.descricao, Pessoa: l.pessoa, Cartão: l.cartao,
    Categoria: classificar(l).categoria, Marketplace: classificar(l).marketplace ?? '',
    Parcela: A.ehParcelada(l) ? `${l.parcelaAtual}/${l.parcelaTotal}` : '', 'Faltam': A.ehParcelada(l) ? l.parcelaTotal - l.parcelaAtual : '',
    Valor: l.valor,
  }));
  const ps = A.parceladas(fatura, ls).map(p => ({
    Loja: p.descricao, Pessoa: p.pessoa, Cartão: p.cartao, Parcela: `${p.parcelaAtual}/${p.parcelaTotal}`,
    'Valor da parcela': p.valor, Faltam: p.restantes, 'Ainda a pagar': p.saldoRestante, 'Termina em': p.terminaEm,
  }));
  const cats = A.porCategoria(ls).map(c => ({ Categoria: c.nome, Compras: c.qtd, Total: c.total }));
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(linhas), 'Lançamentos');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(ps), 'Parceladas');
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(cats), 'Categorias');
  window.XLSX.writeFile(wb, `fatura-${fatura.id}.xlsx`);
}
