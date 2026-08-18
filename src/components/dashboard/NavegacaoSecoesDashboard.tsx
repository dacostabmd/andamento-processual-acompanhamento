import { useEffect, useState } from 'react'
import LineSidebar from '../LineSidebar'

export interface SecaoDashboard {
  id: string
  rotulo: string
}

interface NavegacaoSecoesDashboardProps {
  secoes: SecaoDashboard[]
}

/**
 * Navegação fixa no canto central-direito para pular entre as seções da
 * dashboard (Ranking, Inteligência, Comentários...). A seção ativa acompanha
 * o scroll via IntersectionObserver — não só o último clique.
 */
export function NavegacaoSecoesDashboard({ secoes }: NavegacaoSecoesDashboardProps) {
  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(0)

  useEffect(() => {
    const elementos = secoes
      .map((secao) => document.getElementById(secao.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elementos.length === 0) return

    // Linha de referência de leitura: 20% do topo da viewport. A seção ativa
    // é a última cujo topo já cruzou essa linha (padrão scrollspy) — não a
    // que tem maior intersectionRatio, que favorece seções curtas/altas de
    // forma inconsistente com o que está de fato visível no topo da tela.
    function atualizarIndiceAtivo() {
      const linhaReferencia = window.innerHeight * 0.2
      let indice = 0
      for (let i = 0; i < elementos.length; i++) {
        if (elementos[i].getBoundingClientRect().top <= linhaReferencia) {
          indice = i
        }
      }
      setIndiceAtivo(indice)
    }

    const observer = new IntersectionObserver(atualizarIndiceAtivo, {
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    })

    elementos.forEach((el) => observer.observe(el))
    atualizarIndiceAtivo()
    return () => observer.disconnect()
  }, [secoes])

  function aoClicar(indice: number) {
    const secao = secoes[indice]
    if (!secao) return
    document.getElementById(secao.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setIndiceAtivo(indice)
  }

  return (
    <div className="fixed right-6 top-1/2 z-[150] hidden -translate-y-1/2 lg:block">
      <LineSidebar
        items={secoes.map((secao) => secao.rotulo)}
        activeIndex={indiceAtivo}
        onItemClick={aoClicar}
        accentColor="#cba556"
        textColor="var(--mantine-color-dimmed)"
        markerColor="var(--mantine-color-dimmed)"
        falloff="linear"
        proximityRadius={40}
        maxShift={16}
        markerLength={20}
        markerGap={0}
        tickScale={0.18}
        itemGap={25}
        fontSize={1.1}
        smoothing={80}
        showIndex={false}
        showMarker={false}
        scaleTick={false}
      />
    </div>
  )
}
