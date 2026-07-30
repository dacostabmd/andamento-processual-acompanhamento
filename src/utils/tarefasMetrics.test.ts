import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calcularMetricas,
  calcularMetricasPorEquipe,
  empacotarPorAtendimento,
  calcularRankingFechadores,
  equipeExecutoraDaTarefa,
} from './tarefasMetrics'
import type { Tarefa } from '../types/domain'

describe('calcularMetricas', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calcula as métricas de andamento e risco corretamente', () => {
    const tarefas: Partial<Tarefa>[] = [
      // 1. Em Andamento (No prazo, > 3 dias)
      { status: 3, prazoFinal: '2024-01-15T12:00:00Z' }, 
      // 2. Vence em breve (No prazo, <= 3 dias)
      { status: 3, prazoFinal: '2024-01-12T12:00:00Z' }, 
      // 3. Vence em breve (Status 4)
      { status: 4, prazoFinal: '2024-01-11T12:00:00Z' },
      // 4. Atrasada (Vencida, status 3)
      { status: 3, prazoFinal: '2024-01-09T12:00:00Z' },
      // 5. Atrasada (Vencida, status 4)
      { status: 4, prazoFinal: '2024-01-08T12:00:00Z' },
      // 6. Concluída (vencida, mas não conta como atrasada pois concluiu)
      { status: 5, prazoFinal: '2024-01-09T12:00:00Z' },
      // 7. Concluída (no prazo)
      { status: 5, prazoFinal: '2024-01-15T12:00:00Z' },
      // 8. Adiada (Status 6)
      { status: 6, prazoFinal: '2024-01-08T12:00:00Z' }
    ]

    const metricas = calcularMetricas(tarefas as Tarefa[])

    expect(metricas.total).toBe(8)
    expect(metricas.concluidas).toBe(2)
    expect(metricas.atrasadas).toBe(2) // 4 e 5
    expect(metricas.vencemEmBreve).toBe(2) // 2 e 3
    expect(metricas.aguardandoRevisao).toBe(2) // 3 e 5
    expect(metricas.emAndamento).toBe(3) // 1, 2 e 3 (menor que 5, e >= agora)
    expect(metricas.eficiencia).toBe(25) // (2 / 8) * 100
    // ativas: total(8) - concluidas(2) - adiadas(1) = 5
    // taxaAtraso: atrasadas(2) / ativas(5) = 40%
    expect(metricas.taxaAtraso).toBe(40) 
  })
})

describe('equipeExecutoraDaTarefa', () => {
  it('resolve a equipe pelo departamento de quem fechou o card', () => {
    const tarefa = {
      fechadoPorDepartamentos: ['Andamento Simone Freitas'],
    } as Tarefa
    expect(equipeExecutoraDaTarefa(tarefa)).toBe('Simone Freitas')
  })

  it('ignora departamentos que não são de equipe de andamento', () => {
    const tarefa = {
      fechadoPorDepartamentos: ['FINANCEIRO', 'Presidência'],
    } as Tarefa
    expect(equipeExecutoraDaTarefa(tarefa)).toBe('indefinido')
  })

  it('escolhe uma única equipe quando o fechador está em dois departamentos', () => {
    // Caso real do snapshot: 992 cards têm exatamente esta combinação. Contar o
    // card nas duas equipes inflaria a soma dos totais.
    const tarefa = {
      fechadoPorDepartamentos: ['Andamento Lorena Pontes', 'Andamento Cinthia Filgueiras'],
    } as Tarefa
    // Ordem canônica de EQUIPES_ATENDIMENTO: Cinthia vem antes de Lorena.
    expect(equipeExecutoraDaTarefa(tarefa)).toBe('Cinthia Filgueiras')
  })

  it('cai em indefinido quando o card ainda não foi fechado', () => {
    expect(equipeExecutoraDaTarefa({ fechadoPorDepartamentos: [] } as unknown as Tarefa)).toBe(
      'indefinido',
    )
  })

  it('tolera espaços em volta do nome do departamento', () => {
    const tarefa = {
      fechadoPorDepartamentos: ['  Andamento Quézia Karen  '],
    } as Tarefa
    expect(equipeExecutoraDaTarefa(tarefa)).toBe('Quézia Karen')
  })
})

describe('empacotarPorAtendimento — divergência entre as visões', () => {
  // Card real do snapshot: fechado pela equipe da Simone, mas com a Cinthia
  // como participante — as duas visões precisam discordar aqui.
  const card = {
    id: 1,
    status: 5,
    prazoFinal: '2024-01-15T12:00:00Z',
    fechadoPorId: 157328,
    fechadoPorNome: 'Rayane Fernandes',
    fechadoPorDepartamentos: ['Andamento Simone Freitas'],
    responsavelAtendimentoId: 118684,
    responsavelAtendimentoNome: 'Cinthia Filgueiras',
    equipeAtendimento: 'Cinthia Filgueiras',
  } as unknown as Tarefa

  it('agrupa pelo participante na visão de atendimento', () => {
    const [pacote] = empacotarPorAtendimento([card], 'atendimento')
    expect(pacote.responsavelAtendimentoNome).toBe('Cinthia Filgueiras')
    expect(pacote.equipe).toBe('Cinthia Filgueiras')
  })

  it('agrupa por quem fechou, na equipe real do fechador, na visão executora', () => {
    const [pacote] = empacotarPorAtendimento([card], 'executora')
    expect(pacote.responsavelAtendimentoNome).toBe('Rayane Fernandes')
    expect(pacote.equipe).toBe('Simone Freitas')
  })

  it('mantém a visão de atendimento como padrão', () => {
    const [pacote] = empacotarPorAtendimento([card])
    expect(pacote.equipe).toBe('Cinthia Filgueiras')
  })

  it('rotula cards não fechados na visão executora', () => {
    const aberto = {
      id: 2,
      status: 2,
      fechadoPorId: null,
      fechadoPorNome: null,
      fechadoPorDepartamentos: [],
      responsavelAtendimentoId: 118684,
      responsavelAtendimentoNome: 'Cinthia Filgueiras',
      equipeAtendimento: 'Cinthia Filgueiras',
    } as unknown as Tarefa
    const [pacote] = empacotarPorAtendimento([aberto], 'executora')
    expect(pacote.responsavelAtendimentoNome).toBe('Ainda não fechado')
    expect(pacote.equipe).toBe('indefinido')
  })
})

describe('calcularMetricasPorEquipe por visão', () => {
  const cards = [
    {
      status: 5,
      fechadoPorDepartamentos: ['Andamento Simone Freitas'],
      equipeAtendimento: 'Cinthia Filgueiras',
    },
    {
      status: 5,
      fechadoPorDepartamentos: ['Andamento Quézia Karen'],
      equipeAtendimento: 'Cinthia Filgueiras',
    },
  ] as unknown as Tarefa[]

  it('concentra tudo na Cinthia na visão de atendimento', () => {
    const porEquipe = calcularMetricasPorEquipe(cards, 'ativas', 'atendimento')
    const cinthia = porEquipe.find((e) => e.equipe === 'Cinthia Filgueiras')!
    expect(cinthia.metricas.total).toBe(2)
  })

  it('distribui entre as equipes reais dos fechadores na visão executora', () => {
    const porEquipe = calcularMetricasPorEquipe(cards, 'ativas', 'executora')
    expect(porEquipe.find((e) => e.equipe === 'Cinthia Filgueiras')!.metricas.total).toBe(0)
    expect(porEquipe.find((e) => e.equipe === 'Simone Freitas')!.metricas.total).toBe(1)
    expect(porEquipe.find((e) => e.equipe === 'Quézia Karen')!.metricas.total).toBe(1)
  })
})

describe('calcularRankingFechadores', () => {
  function card(p: Partial<Tarefa>): Tarefa {
    return {
      id: Math.random(),
      titulo: 'x',
      prazoFinal: null,
      status: 5,
      finalizadoEm: null,
      projetoId: 86,
      projetoNome: 'ACOMPANHAMENTO MENSAL',
      fechadoPorId: null,
      fechadoPorNome: null,
      fechadoPorDepartamentos: [],
      responsavelId: null,
      responsavelNome: null,
      prioridade: '1',
      responsavelAtendimentoId: null,
      responsavelAtendimentoNome: null,
      equipeAtendimento: 'indefinido',
      estadoUf: null,
      ...p,
    } as Tarefa
  }

  it('ordena por volume de cards fechados', () => {
    const r = calcularRankingFechadores([
      card({ fechadoPorId: 1, fechadoPorNome: 'Anna' }),
      card({ fechadoPorId: 1, fechadoPorNome: 'Anna' }),
      card({ fechadoPorId: 2, fechadoPorNome: 'Isabelly' }),
    ])
    expect(r.linhas.map((l) => l.nome)).toEqual(['Anna', 'Isabelly'])
    expect(r.linhas[0].total).toBe(2)
    expect(r.totalFechado).toBe(3)
  })

  it('resolve a equipe pelo departamento do fechador, não pelo participante', () => {
    // O caso que motivou a visão executora: card fechado por alguém da equipe da
    // Simone, mas com a Cinthia como participante.
    const r = calcularRankingFechadores([
      card({
        fechadoPorId: 157328,
        fechadoPorNome: 'Rayane Fernandes',
        fechadoPorDepartamentos: ['Andamento Simone Freitas'],
        equipeAtendimento: 'Cinthia Filgueiras',
      }),
    ])
    expect(r.linhas[0].equipe).toBe('Simone Freitas')
  })

  it('exclui cards não concluídos e os contabiliza à parte', () => {
    const r = calcularRankingFechadores([
      card({ status: 5, fechadoPorId: 1, fechadoPorNome: 'Anna' }),
      card({ status: 2, fechadoPorId: null }),
      card({ status: 3, fechadoPorId: null }),
    ])
    expect(r.totalFechado).toBe(1)
    expect(r.naoConcluidas).toBe(2)
  })

  it('exclui concluídas sem fechador e as contabiliza à parte', () => {
    // Não vira uma linha "Não informado" no ranking: não é uma pessoa.
    const r = calcularRankingFechadores([
      card({ status: 5, fechadoPorId: 1, fechadoPorNome: 'Anna' }),
      card({ status: 5, fechadoPorId: null }),
    ])
    expect(r.linhas).toHaveLength(1)
    expect(r.concluidasSemFechador).toBe(1)
  })

  it('separa no prazo, com atraso e sem prazo', () => {
    const r = calcularRankingFechadores([
      card({
        fechadoPorId: 1,
        fechadoPorNome: 'Anna',
        prazoFinal: '2024-01-10T12:00:00Z',
        finalizadoEm: '2024-01-09T12:00:00Z', // antes do prazo
      }),
      card({
        fechadoPorId: 1,
        fechadoPorNome: 'Anna',
        prazoFinal: '2024-01-10T12:00:00Z',
        finalizadoEm: '2024-01-12T12:00:00Z', // depois do prazo
      }),
      card({ fechadoPorId: 1, fechadoPorNome: 'Anna', prazoFinal: null, finalizadoEm: null }),
    ])
    const anna = r.linhas[0]
    expect(anna.total).toBe(3)
    expect(anna.noPrazo).toBe(1)
    expect(anna.comAtraso).toBe(1)
    expect(anna.semPrazo).toBe(1)
  })

  it('calcula o percentual sobre o total fechado', () => {
    const r = calcularRankingFechadores([
      card({ fechadoPorId: 1, fechadoPorNome: 'A' }),
      card({ fechadoPorId: 1, fechadoPorNome: 'A' }),
      card({ fechadoPorId: 1, fechadoPorNome: 'A' }),
      card({ fechadoPorId: 2, fechadoPorNome: 'B' }),
    ])
    expect(r.linhas[0].percentual).toBe(75)
    expect(r.linhas[1].percentual).toBe(25)
  })

  it('não quebra com lista vazia', () => {
    const r = calcularRankingFechadores([])
    expect(r).toEqual({
      linhas: [],
      totalFechado: 0,
      concluidasSemFechador: 0,
      naoConcluidas: 0,
    })
  })

  it('usa fallback de nome quando o fechador não tem nome resolvido', () => {
    const r = calcularRankingFechadores([card({ fechadoPorId: 999, fechadoPorNome: null })])
    expect(r.linhas[0].nome).toBe('Usuário 999')
  })

  it('desempata por nome quando o volume é igual', () => {
    const r = calcularRankingFechadores([
      card({ fechadoPorId: 2, fechadoPorNome: 'Zoe' }),
      card({ fechadoPorId: 1, fechadoPorNome: 'Ana' }),
    ])
    expect(r.linhas.map((l) => l.nome)).toEqual(['Ana', 'Zoe'])
  })
})
