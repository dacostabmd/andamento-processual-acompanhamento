import type { Colaborador, Equipe, EquipeInput, OpcoesEquipe } from '../types/domain'
import { descreverErroHttp, baseSyncApi, fetchSyncApi } from './syncApi'

/**
 * Cliente das rotas de equipes do worker (`/equipes*`, `/pessoas/:id/estados-atuacao`).
 *
 * Mesmo padrão de cadastroPessoasApi.ts: toda escrita leva a identidade do
 * solicitante no corpo (`solicitanteId`/`solicitanteNome`) — é assim que o
 * worker confere permissão (exigirGestaoCadastro /
 * exigirGestaoCadastroOuConfigPerfil em auth.ts).
 */

interface RespostaEquipes {
  equipes: Equipe[]
  opcoes: OpcoesEquipe
}

function identidade(solicitante: Colaborador | null) {
  return {
    solicitanteId: solicitante?.id ?? null,
    solicitanteNome: solicitante?.nome ?? '',
  }
}

async function lerOuLancar<T>(resposta: Response): Promise<T> {
  if (resposta.ok) return (await resposta.json()) as T
  const mensagem = await lerMensagemDeErro(resposta)
  throw new Error(mensagem ?? descreverErroHttp(resposta.status, baseSyncApi() ?? 'servidor'))
}

async function lerMensagemDeErro(resposta: Response): Promise<string | null> {
  try {
    const corpo = (await resposta.json()) as { error?: string }
    return typeof corpo.error === 'string' ? corpo.error : null
  } catch {
    return null
  }
}

export async function listarEquipes(recarregarDiretorio = false): Promise<RespostaEquipes> {
  const query = recarregarDiretorio ? '?recarregar=1' : ''
  const resposta = await fetchSyncApi(`/equipes${query}`)
  return lerOuLancar<RespostaEquipes>(resposta)
}

export interface ResultadoEquipe {
  equipe: Equipe
  /** Nomes de quem já pertencia a outra equipe e foi realocado para esta. */
  pessoasMovidas: string[]
}

export async function salvarEquipe(
  input: EquipeInput,
  solicitante: Colaborador | null,
): Promise<ResultadoEquipe> {
  const rota = input.id != null ? `/equipes/${input.id}` : '/equipes'
  const resposta = await fetchSyncApi(rota, {
    method: input.id != null ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, ...identidade(solicitante) }),
  })
  return lerOuLancar<ResultadoEquipe>(resposta)
}

export async function excluirEquipe(id: number, solicitante: Colaborador | null): Promise<Equipe> {
  const resposta = await fetchSyncApi(`/equipes/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identidade(solicitante)),
  })
  const corpo = await lerOuLancar<{ equipe: Equipe }>(resposta)
  return corpo.equipe
}

/** Move uma pessoa entre equipes (ou tira de todas, com `equipeId: null`) — usada pelo Perfil de Colaborador. */
export async function reatribuirEquipeColaborador(
  usuarioId: number,
  usuarioNome: string,
  equipeId: number | null,
  solicitante: Colaborador | null,
): Promise<Equipe | null> {
  const resposta = await fetchSyncApi(`/equipes/membro/${usuarioId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipeId, usuarioNome, ...identidade(solicitante) }),
  })
  const corpo = await lerOuLancar<{ equipe: Equipe | null }>(resposta)
  return corpo.equipe
}

/** Grava os departamentos de estado ("Andamento Rio de Janeiro" etc.) de uma pessoa — usada pelo Perfil de Colaborador. */
export async function salvarEstadosAtuacao(
  usuarioId: number,
  usuarioNome: string,
  departamentoEstadoIds: number[],
  solicitante: Colaborador | null,
): Promise<void> {
  const resposta = await fetchSyncApi(`/pessoas/${usuarioId}/estados-atuacao`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: departamentoEstadoIds, usuarioNome, ...identidade(solicitante) }),
  })
  await lerOuLancar<{ cadastro: unknown }>(resposta)
}
