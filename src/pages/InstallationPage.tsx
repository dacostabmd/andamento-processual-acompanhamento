import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function InstallationPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Finalizando instalação do aplicativo...')

  useEffect(() => {
    const finalizarInstalacao = async () => {
      try {
        // Aguarda o Bitrix24 estar pronto
        if (typeof window.BX24 === 'undefined' || !window.BX24) {
          // Fallback: aguarda até 3s pelo BX24
          let tentativas = 0
          while ((typeof window.BX24 === 'undefined' || !window.BX24) && tentativas < 30) {
            await new Promise((r) => setTimeout(r, 100))
            tentativas++
          }
        }

        if (typeof window.BX24 === 'undefined' || !window.BX24) {
          throw new Error(
            'BX24 SDK não carregado. Verifique se o app está rodando dentro do Bitrix24.',
          )
        }

        // Chama a API do Bitrix24 para finalizar instalação
        // installFinish marca o app como 100% instalado e visível para todos os colaboradores
        window.BX24!.installFinish()

        setStatus('success')
        setMessage('✅ Instalação concluída com sucesso!')

        // Redireciona para o dashboard após 2s
        setTimeout(() => {
          navigate('/dashboard', { replace: true })
        }, 2000)
      } catch (err) {
        console.error('Erro ao finalizar instalação:', err)
        setStatus('error')
        setMessage(
          err instanceof Error
            ? `❌ Erro: ${err.message}`
            : '❌ Erro ao finalizar instalação. Tente novamente.',
        )

        // Permite tentar novamente após 5s
        setTimeout(() => {
          window.location.reload()
        }, 5000)
      }
    }

    finalizarInstalacao()
  }, [navigate])

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <div style={styles.spinner}></div>
            <h1 style={styles.title}>Dashboard de Andamento Processual</h1>
            <p style={styles.message}>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={styles.successIcon}>✓</div>
            <h1 style={styles.title}>Tudo pronto!</h1>
            <p style={styles.message}>{message}</p>
            <p style={styles.submessage}>Redirecionando para o dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={styles.errorIcon}>!</div>
            <h1 style={styles.title}>Problema na Instalação</h1>
            <p style={styles.message}>{message}</p>
            <p style={styles.submessage}>Recarregando em 5 segundos...</p>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,

  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '48px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
    textAlign: 'center',
    maxWidth: '500px',
    width: '90%',
  } as React.CSSProperties,

  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #e0e0e0',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    margin: '0 auto 24px',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,

  successIcon: {
    width: '60px',
    height: '60px',
    background: '#4caf50',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    margin: '0 auto 24px',
    fontWeight: 'bold',
  } as React.CSSProperties,

  errorIcon: {
    width: '60px',
    height: '60px',
    background: '#f44336',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    margin: '0 auto 24px',
    fontWeight: 'bold',
  } as React.CSSProperties,

  title: {
    margin: '16px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#333',
  } as React.CSSProperties,

  message: {
    margin: '12px 0',
    fontSize: '16px',
    color: '#555',
    lineHeight: '1.5',
  } as React.CSSProperties,

  submessage: {
    margin: '12px 0 0 0',
    fontSize: '14px',
    color: '#999',
  } as React.CSSProperties,
}

// CSS para animação do spinner
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`
document.head.appendChild(styleSheet)
