import { Text, useComputedColorScheme } from '@mantine/core'
import {
  ArcElement,
  BarElement,
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
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  EQUIPES_ATENDIMENTO,
  type EquipeAtendimento,
  type InteligenciaDados,
  type PacoteAtendimento,
  type VisaoDashboard,
} from '../../types/domain'
import { calcularInteligencia } from '../../utils/tarefasMetrics'
import { EstadoVazio } from '../EstadoVazio'
import { COR_POR_EQUIPE, COR_POR_SITUACAO } from './tarefaApresentacao'
import classes from './GraficosInteligencia.module.css'

// Registra só os elementos usados (Chart.js é tree-shakeable).
ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
)

// Cor única para séries de série-única sem semântica de equipe (Fechado por, UF).
const COR_FECHADO_POR = '#2f6fb0'
const COR_UF = '#158a6f'
// Cores das duas séries de tendência mensal — concluídas (positivo) e taxa de
// atraso (atenção), reaproveitando os tons semânticos já usados em COR_POR_SITUACAO.
const COR_TENDENCIA_CONCLUIDAS = COR_POR_SITUACAO.concluidas
const COR_TENDENCIA_ATRASO = COR_POR_SITUACAO.atrasadas
// Faixas de urgência: gradiente verde->vermelho conforme a proximidade do vencimento.
const COR_URGENCIA: Record<keyof import('../../types/domain').FaixasUrgencia, string> = {
  vencidas: '#c0395a',
  ateTresDias: '#d1685f',
  quatroASeteDias: '#b8791a',
  oitoAQuinzeDias: '#8a9a1a',
  maisDeQuinzeDias: '#158a6f',
}

/**
 * Cores de chrome do gráfico (texto de eixos/legenda, grade e o "gap" entre
 * marcas) derivadas do tema ativo. As cores das SÉRIES (barras/fatias) NÃO
 * entram aqui — elas identificam equipes/situações e são fixas
 * (COR_POR_EQUIPE / COR_POR_SITUACAO), independentes do modo claro/escuro.
 *
 * O "gap" é a cor da superfície do cartão (o vão de 2px entre marcas empilhadas
 * deve casar com o fundo do cartão), então muda entre os modos junto com ela.
 */
function coresChrome(scheme: 'light' | 'dark') {
  if (scheme === 'dark') {
    return {
      texto: '#c9c9c9',
      grade: 'rgba(255, 255, 255, 0.12)',
      gap: '#262626', // = --superficie do modo escuro
    }
  }
  return {
    texto: '#333333',
    grade: 'rgba(0, 0, 0, 0.1)',
    gap: '#ffffff', // = --superficie do modo normal (claro)
  }
}

const ORDEM_EQUIPES: EquipeAtendimento[] = [...EQUIPES_ATENDIMENTO, 'indefinido']

/** Rótulo de exibição da equipe — só "indefinido" difere do nome interno (capitalizado). */
function rotuloEquipe(equipe: EquipeAtendimento): string {
  return equipe === 'indefinido' ? 'Indefinido' : equipe
}

// Situações na ordem de empilhamento; rótulo + cor semântica reservada.
const SITUACOES: Array<{ chave: keyof typeof COR_POR_SITUACAO; label: string }> = [
  { chave: 'noPrazo', label: 'No prazo' },
  { chave: 'adiadas', label: 'Adiadas' },
  { chave: 'concluidas', label: 'Concluídas' },
  { chave: 'atrasadas', label: 'Atrasadas' },
]

// Faixas de urgência na ordem de mais crítica para mais confortável.
const FAIXAS_URGENCIA_LABELS: Array<{
  chave: keyof import('../../types/domain').FaixasUrgencia
  label: string
}> = [
  { chave: 'vencidas', label: 'Vencidas' },
  { chave: 'ateTresDias', label: 'Até 3 dias' },
  { chave: 'quatroASeteDias', label: '4 a 7 dias' },
  { chave: 'oitoAQuinzeDias', label: '8 a 15 dias' },
  { chave: 'maisDeQuinzeDias', label: 'Mais de 15 dias' },
]

interface GraficosInteligenciaProps {
  pacotes: PacoteAtendimento[]
  /** Dimensão de agrupamento ativa — muda apenas os rótulos, não o cálculo. */
  visao?: VisaoDashboard
}

/** Só as equipes com pelo menos 1 tarefa entram nos gráficos (evita ruído vazio). */
function equipesComCards(dados: InteligenciaDados): EquipeAtendimento[] {
  return ORDEM_EQUIPES.filter((equipe) => {
    const linha = dados.porEquipe.find((e) => e.equipe === equipe)
    return linha ? linha.contagem.total > 0 : false
  })
}

/** Dispara a onda circular do ripple no ponto do clique. */
function dispararOnda(evento: React.MouseEvent<HTMLButtonElement>) {
  const botao = evento.currentTarget
  const onda = document.createElement('span')
  const tamanho = Math.max(botao.clientWidth, botao.clientHeight)
  const rect = botao.getBoundingClientRect()
  onda.className = classes.ondaRipple
  onda.style.width = onda.style.height = `${tamanho}px`
  onda.style.left = `${evento.clientX - rect.left - tamanho / 2}px`
  onda.style.top = `${evento.clientY - rect.top - tamanho / 2}px`
  botao.appendChild(onda)
  onda.addEventListener('animationend', () => onda.remove())
}

export function GraficosInteligencia({
  pacotes,
  visao = 'atendimento',
}: GraficosInteligenciaProps) {
  // Equipe selecionada pelo ripple; null = todas.
  const [equipeSelecionada, setEquipeSelecionada] = useState<EquipeAtendimento | null>(null)

  // Cores de chrome do gráfico (texto/grade/gap) seguem o tema ativo.
  const scheme = useComputedColorScheme('dark', { getInitialValueInEffect: true })
  const cores = useMemo(() => coresChrome(scheme), [scheme])
  const opcoesEmpilhado = useMemo(() => montarOpcoesEmpilhado(cores), [cores])
  const opcoesRosca = useMemo(() => montarOpcoesRosca(cores), [cores])
  const opcoesRanking = useMemo(() => montarOpcoesRanking(cores), [cores])
  const opcoesTendencia = useMemo(() => montarOpcoesTendencia(cores, 'contagem'), [cores])
  const opcoesTendenciaPercentual = useMemo(
    () => montarOpcoesTendencia(cores, 'percentual'),
    [cores],
  )

  // Contagem de tarefas por equipe (para os rótulos dos ripples) — sempre do total,
  // independente da seleção, para o usuário ver o tamanho de cada equipe.
  const totaisPorEquipe = useMemo(() => {
    const mapa = new Map<EquipeAtendimento, number>()
    ORDEM_EQUIPES.forEach((e) => mapa.set(e, 0))
    pacotes.forEach((p) => mapa.set(p.equipe, mapa.get(p.equipe)! + p.cards.length))
    return mapa
  }, [pacotes])

  // Dados recalculados para o recorte atual: se há equipe selecionada, só os
  // pacotes dela; senão, todos. Assim TODOS os gráficos respeitam o ripple.
  const dados = useMemo(() => {
    const recorte = equipeSelecionada
      ? pacotes.filter((p) => p.equipe === equipeSelecionada)
      : pacotes
    return calcularInteligencia(recorte)
  }, [pacotes, equipeSelecionada])

  const equipes = useMemo(() => equipesComCards(dados), [dados])

  // Equipes que aparecem como ripples: as que têm ao menos 1 tarefa no total.
  const ripplesEquipes = useMemo(
    () => ORDEM_EQUIPES.filter((e) => (totaisPorEquipe.get(e) ?? 0) > 0),
    [totaisPorEquipe],
  )

  const empilhado = useMemo<ChartData<'bar'>>(
    () => ({
      labels: equipes.map(rotuloEquipe),
      datasets: SITUACOES.map((s) => ({
        label: s.label,
        data: equipes.map(
          (equipe) => dados.porEquipe.find((e) => e.equipe === equipe)?.contagem[s.chave] ?? 0,
        ),
        backgroundColor: COR_POR_SITUACAO[s.chave],
        borderColor: cores.gap,
        borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
        borderRadius: 4,
        borderSkipped: false,
        stack: 'situacao',
      })),
    }),
    [dados, equipes, cores],
  )

  const distribuicao = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: equipes.map(rotuloEquipe),
      datasets: [
        {
          label: 'Tarefas',
          data: equipes.map(
            (equipe) => dados.porEquipe.find((e) => e.equipe === equipe)?.contagem.total ?? 0,
          ),
          backgroundColor: equipes.map((equipe) => COR_POR_EQUIPE[equipe]),
          borderColor: cores.gap,
          borderWidth: 2,
        },
      ],
    }),
    [dados, equipes, cores],
  )

  const ranking = useMemo<ChartData<'bar'>>(
    () => ({
      labels: dados.topResponsaveis.map((r) => r.nome),
      datasets: [
        {
          label: 'Tarefas',
          data: dados.topResponsaveis.map((r) => r.total),
          backgroundColor: dados.topResponsaveis.map((r) => COR_POR_EQUIPE[r.equipe]),
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    }),
    [dados],
  )

  const fechadoPor = useMemo<ChartData<'bar'>>(
    () => ({
      labels: dados.topFechadoPor.map((f) => f.nome),
      datasets: [
        {
          label: 'Tarefas',
          data: dados.topFechadoPor.map((f) => f.total),
          backgroundColor: COR_FECHADO_POR,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    }),
    [dados],
  )

  const porUf = useMemo<ChartData<'bar'>>(
    () => ({
      labels: dados.porUf.map((u) => u.uf),
      datasets: [
        {
          label: 'Tarefas',
          data: dados.porUf.map((u) => u.total),
          backgroundColor: COR_UF,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    }),
    [dados],
  )

  const urgencia = useMemo<ChartData<'bar'>>(
    () => ({
      labels: FAIXAS_URGENCIA_LABELS.map((f) => f.label),
      datasets: [
        {
          label: 'Tarefas',
          data: FAIXAS_URGENCIA_LABELS.map((f) => dados.urgencia[f.chave]),
          backgroundColor: FAIXAS_URGENCIA_LABELS.map((f) => COR_URGENCIA[f.chave]),
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    }),
    [dados],
  )

  // Duas séries em gráficos SEPARADOS (não dual-axis): concluídas é contagem
  // absoluta, taxa de atraso é percentual — unidades diferentes que não devem
  // dividir o mesmo par de eixos, mesmo compartilhando o eixo X (mês).
  const tendenciaConcluidas = useMemo<ChartData<'line'>>(
    () => ({
      labels: dados.tendenciaMensal.map((p) => p.label),
      datasets: [
        {
          label: 'Concluídas',
          data: dados.tendenciaMensal.map((p) => p.concluidas),
          borderColor: COR_TENDENCIA_CONCLUIDAS,
          backgroundColor: COR_TENDENCIA_CONCLUIDAS,
          tension: 0.3,
          pointRadius: 4,
          fill: false,
        },
      ],
    }),
    [dados],
  )

  const tendenciaAtraso = useMemo<ChartData<'line'>>(
    () => ({
      labels: dados.tendenciaMensal.map((p) => p.label),
      datasets: [
        {
          label: 'Taxa de atraso (%)',
          data: dados.tendenciaMensal.map((p) => Math.round(p.taxaAtraso * 10) / 10),
          borderColor: COR_TENDENCIA_ATRASO,
          backgroundColor: COR_TENDENCIA_ATRASO,
          tension: 0.3,
          pointRadius: 4,
          fill: false,
        },
      ],
    }),
    [dados],
  )

  if (pacotes.length === 0) {
    return (
      <EstadoVazio
        titulo="Sem dados para os gráficos"
        descricao="Ajuste os filtros para visualizar a inteligência das equipes."
      />
    )
  }

  return (
    <div>
      {/* Ripples: clicar filtra TODOS os gráficos para a equipe; clicar de novo limpa. */}
      <div className={classes.ripples} role="group" aria-label="Filtrar gráficos por equipe">
        {ripplesEquipes.map((equipe) => {
          const ativo = equipeSelecionada === equipe
          const apagado = equipeSelecionada !== null && !ativo
          return (
            <button
              key={equipe}
              type="button"
              aria-pressed={ativo}
              className={`${classes.ripple} ${ativo ? classes.rippleAtivo : ''} ${
                apagado ? classes.rippleApagado : ''
              }`}
              style={{ ['--cor-equipe' as string]: COR_POR_EQUIPE[equipe] }}
              onClick={(e) => {
                dispararOnda(e)
                setEquipeSelecionada((atual) => (atual === equipe ? null : equipe))
              }}
            >
              {rotuloEquipe(equipe)}
              <span className={classes.rippleContagem}>{totaisPorEquipe.get(equipe) ?? 0}</span>
            </button>
          )
        })}
      </div>

      {dados.totalCards === 0 ? (
        <EstadoVazio
          titulo="Sem dados para os gráficos"
          descricao="Ajuste os filtros ou selecione outra equipe."
        />
      ) : (
        <div className={classes.grade}>
          <div className={classes.cartao}>
            <Text className={classes.tituloCartao} fw={700}>
              Tarefas por equipe e situação
            </Text>
            <Text className={classes.subtitulo} size="xs">
              Distribuição das tarefas de cada equipe entre no prazo, adiadas, concluídas e atrasadas.
            </Text>
            <div className={classes.areaGrafico}>
              <Bar data={empilhado} options={opcoesEmpilhado} />
            </div>
          </div>

          <div className={classes.cartao}>
            <Text className={classes.tituloCartao} fw={700}>
              Participação por equipe
            </Text>
            <Text className={classes.subtitulo} size="xs">
              Fatia de cada equipe no total de {dados.totalCards} tarefa(s) filtrada(s).
            </Text>
            <div className={classes.areaGrafico}>
              <Doughnut data={distribuicao} options={opcoesRosca} />
            </div>
          </div>

          <div className={`${classes.cartao} ${classes.cartaoLargo}`}>
            <Text className={classes.tituloCartao} fw={700}>
              {visao === 'executora' ? 'Quem fechou mais tarefas' : 'Responsáveis com mais tarefas'}
            </Text>
            <Text className={classes.subtitulo} size="xs">
              {visao === 'executora'
                ? `Top ${dados.topResponsaveis.length} pessoas por volume de tarefas fechadas; a cor indica a equipe do departamento do fechador.`
                : `Top ${dados.topResponsaveis.length} responsáveis pelo atendimento por volume; a cor indica a equipe.`}
            </Text>
            <div className={classes.areaGraficoAlta}>
              <Bar data={ranking} options={opcoesRanking} />
            </div>
          </div>

          <div className={`${classes.cartao} ${classes.cartaoLargo}`}>
            <Text className={classes.tituloCartao} fw={700}>
              Fechado por
            </Text>
            <Text className={classes.subtitulo} size="xs">
              Top {dados.topFechadoPor.length} pessoas por volume de tarefas fechadas (campo
              customizado da tarefa).
            </Text>
            <div className={classes.areaGraficoAlta}>
              <Bar data={fechadoPor} options={opcoesRanking} />
            </div>
          </div>

          <div className={classes.cartao}>
            <Text className={classes.tituloCartao} fw={700}>
              Volume por Estado (UF)
            </Text>
            <Text className={classes.subtitulo} size="xs">
              Top {dados.porUf.length} estados por volume de tarefas; tarefas sem UF informada não
              entram no ranking.
            </Text>
            <div className={classes.areaGrafico}>
              <Bar data={porUf} options={opcoesRanking} />
            </div>
          </div>

          <div className={classes.cartao}>
            <Text className={classes.tituloCartao} fw={700}>
              Urgência por prazo
            </Text>
            <Text className={classes.subtitulo} size="xs">
              Tarefas ativas (não concluídas, não adiadas) por faixa de dias até o vencimento.
            </Text>
            <div className={classes.areaGrafico}>
              <Bar data={urgencia} options={opcoesRanking} />
            </div>
          </div>

          <div className={classes.cartao}>
            <Text className={classes.tituloCartao} fw={700}>
              Tendência — concluídas por mês
            </Text>
            <Text className={classes.subtitulo} size="xs">
              Volume concluído por mês de prazo, últimos {dados.tendenciaMensal.length} meses.
            </Text>
            <div className={classes.areaGrafico}>
              <Line data={tendenciaConcluidas} options={opcoesTendencia} />
            </div>
          </div>

          <div className={classes.cartao}>
            <Text className={classes.tituloCartao} fw={700}>
              Tendência — pontualidade na entrega
            </Text>
            <Text className={classes.subtitulo} size="xs">
              Das tarefas concluídas com prazo em cada mês, % que terminou depois do prazo —
              últimos {dados.tendenciaMensal.length} meses.
            </Text>
            <div className={classes.areaGrafico}>
              <Line data={tendenciaAtraso} options={opcoesTendenciaPercentual} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

type CoresChrome = ReturnType<typeof coresChrome>

function montarOpcoesEmpilhado(cores: CoresChrome): ChartOptions<'bar'> {
  return {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { color: cores.texto, boxWidth: 12, boxHeight: 12 } },
      tooltip: { enabled: true },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: cores.texto } },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: cores.grade },
        ticks: { color: cores.texto, precision: 0 },
      },
    },
  }
}

function montarOpcoesRosca(cores: CoresChrome): ChartOptions<'doughnut'> {
  return {
    maintainAspectRatio: false,
    responsive: true,
    cutout: '58%',
    plugins: {
      legend: { position: 'bottom', labels: { color: cores.texto, boxWidth: 12, boxHeight: 12 } },
      tooltip: { enabled: true },
    },
  }
}

function montarOpcoesRanking(cores: CoresChrome): ChartOptions<'bar'> {
  return {
    maintainAspectRatio: false,
    responsive: true,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: cores.grade },
        ticks: { color: cores.texto, precision: 0 },
      },
      y: { grid: { display: false }, ticks: { color: cores.texto } },
    },
  }
}

/**
 * Um único eixo Y por gráfico (contagem OU percentual, nunca os dois juntos)
 * — as duas séries de tendência vivem em cards/gráficos separados
 * propositalmente, para não incorrer no anti-padrão de dual-axis.
 */
function montarOpcoesTendencia(
  cores: CoresChrome,
  modo: 'contagem' | 'percentual',
): ChartOptions<'line'> {
  return {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: cores.texto } },
      y: {
        beginAtZero: true,
        max: modo === 'percentual' ? 100 : undefined,
        grid: { color: cores.grade },
        ticks:
          modo === 'percentual'
            ? { color: cores.texto, callback: (v) => `${v}%` }
            : { color: cores.texto, precision: 0 },
      },
    },
  }
}
