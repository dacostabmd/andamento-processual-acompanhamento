import { ActionIcon } from '@mantine/core'
import { ShieldCheck } from 'lucide-react'
import { podeGerenciarCadastro } from '../../utils/pessoas'
import classes from './ConfiguracoesCadastroBotao.module.css'

interface PermissoesMetricasBotaoProps {
  nomeUsuario?: string | null
  idUsuario?: number | null
  onAbrir: () => void
}

export function PermissoesMetricasBotao({
  nomeUsuario,
  idUsuario,
  onAbrir,
}: PermissoesMetricasBotaoProps) {
  const visivel = import.meta.env.DEV || podeGerenciarCadastro(nomeUsuario, idUsuario)
  if (!visivel) return null

  return (
    <ActionIcon
      variant="default"
      size="lg"
      radius="xl"
      className={classes.botao}
      onClick={onAbrir}
      aria-label="Abrir gestão de visibilidade de métricas"
      title="Permissões & Visibilidade de Métricas por Perfil"
    >
      <ShieldCheck size={18} />
    </ActionIcon>
  )
}
