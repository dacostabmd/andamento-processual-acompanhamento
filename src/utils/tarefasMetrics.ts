import {
  EQUIPES_ATENDIMENTO,
  obterEquipePorNomeDepartamento,
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
  type PontoTendenciaDiaria,
  type PontoTendenciaMensal,
  type RankingFechador,
  type RankingFechadores,
  type Tarefa,
  type VolumeFechadoPor,
  type VolumePorUf,
  type VolumeResponsavel,
} from '../types/domain'
import { ehNomeDePessoa, equipeSupervisionadaPeloNome } from './pessoas'

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

/**
 * Tarefa concluída DEPOIS do prazo. Não usa `tarefaEstaAtrasada` (que só
 * classifica tarefas ainda ABERTAS) — o status nativo do Bitrix de uma tarefa
 * concluída é sempre "Concluído", nunca "Atrasado", então sem isto não há
 * como sinalizar visualmente, por linha, quais concluídas contam para a
 * métrica "Atrasadas (total)" do modal de colaborador.
 */
export function tarefaFoiConcluidaComAtraso(tarefa: Tarefa): boolean {
  return (
    tarefaEstaConcluida(tarefa) &&
    tarefa.prazoFinal !== null &&
    tarefa.finalizadoEm !== null &&
    new Date(tarefa.finalizadoEm) > new Date(tarefa.prazoFinal)
  )
}

export function calcularMetricas(
  tarefas: Tarefa[],
  modoTaxaAtraso: 'ativas' | 'total' = 'ativas',
  apenasConcluidasMode?: boolean,
): MetricasTarefas {
  const total = tarefas.length
  const concluidas = tarefas.filter(tarefaEstaConcluida).length
  const agora = new Date()

  const ehModoConcluidas = apenasConcluidasMode || (total > 0 && concluidas === total)

  if (ehModoConcluidas) {
    const concluidasComAtraso = tarefas.filter(tarefaFoiConcluidaComAtraso).length
    const concluidasNoPrazo = total - concluidasComAtraso
    const taxaAtraso = total === 0 ? 0 : (concluidasComAtraso / total) * 100

    return {
      total,
      concluidas: total,
      atrasadas: concluidasComAtraso,
      eficiencia: 100,
      vencemEmBreve: 0,
      aguardandoRevisao: 0,
      emAndamento: concluidasNoPrazo,
      taxaAtraso,
      baseTaxaAtraso: total,
    }
  }

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
  const baseTaxaAtraso = modoTaxaAtraso === 'total' ? total : ativas

  const taxaAtraso = baseTaxaAtraso === 0 ? 0 : (atrasadas / baseTaxaAtraso) * 100

  return {
    total,
    concluidas,
    atrasadas,
    eficiencia,
    vencemEmBreve,
    aguardandoRevisao,
    emAndamento,
    taxaAtraso,
    baseTaxaAtraso,
  }
}

export function aplicarFiltros(tarefas: Tarefa[], filtros: FiltrosDashboard): Tarefa[] {
  const agora = new Date()
  const dataInicioLimite = filtros.dataInicio ? new Date(`${filtros.dataInicio}T00:00:00`) : null
  const dataFimLimite = filtros.dataFim ? new Date(`${filtros.dataFim}T23:59:59.999`) : null

  return tarefas.filter((tarefa) => {
    if (filtros.apenasConcluidas && !tarefaEstaConcluida(tarefa)) return false

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
    if (filtros.setores && filtros.setores.length > 0) {
      const bateSetor = filtros.setores.some(
        (s) =>
          tarefa.fechadoPorDepartamentos.includes(s) ||
          tarefa.setorAtendimento === s ||
          tarefa.setorFechador === s,
      )
      if (!bateSetor) return false
    }
    if (filtros.projetoId !== null && tarefa.projetoId !== filtros.projetoId) return false
    if (filtros.fechadoPorId !== null && tarefa.fechadoPorId !== filtros.fechadoPorId) return false
    if (filtros.responsavelId !== null && tarefa.responsavelId !== filtros.responsavelId)
      return false
    if (filtros.prioridade !== null && tarefa.prioridade !== filtros.prioridade) return false
    if (filtros.estado !== null && tarefa.estadoUf !== filtros.estado) return false
    if (filtros.ocultarSemResponsavel) {
      if (tarefa.responsavelId === null && tarefa.responsavelAtendimentoId === null) return false
      if (!tarefa.responsavelNome && !tarefa.responsavelAtendimentoNome) return false
    }
    if (filtros.buscaTexto) {
      const termo = filtros.buscaTexto
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      if (termo) {
        const tituloNorm = (tarefa.titulo ?? '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        const respNorm = (tarefa.responsavelNome ?? '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        const fechNorm = (tarefa.fechadoPorNome ?? '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        const idStr = String(tarefa.id)
        const prazoStr = tarefa.prazoFinal ? tarefa.prazoFinal.slice(0, 10) : ''
        const match =
          tituloNorm.includes(termo) ||
          respNorm.includes(termo) ||
          fechNorm.includes(termo) ||
          idStr.includes(termo) ||
          prazoStr.includes(termo)
        if (!match) return false
      }
    }
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
  if (tarefa.fechadoPorNome) {
    const equipeLider = equipeSupervisionadaPeloNome(tarefa.fechadoPorNome)
    if (equipeLider) return equipeLider
  }

  if (tarefa.equipeFechador && tarefa.equipeFechador !== 'indefinido') {
    return tarefa.equipeFechador
  }

  const equipes = tarefa.fechadoPorDepartamentos
    .map((nome) => obterEquipePorNomeDepartamento(nome))
    .filter((e): e is EquipeAtendimento => e !== 'indefinido')

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
/** Equipe mais frequente entre os cards da pessoa, ignorando 'indefinido' quando há alternativa.
 *
 * Antes a equipe do pacote travava na do PRIMEIRO card processado — como filtros
 * (ex.: "Ocultar dados indefinidos") mudam quais cards sobrevivem sem mudar a
 * ordem dos demais, isso fazia o card sobrevivente na frente do array virar
 * "o primeiro", podendo trocar a equipe de uma pessoa inteira (e escondê-la do
 * ripple da equipe certa) só por causa do filtro, não por causa dos dados dela.
 */
function equipeMaisFrequente(cards: Tarefa[], visao: VisaoDashboard): EquipeAtendimento {
  const contagem = new Map<EquipeAtendimento, number>()
  cards.forEach((c) => {
    const equipe = equipeDaTarefa(c, visao)
    contagem.set(equipe, (contagem.get(equipe) ?? 0) + 1)
  })

  let melhor: EquipeAtendimento = 'indefinido'
  let melhorContagem = -1
  contagem.forEach((total, equipe) => {
    if (equipe === 'indefinido') return
    if (total > melhorContagem) {
      melhor = equipe
      melhorContagem = total
    }
  })
  if (melhorContagem >= 0) return melhor

  return 'indefinido'
}

export function empacotarPorAtendimento(
  tarefas: Tarefa[],
  visao: VisaoDashboard = 'atendimento',
): PacoteAtendimento[] {
  // Chave por pessoa; cards sem pessoa definida caem em um pacote único.
  const pacotesPorChave = new Map<string, PacoteAtendimento>()

  tarefas.forEach((tarefa) => {
    // Na visão executora a pessoa do pacote é quem fechou o card, não o participante.
    const pessoaId = visao === 'executora' ? tarefa.fechadoPorId : tarefa.responsavelAtendimentoId
    const pessoaNome =
      visao === 'executora' ? tarefa.fechadoPorNome : tarefa.responsavelAtendimentoNome
    const nomeFallback =
      visao === 'executora' ? 'Ainda não fechado' : 'Sem responsável pelo atendimento'

    const chave = pessoaId === null ? 'sem-responsavel' : String(pessoaId)

    let pacote = pacotesPorChave.get(chave)
    if (!pacote) {
      pacote = {
        responsavelAtendimentoId: pessoaId,
        responsavelAtendimentoNome: pessoaNome ?? nomeFallback,
        equipe: 'indefinido',
        cards: [],
      }
      pacotesPorChave.set(chave, pacote)
    }
    pacote.cards.push(tarefa)
  })

  pacotesPorChave.forEach((pacote) => {
    pacote.equipe = equipeMaisFrequente(pacote.cards, visao)
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
  return {
    total: 0,
    noPrazo: 0,
    atrasadas: 0,
    concluidas: 0,
    adiadas: 0,
    concluidasComAtraso: 0,
    concluidasNoPrazo: 0,
  }
}

/** Classifica um card em uma única situação de prazo (excludentes). */
function acumularSituacao(acc: ContagemSituacao, tarefa: Tarefa, agora: Date): void {
  acc.total += 1
  if (tarefaEstaConcluida(tarefa)) {
    acc.concluidas += 1
    if (tarefaFoiConcluidaComAtraso(tarefa)) {
      acc.concluidasComAtraso += 1
    } else {
      acc.concluidasNoPrazo += 1
    }
  } else if (tarefa.status === 6) {
    acc.adiadas += 1
  } else if (tarefaEstaAtrasada(tarefa, agora)) {
    acc.atrasadas += 1
  } else {
    acc.noPrazo += 1
  }
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
  { tipo: 'responsavelAtendimento'; id: number | null } | { tipo: 'fechadoPor'; id: number | null }

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
    } else if (tarefaFoiConcluidaComAtraso(tarefa)) {
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
 * Ranking de "fechado por" (volume) a partir de uma lista crua de tarefas —
 * independente de como elas foram agrupadas em pacotes de atendimento.
 *
 * Existe separado de `calcularInteligencia` porque "quem fechou" é uma
 * dimensão própria (equipe do FECHADOR), diferente da equipe de atendimento
 * usada para agrupar `pacotes`. Calcular isto a partir de `pacotes` filtrados
 * pelo ripple de equipe de atendimento é um bug: um fechador pode ter a
 * maioria dos cards dele atribuídos (responsavelAtendimentoId) a pessoas de
 * OUTRAS equipes, então o total apareceria artificialmente baixo — o card
 * conta para "fechado por" mesmo que o pacote dele (agrupado por quem
 * ATENDE) não pertença à equipe selecionada no ripple.
 */
export function calcularTopFechadoPor(tarefas: Tarefa[]): VolumeFechadoPor[] {
  const fechadoPorAgg = new Map<string, VolumeFechadoPor>()
  tarefas.forEach((card) => acumularFechadoPor(fechadoPorAgg, card))
  return Array.from(fechadoPorAgg.values())
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
    .slice(0, TOP_FECHADO_POR)
}

/**
 * Consolida os pacotes no modelo de dados de inteligência que alimenta os
 * gráficos: contagem por situação de cada equipe (na ordem fixa das equipes) e
 * o ranking dos responsáveis por volume de cards. Recalculado a cada filtro.
 *
 * NÃO inclui mais `topFechadoPor` — ver `calcularTopFechadoPor`, calculado à
 * parte a partir da lista crua de tarefas (não de `pacotes`, que agrupa por
 * uma dimensão diferente e pode estar filtrado pelo ripple errado).
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
  let totalCards = 0

  pacotes.forEach((pacote) => {
    const contagem = contagemPorEquipe.get(pacote.equipe)!
    pacote.cards.forEach((card) => {
      acumularSituacao(contagem, card, agora)
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

  const porUf = calcularVolumePorUf(pacotes)
  const urgencia = calcularFaixasUrgencia(pacotes, agora)
  const tendenciaMensal = calcularTendenciaMensal(pacotes, agora)

  return { porEquipe, topResponsaveis, porUf, urgencia, tendenciaMensal, totalCards }
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
      const equipe = equipeExecutoraDaTarefa(tarefa)
      // As 4 equipes de atendimento são batizadas com o nome da própria
      // supervisora (ver EQUIPES_ATENDIMENTO) — quando o campo "Supervisor" da
      // ficha do Bitrix não está cadastrado, mas o setor já identificou a
      // equipe, o nome da equipe JÁ É o nome do supervisor. Sem isto, gente
      // com setor conhecido aparecia como "sem supervisor" por um campo do
      // Bitrix vazio, quando a equipe sozinha já respondia a pergunta.
      const supervisor = tarefa.gestorFechadorNome ?? (equipe === 'indefinido' ? null : equipe)
      linha = {
        fechadoPorId: tarefa.fechadoPorId,
        nome: tarefa.fechadoPorNome ?? `Usuário ${tarefa.fechadoPorId}`,
        equipe,
        setor: tarefa.setorFechador,
        supervisor,
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
 * Faixa de urgência de UM card, ou `null` se ele não entra em nenhuma
 * (concluído, adiado, ou sem prazo definido) — mesmo critério de
 * `calcularFaixasUrgencia`, fatorado para reuso no clique do gráfico (achar
 * quais tarefas caem numa faixa, não só contá-las).
 */
export function classificarUrgenciaTarefa(card: Tarefa, agora: Date): keyof FaixasUrgencia | null {
  if (card.status === STATUS_CONCLUIDO || card.status === 6 || !card.prazoFinal) return null
  const diff = new Date(card.prazoFinal).getTime() - agora.getTime()
  if (diff < 0) return 'vencidas'
  if (diff <= TRES_DIAS_MS) return 'ateTresDias'
  if (diff <= SETE_DIAS_MS) return 'quatroASeteDias'
  if (diff <= QUINZE_DIAS_MS) return 'oitoAQuinzeDias'
  return 'maisDeQuinzeDias'
}

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
      const faixa = classificarUrgenciaTarefa(card, agora)
      if (faixa) faixas[faixa] += 1
    })
  })
  return faixas
}

const MESES_TENDENCIA = 6

/** Chave "AAAA-MM" de uma data — usada para agrupar por mês e para localizar as tarefas de um ponto da tendência mensal ao clicar no gráfico. */
export function chaveMes(data: Date): string {
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
function calcularTendenciaMensal(
  pacotes: PacoteAtendimento[],
  agora: Date,
): PontoTendenciaMensal[] {
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
      taxaAtraso:
        bucket.concluidas === 0 ? 0 : (bucket.concluidasComAtraso / bucket.concluidas) * 100,
    }
  })
}

const DIAS_TENDENCIA = 30

/** Chave "AAAA-MM-DD" de uma data — usada para agrupar por dia e para localizar as tarefas de um ponto da tendência diária ao clicar no gráfico. */
export function chaveDia(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function rotuloDia(chave: string): string {
  const [, mes, dia] = chave.split('-')
  return `${dia}/${mes}`
}

/**
 * Série dos últimos N dias (por prazoFinal) — mesmo critério de
 * calcularTendenciaMensal (volume concluído no dia e, das concluídas com prazo
 * naquele dia, a % que terminou depois do prazo), em granularidade diária.
 * Alimenta o gráfico "tarefas por dia" dos últimos 30 dias.
 */
export function calcularTendenciaDiaria(
  pacotes: PacoteAtendimento[],
  agora: Date,
  dias: number = DIAS_TENDENCIA,
): PontoTendenciaDiaria[] {
  const chaves: string[] = []
  const cursor = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    chaves.push(chaveDia(d))
  }

  const porDia = new Map<string, { concluidas: number; concluidasComAtraso: number }>()
  chaves.forEach((c) => porDia.set(c, { concluidas: 0, concluidasComAtraso: 0 }))

  pacotes.forEach((pacote) => {
    pacote.cards.forEach((card) => {
      if (!tarefaEstaConcluida(card) || !card.finalizadoEm || !card.prazoFinal) return
      const chave = chaveDia(new Date(card.prazoFinal))
      const bucket = porDia.get(chave)
      if (!bucket) return // fora da janela de dias considerada
      bucket.concluidas += 1
      if (new Date(card.finalizadoEm) > new Date(card.prazoFinal)) bucket.concluidasComAtraso += 1
    })
  })

  return chaves.map((chave) => {
    const bucket = porDia.get(chave)!
    return {
      dia: chave,
      label: rotuloDia(chave),
      concluidas: bucket.concluidas,
      taxaAtraso:
        bucket.concluidas === 0 ? 0 : (bucket.concluidasComAtraso / bucket.concluidas) * 100,
    }
  })
}

export interface PontoSerieDiariaSimples {
  dia: string
  label: string
  valor: number
}

/**
 * Série dos últimos N dias por data de criação do card (criadoEm/CREATED_DATE),
 * independente de status — alimenta a projeção de "tarefas criadas".
 */
export function calcularTendenciaDiariaCriadas(
  pacotes: PacoteAtendimento[],
  agora: Date,
  dias: number = DIAS_TENDENCIA,
): PontoSerieDiariaSimples[] {
  const chaves: string[] = []
  const cursor = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    chaves.push(chaveDia(d))
  }

  const porDia = new Map<string, number>()
  chaves.forEach((c) => porDia.set(c, 0))

  pacotes.forEach((pacote) => {
    pacote.cards.forEach((card) => {
      if (!card.criadoEm) return
      const chave = chaveDia(new Date(card.criadoEm))
      const bucketAtual = porDia.get(chave)
      if (bucketAtual === undefined) return // fora da janela de dias considerada
      porDia.set(chave, bucketAtual + 1)
    })
  })

  return chaves.map((chave) => ({
    dia: chave,
    label: rotuloDia(chave),
    valor: porDia.get(chave)!,
  }))
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

export interface FaturamentoPorEquipe {
  equipe: string
  pago: number
  pendente: number
  total: number
  qtdPago: number
  qtdPendente: number
}

export interface FaturadorRanking {
  nome: string
  equipe: string
  totalPago: number
  totalPendente: number
  qtdTarefas: number
}

export interface DadosFaturamentoVigente {
  totalRealizado: number
  totalPendente: number
  totalGeral: number
  ticketMedio: number
  qtdPagos: number
  qtdPendentes: number
  porEquipe: FaturamentoPorEquipe[]
  topFechadores: FaturadorRanking[]
}

/**
 * Calcula os cruzamentos de Faturamento Vigente com tarefas, equipes e
 * colaboradores/fechadores.
 *
 * Fonte: Situação Financeira do Asaas (`situacaoFinanceira`), lida do item de
 * CRM "ANDAMENTO PROCESSUAL" vinculado à tarefa — não os campos manuais
 * "[A] Valor da cobrança"/"[A] Data de Pagamento" (`valorCobranca`/
 * `dataPagamento`), que na prática quase nunca são preenchidos pelos
 * atendentes e faziam este card mostrar quase zero mesmo com milhares de
 * processos ativos. INADIMPLENTE conta como Pendente pelo valor vencido
 * (`valorInadimplente`, campo estruturado do Asaas); ADIMPLENTE conta como
 * Realizado pela soma das cobranças com status RECEBIDA no histórico do
 * Asaas (`valorRecebidoAsaas`, extraído do texto "[Asaas] Cobranças" — ver
 * asaas.ts no worker). Tarefas sem `situacaoFinanceira` (sem item de CRM
 * vinculado, ou vinculado a um Deal clássico sem esse campo — caso do grupo
 * COBRANÇA MENSAL) ficam de fora, como antes.
 */
export function calcularFaturamentoVigente(
  tarefas: Tarefa[],
  visao: VisaoDashboard = 'executora',
): DadosFaturamentoVigente {
  let totalRealizado = 0
  let totalPendente = 0
  let qtdPagos = 0
  let qtdPendentes = 0

  const porEquipeMap = new Map<string, FaturamentoPorEquipe>()
  EQUIPES_ATENDIMENTO.forEach((eq) => {
    porEquipeMap.set(eq, {
      equipe: eq,
      pago: 0,
      pendente: 0,
      total: 0,
      qtdPago: 0,
      qtdPendente: 0,
    })
  })

  const faturadoresMap = new Map<string, FaturadorRanking>()

  tarefas.forEach((tarefa) => {
    if (!tarefa.situacaoFinanceira) return

    const ehPago = tarefa.situacaoFinanceira === 'ADIMPLENTE'
    const valor = ehPago ? (tarefa.valorRecebidoAsaas ?? 0) : (tarefa.valorInadimplente ?? 0)
    if (valor <= 0) return

    const equipe = equipeDaTarefa(tarefa, visao)

    if (ehPago) {
      totalRealizado += valor
      qtdPagos += 1
    } else {
      totalPendente += valor
      qtdPendentes += 1
    }

    // Agrupa por equipe
    const dadoseq = porEquipeMap.get(equipe) ?? {
      equipe,
      pago: 0,
      pendente: 0,
      total: 0,
      qtdPago: 0,
      qtdPendente: 0,
    }
    if (ehPago) {
      dadoseq.pago += valor
      dadoseq.qtdPago += 1
    } else {
      dadoseq.pendente += valor
      dadoseq.qtdPendente += 1
    }
    dadoseq.total += valor
    porEquipeMap.set(equipe, dadoseq)

    // Agrupa por fechador / colaborador
    const nomeFechador =
      tarefa.fechadoPorNome || tarefa.responsavelAtendimentoNome || tarefa.responsavelNome
    if (nomeFechador && ehNomeDePessoa(nomeFechador)) {
      const faturador = faturadoresMap.get(nomeFechador) ?? {
        nome: nomeFechador,
        equipe: String(equipe),
        totalPago: 0,
        totalPendente: 0,
        qtdTarefas: 0,
      }
      if (ehPago) {
        faturador.totalPago += valor
      } else {
        faturador.totalPendente += valor
      }
      faturador.qtdTarefas += 1
      faturadoresMap.set(nomeFechador, faturador)
    }
  })

  const totalGeral = totalRealizado + totalPendente
  const ticketMedio = qtdPagos > 0 ? totalRealizado / qtdPagos : 0

  const topFechadores = Array.from(faturadoresMap.values())
    .sort((a, b) => b.totalPago - a.totalPago)
    .slice(0, 10)

  return {
    totalRealizado,
    totalPendente,
    totalGeral,
    ticketMedio,
    qtdPagos,
    qtdPendentes,
    porEquipe: Array.from(porEquipeMap.values()),
    topFechadores,
  }
}
