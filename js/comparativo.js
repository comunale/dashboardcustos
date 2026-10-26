// Comparações entre a fatura escolhida e a anterior. Funções puras: nada de DOM aqui.
import { parceladas, compras, ehParcelada, somar, porCategoria, assinaturas, marketplaces } from './analysis.js';
import { classificar } from './classify.js';

const arred = n => Math.round(n * 100) / 100;

export function faturaAnterior(faturas, id) {
  return [...faturas].filter(f => f.id < id).sort((a, b) => b.id.localeCompare(a.id))[0] ?? null;
}

// A mesma compra parcelada em meses diferentes: cartão + dia/mês da compra + loja + total de parcelas.
// O ano fica de fora de propósito: a fatura não traz o ano e compras de 12+ meses podem ser datadas diferente.
const chaveParcela = p => `${p.cartao}|${p.data.slice(5)}|${p.descricao}|${p.parcelaTotal}`;

export function compararParcelas(anterior, atual, lancsAnt, lancsAtu) {
  const pa = parceladas(anterior, lancsAnt);
  const pb = parceladas(atual, lancsAtu);
  const chavesA = new Set(pa.map(chaveParcela));
  const chavesB = new Set(pb.map(chaveParcela));
  const sairam = pa.filter(p => !chavesB.has(chaveParcela(p))).sort((a, b) => b.valor - a.valor);
  const entraram = pb.filter(p => !chavesA.has(chaveParcela(p))).sort((a, b) => b.valor - a.valor);
  return {
    sairam: { lista: sairam, porMes: somar(sairam) },
    entraram: { lista: entraram, porMes: somar(entraram) },
    variacaoPorMes: arred(somar(entraram) - somar(sairam)),
  };
}

// Total comprometido em parcelas futuras em cada fatura. Com "Todos", o valor oficial do banco.
export function evolucaoParcelas(faturas, filtro, todos) {
  return [...faturas].sort((a, b) => a.id.localeCompare(b.id)).map(f => {
    const ps = parceladas(f, filtro(f.lancamentos));
    const calculado = somar(ps, p => p.saldoRestante);
    return { id: f.id, comprometido: todos && f.resumo?.obrigacoesFuturas != null ? f.resumo.obrigacoesFuturas : calculado, parcelado: somar(ps) };
  });
}

export function compararGrupos(anteriores, atuais) {
  const nomes = [...new Set([...anteriores, ...atuais].map(g => g.nome))];
  const total = (lista, nome) => lista.find(g => g.nome === nome)?.total ?? 0;
  return nomes.map(nome => {
    const anterior = total(anteriores, nome);
    const atual = total(atuais, nome);
    const diferenca = arred(atual - anterior);
    return { nome, anterior, atual, diferenca, pct: anterior ? Math.round((diferenca / anterior) * 1000) / 1000 : null };
  }).sort((a, b) => b.diferenca - a.diferenca);
}

const porPessoa = lancs => {
  const m = new Map();
  for (const l of compras(lancs)) m.set(l.pessoa, (m.get(l.pessoa) ?? 0) + l.valor);
  return [...m].map(([nome, total]) => ({ nome, total: arred(total) }));
};

export const compararCategorias = (lancsAnt, lancsAtu) => compararGrupos(porCategoria(lancsAnt), porCategoria(lancsAtu));
export const compararPessoas = (lancsAnt, lancsAtu) => compararGrupos(porPessoa(lancsAnt), porPessoa(lancsAtu));
export const compararMarketplaces = (lancsAnt, lancsAtu) => compararGrupos(marketplaces(lancsAnt), marketplaces(lancsAtu));

// Lugares de compra à vista (assinaturas e marketplaces têm seus próprios blocos).
function lugares(lancs) {
  const m = new Map();
  for (const l of compras(lancs).filter(l => !ehParcelada(l))) {
    const c = classificar(l);
    if (c.assinatura || c.marketplace) continue;
    const e = m.get(c.chave) ?? { chave: c.chave, nome: c.nomeLoja, categoria: c.categoria, qtd: 0, total: 0 };
    e.qtd += 1;
    e.total = arred(e.total + l.valor);
    m.set(c.chave, e);
  }
  return m;
}

export function compararLugares(lancsAnt, lancsAtu) {
  const a = lugares(lancsAnt);
  const b = lugares(lancsAtu);
  const porTotal = (x, y) => y.total - x.total;
  return {
    novos: [...b.values()].filter(l => !a.has(l.chave)).sort(porTotal),
    sumiram: [...a.values()].filter(l => !b.has(l.chave)).sort(porTotal),
  };
}

export function compararAssinaturas(lancsAnt, lancsAtu) {
  const a = new Map(assinaturas(lancsAnt).map(x => [x.nome, x]));
  const b = new Map(assinaturas(lancsAtu).map(x => [x.nome, x]));
  return {
    novas: [...b.values()].filter(x => !a.has(x.nome)),
    canceladas: [...a.values()].filter(x => !b.has(x.nome)),
    mudaram: [...b.values()].filter(x => a.has(x.nome) && Math.abs(x.total - a.get(x.nome).total) >= 0.01)
      .map(x => ({ nome: x.nome, anterior: a.get(x.nome).total, atual: x.total, diferenca: arred(x.total - a.get(x.nome).total) })),
  };
}
