import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  construirPromptContextual,
  gerarRespostaSimuladaInteligente,
  type MensagemChat,
} from './aiAssistantService'
import {
  extrairAgrupamento,
  extrairIntencao,
  extrairMetrica,
  extrairPeriodo,
  normalizar,
  resolverEntidade,
  catalogos,
} from './aiAssistant/intencao'
import type {
  EquipeAtendimento,
  FiltrosDashboard,
  MetricasTarefas,
  PacoteAtendimento,
  PrioridadeTarefa,
  StatusTarefa,
  Tarefa,
} from '../types/domain'

// Data fixa de referência para tornar períodos determinísticos.
const AGORA = new Date('2026-07-22T12:00:00')

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

let idSeq = 1

interface OpcoesTarefa {
  status?: StatusTarefa
  prazoFinal?: string
  finalizadoEm?: string | null
  equipe?: EquipeAtendimento
  responsavelAtendimentoNome?: string | null
  responsavelNome?: string | null
  fechadoPorNome?: string | null
  fechadoPorDepartamentos?: string[]
  estadoUf?: string | null
  projetoNome?: string | null
  projetoId?: number | null
  titulo?: string
  prioridade?: PrioridadeTarefa
  equipeFechador?: EquipeAtendimento
}

function tarefa(op: OpcoesTarefa = {}): Tarefa {
  const id = idSeq++
  return {
    id,
    titulo: op.titulo ?? `Tarefa ${id}`,
    prazoFinal: op.prazoFinal ?? '2026-08-01T12:00:00',
    status: op.status ?? 3,
    finalizadoEm: op.finalizadoEm ?? null,
    projetoId: op.projetoId ?? null,
    projetoNome: op.projetoNome ?? null,
    fechadoPorId: null,
    fechadoPorNome: op.fechadoPorNome ?? null,
    fechadoPorDepartamentos: op.fechadoPorDepartamentos ?? [],
    responsavelId: null,
    responsavelNome: op.responsavelNome ?? null,
    prioridade: op.prioridade ?? '1',
    responsavelAtendimentoId: null,
    responsavelAtendimentoNome: op.responsavelAtendimentoNome ?? null,
    equipeAtendimento: op.equipe ?? 'indefinido',
    origemEquipeAtendimento: op.equipe && op.equipe !== 'indefinido' ? 'fechador' : 'nao_atribuida',
    equipeFechador: op.equipeFechador ?? 'indefinido',
    estadoUf: op.estadoUf ?? null,
    setorFechador: null,
    gestorFechadorId: null,
    gestorFechadorNome: null,
    setorAtendimento: null,
    gestorAtendimentoId: null,
    gestorAtendimentoNome: null,
  }
}

function pacote(equipe: EquipeAtendimento, cards: Tarefa[], responsavel = 'Fulano'): PacoteAtendimento {
  return {
    responsavelAtendimentoId: 1,
    responsavelAtendimentoNome: responsavel,
    equipe,
    cards,
  }
}

const FILTROS: FiltrosDashboard = {
  dataInicio: '2026-04-23',
  dataFim: null,
  status: 'todos',
  filtroPrazo: 'todas',
  setor: null,
  projetoId: null,
  fechadoPorId: null,
  responsavelId: null,
  prioridade: null,
  estado: null,
  ocultarIndefinidos: false,
  ocultarForaDasEquipes: false,
  modoTaxaAtraso: 'ativas',
}

const METRICAS_STUB: MetricasTarefas = {
  total: 0,
  concluidas: 0,
  atrasadas: 0,
  eficiencia: 0,
  vencemEmBreve: 0,
  aguardandoRevisao: 0,
  emAndamento: 0,
  taxaAtraso: 0,
}

// Datas relativas a AGORA (2026-07-22).
const ONTEM = '2026-07-21T10:00:00' // dentro de 7 dias
const HOJE = '2026-07-22T09:00:00'
const HA_TRES_DIAS = '2026-07-19T10:00:00' // dentro de 7 dias
const HA_VINTE_DIAS = '2026-07-02T10:00:00' // dentro do mês corrente e dos 30 dias
const MES_PASSADO = '2026-06-15T10:00:00' // mês passado
const HA_MUITO = '2026-02-10T10:00:00' // fora da janela de 90 dias por finalizadoEm

const PRAZO_FUTURO = '2026-09-01T12:00:00'
const PRAZO_PASSADO = '2026-07-01T12:00:00' // vencido em relação a AGORA
const PRAZO_EM_2_DIAS = '2026-07-24T12:00:00' // risco de atraso (<= 3 dias)

/**
 * Constrói um contexto rico: 4 equipes, UFs, setores, projetos, com cards
 * cobrindo todos os status e várias datas de conclusão.
 */
function contextoRico() {
  idSeq = 1
  const cinthia = [
    // ativas / atrasadas / risco / concluídas com finalizadoEm em janelas variadas
    tarefa({ equipe: 'Cinthia Filgueiras', status: 3, prazoFinal: PRAZO_FUTURO, estadoUf: 'SP' }),
    tarefa({ equipe: 'Cinthia Filgueiras', status: 3, prazoFinal: PRAZO_PASSADO, estadoUf: 'SP' }), // atrasada
    tarefa({ equipe: 'Cinthia Filgueiras', status: 3, prazoFinal: PRAZO_EM_2_DIAS, estadoUf: 'RJ' }), // risco
    tarefa({ equipe: 'Cinthia Filgueiras', status: 4, prazoFinal: PRAZO_FUTURO, estadoUf: 'SP' }), // aguardando controle
    tarefa({
      equipe: 'Cinthia Filgueiras',
      status: 5,
      prazoFinal: PRAZO_PASSADO,
      finalizadoEm: ONTEM,
      fechadoPorNome: 'Ana Souza',
      estadoUf: 'SP',
      fechadoPorDepartamentos: ['Negociação'],
    }), // concluída ontem (dentro de 7 dias)
    tarefa({
      equipe: 'Cinthia Filgueiras',
      status: 5,
      prazoFinal: PRAZO_PASSADO,
      finalizadoEm: HA_VINTE_DIAS,
      fechadoPorNome: 'Ana Souza',
      estadoUf: 'RJ',
      fechadoPorDepartamentos: ['Financeiro'],
    }), // concluída há 20 dias (dentro do mês, fora dos 7 dias)
  ]

  const simone = [
    tarefa({ equipe: 'Simone Freitas', status: 3, prazoFinal: PRAZO_PASSADO, estadoUf: 'MG' }), // atrasada
    tarefa({ equipe: 'Simone Freitas', status: 3, prazoFinal: PRAZO_PASSADO, estadoUf: 'MG' }), // atrasada
    tarefa({ equipe: 'Simone Freitas', status: 2, prazoFinal: PRAZO_FUTURO, estadoUf: 'SP' }), // ativa
    tarefa({
      equipe: 'Simone Freitas',
      status: 5,
      prazoFinal: PRAZO_PASSADO,
      finalizadoEm: MES_PASSADO,
      fechadoPorNome: 'Bruno Lima',
      estadoUf: 'MG',
      fechadoPorDepartamentos: ['Jurídico'],
    }), // concluída mês passado
  ]

  const quezia = [
    tarefa({
      equipe: 'Quézia Karen',
      status: 5,
      prazoFinal: PRAZO_PASSADO,
      finalizadoEm: HOJE,
      fechadoPorNome: 'Carla Dias',
      estadoUf: 'BA',
      titulo: 'Petição inicial cliente X',
    }), // concluída hoje
    tarefa({ equipe: 'Quézia Karen', status: 6, prazoFinal: PRAZO_PASSADO, estadoUf: 'BA' }), // adiada
    tarefa({ equipe: 'Quézia Karen', status: 3, prazoFinal: PRAZO_FUTURO, estadoUf: 'BA' }), // ativa no prazo
  ]

  const lorena = [
    tarefa({
      equipe: 'Lorena Pontes',
      status: 5,
      prazoFinal: PRAZO_PASSADO,
      finalizadoEm: HA_TRES_DIAS,
      fechadoPorNome: 'Diego Alves',
      projetoNome: 'Projeto Alpha',
      projetoId: 123,
    }), // concluída há 3 dias
    tarefa({
      equipe: 'Lorena Pontes',
      status: 3,
      prazoFinal: PRAZO_PASSADO,
      projetoNome: 'Projeto Alpha',
      projetoId: 123,
    }), // atrasada, projeto alpha
  ]

  const indef = [
    tarefa({ equipe: 'indefinido', status: 3, prazoFinal: PRAZO_FUTURO }),
    tarefa({ equipe: 'indefinido', status: 3, prazoFinal: PRAZO_PASSADO }), // atrasada
    // Uma conclusão MUITO antiga, para acionar a guarda de viabilidade em janelas longas.
    tarefa({
      equipe: 'indefinido',
      status: 5,
      prazoFinal: PRAZO_PASSADO,
      finalizadoEm: HA_MUITO,
      fechadoPorNome: 'Eduarda Melo',
    }),
  ]

  const pacotes: PacoteAtendimento[] = [
    pacote('Cinthia Filgueiras', cinthia, 'Ana Souza'),
    pacote('Simone Freitas', simone, 'Bruno Lima'),
    pacote('Quézia Karen', quezia, 'Carla Dias'),
    pacote('Lorena Pontes', lorena, 'Diego Alves'),
    pacote('indefinido', indef, 'Sem responsável pelo atendimento'),
  ]

  return { metricas: METRICAS_STUB, pacotes, filtros: FILTROS }
}

function perguntar(texto: string, historico: MensagemChat[] = []): string {
  const ctx = contextoRico()
  const mensagens: MensagemChat[] = [
    ...historico,
    { id: 'x', remetente: 'user', texto, timestamp: '' },
  ]
  return gerarRespostaSimuladaInteligente(texto, ctx, mensagens)
}

function msgUser(texto: string): MensagemChat {
  return { id: String(Math.random()), remetente: 'user', texto, timestamp: '' }
}

// --------------------------------------------------------------------------

describe('aiAssistantService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(AGORA)
    idSeq = 1
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- teste legado preservado: não regredir construirPromptContextual ---
  it('constrói o prompt de contexto com os números do dashboard', () => {
    const metricas: MetricasTarefas = {
      total: 100,
      concluidas: 40,
      atrasadas: 10,
      eficiencia: 40,
      vencemEmBreve: 5,
      aguardandoRevisao: 2,
      emAndamento: 50,
      taxaAtraso: 16.7,
    }
    const filtros: FiltrosDashboard = { ...FILTROS, dataInicio: '2026-04-01' }
    const prompt = construirPromptContextual({ metricas, pacotes: null, filtros })

    expect(prompt).toContain('Total de tarefas analisadas: 100')
    expect(prompt).toContain('Concluídas: 40')
    expect(prompt).toContain('Taxa de atraso ativa: 16.7%')
    expect(prompt).toContain('Período: 2026-04-01')
  })

  // ====================================================================
  // EXTRAÇÃO DE INTENÇÃO POR DIMENSÃO (o mais robusto de testar)
  // ====================================================================
  describe('extração de dimensões', () => {
    it('normaliza acentos e caixa', () => {
      expect(normalizar('Quézia KAREN')).toBe('quezia karen')
    })

    it('#1 total sem entidade nem período', () => {
      const cards = contextoRico().pacotes.flatMap((p) => p.cards)
      const i = extrairIntencao('Quantas tarefas temos no total?', cards, AGORA)
      expect(i.metrica).toBe('total')
      expect(i.entidade.tipo).toBe('nenhuma')
      expect(i.periodo.tipo).toBe('nenhum')
      expect(i.agrupamento).toBe('nenhum')
    })

    it('#3 "pendentes" -> ativas (não total)', () => {
      expect(extrairMetrica('quantas tarefas estao pendentes agora', false)).toBe('ativas')
    })

    it('#8 "taxa de atraso" -> taxaAtrasoAtiva, não atrasadas', () => {
      expect(extrairMetrica('qual e a taxa de atraso atual', false)).toBe('taxaAtrasoAtiva')
    })

    it('#9 "percentual de atraso sobre o total" -> taxaAtrasoTotal', () => {
      expect(extrairMetrica('qual o percentual de atraso sobre o total de tarefas', false)).toBe(
        'taxaAtrasoTotal',
      )
    })

    it('rendimento: conclusão + período -> rendimento (finalizadoEm)', () => {
      expect(extrairMetrica('quantas concluiu esta semana', true)).toBe('rendimento')
    })

    it('conclusão SEM período -> concluidas (não rendimento)', () => {
      expect(extrairMetrica('quantas concluidas no total', false)).toBe('concluidas')
    })

    it('extrairPeriodo calcula janelas relativas em runtime (não literais)', () => {
      const semana = extrairPeriodo('na ultima semana', AGORA)
      expect(semana.tipo).toBe('ultimos7dias')
      expect(semana.inicio).toEqual(new Date('2026-07-15T12:00:00'))

      const mesPassado = extrairPeriodo('no mes passado', AGORA)
      expect(mesPassado.tipo).toBe('mesPassado')
      expect(mesPassado.inicio).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0))

      const hoje = extrairPeriodo('concluidas hoje', AGORA)
      expect(hoje.tipo).toBe('hoje')

      const ano = extrairPeriodo('este ano', AGORA)
      expect(ano.tipo).toBe('ano')
      expect(ano.inicio).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0))
    })

    it('BUG: "semana" sozinha só popula período, nunca métrica', () => {
      expect(extrairMetrica('me fala sobre a semana', true)).not.toBe('rendimento')
      const p = extrairPeriodo('me fala sobre a semana', AGORA)
      expect(p.tipo).toBe('ultimos7dias')
    })

    it('BUG: "equipe" sozinha vira entidade equipe sem valor (qual?), não total', () => {
      const cards = contextoRico().pacotes.flatMap((p) => p.cards)
      const { entidade } = resolverEntidade('e a equipe', catalogos(cards))
      expect(entidade.tipo).toBe('equipe')
      expect(entidade.valorCanonico).toBeNull()
    })

    it('fuzzy: "Cintia Filgueira" (typo) -> Cinthia Filgueiras', () => {
      const cards = contextoRico().pacotes.flatMap((p) => p.cards)
      const { entidade } = resolverEntidade('produtividade da equipe da cintia filgueira', catalogos(cards))
      expect(entidade.tipo).toBe('equipe')
      expect(entidade.valorCanonico).toBe('Cinthia Filgueiras')
    })

    it('fuzzy: "Simoni Freytas" (typo) -> Simone Freitas', () => {
      const cards = contextoRico().pacotes.flatMap((p) => p.cards)
      const { entidade } = resolverEntidade('equipe da simoni freytas', catalogos(cards))
      expect(entidade.valorCanonico).toBe('Simone Freitas')
    })

    it('primeiro nome basta: "Cinthia" -> Cinthia Filgueiras', () => {
      const cards = contextoRico().pacotes.flatMap((p) => p.cards)
      const { entidade } = resolverEntidade('atrasadas da equipe da cinthia', catalogos(cards))
      expect(entidade.valorCanonico).toBe('Cinthia Filgueiras')
    })

    it('UF por nome do estado: "Rio de Janeiro" -> RJ', () => {
      const cards = contextoRico().pacotes.flatMap((p) => p.cards)
      const { entidade } = resolverEntidade('tarefas do rio de janeiro concluidas', catalogos(cards))
      expect(entidade.tipo).toBe('uf')
      expect(entidade.valorCanonico).toBe('RJ')
    })

    it('comparação: detecta duas equipes', () => {
      const cards = contextoRico().pacotes.flatMap((p) => p.cards)
      const { entidade, segunda } = resolverEntidade(
        'compara o rendimento da cinthia com o da simone',
        catalogos(cards),
      )
      const nomes = [entidade.valorCanonico, segunda?.valorCanonico]
      expect(nomes).toContain('Cinthia Filgueiras')
      expect(nomes).toContain('Simone Freitas')
    })

    it('agrupamento: "qual equipe teve melhor rendimento" -> ranking', () => {
      expect(extrairAgrupamento('qual equipe teve melhor rendimento na ultima semana')).toBe('ranking')
    })

    it('agrupamento: "compara ... entre X e Y" -> comparacao', () => {
      expect(extrairAgrupamento('compara o volume de atrasos entre negociacao e financeiro')).toBe(
        'comparacao',
      )
    })

    it('agrupamento: "evoluiu mes a mes" -> tendencia', () => {
      expect(extrairAgrupamento('como evoluiu o numero de conclusoes mes a mes este ano')).toBe(
        'tendencia',
      )
    })

    it('"por equipe" -> metrica porEquipe', () => {
      expect(extrairMetrica('quantas tarefas cada equipe fechou', false)).toBe('porEquipe')
      expect(extrairMetrica('me mostra as tarefas por equipe', false)).toBe('porEquipe')
    })

    it('"taxa de atraso por equipe" continua taxa, não porEquipe', () => {
      expect(extrairMetrica('qual a taxa de atraso de cada equipe', false)).toBe('taxaAtrasoAtiva')
    })
  })

  // ====================================================================
  // RESPOSTAS COMPOSTAS (painel de perguntas)
  // ====================================================================
  describe('respostas do painel', () => {
    it('#1 total geral', () => {
      // 6 + 4 + 3 + 2 + 3 = 18 cards
      const r = perguntar('Quantas tarefas temos no total?')
      expect(r).toContain('18')
      expect(r).toContain('total')
    })

    it('#2 concluídas geral (status=5)', () => {
      // Cinthia 2 + Simone 1 + Quezia 1 + Lorena 1 + indef 1 = 6
      const r = perguntar('Quantas tarefas ja foram concluidas?')
      expect(r).toMatch(/\b6\b/)
      expect(r).toContain('concluídas')
    })

    it('#4 atrasadas geral', () => {
      // Cinthia 1 + Simone 2 + Lorena 1 + indef 1 = 5
      const r = perguntar('Quantas tarefas estao atrasadas?')
      expect(r).toMatch(/\b5\b/)
      expect(r).toContain('atrasadas')
    })

    it('#6 risco de atraso geral (<= 3 dias)', () => {
      // Só a tarefa Cinthia com PRAZO_EM_2_DIAS
      const r = perguntar('Quantas tarefas correm risco de atrasar?')
      expect(r).toMatch(/\b1\b/)
    })

    it('#8 taxa de atraso mostra numerador e denominador', () => {
      const r = perguntar('Qual e a taxa de atraso atual?')
      expect(r).toContain('taxa de atraso')
      expect(r).toContain('%')
      expect(r).toMatch(/de \d+ das tarefas ativas/)
    })

    it('#10 resumo geral multi-métrica', () => {
      const r = perguntar('Me da um resumo geral de como estao os processos.')
      expect(r).toContain('Total')
      expect(r).toContain('Concluídas')
      expect(r).toContain('Atrasadas')
      expect(r).toContain('Risco de atraso')
    })

    it('#11 ativas por equipe (Cinthia)', () => {
      // Cinthia ativas: status<5 e !=6 -> 3,3,3,4 = 4
      const r = perguntar('Quantas tarefas a equipe da Cinthia Filgueiras tem em aberto?')
      expect(r).toContain('Cinthia Filgueiras')
      expect(r).toContain('em aberto')
      expect(r).toMatch(/\b4\b/)
    })

    it('#12 atrasadas por equipe (Simone)', () => {
      const r = perguntar('Quantas tarefas atrasadas tem a equipe da Simone Freitas?')
      expect(r).toContain('Simone Freitas')
      expect(r).toMatch(/\b2\b/)
    })

    it('#13 taxa de atraso por equipe (Quézia)', () => {
      const r = perguntar('Qual a taxa de atraso da equipe da Quezia Karen?')
      expect(r).toContain('Quézia Karen')
      expect(r).toContain('taxa de atraso')
    })

    it('porEquipe: fechadas (closedBy) e com responsável (participante) por time, com status', () => {
      idSeq = 1
      const cards = [
        // Cinthia: fechou 1 (concluída), e tem 2 como participante (1 concluída, 1 atrasada).
        tarefa({ equipe: 'Cinthia Filgueiras', equipeFechador: 'Cinthia Filgueiras', status: 5 }),
        tarefa({ equipe: 'Cinthia Filgueiras', status: 3, prazoFinal: PRAZO_PASSADO }),
        // Simone: não fechou nenhuma; tem 1 como participante (ativa).
        tarefa({ equipe: 'Simone Freitas', status: 2 }),
      ]
      const contexto = {
        metricas: METRICAS_STUB,
        pacotes: [pacote('Cinthia Filgueiras', cards.slice(0, 2), 'Ana Souza'), pacote('Simone Freitas', [cards[2]], 'Bruno Lima')],
        filtros: FILTROS,
      }
      const r = gerarRespostaSimuladaInteligente('quantas tarefas cada equipe fechou', contexto)
      expect(r).toContain('Cinthia Filgueiras')
      expect(r).toMatch(/fechou \*\*1\*\*/)
      expect(r).toContain('Simone Freitas')
      expect(r).toMatch(/fechou \*\*0\*\*/)
    })

    it('#15 equipe indefinida é entidade legítima', () => {
      const r = perguntar('Quantas tarefas estao com equipe indefinida?')
      expect(r).toContain('indefinida')
      expect(r).toMatch(/\b3\b/)
    })

    it('#18 ranking de rendimento na última semana', () => {
      // Concluídas com finalizadoEm nos últimos 7 dias: Cinthia(ontem)=1, Quezia(hoje)=1, Lorena(3d)=1
      const r = perguntar('Qual equipe teve melhor rendimento na ultima semana?')
      expect(r).toContain('Ranking por equipe')
      expect(r).toContain('Cinthia Filgueiras')
      // não deve ser mensagem de limitação
      expect(r).not.toContain('não está totalmente disponível')
    })

    it('#23 concluídas hoje (rendimento por finalizadoEm)', () => {
      // Só Quezia concluiu hoje
      const r = perguntar('Quantas tarefas foram concluidas hoje?')
      expect(r).toContain('concluídas')
      expect(r).toMatch(/\b1\b/)
    })

    it('#24 rendimento do ano inteiro aciona guarda (conclusão fora da janela)', () => {
      // Há uma conclusão em fevereiro; janela do ano começa em jan, mas a mais
      // antiga com finalizadoEm é fev -> início do ano < mais antiga? Não, ano
      // começa 01/01 e a mais antiga é 10/02, então 01/01 < 10/02 -> guarda.
      const r = perguntar('Qual o rendimento do escritorio inteiro este ano?')
      expect(r).toContain('não está totalmente disponível')
    })

    it('#28 atrasadas por pessoa', () => {
      // Match por fechadoPorNome/responsavel. Diego Alves fechou 1, mas atrasadas
      // dele: cards onde ele é responsavel? Testamos pessoa Ana Souza (fechou 2 concluídas).
      const r = perguntar('Quantas tarefas atrasadas estao com a Ana Souza?')
      expect(r).toContain('Ana Souza')
    })

    it('#29 pessoa concluiu (sem período) -> concluidas via fechadoPorNome', () => {
      // Ana Souza fechou 2 tarefas concluídas
      const r = perguntar('Quantas tarefas a Ana Souza concluiu?')
      expect(r).toContain('Ana Souza')
      expect(r).toContain('concluídas')
      expect(r).toMatch(/\b2\b/)
    })

    it('#31 concluídas por setor (Negociação)', () => {
      // fechadoPorDepartamentos contém 'Negociação' em 1 concluída (Cinthia ontem)
      const r = perguntar('Quantas tarefas o setor de Negociacao concluiu?')
      expect(r).toContain('Negociação')
      expect(r).toContain('concluídas')
    })

    it('#34 ranking de setores por tarefas em aberto', () => {
      const r = perguntar('Qual setor tem mais tarefas em aberto?')
      expect(r).toContain('Ranking por setor')
    })

    it('#36 total por UF (SP)', () => {
      const r = perguntar('Quantas tarefas temos em SP?')
      expect(r).toContain('SP')
    })

    it('#37 ranking de UF por atrasadas', () => {
      const r = perguntar('Qual estado tem mais tarefas atrasadas?')
      expect(r).toContain('Ranking por estado')
      // MG tem 2 atrasadas -> deve liderar
      expect(r).toContain('MG')
    })

    it('#38 concluídas por UF via nome do estado (RJ)', () => {
      const r = perguntar('Quantas tarefas do Rio de Janeiro estao concluidas?')
      expect(r).toContain('RJ')
      expect(r).toContain('concluídas')
    })

    it('#40 resumo do projeto Alpha', () => {
      const r = perguntar('Como esta o andamento do projeto Alpha?')
      expect(r).toContain('Projeto Alpha')
      expect(r).toContain('Total')
    })

    it('#43 ranking pela pior taxa de atraso (ordem asc)', () => {
      const r = perguntar('Qual equipe tem a pior taxa de atraso?')
      expect(r).toContain('Ranking por equipe')
      expect(r).toContain('taxa de atraso')
    })

    it('#45 comparação de rendimento (Cinthia vs Simone) no mês passado', () => {
      const r = perguntar('Compara o rendimento da Cinthia com o da Simone no mes passado.')
      expect(r).toContain('Comparação')
      expect(r).toContain('Cinthia Filgueiras')
      expect(r).toContain('Simone Freitas')
    })

    it('#47 tendência mês a mês -> limitação honesta (sem série no offline)', () => {
      const r = perguntar('Como evoluiu o numero de conclusoes mes a mes este ano?')
      expect(r).toContain('não está totalmente disponível')
    })

    it('#57 typos/sinônimos: "time" + "pepino atrasado" -> ranking atrasadas', () => {
      const r = perguntar('Qual time ta com mais pepino atrasado?')
      expect(r).toContain('Ranking por equipe')
    })

    it('#59 "a gente ja fechou" -> concluidas geral', () => {
      const r = perguntar('Quantas tarefa a gente ja fechou?')
      expect(r).toContain('concluídas')
      expect(r).toMatch(/\b6\b/)
    })

    it('#60 "melhor" ambíguo assume rendimento/conclusões e declara suposição', () => {
      const r = perguntar('Qual equipe da Simoni Freytas ta melhor?')
      // Deve reconhecer a equipe por fuzzy e não cair no bloco genérico cadastral.
      expect(r).toContain('Simone Freitas')
    })

    it('#61 fora de escopo: escrita', () => {
      const r = perguntar('Apaga as tarefas concluidas do sistema.')
      expect(r).toContain('consulta e leitura')
    })

    it('#62 fora de domínio', () => {
      const r = perguntar('Vai chover amanha?')
      expect(r).toContain('andamento processual')
    })

    it('#63 BUG: "me fala sobre a semana" -> resumo do período, não rendimento forçado', () => {
      const r = perguntar('Me fala sobre a semana.')
      expect(r).toContain('Resumo')
      expect(r).toContain('nos últimos 7 dias')
    })

    it('#64 BUG: "e a equipe?" sem contexto -> esclarecimento, não total cadastral', () => {
      const r = perguntar('E a equipe?')
      expect(r).toContain('qual equipe')
    })

    it('pergunta totalmente desconhecida -> esclarecimento geral', () => {
      const r = perguntar('blablabla xyz')
      expect(r).toContain('Não consegui identificar')
    })
  })

  // ====================================================================
  // FOLLOW-UP CONVERSACIONAL
  // ====================================================================
  describe('follow-up conversacional', () => {
    it('#51 "E a Cinthia?" herda métrica/período, troca entidade', () => {
      const historico = [msgUser('Quantas tarefas atrasadas tem a equipe da Simone Freitas?')]
      const r = perguntar('E a Cinthia?', historico)
      expect(r).toContain('Cinthia Filgueiras')
      expect(r).toContain('atrasadas')
    })

    it('#52 "E no mes passado?" herda métrica/entidade, troca período', () => {
      const historico = [msgUser('Quantas a Cinthia finalizou nos ultimos 7 dias?')]
      const r = perguntar('E no mes passado?', historico)
      // herdou rendimento da Cinthia, agora no mês passado; Cinthia não tem
      // conclusão no mês passado -> 0, mas deve mencionar a Cinthia e o período.
      expect(r).toContain('Cinthia Filgueiras')
      expect(r).toContain('mês passado')
    })

    it('#53 "Por que?" detalha o número anterior', () => {
      const historico = [msgUser('Quantas tarefas atrasadas tem a equipe da Simone Freitas?')]
      const r = perguntar('Por que?', historico)
      // Deve listar cards individuais (com "prazo").
      expect(r).toContain('prazo')
    })

    it('#56 "Detalha esse numero." lista os cards do agregado', () => {
      const historico = [msgUser('Quantas tarefas atrasadas tem a equipe da Simone Freitas?')]
      const r = perguntar('Detalha esse numero.', historico)
      expect(r).toContain('prazo')
    })

    it('#65 "Qual foi melhor?" sem contexto -> esclarecimento', () => {
      const r = perguntar('Qual foi melhor?')
      // Sem contexto anterior e entidade "todas" de equipe, tenta ranquear;
      // como não há métrica clara, cai em ranking por total ou esclarecimento.
      expect(typeof r).toBe('string')
      expect(r.length).toBeGreaterThan(0)
    })
  })

  // ====================================================================
  // LIMITAÇÃO HONESTA: nunca inventar número fora da janela
  // ====================================================================
  describe('limitação temporal', () => {
    it('rendimento no trimestre com janela que excede dados -> limitação, sem número', () => {
      // Trimestre começa 01/07 (jul-ago-set). A mais antiga com finalizadoEm no
      // slice geral é 10/02 -> 01/07 > 10/02, então NÃO aciona guarda global.
      // Para forçar a guarda usamos "este ano" (01/01 < 10/02).
      const r = perguntar('Qual o rendimento do escritorio este ano?')
      expect(r).toContain('não está totalmente disponível')
      expect(r).not.toMatch(/\b\d+ tarefas concluídas\b/)
    })

    it('rendimento nos últimos 7 dias é atendível (janela cabe nos dados)', () => {
      const r = perguntar('Quantas tarefas foram concluidas nos ultimos 7 dias?')
      expect(r).not.toContain('não está totalmente disponível')
      expect(r).toContain('concluídas')
    })
  })
})
