import { Text, useComputedColorScheme } from '@mantine/core'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { DadosGrafico } from '../../services/aiAssistantService'

// Registro idempotente — GraficosInteligencia.tsx já registra os mesmos
// elementos para os gráficos do dashboard; registrar de novo aqui não duplica
// nada (Chart.js ignora re-registro do mesmo elemento), e mantém este
// componente utilizável mesmo se um dia for importado sem o dashboard montado.
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

/**
 * Paleta das barras — cores distintas já usadas em outros gráficos do painel
 * (COR_POR_SITUACAO, COR_URGENCIA em GraficosInteligencia.tsx), reaproveitadas
 * aqui SEM o significado semântico delas: a categoria de uma barra pode ser
 * qualquer pessoa/equipe/setor que a pergunta trouxe, não necessariamente as
 * mesmas entidades que aquelas cores identificam nos outros gráficos.
 */
const PALETA = [
  '#2f6fb0',
  '#158a6f',
  '#c96a12',
  '#a44fc0',
  '#c0395a',
  '#b8791a',
  '#6b8f3f',
  '#3f7fa6',
]

function coresChrome(scheme: 'light' | 'dark') {
  return scheme === 'dark'
    ? { texto: '#c9c9c9', grade: 'rgba(255, 255, 255, 0.12)' }
    : { texto: '#333333', grade: 'rgba(0, 0, 0, 0.1)' }
}

interface Props {
  dados: DadosGrafico
  /** Chamado com a categoria (ex.: nome da pessoa) quando o usuário clica numa barra/rótulo. */
  onCategoriaClick?: (categoria: string) => void
}

/**
 * Gráfico de barras horizontal para uma resposta do assistente de IA.
 *
 * Horizontal (indexAxis: 'y'), não vertical: a categoria costuma ser nome de
 * pessoa/equipe/setor — texto de largura variável que quebra ou é cortado em
 * barras verticais. Na horizontal o rótulo tem a largura da coluna inteira.
 *
 * Altura proporcional ao número de barras, não fixa: 2 categorias e 10
 * categorias não deveriam ocupar o mesmo espaço nem ficar igualmente
 * espremidas.
 */
export function GraficoResposta({ dados, onCategoriaClick }: Props) {
  const scheme = useComputedColorScheme('dark', { getInitialValueInEffect: true })
  const cores = useMemo(() => coresChrome(scheme), [scheme])

  const chartData: ChartData<'bar'> = useMemo(
    () => ({
      labels: dados.categorias,
      datasets: [
        {
          label: dados.rotuloValor ?? 'valor',
          data: dados.valores,
          backgroundColor: dados.categorias.map((_, i) => PALETA[i % PALETA.length]),
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    }),
    [dados],
  )

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      // 'nearest' + eixo 'y' + intersect:false: o clique/hover resolve pela
      // linha inteira, não só quando o cursor está sobre a barra. É o que
      // torna o RÓTULO (nome da pessoa, à esquerda) clicável — ele é
      // desenhado no mesmo canvas, fora da área da barra, e sem isto o clique
      // ali não encontraria nenhum elemento.
      interaction: { mode: 'nearest', axis: 'y', intersect: false },
      onClick: onCategoriaClick
        ? (_event, elements) => {
            const indice = elements[0]?.index
            if (indice === undefined) return
            const categoria = dados.categorias[indice]
            if (categoria) onCategoriaClick(categoria)
          }
        : undefined,
      onHover: onCategoriaClick
        ? (event, elements) => {
            const alvo = event.native?.target as HTMLElement | undefined
            if (alvo) alvo.style.cursor = elements.length ? 'pointer' : 'default'
          }
        : undefined,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${ctx.formattedValue}${dados.rotuloValor ? ` ${dados.rotuloValor}` : ''}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: cores.grade },
          ticks: { color: cores.texto, precision: 0 },
        },
        y: {
          grid: { display: false },
          ticks: { color: cores.texto },
        },
      },
    }),
    [cores, dados.rotuloValor, dados.categorias, onCategoriaClick],
  )

  return (
    <div style={{ marginTop: 10 }}>
      {dados.titulo && (
        <Text size="xs" fw={600} mb={6} style={{ opacity: 0.85 }}>
          {dados.titulo}
        </Text>
      )}
      <div style={{ height: Math.max(90, dados.categorias.length * 32) }}>
        <Bar data={chartData} options={options} />
      </div>
      {onCategoriaClick && (
        <Text size="xs" c="dimmed" mt={4} style={{ opacity: 0.7 }}>
          Clique num nome para ver as tarefas
        </Text>
      )}
    </div>
  )
}
