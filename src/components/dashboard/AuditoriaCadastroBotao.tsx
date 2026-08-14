import { ActionIcon } from '@mantine/core'
import { podeAuditarCadastro } from '../../utils/pessoas'
import classes from './AuditoriaCadastroBotao.module.css'

interface AuditoriaCadastroBotaoProps {
  nomeUsuario?: string | null
  idUsuario?: number | null
  onAbrir: () => void
}

/**
 * Ícone do log de auditoria, no canto superior esquerdo, à direita da engrenagem.
 *
 * Aparece só para Caio Marques (ver `podeAuditarCadastro`) e em DEV. Como no caso
 * da engrenagem, esconder o ícone é conveniência e não controle de acesso: a rota
 * `POST /pessoas/auditoria` confere a permissão no servidor com uma lista própria
 * (IDS_AUDITORIA_CADASTRO), separada e mais restrita que a de edição — quem é
 * auditado não decide quem audita.
 */
export function AuditoriaCadastroBotao({
  nomeUsuario,
  idUsuario,
  onAbrir,
}: AuditoriaCadastroBotaoProps) {
  const visivel = import.meta.env.DEV || podeAuditarCadastro(nomeUsuario, idUsuario)
  if (!visivel) return null

  return (
    <ActionIcon
      variant="default"
      size="lg"
      radius="xl"
      className={classes.botao}
      onClick={onAbrir}
      aria-label="Abrir log de auditoria do cadastro de pessoas"
      title="Auditoria — quem alterou o quê, quando"
    >
      {/* Prancheta com linhas: um histórico de registros, distinto da engrenagem
          (configurar) e do sol/lua (tema) no mesmo canto. */}
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
        <path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1Z" />
        <path d="M16 5h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" />
        <path d="M9 11h6" />
        <path d="M9 15h4" />
      </svg>
    </ActionIcon>
  )
}
