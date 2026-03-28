import type React from 'react'

export const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  marginBottom: 16,
  overflow: 'hidden',
  transition: 'border-color 0.2s',
}

export const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'background 0.15s',
}

export const cardBodyStyle: React.CSSProperties = {
  padding: '0 16px 16px',
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-input, var(--bg-primary))',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  backgroundSize: '16px',
  paddingRight: 32,
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
}

export const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 14,
}

export const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px 16px',
  background: active ? 'var(--accent, #fff)' : 'transparent',
  color: active ? 'var(--bg-primary, #000)' : 'var(--text-secondary)',
  border: active ? 'none' : '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  fontFamily: 'inherit',
  transition: 'all 0.15s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
})

export const toggleStyle = (on: boolean): React.CSSProperties => ({
  width: 44,
  height: 24,
  borderRadius: 12,
  background: on ? 'var(--green, #22c55e)' : 'var(--border)',
  border: 'none',
  cursor: 'pointer',
  position: 'relative',
  transition: 'background 0.2s',
  flexShrink: 0,
})

export const toggleKnobStyle = (on: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 3,
  left: on ? 23 : 3,
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: 'var(--text-primary, #fff)',
  transition: 'left 0.2s',
})

export const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid var(--border)',
}

export const dangerCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: 'var(--red, #ef4444)',
  borderWidth: 1,
}

export const warningBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: 12,
  background: 'rgba(234, 179, 8, 0.08)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(234, 179, 8, 0.2)',
  marginTop: 12,
  fontSize: 12,
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
}
