import { listarTodasPaginas } from './bitrixTransport'
import { registrarSnapshotMetadata } from './debugSnapshot'
import { modoMockDevAtivo } from './modoMockDev'
import { registrarSnapshotInfo } from './snapshotInfo'
import { baseSyncApi, descreverErroHttp, fetchSyncApi } from './syncApi'
import {
  aplicarFiltros,
  calcularMetricas,
  calcularMetricasPorSetor,
  calcularMetricasPorEquipe,
  calcularRankingFechadores,
  empacotarPorAtendimento,
} from '../utils/tarefasMetrics'
import {
  DEPARTAMENTO_ID_POR_EQUIPE,
  EQUIPES_ATENDIMENTO,
  NOMES_DEPARTAMENTO_EQUIPES,
  type EquipeResolvida,
  type FiltrosDashboard,
  type MetricasPorSetor,
  type MetricasPorEquipe,
  type MetricasTarefas,
  type PacoteAtendimento,
  type Projeto,
  type RankingFechadores,
  type Tarefa,
} from '../types/domain'

let cacheDepartamentos: Promise<Map<number, string>> | null = null

interface DepartamentoBitrix {
  ID: string
  NAME: string
}

function obterDepartamentosBitrix(): Promise<Map<number, string>> {
  if (!cacheDepartamentos) {
    cacheDepartamentos = listarTodasPaginas<DepartamentoBitrix>('department.get').then((deps) => {
      const mapa = new Map<number, string>()
      deps.forEach((d) => mapa.set(Number(d.ID), d.NAME))
      return mapa
    })
  }
  return cacheDepartamentos
}

// --- Carga dos dados: snapshot pré-processado pelo microsserviço de sync ---
//
// tasks.task.list é impraticavelmente lento neste portal Bitrix para o volume
// dos grupos monitorados (medido: ~2,8s/página de 50 itens, ~129 mil tarefas só
// no grupo 86 nos últimos 90 dias) — buscar ao vivo no navegador nunca
// terminaria em tempo útil. Um microsserviço próprio (sync-service/, FastAPI
// numa VPS) sincroniza continuamente em background e mantém um snapshot
// pronto; o front só lê esse snapshot via HTTP, instantâneo independente do
// volume real no Bitrix. Ver sync-service/README e VITE_SYNC_API_URL.

let cacheChave: string | null = null
let cachePromise: Promise<Tarefa[]> | null = null

/** Mantido como alias de baseSyncApi para não alterar os chamadores locais. */
function baseSyncApiUrl(): string | null {
  return baseSyncApi()
}

interface SnapshotMetadata {
  syncedAt: string
  windowStart: string
  windowEnd: string
  groups: Array<{ id: number; nome: string; taskCount: number; error: string | null }>
  runId: string
}

/**
 * Nomes reais dos grupos, vindos de `metadata.groups` do último snapshot lido
 * (o worker resolve via Bitrix). Ao contrário de `debugSnapshot.ts`, funciona
 * em produção também — é a única fonte de nome real quando `VITE_SYNC_API_URL`
 * está configurada, já que nesse caminho `acessoService.ts` nunca chama
 * `sonet_group.get` (ver `gruposMonitoradosFixos`) e devolve só "Grupo {id}".
 */
const nomesReaisPorGrupo = new Map<number, string>()

/**
 * O worker cai em "Grupo {id}" quando a chamada `sonet_group.get` falha ou
 * não acha o grupo (ver `fetchGroupNames`) — não é um nome real, é o mesmo
 * placeholder que `acessoService.ts` também usa. Ignorar aqui evita que uma
 * falha passageira substitua um nome real já conhecido por este placeholder.
 */
function ehNomePlaceholder(id: number, nome: string): boolean {
  return nome === `Grupo ${id}`
}

function registrarNomesDeGrupo(metadata: SnapshotMetadata): void {
  metadata.groups.forEach((g) => {
    if (g.nome && !ehNomePlaceholder(g.id, g.nome)) nomesReaisPorGrupo.set(g.id, g.nome)
  })
}

/** Aplica os nomes reais já conhecidos sobre uma lista de projetos (sem nome real, mantém o fallback recebido). */
export function comNomesReais(projetos: Projeto[]): Projeto[] {
  return projetos.map((p) => ({ id: p.id, nome: nomesReaisPorGrupo.get(p.id) ?? p.nome }))
}

async function buscarTarefasDoSnapshot(gruposSelecionados: number[]): Promise<Tarefa[]> {
  const base = baseSyncApiUrl()
  let erroConexao: string | null = null

  if (base) {
    try {
      // Envia o X-API-Token: o worker agora exige credencial em /snapshot.
      // ?grupos= evita baixar o payload inteiro (~18 MB) quando só parte dos
      // grupos monitorados está selecionada no multiselect do topo da página.
      const query = gruposSelecionados.length > 0 ? `?grupos=${gruposSelecionados.join(',')}` : ''
      const resposta = await fetchSyncApi(`/snapshot${query}`)
      if (resposta.ok) {
        const corpo = (await resposta.json()) as { tarefas: Tarefa[]; metadata: SnapshotMetadata }
        registrarSnapshotMetadata(corpo.metadata)
        registrarSnapshotInfo(corpo.metadata)
        registrarNomesDeGrupo(corpo.metadata)
        return corpo.tarefas
      }
      erroConexao = descreverErroHttp(resposta.status, base)
    } catch (err) {
      console.warn('Serviço de sync em VITE_SYNC_API_URL não respondeu:', err)
      erroConexao = `Não foi possível conectar ao servidor em ${base}. Verifique se a VPS está ligada.`
    }
  }

  // Em dev (ou se o modo mock dev estiver explicitamente ativo)
  if (import.meta.env.DEV || modoMockDevAtivo()) {
    const resposta = await fetch('/snapshot-mock.json')
    if (!resposta.ok) {
      throw new Error('Snapshot mock não encontrado em public/snapshot-mock.json.')
    }
    const mock = (await resposta.json()) as { tarefas: Tarefa[]; metadata: SnapshotMetadata }
    registrarSnapshotMetadata(mock.metadata)
    registrarSnapshotInfo(mock.metadata)
    registrarNomesDeGrupo(mock.metadata)

    // Ajusta dinamicamente as datas do mock em relação à data atual para ter tarefas
    // em andamento e com risco de atraso em ambiente de desenvolvimento (mock offline).
    const agora = new Date()
    const tarefasComPrazo = mock.tarefas.filter((t) => t.prazoFinal !== null)
    const maxMockTime =
      tarefasComPrazo.length > 0
        ? Math.max(...tarefasComPrazo.map((t) => new Date(t.prazoFinal!).getTime()))
        : agora.getTime()
    const targetMaxTime = agora.getTime() + 20 * 24 * 60 * 60 * 1000
    const deltaMs = targetMaxTime - maxMockTime

    return mock.tarefas.map((t) => ({
      ...t,
      prazoFinal: t.prazoFinal
        ? new Date(new Date(t.prazoFinal).getTime() + deltaMs).toISOString()
        : null,
    }))
  }

  if (erroConexao) {
    throw new Error(erroConexao)
  }

  throw new Error(
    'Serviço de sincronização não configurado. Defina a variável VITE_SYNC_API_URL no Vercel.',
  )
}

function idsSelecionados(projetosPermitidos: Projeto[], gruposSelecionados: number[]): number[] {
  const permitidos = new Set(projetosPermitidos.map((p) => p.id))
  return gruposSelecionados.filter((id) => permitidos.has(id))
}

function chaveDoCache(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(',')
}

/**
 * `gruposSelecionados` restringe a análise aos grupos marcados no multiselect
 * do topo da página — sempre interseccionado com `projetosPermitidos` (nunca
 * expõe um grupo fora do que o usuário tem acesso). A interseção é reaplicada
 * aqui (não só delegada ao worker) porque o snapshot mock local sempre traz
 * todos os grupos, ignorando o `?grupos=` da query.
 */
function carregarTarefasPermitidas(
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<Tarefa[]> {
  const ids = idsSelecionados(projetosPermitidos, gruposSelecionados)
  const chave = chaveDoCache(ids)
  if (cacheChave === chave && cachePromise) {
    return cachePromise
  }

  const idsPermitidos = new Set(ids)
  cacheChave = chave
  cachePromise = buscarTarefasDoSnapshot(ids).then((tarefas) =>
    tarefas.filter((t) => t.projetoId !== null && idsPermitidos.has(t.projetoId)),
  )
  return cachePromise
}

/**
 * Descarta o cache em memória sem já recarregar. Existe para a tela de
 * configurações: ao salvar um vínculo, o worker reescreve setor, supervisor, UF e
 * equipe das tarefas daquela pessoa, então o snapshot que está em memória passou
 * a mentir — mas quem recarrega é o efeito do DashboardPage, com os filtros e
 * grupos ativos, que este módulo não conhece daqui.
 */
export function descartarCacheTarefas(): void {
  cacheChave = null
  cachePromise = null
}

/** Descarta o cache em memória, forçando nova leitura do snapshot mais recente. */
export async function sincronizarComBitrix(
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<void> {
  descartarCacheTarefas()
  await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
}

// --- API pública consumida pelo front (mesma assinatura independente da fonte) ---

export async function obterMetricasGerais(
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<MetricasTarefas> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  return calcularMetricas(tarefas)
}

export async function obterMetricasFiltradas(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<MetricasTarefas> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  return calcularMetricas(aplicarFiltros(tarefas, filtros), filtros.modoTaxaAtraso)
}

export async function obterMetricasPorSetorFiltradas(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<MetricasPorSetor[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  return calcularMetricasPorSetor(aplicarFiltros(tarefas, filtros))
}

export async function obterMetricasPorEquipeFiltradas(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<MetricasPorEquipe[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  return calcularMetricasPorEquipe(
    aplicarFiltros(tarefas, filtros),
    filtros.modoTaxaAtraso,
    'atendimento',
  )
}

/**
 * Pacotes de atendimento: cada card é agrupado pelo responsável pelo atendimento
 * (UF_CRM_20_1780943729), com a equipe (departamento) do responsável já resolvida.
 * É a base da tela de inteligência.
 */
export async function obterPacotesAtendimento(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<PacoteAtendimento[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  return empacotarPorAtendimento(aplicarFiltros(tarefas, filtros), 'atendimento')
}

/**
 * Tarefas cruas do recorte de filtros atual — usada para localizar as tarefas
 * de UM colaborador ao abrir o modal de detalhe. Não dispara fetch novo:
 * reaproveita o cache em memória de `carregarTarefasPermitidas`.
 */
export async function obterTarefasFiltradas(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<Tarefa[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  return aplicarFiltros(tarefas, filtros)
}

/**
 * Ranking de quem mais fecha tarefas (`closedBy`), sob os filtros ativos.
 * Sempre por fechador — não depende de nenhuma outra dimensão de agrupamento.
 */
export async function obterRankingFechadores(
  filtros: FiltrosDashboard,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<RankingFechadores> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  return calcularRankingFechadores(aplicarFiltros(tarefas, filtros))
}

/**
 * "Busca as equipes das pessoas informadas": confirma que o ID de departamento
 * configurado em DEPARTAMENTO_ID_POR_EQUIPE existe de fato no Bitrix (via a
 * fonte ativa — BX24 ou webhook/api_url). Serve ao tracking da modelagem de
 * dados exibido junto aos gráficos.
 */
export async function resolverEquipesInformadas(): Promise<EquipeResolvida[]> {
  if (modoMockDevAtivo() || baseSyncApiUrl()) {
    return EQUIPES_ATENDIMENTO.map((nome) => ({
      nome,
      departamentoId: DEPARTAMENTO_ID_POR_EQUIPE[nome],
      encontrada: true,
    }))
  }

  try {
    const departamentos = await obterDepartamentosBitrix()

    return EQUIPES_ATENDIMENTO.map((nome) => {
      const departamentoId = DEPARTAMENTO_ID_POR_EQUIPE[nome]
      const encontrada = departamentos.has(departamentoId)
      return { nome, departamentoId, encontrada }
    })
  } catch {
    return EQUIPES_ATENDIMENTO.map((nome) => ({
      nome,
      departamentoId: DEPARTAMENTO_ID_POR_EQUIPE[nome],
      encontrada: true,
    }))
  }
}

/** Setores populados a partir de todas as tarefas dos grupos selecionados, garantindo também os departamentos das equipes. */
export async function listarSetoresDisponiveis(
  _filtrosSemSetor: Omit<FiltrosDashboard, 'setor'>,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<string[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  const setores = new Set<string>()
  tarefas.forEach((t) => t.fechadoPorDepartamentos.forEach((d) => setores.add(d)))
  NOMES_DEPARTAMENTO_EQUIPES.forEach((d) => setores.add(d))
  return Array.from(setores).sort((a, b) => a.localeCompare(b))
}

/** Estados (UF) presentes nos dados dos grupos selecionados. */
export async function listarEstadosDisponiveis(
  _filtrosSemEstado: Omit<FiltrosDashboard, 'estado'>,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<string[]> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  const estados = new Set<string>()
  tarefas.forEach((t) => {
    if (t.estadoUf) estados.add(t.estadoUf)
  })
  return Array.from(estados).sort((a, b) => a.localeCompare(b))
}

/** Colaboradores (que fecharam tarefas) presentes nos dados dos grupos selecionados. */
export async function listarColaboradoresDisponiveis(
  _filtrosSemFechadoPor: Omit<FiltrosDashboard, 'fechadoPorId'>,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<Array<{ id: number; nome: string }>> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  const colaboradores = new Map<number, string>()
  tarefas.forEach((t) => {
    if (t.fechadoPorId !== null)
      colaboradores.set(t.fechadoPorId, t.fechadoPorNome ?? `Usuário ${t.fechadoPorId}`)
  })
  return Array.from(colaboradores.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

/** Responsáveis atuais (RESPONSIBLE_ID) presentes nos dados dos grupos selecionados. */
export async function listarResponsaveisDisponiveis(
  _filtrosSemResponsavel: Omit<FiltrosDashboard, 'responsavelId'>,
  projetosPermitidos: Projeto[],
  gruposSelecionados: number[],
): Promise<Array<{ id: number; nome: string }>> {
  const tarefas = await carregarTarefasPermitidas(projetosPermitidos, gruposSelecionados)
  const responsaveis = new Map<number, string>()
  tarefas.forEach((t) => {
    if (t.responsavelId !== null)
      responsaveis.set(t.responsavelId, t.responsavelNome ?? `Usuário ${t.responsavelId}`)
  })
  return Array.from(responsaveis.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
