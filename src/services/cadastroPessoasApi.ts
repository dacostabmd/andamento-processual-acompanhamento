import type {
  CampoCadastroPessoa,
  Colaborador,
  HistoricoCadastro,
  OpcoesCadastro,
  PessoaCadastro,
} from '../types/domain'
import { descreverErroHttp, baseSyncApi, fetchSyncApi } from './syncApi'

/**
 * Cliente das rotas de cadastro de pessoas do worker (`/pessoas*`).
 *
 * TODA escrita leva a identidade do solicitante no corpo (`solicitanteId` /
 * `solicitanteNome`), porque é assim que o worker confere a lista de quem pode
 * editar — ver `exigirGestaoCadastro` em worker-nodejs-andamento/src/auth.ts, e a
 * limitação documentada lá: o worker não valida a sessão do BX24, então a
 * identidade é alegada, não provada. O ganho é impedir edição por um usuário
 * comum do dashboard e registrar no log quem alegou ser quem.
 */

interface RespostaPessoas {
  pessoas: PessoaCadastro[]
  opcoes: OpcoesCadastro
  escopo: 'andamento' | 'todos'
  /** Quantas pessoas o worker guarda no total, incluindo as fora do escopo pedido. */
  totalNoDiretorio: number
  diretorioCarregadoEm: string | null
}

/** Valor a gravar num vínculo. `{id: null, nome: null}` DESASSOCIA (não é "não mexer"). */
export interface VinculoParaSalvar {
  id: number | null
  nome: string | null
}

function identidade(solicitante: Colaborador | null) {
  return {
    solicitanteId: solicitante?.id ?? null,
    solicitanteNome: solicitante?.nome ?? '',
  }
}

async function lerOuLancar<T>(resposta: Response): Promise<T> {
  if (resposta.ok) return (await resposta.json()) as T

  // A mensagem do worker é específica ("UF inválida", "sem permissão") e é o que
  // o usuário precisa ler; o texto genérico por status é só a retaguarda para
  // quando a resposta não traz corpo JSON (proxy, 502, timeout).
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

/**
 * Pessoas editáveis + as opções dos seletores.
 *
 * `recarregarDiretorio` força o worker a repaginar `user.get`/`department.get` em
 * vez de usar o cache de 1 hora — para quando alguém acabou de ser admitido ou
 * movido no portal. `todosOsUsuarios` amplia a população do escopo Andamento para
 * o portal inteiro (milhares de pessoas), que não é o padrão porque torna difícil
 * achar as ~100 que afetam alguma métrica.
 */
export async function listarPessoasCadastro(
  recarregarDiretorio = false,
  todosOsUsuarios = false,
): Promise<RespostaPessoas> {
  const parametros = new URLSearchParams()
  if (recarregarDiretorio) parametros.set('recarregar', '1')
  if (todosOsUsuarios) parametros.set('escopo', 'todos')
  const query = parametros.toString()
  const resposta = await fetchSyncApi(`/pessoas${query ? `?${query}` : ''}`)
  return lerOuLancar<RespostaPessoas>(resposta)
}

/** `true` se o worker aceita edições deste usuário — a MESMA lista que ele aplica ao salvar. */
export async function verificarPermissaoCadastro(solicitante: Colaborador | null): Promise<boolean> {
  try {
    const resposta = await fetchSyncApi('/pessoas/permissao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identidade(solicitante)),
    })
    if (!resposta.ok) return false
    const corpo = (await resposta.json()) as { podeEditar?: boolean }
    return corpo.podeEditar === true
  } catch {
    // Worker fora do ar não deve travar a tela em "sem permissão" nem liberar
    // edição: quem decide de fato é o próprio worker no PUT, que devolverá 403.
    return false
  }
}

export interface ResultadoEdicao {
  /** Quantas linhas de tarefa foram reescritas pela reaplicação imediata. */
  tarefasAtualizadas: number
  equipesRecalculadas: number
  /**
   * Preenchido quando o cadastro FOI salvo mas a reaplicação nas tarefas falhou
   * (tipicamente webhook do Bitrix fora do ar). Precisa chegar ao usuário: sem
   * ele a tela diria "salvo" e os números não mudariam, ou diria "erro" para algo
   * que está gravado.
   */
  aviso?: string | null
}

/**
 * Grava os vínculos informados de uma pessoa. Só os campos presentes são
 * tocados — um salvamento de "supervisor" não apaga o departamento que outra
 * pessoa definiu minutos antes.
 */
export async function salvarVinculosPessoa(
  usuarioId: number,
  usuarioNome: string,
  vinculos: Partial<Record<CampoCadastroPessoa, VinculoParaSalvar>>,
  solicitante: Colaborador | null,
): Promise<ResultadoEdicao> {
  const resposta = await fetchSyncApi(`/pessoas/${usuarioId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioNome, vinculos, ...identidade(solicitante) }),
  })
  const corpo = await lerOuLancar<{ reaplicacao: ResultadoEdicao }>(resposta)
  return corpo.reaplicacao
}

/**
 * Devolve campos ao que o Bitrix diz — o oposto de desassociar. Lista vazia
 * remove todas as definições manuais da pessoa.
 *
 * Usa POST /pessoas/:id/limpar e não DELETE pelo mesmo motivo do fórum de
 * comentários: DELETE com corpo é bloqueado por alguns proxies, e a identidade
 * do solicitante viaja no corpo.
 */
export async function reverterVinculosPessoa(
  usuarioId: number,
  campos: CampoCadastroPessoa[],
  solicitante: Colaborador | null,
): Promise<ResultadoEdicao> {
  const query = campos.length > 0 ? `?campos=${campos.join(',')}` : ''
  const resposta = await fetchSyncApi(`/pessoas/${usuarioId}/limpar${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identidade(solicitante)),
  })
  const corpo = await lerOuLancar<{ reaplicacao: ResultadoEdicao }>(resposta)
  return corpo.reaplicacao
}

export async function obterHistoricoPessoa(usuarioId: number): Promise<HistoricoCadastro[]> {
  const resposta = await fetchSyncApi(`/pessoas/${usuarioId}/historico`)
  const corpo = await lerOuLancar<{ historico: HistoricoCadastro[] }>(resposta)
  return corpo.historico
}

/** Reaplica o cadastro de todas as pessoas nas tarefas já gravadas, sem tocar no Bitrix. */
export async function reaplicarCadastroCompleto(
  solicitante: Colaborador | null,
): Promise<{ pessoas: number } & ResultadoEdicao> {
  const resposta = await fetchSyncApi('/pessoas/reaplicar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identidade(solicitante)),
  })
  return lerOuLancar<{ pessoas: number } & ResultadoEdicao>(resposta)
}
