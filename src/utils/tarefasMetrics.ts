import {
  EQUIPE_POR_NOME_DEPARTAMENTO,
  EQUIPES_ATENDIMENTO,
  STATUS_CONCLUIDO,
  type VisaoDashboard,
  type ContagemSituacao,
  type EquipeAtendimento,
  type FaixasUrgencia,
  type FiltrosDashboard,
  type InteligenciaDados,
  type InteligenciaEquipe,
  type MetricasPorSetor,
  type MetricasPorEquipe,
  type MetricasTarefas,
  type PacoteAtendimento,
  type PontoTendenciaMensal,
  type RankingFechador,
  type RankingFechadores,
  type Tarefa,
  type VolumeFechadoPor,
  type VolumePorUf,
  type VolumeResponsavel,
} from '../types/domain'

export function tarefaEstaAtrasada(tarefa: Tarefa, agora: Date): boolean {
  return (
    tarefa.prazoFinal !== null &&
    tarefa.status < STATUS_CONCLUIDO &&
    new Date(tarefa.prazoFinal) < agora
  )
}

export function tarefaEstaConcluida(tarefa: Tarefa): boolean {
  return tarefa.status === STATUS_CONCLUIDO
}

export function tarefaNoPrazo(tarefa: Tarefa, agora: Date): boolean {
  return (
    tarefa.status < STATUS_CONCLUIDO &&
    (tarefa.prazoFinal === null || new Date(tarefa.prazoFinal) >= agora)
  )
}

export function calcularMetricas(
  tarefas: Tarefa[],
  modoTaxaAtraso: 'ativas' | 'total' = 'ativas',
): MetricasTarefas {
  const total = tarefas.length
  const concluidas = tarefas.filter(tarefaEstaConcluida).length
  const agora = new Date()
  const atrasadas = tarefas.filter((t) => tarefaEstaAtrasada(t, agora)).length
  const eficiencia = total === 0 ? 0 : (concluidas / total) * 100

  const tresDiasEmMs = 3 * 24 * 60 * 60 * 1000
  const vencemEmBreve = tarefas.filter((t) => {
    if (t.status >= STATUS_CONCLUIDO || !t.prazoFinal) return false
    const prazo = new Date(t.prazoFinal).getTime()
    const diff = prazo - agora.getTime()
    return diff >= 0 && diff <= tresDiasEmMs
  }).length

  const aguardandoRevisao = tarefas.filter((t) => t.status === 4).length
  const emAndamento = tarefas.filter((t) => tarefaNoPrazo(t, agora)).length

  const ativas = total - concluidas - tarefas.filter((t) => t.status === 6).length

  const taxaAtraso =
    modoTaxaAtraso === 'total'
      ? total === 0
        ? 0
        : (atrasadas / total) * 100
      : ativas === 0
        ? 0
        : (atrasadas / ativas) * 100

  return {
    total,
    concluidas,
    atrasadas,
    eficiencia,
    vencemEmBreve,
    aguardandoRevisao,
    emAndamento,
    taxaAtraso,
  }
}


export function aplicarFiltros(tarefas: Tarefa[], filtros: FiltrosDashboard): Tarefa[] {
  const agora = new Date()
  const dataInicioLimite = filtros.dataInicio ? new Date(`${filtros.dataInicio}T00:00:00`) : null
  const dataFimLimite = filtros.dataFim ? new Date(`${filtros.dataFim}T23:59:59.999`) : null

  return tarefas.filter((tarefa) => {
    const prazo = tarefa.prazoFinal ? new Date(tarefa.prazoFinal) : null
    const finalizado = tarefa.finalizadoEm ? new Date(tarefa.finalizadoEm) : null

    if (filtros.filtroPrazo === 'com_prazo' && tarefa.prazoFinal === null) return false
    if (filtros.filtroPrazo === 'sem_prazo' && tarefa.prazoFinal !== null) return false

    if (dataInicioLimite) {
      const prazoValido = prazo !== null && prazo >= dataInicioLimite
      const finalizadoValido = finalizado !== null && finalizado >= dataInicioLimite
      if (!prazoValido && !finalizadoValido) return false
    }

    if (dataFimLimite) {
      const prazoValido = prazo !== null && prazo <= dataFimLimite
      const finalizadoValido = finalizado !== null && finalizado <= dataFimLimite
      if (!prazoValido && !finalizadoValido) return false
    }

    if (filtros.status === 'concluido' && !tarefaEstaConcluida(tarefa)) return false
    if (filtros.status === 'atrasado' && !tarefaEstaAtrasada(tarefa, agora)) return false
    if (filtros.status === 'no_prazo' && !tarefaNoPrazo(tarefa, agora)) return false
    if (filtros.setor && !tarefa.fechadoPorDepartamentos.includes(filtros.setor)) return false
    if (filtros.projetoId !== null && tarefa.projetoId !== filtros.projetoId) return false
    if (filtros.fechadoPorId !== null && tarefa.fechadoPorId !== filtros.fechadoPorId) return false
    if (filtros.responsavelId !== null && tarefa.responsavelId !== filtros.responsavelId) return false
    if (filtros.prioridade !== null && tarefa.prioridade !== filtros.prioridade) return false
    if (filtros.estado !== null && tarefa.estadoUf !== filtros.estado) return false
    if (filtros.ocultarIndefinidos) {
      if (tarefa.equipeAtendimento === 'indefinido') return false
      if (tarefa.responsavelAtendimentoId === null) return false
      if (tarefaEstaConcluida(tarefa) && tarefa.fechadoPorId === null) return false
    }
    if (filtros.ocultarForaDasEquipes) {
      if (tarefa.equipeAtendimento === 'indefinido') return false
      // Card já fechado por alguém de fora das 4 equipes também sai. Cards ainda
      // abertos não têm fechador e não são julgados por este critério.
      if (tarefa.fechadoPorId !== null && equipeExecutoraDaTarefa(tarefa) === 'indefinido') {
        return false
      }
    }

    return true
  })
}

// Ordem de exibição das equipes: as 4 conhecidas primeiro, "indefinido" por último.
const ORDEM_EQUIPES: EquipeAtendimento[] = [...EQUIPES_ATENDIMENTO, 'indefinido']

/**
 * Equipe de quem FECHOU o card.
 *
 * Prefere `equipeFechador`, que o worker resolve pelo ID do departamento do
 * fechador. O caminho por NOME (`fechadoPorDepartamentos`) continua como
 * retaguarda para snapshots gerados antes do campo existir — casar strings é
 * frágil: o Bitrix devolve alguns nomes com espaço à esquerda, e renomear o
 * departamento no portal quebraria a correspondência em silêncio.
 *
 * Um fechador pode pertencer a mais de um departamento de equipe (medido: 992
 * cards em "Andamento Cinthia Filgueiras" + "Andamento Lorena Pontes"); nesse
 * caso vale a primeira equipe na ordem canônica de EQUIPES_ATENDIMENTO, a mesma
 * ordem usada no worker. O card cai sempre no mesmo grupo e os totais das
 * equipes somam exatamente o total de cards — contá-lo nas duas inflaria a soma.
 */
export function equipeExecutoraDaTarefa(tarefa: Tarefa): EquipeAtendimento {
  if (tarefa.equipeFechador && tarefa.equipeFechador !== 'indefinido') {
    return tarefa.equipeFechador
  }

  const equipes = tarefa.fechadoPorDepartamentos
    .map((nome) => EQUIPE_POR_NOME_DEPARTAMENTO[nome.trim()])
    .filter((e): e is EquipeAtendimento => e !== undefined)

  if (equipes.length === 0) return 'indefinido'

  for (const equipe of EQUIPES_ATENDIMENTO) {
    if (equipes.includes(equipe)) return equipe
  }
  return 'indefinido'
}

/** Equipe do card conforme a visão ativa. */
export function equipeDaTarefa(tarefa: Tarefa, visao: VisaoDashboard): EquipeAtendimento {
  return visao === 'executora' ? equipeExecutoraDaTarefa(tarefa) : tarefa.equipeAtendimento
}

/**
 * Empacota os cards por responsável pelo atendimento. Cada pacote reúne todos os
 * cards do mesmo responsável, com a equipe dele. Os pacotes vêm ordenados por
 * equipe (ordem fixa) e, dentro da equipe, do maior para o menor volume de cards.
 */
export function empacotarPorAtendimento(
  tarefas: Tarefa[],
  visao: VisaoDashboard = 'atendimento',
): PacoteAtendimento[] {
  // Chave por pessoa; cards sem pessoa definida caem em um pacote único.
  const pacotesPorChave = new Map<string, PacoteAtendimento>()

  tarefas.forEach((tarefa) => {
    // Na visão executora a pessoa do pacote é quem fechou o card, não o participante.
    const pessoaId =
      visao === 'executora' ? tarefa.fechadoPorId : tarefa.responsavelAtendimentoId
    const pessoaNome = visao === 'executora' ? tarefa.fechadoPorNome : tarefa.responsavelAtendimentoNome
    const nomeFallback =
      visao === 'executora' ? 'Ainda não fechado' : 'Sem responsável pelo atendimento'

    const chave = pessoaId === null ? 'sem-responsavel' : String(pessoaId)

    let pacote = pacotesPorChave.get(chave)
    if (!pacote) {
      pacote = {
        responsavelAtendimentoId: pessoaId,
        responsavelAtendimentoNome: pessoaNome ?? nomeFallback,
        equipe: equipeDaTarefa(tarefa, visao),
        cards: [],
      }
      pacotesPorChave.set(chave, pacote)
    }
    pacote.cards.push(tarefa)
  })

  return Array.from(pacotesPorChave.values()).sort((a, b) => {
    const ordemA = ORDEM_EQUIPES.indexOf(a.equipe)
    const ordemB = ORDEM_EQUIPES.indexOf(b.equipe)
    if (ordemA !== ordemB) return ordemA - ordemB
    if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length
    return a.responsavelAtendimentoNome.localeCompare(b.responsavelAtendimentoNome)
  })
}

function contagemVazia(): ContagemSituacao {
  return { total: 0, noPrazo: 0, atrasadas: 0, concluidas: 0, adiadas: 0 }
}

/** Classifica um card em uma única situação de prazo (excludentes). */
function acumularSituacao(acc: ContagemSituacao, tarefa: Tarefa, agora: Date): void {
  acc.total += 1
  if (tarefaEstaConcluida(tarefa)) acc.concluidas += 1
  else if (tarefa.status === 6) acc.adiadas += 1
  else if (tarefaEstaAtrasada(tarefa, agora)) acc.atrasadas += 1
  else acc.noPrazo += 1
}

/** Breakdown por situação de um conjunto qualquer de cards — mesma classificação usada nos gráficos de inteligência. */
export function contarSituacoes(cards: Tarefa[]): ContagemSituacao {
  const agora = new Date()
  const acc = contagemVazia()
  cards.forEach((card) => acumularSituacao(acc, card, agora))
  return acc
}

/** Critério para localizar as tarefas de uma pessoa: cada dimensão usa um ID diferente da tarefa. */
export type CriterioPessoa =
  | { tipo: 'responsavelAtendimento'; id: number | null }
  | { tipo: 'fechadoPor'; id: number | null }

/**
 * Localiza as tarefas de uma pessoa num recorte de tarefas cruas, usado pelos
 * pontos de clique do modal de colaborador (gráfico de fechado-por e tabela de
 * ranking de fechadores). Mostra TODAS as tarefas que batem com o critério, não
 * só o subconjunto mais estrito que alimenta a métrica de origem (ex.:
 * `calcularRankingFechadores` só conta concluídas) — por isso o total aqui pode
 * divergir do número da barra/linha que originou o clique.
 */
export function tarefasDaPessoa(tarefas: Tarefa[], criterio: CriterioPessoa): Tarefa[] {
  if (criterio.tipo === 'fechadoPor') {
    return tarefas.filter((t) => t.fechadoPorId === criterio.id)
  }
  return tarefas.filter((t) => t.responsavelAtendimentoId === criterio.id)
}

export interface PontualidadeFechamento {
  concluidas: number
  noPrazo: number
  comAtraso: number
  /** Concluídas sem prazo ou sem data de conclusão — não entram em noPrazo nem comAtraso. */
  semPrazo: number
  /** Percentual de pontualidade sobre as concluídas com prazo julgável (exclui semPrazo). */
  percentualNoPrazo: number | null
}

/**
 * Mesma regra de pontualidade de `calcularRankingFechadores` (finalizadoEm vs
 * prazoFinal), fatorada para reuso no modal de colaborador — o breakdown do
 * modal usa `contarSituacoes`, que julga a situação ATUAL das tarefas (útil
 * para as ainda abertas), enquanto esta função julga a pontualidade de quem já
 * foi concluído, que é a mesma leitura de produtividade do ranking.
 */
export function calcularPontualidadeFechamento(cards: Tarefa[]): PontualidadeFechamento {
  let concluidas = 0
  let noPrazo = 0
  let comAtraso = 0
  let semPrazo = 0

  cards.forEach((tarefa) => {
    if (!tarefaEstaConcluida(tarefa)) return
    concluidas += 1
    if (!tarefa.prazoFinal || !tarefa.finalizadoEm) {
      semPrazo += 1
    } else if (new Date(tarefa.finalizadoEm) > new Date(tarefa.prazoFinal)) {
      comAtraso += 1
    } else {
      noPrazo += 1
    }
  })

  const comPrazo = noPrazo + comAtraso
  const percentualNoPrazo = comPrazo === 0 ? null : (noPrazo / comPrazo) * 100

  return { concluidas, noPrazo, comAtraso, semPrazo, percentualNoPrazo }
}

const TOP_RESPONSAVEIS = 10
const TOP_FECHADO_POR = 10

/**
 * Consolida os pacotes no modelo de dados de inteligência que alimenta os
 * gráficos: contagem por situação de cada equipe (na ordem fixa das equipes), o
 * ranking dos responsáveis por volume de cards e o ranking de "fechado por".
 * Recalculado a cada filtro.
 */
export function calcularInteligencia(pacotes: PacoteAtendimento[]): InteligenciaDados {
  const agora = new Date()

  const contagemPorEquipe = new Map<EquipeAtendimento, ContagemSituacao>()
  const responsaveisPorEquipe = new Map<EquipeAtendimento, number>()
  ORDEM_EQUIPES.forEach((equipe) => {
    contagemPorEquipe.set(equipe, contagemVazia())
    responsaveisPorEquipe.set(equipe, 0)
  })

  const volumes: VolumeResponsavel[] = []
  // Agregação de "fechado por" por pessoa (chave string; null = sem valor).
  const fechadoPorAgg = new Map<string, VolumeFechadoPor>()
  let totalCards = 0

  pacotes.forEach((pacote) => {
    const contagem = contagemPorEquipe.get(pacote.equipe)!
    pacote.cards.forEach((card) => {
      acumularSituacao(contagem, card, agora)
      acumularFechadoPor(fechadoPorAgg, card)
    })
    responsaveisPorEquipe.set(pacote.equipe, responsaveisPorEquipe.get(pacote.equipe)! + 1)
    totalCards += pacote.cards.length

    volumes.push({
      responsavelAtendimentoId: pacote.responsavelAtendimentoId,
      nome: pacote.responsavelAtendimentoNome,
      equipe: pacote.equipe,
      total: pacote.cards.length,
    })
  })

  const porEquipe: InteligenciaEquipe[] = ORDEM_EQUIPES.map((equipe) => ({
    equipe,
    contagem: contagemPorEquipe.get(equipe)!,
    responsaveis: responsaveisPorEquipe.get(equipe)!,
  }))

  const topResponsaveis = volumes
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
    .slice(0, TOP_RESPONSAVEIS)

  const topFechadoPor = Array.from(fechadoPorAgg.values())
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
    .slice(0, TOP_FECHADO_POR)

  const porUf = calcularVolumePorUf(pacotes)
  const urgencia = calcularFaixasUrgencia(pacotes, agora)
  const tendenciaMensal = calcularTendenciaMensal(pacotes, agora)

  return { porEquipe, topResponsaveis, topFechadoPor, porUf, urgencia, tendenciaMensal, totalCards }
}

/**
 * Ranking de quem mais fecha tarefas, a partir do `closedBy` do Bitrix.
 *
 * REGRA DE CONTAGEM — só entram cards **concluídos** (status 5) **com fechador
 * identificado**. É mais estrito que `acumularFechadoPor`, que alimenta o
 * gráfico de barras e também conta cards não concluídos que tenham `fechadoPorId`
 * e cria uma linha "Não informado" para concluídos sem fechador. Para um ranking
 * de produtividade entre pessoas, essas duas categorias são ruído: a primeira
 * mistura trabalho não entregue, a segunda não é uma pessoa.
 *
 * O que sobra de fora não é escondido — volta em `concluidasSemFechador` e
 * `naoConcluidas`, para a tela poder declarar a cobertura em vez de deixar o
 * leitor supor que o ranking cobre tudo.
 *
 * A equipe vem de `equipeExecutoraDaTarefa` (departamento real do fechador), não
 * de `equipeAtendimento` — esta última é a equipe do SUPERVISOR do fechador (ou
 * do supervisor do responsável, em fallback), útil para agrupar por gestão, mas
 * não identifica o departamento de quem efetivamente fechou o card.
 */
export function calcularRankingFechadores(tarefas: Tarefa[]): RankingFechadores {
  const porPessoa = new Map<number, RankingFechador>()
  let concluidasSemFechador = 0
  let naoConcluidas = 0

  tarefas.forEach((tarefa) => {
    if (!tarefaEstaConcluida(tarefa)) {
      naoConcluidas += 1
      return
    }
    if (tarefa.fechadoPorId === null) {
      concluidasSemFechador += 1
      return
    }

    let linha = porPessoa.get(tarefa.fechadoPorId)
    if (!linha) {
      linha = {
        fechadoPorId: tarefa.fechadoPorId,
        nome: tarefa.fechadoPorNome ?? `Usuário ${tarefa.fechadoPorId}`,
        equipe: equipeExecutoraDaTarefa(tarefa),
        setor: tarefa.setorFechador,
        supervisor: tarefa.gestorFechadorNome,
        total: 0,
        noPrazo: 0,
        comAtraso: 0,
        semPrazo: 0,
        percentual: 0,
      }
      porPessoa.set(tarefa.fechadoPorId, linha)
    }

    linha.total += 1

    // Sem prazo ou sem data de conclusão não dá para julgar pontualidade — vira
    // uma terceira categoria em vez de ser somada a "no prazo" por omissão.
    if (!tarefa.prazoFinal || !tarefa.finalizadoEm) {
      linha.semPrazo += 1
    } else if (new Date(tarefa.finalizadoEm) > new Date(tarefa.prazoFinal)) {
      linha.comAtraso += 1
    } else {
      linha.noPrazo += 1
    }
  })

  const linhas = Array.from(porPessoa.values())
  const totalFechado = linhas.reduce((soma, l) => soma + l.total, 0)

  linhas.forEach((l) => {
    l.percentual = totalFechado === 0 ? 0 : (l.total / totalFechado) * 100
  })

  linhas.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))

  const pessoasSemSupervisor = linhas.filter((l) => !l.supervisor).length

  return { linhas, totalFechado, concluidasSemFechador, naoConcluidas, pessoasSemSupervisor }
}

/** Acumula o "fechado por" de um card no agregado (apenas tarefas concluídas/fechadas). */
function acumularFechadoPor(agg: Map<string, VolumeFechadoPor>, card: Tarefa): void {
  if (!tarefaEstaConcluida(card) && card.fechadoPorId === null) return
  const chave = card.fechadoPorId === null ? 'sem-fechado-por' : String(card.fechadoPorId)
  const existente = agg.get(chave)
  if (existente) {
    existente.total += 1
    return
  }
  agg.set(chave, {
    fechadoPorId: card.fechadoPorId,
    nome: card.fechadoPorNome ?? 'Não informado',
    total: 1,
  })
}

const TOP_UF = 12

/** Ranking de volume por UF — cards sem UF informada não entram (não há "UF indefinida" a ranquear). */
function calcularVolumePorUf(pacotes: PacoteAtendimento[]): VolumePorUf[] {
  const agg = new Map<string, number>()
  pacotes.forEach((pacote) => {
    pacote.cards.forEach((card) => {
      if (!card.estadoUf) return
      agg.set(card.estadoUf, (agg.get(card.estadoUf) ?? 0) + 1)
    })
  })
  return Array.from(agg.entries())
    .map(([uf, total]) => ({ uf, total }))
    .sort((a, b) => b.total - a.total || a.uf.localeCompare(b.uf))
    .slice(0, TOP_UF)
}

const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000
const QUINZE_DIAS_MS = 15 * 24 * 60 * 60 * 1000

/**
 * Classifica cards ativos (nem concluídos, nem adiados) em faixas de dias até
 * o vencimento — transforma o número estático de "vence em breve" numa
 * distribuição acionável. Cards concluídos/adiados não entram em nenhuma faixa.
 */
function calcularFaixasUrgencia(pacotes: PacoteAtendimento[], agora: Date): FaixasUrgencia {
  const faixas: FaixasUrgencia = {
    vencidas: 0,
    ateTresDias: 0,
    quatroASeteDias: 0,
    oitoAQuinzeDias: 0,
    maisDeQuinzeDias: 0,
  }
  pacotes.forEach((pacote) => {
    pacote.cards.forEach((card) => {
      if (card.status === STATUS_CONCLUIDO || card.status === 6 || !card.prazoFinal) return
      const diff = new Date(card.prazoFinal).getTime() - agora.getTime()
      if (diff < 0) faixas.vencidas += 1
      else if (diff <= TRES_DIAS_MS) faixas.ateTresDias += 1
      else if (diff <= SETE_DIAS_MS) faixas.quatroASeteDias += 1
      else if (diff <= QUINZE_DIAS_MS) faixas.oitoAQuinzeDias += 1
      else faixas.maisDeQuinzeDias += 1
    })
  })
  return faixas
}

const MESES_TENDENCIA = 6

function chaveMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number)
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[mes - 1]}/${String(ano).slice(2)}`
}

/**
 * Série dos últimos N meses (por prazoFinal): volume concluído no mês, e —
 * das tarefas JÁ CONCLUÍDAS com prazo naquele mês — a % que terminou depois do
 * prazo (finalizadoEm > prazoFinal). Comparar com "agora" faria todo mês
 * fechado saturar em 100% (qualquer não-concluída de um mês passado está
 * necessariamente vencida hoje) — por isso a métrica usa a data de conclusão
 * real, não a data da consulta, e é uma medida histórica de pontualidade de
 * entrega, não de urgência atual (essa já existe em calcularFaixasUrgencia).
 */
function calcularTendenciaMensal(pacotes: PacoteAtendimento[], agora: Date): PontoTendenciaMensal[] {
  const chaves: string[] = []
  const cursor = new Date(agora.getFullYear(), agora.getMonth(), 1)
  for (let i = MESES_TENDENCIA - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setMonth(d.getMonth() - i)
    chaves.push(chaveMes(d))
  }

  const porMes = new Map<string, { concluidas: number; concluidasComAtraso: number }>()
  chaves.forEach((c) => porMes.set(c, { concluidas: 0, concluidasComAtraso: 0 }))

  pacotes.forEach((pacote) => {
    pacote.cards.forEach((card) => {
      if (!tarefaEstaConcluida(card) || !card.finalizadoEm || !card.prazoFinal) return
      const chave = chaveMes(new Date(card.prazoFinal))
      const bucket = porMes.get(chave)
      if (!bucket) return // fora da janela de meses considerada
      bucket.concluidas += 1
      if (new Date(card.finalizadoEm) > new Date(card.prazoFinal)) bucket.concluidasComAtraso += 1
    })
  })

  return chaves.map((chave) => {
    const bucket = porMes.get(chave)!
    return {
      mes: chave,
      label: rotuloMes(chave),
      concluidas: bucket.concluidas,
      taxaAtraso: bucket.concluidas === 0 ? 0 : (bucket.concluidasComAtraso / bucket.concluidas) * 100,
    }
  })
}

/** Agrupa as tarefas por setor (fechadoPorDepartamentos) e calcula as métricas de cada grupo. */
export function calcularMetricasPorSetor(tarefas: Tarefa[]): MetricasPorSetor[] {
  const tarefasPorSetor = new Map<string, Tarefa[]>()

  tarefas.forEach((tarefa) => {
    tarefa.fechadoPorDepartamentos.forEach((setor) => {
      const lista = tarefasPorSetor.get(setor) ?? []
      lista.push(tarefa)
      tarefasPorSetor.set(setor, lista)
    })
  })

  return Array.from(tarefasPorSetor.entries())
    .map(([setor, tarefasDoSetor]) => ({ setor, metricas: calcularMetricas(tarefasDoSetor) }))
    .sort((a, b) => a.setor.localeCompare(b.setor))
}

/**
 * Agrupa as tarefas pelas 4 equipes conhecidas e calcula as métricas de cada uma.
 * A equipe de cada card sai de `equipeDaTarefa`, então a mesma função serve às
 * duas visões — na executora, o card conta para a equipe de quem o fechou.
 */
export function calcularMetricasPorEquipe(
  tarefas: Tarefa[],
  modoTaxaAtraso: 'ativas' | 'total' = 'ativas',
  visao: VisaoDashboard = 'atendimento',
): MetricasPorEquipe[] {
  return EQUIPES_ATENDIMENTO.map((equipe) => {
    const tarefasDaEquipe = tarefas.filter((t) => equipeDaTarefa(t, visao) === equipe)
    return {
      equipe,
      metricas: calcularMetricas(tarefasDaEquipe, modoTaxaAtraso),
    }
  })
}


