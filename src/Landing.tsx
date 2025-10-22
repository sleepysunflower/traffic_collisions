import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
  const onEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget
    const variant = el.dataset.variant
    el.style.transform = 'translateY(-1px)'
    if (variant === 'primary') {
      el.style.backgroundColor = palette.redBright
      el.style.borderColor = palette.redBright
      el.style.color = palette.white
    } else {
      el.style.backgroundColor = palette.charcoal
      el.style.borderColor = palette.charcoal
      el.style.color = palette.white
    }
  }

  const onLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget
    const variant = el.dataset.variant
    el.style.transform = 'translateY(0)'
    if (variant === 'primary') {
      el.style.backgroundColor = palette.redDeep
      el.style.borderColor = palette.redDeep
      el.style.color = palette.white
    } else {
      el.style.backgroundColor = 'transparent'
      el.style.borderColor = palette.grey
      el.style.color = palette.grey
    }
  }

  const onDown = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.transform = 'translateY(0)'
  }
  const onUp = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.transform = 'translateY(-1px)'
  }

  return (
    <div style={container}>
      <main style={main}>
        <h1 style={title}>
          <span style={mainSpan}>Montreal traffic collision data spatial analysis</span>{' '}
          <span style={yearSpan}>(2012–2021)</span>
        </h1>

        <div style={buttonsRow}>
          <Link
            to="/dashboard"
            style={{ ...btnBase, ...btnPrimary }}
            aria-label="Go to Dashboard"
            data-variant="primary"
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onMouseDown={onDown}
            onMouseUp={onUp}
          >
            Dashboard
          </Link>

          <Link
            to="/model"
            style={{ ...btnBase, ...btnGhost }}
            aria-label="Go to Collision model"
            data-variant="ghost"
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onMouseDown={onDown}
            onMouseUp={onUp}
          >
            Collision model
          </Link>
        </div>

        <div style={byline}>by Wukai Jiang</div>
      </main>

      <footer style={footer}>
        data credit: Société de l'assurance automobile du Québec (SAAQ), Ville de Montréal
      </footer>
    </div>
  )
}

/* ===== Styles ===== */
const palette = {
  black: '#090909',
  charcoal: '#262626',
  redDeep: '#8E1616',
  redBright: '#D84040',
  grey: '#808080',
  white: '#FFFFFF',
}

const container: React.CSSProperties = {
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji',
  backgroundColor: palette.black,
  color: palette.white,
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
}

const main: React.CSSProperties = {
  flex: 1,
  maxWidth: 940,
  margin: '0 auto',
  padding: '64px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: 28,
}

const title: React.CSSProperties = {
  fontWeight: 800,
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
  margin: 0,
  fontSize: 'clamp(28px, 4.2vw, 48px)',
  textTransform: 'uppercase',
}

const mainSpan: React.CSSProperties = {
  color: palette.redBright, // now the main title is red
}

const yearSpan: React.CSSProperties = {
  fontWeight: 700,
  color: palette.white, // year is white
}

const buttonsRow: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
}

const btnBase: React.CSSProperties = {
  display: 'inline-block',
  textDecoration: 'none',
  padding: '14px 22px',
  borderRadius: 12,
  fontSize: '1rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'none',
  border: `1px solid ${palette.charcoal}`,
  transition:
    'transform 160ms ease, background-color 160ms ease, border-color 160ms ease, color 160ms ease',
  willChange: 'transform',
}

const btnPrimary: React.CSSProperties = {
  backgroundColor: palette.redDeep,
  borderColor: palette.redDeep,
  color: palette.white,
  boxShadow: '0 8px 24px rgba(216,64,64,0.20)',
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: palette.grey,
  borderColor: palette.grey,
  cursor: 'pointer',
}

const byline: React.CSSProperties = {
  color: palette.grey,
  fontSize: '0.95rem',
  marginTop: 8,
}

const footer: React.CSSProperties = {
  marginTop: 'auto',
  textAlign: 'center',
  padding: '20px 16px 28px',
  color: palette.grey,
  fontSize: '0.9rem',
  borderTop: `1px solid ${palette.charcoal}`,
}
