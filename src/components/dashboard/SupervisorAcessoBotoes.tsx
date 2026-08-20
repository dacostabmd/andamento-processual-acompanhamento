import { ActionIcon, Avatar } from '@mantine/core'
import { useMemo } from 'react'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import { useSupervisorIdPorEquipe } from '../../hooks/useSupervisorIdPorEquipe'
import type { EquipeAtendimento } from '../../types/domain'
import {
  ehCaioMarques,
  identificarSlotSupervisorPeloNome,
  SLOTS_SUPERVISOR,
  type SlotSupervisor,
} from '../../utils/pessoas'
import { COR_POR_EQUIPE } from './tarefaApresentacao'
import classes from './SupervisorAcessoBotoes.module.css'

interface SupervisorAcessoBotoesProps {
  /** Nome do colaborador logado no Bitrix (para reconhecer o slot dele e a liberação de superusuário). */
  nomeUsuario?: string | null
  /** ID Bitrix do colaborador logado (para liberação de superusuário por ID). */
  idUsuario?: number | null
  onAbrirSlot: (slot: SlotSupervisor) => void
}

/** Cor de referência do slot — a da primeira equipe (Handerson combina 2; as demais só têm 1). */
function corDoSlot(slot: SlotSupervisor): string {
  return COR_POR_EQUIPE[slot.equipes[0]]
}

/** Foto do slot: ID fixo quando definido (Handerson); senão, o UF_HEAD da equipe única do slot. */
function fotoDoSlot(
  slot: SlotSupervisor,
  supervisorIds: Partial<Record<EquipeAtendimento, number>>,
  fotos: Map<number, string>,
): string | undefined {
  const id = slot.fotoUsuarioId ?? supervisorIds[slot.equipes[0]]
  return id ? fotos.get(id) : undefined
}

/** Iniciais (até 2 letras) para diferenciar os ícones dos slots de cabeceira. */
function iniciaisDoSlot(slot: SlotSupervisor): string {
  return slot.rotulo
    .split(' ')
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Ícone(s) de acesso ao painel de gestão por equipe (`PainelSupervisorEquipe`),
 * empilhados abaixo do ThemeToggle no canto superior esquerdo.
 *
 * Em produção mostra UM ícone só (com a foto da supervisora), quando o nome do
 * usuário logado no Bitrix bate com um dos 3 slots (ver SLOTS_SUPERVISOR).
 *
 * Superusuários (Caio Marques, Handerson e Hellen Gomes — ver
 * IDS_SUPERUSUARIOS em pessoas.ts) e o ambiente DEV (`import.meta.env.DEV`)
 * veem os 3 slots sempre.
 */
export function SupervisorAcessoBotoes({
  nomeUsuario,
  idUsuario,
  onAbrirSlot,
}: SupervisorAcessoBotoesProps) {
  const eCaioMarques = ehCaioMarques(nomeUsuario, idUsuario)
  const slotDoUsuario = identificarSlotSupervisorPeloNome(nomeUsuario)
  const supervisorIds = useSupervisorIdPorEquipe()
  const idsColaboradores = useMemo(() => Object.values(supervisorIds), [supervisorIds])
  const fotos = useFotosColaboradores(idsColaboradores)

  const slotsVisiveis: SlotSupervisor[] =
    import.meta.env.DEV || eCaioMarques
      ? [...SLOTS_SUPERVISOR]
      : slotDoUsuario
        ? [slotDoUsuario]
        : []

  if (slotsVisiveis.length === 0) return null

  return (
    <div className={classes.pilha}>
      {slotsVisiveis.map((slot) => {
        const cor = corDoSlot(slot)
        return (
          <ActionIcon
            key={slot.chave}
            variant="default"
            size="lg"
            radius="xl"
            className={classes.botao}
            style={{
              backgroundColor: `${cor}22`,
              color: cor,
              borderColor: `${cor}55`,
              padding: 0,
              overflow: 'hidden',
            }}
            onClick={() => onAbrirSlot(slot)}
            aria-label={`Abrir painel de ${slot.rotulo}`}
            title={`Painel — ${slot.rotulo}`}
          >
            <Avatar
              src={fotoDoSlot(slot, supervisorIds, fotos)}
              alt={slot.rotulo}
              radius="xl"
              size="100%"
              styles={{
                placeholder: {
                  backgroundColor: 'transparent',
                  color: cor,
                  fontWeight: 700,
                  fontSize: '1rem',
                },
              }}
            >
              {iniciaisDoSlot(slot)}
            </Avatar>
          </ActionIcon>
        )
      })}
    </div>
  )
}
