import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
// Fira Code é carregada via Google Fonts (<link> no index.html), não empacotada.
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import { theme } from './theme.ts'
import App from './App.tsx'

// defaultColorScheme "dark" = padrão do painel (fundo escuro #1a1a1a). O botão
// de tema alterna para "light" (fundo #c7c7c7, texto escuro — ver index.css).
// ColorSchemeScript evita flash de tema errado no load.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorSchemeScript defaultColorScheme="dark" />
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications />
      <App />
    </MantineProvider>
  </StrictMode>,
)
