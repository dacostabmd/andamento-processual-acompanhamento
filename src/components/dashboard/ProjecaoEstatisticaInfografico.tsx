import { Alert, Badge, SimpleGrid, Text, useComputedColorScheme } from '@mantine/core'
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
import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  projetarMediaMovel,
  projetarMonteCarlo,
  projetarRegressaoLinear,
  type PontoSerieNumerica,
  type ResultadoProjecaoEstatistica,
} from '../../utils/projecaoEstatistica'
import classes from './ProjecaoTarefasInfografico.module.css'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Legend, Tooltip)

export type MetodoEstatistico = 'regressao-linear' | 'media-movel' | 'monte-carlo'

const COR_POR_METODO: Record<MetodoEstatistico, string> = {
  'regressao-linear': '#228be6',
  'media-movel': '#b8791a',
  'monte-carlo': '#12b886',
}

const LABEL_DATASET_PROJECAO: Record<MetodoEstatistico, string> = {
  'regressao-linear': 'Projeção (Regressão Linear)',
  'media-movel': 'Projeção (Média Móvel)',
  'monte-carlo': 'Projeção (Monte Carlo - P50)',
}

export const EXPLICACAO_METODO: Record<MetodoEstatistico, string> = {
  'regressao-linear':
    'Cálculo: Regressão Linear por Mínimos Quadrados Ordinários (OLS y = ax + b). ' +
    'Calcula a tendência matemática constante da série histórica recente e projeta a inclinação ' +
    'de entregas para os próximos 30 dias.',
  'media-movel':
    'Cálculo: Média móvel ponderada da janela recente (7 a 14 dias), mantida constante para ' +
    'os próximos 30 dias. Serve como baseline estável sem interferência de picos isolados.',
  'monte-carlo':
    'Cálculo: Simulação estocástica de Monte Carlo (1.000 iterações) baseada na distribuição real ' +
    'de Throughput (vazão diária). Gera cenários probabilísticos: P50 (Mediana/Esperado), ' +
    'P10 (Conservador com 90% de confiança) e P90 (Otimista).',
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
    if (metodo === 'regressao-linear') return projetarRegressaoLinear(serie)
    if (metodo === 'monte-carlo') return projetarMonteCarlo(serie)
    return projetarMediaMovel(serie)
  }, [metodo, serie])

  const dados = useMemo<ChartData<'line'>>(() => {
    const labelsHistorico = serie.map((p) => rotuloDeData(p.dia))
    const valoresHistorico = serie.map((p) => p.valor)
    const labelsProjecao = resultado.projecaoDiaria.map((p) => rotuloDeData(p.dia))
    const ultimoHistorico = valoresHistorico[valoresHistorico.length - 1] ?? null

    const datasets: ChartData<'line'>['datasets'] = [
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
    ]

    if (metodo === 'monte-carlo') {
      datasets.push({
        label: 'Monte Carlo (Conservador P10)',
        data: [
          ...valoresHistorico.map(() => null),
          ultimoHistorico,
          ...resultado.projecaoDiaria.slice(1).map((p) => p.valorConservador ?? p.valorProjetado),
        ],
        borderColor: '#fa5252',
        backgroundColor: '#fa5252',
        borderDash: [2, 2],
        tension: 0.3,
        pointRadius: 1,
        fill: false,
      })

      datasets.push({
        label: 'Monte Carlo (Otimista P90)',
        data: [
          ...valoresHistorico.map(() => null),
          ultimoHistorico,
          ...resultado.projecaoDiaria.slice(1).map((p) => p.valorOtimista ?? p.valorProjetado),
        ],
        borderColor: '#40c057',
        backgroundColor: '#40c057',
        borderDash: [2, 2],
        tension: 0.3,
        pointRadius: 1,
        fill: false,
      })
    }

    return {
      labels: [...labelsHistorico, ...labelsProjecao],
      datasets,
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
        {resultado.narrativa}
      </Text>

      {resultado.meta.alertaHistoricoCurto && (
        <Alert
          icon={<AlertTriangle size={16} />}
          color="yellow"
          variant="light"
          mt="xs"
          title="Histórico reduzido de dados"
        >
          <Text size="xs">
            A amostra histórica atual contém apenas {resultado.meta.amostraDias} dia(s). Projeções de
            30 dias com amostras inferiores a 14 dias possuem maior margem de variação devido a
            finais de semana e concentração pontual de prazos.
          </Text>
        </Alert>
      )}

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

              {metodo === 'monte-carlo' && semana.totalConservador !== undefined && (
                <Text size="xs" c="dimmed">
                  P10: {semana.totalConservador} | P90: {semana.totalOtimista}
                </Text>
              )}
            </div>
          ))}
        </SimpleGrid>
      )}

      <Badge mt="md" variant="light" color="blue">
        Método:{' '}
        {metodo === 'regressao-linear'
          ? 'Regressão Linear (OLS)'
          : metodo === 'monte-carlo'
            ? 'Monte Carlo / Throughput (1.000 simulações)'
            : 'Média Móvel'}
        {' · '}amostra de {resultado.meta.amostraDias} dia(s)
      </Badge>
    </div>
  )
}
