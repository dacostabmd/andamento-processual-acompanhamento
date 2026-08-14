import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calcularMetricas,
  calcularMetricasPorEquipe,
  calcularTopFechadoPor,
  empacotarPorAtendimento,
  calcularRankingFechadores,
  equipeExecutoraDaTarefa,
  tarefaFoiConcluidaComAtraso,
} from './tarefasMetrics'
import type { Tarefa } from '../types/domain'

describe('calcularTopFechadoPor', () => {
  // Bug real: o gráfico "Fechado por" era calculado a partir de `pacotes`
  // filtrados pelo ripple de equipe de ATENDIMENTO — mas um fechador pode ter
  // a maioria dos cards dele atendidos por gente de OUTRAS equipes, então o
  // total aparecia artificialmente baixo (ex.: 2 em vez de 18 no gráfico,
  // enquanto o modal, que usa a lista crua, mostrava o valor certo).
  it('conta todos os cards do fechador, mesmo com responsáveis de atendimento variados', () => {
    const cards = [
      {
        id: 1,
        status: 5,
        fechadoPorId: 42,
        fechadoPorNome: 'Jonathan Weber',
        responsavelAtendimentoId: 1,
      },
      {
        id: 2,
        status: 5,
        fechadoPorId: 42,
        fechadoPorNome: 'Jonathan Weber',
        responsavelAtendimentoId: 2, // pessoa diferente, possivelmente outra equipe
      },
      {
        id: 3,
        status: 5,
        fechadoPorId: 42,
        fechadoPorNome: 'Jonathan Weber',
        responsavelAtendimentoId: 3, // idem
      },
    ] as unknown as Tarefa[]

    const ranking = calcularTopFechadoPor(cards)
    expect(ranking).toHaveLength(1)
    expect(ranking[0].total).toBe(3)
  })

  it('ignora tarefas não concluídas ou sem fechador', () => {
    const cards = [
      { id: 1, status: 5, fechadoPorId: 1, fechadoPorNome: 'A' },
      { id: 2, status: 2, fechadoPorId: null },
    ] as unknown as Tarefa[]
    const ranking = calcularTopFechadoPor(cards)
    expect(ranking).toHaveLength(1)
    expect(ranking[0].total).toBe(1)
  })
})

describe('tarefaFoiConcluidaComAtraso', () => {
  it('true quando concluída depois do prazo', () => {
    const tarefa = {
      status: 5,
      prazoFinal: '2024-01-10T12:00:00Z',
      finalizadoEm: '2024-01-11T12:00:00Z',
    } as Tarefa
    expect(tarefaFoiConcluidaComAtraso(tarefa)).toBe(true)
  })

  it('false quando concluída dentro do prazo', () => {
    const tarefa = {
      status: 5,
      prazoFinal: '2024-01-10T12:00:00Z',
      finalizadoEm: '2024-01-09T12:00:00Z',
    } as Tarefa
    expect(tarefaFoiConcluidaComAtraso(tarefa)).toBe(false)
  })

  it('false quando ainda não concluída, mesmo vencida', () => {
    const tarefa = { status: 3, prazoFinal: '2024-01-01T12:00:00Z', finalizadoEm: null } as Tarefa
    expect(tarefaFoiConcluidaComAtraso(tarefa)).toBe(false)
  })

  it('false quando concluída mas sem prazo ou sem data de finalização', () => {
    expect(
      tarefaFoiConcluidaComAtraso({
        status: 5,
        prazoFinal: null,
        finalizadoEm: '2024-01-11T12:00:00Z',
      } as Tarefa),
    ).toBe(false)
    expect(
      tarefaFoiConcluidaComAtraso({
        status: 5,
        prazoFinal: '2024-01-10T12:00:00Z',
        finalizadoEm: null,
      } as Tarefa),
    ).toBe(false)
  })
})

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
      { status: 6, prazoFinal: '2024-01-08T12:00:00Z' },
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
    expect(metricas.baseTaxaAtraso).toBe(5)
  })

  it('expõe a base pequena que explica uma taxa de 100% sem parecer erro', () => {
    // Caso real: um recorte (ex.: uma equipe específica) pode ter só 1 tarefa
    // ativa no momento. Se ela estiver atrasada, a taxa é 100% mesmo — não é
    // bug, é base pequena. baseTaxaAtraso existe para a UI mostrar "1 de 1"
    // em vez de só "100.0%" solto.
    const tarefas = [
      { status: 3, prazoFinal: '2024-01-01T12:00:00Z' }, // única ativa, atrasada
      { status: 5, prazoFinal: '2024-01-05T12:00:00Z' },
      { status: 5, prazoFinal: '2024-01-05T12:00:00Z' },
    ] as Tarefa[]

    const metricas = calcularMetricas(tarefas)
    expect(metricas.atrasadas).toBe(1)
    expect(metricas.baseTaxaAtraso).toBe(1)
    expect(metricas.taxaAtraso).toBe(100)
  })

  it('usa o total geral como base quando modoTaxaAtraso é "total"', () => {
    const tarefas = [
      { status: 3, prazoFinal: '2024-01-01T12:00:00Z' }, // atrasada
      { status: 5, prazoFinal: '2024-01-05T12:00:00Z' },
      { status: 5, prazoFinal: '2024-01-05T12:00:00Z' },
    ] as Tarefa[]

    const metricas = calcularMetricas(tarefas, 'total')
    expect(metricas.baseTaxaAtraso).toBe(3)
    expect(metricas.taxaAtraso).toBeCloseTo((1 / 3) * 100)
  })

  it('calcula métricas corretamente no modo apenasConcluidas (considerando atrasadas como concluídas entregues com atraso)', () => {
    const tarefas = [
      { status: 5, prazoFinal: '2024-01-10T12:00:00Z', finalizadoEm: '2024-01-09T12:00:00Z' }, // no prazo
      { status: 5, prazoFinal: '2024-01-10T12:00:00Z', finalizadoEm: '2024-01-12T12:00:00Z' }, // com atraso
      { status: 5, prazoFinal: '2024-01-10T12:00:00Z', finalizadoEm: '2024-01-08T12:00:00Z' }, // no prazo
    ] as Tarefa[]

    const metricas = calcularMetricas(tarefas, 'ativas', true)
    expect(metricas.total).toBe(3)
    expect(metricas.concluidas).toBe(3)
    expect(metricas.emAndamento).toBe(2) // 2 no prazo
    expect(metricas.atrasadas).toBe(1) // 1 entregue com atraso
    expect(metricas.taxaAtraso).toBeCloseTo((1 / 3) * 100)
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

  it('prefere equipeFechador, resolvida por ID de departamento no worker', () => {
    // Se os dois caminhos discordarem, vale o que veio por ID: o nome pode ter
    // sido renomeado no portal depois que o snapshot foi gravado.
    const tarefa = {
      equipeFechador: 'Lorena Pontes',
      fechadoPorDepartamentos: ['Andamento Simone Freitas'],
    } as Tarefa
    expect(equipeExecutoraDaTarefa(tarefa)).toBe('Lorena Pontes')
  })

  it('volta ao nome do departamento em snapshots antigos, sem equipeFechador', () => {
    const tarefa = {
      equipeFechador: 'indefinido',
      fechadoPorDepartamentos: ['Andamento Simone Freitas'],
    } as Tarefa
    expect(equipeExecutoraDaTarefa(tarefa)).toBe('Simone Freitas')
  })
})

describe('empacotarPorAtendimento — divergência entre as visões', () => {
  // Card real do snapshot: fechado pela equipe da Simone, mas com equipe de
  // atendimento (supervisor) resolvida para Cinthia — as duas visões precisam
  // discordar aqui.
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

  it('agrupa pela equipe de atendimento (supervisor) na visão de atendimento', () => {
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

  it('a equipe da pessoa não depende de qual card dela é o primeiro do array', () => {
    // Bug real: a equipe do pacote travava na do PRIMEIRO card processado. Um
    // filtro (ex.: "Ocultar dados indefinidos") que remove só o primeiro card
    // de uma pessoa — sem mexer nos demais — não pode mudar a equipe dela.
    const cardIndefinido = {
      id: 1,
      status: 5,
      responsavelAtendimentoId: 118684,
      responsavelAtendimentoNome: 'Lorena Pontes',
      equipeAtendimento: 'indefinido',
    } as unknown as Tarefa
    const cardLorena1 = {
      id: 2,
      status: 5,
      responsavelAtendimentoId: 118684,
      responsavelAtendimentoNome: 'Lorena Pontes',
      equipeAtendimento: 'Lorena Pontes',
    } as unknown as Tarefa
    const cardLorena2 = {
      id: 3,
      status: 5,
      responsavelAtendimentoId: 118684,
      responsavelAtendimentoNome: 'Lorena Pontes',
      equipeAtendimento: 'Lorena Pontes',
    } as unknown as Tarefa

    const comIndefinidoNaFrente = empacotarPorAtendimento([
      cardIndefinido,
      cardLorena1,
      cardLorena2,
    ])
    const semOIndefinido = empacotarPorAtendimento([cardLorena1, cardLorena2])

    expect(comIndefinidoNaFrente[0].equipe).toBe('Lorena Pontes')
    expect(semOIndefinido[0].equipe).toBe('Lorena Pontes')
  })

  it('só cai em indefinido quando TODOS os cards da pessoa são indefinido', () => {
    const cards = [
      {
        id: 1,
        status: 5,
        responsavelAtendimentoId: 42,
        responsavelAtendimentoNome: 'Fulano',
        equipeAtendimento: 'indefinido',
      },
      {
        id: 2,
        status: 5,
        responsavelAtendimentoId: 42,
        responsavelAtendimentoNome: 'Fulano',
        equipeAtendimento: 'indefinido',
      },
    ] as unknown as Tarefa[]
    const [pacote] = empacotarPorAtendimento(cards)
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
      pessoasSemSupervisor: 0,
    })
  })

  it('usa fallback de nome quando o fechador não tem nome resolvido', () => {
    const r = calcularRankingFechadores([card({ fechadoPorId: 999, fechadoPorNome: null })])
    expect(r.linhas[0].nome).toBe('Usuário 999')
  })

  it('traz setor e supervisor do cadastro da pessoa', () => {
    const r = calcularRankingFechadores([
      card({
        fechadoPorId: 5305,
        fechadoPorNome: 'Alguém do TI',
        setorFechador: 'Suporte e Desenvolvimento (TI)',
        gestorFechadorNome: 'Gabriel Alves',
      }),
    ])
    expect(r.linhas[0].setor).toBe('Suporte e Desenvolvimento (TI)')
    expect(r.linhas[0].supervisor).toBe('Gabriel Alves')
    expect(r.pessoasSemSupervisor).toBe(0)
  })

  it('conta quem está sem supervisor cadastrado', () => {
    // ~39% das pessoas caem aqui: o departamento delas (e os superiores) não
    // têm UF_HEAD definido no Bitrix. É falta de cadastro, não de chefia.
    const r = calcularRankingFechadores([
      card({ fechadoPorId: 1, fechadoPorNome: 'Com', gestorFechadorNome: 'Chefe' }),
      card({ fechadoPorId: 2, fechadoPorNome: 'Sem', gestorFechadorNome: null }),
    ])
    expect(r.pessoasSemSupervisor).toBe(1)
  })

  it('infere o supervisor pelo nome da equipe quando o setor é conhecido mas o UF_HEAD não está cadastrado', () => {
    // Caso real: "Wellington Ramos" tem setor "Andamento Quézia Karen" (logo
    // equipeAtendimento/equipeFechador = 'Quézia Karen'), mas o campo
    // "Supervisor" da ficha dele no Bitrix está vazio. As 4 equipes são
    // batizadas com o nome da própria supervisora, então a equipe já responde.
    const r = calcularRankingFechadores([
      card({
        fechadoPorId: 42,
        fechadoPorNome: 'Wellington Ramos',
        fechadoPorDepartamentos: ['Andamento Quézia Karen'],
        setorFechador: 'Andamento Quézia Karen',
        gestorFechadorNome: null,
      }),
    ])
    expect(r.linhas[0].equipe).toBe('Quézia Karen')
    expect(r.linhas[0].supervisor).toBe('Quézia Karen')
    expect(r.pessoasSemSupervisor).toBe(0)
  })

  it('desempata por nome quando o volume é igual', () => {
    const r = calcularRankingFechadores([
      card({ fechadoPorId: 2, fechadoPorNome: 'Zoe' }),
      card({ fechadoPorId: 1, fechadoPorNome: 'Ana' }),
    ])
    expect(r.linhas.map((l) => l.nome)).toEqual(['Ana', 'Zoe'])
  })
})
