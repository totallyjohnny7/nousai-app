/**
 * PhysicsCalculator — Desmos calculator (5 types) + formula sheet panel
 *
 * API key stored in localStorage['nousai-desmos-api-key'] — per-user,
 * per-browser. Each person must supply their own key from desmos.com/api.
 * Falls back to VITE_DESMOS_API_KEY env var if set (owner's convenience).
 */
import { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { X, Settings } from 'lucide-react'
import type { FormulaEntry } from './types'

// ─── Desmos key storage ───────────────────────────────────────────────────────

const DESMOS_KEY_STORAGE = 'nousai-desmos-api-key'
const DESMOS_TYPE_STORAGE = 'nousai-desmos-calc-type'

function getStoredKey(): string {
  return (
    localStorage.getItem(DESMOS_KEY_STORAGE) ||
    (import.meta.env.VITE_DESMOS_API_KEY as string | undefined) ||
    ''
  )
}

// ─── Desmos loader (module-level singleton — safe for StrictMode) ─────────────

declare global {
  interface Window {
    Desmos?: {
      ScientificCalculator:  (el: HTMLElement, opts?: Record<string, unknown>) => { destroy: () => void }
      GraphingCalculator:    (el: HTMLElement, opts?: Record<string, unknown>) => { destroy: () => void }
      FourFunctionCalculator:(el: HTMLElement, opts?: Record<string, unknown>) => { destroy: () => void }
      Geometry:              (el: HTMLElement, opts?: Record<string, unknown>) => { destroy: () => void }
      Calculator3d?:         (el: HTMLElement, opts?: Record<string, unknown>) => { destroy: () => void }
    }
  }
}

let desmosLoadedKey: string | null = null
let desmosLoadPromise: Promise<void> | null = null

function loadDesmos(apiKey: string): Promise<void> {
  if (desmosLoadedKey === apiKey && desmosLoadPromise) return desmosLoadPromise
  if (window.Desmos && desmosLoadedKey === apiKey) {
    desmosLoadPromise = Promise.resolve()
    return desmosLoadPromise
  }
  // v1.10 required for 3D graphing calculator
  desmosLoadedKey = apiKey
  desmosLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://www.desmos.com/api/v1.10/calculator.js?apiKey=${apiKey}`
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
  return desmosLoadPromise
}

// ─── Calculator types ─────────────────────────────────────────────────────────

export type DesmosCalcType = 'scientific' | 'graphing' | '3d' | 'fourfunction' | 'geometry'

const CALC_TYPES: { id: DesmosCalcType; label: string; icon: string }[] = [
  { id: 'scientific',   label: 'Scientific',  icon: '⊞' },
  { id: 'graphing',     label: 'Graphing',    icon: '📈' },
  { id: '3d',           label: '3D',          icon: '🧊' },
  { id: 'fourfunction', label: '4-Func',      icon: '＋' },
  { id: 'geometry',     label: 'Geometry',    icon: '📐' },
]

function createCalcInstance(
  type: DesmosCalcType,
  el: HTMLElement,
): { destroy: () => void } | null {
  if (!window.Desmos) return null
  try {
    switch (type) {
      case 'scientific':   return window.Desmos.ScientificCalculator(el, { keypad: true })
      case 'graphing':     return window.Desmos.GraphingCalculator(el, { keypad: true })
      case '3d':           return window.Desmos.Calculator3d?.(el, { keypad: true }) ?? null
      case 'fourfunction': return window.Desmos.FourFunctionCalculator(el, { keypad: true })
      case 'geometry':     return window.Desmos.Geometry(el, {})
      default:             return window.Desmos.ScientificCalculator(el, { keypad: true })
    }
  } catch {
    return null
  }
}

// ─── Safe eval fallback ───────────────────────────────────────────────────────

function safeEval(expr: string): string {
  const sanitized = expr
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\blog\b/g, 'Math.log10')
    .replace(/\bln\b/g, 'Math.log')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\^/g, '**')
    .replace(/\bpi\b/g, 'Math.PI')
    .replace(/\be\b/g, 'Math.E')
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const result = new Function(`return ${sanitized}`)()
    return String(result)
  } catch {
    return 'Error'
  }
}

// ─── Formula data ─────────────────────────────────────────────────────────────

const MECHANICS: FormulaEntry[] = [
  { label: "Newton's 2nd Law", latex: 'F = ma', variables: 'F=force(N), m=mass(kg), a=accel(m/s²)' },
  { label: 'Weight', latex: 'W = mg', variables: 'g=9.81 m/s²' },
  { label: 'Kinematic v', latex: 'v = v_0 + at' },
  { label: 'Kinematic x', latex: 'x = v_0t + \\frac{1}{2}at^2' },
  { label: 'Kinematic v²', latex: 'v^2 = v_0^2 + 2a\\Delta x' },
  { label: 'Work', latex: 'W = F \\cdot d \\cos\\theta' },
  { label: 'Kinetic Energy', latex: 'KE = \\frac{1}{2}mv^2' },
  { label: 'Potential Energy', latex: 'PE = mgh' },
  { label: 'Power', latex: 'P = \\frac{W}{t} = Fv' },
  { label: 'Momentum', latex: 'p = mv' },
  { label: 'Impulse', latex: 'J = F\\Delta t = \\Delta p' },
  { label: 'Centripetal Accel', latex: 'a_c = \\frac{v^2}{r}' },
  { label: 'Torque', latex: '\\tau = rF\\sin\\theta' },
  { label: 'Friction', latex: 'f = \\mu N' },
  { label: "Hooke's Law", latex: 'F = -kx' },
]

const EM: FormulaEntry[] = [
  { label: "Coulomb's Law", latex: 'F = k\\frac{q_1 q_2}{r^2}', variables: 'k=8.99×10⁹ N·m²/C²' },
  { label: 'Electric Field', latex: 'E = \\frac{F}{q} = k\\frac{Q}{r^2}' },
  { label: 'Electric Potential', latex: 'V = k\\frac{Q}{r}' },
  { label: 'Capacitance', latex: 'C = \\frac{Q}{V}' },
  { label: "Ohm's Law", latex: 'V = IR' },
  { label: 'Power (circuit)', latex: 'P = IV = I^2R = \\frac{V^2}{R}' },
  { label: 'Resistors series', latex: 'R_{total} = R_1 + R_2 + ...' },
  { label: 'Resistors parallel', latex: '\\frac{1}{R_{total}} = \\frac{1}{R_1} + \\frac{1}{R_2}' },
  { label: 'Magnetic Force', latex: 'F = qvB\\sin\\theta' },
  { label: "Faraday's Law", latex: '\\mathcal{E} = -\\frac{d\\Phi_B}{dt}' },
  { label: 'Magnetic Field (wire)', latex: 'B = \\frac{\\mu_0 I}{2\\pi r}' },
  { label: 'Electric Flux', latex: '\\Phi_E = EA\\cos\\theta' },
]

const THERMO: FormulaEntry[] = [
  { label: 'Ideal Gas Law', latex: 'PV = nRT', variables: 'R=8.314 J/(mol·K)' },
  { label: 'First Law Thermo', latex: '\\Delta U = Q - W' },
  { label: 'Heat Transfer', latex: 'Q = mc\\Delta T' },
  { label: 'Thermal Efficiency', latex: '\\eta = 1 - \\frac{T_C}{T_H}' },
  { label: 'Entropy', latex: '\\Delta S = \\frac{Q}{T}' },
  { label: 'Stefan-Boltzmann', latex: 'P = \\sigma A T^4', variables: 'σ=5.67×10⁻⁸ W/(m²·K⁴)' },
  { label: 'RMS Speed', latex: 'v_{rms} = \\sqrt{\\frac{3RT}{M}}' },
  { label: 'Avg KE', latex: '\\bar{KE} = \\frac{3}{2}k_B T', variables: 'k_B=1.38×10⁻²³ J/K' },
]

const WAVES: FormulaEntry[] = [
  { label: 'Wave Speed', latex: 'v = f\\lambda' },
  { label: 'Period', latex: 'T = \\frac{1}{f}' },
  { label: 'Simple Pendulum', latex: 'T = 2\\pi\\sqrt{\\frac{L}{g}}' },
  { label: 'Spring Oscillation', latex: 'T = 2\\pi\\sqrt{\\frac{m}{k}}' },
  { label: "Snell's Law", latex: 'n_1\\sin\\theta_1 = n_2\\sin\\theta_2' },
  { label: 'Mirror/Lens Eq', latex: '\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}' },
  { label: 'Magnification', latex: 'm = -\\frac{d_i}{d_o}' },
  { label: 'Doppler Effect', latex: "f' = f\\frac{v \\pm v_o}{v \\mp v_s}" },
  { label: 'Standing Wave (string)', latex: 'f_n = \\frac{nv}{2L}' },
  { label: 'Intensity', latex: 'I = \\frac{P}{4\\pi r^2}' },
]

const MODERN: FormulaEntry[] = [
  { label: 'Photoelectric Effect', latex: 'E = hf - \\phi', variables: 'h=6.626×10⁻³⁴ J·s' },
  { label: 'de Broglie', latex: '\\lambda = \\frac{h}{p} = \\frac{h}{mv}' },
  { label: 'Energy-Mass', latex: 'E = mc^2', variables: 'c=3×10⁸ m/s' },
  { label: 'Relativistic KE', latex: 'KE = (\\gamma - 1)mc^2' },
  { label: 'Lorentz Factor', latex: '\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}' },
  { label: 'Half Life', latex: 'N = N_0 e^{-\\lambda t}' },
  { label: 'Bohr Energy', latex: 'E_n = -\\frac{13.6 \\text{ eV}}{n^2}' },
  { label: 'Heisenberg Uncertainty', latex: '\\Delta x \\cdot \\Delta p \\geq \\frac{\\hbar}{2}' },
]

type MainTab = 'calculator' | 'formulas'
type FormulaSubTab = 'mechanics' | 'em' | 'thermo' | 'waves' | 'modern'

const FORMULA_TABS: { id: FormulaSubTab; label: string; data: FormulaEntry[] }[] = [
  { id: 'mechanics', label: 'Mechanics', data: MECHANICS },
  { id: 'em',        label: 'E&M',       data: EM },
  { id: 'thermo',    label: 'Thermo',    data: THERMO },
  { id: 'waves',     label: 'Waves',     data: WAVES },
  { id: 'modern',    label: 'Modern',    data: MODERN },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function RenderedLatex({ latex }: { latex: string }) {
  const html = katex.renderToString(latex, { throwOnError: false, displayMode: false })
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

function FormulaRow({ entry }: { entry: FormulaEntry }) {
  return (
    <div style={styles.formulaRow}>
      <div style={styles.formulaLabel}>{entry.label}</div>
      <div style={styles.formulaLatex}><RenderedLatex latex={entry.latex} /></div>
      {entry.variables && <div style={styles.formulaVars}>{entry.variables}</div>}
    </div>
  )
}

function FallbackCalculator() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([])

  function evaluate() {
    if (!input.trim()) return
    const res = safeEval(input.trim())
    setResult(res)
    setHistory(h => [{ expr: input.trim(), result: res }, ...h].slice(0, 8))
    setInput('')
  }

  return (
    <div style={styles.fallback}>
      <div style={styles.fallbackBanner}>
        Desmos unavailable — basic calculator active.
      </div>
      <div style={styles.fallbackDisplay}>
        {result !== null && <span style={styles.fallbackResult}>{result}</span>}
      </div>
      <input
        style={styles.fallbackInput}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && evaluate()}
        placeholder="Type expression, press Enter (e.g. sin(pi/2))"
        spellCheck={false}
        autoComplete="off"
      />
      <button style={styles.fallbackBtn} onClick={evaluate}>= Evaluate</button>
      {history.length > 0 && (
        <div style={styles.fallbackHistory}>
          {history.map((h, i) => (
            <div key={i} style={styles.fallbackHistoryRow}>
              <span style={styles.fallbackHistoryExpr}>{h.expr}</span>
              <span style={styles.fallbackHistoryEq}>=</span>
              <span style={styles.fallbackHistoryVal}>{h.result}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DesmosCalculator({ apiKey, calcType }: { apiKey: string; calcType: DesmosCalcType }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<{ destroy: () => void } | null>(null)
  const [failed, setFailed] = useState(false)
  const [needs3dReload, setNeeds3dReload] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    instanceRef.current?.destroy()
    instanceRef.current = null

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Desmos load timeout')), 5000)
    })

    Promise.race([loadDesmos(apiKey), timeout])
      .then(() => {
        clearTimeout(timeoutId)
        if (cancelled || !containerRef.current || !window.Desmos) return
        // 3D requires Calculator3d to exist on the Desmos object
        if (calcType === '3d' && !window.Desmos.Calculator3d) {
          setNeeds3dReload(true)
          return
        }
        const instance = createCalcInstance(calcType, containerRef.current)
        if (!instance) { setFailed(true); return }
        instanceRef.current = instance
      })
      .catch(() => {
        clearTimeout(timeoutId)
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      instanceRef.current?.destroy()
      instanceRef.current = null
    }
  }, [apiKey, calcType])

  if (needs3dReload) return (
    <div style={styles.infoBox}>
      3D Graphing requires a page reload after the first Desmos load.{' '}
      <button style={styles.reloadLink} onClick={() => window.location.reload()}>Reload now</button>
    </div>
  )
  if (failed) return <FallbackCalculator />
  return <div ref={containerRef} style={styles.desmosContainer} />
}

// ─── API key setup prompt ─────────────────────────────────────────────────────

function KeySetup({ onSave }: { onSave: (key: string) => void }) {
  const [value, setValue] = useState('')

  return (
    <div style={styles.keySetup}>
      <div style={styles.keySetupTitle}>Desmos API Key Required</div>
      <div style={styles.keySetupDesc}>
        Each user needs their own free API key from{' '}
        <strong>desmos.com/api</strong> — it takes 1 minute to register.
      </div>
      <input
        style={styles.keyInput}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Paste your Desmos API key here"
        spellCheck={false}
        autoComplete="off"
      />
      <button
        style={{ ...styles.fallbackBtn, opacity: value.trim() ? 1 : 0.4 }}
        disabled={!value.trim()}
        onClick={() => {
          const key = value.trim()
          localStorage.setItem(DESMOS_KEY_STORAGE, key)
          onSave(key)
        }}
      >
        Save &amp; Load Desmos
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onClose?: () => void
}

export default function PhysicsCalculator({ onClose }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('calculator')
  const [formulaTab, setFormulaTab] = useState<FormulaSubTab>('mechanics')
  const [calcType, setCalcType] = useState<DesmosCalcType>(
    () => (localStorage.getItem(DESMOS_TYPE_STORAGE) as DesmosCalcType | null) ?? 'scientific'
  )
  const [apiKey, setApiKey] = useState<string>(() => getStoredKey())
  const [showKeyEdit, setShowKeyEdit] = useState(false)
  const [keySaved, setKeySaved] = useState(false)

  const hasKey = apiKey.trim().length > 0
  const currentFormulas = FORMULA_TABS.find(t => t.id === formulaTab)?.data ?? []

  function handleCalcTypeChange(type: DesmosCalcType) {
    setCalcType(type)
    localStorage.setItem(DESMOS_TYPE_STORAGE, type)
  }

  function handleKeySave(key: string) {
    setApiKey(key)
    setShowKeyEdit(false)
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  return (
    <div style={styles.panel}>
      {/* Header row */}
      <div style={styles.header}>
        <div style={styles.mainTabs}>
          <button
            style={{ ...styles.mainTabBtn, ...(mainTab === 'calculator' ? styles.mainTabBtnActive : {}) }}
            onClick={() => setMainTab('calculator')}
          >
            ⊞ Calculator
          </button>
          <button
            style={{ ...styles.mainTabBtn, ...(mainTab === 'formulas' ? styles.mainTabBtnActive : {}) }}
            onClick={() => setMainTab('formulas')}
          >
            📐 Formulas
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {mainTab === 'calculator' && hasKey && (
            <button
              style={styles.iconBtn}
              onClick={() => setShowKeyEdit(v => !v)}
              title="Change Desmos API key"
            >
              <Settings size={14} />
            </button>
          )}
          {onClose && (
            <button style={styles.iconBtn} onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Calculator type picker (only in calculator tab, when key is set) */}
      {mainTab === 'calculator' && hasKey && !showKeyEdit && (
        <div style={styles.typeRow}>
          {CALC_TYPES.map(ct => (
            <button
              key={ct.id}
              style={{ ...styles.typeBtn, ...(calcType === ct.id ? styles.typeBtnActive : {}) }}
              onClick={() => handleCalcTypeChange(ct.id)}
              title={ct.label}
            >
              <span style={{ fontSize: 13 }}>{ct.icon}</span>
              <span style={{ fontSize: 11 }}>{ct.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Key edit inline panel */}
      {mainTab === 'calculator' && showKeyEdit && (
        <div style={styles.keyEditRow}>
          <input
            style={{ ...styles.keyInput, flexGrow: 1 }}
            defaultValue={apiKey}
            placeholder="Desmos API key"
            spellCheck={false}
            autoComplete="off"
            id="desmos-key-edit"
          />
          <button
            style={styles.fallbackBtn}
            onClick={() => {
              const input = document.getElementById('desmos-key-edit') as HTMLInputElement
              const key = input.value.trim()
              if (!key) return
              localStorage.setItem(DESMOS_KEY_STORAGE, key)
              // Reset load promise so next load uses new key
              desmosLoadPromise = null
              desmosLoadedKey = null
              handleKeySave(key)
            }}
          >
            {keySaved ? '✓ Saved' : 'Save'}
          </button>
          <button style={styles.iconBtn} onClick={() => setShowKeyEdit(false)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Calculator tab body */}
      {mainTab === 'calculator' && (
        <div style={styles.calcContainer}>
          {!hasKey
            ? <KeySetup onSave={handleKeySave} />
            : <DesmosCalculator apiKey={apiKey} calcType={calcType} />
          }
        </div>
      )}

      {/* Formulas tab body */}
      {mainTab === 'formulas' && (
        <div style={styles.formulasPane}>
          <div style={styles.subTabs}>
            {FORMULA_TABS.map(t => (
              <button
                key={t.id}
                style={{ ...styles.subTabBtn, ...(formulaTab === t.id ? styles.subTabBtnActive : {}) }}
                onClick={() => setFormulaTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={styles.formulaList}>
            {currentFormulas.map((entry, i) => (
              <FormulaRow key={i} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 520,
    width: '100%',
    boxShadow: 'var(--shadow)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border)',
    padding: '0 8px 0 4px',
    flexShrink: 0,
    background: 'var(--bg-secondary)',
  },
  mainTabs: { display: 'flex', gap: 0 },
  mainTabBtn: {
    background: 'none', border: 'none',
    borderBottom: '2px solid transparent',
    padding: '10px 14px',
    color: 'var(--text-secondary)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
    fontFamily: 'inherit',
  },
  mainTabBtnActive: {
    color: 'var(--yellow)',
    borderBottom: '2px solid var(--yellow)',
  },
  iconBtn: {
    background: 'none', border: 'none',
    color: 'var(--text-muted)', cursor: 'pointer',
    padding: 6, borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', lineHeight: 1,
    transition: 'color 0.15s',
  },
  // Calculator type row
  typeRow: {
    display: 'flex',
    gap: 4,
    padding: '6px 8px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    overflowX: 'auto',
  },
  typeBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 2, padding: '5px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'none', color: 'var(--text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s',
    fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
  },
  typeBtnActive: {
    background: 'rgba(245,166,35,0.12)',
    borderColor: 'rgba(245,166,35,0.4)',
    color: 'var(--yellow)',
  },
  // Key setup
  keySetup: {
    display: 'flex', flexDirection: 'column', gap: 10,
    padding: '20px 16px',
  },
  keySetupTitle: {
    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
  },
  keySetupDesc: {
    fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
  },
  keyEditRow: {
    display: 'flex', gap: 6, alignItems: 'center',
    padding: '8px 10px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)', flexShrink: 0,
  },
  keyInput: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '7px 10px',
    color: 'var(--text-primary)',
    fontSize: 13, fontFamily: 'var(--font-mono)',
    outline: 'none', width: '100%',
  },
  infoBox: {
    padding: '20px 16px',
    fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
  },
  reloadLink: {
    background: 'none', border: 'none',
    color: 'var(--yellow)', textDecoration: 'underline',
    cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0,
  },
  calcContainer: { flexGrow: 1, overflow: 'hidden', minHeight: 320 },
  desmosContainer: { width: '100%', height: 320 },
  // Fallback calculator
  fallback: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '12px 14px', height: 320, boxSizing: 'border-box', overflow: 'hidden',
  },
  fallbackBanner: {
    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
    borderRadius: 'var(--radius-sm)', padding: '5px 10px',
    color: 'var(--yellow)', fontSize: 12, flexShrink: 0,
  },
  fallbackDisplay: {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '6px 10px',
    minHeight: 32, display: 'flex', alignItems: 'center',
    justifyContent: 'flex-end', flexShrink: 0,
  },
  fallbackResult: {
    color: 'var(--text-primary)', fontSize: 18,
    fontFamily: 'var(--font-mono)', fontWeight: 500,
  },
  fallbackInput: {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '8px 10px',
    color: 'var(--text-primary)', fontSize: 14,
    fontFamily: 'var(--font-mono)', outline: 'none', flexShrink: 0,
  },
  fallbackBtn: {
    background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
    borderRadius: 'var(--radius-sm)', color: 'var(--yellow)',
    fontSize: 13, fontWeight: 600, padding: '7px 12px',
    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, alignSelf: 'flex-start',
  },
  fallbackHistory: {
    overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1,
  },
  fallbackHistoryRow: {
    display: 'flex', gap: 8, alignItems: 'center',
    padding: '3px 6px', borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-secondary)',
  },
  fallbackHistoryExpr: {
    color: 'var(--text-secondary)', fontSize: 12,
    fontFamily: 'var(--font-mono)', flexGrow: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  fallbackHistoryEq: { color: 'var(--text-muted)', fontSize: 12 },
  fallbackHistoryVal: {
    color: 'var(--yellow)', fontSize: 12,
    fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0,
  },
  // Formulas pane
  formulasPane: { display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' },
  subTabs: {
    display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
    padding: '0 4px', background: 'var(--bg-secondary)',
    flexShrink: 0, overflowX: 'auto',
  },
  subTabBtn: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '8px 12px', color: 'var(--text-secondary)',
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap', fontFamily: 'inherit',
  },
  subTabBtnActive: { color: 'var(--yellow)', borderBottom: '2px solid var(--yellow)' },
  formulaList: { overflowY: 'auto', flexGrow: 1, padding: '6px 0' },
  formulaRow: {
    padding: '7px 14px', borderBottom: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 2, transition: 'background 0.1s',
  },
  formulaLabel: {
    fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  formulaLatex: { fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.4 },
  formulaVars: { fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 1 },
}
