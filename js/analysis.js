// Análises sobre os lançamentos de uma fatura. Funções puras: nada de DOM aqui.
import { classificar } from './classify.js';

const arred = n => Math.round(n * 100) / 100;
export const somar = (lista, f = l => l.valor) => arred(lista.reduce((a, l) => a + f(l), 0));
export const compras = lancs => lancs.filter(l => l.valor > 0);
export const ehParcelada = l => l.parcelaTotal != null && l.parcelaTotal > 1;

export function addMeses(id, n) {
  const total = Number(id.slice(0, 4)) * 12 + Number(id.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function filtrar(lancs, { pessoa = 'todos', cartao = 'todos' } = {}) {
  return lancs.filter(l => (pessoa === 'todos' || l.pessoa === pessoa) && (cartao === 'todos' || l.cartao === cartao));
}

function agrupar(lista, chaveDe) {
  const m = new Map();
  for (const item of lista) {
    const k = chaveDe(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

export function parceladas(fatura, lancs) {
  return compras(lancs).filter(ehParcelada).map(l => {
    const restantes = l.parcelaTotal - l.parcelaAtual;
    return { ...l, restantes, saldoRestante: arred(l.valor * restantes), valorCompra: arred(l.valor * l.parcelaTotal), terminaEm: addMeses(fatura.id, restantes) };
  }).sort((a, b) => b.saldoRestante - a.saldoRestante);
}

export function bolaDeNeve(fatura, lancs, meses = 12) {
  const ps = parceladas(fatura, lancs);
  return Array.from({ length: meses }, (_, i) => ({ mes: addMeses(fatura.id, i + 1), valor: somar(ps.filter(p => p.restantes >= i + 1)) }));
}

export function repetitivas(lancs, minimo = 3) {
  const grupos = agrupar(compras(lancs).filter(l => !ehParcelada(l)), l => classificar(l).chave);
  return [...grupos.values()].filter(g => g.length >= minimo).map(g => {
    const c = classificar(g[0]);
    return { chave: c.chave, nome: c.nomeLoja, categoria: c.categoria, qtd: g.length, total: somar(g), lancamentos: g };
  }).sort((a, b) => b.total - a.total);
}

export function assinaturas(lancs) {
  const grupos = agrupar(compras(lancs).filter(l => classificar(l).assinatura), l => classificar(l).assinatura);
  return [...grupos].map(([nome, g]) => ({ nome, qtd: g.length, total: somar(g), lancamentos: g })).sort((a, b) => b.total - a.total);
}

export function habituais(faturas, faturaId, filtro = ls => ls) {
  const ids = faturas.map(f => f.id).filter(id => id <= faturaId).sort().slice(-3);
  if (ids.length < 2) return { disponivel: false, faturas: ids, itens: [] };
  const presenca = new Map();
  for (const id of ids) {
    const f = faturas.find(x => x.id === id);
    for (const l of compras(filtro(f.lancamentos)).filter(l => !ehParcelada(l))) {
      const c = classificar(l);
      const e = presenca.get(c.chave) ?? { chave: c.chave, nome: c.nomeLoja, categoria: c.categoria, meses: new Set(), total: 0 };
      e.meses.add(id);
      e.total += l.valor;
      presenca.set(c.chave, e);
    }
  }
  const itens = [...presenca.values()].filter(e => e.meses.size >= 2)
    .map(e => ({ chave: e.chave, nome: e.nome, categoria: e.categoria, meses: e.meses.size, mediaMensal: arred(e.total / ids.length) }))
    .sort((a, b) => b.mediaMensal - a.mediaMensal);
  return { disponivel: true, faturas: ids, itens };
}

export function valoresAltos(lancs, limite = 300) {
  return compras(lancs)
    .map(l => ({ ...l, valorCompra: ehParcelada(l) ? arred(l.valor * l.parcelaTotal) : l.valor }))
    .filter(l => l.valorCompra >= limite)
    .sort((a, b) => b.valorCompra - a.valorCompra);
}

export function marketplaces(lancs) {
  const m = new Map();
  for (const l of compras(lancs)) {
    const nome = classificar(l).marketplace;
    if (!nome) continue;
    const e = m.get(nome) ?? { nome, qtd: 0, total: 0, avista: 0, parcelado: 0, porPessoa: {}, lancamentos: [] };
    e.qtd += 1;
    e.total += l.valor;
    if (ehParcelada(l)) e.parcelado += l.valor; else e.avista += l.valor;
    e.porPessoa[l.pessoa] = arred((e.porPessoa[l.pessoa] ?? 0) + l.valor);
    e.lancamentos.push(l);
    m.set(nome, e);
  }
  return [...m.values()].map(e => ({ ...e, total: arred(e.total), avista: arred(e.avista), parcelado: arred(e.parcelado) }))
    .sort((a, b) => b.total - a.total);
}

export function porCategoria(lancs) {
  return [...agrupar(compras(lancs), l => classificar(l).categoria)]
    .map(([nome, g]) => ({ nome, total: somar(g), qtd: g.length }))
    .sort((a, b) => b.total - a.total);
}

export function porCartao(fatura, lancs) {
  return fatura.cartoes.map(c => ({ final: c.final, pessoa: c.pessoa, virtual: c.virtual, titular: c.titular, total: somar(compras(lancs).filter(l => l.cartao === c.final)) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function resumoFatura(fatura, lancs) {
  const ps = parceladas(fatura, lancs);
  const cs = compras(lancs);
  return {
    compras: somar(cs),
    qtdCompras: cs.length,
    parceladoNestaFatura: somar(ps),
    comprometidoFuturo: somar(ps, p => p.saldoRestante),
    proximaFatura: somar(ps.filter(p => p.restantes >= 1)),
    jurosEncargos: arred((fatura.resumo.jurosRotativo ?? 0) + (fatura.resumo.iof ?? 0)),
    usoLimite: fatura.limite ? fatura.limiteUsado / fatura.limite : null,
  };
}
