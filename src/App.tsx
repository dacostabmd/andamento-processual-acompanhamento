import { useEffect } from 'react'
import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom'
import { ChangelogsPage } from './pages/ChangelogsPage'
import { DashboardPage } from './pages/DashboardPage'
import { InstallationPage } from './pages/InstallationPage'

function App() {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.BX24 && typeof window.BX24.init === 'function') {
      try {
        window.BX24.init(() => {
          if (typeof window.BX24?.installFinish === 'function') {
            window.BX24.installFinish()
          }
        })
      } catch {
        // Ignora se estiver fora do iframe do Bitrix24
      }
    }
  }, [])

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/changelogs" element={<ChangelogsPage />} />
        <Route path="/install" element={<InstallationPage />} />
      </Routes>
    </Router>
  )
}

export default App
