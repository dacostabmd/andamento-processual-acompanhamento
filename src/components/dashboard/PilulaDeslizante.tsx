import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import classes from './PilulaDeslizante.module.css'

export interface OpcaoPilula<T extends string> {
  valor: T
  rotulo: string
  /** Vira `title` no botão — usado pela alternância de visão. */
  descricao?: string
}

interface Props<T extends string> {
  opcoes: ReadonlyArray<OpcaoPilula<T>>
  valor: T
  onChange: (valor: T) => void
  /** `tablist`/`tab` na navbar de visões; `group` nos seletores comuns. */
  papel?: 'tablist' | 'group'
  rotuloAcessivel: string
  /** Classes utilitárias extras do trilho (padding, gap, fundo, borda). */
  className?: string
  /** Classes utilitárias extras de cada opção (padding, tamanho de fonte). */
  classNameOpcao?: string
  style?: React.CSSProperties
  /** Recuo do indicador em relação ao trilho — deve casar com o padding dele. */
  recuo?: number
}

/**
 * Seletor segmentado com indicador que desliza entre as opções.
 *
 * A posição/largura do indicador é medida do botão ativo em vez de calculada por
 * índice: os rótulos têm larguras diferentes ("A–Z" vs "Com atraso"), então um
 * passo fixo desalinharia. Remedimos em troca de opção e em resize, porque a
 * fonte pode carregar depois da primeira pintura e mudar as larguras.
 *
 * Compartilhado entre a ordenação do ranking e a alternância de visão — a lógica
 * de medição é a mesma, só o espaçamento muda.
 */
export function PilulaDeslizante<T extends string>({
  opcoes,
  valor,
  onChange,
  papel = 'group',
  rotuloAcessivel,
  className = '',
  classNameOpcao = '',
  style,
  recuo = 4,
}: Props<T>) {
  const grupoRef = useRef<HTMLDivElement>(null)
  // `animar: false` na primeira medição — sem isso o indicador deslizaria de
  // left:0 até a opção padrão a cada montagem. As medições seguintes animam.
  const [pilula, setPilula] = useState<{ left: number; width: number; animar: boolean } | null>(
    null,
  )

  const medir = useCallback(() => {
    const grupo = grupoRef.current
    const ativo = grupo?.querySelector<HTMLButtonElement>('[data-ativo="true"]')
    if (!grupo || !ativo) return
    // offsetLeft é relativo ao grupo (position: relative), então não precisa de
    // getBoundingClientRect nem compensar scroll.
    const left = ativo.offsetLeft
    const width = ativo.offsetWidth
    setPilula((anterior) => {
      // Sem a checagem de igualdade o ResizeObserver realimentaria renders.
      if (anterior && anterior.left === left && anterior.width === width) return anterior
      return { left, width, animar: anterior !== null }
    })
  }, [])

  useLayoutEffect(() => {
    medir()
  }, [medir, valor])

  useEffect(() => {
    const grupo = grupoRef.current
    if (!grupo) return
    // ResizeObserver em vez de window.resize: o trilho também muda de largura
    // quando o conteúdo ao lado cresce/encolhe, sem a janela mudar.
    const observer = new ResizeObserver(medir)
    observer.observe(grupo)
    return () => observer.disconnect()
  }, [medir])

  return (
    <div
      ref={grupoRef}
      role={papel}
      aria-label={rotuloAcessivel}
      className={`${classes.grupo} ${className}`}
      style={style}
    >
      {pilula && (
        <span
          aria-hidden
          className={`${classes.indicador} ${pilula.animar ? '' : classes.indicadorEstatico}`}
          style={{ left: pilula.left, width: pilula.width, top: recuo, bottom: recuo }}
        />
      )}
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === valor
        return (
          <button
            key={opcao.valor}
            type="button"
            role={papel === 'tablist' ? 'tab' : undefined}
            // aria-selected só é válido em `tab`; fora dele usamos aria-pressed.
            aria-selected={papel === 'tablist' ? ativa : undefined}
            aria-pressed={papel === 'tablist' ? undefined : ativa}
            title={opcao.descricao}
            data-ativo={ativa}
            onClick={() => onChange(opcao.valor)}
            className={`${classes.opcao} ${ativa ? classes.opcaoAtiva : ''} ${classNameOpcao}`}
          >
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}
