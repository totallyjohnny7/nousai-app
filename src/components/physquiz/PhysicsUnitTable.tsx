/**
 * PhysicsUnitTable — Scrollable physics unit reference table
 * Features: search, category sections, click-to-copy conversion factor
 */
import { useState, useMemo } from 'react'
import { X, Search, Copy, CheckCircle } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface UnitEntry {
  quantity: string
  name: string
  symbol: string
  inSI: string      // how to express this unit in SI base units
  fromSI: string    // conversion from SI
  category: string
}

// ─── Unit data ─────────────────────────────────────────────────────────────

const UNITS: UnitEntry[] = [
  // Length
  { category: 'Length',       quantity: 'Length', name: 'Meter',          symbol: 'm',   inSI: 'm',               fromSI: '× 1' },
  { category: 'Length',       quantity: 'Length', name: 'Kilometer',      symbol: 'km',  inSI: '10³ m',           fromSI: '× 0.001' },
  { category: 'Length',       quantity: 'Length', name: 'Centimeter',     symbol: 'cm',  inSI: '10⁻² m',          fromSI: '× 100' },
  { category: 'Length',       quantity: 'Length', name: 'Millimeter',     symbol: 'mm',  inSI: '10⁻³ m',          fromSI: '× 1000' },
  { category: 'Length',       quantity: 'Length', name: 'Micrometer',     symbol: 'μm',  inSI: '10⁻⁶ m',          fromSI: '× 10⁶' },
  { category: 'Length',       quantity: 'Length', name: 'Nanometer',      symbol: 'nm',  inSI: '10⁻⁹ m',          fromSI: '× 10⁹' },
  { category: 'Length',       quantity: 'Length', name: 'Angstrom',       symbol: 'Å',   inSI: '10⁻¹⁰ m',         fromSI: '× 10¹⁰' },
  { category: 'Length',       quantity: 'Length', name: 'Inch',           symbol: 'in',  inSI: '0.0254 m',        fromSI: '× 39.37' },
  { category: 'Length',       quantity: 'Length', name: 'Foot',           symbol: 'ft',  inSI: '0.3048 m',        fromSI: '× 3.281' },
  { category: 'Length',       quantity: 'Length', name: 'Mile',           symbol: 'mi',  inSI: '1609.34 m',       fromSI: '× 6.214×10⁻⁴' },

  // Mass
  { category: 'Mass',         quantity: 'Mass', name: 'Kilogram',         symbol: 'kg',  inSI: 'kg',              fromSI: '× 1' },
  { category: 'Mass',         quantity: 'Mass', name: 'Gram',             symbol: 'g',   inSI: '10⁻³ kg',         fromSI: '× 1000' },
  { category: 'Mass',         quantity: 'Mass', name: 'Milligram',        symbol: 'mg',  inSI: '10⁻⁶ kg',         fromSI: '× 10⁶' },
  { category: 'Mass',         quantity: 'Mass', name: 'Metric ton',       symbol: 't',   inSI: '10³ kg',          fromSI: '× 10⁻³' },
  { category: 'Mass',         quantity: 'Mass', name: 'Atomic mass unit', symbol: 'u',   inSI: '1.6605×10⁻²⁷ kg', fromSI: '× 6.022×10²⁶' },
  { category: 'Mass',         quantity: 'Mass', name: 'Pound',            symbol: 'lb',  inSI: '0.4536 kg',       fromSI: '× 2.205' },
  { category: 'Mass',         quantity: 'Mass', name: 'Ounce',            symbol: 'oz',  inSI: '0.02835 kg',      fromSI: '× 35.27' },

  // Time
  { category: 'Time',         quantity: 'Time', name: 'Second',           symbol: 's',   inSI: 's',               fromSI: '× 1' },
  { category: 'Time',         quantity: 'Time', name: 'Millisecond',      symbol: 'ms',  inSI: '10⁻³ s',          fromSI: '× 1000' },
  { category: 'Time',         quantity: 'Time', name: 'Microsecond',      symbol: 'μs',  inSI: '10⁻⁶ s',          fromSI: '× 10⁶' },
  { category: 'Time',         quantity: 'Time', name: 'Nanosecond',       symbol: 'ns',  inSI: '10⁻⁹ s',          fromSI: '× 10⁹' },
  { category: 'Time',         quantity: 'Time', name: 'Minute',           symbol: 'min', inSI: '60 s',            fromSI: '÷ 60' },
  { category: 'Time',         quantity: 'Time', name: 'Hour',             symbol: 'hr',  inSI: '3600 s',          fromSI: '÷ 3600' },

  // Force
  { category: 'Force',        quantity: 'Force', name: 'Newton',          symbol: 'N',   inSI: 'kg·m/s²',         fromSI: '× 1' },
  { category: 'Force',        quantity: 'Force', name: 'Kilonewton',      symbol: 'kN',  inSI: '10³ kg·m/s²',     fromSI: '× 10⁻³' },
  { category: 'Force',        quantity: 'Force', name: 'Pound-force',     symbol: 'lbf', inSI: '4.448 N',         fromSI: '× 0.2248' },
  { category: 'Force',        quantity: 'Force', name: 'Dyne',            symbol: 'dyn', inSI: '10⁻⁵ N',          fromSI: '× 10⁵' },

  // Energy
  { category: 'Energy',       quantity: 'Energy', name: 'Joule',          symbol: 'J',   inSI: 'kg·m²/s²',        fromSI: '× 1' },
  { category: 'Energy',       quantity: 'Energy', name: 'Kilojoule',      symbol: 'kJ',  inSI: '10³ J',           fromSI: '× 10⁻³' },
  { category: 'Energy',       quantity: 'Energy', name: 'Megajoule',      symbol: 'MJ',  inSI: '10⁶ J',           fromSI: '× 10⁻⁶' },
  { category: 'Energy',       quantity: 'Energy', name: 'Electronvolt',   symbol: 'eV',  inSI: '1.602×10⁻¹⁹ J',  fromSI: '× 6.242×10¹⁸' },
  { category: 'Energy',       quantity: 'Energy', name: 'Kiloelectronvolt', symbol: 'keV', inSI: '1.602×10⁻¹⁶ J', fromSI: '× 6.242×10¹⁵' },
  { category: 'Energy',       quantity: 'Energy', name: 'Megaelectronvolt', symbol: 'MeV', inSI: '1.602×10⁻¹³ J', fromSI: '× 6.242×10¹²' },
  { category: 'Energy',       quantity: 'Energy', name: 'Calorie',        symbol: 'cal', inSI: '4.184 J',         fromSI: '× 0.2390' },
  { category: 'Energy',       quantity: 'Energy', name: 'Kilocalorie',    symbol: 'kcal', inSI: '4184 J',         fromSI: '× 2.390×10⁻⁴' },
  { category: 'Energy',       quantity: 'Energy', name: 'Kilowatt-hour',  symbol: 'kWh', inSI: '3.6×10⁶ J',      fromSI: '× 2.778×10⁻⁷' },
  { category: 'Energy',       quantity: 'Energy', name: 'Erg',            symbol: 'erg', inSI: '10⁻⁷ J',          fromSI: '× 10⁷' },

  // Power
  { category: 'Power',        quantity: 'Power', name: 'Watt',            symbol: 'W',   inSI: 'kg·m²/s³',        fromSI: '× 1' },
  { category: 'Power',        quantity: 'Power', name: 'Kilowatt',        symbol: 'kW',  inSI: '10³ W',           fromSI: '× 10⁻³' },
  { category: 'Power',        quantity: 'Power', name: 'Megawatt',        symbol: 'MW',  inSI: '10⁶ W',           fromSI: '× 10⁻⁶' },
  { category: 'Power',        quantity: 'Power', name: 'Horsepower',      symbol: 'hp',  inSI: '745.7 W',         fromSI: '× 1.341×10⁻³' },

  // Pressure
  { category: 'Pressure',     quantity: 'Pressure', name: 'Pascal',       symbol: 'Pa',  inSI: 'kg/(m·s²)',       fromSI: '× 1' },
  { category: 'Pressure',     quantity: 'Pressure', name: 'Kilopascal',   symbol: 'kPa', inSI: '10³ Pa',          fromSI: '× 10⁻³' },
  { category: 'Pressure',     quantity: 'Pressure', name: 'Atmosphere',   symbol: 'atm', inSI: '101325 Pa',       fromSI: '× 9.869×10⁻⁶' },
  { category: 'Pressure',     quantity: 'Pressure', name: 'Bar',          symbol: 'bar', inSI: '10⁵ Pa',          fromSI: '× 10⁻⁵' },
  { category: 'Pressure',     quantity: 'Pressure', name: 'Millimeter mercury', symbol: 'mmHg', inSI: '133.32 Pa', fromSI: '× 7.501×10⁻³' },
  { category: 'Pressure',     quantity: 'Pressure', name: 'Torr',         symbol: 'Torr', inSI: '133.32 Pa',      fromSI: '× 7.501×10⁻³' },
  { category: 'Pressure',     quantity: 'Pressure', name: 'PSI',          symbol: 'psi', inSI: '6894.76 Pa',      fromSI: '× 1.450×10⁻⁴' },

  // Electric Charge
  { category: 'Electric Charge', quantity: 'Charge', name: 'Coulomb',      symbol: 'C',   inSI: 'A·s',            fromSI: '× 1' },
  { category: 'Electric Charge', quantity: 'Charge', name: 'Millicoulomb', symbol: 'mC',  inSI: '10⁻³ A·s',       fromSI: '× 1000' },
  { category: 'Electric Charge', quantity: 'Charge', name: 'Microcoulomb', symbol: 'μC',  inSI: '10⁻⁶ A·s',       fromSI: '× 10⁶' },
  { category: 'Electric Charge', quantity: 'Charge', name: 'Nanocoulomb',  symbol: 'nC',  inSI: '10⁻⁹ A·s',       fromSI: '× 10⁹' },
  { category: 'Electric Charge', quantity: 'Charge', name: 'Elementary charge', symbol: 'e', inSI: '1.602×10⁻¹⁹ C', fromSI: '× 6.242×10¹⁸' },

  // Voltage
  { category: 'Voltage',      quantity: 'Voltage', name: 'Volt',          symbol: 'V',   inSI: 'kg·m²/(A·s³)',    fromSI: '× 1' },
  { category: 'Voltage',      quantity: 'Voltage', name: 'Millivolt',     symbol: 'mV',  inSI: '10⁻³ V',          fromSI: '× 1000' },
  { category: 'Voltage',      quantity: 'Voltage', name: 'Kilovolt',      symbol: 'kV',  inSI: '10³ V',           fromSI: '× 10⁻³' },

  // Current
  { category: 'Current',      quantity: 'Current', name: 'Ampere',        symbol: 'A',   inSI: 'A',               fromSI: '× 1' },
  { category: 'Current',      quantity: 'Current', name: 'Milliampere',   symbol: 'mA',  inSI: '10⁻³ A',          fromSI: '× 1000' },
  { category: 'Current',      quantity: 'Current', name: 'Microampere',   symbol: 'μA',  inSI: '10⁻⁶ A',          fromSI: '× 10⁶' },

  // Resistance
  { category: 'Resistance',   quantity: 'Resistance', name: 'Ohm',        symbol: 'Ω',   inSI: 'kg·m²/(A²·s³)',   fromSI: '× 1' },
  { category: 'Resistance',   quantity: 'Resistance', name: 'Kilohm',     symbol: 'kΩ',  inSI: '10³ Ω',           fromSI: '× 10⁻³' },
  { category: 'Resistance',   quantity: 'Resistance', name: 'Megaohm',    symbol: 'MΩ',  inSI: '10⁶ Ω',           fromSI: '× 10⁻⁶' },

  // Capacitance
  { category: 'Capacitance',  quantity: 'Capacitance', name: 'Farad',     symbol: 'F',   inSI: 'A²·s⁴/(kg·m²)',  fromSI: '× 1' },
  { category: 'Capacitance',  quantity: 'Capacitance', name: 'Millifarad', symbol: 'mF', inSI: '10⁻³ F',          fromSI: '× 1000' },
  { category: 'Capacitance',  quantity: 'Capacitance', name: 'Microfarad', symbol: 'μF', inSI: '10⁻⁶ F',          fromSI: '× 10⁶' },
  { category: 'Capacitance',  quantity: 'Capacitance', name: 'Nanofarad',  symbol: 'nF', inSI: '10⁻⁹ F',          fromSI: '× 10⁹' },
  { category: 'Capacitance',  quantity: 'Capacitance', name: 'Picofarad',  symbol: 'pF', inSI: '10⁻¹² F',         fromSI: '× 10¹²' },

  // Magnetic Field
  { category: 'Magnetic Field', quantity: 'Magnetic Field', name: 'Tesla',      symbol: 'T',  inSI: 'kg/(A·s²)',    fromSI: '× 1' },
  { category: 'Magnetic Field', quantity: 'Magnetic Field', name: 'Millitesla', symbol: 'mT', inSI: '10⁻³ T',      fromSI: '× 1000' },
  { category: 'Magnetic Field', quantity: 'Magnetic Field', name: 'Microtesla', symbol: 'μT', inSI: '10⁻⁶ T',      fromSI: '× 10⁶' },
  { category: 'Magnetic Field', quantity: 'Magnetic Field', name: 'Gauss',      symbol: 'G',  inSI: '10⁻⁴ T',      fromSI: '× 10⁴' },

  // Temperature
  { category: 'Temperature',  quantity: 'Temperature', name: 'Kelvin',    symbol: 'K',   inSI: 'K',               fromSI: '= T' },
  { category: 'Temperature',  quantity: 'Temperature', name: 'Celsius',   symbol: '°C',  inSI: 'T − 273.15',      fromSI: 'T − 273.15' },
  { category: 'Temperature',  quantity: 'Temperature', name: 'Fahrenheit', symbol: '°F', inSI: '5/9·(T−32)+273.15', fromSI: '9/5·(T−273.15)+32' },

  // Angle
  { category: 'Angle',        quantity: 'Angle', name: 'Radian',          symbol: 'rad', inSI: 'rad',             fromSI: '× 1' },
  { category: 'Angle',        quantity: 'Angle', name: 'Degree',          symbol: 'deg', inSI: 'π/180 rad',       fromSI: '× 180/π' },
  { category: 'Angle',        quantity: 'Angle', name: 'Revolution',      symbol: 'rev', inSI: '2π rad',          fromSI: '÷ 2π' },

  // Frequency
  { category: 'Frequency',    quantity: 'Frequency', name: 'Hertz',       symbol: 'Hz',  inSI: 's⁻¹',             fromSI: '× 1' },
  { category: 'Frequency',    quantity: 'Frequency', name: 'Kilohertz',   symbol: 'kHz', inSI: '10³ s⁻¹',         fromSI: '× 10⁻³' },
  { category: 'Frequency',    quantity: 'Frequency', name: 'Megahertz',   symbol: 'MHz', inSI: '10⁶ s⁻¹',         fromSI: '× 10⁻⁶' },
  { category: 'Frequency',    quantity: 'Frequency', name: 'Gigahertz',   symbol: 'GHz', inSI: '10⁹ s⁻¹',         fromSI: '× 10⁻⁹' },

  // Speed
  { category: 'Speed',        quantity: 'Speed', name: 'Meters per second', symbol: 'm/s',  inSI: 'm/s',          fromSI: '× 1' },
  { category: 'Speed',        quantity: 'Speed', name: 'Kilometers per hour', symbol: 'km/h', inSI: '1/3.6 m/s', fromSI: '× 3.6' },
  { category: 'Speed',        quantity: 'Speed', name: 'Miles per hour',   symbol: 'mph', inSI: '0.4470 m/s',    fromSI: '× 2.237' },
  { category: 'Speed',        quantity: 'Speed', name: 'Knot',             symbol: 'kn',  inSI: '0.5144 m/s',    fromSI: '× 1.944' },
]

// Ordered list of categories for section rendering
const CATEGORY_ORDER = [
  'Length', 'Mass', 'Time', 'Force', 'Energy', 'Power', 'Pressure',
  'Electric Charge', 'Voltage', 'Current', 'Resistance', 'Capacitance',
  'Magnetic Field', 'Temperature', 'Angle', 'Frequency', 'Speed',
]

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  onClose?: () => void
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function PhysicsUnitTable({ onClose }: Props) {
  const [search, setSearch] = useState('')
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return UNITS
    const q = search.trim().toLowerCase()
    return UNITS.filter(u =>
      u.quantity.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.symbol.toLowerCase().includes(q) ||
      u.inSI.toLowerCase().includes(q) ||
      u.fromSI.toLowerCase().includes(q) ||
      u.category.toLowerCase().includes(q)
    )
  }, [search])

  // Group filtered units by category (preserving CATEGORY_ORDER)
  const grouped = useMemo(() => {
    const map = new Map<string, UnitEntry[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const unit of filtered) {
      const list = map.get(unit.category)
      if (list) list.push(unit)
    }
    return CATEGORY_ORDER
      .map(cat => ({ cat, units: map.get(cat) ?? [] }))
      .filter(g => g.units.length > 0)
  }, [filtered])

  function copyToClipboard(unit: UnitEntry) {
    const text = `${unit.fromSI}`
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedSymbol(unit.symbol)
    setTimeout(() => setCopiedSymbol(null), 1000)
  }

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Unit Reference</span>
        {onClose && (
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search bar */}
      <div style={styles.searchBar}>
        <Search size={14} style={styles.searchIcon} />
        <input
          style={styles.searchInput}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search units, quantities, symbols…"
          spellCheck={false}
          autoComplete="off"
        />
        {search && (
          <button style={styles.clearBtn} onClick={() => setSearch('')} aria-label="Clear search">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Column header */}
      <div style={styles.colHeader}>
        <span style={{ ...styles.col, ...styles.colQuantity }}>Quantity</span>
        <span style={{ ...styles.col, ...styles.colName }}>Unit Name</span>
        <span style={{ ...styles.col, ...styles.colSymbol }}>Symbol</span>
        <span style={{ ...styles.col, ...styles.colInSI }}>In SI</span>
        <span style={{ ...styles.col, ...styles.colFromSI }}>From SI</span>
        <span style={styles.colCopy} />
      </div>

      {/* Table body */}
      <div style={styles.tableBody}>
        {grouped.length === 0 && (
          <div style={styles.noResults}>No units match "{search}"</div>
        )}
        {grouped.map(({ cat, units }) => (
          <div key={cat}>
            {/* Category divider */}
            <div style={styles.categoryDivider}>
              <span style={styles.categoryLabel}>{cat}</span>
              <div style={styles.categoryLine} />
            </div>
            {/* Rows */}
            {units.map((unit, i) => {
              const isCopied = copiedSymbol === unit.symbol
              return (
                <div
                  key={i}
                  style={styles.row}
                  onClick={() => copyToClipboard(unit)}
                  title={`Click to copy: ${unit.fromSI}`}
                >
                  <span style={{ ...styles.col, ...styles.colQuantity, color: 'var(--text-secondary)' }}>
                    {unit.quantity}
                  </span>
                  <span style={{ ...styles.col, ...styles.colName }}>
                    {unit.name}
                  </span>
                  <span style={{ ...styles.col, ...styles.colSymbol, color: 'var(--yellow)', fontFamily: 'var(--font-mono)' }}>
                    {unit.symbol}
                  </span>
                  <span style={{ ...styles.col, ...styles.colInSI, fontFamily: 'var(--font-mono)' }}>
                    {unit.inSI}
                  </span>
                  <span style={{ ...styles.col, ...styles.colFromSI, fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>
                    {unit.fromSI}
                  </span>
                  <span style={styles.colCopy}>
                    {isCopied
                      ? <CheckCircle size={13} color="var(--green)" />
                      : <Copy size={13} color="var(--text-muted)" />
                    }
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Toast */}
      {copiedSymbol && (
        <div style={styles.toast}>
          Copied!
        </div>
      )}
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 480,
    width: '100%',
    boxShadow: 'var(--shadow)',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px 10px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '0.01em',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  searchIcon: {
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'inherit',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  colHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px 5px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-input)',
    flexShrink: 0,
  },
  col: {
    fontSize: 11,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  colQuantity: { flex: '0 0 80px', paddingRight: 6 },
  colName:     { flex: '0 0 130px', paddingRight: 6 },
  colSymbol:   { flex: '0 0 50px', paddingRight: 6, fontWeight: 600 },
  colInSI:     { flex: '1 1 0', paddingRight: 6, minWidth: 0 },
  colFromSI:   { flex: '1 1 0', paddingRight: 6, minWidth: 0 },
  colCopy:     { flex: '0 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tableBody: {
    overflowY: 'auto',
    flexGrow: 1,
  },
  categoryDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px 4px',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-card)',
    zIndex: 1,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--yellow)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    flexShrink: 0,
  },
  categoryLine: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px 5px 14px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  noResults: {
    padding: '24px 16px',
    color: 'var(--text-muted)',
    fontSize: 13,
    textAlign: 'center',
  },
  toast: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    background: 'var(--green-dim)',
    border: '1px solid var(--green)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--green)',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    pointerEvents: 'none',
    zIndex: 10,
  },
}
