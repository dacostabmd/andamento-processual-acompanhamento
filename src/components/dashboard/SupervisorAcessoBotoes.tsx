import { ActionIcon } from '@mantine/core'
import { EQUIPES_ATENDIMENTO, type EquipeAtendimento } from '../../types/domain'
import { COR_POR_EQUIPE } from './tarefaApresentacao'
import classes from './SupervisorAcessoBotoes.module.css'

interface SupervisorAcessoBotoesProps {
  /** Equipe reconhecida pelo nome do usuário logado no Bitrix; `null` se ele não é uma das 4 supervisoras. */
  equipeDoUsuario: EquipeAtendimento | null
  onAbrirEquipe: (equipe: EquipeAtendimento) => void
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
 * Em produção mostra UM ícone só, quando o nome do usuário logado no Bitrix
 * bate com uma das 4 supervisoras (`equipeSupervisionadaPeloNome`, resolvido
 * pelo chamador) — é a "tela personalizada" pedida para Quézia, Lorena, Simone
 * e Cinthia. Em desenvolvimento (`import.meta.env.DEV`) mostra as 4 sempre,
 * independente do usuário (mock), para dar pra revisar o painel de cada
 * equipe antes do commit.
 */
export function SupervisorAcessoBotoes({
  equipeDoUsuario,
  onAbrirEquipe,
}: SupervisorAcessoBotoesProps) {
  const equipesVisiveis: EquipeAtendimento[] = import.meta.env.DEV
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
          }}
          onClick={() => onAbrirEquipe(equipe)}
          aria-label={`Abrir painel da equipe ${equipe}`}
          title={`Painel da equipe — ${equipe}`}
        >
          {iniciaisDaEquipe(equipe)}
        </ActionIcon>
      ))}
    </div>
  )
}
