import { Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { useMemo, type ReactElement } from 'react'
import type { FaixasUrgencia, PacoteAtendimento, Tarefa } from '../../types/domain'
import { calcularInteligencia, classificarUrgenciaTarefa } from '../../utils/tarefasMetrics'
import { EstadoVazio } from '../EstadoVazio'
import type { MetricaSelecionada } from './MetricaTarefasModal'
import { COR_POR_SITUACAO } from './tarefaApresentacao'
import classes from './InfograficoAtrasoTarefas.module.css'

interface InfograficoAtrasoTarefasProps {
  pacotes: PacoteAtendimento[]
  onSelecionarMetrica?: (metrica: MetricaSelecionada) => void
}

/** Ícone de alerta (octógono) — usado só no número grande de vencidas. */
function IconeAlerta() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

/** Ícone de relógio — faixa mais próxima do vencimento. */
function IconeRelogio() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

/** Ícone de calendário — faixa intermediária (4 a 7 dias). */
function IconeCalendario() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

/** Ícone de camadas — faixa confortável (8 a 15 dias). */
function IconeCamadas() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

/** Ícone de "tudo certo" — faixa mais folgada (mais de 15 dias). */
function IconeCheck() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

const FAIXAS_MENORES: Array<{
  chave: keyof FaixasUrgencia
  label: string
  icone: () => ReactElement
  cor?: string
}> = [
  { chave: 'ateTresDias', label: 'Até 3 dias', icone: IconeRelogio, cor: COR_POR_SITUACAO.adiadas },
  {
    chave: 'quatroASeteDias',
    label: '4 a 7 dias',
    icone: IconeCalendario,
    cor: COR_POR_SITUACAO.noPrazo,
  },
  {
    chave: 'oitoAQuinzeDias',
    label: '8 a 15 dias',
    icone: IconeCamadas,
    cor: COR_POR_SITUACAO.concluidas,
  },
  { chave: 'maisDeQuinzeDias', label: 'Mais de 15 dias', icone: IconeCheck },
]

export function InfograficoAtrasoTarefas({
  pacotes,
  onSelecionarMetrica,
}: InfograficoAtrasoTarefasProps) {
  const dados = useMemo(() => calcularInteligencia(pacotes), [pacotes])

  const todasTarefas = useMemo(() => {
    const mapa = new Map<number, Tarefa>()
    pacotes.forEach((p) => p.cards.forEach((c) => mapa.set(c.id, c)))
    return Array.from(mapa.values())
  }, [pacotes])

  if (dados.totalCards === 0) {
    return (
      <EstadoVazio
        titulo="Sem dados de urgência"
        descricao="Ajuste os filtros para visualizar as faixas de vencimento das tarefas."
      />
    )
  }

  const { urgencia } = dados
  const temVencidas = urgencia.vencidas > 0

  const handleAbrirFaixa = (chave: keyof FaixasUrgencia, label: string) => {
    if (!onSelecionarMetrica) return
    const agora = new Date()
    const tarefasFaixa = todasTarefas.filter((t) => classificarUrgenciaTarefa(t, agora) === chave)

    onSelecionarMetrica({
      titulo: `Urgência: ${label}`,
      subtitulo: `${tarefasFaixa.length} tarefa(s) na faixa "${label}"`,
      tarefas: tarefasFaixa,
    })
  }

  return (
    <Stack gap="md">
      <UnstyledButton
        onClick={() => handleAbrirFaixa('vencidas', 'Tarefas Vencidas')}
        style={{ width: '100%', textDecoration: 'none' }}
      >
        <div
          className={`${classes.cartaoAlarme} ${temVencidas ? classes.comAlarme : ''} item-clicavel-hover`}
          style={
            temVencidas
              ? { ['--cor-alarme' as string]: COR_POR_SITUACAO.atrasadas, cursor: 'pointer' }
              : { cursor: 'pointer' }
          }
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <div>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Tarefas vencidas (clique para ver lista)
              </Text>
              <Text className={classes.numeroAlarme}>{urgencia.vencidas}</Text>
              <Text size="sm" c="dimmed">
                tarefa(s) ativa(s) já passaram do prazo final
              </Text>
            </div>
            <div
              className={classes.iconeCirculo}
              style={{
                width: 56,
                height: 56,
                ['--cor-icone-fundo' as string]: temVencidas
                  ? `${COR_POR_SITUACAO.atrasadas}22`
                  : undefined,
                ['--cor-icone-texto' as string]: temVencidas
                  ? COR_POR_SITUACAO.atrasadas
                  : undefined,
              }}
            >
              <IconeAlerta />
            </div>
          </Group>
        </div>
      </UnstyledButton>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {FAIXAS_MENORES.map((faixa) => {
          const Icone = faixa.icone
          return (
            <UnstyledButton
              key={faixa.chave}
              onClick={() => handleAbrirFaixa(faixa.chave, faixa.label)}
              style={{ width: '100%' }}
            >
              <div className={`${classes.tile} item-clicavel-hover`} style={{ cursor: 'pointer' }}>
                <div
                  className={classes.iconeCirculo}
                  style={{
                    ['--cor-icone-fundo' as string]: faixa.cor ? `${faixa.cor}22` : undefined,
                    ['--cor-icone-texto' as string]: faixa.cor,
                  }}
                >
                  <Icone />
                </div>
                <div>
                  <Text fw={700} size="lg" className={classes.valorTile}>
                    {urgencia[faixa.chave]}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {faixa.label}
                  </Text>
                </div>
              </div>
            </UnstyledButton>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}
