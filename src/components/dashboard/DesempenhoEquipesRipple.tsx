import { Badge, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import {
  EQUIPES_ATENDIMENTO,
  type EquipeAtendimento,
  type PacoteAtendimento,
  type Tarefa,
} from '../../types/domain'
import { dispararOnda } from '../../utils/rippleEffect'
import {
  calcularMetricasPorEquipe,
  tarefaEstaAtrasada,
  tarefaEstaConcluida,
} from '../../utils/tarefasMetrics'
import { EstadoVazio } from '../EstadoVazio'
import { UserAvatar } from '../UserAvatar'
import classes from './DesempenhoEquipesRipple.module.css'
import { COR_POR_EQUIPE } from './tarefaApresentacao'

import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'

interface DesempenhoEquipesRippleProps {
  pacotes: PacoteAtendimento[]
  tarefasFiltradas: Tarefa[]
  onSelecionarColaborador?: (colaborador: ColaboradorSelecionado) => void
}

export function DesempenhoEquipesRipple({
  pacotes,
  tarefasFiltradas,
  onSelecionarColaborador,
}: DesempenhoEquipesRippleProps) {
  const [equipeSelecionada, setEquipeSelecionada] = useState<EquipeAtendimento | null>(null)

  const totaisPorEquipe = useMemo(() => {
    const mapa = new Map<EquipeAtendimento, number>()
    EQUIPES_ATENDIMENTO.forEach((e) => mapa.set(e, 0))
    pacotes.forEach((p) => {
      if (p.equipe === 'indefinido') return
      mapa.set(p.equipe, (mapa.get(p.equipe) ?? 0) + p.cards.length)
    })
    return mapa
  }, [pacotes])

  const ripplesEquipes = useMemo(
    () => EQUIPES_ATENDIMENTO.filter((e) => (totaisPorEquipe.get(e) ?? 0) > 0),
    [totaisPorEquipe],
  )

  const metricasPorEquipe = useMemo(
    () => calcularMetricasPorEquipe(tarefasFiltradas),
    [tarefasFiltradas],
  )

  const tarefasEquipe = useMemo(() => {
    if (!equipeSelecionada) return []
    return tarefasFiltradas.filter(
      (t) => t.equipeFechador === equipeSelecionada || t.equipeAtendimento === equipeSelecionada,
    )
  }, [tarefasFiltradas, equipeSelecionada])

  const statusBreakdown = useMemo(() => {
    const total = tarefasEquipe.length
    if (total === 0)
      return {
        concluidas: 0,
        emAndamento: 0,
        aguardando: 0,
        adiadas: 0,
        pctConcluidas: 0,
        pctEmAndamento: 0,
        pctAguardando: 0,
        pctAdiadas: 0,
      }

    const concluidas = tarefasEquipe.filter(tarefaEstaConcluida).length
    const emAndamento = tarefasEquipe.filter((t) => t.status === 3).length
    const aguardando = tarefasEquipe.filter((t) => t.status === 2 || t.status === 4).length
    const adiadas = tarefasEquipe.filter((t) => t.status === 6).length

    return {
      concluidas,
      emAndamento,
      aguardando,
      adiadas,
      pctConcluidas: (concluidas / total) * 100,
      pctEmAndamento: (emAndamento / total) * 100,
      pctAguardando: (aguardando / total) * 100,
      pctAdiadas: (adiadas / total) * 100,
    }
  }, [tarefasEquipe])

  const faixasAtrasoEquipe = useMemo(() => {
    const agora = new Date()
    let ate3dias = 0
    let de4a7dias = 0
    let de8a15dias = 0
    let maisDe15dias = 0

    tarefasEquipe.forEach((t) => {
      if (!tarefaEstaAtrasada(t, agora) || !t.prazoFinal) return
      const prazo = new Date(t.prazoFinal).getTime()
      const diffDias = Math.floor((agora.getTime() - prazo) / (1000 * 60 * 60 * 24))
      if (diffDias <= 3) ate3dias++
      else if (diffDias <= 7) de4a7dias++
      else if (diffDias <= 15) de8a15dias++
      else maisDe15dias++
    })

    return { ate3dias, de4a7dias, de8a15dias, maisDe15dias }
  }, [tarefasEquipe])

  const idsColaboradores = useMemo(() => {
    return tarefasEquipe
      .map((t) => t.fechadoPorId || t.responsavelAtendimentoId || t.responsavelId)
      .filter((id): id is number => typeof id === 'number')
  }, [tarefasEquipe])

  const fotosMap = useFotosColaboradores(idsColaboradores)

  const rankingIntegrantes = useMemo(() => {
    if (!equipeSelecionada) return []
    const mapa = new Map<
      string,
      { nome: string; id: number | null; total: number; concluidas: number; atrasadas: number }
    >()
    const agora = new Date()

    tarefasEquipe.forEach((t) => {
      const nome =
        t.fechadoPorNome || t.responsavelAtendimentoNome || t.responsavelNome || 'Não informado'
      const id = t.fechadoPorId || t.responsavelAtendimentoId || t.responsavelId || null
      const atual = mapa.get(nome) ?? { nome, id, total: 0, concluidas: 0, atrasadas: 0 }
      atual.total += 1
      if (tarefaEstaConcluida(t)) atual.concluidas += 1
      if (tarefaEstaAtrasada(t, agora)) atual.atrasadas += 1
      mapa.set(nome, atual)
    })

    return Array.from(mapa.values()).sort(
      (a, b) => b.total - a.total || b.concluidas - a.concluidas,
    )
  }, [tarefasEquipe, equipeSelecionada])

  if (pacotes.length === 0) {
    return (
      <EstadoVazio
        titulo="Sem dados de desempenho por equipe"
        descricao="Ajuste os filtros para visualizar o desempenho das equipes."
      />
    )
  }

  return (
    <div>
      <div className={classes.ripples} role="group" aria-label="Filtrar desempenho por equipe">
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
                dispararOnda(e, classes.ondaRipple)
                setEquipeSelecionada((atual) => (atual === equipe ? null : equipe))
              }}
            >
              {equipe}
              <span className={classes.rippleContagem}>{totaisPorEquipe.get(equipe) ?? 0}</span>
            </button>
          )
        })}
      </div>

      {!equipeSelecionada ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {ripplesEquipes.map((equipe) => {
            const item = metricasPorEquipe.find((m) => m.equipe === equipe)
            if (!item) return null
            return (
              <div
                key={equipe}
                className={classes.cartaoEquipe}
                style={{
                  ['--cor-equipe' as string]: COR_POR_EQUIPE[equipe],
                  cursor: 'pointer',
                }}
                onClick={() => setEquipeSelecionada(equipe)}
              >
                <div className={classes.nomeEquipe}>
                  <span className={classes.dotEquipe} />
                  <Text fw={700}>{equipe}</Text>
                </div>

                <SimpleGrid cols={3} mt="md">
                  <div>
                    <Text size="xl" fw={700}>
                      {item.metricas.eficiencia.toFixed(1)}%
                    </Text>
                    <Text size="xs" c="dimmed">
                      Eficiência
                    </Text>
                  </div>
                  <div>
                    <Text size="xl" fw={700}>
                      {item.metricas.taxaAtraso.toFixed(1)}%
                    </Text>
                    <Text size="xs" c="dimmed">
                      Taxa de atraso
                    </Text>
                  </div>
                  <div>
                    <Text size="xl" fw={700}>
                      {item.metricas.total.toLocaleString('pt-BR')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Total
                    </Text>
                  </div>
                </SimpleGrid>
              </div>
            )
          })}
        </SimpleGrid>
      ) : (
        <Stack gap="md" className={classes.painelDetalhamentoEquipe}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs">
              <span
                className={classes.dotEquipeGrande}
                style={{ backgroundColor: COR_POR_EQUIPE[equipeSelecionada] }}
              />
              <Text size="lg" fw={700}>
                Detalhamento da Equipe {equipeSelecionada}
              </Text>
              <Badge variant="dot" color="yellow" size="md">
                {tarefasEquipe.length} tarefa(s)
              </Badge>
            </Group>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setEquipeSelecionada(null)}
            >
              Ver todas as equipes
            </Button>
          </Group>

          {/* Cards de Métricas Principais da Equipe */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <div className={classes.cardFaixaAtraso}>
              <Text size="xs" c="dimmed">
                Eficiência
              </Text>
              <Text size="xl" fw={700} c="green.4">
                {statusBreakdown.pctConcluidas.toFixed(1)}%
              </Text>
            </div>
            <div className={classes.cardFaixaAtraso}>
              <Text size="xs" c="dimmed">
                Taxa de Atraso
              </Text>
              <Text size="xl" fw={700} c="red.4">
                {(
                  (tarefasEquipe.filter((t) => tarefaEstaAtrasada(t, new Date())).length /
                    Math.max(1, tarefasEquipe.length)) *
                  100
                ).toFixed(1)}
                %
              </Text>
            </div>
            <div className={classes.cardFaixaAtraso}>
              <Text size="xs" c="dimmed">
                Concluídas
              </Text>
              <Text size="xl" fw={700} c="teal.4">
                {statusBreakdown.concluidas}
              </Text>
            </div>
            <div className={classes.cardFaixaAtraso}>
              <Text size="xs" c="dimmed">
                Total de Tarefas
              </Text>
              <Text size="xl" fw={700}>
                {tarefasEquipe.length}
              </Text>
            </div>
          </SimpleGrid>

          {/* Infográfico 1: Distribuição de Status (Barra Segmentada) */}
          <div className={classes.boxInfografico}>
            <Text size="sm" fw={600} mb="xs">
              Distribuição da Equipe por Status
            </Text>
            <div className={classes.barraProgressoSegmentada}>
              <div
                className={classes.segmentoProgresso}
                style={{ width: `${statusBreakdown.pctConcluidas}%`, backgroundColor: '#40c057' }}
                title={`Concluídas: ${statusBreakdown.concluidas}`}
              />
              <div
                className={classes.segmentoProgresso}
                style={{ width: `${statusBreakdown.pctEmAndamento}%`, backgroundColor: '#228be6' }}
                title={`Em Andamento: ${statusBreakdown.emAndamento}`}
              />
              <div
                className={classes.segmentoProgresso}
                style={{ width: `${statusBreakdown.pctAguardando}%`, backgroundColor: '#fab005' }}
                title={`Aguardando: ${statusBreakdown.aguardando}`}
              />
              <div
                className={classes.segmentoProgresso}
                style={{ width: `${statusBreakdown.pctAdiadas}%`, backgroundColor: '#868e96' }}
                title={`Adiadas: ${statusBreakdown.adiadas}`}
              />
            </div>
            <Group justify="space-between" mt="xs" wrap="wrap">
              <Badge variant="subtle" color="green" size="xs">
                Concluídas: {statusBreakdown.concluidas} ({statusBreakdown.pctConcluidas.toFixed(1)}
                %)
              </Badge>
              <Badge variant="subtle" color="blue" size="xs">
                Em andamento: {statusBreakdown.emAndamento} (
                {statusBreakdown.pctEmAndamento.toFixed(1)}%)
              </Badge>
              <Badge variant="subtle" color="yellow" size="xs">
                Aguardando: {statusBreakdown.aguardando} ({statusBreakdown.pctAguardando.toFixed(1)}
                %)
              </Badge>
              <Badge variant="subtle" color="gray" size="xs">
                Adiadas: {statusBreakdown.adiadas} ({statusBreakdown.pctAdiadas.toFixed(1)}%)
              </Badge>
            </Group>
          </div>

          {/* Infográfico 2: Faixas de Atraso */}
          <div className={classes.boxInfografico}>
            <Text size="sm" fw={600} mb="xs">
              Detalhamento de Tarefas Atrasadas por Período ({equipeSelecionada})
            </Text>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
              <div className={classes.cardFaixaAtraso}>
                <Text size="xs" c="dimmed">
                  Até 3 dias
                </Text>
                <Text size="lg" fw={700} c="blue.4">
                  {faixasAtrasoEquipe.ate3dias}
                </Text>
              </div>
              <div className={classes.cardFaixaAtraso}>
                <Text size="xs" c="dimmed">
                  4 a 7 dias
                </Text>
                <Text size="lg" fw={700} c="yellow.4">
                  {faixasAtrasoEquipe.de4a7dias}
                </Text>
              </div>
              <div className={classes.cardFaixaAtraso}>
                <Text size="xs" c="dimmed">
                  8 a 15 dias
                </Text>
                <Text size="lg" fw={700} c="orange.4">
                  {faixasAtrasoEquipe.de8a15dias}
                </Text>
              </div>
              <div className={classes.cardFaixaAtraso}>
                <Text size="xs" c="dimmed">
                  Mais de 15 dias
                </Text>
                <Text size="lg" fw={700} c="red.4">
                  {faixasAtrasoEquipe.maisDe15dias}
                </Text>
              </div>
            </SimpleGrid>
          </div>

          {/* Infográfico 3: Ranking de Colaboradores da Equipe */}
          <div className={classes.boxInfografico}>
            <Text size="sm" fw={600} mb="xs">
              Integrantes / Ranking da Equipe ({equipeSelecionada})
            </Text>
            <Stack gap="xs">
              {rankingIntegrantes.map((colab, idx) => {
                const cardsDoColaborador = tarefasFiltradas.filter(
                  (t) =>
                    (t.equipeAtendimento === equipeSelecionada ||
                      t.equipeFechador === equipeSelecionada) &&
                    (t.fechadoPorId === colab.id ||
                      t.responsavelAtendimentoId === colab.id ||
                      t.responsavelId === colab.id ||
                      t.fechadoPorNome === colab.nome ||
                      t.responsavelAtendimentoNome === colab.nome ||
                      t.responsavelNome === colab.nome),
                )
                return (
                  <div
                    key={colab.nome}
                    className={`${classes.linhaColaboradorEquipe} item-clicavel-hover`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (!onSelecionarColaborador) return
                      onSelecionarColaborador({
                        nome: colab.nome,
                        equipe: equipeSelecionada,
                        papel: 'Fechado por',
                        cards: cardsDoColaborador,
                      })
                    }}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <Text fw={700} size="sm" c="yellow" w={28}>
                        {idx + 1}º
                      </Text>
                      <UserAvatar
                        nome={colab.nome}
                        fotoUrl={colab.id ? fotosMap.get(colab.id) : null}
                        size={28}
                      />
                      <Text size="sm" fw={500}>
                        {colab.nome}
                      </Text>
                    </Group>
                    <Group gap="md">
                      <Badge variant="subtle" color="green" size="xs">
                        {colab.concluidas} concluídas
                      </Badge>
                      {colab.atrasadas > 0 && (
                        <Badge variant="subtle" color="red" size="xs">
                          {colab.atrasadas} atrasadas
                        </Badge>
                      )}
                      <Text size="sm" fw={700}>
                        {colab.total} tarefas
                      </Text>
                    </Group>
                  </div>
                )
              })}
            </Stack>
          </div>
        </Stack>
      )}
    </div>
  )
}
