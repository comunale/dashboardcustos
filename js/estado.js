// Estado do app em memória. Nada aqui é salvo descriptografado no aparelho.
import { mesLongo } from './format.js';

export function criarEstado() {
  return { faturas: new Map(), alteradas: new Set(), faturaId: null, pessoa: 'todos', cartao: 'todos', aba: 'resumo', limiteAlto: 300, alterado: false, senhaFamilia: null };
}

export const faturasOrdenadas = estado => [...estado.faturas.values()].sort((a, b) => b.id.localeCompare(a.id));

export function adicionarFatura(estado, fatura) {
  estado.faturas.set(fatura.id, fatura);
  estado.alteradas.add(fatura.id);
  estado.faturaId = fatura.id;
  estado.pessoa = 'todos';
  estado.cartao = 'todos';
  estado.alterado = true;
}

export function carregarDoCofre(estado, dados) {
  estado.faturas = new Map(dados.faturas.map(f => [f.id, f]));
  estado.alteradas = new Set();
  estado.faturaId = faturasOrdenadas(estado)[0]?.id ?? null;
  estado.alterado = false;
}

// Junta o que está publicado agora com o que mudou neste aparelho: só os meses subidos aqui
// sobrescrevem o remoto; todo o resto (inclusive correções e meses novos de outro aparelho) vem do remoto.
export function mesclar(estado, dadosRemotos) {
  for (const f of dadosRemotos.faturas) if (!estado.alteradas.has(f.id)) estado.faturas.set(f.id, f);
  if (!estado.faturas.has(estado.faturaId)) estado.faturaId = faturasOrdenadas(estado)[0]?.id ?? null;
}

export function marcarPublicado(estado) {
  estado.alteradas.clear();
  estado.alterado = false;
}

export function paraCofre(estado) {
  return { versao: 1, atualizadoEm: new Date().toISOString(), faturas: [...estado.faturas.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

export function podePublicar(estado) {
  if (!estado.faturas.size) return { ok: false, motivo: 'Suba uma fatura antes de publicar.' };
  const ruim = [...estado.faturas.values()].find(f => !f.conferencia?.ok);
  if (ruim) return { ok: false, motivo: `A fatura de ${mesLongo(ruim.id)} não bateu com os totais do banco. Publicar está bloqueado para não espalhar números errados.` };
  if (!estado.alteradas.size) return { ok: false, motivo: 'Nada novo para publicar.' };
  return { ok: true };
}

export const pessoasDa = fatura => [...new Set(fatura.cartoes.map(c => c.pessoa))];
