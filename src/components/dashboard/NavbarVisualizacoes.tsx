import { VISOES_DASHBOARD, type VisaoDashboard } from '../../types/domain'

interface Props {
  visao: VisaoDashboard
  onChange: (visao: VisaoDashboard) => void
}

/**
 * Navbar de segmentação das visualizações do dashboard — alterna a dimensão de
 * agrupamento dos cards entre "por atendimento" e "por equipe executora".
 *
 * Estilizada com utilities do Tailwind (não CSS Modules como o resto do
 * dashboard) e usando as variáveis de tema do Mantine (--superficie,
 * --mantine-color-text) para acompanhar a alternância claro/escuro sem duplicar
 * a paleta. O indicador ativo usa o dourado da marca, o mesmo do botão de
 * novidades.
 */
export function NavbarVisualizacoes({ visao, onChange }: Props) {
  return (
    <nav
      aria-label="Visualizações do dashboard"
      className="flex w-full justify-center"
    >
      <div
        role="tablist"
        className="inline-flex items-center gap-1 rounded-full p-1"
        style={{
          backgroundColor: 'var(--superficie)',
          border: '1px solid var(--superficie-borda)',
          boxShadow: '0 1px 3px var(--sombra-contraste)',
        }}
      >
        {VISOES_DASHBOARD.map((item) => {
          const ativa = item.valor === visao
          return (
            <button
              key={item.valor}
              type="button"
              role="tab"
              aria-selected={ativa}
              title={item.descricao}
              onClick={() => onChange(item.valor)}
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200"
              style={{
                backgroundColor: ativa ? 'rgba(203, 165, 86, 0.16)' : 'transparent',
                color: ativa ? '#cba556' : 'var(--mantine-color-text)',
                border: ativa ? '1px solid rgba(203, 165, 86, 0.4)' : '1px solid transparent',
                opacity: ativa ? 1 : 0.7,
              }}
            >
              {item.rotulo}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
