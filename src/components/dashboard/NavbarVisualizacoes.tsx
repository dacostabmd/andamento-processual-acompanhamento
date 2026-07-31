import { VISOES_DASHBOARD, type VisaoDashboard } from '../../types/domain'
import { PilulaDeslizante } from './PilulaDeslizante'

interface Props {
  visao: VisaoDashboard
  onChange: (visao: VisaoDashboard) => void
}

/**
 * Navbar de segmentação das visualizações do dashboard — alterna a dimensão de
 * agrupamento dos cards entre "por atendimento" e "por equipe executora".
 *
 * O trilho usa utilities do Tailwind e as variáveis de tema do Mantine
 * (--superficie, --mantine-color-text) para acompanhar a alternância
 * claro/escuro sem duplicar a paleta. O indicador ativo — a pílula dourada que
 * desliza entre as opções — vem de PilulaDeslizante, compartilhada com a
 * ordenação do ranking de fechadores.
 */
export function NavbarVisualizacoes({ visao, onChange }: Props) {
  return (
    <nav
      aria-label="Visualizações do dashboard"
      className="flex w-full justify-center"
    >
      <PilulaDeslizante
        opcoes={VISOES_DASHBOARD}
        valor={visao}
        onChange={onChange}
        papel="tablist"
        rotuloAcessivel="Visualizações do dashboard"
        className="gap-1 p-1"
        classNameOpcao="px-4 py-2 text-sm font-semibold"
        style={{
          backgroundColor: 'var(--superficie)',
          border: '1px solid var(--superficie-borda)',
          boxShadow: '0 1px 3px var(--sombra-contraste)',
        }}
      />
    </nav>
  )
}
