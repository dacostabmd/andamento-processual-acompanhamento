import { fetchSyncApi } from './syncApi'

export interface PontoSerieDiaria {
  data: string
  total: number
  concluidas: number
}

export interface ProjecaoTarefas {
  projecaoDiaria: Array<{ data: string; totalProjetado: number }>
  projecaoSemanal: Array<{ semanaLabel: string; totalProjetado: number }>
  narrativa: string
  meta: { modelo: string; amostraDias: number; ms: number }
}

/** Pede ao worker uma projeção de IA dos próximos 30 dias a partir da série diária já calculada no cliente. */
export async function obterProjecaoTarefas(
  serieDiaria: PontoSerieDiaria[],
): Promise<ProjecaoTarefas> {
  const resposta = await fetchSyncApi('/projecao-tarefas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serieDiaria }),
  })
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null)
    throw new Error(corpo?.error ?? `Erro ao gerar projeção (HTTP ${resposta.status}).`)
  }
  return resposta.json()
}
