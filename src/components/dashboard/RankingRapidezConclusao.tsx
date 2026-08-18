import { Badge, Card, Group, Stack, Text } from '@mantine/core'
import { Hourglass, Rocket, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import { type Tarefa } from '../../types/domain'
import { UserAvatar } from '../UserAvatar'
import { compararNumero, compararTexto } from './ordenacao'
import { TabelaAnimadaPaginada, type ColunaTabelaAnimada } from './TabelaAnimadaPaginada'

import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'

interface RankingRapidezConclusaoProps {
  tarefasFiltradas: Tarefa[]
  onSelecionarColaborador?: (colaborador: ColaboradorSelecionado) => void
}

interface ColaboradorRapidez {
  id: number | null
  nome: string
  totalConcluidas: number
  tempoMedioHoras: number
  tempoMinHoras: number
  tempoMaxHoras: number
}

function formatarTempo(horas: number): string {
  if (horas < 1) {
    const minutos = Math.round(horas * 60)
    return `${minutos} min`
  }
  if (horas < 24) {
    const h = Math.floor(horas)
    const m = Math.round((horas - h) * 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const dias = (horas / 24).toFixed(1)
  return `${dias} dias`
}

function corDoBadgeVelocidade(tempoMedioHoras: number): string {
  if (tempoMedioHoras <= 6) return 'green'
  if (tempoMedioHoras <= 24) return 'teal'
  if (tempoMedioHoras <= 72) return 'yellow'
  return 'orange'
}

export function RankingRapidezConclusao({
  tarefasFiltradas,
  onSelecionarColaborador,
}: RankingRapidezConclusaoProps) {
  const ranking = useMemo<ColaboradorRapidez[]>(() => {
    const mapa = new Map<
      string,
      {
        id: number | null
        nome: string
        duracoesHoras: number[]
      }
    >()

    tarefasFiltradas.forEach((t) => {
      if (t.status !== 5 || !t.finalizadoEm || !t.criadoEm) return
      const inicio = new Date(t.criadoEm).getTime()
      const fim = new Date(t.finalizadoEm).getTime()
      if (isNaN(inicio) || isNaN(fim) || fim < inicio) return

      const horas = (fim - inicio) / (1000 * 60 * 60)
      const nome =
        t.fechadoPorNome || t.responsavelAtendimentoNome || t.responsavelNome || 'Não informado'
      const id = t.fechadoPorId || t.responsavelAtendimentoId || t.responsavelId || null

      const atual = mapa.get(nome) ?? { id, nome, duracoesHoras: [] }
      atual.duracoesHoras.push(horas)
      mapa.set(nome, atual)
    })

    const lista: ColaboradorRapidez[] = []
    mapa.forEach((item) => {
      if (item.duracoesHoras.length === 0) return
      const soma = item.duracoesHoras.reduce((acc, h) => acc + h, 0)
      const tempoMedioHoras = soma / item.duracoesHoras.length
      const tempoMinHoras = Math.min(...item.duracoesHoras)
      const tempoMaxHoras = Math.max(...item.duracoesHoras)

      lista.push({
        id: item.id,
        nome: item.nome,
        totalConcluidas: item.duracoesHoras.length,
        tempoMedioHoras,
        tempoMinHoras,
        tempoMaxHoras,
      })
    })

    // Ordena do menor tempo médio (mais rápido) ao maior
    return lista.sort((a, b) => a.tempoMedioHoras - b.tempoMedioHoras)
  }, [tarefasFiltradas])

  const idsColaboradores = useMemo(() => {
    return ranking.map((r) => r.id).filter((id): id is number => typeof id === 'number')
  }, [ranking])

  const fotosMap = useFotosColaboradores(idsColaboradores)

  const colunas = useMemo<ColunaTabelaAnimada<ColaboradorRapidez>[]>(
    () => [
      {
        chave: 'posicao',
        rotulo: 'Ranking',
        className: 'w-20',
        render: (_, indiceGlobal) => (
          <Text fw={700} size="sm" c="yellow">
            {indiceGlobal}º
          </Text>
        ),
      },
      {
        chave: 'colaborador',
        rotulo: 'Colaborador',
        comparar: (a, b, direcao) => compararTexto(a.nome, b.nome, direcao),
        render: (item) => (
          <Group gap="sm" wrap="nowrap">
            <UserAvatar
              nome={item.nome}
              fotoUrl={item.id ? fotosMap.get(item.id) : null}
              size={28}
            />
            <Text size="sm" fw={500}>
              {item.nome}
            </Text>
          </Group>
        ),
      },
      {
        chave: 'totalConcluidas',
        rotulo: 'Concluídas',
        alinhamento: 'direita',
        comparar: (a, b, direcao) => compararNumero(a.totalConcluidas, b.totalConcluidas, direcao),
        render: (item) => (
          <Text size="sm" fw={500}>
            {item.totalConcluidas}
          </Text>
        ),
      },
      {
        chave: 'tempoMedio',
        rotulo: 'Tempo Médio (Conclusão)',
        alinhamento: 'direita',
        comparar: (a, b, direcao) => compararNumero(a.tempoMedioHoras, b.tempoMedioHoras, direcao),
        render: (item) => (
          <Group justify="flex-end" gap="xs">
            <Badge variant="light" color={corDoBadgeVelocidade(item.tempoMedioHoras)} size="md">
              <Group gap={4} wrap="nowrap">
                <Zap size={13} />
                <span>{formatarTempo(item.tempoMedioHoras)}</span>
              </Group>
            </Badge>
          </Group>
        ),
      },
      {
        chave: 'maisRapido',
        rotulo: 'Mais Rápido',
        alinhamento: 'direita',
        comparar: (a, b, direcao) => compararNumero(a.tempoMinHoras, b.tempoMinHoras, direcao),
        render: (item) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Rocket size={13} style={{ color: 'var(--mantine-color-green-4)' }} />
            <Text size="xs" c="green.4" fw={600}>
              {formatarTempo(item.tempoMinHoras)}
            </Text>
          </Group>
        ),
      },
      {
        chave: 'maisLento',
        rotulo: 'Mais Lento',
        alinhamento: 'direita',
        comparar: (a, b, direcao) => compararNumero(a.tempoMaxHoras, b.tempoMaxHoras, direcao),
        render: (item) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Hourglass size={13} style={{ opacity: 0.7 }} />
            <Text size="xs" c="dimmed">
              {formatarTempo(item.tempoMaxHoras)}
            </Text>
          </Group>
        ),
      },
    ],
    [fotosMap],
  )

  return (
    <Card p="md" radius="md" withBorder style={{ backgroundColor: 'var(--superficie)' }}>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <div>
            <Group gap="xs" align="center">
              <Zap size={20} style={{ color: 'var(--mantine-color-yellow-4)' }} />
              <Text fw={700} size="lg">
                Ranking de Rapidez na Conclusão
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              Média de tempo decorrido entre a criação e o fechamento das tarefas concluídas
            </Text>
          </div>
          <Badge variant="dot" color="yellow" size="md">
            {ranking.length} colaborador(es)
          </Badge>
        </Group>

        <TabelaAnimadaPaginada
          dados={ranking}
          colunas={colunas}
          chaveLinha={(item) => item.nome}
          ordenacaoInicial={{ chave: 'tempoMedio', direcao: 'asc' }}
          itensPorPagina={10}
          onLinhaClique={(item) => {
            if (!onSelecionarColaborador) return
            const cardsDoColaborador = tarefasFiltradas.filter(
              (t) =>
                t.status === 5 &&
                (t.fechadoPorId === item.id ||
                  t.responsavelAtendimentoId === item.id ||
                  t.responsavelId === item.id ||
                  t.fechadoPorNome === item.nome ||
                  t.responsavelAtendimentoNome === item.nome ||
                  t.responsavelNome === item.nome),
            )
            onSelecionarColaborador({
              nome: item.nome,
              equipe: 'indefinido',
              papel: 'Fechado por',
              cards: cardsDoColaborador,
            })
          }}
          estadoVazio={{
            titulo: 'Nenhum fechamento registrado',
            descricao: 'Não há tarefas concluídas com datas válidas no recorte selecionado.',
          }}
        />
      </Stack>
    </Card>
  )
}
