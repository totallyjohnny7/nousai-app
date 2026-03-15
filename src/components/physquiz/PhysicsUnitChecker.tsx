import React, { useState, useCallback, useRef } from 'react';
import { X, Plus, Check, AlertCircle, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  onClose?: () => void;
}

/** A unit exponent map: unit symbol → net exponent (positive = numerator) */
type UnitMap = Record<string, number>;

// ---------------------------------------------------------------------------
// Unit catalog
// ---------------------------------------------------------------------------

interface UnitEntry {
  symbol: string;
  label: string;
}

interface UnitCategory {
  category: string;
  units: UnitEntry[];
}

const UNIT_CATALOG: UnitCategory[] = [
  {
    category: 'Length',
    units: [
      { symbol: 'm', label: 'm — metre' },
      { symbol: 'km', label: 'km — kilometre' },
      { symbol: 'cm', label: 'cm — centimetre' },
      { symbol: 'mm', label: 'mm — millimetre' },
    ],
  },
  {
    category: 'Mass',
    units: [
      { symbol: 'kg', label: 'kg — kilogram' },
      { symbol: 'g', label: 'g — gram' },
    ],
  },
  {
    category: 'Time',
    units: [
      { symbol: 's', label: 's — second' },
      { symbol: 'ms', label: 'ms — millisecond' },
      { symbol: 'min', label: 'min — minute' },
      { symbol: 'hr', label: 'hr — hour' },
    ],
  },
  {
    category: 'Force',
    units: [
      { symbol: 'N', label: 'N — newton' },
      { symbol: 'kN', label: 'kN — kilonewton' },
    ],
  },
  {
    category: 'Energy',
    units: [
      { symbol: 'J', label: 'J — joule' },
      { symbol: 'eV', label: 'eV — electronvolt' },
      { symbol: 'kJ', label: 'kJ — kilojoule' },
    ],
  },
  {
    category: 'Power',
    units: [
      { symbol: 'W', label: 'W — watt' },
      { symbol: 'kW', label: 'kW — kilowatt' },
    ],
  },
  {
    category: 'Pressure',
    units: [
      { symbol: 'Pa', label: 'Pa — pascal' },
      { symbol: 'atm', label: 'atm — atmosphere' },
    ],
  },
  {
    category: 'Electric',
    units: [
      { symbol: 'V', label: 'V — volt' },
      { symbol: 'A', label: 'A — ampere' },
      { symbol: 'Ω', label: 'Ω — ohm' },
      { symbol: 'C', label: 'C — coulomb' },
    ],
  },
  {
    category: 'Temperature',
    units: [
      { symbol: 'K', label: 'K — kelvin' },
      { symbol: '°C', label: '°C — Celsius' },
    ],
  },
  {
    category: 'Angle',
    units: [
      { symbol: 'rad', label: 'rad — radian' },
      { symbol: 'deg', label: 'deg — degree' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Known composite unit decompositions (in SI base units)
// Each value is a UnitMap representing the decomposition.
// ---------------------------------------------------------------------------

/** Decompose a composite symbol into SI base-unit exponent map */
const COMPOSITES: Record<string, UnitMap> = {
  N: { kg: 1, m: 1, s: -2 },                // kg·m·s⁻²
  J: { kg: 1, m: 2, s: -2 },                // kg·m²·s⁻²
  W: { kg: 1, m: 2, s: -3 },                // kg·m²·s⁻³
  Pa: { kg: 1, m: -1, s: -2 },              // kg·m⁻¹·s⁻²
  V: { kg: 1, m: 2, s: -3, A: -1 },         // kg·m²·s⁻³·A⁻¹
  Ω: { kg: 1, m: 2, s: -3, A: -2 },         // kg·m²·s⁻³·A⁻²
  C: { A: 1, s: 1 },                         // A·s
};

// ---------------------------------------------------------------------------
// Simplification helpers
// ---------------------------------------------------------------------------

/** Expand a single unit symbol into SI base-unit exponent map, scaled by exp */
function expandUnit(symbol: string, exp: number): UnitMap {
  const composite = COMPOSITES[symbol];
  if (composite) {
    const result: UnitMap = {};
    for (const [base, baseExp] of Object.entries(composite)) {
      result[base] = (result[base] ?? 0) + baseExp * exp;
    }
    return result;
  }
  return { [symbol]: exp };
}

/** Merge two UnitMaps (add exponents) */
function mergeUnitMaps(a: UnitMap, b: UnitMap): UnitMap {
  const result: UnitMap = { ...a };
  for (const [sym, exp] of Object.entries(b)) {
    result[sym] = (result[sym] ?? 0) + exp;
  }
  return result;
}

/** Remove zero-exponent entries */
function pruneZeros(m: UnitMap): UnitMap {
  const result: UnitMap = {};
  for (const [sym, exp] of Object.entries(m)) {
    if (exp !== 0) result[sym] = exp;
  }
  return result;
}

/**
 * Fully expand a list of unit pills (each with exponent sign) into a net
 * SI base-unit exponent map.
 * numeratorPills: exponent +1 each; denominatorPills: exponent -1 each
 */
function computeNetMap(numerator: string[], denominator: string[]): UnitMap {
  let net: UnitMap = {};
  for (const sym of numerator) {
    net = mergeUnitMaps(net, expandUnit(sym, 1));
  }
  for (const sym of denominator) {
    net = mergeUnitMaps(net, expandUnit(sym, -1));
  }
  return pruneZeros(net);
}

/** Format a UnitMap as a human-readable fraction string: "m·kg / s²" */
function formatUnitMap(m: UnitMap): string {
  const num: string[] = [];
  const den: string[] = [];

  for (const [sym, exp] of Object.entries(m)) {
    if (exp > 0) {
      num.push(exp === 1 ? sym : `${sym}${toSuperscript(exp)}`);
    } else {
      den.push(exp === -1 ? sym : `${sym}${toSuperscript(-exp)}`);
    }
  }

  if (num.length === 0 && den.length === 0) return '(dimensionless)';
  if (den.length === 0) return num.join('·');
  if (num.length === 0) return `1/${den.join('·')}`;
  return `${num.join('·')}/${den.join('·')}`;
}

function toSuperscript(n: number): string {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻',
  };
  return String(n)
    .split('')
    .map(c => map[c] ?? c)
    .join('');
}

/** Compare two UnitMaps for equality */
function mapsEqual(a: UnitMap, b: UnitMap): boolean {
  const aKeys = Object.keys(a).filter(k => a[k] !== 0);
  const bKeys = Object.keys(b).filter(k => b[k] !== 0);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => a[k] === b[k]);
}

/**
 * Try to match a net UnitMap to a known composite name.
 * Returns the composite symbol if matched, null otherwise.
 */
function tryMatchComposite(net: UnitMap): string | null {
  for (const [sym, composite] of Object.entries(COMPOSITES)) {
    if (mapsEqual(net, composite)) return sym;
  }
  return null;
}

/**
 * Parse a user-typed unit string like "m/s²" or "kg·m/s²" into a UnitMap.
 * Supports: · and * as multiplication, / as division, ^ for exponents,
 * superscript digits, and implicit exponent 1.
 */
function parseUnitString(raw: string): UnitMap | null {
  try {
    const normalized = raw
      .trim()
      .replace(/[·*]/g, '·')
      .replace(/\^/g, '^');

    // Split into numerator / denominator at '/'
    const parts = normalized.split('/');
    const numStr = parts[0] ?? '';
    const denStr = parts[1] ?? '';

    function parsePart(s: string): UnitMap {
      const result: UnitMap = {};
      if (!s.trim()) return result;
      const tokens = s.split('·').map(t => t.trim()).filter(Boolean);
      for (const token of tokens) {
        // Match: symbol, optional ^, optional exponent (possibly superscript)
        const match = token.match(
          /^([A-Za-zΩ°µ]+(?:[A-Za-z0-9]*))(?:\^([−\-]?[0-9⁰¹²³⁴⁵⁶⁷⁸⁹]+)|([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+))?$/
        );
        if (!match) continue;
        const sym = match[1];
        let exp = 1;
        if (match[2]) {
          exp = parseInt(match[2].replace('−', '-'), 10);
        } else if (match[3]) {
          exp = fromSuperscript(match[3]);
        }
        result[sym] = (result[sym] ?? 0) + exp;
      }
      return result;
    }

    const num = parsePart(numStr);
    const den = parsePart(denStr);

    let net: UnitMap = { ...num };
    for (const [sym, exp] of Object.entries(den)) {
      net[sym] = (net[sym] ?? 0) - exp;
    }
    return pruneZeros(net);
  } catch {
    return null;
  }
}

function fromSuperscript(s: string): number {
  const map: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-',
  };
  const digits = s.split('').map(c => map[c] ?? c).join('');
  return parseInt(digits, 10);
}

// ---------------------------------------------------------------------------
// Check result type
// ---------------------------------------------------------------------------

type CheckStatus = 'match' | 'mismatch' | 'partial' | 'idle';

interface CheckResult {
  status: CheckStatus;
  message: string;
}

// ---------------------------------------------------------------------------
// Pill component
// ---------------------------------------------------------------------------

function UnitPill({
  symbol,
  onRemove,
}: {
  symbol: string;
  onRemove: () => void;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--accent)',
        color: '#fff',
        borderRadius: 6,
        padding: '3px 8px 3px 10px',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'DM Mono, monospace',
        margin: '2px 3px',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {symbol}
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: 'rgba(255,255,255,0.8)',
          lineHeight: 1,
        }}
        aria-label={`Remove ${symbol}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Unit picker popover
// ---------------------------------------------------------------------------

function UnitPicker({
  onSelect,
  onClose,
  customValue,
  onCustomChange,
  onAddCustom,
}: {
  onSelect: (symbol: string) => void;
  onClose: () => void;
  customValue: string;
  onCustomChange: (v: string) => void;
  onAddCustom: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        zIndex: 300,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: 12,
        width: 260,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        maxHeight: 340,
        overflowY: 'auto',
      }}
    >
      {/* Custom unit input */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          autoFocus
          type="text"
          value={customValue}
          onChange={e => onCustomChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onAddCustom();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Custom unit…"
          style={{
            flex: 1,
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 12,
            outline: 'none',
            fontFamily: 'DM Mono, monospace',
          }}
        />
        <button
          onClick={onAddCustom}
          disabled={!customValue.trim()}
          style={{
            padding: '5px 10px',
            borderRadius: 6,
            border: 'none',
            background: customValue.trim() ? 'var(--accent)' : 'var(--border-color)',
            color: '#fff',
            cursor: customValue.trim() ? 'pointer' : 'not-allowed',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Add
        </button>
      </div>

      {/* Catalog */}
      {UNIT_CATALOG.map(cat => (
        <div key={cat.category} style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {cat.category}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {cat.units.map(u => (
              <button
                key={u.symbol}
                onClick={() => {
                  onSelect(u.symbol);
                  onClose();
                }}
                title={u.label}
                style={{
                  padding: '3px 9px',
                  borderRadius: 5,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'DM Mono, monospace',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {u.symbol}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zone component (Numerator or Denominator)
// ---------------------------------------------------------------------------

function UnitZone({
  label,
  units,
  onRemove,
  onAdd,
}: {
  label: string;
  units: string[];
  onRemove: (index: number) => void;
  onAdd: (symbol: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handleAddCustom = useCallback(() => {
    const sym = customValue.trim();
    if (!sym) return;
    onAdd(sym);
    setCustomValue('');
    setPickerOpen(false);
  }, [customValue, onAdd]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          minHeight: 44,
          border: units.length === 0 ? '1.5px dashed var(--border-color)' : '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '6px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          background: 'var(--bg-primary)',
        }}
      >
        {units.map((sym, i) => (
          <UnitPill key={`${sym}-${i}`} symbol={sym} onRemove={() => onRemove(i)} />
        ))}
        <button
          onClick={() => setPickerOpen(v => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            background: 'none',
            border: '1px dashed var(--border-color)',
            borderRadius: 6,
            padding: '3px 8px',
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            margin: '2px 3px',
            fontWeight: 600,
          }}
        >
          <Plus size={12} />
          Add Unit
        </button>
      </div>

      {pickerOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 299,
            }}
            onClick={() => setPickerOpen(false)}
          />
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 300, marginTop: 4 }}>
            <UnitPicker
              onSelect={sym => {
                onAdd(sym);
              }}
              onClose={() => setPickerOpen(false)}
              customValue={customValue}
              onCustomChange={setCustomValue}
              onAddCustom={handleAddCustom}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PhysicsUnitChecker({ onClose }: Props) {
  const [numerator, setNumerator] = useState<string[]>([]);
  const [denominator, setDenominator] = useState<string[]>([]);
  const [expected, setExpected] = useState('');
  const [result, setResult] = useState<CheckResult>({ status: 'idle', message: '' });

  // ── Computed expression ──
  const netMap = computeNetMap(numerator, denominator);
  const expressionStr = formatUnitMap(netMap);
  const matchedComposite = tryMatchComposite(netMap);

  const displayExpression = (() => {
    if (Object.keys(netMap).length === 0) return '—';
    if (matchedComposite) {
      return `${expressionStr} = ${matchedComposite}`;
    }
    return expressionStr;
  })();

  // ── Handlers ──
  const addToNumerator = useCallback((sym: string) => {
    setNumerator(prev => [...prev, sym]);
  }, []);

  const addToDenominator = useCallback((sym: string) => {
    setDenominator(prev => [...prev, sym]);
  }, []);

  const removeFromNumerator = useCallback((i: number) => {
    setNumerator(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const removeFromDenominator = useCallback((i: number) => {
    setDenominator(prev => prev.filter((_, idx) => idx !== i));
  }, []);

  const handleClearAll = useCallback(() => {
    setNumerator([]);
    setDenominator([]);
    setExpected('');
    setResult({ status: 'idle', message: '' });
  }, []);

  const handleCheck = useCallback(() => {
    if (!expected.trim()) {
      setResult({ status: 'idle', message: 'Enter an expected unit first.' });
      return;
    }

    const currentNet = computeNetMap(numerator, denominator);

    // Try to expand expected string
    const expectedMap = parseUnitString(expected);
    if (!expectedMap) {
      setResult({
        status: 'mismatch',
        message: `Could not parse expected unit "${expected}". Try formats like "m/s²" or "kg·m/s²".`,
      });
      return;
    }

    const currentExpanded = pruneZeros(currentNet);
    const expectedExpanded = pruneZeros(expectedMap);

    const currentStr = formatUnitMap(currentExpanded);
    const expectedStr = formatUnitMap(expectedExpanded);

    // Direct match on expanded SI maps
    if (mapsEqual(currentExpanded, expectedExpanded)) {
      setResult({
        status: 'match',
        message: `Units match: ${currentStr} = ${expected.trim()} ✓`,
      });
      return;
    }

    // Try matching composite alias: e.g. user enters "N", current is kg·m/s²
    const currentComposite = tryMatchComposite(currentExpanded);
    const expectedComposite = tryMatchComposite(expectedExpanded);
    if (currentComposite && expectedComposite && currentComposite === expectedComposite) {
      setResult({
        status: 'match',
        message: `Units match: ${currentStr} = ${currentComposite} = ${expected.trim()} ✓`,
      });
      return;
    }

    // Check if they partially agree (same base units but wrong exponents)
    const currentKeys = new Set(Object.keys(currentExpanded));
    const expectedKeys = new Set(Object.keys(expectedExpanded));
    const commonKeys = [...currentKeys].filter(k => expectedKeys.has(k));
    const allMatch = commonKeys.every(k => currentExpanded[k] === expectedExpanded[k]);
    const allKeys = new Set([...currentKeys, ...expectedKeys]);

    if (allMatch && commonKeys.length === allKeys.size - 1) {
      // Off by one unit
      setResult({
        status: 'partial',
        message: `Partial: ${currentStr} ≈ ${expectedStr} — check exponents`,
      });
      return;
    }

    setResult({
      status: 'mismatch',
      message: `Units don't match: got ${currentStr}, expected ${expectedStr}`,
    });
  }, [numerator, denominator, expected]);

  // ── Result styling ──
  const resultColors: Record<CheckStatus, { bg: string; border: string; text: string }> = {
    match: {
      bg: 'rgba(52,211,153,0.08)',
      border: 'rgba(52,211,153,0.3)',
      text: '#34d399',
    },
    mismatch: {
      bg: 'rgba(248,113,113,0.08)',
      border: 'rgba(248,113,113,0.3)',
      text: '#f87171',
    },
    partial: {
      bg: 'rgba(251,191,36,0.08)',
      border: 'rgba(251,191,36,0.3)',
      text: '#fbbf24',
    },
    idle: {
      bg: 'var(--bg-primary)',
      border: 'var(--border-color)',
      text: 'var(--text-secondary)',
    },
  };

  const rc = resultColors[result.status];

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 20,
        maxWidth: 520,
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} color="var(--accent)" />
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--text-primary)',
              fontFamily: 'Sora, sans-serif',
            }}
          >
            Dimensional Analysis
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Numerator zone */}
      <UnitZone
        label="Numerator"
        units={numerator}
        onRemove={removeFromNumerator}
        onAdd={addToNumerator}
      />

      {/* Divider */}
      <div
        style={{
          height: 2,
          background: 'var(--border-color)',
          borderRadius: 1,
          margin: '12px 0',
        }}
      />

      {/* Denominator zone */}
      <UnitZone
        label="Denominator"
        units={denominator}
        onRemove={removeFromDenominator}
        onAdd={addToDenominator}
      />

      {/* Expression display */}
      <div
        style={{
          marginTop: 16,
          padding: '10px 14px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          fontFamily: 'DM Mono, monospace',
          fontSize: 15,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          minHeight: 42,
        }}
      >
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>=</span>
        <span>{displayExpression}</span>
        {matchedComposite && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#34d399',
              background: 'rgba(52,211,153,0.1)',
              border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: 4,
              padding: '2px 7px',
            }}
          >
            {matchedComposite} ✓
          </span>
        )}
      </div>

      {/* Expected unit input */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          Expected:
        </div>
        <input
          type="text"
          value={expected}
          onChange={e => setExpected(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCheck()}
          placeholder="e.g. m/s² or N"
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 7,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'DM Mono, monospace',
            outline: 'none',
          }}
        />
      </div>

      {/* Result display */}
      {(result.status !== 'idle' || result.message) && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: rc.bg,
            border: `1px solid ${rc.border}`,
            borderRadius: 8,
            fontSize: 13,
            color: rc.text,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          {result.status === 'match' && <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
          {result.status === 'mismatch' && <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
          <span>{result.message}</span>
        </div>
      )}

      {/* Educational note */}
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
        }}
      >
        Educational tool — does not affect grading.
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          onClick={handleCheck}
          style={{
            flex: 1,
            padding: '9px 0',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Check size={14} />
          Check Units
        </button>
        <button
          onClick={handleClearAll}
          style={{
            padding: '9px 14px',
            background: 'none',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Trash2 size={14} />
          Clear All
        </button>
      </div>
    </div>
  );
}
