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

    const observer = new IntersectionObserver(
      (entradas) => {
        const visiveis = entradas.filter((entrada) => entrada.isIntersecting)
        if (visiveis.length === 0) return
        const maisVisivel = visiveis.reduce((a, b) =>
          a.intersectionRatio >= b.intersectionRatio ? a : b,
        )
        const indice = elementos.findIndex((el) => el === maisVisivel.target)
        if (indice !== -1) setIndiceAtivo(indice)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    elementos.forEach((el) => observer.observe(el))
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
