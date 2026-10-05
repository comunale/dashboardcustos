// Formatação em português do Brasil.
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const moeda = n => BRL.format(n ?? 0);
export function moedaCurta(n) {
  const v = Math.abs(n ?? 0);
  if (v < 1000) return `R$ ${Math.round(n)}`;
  return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
}
export const mesCurto = id => `${MESES[Number(id.slice(5, 7)) - 1].slice(0, 3)}/${id.slice(2, 4)}`;
export const mesLongo = id => `${MESES[Number(id.slice(5, 7)) - 1]} de ${id.slice(0, 4)}`;
export const dataCurta = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const pct = r => `${Math.round((r ?? 0) * 100)}%`;
