import { SimpleGrid, Tabs, Text } from '@mantine/core'
import { useMemo } from 'react'
import type { PacoteAtendimento, Tarefa } from '../../types/domain'
import {
  calcularFaturamentoVigente,
  calcularTendenciaDiaria,
  calcularTendenciaDiariaAtendimento,
  calcularTendenciaDiariaCriadas,
} from '../../utils/tarefasMetrics'
import { ProjecaoEstatisticaInfografico } from './ProjecaoEstatisticaInfografico'
import classes from './ProjecaoTarefasInfografico.module.css'
import { COR_POR_SITUACAO } from './tarefaApresentacao'

const COR_CRIADAS = COR_POR_SITUACAO.noPrazo
const COR_CONCLUIDAS = COR_POR_SITUACAO.concluidas
const COR_ATENDIMENTO = '#d6336c'

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

/** Recorta o início da série para o primeiro dia com dado real (evita mostrar dias zerados fora da janela de sync). */
function recortarParaDadoReal<T extends { valor: number }>(brutos: T[]): T[] {
  const primeiroIndiceComDados = brutos.findIndex((p) => p.valor > 0)
  if (primeiroIndiceComDados === -1) return brutos
  const inicio = Math.max(0, primeiroIndiceComDados - 1)
  return brutos.slice(inicio)
}

interface ProjecaoTabsProps {
  pacotes: PacoteAtendimento[]
  tarefasFiltradas: Tarefa[]
}

/**
 * Abas de projeção de andamento baseadas em métodos estatísticos para fluxo de trabalho (Kanban/Bitrix):
 * Regressão Linear (OLS), Média Móvel e Simulação de Monte Carlo por Throughput.
 */
export function ProjecaoTabs({ pacotes, tarefasFiltradas }: ProjecaoTabsProps) {
  const criadas = useMemo(
    () => recortarParaDadoReal(calcularTendenciaDiariaCriadas(pacotes, new Date())),
    [pacotes],
  )
  const atendimento = useMemo(
    () => recortarParaDadoReal(calcularTendenciaDiariaAtendimento(pacotes, new Date())),
    [pacotes],
  )
  const concluidasBrutas = useMemo(() => calcularTendenciaDiaria(pacotes, new Date()), [pacotes])
  const concluidas = useMemo(() => {
    const primeiroIndiceComDados = concluidasBrutas.findIndex((p) => p.concluidas > 0)
    if (primeiroIndiceComDados === -1) return concluidasBrutas
    const inicio = Math.max(0, primeiroIndiceComDados - 1)
    return concluidasBrutas.slice(inicio)
  }, [concluidasBrutas])

  const serieCriadas = useMemo(
    () => criadas.map((p) => ({ dia: p.dia, valor: p.valor })),
    [criadas],
  )
  const serieAtendimento = useMemo(
    () => atendimento.map((p) => ({ dia: p.dia, valor: p.valor })),
    [atendimento],
  )
  const serieConcluidas = useMemo(
    () => concluidas.map((p) => ({ dia: p.dia, valor: p.concluidas })),
    [concluidas],
  )

  const faturamento = useMemo(
    () => calcularFaturamentoVigente(tarefasFiltradas, 'executora'),
    [tarefasFiltradas],
  )

  return (
    <div className={classes.cartao}>
      <Text className={classes.tituloCartao} fw={700} size="lg">
        Projeção de andamento — próximos 30 dias
      </Text>
      <Text className={classes.subtitulo} size="xs">
        Selecione a métrica e o método estatístico de análise (Regressão Linear, Média Móvel ou Monte
        Carlo).
      </Text>

      <Tabs defaultValue="concluidas" keepMounted={false} mt="md">
        <Tabs.List>
          <Tabs.Tab value="criadas">Tarefas criadas</Tabs.Tab>
          <Tabs.Tab value="concluidas">Tarefas concluídas</Tabs.Tab>
          <Tabs.Tab value="atendimento">Previsão de atendimento</Tabs.Tab>
          <Tabs.Tab value="faturamento">Faturamento</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="criadas" pt="md">
          <Text size="xs" c="dimmed" mb="sm">
            Série diária pela data de criação do card ({serieCriadas.length} dia(s) com dado
            disponível).
          </Text>
          <Tabs defaultValue="regressao-linear" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="regressao-linear">Regressão Linear</Tabs.Tab>
              <Tabs.Tab value="media-movel">Média Móvel</Tabs.Tab>
              <Tabs.Tab value="monte-carlo">Monte Carlo (Throughput)</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="regressao-linear" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="regressao-linear"
                serie={serieCriadas}
                labelHistorico="Criadas (histórico)"
                corHistorico={COR_CRIADAS}
              />
            </Tabs.Panel>
            <Tabs.Panel value="media-movel" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="media-movel"
                serie={serieCriadas}
                labelHistorico="Criadas (histórico)"
                corHistorico={COR_CRIADAS}
              />
            </Tabs.Panel>
            <Tabs.Panel value="monte-carlo" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="monte-carlo"
                serie={serieCriadas}
                labelHistorico="Criadas (histórico)"
                corHistorico={COR_CRIADAS}
              />
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>

        <Tabs.Panel value="concluidas" pt="md">
          <Text size="xs" c="dimmed" mb="sm">
            Série diária pelo prazo final das tarefas concluídas ({serieConcluidas.length} dia(s) com
            dado disponível).
          </Text>
          <Tabs defaultValue="regressao-linear" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="regressao-linear">Regressão Linear</Tabs.Tab>
              <Tabs.Tab value="media-movel">Média Móvel</Tabs.Tab>
              <Tabs.Tab value="monte-carlo">Monte Carlo (Throughput)</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="regressao-linear" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="regressao-linear"
                serie={serieConcluidas}
                labelHistorico="Concluídas (histórico)"
                corHistorico={COR_CONCLUIDAS}
              />
            </Tabs.Panel>
            <Tabs.Panel value="media-movel" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="media-movel"
                serie={serieConcluidas}
                labelHistorico="Concluídas (histórico)"
                corHistorico={COR_CONCLUIDAS}
              />
            </Tabs.Panel>
            <Tabs.Panel value="monte-carlo" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="monte-carlo"
                serie={serieConcluidas}
                labelHistorico="Concluídas (histórico)"
                corHistorico={COR_CONCLUIDAS}
              />
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>

        <Tabs.Panel value="atendimento" pt="md">
          <Text size="xs" c="dimmed" mb="sm">
            Série diária de tarefas em atendimento geral ({serieAtendimento.length} dia(s) com dado
            disponível).
          </Text>
          <Tabs defaultValue="regressao-linear" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="regressao-linear">Regressão Linear</Tabs.Tab>
              <Tabs.Tab value="media-movel">Média Móvel</Tabs.Tab>
              <Tabs.Tab value="monte-carlo">Monte Carlo (Throughput)</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="regressao-linear" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="regressao-linear"
                serie={serieAtendimento}
                labelHistorico="Atendimento (histórico)"
                corHistorico={COR_ATENDIMENTO}
              />
            </Tabs.Panel>
            <Tabs.Panel value="media-movel" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="media-movel"
                serie={serieAtendimento}
                labelHistorico="Atendimento (histórico)"
                corHistorico={COR_ATENDIMENTO}
              />
            </Tabs.Panel>
            <Tabs.Panel value="monte-carlo" pt="md">
              <ProjecaoEstatisticaInfografico
                metodo="monte-carlo"
                serie={serieAtendimento}
                labelHistorico="Atendimento (histórico)"
                corHistorico={COR_ATENDIMENTO}
              />
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>

        <Tabs.Panel value="faturamento" pt="md">
          <Text size="sm" mt="xs">
            Sem projeção temporal para o momento: os valores do Asaas (situação financeira,
            recebido e inadimplente) são totais agregados por tarefa, sem uma data diária de
            referência — não há como distribuí-los dia a dia. Abaixo está o total atual do
            Faturamento Vigente.
          </Text>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mt="md">
            <div>
              <Text size="xl" fw={700} style={{ color: COR_POR_SITUACAO.concluidas }}>
                {formatarMoeda(faturamento.totalRealizado)}
              </Text>
              <Text size="xs" c="dimmed">
                Realizado ({faturamento.qtdPagos} tarefa(s))
              </Text>
            </div>
            <div>
              <Text size="xl" fw={700} style={{ color: COR_POR_SITUACAO.atrasadas }}>
                {formatarMoeda(faturamento.totalPendente)}
              </Text>
              <Text size="xs" c="dimmed">
                Pendente ({faturamento.qtdPendentes} tarefa(s))
              </Text>
            </div>
            <div>
              <Text size="xl" fw={700}>
                {formatarMoeda(faturamento.totalGeral)}
              </Text>
              <Text size="xs" c="dimmed">
                Total geral
              </Text>
            </div>
            <div>
              <Text size="xl" fw={700}>
                {formatarMoeda(faturamento.ticketMedio)}
              </Text>
              <Text size="xs" c="dimmed">
                Ticket médio
              </Text>
            </div>
          </SimpleGrid>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
