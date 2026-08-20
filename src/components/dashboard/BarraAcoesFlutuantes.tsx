import type { SlotSupervisor } from '../../utils/pessoas'
import { ThemeToggle } from '../ThemeToggle'
import { AuditoriaCadastroBotao } from './AuditoriaCadastroBotao'
import classes from './BarraAcoesFlutuantes.module.css'
import { ConfiguracoesCadastroBotao } from './ConfiguracoesCadastroBotao'
import { PermissoesMetricasBotao } from './PermissoesMetricasBotao'
import { SupervisorAcessoBotoes } from './SupervisorAcessoBotoes'

interface BarraAcoesFlutuantesProps {
  nomeUsuario?: string | null
  idUsuario?: number | null
  onAbrirConfiguracoes: () => void
  onAbrirAuditoria: () => void
  onAbrirPermissoes: () => void
  onAbrirSlotSupervisor: (slot: SlotSupervisor) => void
}

/**
 * Dock único de ações e supervisores no canto superior direito.
 * Unifica tema, permissões, configurações, auditoria e slots de supervisores em uma única barra.
 */
export function BarraAcoesFlutuantes({
  nomeUsuario,
  idUsuario,
  onAbrirConfiguracoes,
  onAbrirAuditoria,
  onAbrirPermissoes,
  onAbrirSlotSupervisor,
}: BarraAcoesFlutuantesProps) {
  return (
    <div className={classes.dockContainer}>
      <ThemeToggle />
      <ConfiguracoesCadastroBotao
        nomeUsuario={nomeUsuario}
        idUsuario={idUsuario}
        onAbrir={onAbrirConfiguracoes}
      />
      <AuditoriaCadastroBotao
        nomeUsuario={nomeUsuario}
        idUsuario={idUsuario}
        onAbrir={onAbrirAuditoria}
      />
      <PermissoesMetricasBotao
        nomeUsuario={nomeUsuario}
        idUsuario={idUsuario}
        onAbrir={onAbrirPermissoes}
      />
      <div className={classes.divisor} />
      <SupervisorAcessoBotoes
        nomeUsuario={nomeUsuario}
        idUsuario={idUsuario}
        onAbrirSlot={onAbrirSlotSupervisor}
      />
    </div>
  )
}
