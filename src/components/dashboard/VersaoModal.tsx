import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import classes from './VersaoModal.module.css'

const CHAVE_LOCALSTORAGE_VERSAO = 'dap_ultima_versao_visto'

/**
 * Versão exibida no dashboard. Exportada porque o badge "Novidades" e a página
 * de changelogs mostram o mesmo número — antes eram três strings soltas, que
 * saíam de sincronia a cada release.
 */
export const VERSAO_ATUAL = '1.0.1'

interface VersaoModalProps {
  abertoManual?: boolean
  onCloseManual?: () => void
}

export function VersaoModal({ abertoManual, onCloseManual }: VersaoModalProps) {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (abertoManual !== undefined) {
      setAberto(abertoManual)
      return
    }

    const versaoVista = localStorage.getItem(CHAVE_LOCALSTORAGE_VERSAO)
    if (versaoVista !== VERSAO_ATUAL) {
      setAberto(true)
    }
  }, [abertoManual])

  const handleFechar = () => {
    localStorage.setItem(CHAVE_LOCALSTORAGE_VERSAO, VERSAO_ATUAL)
    setAberto(false)
    if (onCloseManual) onCloseManual()
  }

  return (
    <AnimatePresence>
      {aberto && (
        <div className={classes.overlay} onClick={handleFechar}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={classes.modal}
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className={classes.header}>
              <h3 className={classes.title}>
                <span>Dashboard de Andamento Processual</span>
                <span className={classes.badgeVersao}>v{VERSAO_ATUAL}</span>
              </h3>
              <button
                type="button"
                className={classes.closeButton}
                onClick={handleFechar}
                aria-label="Fechar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* BODY */}
            <div className={classes.body}>
              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Segmentação por Grupos de Tarefas</h4>
                  <p>Novo seletor no topo da página escolhe quais grupos de tarefas entram na análise (substitui a antiga alternância "Por atendimento" / "Por equipe executora"). Nomes reais dos grupos, com o Acompanhamento Mensal marcado por padrão.</p>
                </div>
              </div>

              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="7" y1="9" x2="17" y2="9" />
                    <line x1="7" y1="13" x2="14" y2="13" />
                    <path d="M15 17l1.5 1.5L20 15" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Detalhe de Tarefas por Colaborador</h4>
                  <p>Clique no nome de qualquer pessoa (no ranking ou nos gráficos) para abrir o detalhamento completo das tarefas dela, com busca, link de perfil e acesso direto a cada tarefa no Bitrix.</p>
                </div>
              </div>

              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Correções de Precisão nos Números</h4>
                  <p>Equipe de cada pessoa não muda mais dependendo do filtro ativo, ranking "Fechado por" agora sempre bate com o detalhe da pessoa, supervisor é inferido pela equipe quando o Bitrix não tem o campo cadastrado, e tarefas concluídas com atraso ficam sinalizadas na lista.</p>
                </div>
              </div>

              {/* ALERTA DE CALIBRAGEM */}
              <div className={classes.alertaCalibragem}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cba556" strokeWidth="2">
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.55.64 2.87 1.7 3.7.83.65 1.25 1.57 1.4 2.3" />
                  </svg>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#cba556', fontWeight: 700 }}>
                    Fase de Calibragem Contínua da IA
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--texto-secundario, #a0aec0)', lineHeight: 1.5 }}>
                    A Inteligência Artificial ainda está em fase de refinamento e aprendizado das regras de negócio do escritório.
                    Contamos com a sua ajuda e feedback diário para torná-la cada vez mais precisa!
                  </p>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className={classes.footer}>
              <Link to="/changelogs" className={classes.btnChangelogs} onClick={handleFechar}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Ver Documentação de Métricas &amp; IA (Changelogs) →
              </Link>
              <button type="button" className={classes.btnEntendido} onClick={handleFechar}>
                Entendido
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
