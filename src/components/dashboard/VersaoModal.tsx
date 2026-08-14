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
export const VERSAO_ATUAL = '1.0.2'

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
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* BODY */}
            <div className={classes.body}>
              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="9" cy="7" r="4" />
                    <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Painel de Supervisor por Equipe</h4>
                  <p>
                    Ícones no canto superior esquerdo abrem o painel completo de cada equipe
                    (Quézia, Simone, Lorena e Cinthia), com avatares reais do Bitrix, resumo
                    calculista e fórum de comentários diário. Acesso liberado para as supervisoras e
                    para os superusuários.
                  </p>
                </div>
              </div>

              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Fórum de Comentários por Dia de Sincronização</h4>
                  <p>
                    Comentários e respostas agora ficam salvos no worker (não mais só no navegador),
                    organizados por dia de sync, com edição/exclusão para o autor e para quem modera
                    a equipe.
                  </p>
                </div>
              </div>

              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Navegação Lateral entre Seções</h4>
                  <p>
                    Nova barra de navegação lateral leva direto para cada seção do dashboard
                    (ranking, inteligência, IA), com destaque dourado na seção visível.
                  </p>
                </div>
              </div>

              <div className={classes.featureItem}>
                <div className={classes.featureIcon}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className={classes.featureText}>
                  <h4>Avatares Reais e Correções Visuais</h4>
                  <p>
                    Avatares dos colaboradores agora puxam a foto real do Bitrix (com fallback de
                    iniciais quando não há foto cadastrada), exclusão de comentário passou a ser
                    otimista na interface, e ajustes de padding e z-index em telas menores.
                  </p>
                </div>
              </div>

              {/* ALERTA DE CALIBRAGEM */}
              <div className={classes.alertaCalibragem}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#cba556"
                    strokeWidth="2"
                  >
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.55.64 2.87 1.7 3.7.83.65 1.25 1.57 1.4 2.3" />
                  </svg>
                </div>
                <div>
                  <h4
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '14px',
                      color: '#cba556',
                      fontWeight: 700,
                    }}
                  >
                    Fase de Calibragem Contínua da IA
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--texto-secundario, #a0aec0)',
                      lineHeight: 1.5,
                    }}
                  >
                    A Inteligência Artificial ainda está em fase de refinamento e aprendizado das
                    regras de negócio do escritório. Contamos com a sua ajuda e feedback diário para
                    torná-la cada vez mais precisa!
                  </p>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className={classes.footer}>
              <Link to="/changelogs" className={classes.btnChangelogs} onClick={handleFechar}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ marginRight: '4px' }}
                >
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
