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
import { useCallback, useMemo, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  EQUIPES_ATENDIMENTO,
  type EquipeAtendimento,
  type InteligenciaDados,
  type PacoteAtendimento,
  type Tarefa,
  type VisaoDashboard,
} from '../../types/domain'
import {
  calcularInteligencia,
  calcularTopFechadoPor,
  chaveMes,
  classificarUrgenciaTarefa,
  equipeExecutoraDaTarefa,
  tarefaEstaConcluida,
  tarefasDaPessoa,
} from '../../utils/tarefasMetrics'
import { EstadoVazio } from '../EstadoVazio'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import type { MetricaSelecionada } from './MetricaTarefasModal'
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
  /** Tarefas cruas do recorte atual — usadas para resolver o clique no ranking "Fechado por". */
  tarefasFiltradas: Tarefa[]
  /** Disparado ao clicar numa barra de ranking (responsáveis ou fechado-por). */
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
  /** Disparado ao clicar num ponto/barra dos demais gráficos (UF, urgência, tendência mensal). */
  onSelecionarMetrica: (metrica: MetricaSelecionada) => void
  /**
   * Esconde o ripple de filtro por equipe e os 2 cartões que comparam equipe
   * contra equipe ("Tarefas por equipe e situação", "Participação por
   * equipe") — usado pelo painel do supervisor, onde `pacotes` já chega
   * filtrado para uma única equipe e esses cartões ficariam triviais
   * (1 categoria, 1 fatia de 100%). Os demais gráficos continuam mostrando os
   * dados da(s) equipe(s) recebida(s) em `pacotes`/`tarefasFiltradas`.
   */
  ocultarComparativoEquipes?: boolean
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
  tarefasFiltradas,
  onSelecionarColaborador,
  onSelecionarMetrica,
  ocultarComparativoEquipes = false,
}: GraficosInteligenciaProps) {
  // Equipe selecionada pelo ripple; null = todas.
  const [equipeSelecionada, setEquipeSelecionada] = useState<EquipeAtendimento | null>(null)

  // Cores de chrome do gráfico (texto/grade/gap) seguem o tema ativo.
  const scheme = useComputedColorScheme('dark', { getInitialValueInEffect: true })
  const cores = useMemo(() => coresChrome(scheme), [scheme])
  const opcoesEmpilhado = useMemo(() => montarOpcoesEmpilhado(cores), [cores])
  const opcoesRosca = useMemo(() => montarOpcoesRosca(cores), [cores])
  const rotuloPapelResponsavel =
    visao === 'executora' ? 'Fechado por' : 'Responsável pelo atendimento'

  // Contagem de tarefas por equipe (para os rótulos dos ripples) — sempre do total,
  // independente da seleção, para o usuário ver o tamanho de cada equipe.
  const totaisPorEquipe = useMemo(() => {
    const mapa = new Map<EquipeAtendimento, number>()
    ORDEM_EQUIPES.forEach((e) => mapa.set(e, 0))
    pacotes.forEach((p) => mapa.set(p.equipe, mapa.get(p.equipe)! + p.cards.length))
    return mapa
  }, [pacotes])

  // Recorte atual: se há equipe selecionada, só os pacotes dela; senão, todos.
  // Assim TODOS os gráficos (e os cliques neles) respeitam o ripple.
  const recorte = useMemo(
    () => (equipeSelecionada ? pacotes.filter((p) => p.equipe === equipeSelecionada) : pacotes),
    [pacotes, equipeSelecionada],
  )
  const dados = useMemo(() => calcularInteligencia(recorte), [recorte])
  // Tarefas cruas do recorte — base dos cliques em UF/urgência/tendência, que
  // localizam tarefas por critério (não por pessoa, como o ranking/fechado-por).
  const cardsDoRecorte = useMemo(() => recorte.flatMap((p) => p.cards), [recorte])

  // "Fechado por" é uma dimensão à parte (equipe de quem FECHOU, não de quem
  // atende) — calculado direto de `tarefasFiltradas` (cru, sem agrupar por
  // pacote de atendimento). Filtrar `pacotes` pelo ripple de atendimento e
  // extrair "fechado por" dali sub-contava fechadores cujos cards são
  // atendidos majoritariamente por gente de OUTRAS equipes.
  const topFechadoPor = useMemo(() => {
    const base = equipeSelecionada
      ? tarefasFiltradas.filter((t) => equipeExecutoraDaTarefa(t) === equipeSelecionada)
      : tarefasFiltradas
    return calcularTopFechadoPor(base)
  }, [tarefasFiltradas, equipeSelecionada])

  const equipes = useMemo(() => equipesComCards(dados), [dados])

  // Equipes que aparecem como ripples: as que têm ao menos 1 tarefa no total.
  const ripplesEquipes = useMemo(
    () => ORDEM_EQUIPES.filter((e) => (totaisPorEquipe.get(e) ?? 0) > 0),
    [totaisPorEquipe],
  )

  const ehApenasConcluidas = useMemo(() => {
    return (
      dados.totalCards > 0 &&
      dados.porEquipe.every((e) => e.contagem.total === e.contagem.concluidas)
    )
  }, [dados])

  const empilhado = useMemo<ChartData<'bar'>>(() => {
    const situacoesExibidas: Array<{
      chave: keyof typeof COR_POR_SITUACAO | 'concluidasNoPrazo' | 'concluidasComAtraso'
      label: string
      cor: string
    }> = ehApenasConcluidas
      ? [
          {
            chave: 'concluidasNoPrazo',
            label: 'Concluídas no prazo',
            cor: COR_POR_SITUACAO.noPrazo,
          },
          {
            chave: 'concluidasComAtraso',
            label: 'Concluídas com atraso',
            cor: COR_POR_SITUACAO.atrasadas,
          },
        ]
      : SITUACOES.map((s) => ({ ...s, cor: COR_POR_SITUACAO[s.chave] }))

    return {
      labels: equipes.map(rotuloEquipe),
      datasets: situacoesExibidas.map((s) => ({
        label: s.label,
        data: equipes.map(
          (equipe) => dados.porEquipe.find((e) => e.equipe === equipe)?.contagem[s.chave] ?? 0,
        ),
        backgroundColor: s.cor,
        borderColor: cores.gap,
        borderWidth: { top: 2, right: 0, bottom: 0, left: 0 },
        borderRadius: 4,
        borderSkipped: false,
        stack: 'situacao',
      })),
    }
  }, [dados, equipes, cores, ehApenasConcluidas])

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
      labels: topFechadoPor.map((f) => f.nome),
      datasets: [
        {
          label: 'Tarefas',
          data: topFechadoPor.map((f) => f.total),
          backgroundColor: COR_FECHADO_POR,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    }),
    [topFechadoPor],
  )

  // Clique numa barra de "Responsáveis"/"Quem fechou mais tarefas": a pessoa
  // corresponde 1:1 a um PacoteAtendimento, então usa pacote.cards direto.
  const aoClicarRanking = useCallback(
    (index: number) => {
      const item = dados.topResponsaveis[index]
      if (!item) return
      const pacote = pacotes.find(
        (p) => p.responsavelAtendimentoId === item.responsavelAtendimentoId,
      )
      if (!pacote) return
      onSelecionarColaborador({
        nome: item.nome,
        equipe: item.equipe,
        papel: rotuloPapelResponsavel,
        cards: pacote.cards,
      })
    },
    [dados, pacotes, rotuloPapelResponsavel, onSelecionarColaborador],
  )

  // Clique numa barra de "Fechado por": dimensão diferente (fechadoPorId,
  // sempre por fechador), sem PacoteAtendimento 1:1 — filtra as tarefas cruas.
  const aoClicarFechadoPor = useCallback(
    (index: number) => {
      const item = topFechadoPor[index]
      if (!item) return
      const cards = tarefasDaPessoa(tarefasFiltradas, { tipo: 'fechadoPor', id: item.fechadoPorId })
      const equipe = cards.length > 0 ? equipeExecutoraDaTarefa(cards[0]) : 'indefinido'
      onSelecionarColaborador({
        nome: item.nome,
        equipe,
        papel: 'Fechado por',
        cards,
      })
    },
    [topFechadoPor, tarefasFiltradas, onSelecionarColaborador],
  )

  // Clique numa barra de "Volume por Estado (UF)": localiza pelo mesmo campo
  // usado no agregado (estadoUf), dentro do recorte atual (respeita o ripple).
  const aoClicarUf = useCallback(
    (index: number) => {
      const item = dados.porUf[index]
      if (!item) return
      const tarefas = cardsDoRecorte.filter((t) => t.estadoUf === item.uf)
      onSelecionarMetrica({
        titulo: `Estado: ${item.uf}`,
        subtitulo: `${tarefas.length} tarefa(s) com UF = ${item.uf} no recorte atual.`,
        tarefas,
      })
    },
    [dados, cardsDoRecorte, onSelecionarMetrica],
  )

  // Clique numa faixa de "Urgência por prazo": mesmo classificador por card
  // usado para montar o agregado (classificarUrgenciaTarefa), então a lista
  // aberta aqui sempre soma exatamente ao número da barra clicada.
  const aoClicarUrgencia = useCallback(
    (index: number) => {
      const faixa = FAIXAS_URGENCIA_LABELS[index]
      if (!faixa) return
      const agora = new Date()
      const tarefas = cardsDoRecorte.filter(
        (t) => classificarUrgenciaTarefa(t, agora) === faixa.chave,
      )
      onSelecionarMetrica({
        titulo: `Urgência: ${faixa.label}`,
        subtitulo: `${tarefas.length} tarefa(s) ativa(s) na faixa "${faixa.label}".`,
        tarefas,
      })
    },
    [cardsDoRecorte, onSelecionarMetrica],
  )

  // Clique num ponto de qualquer gráfico de tendência mensal: as duas séries
  // (concluídas / pontualidade) compartilham o mesmo eixo X e o mesmo conjunto
  // de tarefas por mês — mesmo critério de calcularTendenciaMensal.
  const aoClicarTendencia = useCallback(
    (index: number) => {
      const ponto = dados.tendenciaMensal[index]
      if (!ponto) return
      const tarefas = cardsDoRecorte.filter(
        (t) =>
          tarefaEstaConcluida(t) &&
          t.finalizadoEm !== null &&
          t.prazoFinal !== null &&
          chaveMes(new Date(t.prazoFinal)) === ponto.mes,
      )
      onSelecionarMetrica({
        titulo: `Concluídas em ${ponto.label}`,
        subtitulo: `${tarefas.length} tarefa(s) concluída(s) com prazo em ${ponto.label}.`,
        tarefas,
      })
    },
    [dados, cardsDoRecorte, onSelecionarMetrica],
  )

  const opcoesTendencia = useMemo(
    () => montarOpcoesTendencia(cores, 'contagem', aoClicarTendencia),
    [cores, aoClicarTendencia],
  )
  const opcoesTendenciaPercentual = useMemo(
    () => montarOpcoesTendencia(cores, 'percentual', aoClicarTendencia),
    [cores, aoClicarTendencia],
  )

  const opcoesRankingUf = useMemo(() => montarOpcoesRanking(cores, aoClicarUf), [cores, aoClicarUf])
  const opcoesRankingUrgencia = useMemo(
    () => montarOpcoesRanking(cores, aoClicarUrgencia),
    [cores, aoClicarUrgencia],
  )
  const opcoesRankingResponsaveis = useMemo(
    () => montarOpcoesRanking(cores, aoClicarRanking),
    [cores, aoClicarRanking],
  )
  const opcoesRankingFechadoPor = useMemo(
    () => montarOpcoesRanking(cores, aoClicarFechadoPor),
    [cores, aoClicarFechadoPor],
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
      {/* Ripples: clicar filtra TODOS os gráficos para a equipe; clicar de novo limpa.
          Sem sentido quando o recorte já é de uma equipe só (painel do supervisor). */}
      {!ocultarComparativoEquipes && (
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
      )}

      {dados.totalCards === 0 ? (
        <EstadoVazio
          titulo="Sem dados para os gráficos"
          descricao={
            ocultarComparativoEquipes
              ? 'Ajuste o período nos filtros para visualizar dados desta equipe.'
              : 'Ajuste os filtros ou selecione outra equipe.'
          }
        />
      ) : (
        <div className={classes.grade}>
          {!ocultarComparativoEquipes && (
            <>
              <div className={classes.cartao}>
                <Text className={classes.tituloCartao} fw={700}>
                  Tarefas por equipe e situação
                </Text>
                <Text className={classes.subtitulo} size="xs">
                  Distribuição das tarefas de cada equipe entre no prazo, adiadas, concluídas e
                  atrasadas.
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
            </>
          )}

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
              <Bar data={ranking} options={opcoesRankingResponsaveis} />
            </div>
          </div>

          <div className={`${classes.cartao} ${classes.cartaoLargo}`}>
            <Text className={classes.tituloCartao} fw={700}>
              Fechado por
            </Text>
            <Text className={classes.subtitulo} size="xs">
              Top {topFechadoPor.length} pessoas por volume de tarefas fechadas (campo customizado
              da tarefa).
            </Text>
            <div className={classes.areaGraficoAlta}>
              <Bar data={fechadoPor} options={opcoesRankingFechadoPor} />
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
              <Bar data={porUf} options={opcoesRankingUf} />
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
              <Bar data={urgencia} options={opcoesRankingUrgencia} />
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
              Das tarefas concluídas com prazo em cada mês, % que terminou depois do prazo — últimos{' '}
              {dados.tendenciaMensal.length} meses.
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

/** `onClickIndice`, quando informado, torna as barras clicáveis (abre o modal de detalhe do colaborador). */
function montarOpcoesRanking(
  cores: CoresChrome,
  onClickIndice?: (index: number) => void,
): ChartOptions<'bar'> {
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
    onClick: onClickIndice
      ? (_event, elements) => {
          const index = elements[0]?.index
          if (index !== undefined) onClickIndice(index)
        }
      : undefined,
    onHover: onClickIndice
      ? (event, elements) => {
          const target = event.native?.target as HTMLElement | null
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
        }
      : undefined,
  }
}

/**
 * Um único eixo Y por gráfico (contagem OU percentual, nunca os dois juntos)
 * — as duas séries de tendência vivem em cards/gráficos separados
 * propositalmente, para não incorrer no anti-padrão de dual-axis.
 */
/** `onClickIndice`, quando informado, torna os pontos clicáveis (mesmo padrão de montarOpcoesRanking). */
function montarOpcoesTendencia(
  cores: CoresChrome,
  modo: 'contagem' | 'percentual',
  onClickIndice?: (index: number) => void,
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
    onClick: onClickIndice
      ? (_event, elements) => {
          const index = elements[0]?.index
          if (index !== undefined) onClickIndice(index)
        }
      : undefined,
    onHover: onClickIndice
      ? (event, elements) => {
          const target = event.native?.target as HTMLElement | null
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
        }
      : undefined,
  }
}
