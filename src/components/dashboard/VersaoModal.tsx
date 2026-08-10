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
export const VERSAO_ATUAL = '1.0.0'

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
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Inteligência Operacional em Tempo Real</h4>
                  <p>Acompanhamento de tarefas em andamento, vencimentos em risco, atrasos e faixas de urgência por equipes de atendimento.</p>
                </div>
              </div>

              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8" y2="16" />
                    <line x1="16" y1="16" x2="16" y2="16" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Ajudante Virtual de BI (Text-to-SQL)</h4>
                  <p>Chat interativo que consulta a base sincronizada do Bitrix em linguagem natural, com memória conversacional e respostas transparentes.</p>
                </div>
              </div>

              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <path d="M20 8v6" />
                    <path d="M23 11h-6" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Ranking de Fechadores com Setor e Supervisor</h4>
                  <p>Lista completa de quem fecha tarefas — buscável, com repartição por prazo, setor e supervisor de cada pessoa, e ordenação por volume, pontualidade ou nome.</p>
                </div>
              </div>

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
                  <p>Escolha quais grupos de tarefas entram na análise, filtre por equipe e escolha a Taxa de Atraso sobre a Fila Ativa (backlog pendente) ou sobre o Volume Total. Tema claro e escuro incluídos.</p>
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
