import { Badge, Card, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { useMemo } from 'react'
import type { EquipeAtendimento, Tarefa } from '../../types/domain'
import { tarefaEstaAtrasada, tarefaFoiConcluidaComAtraso } from '../../utils/tarefasMetrics'

interface ResumoCalculistaEquipeProps {
  equipe: EquipeAtendimento
  tarefas: Tarefa[]
}

const DIA_MS = 24 * 60 * 60 * 1000

function formatarVariavao(atual: number, anterior: number): { texto: string; cor: string } {
  if (anterior === 0) {
    return atual > 0
      ? { texto: 'um aumento significativo', cor: 'teal.4' }
      : { texto: 'sem alteração', cor: 'dimmed' }
  }
  const diff = ((atual - anterior) / anterior) * 100
  if (diff > 0) {
    return {
      texto: `uma média de ${diff.toFixed(1)}% a mais que no período anterior`,
      cor: 'teal.4',
    }
  } else if (diff < 0) {
    return {
      texto: `uma redução de ${Math.abs(diff).toFixed(1)}% em relação ao período anterior`,
      cor: 'orange.4',
    }
  }
  return { texto: 'exatamente o mesmo volume do período anterior', cor: 'blue.4' }
}

function calcularDestaque(tarefas: Tarefa[]): { nome: string; quantidade: number } | null {
  const concluidas = tarefas.filter((t) => t.status === 5 && t.fechadoPorNome)
  if (concluidas.length === 0) return null

  const contagem = new Map<string, number>()
  concluidas.forEach((t) => {
    const nome = t.fechadoPorNome!
    contagem.set(nome, (contagem.get(nome) ?? 0) + 1)
  })

  let melhorNome = ''
  let maxQtd = 0
  contagem.forEach((qtd, nome) => {
    if (qtd > maxQtd) {
      maxQtd = qtd
      melhorNome = nome
    }
  })

  return melhorNome ? { nome: melhorNome, quantidade: maxQtd } : null
}

export function ResumoCalculistaEquipe({ equipe, tarefas }: ResumoCalculistaEquipeProps) {
  const analise = useMemo(() => {
    const agora = new Date()

    // Intervalos de tempo
    const umDiaAtras = new Date(agora.getTime() - DIA_MS)
    const doisDiasAtras = new Date(agora.getTime() - 2 * DIA_MS)

    const seteDiasAtras = new Date(agora.getTime() - 7 * DIA_MS)
    const quatorzeDiasAtras = new Date(agora.getTime() - 14 * DIA_MS)

    const trintaDiasAtras = new Date(agora.getTime() - 30 * DIA_MS)
    const sessentaDiasAtras = new Date(agora.getTime() - 60 * DIA_MS)

    // 1. DADOS DO ÚLTIMO DIA (Hoje / Ontem)
    const tarefasDiaAtual = tarefas.filter((t) => {
      const dataRef = t.finalizadoEm
        ? new Date(t.finalizadoEm)
        : t.prazoFinal
          ? new Date(t.prazoFinal)
          : null
      return dataRef && dataRef >= umDiaAtras
    })
    const tarefasDiaAnterior = tarefas.filter((t) => {
      const dataRef = t.finalizadoEm
        ? new Date(t.finalizadoEm)
        : t.prazoFinal
          ? new Date(t.prazoFinal)
          : null
      return dataRef && dataRef >= doisDiasAtras && dataRef < umDiaAtras
    })

    const concluidasDiaAtual = tarefasDiaAtual.filter((t) => t.status === 5)
    const atrasadasDiaAtual = tarefasDiaAtual.filter(
      (t) => tarefaEstaAtrasada(t, agora) || tarefaFoiConcluidaComAtraso(t),
    )
    const destaqueDia = calcularDestaque(tarefasDiaAtual)
    const varDia = formatarVariavao(
      concluidasDiaAtual.length,
      tarefasDiaAnterior.filter((t) => t.status === 5).length,
    )

    // 2. DADOS DA ÚLTIMA SEMANA (7 dias vs 7-14 dias)
    const tarefasSemanaAtual = tarefas.filter((t) => {
      const dataRef = t.finalizadoEm
        ? new Date(t.finalizadoEm)
        : t.prazoFinal
          ? new Date(t.prazoFinal)
          : null
      return dataRef && dataRef >= seteDiasAtras
    })
    const tarefasSemanaAnterior = tarefas.filter((t) => {
      const dataRef = t.finalizadoEm
        ? new Date(t.finalizadoEm)
        : t.prazoFinal
          ? new Date(t.prazoFinal)
          : null
      return dataRef && dataRef >= quatorzeDiasAtras && dataRef < seteDiasAtras
    })

    const concluidasSemanaAtual = tarefasSemanaAtual.filter((t) => t.status === 5)
    const concluidasSemanaAnterior = tarefasSemanaAnterior.filter((t) => t.status === 5)
    const atrasadasSemana = tarefasSemanaAtual.filter(
      (t) => tarefaEstaAtrasada(t, agora) || tarefaFoiConcluidaComAtraso(t),
    )
    const destaqueSemana = calcularDestaque(tarefasSemanaAtual)
    const varSemana = formatarVariavao(
      concluidasSemanaAtual.length,
      concluidasSemanaAnterior.length,
    )

    // 3. DADOS DO MÊS (30 dias vs 30-60 dias)
    const tarefasMesAtual = tarefas.filter((t) => {
      const dataRef = t.finalizadoEm
        ? new Date(t.finalizadoEm)
        : t.prazoFinal
          ? new Date(t.prazoFinal)
          : null
      return dataRef && dataRef >= trintaDiasAtras
    })
    const tarefasMesAnterior = tarefas.filter((t) => {
      const dataRef = t.finalizadoEm
        ? new Date(t.finalizadoEm)
        : t.prazoFinal
          ? new Date(t.prazoFinal)
          : null
      return dataRef && dataRef >= sessentaDiasAtras && dataRef < trintaDiasAtras
    })

    const concluidasMesAtual = tarefasMesAtual.filter((t) => t.status === 5)
    const concluidasMesAnterior = tarefasMesAnterior.filter((t) => t.status === 5)
    const atrasadasMes = tarefasMesAtual.filter(
      (t) => tarefaEstaAtrasada(t, agora) || tarefaFoiConcluidaComAtraso(t),
    )
    const destaqueMes = calcularDestaque(tarefasMesAtual)
    const varMes = formatarVariavao(concluidasMesAtual.length, concluidasMesAnterior.length)
    const taxaPontualidadeMes =
      concluidasMesAtual.length > 0
        ? (
            ((concluidasMesAtual.length -
              concluidasMesAtual.filter(tarefaFoiConcluidaComAtraso).length) /
              concluidasMesAtual.length) *
            100
          ).toFixed(1)
        : '100'

    return {
      dia: {
        totalConcluidas: concluidasDiaAtual.length,
        totalAtrasadas: atrasadasDiaAtual.length,
        destaque: destaqueDia,
        variacao: varDia,
      },
      semana: {
        totalConcluidas: concluidasSemanaAtual.length,
        totalAtrasadas: atrasadasSemana.length,
        destaque: destaqueSemana,
        variacao: varSemana,
      },
      mes: {
        totalConcluidas: concluidasMesAtual.length,
        totalAtrasadas: atrasadasMes.length,
        pontualidade: taxaPontualidadeMes,
        destaque: destaqueMes,
        variacao: varMes,
      },
    }
  }, [tarefas])

  return (
    <Stack gap="md" mt="xs">
      <Group justify="space-between" align="center">
        <Title order={4} style={{ color: 'var(--mantine-color-text)' }}>
          Resumos Analíticos — Equipe {equipe}
        </Title>
        <Badge variant="light" color="blue">
          Sincronização Recente
        </Badge>
      </Group>

      {/* 1. RESUMO DO ÚLTIMO DIA */}
      <Card
        padding="md"
        radius="md"
        withBorder
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
      >
        <Group align="flex-start" wrap="nowrap" gap="sm">
          <ThemeIcon color="blue" variant="light" radius="xl" size="lg">
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
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </ThemeIcon>
          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={700} size="sm">
              Último Dia (Sincronização Diária)
            </Text>
            <Text size="xs" c="dimmed">
              No último dia registrado, a equipe teve{' '}
              <strong>{analise.dia.totalConcluidas} tarefas concluídas</strong> (
              {analise.dia.variacao.texto}).
              {analise.dia.destaque ? (
                <>
                  {' '}
                  O destaque do dia foi <strong>{analise.dia.destaque.nome}</strong> com{' '}
                  {analise.dia.destaque.quantidade} fechamentos.
                </>
              ) : (
                ' Sem destaque isolado no dia.'
              )}
              {analise.dia.totalAtrasadas > 0 && (
                <Text component="span" c="red.4" fw={600} ml={4}>
                  ⚠ Ponto de atenção: {analise.dia.totalAtrasadas} tarefa(s) registraram atraso.
                </Text>
              )}
            </Text>
          </Stack>
        </Group>
      </Card>

      {/* 2. RESUMO DA ÚLTIMA SEMANA */}
      <Card
        padding="md"
        radius="md"
        withBorder
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
      >
        <Group align="flex-start" wrap="nowrap" gap="sm">
          <ThemeIcon color="teal" variant="light" radius="xl" size="lg">
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
          </ThemeIcon>
          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={700} size="sm">
              Última Semana
            </Text>
            <Text size="xs" c="dimmed">
              Na última semana houveram{' '}
              <strong>{analise.semana.totalConcluidas} tarefas concluídas</strong> com sucesso (
              {analise.semana.variacao.texto}).
              {analise.semana.destaque && (
                <>
                  {' '}
                  Nas quais o destaque foi <strong>{analise.semana.destaque.nome}</strong> com{' '}
                  {analise.semana.destaque.quantidade} entregas.
                </>
              )}
              {analise.semana.totalAtrasadas > 0 ? (
                <Text component="span" c="red.4" fw={600} ml={4}>
                  ⚠ Alerta de gargalo: {analise.semana.totalAtrasadas} tarefa(s) finalizaram com
                  atraso ou seguem vencidas.
                </Text>
              ) : (
                <Text component="span" c="teal.4" fw={600} ml={4}>
                  ✓ Nenhuma pendência em atraso na semana!
                </Text>
              )}
            </Text>
          </Stack>
        </Group>
      </Card>

      {/* 3. RESUMO DO MÊS */}
      <Card
        padding="md"
        radius="md"
        withBorder
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
      >
        <Group align="flex-start" wrap="nowrap" gap="sm">
          <ThemeIcon color="violet" variant="light" radius="xl" size="lg">
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
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
            </svg>
          </ThemeIcon>
          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={700} size="sm">
              Acumulado do Mês
            </Text>
            <Text size="xs" c="dimmed">
              No balanço dos últimos 30 dias, a equipe de {equipe} atingiu{' '}
              <strong>{analise.mes.totalConcluidas} entregas concluídas</strong> (
              {analise.mes.variacao.texto}), mantendo um índice de pontualidade de{' '}
              <strong>{analise.mes.pontualidade}%</strong>.
              {analise.mes.destaque && (
                <>
                  {' '}
                  O principal fechador do mês é <strong>{analise.mes.destaque.nome}</strong> (
                  {analise.mes.destaque.quantidade} tarefas).
                </>
              )}
              {analise.mes.totalAtrasadas > 0 && (
                <Text component="span" c="red.4" fw={600} ml={4}>
                  ⚠ Métricas críticas: {analise.mes.totalAtrasadas} tarefas enfrentaram atraso no
                  período.
                </Text>
              )}
            </Text>
          </Stack>
        </Group>
      </Card>
    </Stack>
  )
}
