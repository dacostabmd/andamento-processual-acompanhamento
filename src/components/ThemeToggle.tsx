import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import classes from './ThemeToggle.module.css'

/**
 * Alterna entre o modo normal (fundo #c7c7c7) e o invertido (fundo branco), no
 * canto superior esquerdo. Usa o color scheme NATIVO do Mantine —
 * useMantineColorScheme já persiste a escolha e alterna o atributo no <html>,
 * então toda a UI (superfícies, texto, inputs, gráficos) segue sozinha.
 */
export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computado = useComputedColorScheme('dark', { getInitialValueInEffect: true })
  const escuro = computado === 'dark'

  const alternar = () => {
    // Ativa o fade global (ver index.css) só durante a troca e remove ao fim,
    // para o fade não interferir em load/hover/outras animações.
    const raiz = document.documentElement
    raiz.classList.add('theme-fade')
    window.setTimeout(() => raiz.classList.remove('theme-fade'), 400)
    setColorScheme(escuro ? 'light' : 'dark')
  }

  return (
    <ActionIcon
      variant="default"
      size="lg"
      radius="xl"
      className={classes.botao}
      onClick={alternar}
      aria-label={escuro ? 'Mudar para o modo normal (claro)' : 'Mudar para o modo escuro'}
      title={escuro ? 'Modo claro' : 'Modo escuro'}
    >
      {escuro ? (
        // No modo escuro, mostra o sol (clique volta ao modo normal/claro).
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        // No modo normal (claro), mostra a lua (clique vai para o modo escuro).
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </ActionIcon>
  )
}
