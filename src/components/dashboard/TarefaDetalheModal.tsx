import { Badge, Button, Divider, Group, Modal, SimpleGrid, Stack, Text } from '@mantine/core'
import { ExternalLink } from 'lucide-react'
import { montarCaminhoTarefaBitrix, montarUrlTarefaBitrix } from '../../services/bitrixPortal'
import { abrirNoPortal } from '../../services/bitrixSdk'
import { PRIORIDADE_LABELS, STATUS_LABELS, type Tarefa } from '../../types/domain'
import { tarefaEstaAtrasada, tarefaEstaConcluida } from '../../utils/tarefasMetrics'
import { corDaPrioridade, corDoStatus, formatarData, formatarDataHora } from './tarefaApresentacao'

interface TarefaDetalheModalProps {
  tarefa: Tarefa | null
  aoFechar: () => void
}

const DIA_MS = 24 * 60 * 60 * 1000

function descreverSituacao(tarefa: Tarefa): string {
  if (!tarefa.prazoFinal) return 'Sem prazo definido'
  const agora = new Date()
  const prazo = new Date(tarefa.prazoFinal)

  if (tarefaEstaConcluida(tarefa)) {
    if (!tarefa.finalizadoEm) return 'Concluída'
    return new Date(tarefa.finalizadoEm) <= prazo
      ? 'Concluída dentro do prazo'
      : 'Concluída com atraso'
  }
  if (tarefaEstaAtrasada(tarefa, agora)) {
    const dias = Math.floor((agora.getTime() - prazo.getTime()) / DIA_MS)
    return dias === 0 ? 'Atrasada — o prazo venceu hoje' : `Atrasada há ${dias} dia(s)`
  }
  if (tarefa.status === 6) return 'Adiada'
  const dias = Math.ceil((prazo.getTime() - agora.getTime()) / DIA_MS)
  return dias === 0 ? 'No prazo — vence hoje' : `No prazo — vence em ${dias} dia(s)`
}

function Campo({ rotulo, valor, link }: { rotulo: string; valor: React.ReactNode; link?: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {rotulo}
      </Text>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--mantine-color-blue-4)',
            textDecoration: 'underline',
            fontWeight: 600,
          }}
        >
          {valor}
        </a>
      ) : (
        <Text size="sm">{valor}</Text>
      )}
    </div>
  )
}

export function TarefaDetalheModal({ tarefa, aoFechar }: TarefaDetalheModalProps) {
  if (!tarefa) return null

  const urlBitrix = montarUrlTarefaBitrix(
    tarefa.id,
    tarefa.projetoId,
    tarefa.responsavelId,
    tarefa.fechadoPorId,
    tarefa.responsavelAtendimentoId,
  )
  const caminhoBitrix = montarCaminhoTarefaBitrix(
    tarefa.id,
    tarefa.projetoId,
    tarefa.responsavelId,
    tarefa.fechadoPorId,
    tarefa.responsavelAtendimentoId,
  )

  const handleAbrirBitrix = () => {
    if (caminhoBitrix && urlBitrix) {
      abrirNoPortal(caminhoBitrix, urlBitrix)
    } else if (urlBitrix) {
      window.open(urlBitrix, '_blank')
    }
  }

  return (
    <Modal
      opened={tarefa !== null}
      onClose={aoFechar}
      zIndex={1100}
      title="Andamento processual"
      centered
      size="auto"
      styles={{ content: { width: 'min(720px, calc(100vw - 2rem))' } }}
      radius="md"
      transitionProps={{ transition: 'slide-up', duration: 250 }}
    >
      <Stack gap="md">
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start">
            <Text fw={700} size="lg" mt={4} style={{ flex: 1 }}>
              {tarefa.titulo}
            </Text>
            {urlBitrix && (
              <Button
                size="xs"
                variant="light"
                color="blue"
                leftSection={<ExternalLink size={14} />}
                onClick={handleAbrirBitrix}
              >
                Abrir no Bitrix24
              </Button>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Badge color={corDaPrioridade(tarefa.prioridade)} variant="filled">
              {PRIORIDADE_LABELS[tarefa.prioridade]}
            </Badge>
            <Badge color={corDoStatus(tarefa)} variant="light">
              {STATUS_LABELS[tarefa.status]}
            </Badge>
          </Group>
        </Stack>

        <Text size="sm" fw={600}>
          {descreverSituacao(tarefa)}
        </Text>

        <Divider />

        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <Campo rotulo="Projeto" valor={tarefa.projetoNome ?? '—'} />
          <Campo rotulo="Prazo final" valor={formatarData(tarefa.prazoFinal)} />
          <Campo rotulo="Resp. pelo atendimento" valor={tarefa.responsavelAtendimentoNome ?? '—'} />
          <Campo rotulo="Equipe de atendimento" valor={tarefa.equipeAtendimento} />
          <Campo rotulo="Responsável" valor={tarefa.responsavelNome ?? '—'} />
          <Campo rotulo="Fechado por" valor={tarefa.fechadoPorNome ?? '—'} />
          <Campo rotulo="Finalizado em" valor={formatarDataHora(tarefa.finalizadoEm)} />
          <Campo rotulo="Setor(es)" valor={tarefa.fechadoPorDepartamentos.join(', ') || '—'} />
          <Campo
            rotulo="ID no Bitrix"
            valor={`#${tarefa.id} — Ver no Bitrix ↗`}
            link={urlBitrix ?? undefined}
          />
        </SimpleGrid>

        <Divider />

        <Group justify="flex-end">
          <Button
            color="blue"
            size="sm"
            leftSection={<ExternalLink size={16} />}
            onClick={handleAbrirBitrix}
          >
            Abrir Tarefa no Bitrix24 (#{tarefa.id})
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
