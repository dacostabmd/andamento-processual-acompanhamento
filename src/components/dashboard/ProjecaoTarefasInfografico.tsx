import { Badge, Button, SimpleGrid, Text, useComputedColorScheme } from '@mantine/core'
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
import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { obterProjecaoTarefas, type ProjecaoTarefas } from '../../services/projecaoApi'
import type { PacoteAtendimento } from '../../types/domain'
import { calcularTendenciaDiaria } from '../../utils/tarefasMetrics'
import { COR_POR_SITUACAO } from './tarefaApresentacao'
import classes from './ProjecaoTarefasInfografico.module.css'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Legend, Tooltip)

const COR_HISTORICO = COR_POR_SITUACAO.concluidas
const COR_PROJECAO = '#cba556'

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

interface ProjecaoTarefasInfograficoProps {
  pacotes: PacoteAtendimento[]
}

/** Projeção de IA dos próximos 30 dias, a partir da série diária dos últimos 30 dias. */
export function ProjecaoTarefasInfografico({ pacotes }: ProjecaoTarefasInfograficoProps) {
  const [projecao, setProjecao] = useState<ProjecaoTarefas | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const scheme = useComputedColorScheme('dark', { getInitialValueInEffect: true })
  const cores = useMemo(() => coresChrome(scheme), [scheme])

  const tendencia = useMemo(() => calcularTendenciaDiaria(pacotes, new Date()), [pacotes])

  async function aoGerarProjecao() {
    setCarregando(true)
    setErro(null)
    try {
      const serieDiaria = tendencia.map((p) => ({
        data: p.dia,
        total: p.concluidas,
        concluidas: p.concluidas,
      }))
      const resultado = await obterProjecaoTarefas(serieDiaria)
      setProjecao(resultado)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível gerar a projeção.')
    } finally {
      setCarregando(false)
    }
  }

  const dados = useMemo<ChartData<'line'>>(() => {
    const labelsHistorico = tendencia.map((p) => p.label)
    const valoresHistorico = tendencia.map((p) => p.concluidas)

    if (!projecao) {
      return {
        labels: labelsHistorico,
        datasets: [
          {
            label: 'Concluídas (últimos dias)',
            data: valoresHistorico,
            borderColor: COR_HISTORICO,
            backgroundColor: COR_HISTORICO,
            tension: 0.3,
            pointRadius: 2,
            fill: false,
          },
        ],
      }
    }

    const labelsProjecao = projecao.projecaoDiaria.map((p) => rotuloDeData(p.data))
    const ultimoHistorico = valoresHistorico[valoresHistorico.length - 1] ?? null

    return {
      labels: [...labelsHistorico, ...labelsProjecao],
      datasets: [
        {
          label: 'Concluídas (últimos dias)',
          data: [...valoresHistorico, ...labelsProjecao.map(() => null)],
          borderColor: COR_HISTORICO,
          backgroundColor: COR_HISTORICO,
          tension: 0.3,
          pointRadius: 2,
          fill: false,
        },
        {
          label: 'Projeção (IA)',
          data: [
            ...valoresHistorico.map(() => null),
            ultimoHistorico,
            ...projecao.projecaoDiaria.slice(1).map((p) => p.totalProjetado),
          ],
          borderColor: COR_PROJECAO,
          backgroundColor: COR_PROJECAO,
          borderDash: [6, 4],
          tension: 0.3,
          pointRadius: 2,
          fill: false,
        },
      ],
    }
  }, [tendencia, projecao])

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
    <div className={classes.cartao}>
      <Text className={classes.tituloCartao} fw={700} size="lg">
        Projeção de andamento — próximos 30 dias
      </Text>
      <Text className={classes.subtitulo} size="xs">
        Projeção calculada por IA a partir dos últimos {tendencia.length} dias com dado disponível.
      </Text>

      <div className={classes.areaGrafico}>
        <Line data={dados} options={opcoes} />
      </div>

      {!projecao && (
        <Button
          className={classes.botaoGerar}
          mt="md"
          loading={carregando}
          onClick={aoGerarProjecao}
        >
          Gerar projeção com IA
        </Button>
      )}

      {erro && (
        <Text size="xs" c="red" mt="xs">
          {erro}
        </Text>
      )}

      {projecao && (
        <>
          <Text className={classes.narrativa} size="sm" mt="md">
            {projecao.narrativa}
          </Text>

          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mt="md">
            {projecao.projecaoSemanal.map((semana) => (
              <div key={semana.semanaLabel}>
                <Text size="xl" fw={700} style={{ color: COR_PROJECAO }}>
                  {Math.round(semana.totalProjetado)}
                </Text>
                <Text size="xs" c="dimmed">
                  {semana.semanaLabel}
                </Text>
              </div>
            ))}
          </SimpleGrid>

          <Badge mt="md" variant="light" color="yellow">
            Modelo: {projecao.meta.modelo} · amostra de {projecao.meta.amostraDias} dia(s)
          </Badge>
        </>
      )}
    </div>
  )
}
