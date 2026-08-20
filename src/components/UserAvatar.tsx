import { useState } from 'react'
import { Avatar, type AvatarProps } from '@mantine/core'

interface UserAvatarProps extends Omit<AvatarProps, 'src'> {
  nome: string
  fotoUrl?: string | null
  size?: number | string
}

/** Gera uma cor HSL consistente e harmoniosa a partir do nome da pessoa. */
function gerarCorDoNome(nome: string): string {
  let hash = 0
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 45%)`
}

/** Iniciais de um nome (até 2 letras). */
function extrairIniciais(nome: string): string {
  if (!nome || nome === 'Não informado') return '?'
  const partes = nome.trim().split(/\s+/)
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function UserAvatar({ nome, fotoUrl, size = 32, ...props }: UserAvatarProps) {
  const [erroFoto, setErroFoto] = useState(false)
  const corFundo = gerarCorDoNome(nome)
  const iniciais = extrairIniciais(nome)

  const srcValido = fotoUrl && !erroFoto ? fotoUrl : null

  return (
    <Avatar
      src={srcValido}
      alt={nome}
      size={size}
      radius="xl"
      onError={() => setErroFoto(true)}
      style={{
        backgroundColor: srcValido ? undefined : corFundo,
        color: '#ffffff',
        fontWeight: 700,
        fontSize: typeof size === 'number' ? Math.max(10, size * 0.4) : '0.8rem',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        ...props.style,
      }}
      {...props}
    >
      {iniciais}
    </Avatar>
  )
}
