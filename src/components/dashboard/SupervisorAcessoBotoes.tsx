import { ActionIcon, Avatar } from '@mantine/core'
import { useFotosColaboradores } from '../../hooks/useFotosColaboradores'
import { useSupervisorIdPorEquipe } from '../../hooks/useSupervisorIdPorEquipe'
import { EQUIPES_ATENDIMENTO, type EquipeAtendimento } from '../../types/domain'
import { ehCaioMarques } from '../../utils/pessoas'
import { COR_POR_EQUIPE } from './tarefaApresentacao'
import classes from './SupervisorAcessoBotoes.module.css'

interface SupervisorAcessoBotoesProps {
  /** Equipe reconhecida pelo nome do usuário logado no Bitrix; `null` se não for supervisor(a). */
  equipeDoUsuario: EquipeAtendimento | null
  /** Nome do colaborador logado no Bitrix (para liberação de superusuário Caio Marques). */
  nomeUsuario?: string | null
  onAbrirEquipe: (equipe: EquipeAtendimento) => void
}

/** Foto da supervisora de uma equipe, ou undefined se não resolvida (cai no fallback de iniciais). */
function fotoDaEquipe(
  equipe: EquipeAtendimento,
  supervisorIds: Partial<Record<EquipeAtendimento, number>>,
  fotos: Map<number, string>,
): string | undefined {
  const id = supervisorIds[equipe]
  return id ? fotos.get(id) : undefined
}

/** Iniciais (até 2 letras) para diferenciar os ícones das 4 equipes de cabeceira. */
function iniciaisDaEquipe(equipe: EquipeAtendimento): string {
  return equipe
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
 * usuário logado no Bitrix bate com uma das 4 supervisoras.
 *
 * Caio Marques (superusuário) e o ambiente DEV (`import.meta.env.DEV`) veem as
 * 4 supervisoras sempre.
 */
export function SupervisorAcessoBotoes({
  equipeDoUsuario,
  nomeUsuario,
  onAbrirEquipe,
}: SupervisorAcessoBotoesProps) {
  const eCaioMarques = ehCaioMarques(nomeUsuario)
  const fotos = useFotosColaboradores()
  const supervisorIds = useSupervisorIdPorEquipe()

  const equipesVisiveis: EquipeAtendimento[] =
    import.meta.env.DEV || eCaioMarques
      ? [...EQUIPES_ATENDIMENTO]
      : equipeDoUsuario
        ? [equipeDoUsuario]
        : []

  if (equipesVisiveis.length === 0) return null

  return (
    <div className={classes.pilha}>
      {equipesVisiveis.map((equipe) => (
        <ActionIcon
          key={equipe}
          variant="default"
          size="lg"
          radius="xl"
          className={classes.botao}
          style={{
            backgroundColor: `${COR_POR_EQUIPE[equipe]}22`,
            color: COR_POR_EQUIPE[equipe],
            borderColor: `${COR_POR_EQUIPE[equipe]}55`,
            padding: 0,
            overflow: 'hidden',
          }}
          onClick={() => onAbrirEquipe(equipe)}
          aria-label={`Abrir painel da equipe ${equipe}`}
          title={`Painel da equipe — ${equipe}`}
        >
          <Avatar
            src={fotoDaEquipe(equipe, supervisorIds, fotos)}
            alt={equipe}
            radius="xl"
            size="100%"
            styles={{
              placeholder: {
                backgroundColor: 'transparent',
                color: COR_POR_EQUIPE[equipe],
                fontWeight: 700,
                fontSize: '0.8rem',
              },
            }}
          >
            {iniciaisDaEquipe(equipe)}
          </Avatar>
        </ActionIcon>
      ))}
    </div>
  )
}

