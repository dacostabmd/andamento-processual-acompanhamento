import { ActionIcon, Avatar } from '@mantine/core'
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

/** Mapeamento da foto/avatar das 4 supervisoras de equipes. */
const FOTO_POR_EQUIPE: Partial<Record<EquipeAtendimento, string>> = {
  'Simone Freitas': '/supervisores/simone.svg',
  'Cinthia Filgueiras': '/supervisores/cinthia.svg',
  'Quézia Karen': '/supervisores/quezia.svg',
  'Lorena Pontes': '/supervisores/lorena.svg',
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
            src={FOTO_POR_EQUIPE[equipe]}
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

