import { Badge, Card, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { useMemo } from 'react'
import type { RankingFechador, Tarefa } from '../../types/domain'
import {
  calcularPontualidadeFechamento,
  calcularRankingFechadores,
} from '../../utils/tarefasMetrics'
import { EstadoVazio } from '../EstadoVazio'
import { UserAvatar } from '../UserAvatar'
import type { ColaboradorSelecionado } from './ColaboradorTarefasModal'
import { COR_POR_EQUIPE, COR_POR_SITUACAO } from './tarefaApresentacao'

interface DesempenhoIndividualConclusaoProps {
  tarefasFiltradas: Tarefa[]
  onSelecionarColaborador: (colaborador: ColaboradorSelecionado) => void
}

/** Quantas pessoas aparecem na grade de destaque — as demais seguem só no ranking completo (fora deste componente). */
const TOP_INDIVIDUOS = 6

/** Badge da equipe com a mesma paleta fixa usada em todo o dashboard (nunca uma cor nova). */
function BadgeEquipe({ linha }: { linha: RankingFechador }) {
  return (
    <Badge
      size="sm"
      variant="light"
      color={linha.equipe === 'indefinido' ? 'gray' : undefined}
      style={
        linha.equipe === 'indefinido'
          ? undefined
          : {
              backgroundColor: `${COR_POR_EQUIPE[linha.equipe]}22`,
              color: COR_POR_EQUIPE[linha.equipe],
            }
      }
    >
      {linha.equipe}
    </Badge>
  )
}

/**
 * Recorte de desempenho individual por conclusão: pontualidade geral do
 * recorte + os indivíduos com mais volume de fechamento, cada um com o
 * detalhamento no-prazo x com-atraso. Mesmas fontes de `RankingFechadores.tsx`
 * (a tabela completa), mas em formato de cartões de destaque.
 */
export function DesempenhoIndividualConclusao({
  tarefasFiltradas,
  onSelecionarColaborador,
}: DesempenhoIndividualConclusaoProps) {
  const ranking = useMemo(() => calcularRankingFechadores(tarefasFiltradas), [tarefasFiltradas])
  const pontualidade = useMemo(
    () => calcularPontualidadeFechamento(tarefasFiltradas),
    [tarefasFiltradas],
  )

  if (ranking.linhas.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma tarefa fechada no recorte atual"
        descricao="Ajuste os filtros ou o período para ver o desempenho individual de conclusão."
      />
    )
  }

  const destaques = ranking.linhas.slice(0, TOP_INDIVIDUOS)

  return (
    <Stack gap="md">
      <Card padding="md" radius="md" withBorder>
        <Group justify="space-between" align="center" wrap="wrap">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Pontualidade geral de conclusão
            </Text>
            <Text size="xs" c="dimmed">
              {pontualidade.concluidas.toLocaleString('pt-BR')} tarefa(s) concluída(s) no recorte
              atual
            </Text>
          </div>
          <Text
            size="xl"
            fw={800}
            style={{
              color:
                pontualidade.percentualNoPrazo === null
                  ? undefined
                  : COR_POR_SITUACAO[
                      pontualidade.percentualNoPrazo >= 50 ? 'concluidas' : 'atrasadas'
                    ],
            }}
          >
            {pontualidade.percentualNoPrazo === null
              ? '—'
              : `${pontualidade.percentualNoPrazo.toFixed(1)}%`}
          </Text>
        </Group>
        <Group gap="lg" mt="xs">
          <Text size="xs" c="dimmed">
            {pontualidade.noPrazo.toLocaleString('pt-BR')} no prazo
          </Text>
          <Text size="xs" c="dimmed">
            {pontualidade.comAtraso.toLocaleString('pt-BR')} com atraso
          </Text>
          {pontualidade.semPrazo > 0 && (
            <Text size="xs" c="dimmed">
              {pontualidade.semPrazo.toLocaleString('pt-BR')} sem prazo julgável
            </Text>
          )}
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {destaques.map((linha, index) => (
          <UnstyledButton
            key={linha.fechadoPorId}
            onClick={() =>
              onSelecionarColaborador({
                nome: linha.nome,
                equipe: linha.equipe,
                papel: 'Fechado por',
                cards: tarefasFiltradas.filter((t) => t.fechadoPorId === linha.fechadoPorId),
              })
            }
          >
            <Card padding="md" radius="md" withBorder className="item-clicavel-hover">
              <Group gap="sm" wrap="nowrap" align="center">
                <Text size="xs" fw={700} c="dimmed" style={{ minWidth: 24, textAlign: 'right' }}>
                  {index + 1}º
                </Text>
                <UserAvatar nome={linha.nome} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text size="sm" fw={700} lineClamp={1}>
                    {linha.nome}
                  </Text>
                  <BadgeEquipe linha={linha} />
                </div>
              </Group>

              <Group justify="space-between" align="flex-end" mt="md">
                <div>
                  <Text size="xl" fw={700}>
                    {linha.total.toLocaleString('pt-BR')}
                  </Text>
                  <Text size="xs" c="dimmed">
                    tarefa(s) fechada(s)
                  </Text>
                </div>
                <Stack gap={2} align="flex-end">
                  <Text size="xs" fw={600} style={{ color: COR_POR_SITUACAO.concluidas }}>
                    {linha.noPrazo} no prazo
                  </Text>
                  <Text size="xs" fw={600} style={{ color: COR_POR_SITUACAO.atrasadas }}>
                    {linha.comAtraso} com atraso
                  </Text>
                </Stack>
              </Group>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
