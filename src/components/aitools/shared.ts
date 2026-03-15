import type React from 'react';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: 12, border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
  outline: 'none',
};

export const selectStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
};
