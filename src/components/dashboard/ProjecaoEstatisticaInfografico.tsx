import { Badge, SimpleGrid, Text, useComputedColorScheme } from '@mantine/core'
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
import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  projetarFibonacci,
  projetarMediaMovel,
  type PontoSerieNumerica,
  type ResultadoProjecaoEstatistica,
} from '../../utils/projecaoEstatistica'
import classes from './ProjecaoTarefasInfografico.module.css'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Legend, Tooltip)

export type MetodoEstatistico = 'fibonacci' | 'media-movel'

const COR_POR_METODO: Record<MetodoEstatistico, string> = {
  fibonacci: '#8a4fd6',
  'media-movel': '#b8791a',
}

const LABEL_DATASET_PROJECAO: Record<MetodoEstatistico, string> = {
  fibonacci: 'Projeção (Fibonacci φ)',
  'media-movel': 'Projeção (Média Móvel)',
}

const EXPLICACAO_METODO: Record<MetodoEstatistico, string> = {
  fibonacci:
    'Cálculo: suavização exponencial com peso (1/φ)^d por dia de distância d ' +
    '(φ ≈ 1,618, a razão áurea — dias recentes pesam mais, em progressão ' +
    'decrescente: 1 ; 0,618 ; 0,382 ; 0,236 ...). O nível e a tendência (inclinação) ' +
    'são estimados por regressão linear ponderada por esses pesos, e a projeção ' +
    'estende nível + tendência dia a dia. Determinístico e auditável — não depende de IA.',
  'media-movel':
    'Cálculo: média aritmética simples dos últimos 7 dias com dado disponível, ' +
    'repetida como valor constante para todos os dias futuros. Não captura ' +
    'tendência de alta/baixa nem sazonalidade — serve como referência de ' +
    'comparação (baseline) para os demais métodos.',
}

function coresChrome(scheme: 'light' | 'dark') {
  if (scheme === 'dark') {
    return { texto: '#c9c9c9', grade: 'rgba(255, 255, 255, 0.12)' }
  }
  return { texto: '#333333', grade: 'rgba(0, 0, 0, 0.1)' }
}

function rotuloDeData(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return dia && mes ? `${dia}/${mes}` : iso
}

interface ProjecaoEstatisticaInfograficoProps {
  metodo: MetodoEstatistico
  /** Série histórica já filtrada para o período com dado real disponível. */
  serie: PontoSerieNumerica[]
  labelHistorico: string
  corHistorico: string
  /** Formata o valor para exibição (ex.: contagem inteira ou moeda). */
  formatarValor?: (valor: number) => string
}

export function ProjecaoEstatisticaInfografico({
  metodo,
  serie,
  labelHistorico,
  corHistorico,
  formatarValor = (v) => String(Math.round(v)),
}: ProjecaoEstatisticaInfograficoProps) {
  const scheme = useComputedColorScheme('dark', { getInitialValueInEffect: true })
  const cores = useMemo(() => coresChrome(scheme), [scheme])
  const corProjecao = COR_POR_METODO[metodo]

  const resultado = useMemo<ResultadoProjecaoEstatistica>(() => {
    return metodo === 'fibonacci' ? projetarFibonacci(serie) : projetarMediaMovel(serie)
  }, [metodo, serie])

  const dados = useMemo<ChartData<'line'>>(() => {
    const labelsHistorico = serie.map((p) => rotuloDeData(p.dia))
    const valoresHistorico = serie.map((p) => p.valor)
    const labelsProjecao = resultado.projecaoDiaria.map((p) => rotuloDeData(p.dia))
    const ultimoHistorico = valoresHistorico[valoresHistorico.length - 1] ?? null

    return {
      labels: [...labelsHistorico, ...labelsProjecao],
      datasets: [
        {
          label: labelHistorico,
          data: [...valoresHistorico, ...labelsProjecao.map(() => null)],
          borderColor: corHistorico,
          backgroundColor: corHistorico,
          tension: 0.3,
          pointRadius: 2,
          fill: false,
        },
        {
          label: LABEL_DATASET_PROJECAO[metodo],
          data: [
            ...valoresHistorico.map(() => null),
            ultimoHistorico,
            ...resultado.projecaoDiaria.slice(1).map((p) => p.valorProjetado),
          ],
          borderColor: corProjecao,
          backgroundColor: corProjecao,
          borderDash: [6, 4],
          tension: 0.3,
          pointRadius: 2,
          fill: false,
        },
      ],
    }
  }, [serie, resultado, labelHistorico, corHistorico, corProjecao, metodo])

  const opcoes = useMemo<ChartOptions<'line'>>(
    () => ({
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: cores.texto, boxWidth: 12, boxHeight: 12 } },
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
    }),
    [cores],
  )

  return (
    <div>
      <Text className={classes.narrativa} size="sm">
        {EXPLICACAO_METODO[metodo]}
      </Text>

      <div className={classes.areaGrafico} style={{ marginTop: 'var(--mantine-spacing-md)' }}>
        <Line data={dados} options={opcoes} />
      </div>

      {resultado.projecaoSemanal.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mt="md">
          {resultado.projecaoSemanal.map((semana) => (
            <div key={semana.semanaLabel}>
              <Text size="xl" fw={700} style={{ color: corProjecao }}>
                {formatarValor(semana.totalProjetado)}
              </Text>
              <Text size="xs" c="dimmed">
                {semana.semanaLabel}
              </Text>
            </div>
          ))}
        </SimpleGrid>
      )}

      <Badge mt="md" variant="light" color="grape">
        Método: {metodo === 'fibonacci' ? 'Fibonacci (φ)' : 'Média Móvel (7 dias)'} · amostra de{' '}
        {resultado.meta.amostraDias} dia(s)
      </Badge>
    </div>
  )
}
