// Leitor da fatura de cartão Santander (layout verificado na fatura de 09/2026).
// Entrada: itens posicionados de extrairItens(). Saída: fatura estruturada + conferência dos totais.

export class LayoutError extends Error {}

const DINHEIRO = /^-?(R\$\s?)?\d{1,3}(\.\d{3})*,\d{2}$/;
const DATA_COMPLETA = /^\d{2}\/\d{2}\/\d{4}$/;
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const DIVISA_COLUNA = 295;  // x a partir do qual o item pertence à coluna direita
const DESLOC_COLUNA = 293.8; // a coluna direita repete as posições da esquerda deslocadas

export const paraNumero = s => Number(s.replace(/R\$\s?/, '').replace(/\./g, '').replace(',', '.'));
const ehDinheiro = s => DINHEIRO.test(s);
const arred2 = n => Math.round(n * 100) / 100;
const dois = n => String(n).padStart(2, '0');
const primeiroNome = nome => {
  const p = nome.trim().split(/\s+/)[0].toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
};

export function agruparLinhas(itens, tolerancia = 1.5) {
  const linhas = [];
  for (const it of [...itens].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const ultima = linhas.at(-1);
    if (ultima && it.y - ultima.y < tolerancia) ultima.itens.push(it);
    else linhas.push({ y: it.y, itens: [it] });
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x);
  return linhas;
}

// Valor logo abaixo de um rótulo, na coluna mais próxima (cabeçalho da página 1).
function valorAbaixo(itens, rotulo, padrao = ehDinheiro) {
  const r = itens.find(i => i.s.startsWith(rotulo));
  if (!r) return null;
  const candidatos = itens.filter(i => i.y > r.y && i.y - r.y < 25 && padrao(i.s));
  candidatos.sort((a, b) => Math.abs(a.x - r.x) - Math.abs(b.x - r.x));
  return candidatos[0]?.s ?? null;
}

// Ano de uma data DD/MM: meses depois do mês de vencimento são do ano anterior.
const anoDe = (mes, venc) => (mes > venc.mes ? venc.ano - 1 : venc.ano);

function lerHistorico(p1, venc) {
  const out = [];
  for (const m of p1.filter(i => /^[A-Z]{3}\.$/.test(i.s) && MESES.includes(i.s.slice(0, 3)))) {
    const mes = MESES.indexOf(m.s.slice(0, 3)) + 1;
    const naLinha = p1.filter(i => Math.abs(i.y - m.y) <= 3.5 && ehDinheiro(i.s) && i.x > m.x);
    const maisPerto = lista => lista.sort((a, b) => Math.abs(a.y - m.y) - Math.abs(b.y - m.y))[0];
    const fatura = maisPerto(naLinha.filter(i => i.x < m.x + 100));
    const pago = maisPerto(naLinha.filter(i => i.x >= m.x + 100 && i.x < m.x + 200));
    let ano = venc.ano;
    if (mes - venc.mes > 1) ano -= 1;
    else if (venc.mes - mes > 10) ano += 1;
    out.push({ id: `${ano}-${dois(mes)}`, valor: fatura ? paraNumero(fatura.s) : null, pago: pago ? paraNumero(pago.s) : null });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

const ROTULOS_RESUMO = [
  ['saldoAnterior', /^Saldo Anterior/],
  ['jurosRotativo', /^\(\+\) Juros de Cr[eé]dito Rotativo/],
  ['iof', /^\(\+\) IOF/],
  ['despesasBrasil', /^\(\+\) Total Despesas\/D[eé]bitos no Brasil/],
  ['despesasExterior', /^\(\+\) Total Despesas\/D[eé]bitos no Exterior/],
  ['pagamentos', /^\(-\) Total de pagamentos/],
  ['creditos', /^\(-\) Total de cr[eé]ditos/],
  ['saldo', /^\(=\) Saldo Desta Fatura/],
  ['obrigacoesFuturas', /^Compras parceladas com e sem juros/],
];

function lerResumo(itens) {
  const r = {};
  for (const [campo, re] of ROTULOS_RESUMO) {
    const rot = itens.find(i => re.test(i.s));
    if (!rot) continue;
    const v = itens
      .filter(i => i.p === rot.p && Math.abs(i.y - rot.y) < 1.5 && i.x > rot.x && ehDinheiro(i.s))
      .sort((a, b) => a.x - b.x)[0];
    if (v) r[campo] = paraNumero(v.s);
  }
  const enc = itens.map(i => i.s.match(/^Juros: ([\d.,]+) \| IOF ([\d.,]+)/)).find(Boolean);
  if (enc) r.encargosParcelamentos = { juros: paraNumero(enc[1]), iof: paraNumero(enc[2]) };
  if (r.despesasBrasil == null) throw new LayoutError('Não encontrei o "Resumo da Fatura" no PDF.');
  return r;
}

function lerDetalhamento(itens, venc) {
  const paginas = [...new Set(itens.filter(i => i.s.startsWith('Detalhamento da Fatura')).map(i => i.p))].sort((a, b) => a - b);
  if (!paginas.length) throw new LayoutError('Não encontrei o "Detalhamento da Fatura" no PDF.');
  const cartoes = [];
  const lancamentos = [];
  let cartao = null;
  let secao = null;
  for (const p of paginas) {
    const topo = itens.find(i => i.p === p && i.s.startsWith('Detalhamento da Fatura')).y - 2;
    for (const col of [0, 1]) {
      const daColuna = itens
        .filter(i => i.p === p && i.y >= topo && (col ? i.x >= DIVISA_COLUNA : i.x < DIVISA_COLUNA))
        .map(i => ({ ...i, rx: col ? i.x - DESLOC_COLUNA : i.x }));
      for (const linha of agruparLinhas(daColuna)) {
        const texto = linha.itens.map(i => i.s).join(' ');
        let m;
        if (/^Resumo da Fatura/.test(texto)) return { cartoes, lancamentos };
        if ((m = texto.match(/^(@\s*)?(.+?)\s+-\s+\d{4}\s+XXXX\s+XXXX\s+(\d{4})\b/))) {
          cartao = { titular: m[2].trim(), final: m[3], virtual: !!m[1], pessoa: primeiroNome(m[2]), valorTotal: null };
          cartoes.push(cartao);
          secao = null;
          continue;
        }
        if (/^Pagamento e Demais Cr/.test(texto)) { secao = 'creditos'; continue; }
        if (/^Parcelamentos\b/.test(texto)) { secao = 'parcelamentos'; continue; }
        if (/^Despesas\b/.test(texto)) { secao = 'despesas'; continue; }
        if (/^VALOR TOTAL/.test(texto)) {
          const v = linha.itens.find(i => ehDinheiro(i.s));
          if (cartao && v) cartao.valorTotal = paraNumero(v.s);
          continue;
        }
        if ((m = texto.match(/^\*Juros = ([\d.,]+) \/ IOF = ([\d.,]+)/))) {
          const ultimo = lancamentos.at(-1);
          if (ultimo) { ultimo.juros = paraNumero(m[1]); ultimo.iof = paraNumero(m[2]); }
          continue;
        }
        const desc = linha.itens.filter(i => i.rx >= 28 && i.rx < 160).map(i => i.s).join(' ');
        if (!cartao || !(m = desc.match(/^(\d{2})\/(\d{2})\s+(.+)$/))) continue;
        const parc = linha.itens.find(i => i.rx >= 160 && i.rx < 195 && /^\d{2}\/\d{2}$/.test(i.s));
        const valores = linha.itens.filter(i => i.rx >= 190 && ehDinheiro(i.s));
        const brl = valores.find(i => i.rx < 232);
        const usd = valores.find(i => i.rx >= 232);
        if (!brl) continue;
        const dia = Number(m[1]);
        const mes = Number(m[2]);
        const valor = paraNumero(brl.s);
        lancamentos.push({
          cartao: cartao.final, pessoa: cartao.pessoa, virtual: cartao.virtual, secao,
          data: `${anoDe(mes, venc)}-${dois(mes)}-${dois(dia)}`,
          descricao: m[3].replace(/\s+/g, ' ').trim(),
          parcelaAtual: parc ? Number(parc.s.slice(0, 2)) : null,
          parcelaTotal: parc ? Number(parc.s.slice(3)) : null,
          valor, valorUSD: usd ? paraNumero(usd.s) : 0,
          tipo: valor < 0 ? 'credito' : 'compra',
        });
      }
    }
  }
  return { cartoes, lancamentos };
}

export function conferir(fatura) {
  const soma = f => arred2(fatura.lancamentos.filter(f).reduce((a, l) => a + l.valor, 0));
  const checks = [];
  const add = (nome, esperado, obtido) =>
    checks.push({ nome, esperado, obtido, ok: esperado != null && !Number.isNaN(esperado) && Math.abs(esperado - obtido) < 0.015 });
  const r = fatura.resumo;
  add('Compras (Brasil + exterior)', arred2((r.despesasBrasil ?? NaN) + (r.despesasExterior ?? 0)), soma(l => l.valor > 0));
  add('Pagamentos e créditos', arred2((r.pagamentos ?? 0) + (r.creditos ?? 0)), arred2(-soma(l => l.valor < 0)));
  for (const c of fatura.cartoes) add(`Cartão final ${c.final}`, c.valorTotal, soma(l => l.cartao === c.final && l.valor > 0));
  return { ok: checks.every(c => c.ok), checks };
}

export function lerFaturaSantander(itensBrutos) {
  const itens = [...itensBrutos].sort((a, b) => a.p - b.p || a.y - b.y || a.x - b.x);
  if (!itens.some(i => /SANTANDER/i.test(i.s))) throw new LayoutError('Este PDF não parece ser uma fatura do cartão Santander.');
  const p1 = itens.filter(i => i.p === 1);
  const vencTxt = valorAbaixo(p1, 'Vencimento', s => DATA_COMPLETA.test(s));
  if (!vencTxt) throw new LayoutError('Não encontrei a data de vencimento na primeira página.');
  const [dia, mes, ano] = vencTxt.split('/').map(Number);
  const venc = { ano, mes };
  const id = `${ano}-${dois(mes)}`;
  const fech = p1.map(i => i.s.match(/realizados até (\d{2})\/(\d{2})/)).find(Boolean);
  const num = s => (s == null ? null : paraNumero(s));
  const { cartoes, lancamentos } = lerDetalhamento(itens, venc);
  lancamentos.forEach((l, i) => { l.id = `${id}-${String(i).padStart(4, '0')}`; });
  const fatura = {
    id, banco: 'santander',
    vencimento: `${ano}-${dois(mes)}-${dois(dia)}`,
    fechamento: fech ? `${anoDe(Number(fech[2]), venc)}-${fech[2]}-${fech[1]}` : null,
    total: num(valorAbaixo(p1, 'Total a Pagar')),
    limite: num(valorAbaixo(p1, 'Seu limite')),
    limiteUsado: num(valorAbaixo(p1, 'Limite utilizado')),
    limiteDisponivel: num(valorAbaixo(p1, 'Limite Disponível')),
    historico: lerHistorico(p1, venc),
    resumo: lerResumo(itens),
    cartoes, lancamentos,
  };
  fatura.conferencia = conferir(fatura);
  return fatura;
}
