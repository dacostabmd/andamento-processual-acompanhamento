import { fetchSyncApi } from './syncApi'

export interface ComentarioForumApi {
  id: string
  diaSyncId: string
  comentarioPaiId: string | null
  autorId: number | null
  autorNome: string
  texto: string
  criadoEm: string
  editadoEm: string | null
  deletadoEm: string | null
}

/** Quem está fazendo a ação — igual para editar e excluir, então um tipo só. */
export interface SolicitanteAcao {
  solicitanteId: number | null
  solicitanteNome: string
  /** true quando o solicitante é supervisor de alguma equipe ou o admin (Caio) — pode moderar qualquer comentário. */
  ehModerador: boolean
}

export async function buscarComentariosDoDia(diaSyncId: string): Promise<ComentarioForumApi[]> {
  const resposta = await fetchSyncApi(`/comentarios/${encodeURIComponent(diaSyncId)}`)
  if (!resposta.ok) throw new Error(`Erro ao buscar comentários (HTTP ${resposta.status}).`)
  const dados = await resposta.json()
  return dados.comentarios ?? []
}

export async function criarComentarioApi(input: {
  diaSyncId: string
  comentarioPaiId?: string | null
  autorId: number | null
  autorNome: string
  texto: string
}): Promise<ComentarioForumApi> {
  const resposta = await fetchSyncApi('/comentarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!resposta.ok) throw new Error(`Erro ao publicar comentário (HTTP ${resposta.status}).`)
  const dados = await resposta.json()
  return dados.comentario
}

export async function editarComentarioApi(
  id: string,
  texto: string,
  solicitante: SolicitanteAcao,
): Promise<ComentarioForumApi> {
  const resposta = await fetchSyncApi(`/comentarios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto, ...solicitante }),
  })
  if (!resposta.ok) throw new Error(`Erro ao editar comentário (HTTP ${resposta.status}).`)
  const dados = await resposta.json()
  return dados.comentario
}

export async function excluirComentarioApi(id: string, solicitante: SolicitanteAcao): Promise<void> {
  const resposta = await fetchSyncApi(`/comentarios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(solicitante),
  })
  if (!resposta.ok && resposta.status !== 204) {
    throw new Error(`Erro ao excluir comentário (HTTP ${resposta.status}).`)
  }
}
