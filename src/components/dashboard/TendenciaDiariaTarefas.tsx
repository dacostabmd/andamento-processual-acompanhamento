import { Text, useComputedColorScheme } from '@mantine/core'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { useCallback, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { PacoteAtendimento } from '../../types/domain'
import { calcularTendenciaDiaria, chaveDia, tarefaEstaConcluida } from '../../utils/tarefasMetrics'
import { EstadoVazio } from '../EstadoVazio'
import type { MetricaSelecionada } from './MetricaTarefasModal'
import { COR_POR_SITUACAO } from './tarefaApresentacao'
import classes from './TendenciaDiariaTarefas.module.css'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Legend, Tooltip)

const COR_CONCLUIDAS = COR_POR_SITUACAO.concluidas

function coresChrome(scheme: 'light' | 'dark') {
  if (scheme === 'dark') {
    return { texto: '#c9c9c9', grade: 'rgba(255, 255, 255, 0.12)' }
  }
  return { texto: '#333333', grade: 'rgba(0, 0, 0, 0.1)' }
}

interface TendenciaDiariaTarefasProps {
  pacotes: PacoteAtendimento[]
  onSelecionarMetrica: (metrica: MetricaSelecionada) => void
}

/** Gráfico "tarefas por dia" — últimos 30 dias reais disponíveis, por prazoFinal. */
export function TendenciaDiariaTarefas({
  pacotes,
  onSelecionarMetrica,
}: TendenciaDiariaTarefasProps) {
  const scheme = useComputedColorScheme('dark', { getInitialValueInEffect: true })
  const cores = useMemo(() => coresChrome(scheme), [scheme])

  const tendencia = useMemo(() => calcularTendenciaDiaria(pacotes, new Date()), [pacotes])
  const cardsTotais = useMemo(() => pacotes.flatMap((p) => p.cards), [pacotes])

  const aoClicarPonto = useCallback(
    (index: number) => {
      const ponto = tendencia[index]
      if (!ponto) return
      const tarefas = cardsTotais.filter(
        (t) =>
          tarefaEstaConcluida(t) &&
          t.finalizadoEm !== null &&
          t.prazoFinal !== null &&
          chaveDia(new Date(t.prazoFinal)) === ponto.dia,
      )
      onSelecionarMetrica({
        titulo: `Concluídas em ${ponto.label}`,
        subtitulo: `${tarefas.length} tarefa(s) concluída(s) com prazo em ${ponto.label}.`,
        tarefas,
      })
    },
    [tendencia, cardsTotais, onSelecionarMetrica],
  )

  const dados = useMemo<ChartData<'line'>>(
    () => ({
      labels: tendencia.map((p) => p.label),
      datasets: [
        {
          label: 'Concluídas',
          data: tendencia.map((p) => p.concluidas),
          borderColor: COR_CONCLUIDAS,
          backgroundColor: COR_CONCLUIDAS,
          tension: 0.3,
          pointRadius: 3,
          fill: false,
        },
      ],
    }),
    [tendencia],
  )

  const opcoes = useMemo<ChartOptions<'line'>>(
    () => ({
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: cores.texto, maxRotation: 0 } },
        y: {
          beginAtZero: true,
          grid: { color: cores.grade },
          ticks: { color: cores.texto, precision: 0 },
        },
      },
      onClick: (_event, elements) => {
        const index = elements[0]?.index
        if (index !== undefined) aoClicarPonto(index)
      },
      onHover: (event, elements) => {
        const target = event.native?.target as HTMLElement | null
        if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
      },
    }),
    [cores, aoClicarPonto],
  )

  const totalNoPeriodo = tendencia.reduce((soma, p) => soma + p.concluidas, 0)

  if (totalNoPeriodo === 0) {
    return (
      <EstadoVazio
        titulo="Sem dados para o período"
        descricao="Ajuste os filtros para visualizar as tarefas concluídas por dia."
      />
    )
  }

  return (
    <div className={classes.cartao}>
      <Text className={classes.tituloCartao} fw={700} size="lg">
        Tarefas por dia
      </Text>
      <Text className={classes.subtitulo} size="xs">
        Volume concluído por dia de prazo, últimos {tendencia.length} dias com dado disponível.
      </Text>
      <div className={classes.areaGrafico}>
        <Line data={dados} options={opcoes} />
      </div>
    </div>
  )
}
