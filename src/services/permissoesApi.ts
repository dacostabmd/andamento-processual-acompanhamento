import type { CargoRole, Colaborador, PerfilVisibilidadeMetricas, PermissoesMetricas } from '../types/domain'
import { descreverErroHttp, baseSyncApi, fetchSyncApi } from './syncApi'

interface RespostaPermissoesMetricas {
  perfis: PerfilVisibilidadeMetricas[]
}

function identidade(solicitante: Colaborador | null) {
  return {
    solicitanteId: solicitante?.id ?? null,
    solicitanteNome: solicitante?.nome ?? 'Super Admin',
  }
}

async function lerOuLancar<T>(resposta: Response): Promise<T> {
  if (resposta.ok) return (await resposta.json()) as T
  let msg: string | null = null
  try {
    const corpo = (await resposta.json()) as { error?: string }
    msg = typeof corpo.error === 'string' ? corpo.error : null
  } catch {
    msg = null
  }
  throw new Error(msg ?? descreverErroHttp(resposta.status, baseSyncApi() ?? 'servidor'))
}

/** Busca todas as configurações de permissão de visibilidade por perfil. */
export async function listarPermissoesMetricas(): Promise<RespostaPermissoesMetricas> {
  const resposta = await fetchSyncApi('/permissoes-metricas')
  return lerOuLancar<RespostaPermissoesMetricas>(resposta)
}

/** Atualiza os toggles de visibilidade de métricas para um cargo/perfil específico. */
export async function salvarPermissoesMetricas(
  cargoRole: CargoRole,
  permissoes: PermissoesMetricas,
  solicitante: Colaborador | null,
): Promise<PerfilVisibilidadeMetricas> {
  const resposta = await fetchSyncApi(`/permissoes-metricas/${cargoRole}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissoes, ...identidade(solicitante) }),
  })
  const corpo = await lerOuLancar<{ perfil: PerfilVisibilidadeMetricas }>(resposta)
  return corpo.perfil
}
