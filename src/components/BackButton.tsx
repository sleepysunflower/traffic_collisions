import React from 'react'
import { Link } from 'react-router-dom'

const palette = {
  redDeep: '#8E1616',
  redBright: '#D84040',
  charcoal: '#262626',
  silver: '#C0C0C0',
  black: '#090909',
}

export default function BackButton() {
  // fixed so it never affects layout; higher z-index than TopBar (which uses 1000)
  const wrap: React.CSSProperties = {
    position: 'fixed',
    top: 12,
    left: 12,
    zIndex: 2000,
  }

  const btn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 12,
    backgroundColor: palette.redDeep,
    border: `1px solid ${palette.charcoal}`,
    color: palette.silver,            // ← silver text as requested
    fontWeight: 700,
    fontSize: 14,
    textDecoration: 'none',
    boxShadow: '0 4px 14px rgba(216,64,64,0.25)',
    transition: 'transform 120ms ease, background-color 120ms ease, border-color 120ms ease',
    willChange: 'transform',
  }

  const icon: React.CSSProperties = {
    width: 16,
    height: 16,
    display: 'inline-block',
  }

  return (
    <div style={wrap}>
      <Link
        to="/"
        aria-label="Back to main page"
        style={btn}
        onMouseEnter={(e) => {
          const el = e.currentTarget
          el.style.backgroundColor = palette.redBright
          el.style.borderColor = palette.redBright
          el.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.backgroundColor = palette.redDeep
          el.style.borderColor = palette.charcoal
          el.style.transform = 'translateY(0)'
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
      >
        {/* chevron-left icon (SVG, no external deps) */}
        <svg viewBox="0 0 24 24" fill="currentColor" style={icon} aria-hidden="true">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Back
      </Link>
    </div>
  )
}
