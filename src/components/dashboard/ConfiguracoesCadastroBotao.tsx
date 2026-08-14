import { ActionIcon } from '@mantine/core'
import { podeGerenciarCadastro } from '../../utils/pessoas'
import classes from './ConfiguracoesCadastroBotao.module.css'

interface ConfiguracoesCadastroBotaoProps {
  /** Nome do colaborador logado no Bitrix. */
  nomeUsuario?: string | null
  /** ID Bitrix do colaborador logado. */
  idUsuario?: number | null
  onAbrir: () => void
}

/**
 * Engrenagem de configurações, no canto superior esquerdo, ao lado do
 * ThemeToggle.
 *
 * Só aparece para quem está na lista de gestão do cadastro (ver
 * `podeGerenciarCadastro`) e no ambiente DEV. Esconder o ícone é conveniência,
 * não controle de acesso: a permissão de verdade é conferida pelo worker em toda
 * escrita, e a própria tela reconfere via `POST /pessoas/permissao` antes de
 * oferecer edição.
 */
export function ConfiguracoesCadastroBotao({
  nomeUsuario,
  idUsuario,
  onAbrir,
}: ConfiguracoesCadastroBotaoProps) {
  const visivel = import.meta.env.DEV || podeGerenciarCadastro(nomeUsuario, idUsuario)
  if (!visivel) return null

  return (
    <ActionIcon
      variant="default"
      size="lg"
      radius="xl"
      className={classes.botao}
      onClick={onAbrir}
      aria-label="Abrir configurações de cadastro de pessoas"
      title="Configurações — departamento, supervisor e Estado/UF por pessoa"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    </ActionIcon>
  )
}
