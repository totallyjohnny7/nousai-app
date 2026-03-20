/**
 * PhysMindMap — Interactive SVG mind map for Physics Practicum.
 * 10 topic bubbles arranged radially. Pan/zoom. Detail panel with 7-heading accordion.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, X, Maximize2, Minimize2, Pencil, Plus, Trash2, Check } from 'lucide-react'
import type { PhysicsTopic } from './types'
import { useMindMapEdits } from '../../hooks/useMindMapEdits'

interface Props {
  onBack: () => void
  onQuizBubble: (topic: PhysicsTopic) => void
}

// ─── Layout constants ───────────────────────────────────────────────────────
const SVG_W = 1000
const SVG_H = 800
const CX = SVG_W / 2
const CY = SVG_H / 2
const ORBIT_R = 290
const BUBBLE_R = 48
const CENTER_R = 60

function getBubblePos(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  return { x: CX + ORBIT_R * Math.cos(angle), y: CY + ORBIT_R * Math.sin(angle) }
}

// ─── Data ──────────────────────────────────────────────────────────────────

type Heading = 'what-and-why' | 'key-players' | 'how-it-works' | 'know-the-differences' | 'consequences' | 'apply-it' | 'exam-traps'

interface Bullet { text: string; isTrap?: boolean }
interface HeadingContent { heading: Heading; bullets: Bullet[] }
interface Bubble { id: string; topic: PhysicsTopic; title: string; color: string; headings: HeadingContent[] }

const HEADING_LABELS: Record<Heading, string> = {
  'what-and-why':        'What & Why',
  'key-players':         'Key Equations',
  'how-it-works':        'How It Works',
  'know-the-differences':'Know the Differences',
  'consequences':        'Common Errors',
  'apply-it':            'Apply It',
  'exam-traps':          'Exam Traps',
}

const BUBBLES: Bubble[] = [
  {
    id: 'mechanics', topic: 'mechanics', title: 'Mechanics', color: '#3b82f6',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Studies forces and motion — the foundation of classical physics' },
        { text: 'Newton\'s laws describe how objects respond to net force' },
        { text: 'Everything with mass and velocity falls under mechanics' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'F = ma — Newton\'s 2nd law (net force = mass × acceleration)' },
        { text: 'W = Fd cosθ — Work done by a force over a displacement' },
        { text: 'KE = ½mv² — Kinetic energy' },
        { text: 'PE = mgh — Gravitational potential energy (near surface)' },
        { text: 'p = mv — Momentum' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'Draw a free-body diagram — label all forces on the object only' },
        { text: 'Find net force in each direction, set ΣF = ma' },
        { text: 'Use energy conservation when no non-conservative forces act' },
        { text: 'Use impulse-momentum theorem for collisions: J = Δp = FΔt' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Mass vs weight: mass (kg) is constant; weight = mg changes with gravity' },
        { text: 'Elastic vs inelastic collision: elastic conserves KE; inelastic does not' },
        { text: 'Static vs kinetic friction: fs ≤ μsN; fk = μkN (kinetic is constant)' },
        { text: 'Normal force ≠ weight unless on flat surface with no vertical acceleration' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Forgetting to resolve forces into components on inclined planes', isTrap: true },
        { text: 'Using wrong sign convention — pick one direction positive and stick to it' },
        { text: 'Applying energy conservation when friction is present (loses energy)' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: 'A 10 kg block on a frictionless 30° incline — find acceleration' },
        { text: 'Two masses connected over a pulley — find tension using system approach' },
        { text: 'Ball dropped from 20m — find speed at impact using energy conservation' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'Normal force on incline = mg cosθ, NOT mg', isTrap: true },
        { text: 'Friction force direction always opposes motion (or tendency of motion)', isTrap: true },
        { text: 'In a system, internal forces cancel — only external forces change momentum', isTrap: true },
      ]},
    ],
  },
  {
    id: 'kinematics', topic: 'kinematics', title: 'Kinematics', color: '#06b6d4',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Describes motion without asking why (no forces) — position, velocity, acceleration' },
        { text: 'Kinematic equations only apply with constant acceleration' },
        { text: 'Projectile motion is kinematics in 2D with ay = -g, ax = 0' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'v = v₀ + at' },
        { text: 'x = x₀ + v₀t + ½at²' },
        { text: 'v² = v₀² + 2aΔx' },
        { text: 'x = ½(v + v₀)t' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'List knowns and unknowns, identify which equation has the unknowns you need' },
        { text: 'Projectile: treat x and y independently; only time links them' },
        { text: 'At max height in projectile motion, vy = 0' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Speed (scalar) vs velocity (vector): velocity has direction' },
        { text: 'Displacement (Δx) vs distance: displacement can be negative' },
        { text: 'Uniform motion (a=0, constant v) vs accelerated motion' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Using kinematic equations when acceleration is NOT constant', isTrap: true },
        { text: 'Confusing total distance with net displacement' },
        { text: 'Forgetting to split projectile into x and y components' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: 'Ball thrown horizontally at 15 m/s from a 45m cliff — find range' },
        { text: 'Car decelerates at 3 m/s² from 30 m/s — find stopping distance' },
        { text: 'Object at 30° angle with v₀=20 m/s — find max height and range' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'Launched at angle θ: vx = v₀cosθ, vy = v₀sinθ — not swapped!', isTrap: true },
        { text: 'Symmetry of projectile: rise time = fall time (on level ground)', isTrap: true },
        { text: 'Average velocity = Δx/Δt, NOT (v + v₀)/2 unless acceleration is constant', isTrap: true },
      ]},
    ],
  },
  {
    id: 'thermodynamics', topic: 'thermodynamics', title: 'Thermo', color: '#ef4444',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Studies heat, temperature, and energy transfer between systems' },
        { text: '4 laws govern energy transfer and thermodynamic limits' },
        { text: 'Ideal gas law ties macroscopic properties together: PV = nRT' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'PV = nRT — Ideal gas law (n in mol, R = 8.314 J/mol·K)' },
        { text: 'ΔU = Q - W — 1st Law (internal energy = heat in minus work done by system)' },
        { text: 'e = 1 - Tc/Th — Carnot efficiency (max possible for heat engine)' },
        { text: 'Q = mcΔT — Heat absorbed by substance with specific heat c' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'Identify the process type: isothermal (ΔT=0), adiabatic (Q=0), isobaric (ΔP=0), isochoric (ΔV=0)' },
        { text: 'For isothermal: ΔU = 0 → Q = W' },
        { text: 'For adiabatic: Q = 0 → ΔU = -W' },
        { text: 'Carnot cycle: 2 isothermal + 2 adiabatic = most efficient possible' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Heat (Q) vs Temperature (T): Q is energy transferred; T is a state variable' },
        { text: 'Conduction vs convection vs radiation: solid contact / fluid flow / EM waves' },
        { text: '0th law: thermal equilibrium (same T → no heat transfer)' },
        { text: '2nd law: entropy of universe always increases; heat flows hot→cold spontaneously' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Sign convention for W varies by textbook — confirm Q-W vs Q+W form', isTrap: true },
        { text: 'Forgetting to convert Celsius to Kelvin in PV=nRT (T must be in K)' },
        { text: 'Assuming real engines can achieve Carnot efficiency (they cannot)' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: '2 mol ideal gas at 300K, volume doubles isothermally — find work done' },
        { text: 'Heat engine between 500K and 300K — find max efficiency' },
        { text: '0.5 kg water heated from 20°C to 80°C — find Q (c = 4186 J/kg·K)' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'W done BY the gas is positive when gas expands (volume increases)', isTrap: true },
        { text: 'Carnot efficiency is the MAXIMUM — real engines are always less efficient', isTrap: true },
        { text: 'Specific heat of water = 4186 J/(kg·K), NOT 1 (that\'s calories)', isTrap: true },
      ]},
    ],
  },
  {
    id: 'waves', topic: 'waves', title: 'Waves', color: '#8b5cf6',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Waves transfer energy without transferring matter' },
        { text: 'Two types: mechanical (need medium) and electromagnetic (can travel in vacuum)' },
        { text: 'Describes sound, light, water ripples, seismic activity' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'v = fλ — wave speed = frequency × wavelength' },
        { text: 'T = 1/f — period is inverse of frequency' },
        { text: 'fn = nv/2L — harmonics on a fixed string (n = 1,2,3…)' },
        { text: 'Doppler: f\' = f(v ± vobserver)/(v ∓ vsource)' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'Transverse: displacement ⊥ propagation (light, string waves)' },
        { text: 'Longitudinal: displacement ∥ propagation (sound — compressions and rarefactions)' },
        { text: 'Superposition: waves add — constructive (same phase) or destructive (opposite phase)' },
        { text: 'Standing waves: nodes (no movement) and antinodes (max displacement)' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Amplitude vs frequency: amplitude = loudness/brightness; frequency = pitch/color' },
        { text: 'Reflection vs refraction vs diffraction: bounce / bend through medium / spread around edges' },
        { text: 'Open pipe harmonics: fn = nv/2L (all harmonics); closed pipe: fn = nv/4L (odd only)' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Confusing node and antinode locations in standing waves', isTrap: true },
        { text: 'Forgetting that Doppler sign depends on whether source/observer approach or recede' },
        { text: 'Applying sound formulas to EM waves (EM needs no medium)' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: 'Guitar string 60 cm, wave speed 300 m/s — find fundamental frequency' },
        { text: 'Ambulance at 343 m/s, siren 440 Hz, approaching at 30 m/s — find heard frequency' },
        { text: 'Two speakers 2m apart, 1 m from listener, 340 m/s — find destructive interference' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'Fundamental frequency (n=1) has λ = 2L for string fixed at both ends', isTrap: true },
        { text: 'Speed of sound in air ≈ 343 m/s at 20°C — NOT the speed of light', isTrap: true },
        { text: 'Doppler effect changes frequency, NOT speed of the wave', isTrap: true },
      ]},
    ],
  },
  {
    id: 'optics', topic: 'optics', title: 'Optics', color: '#22c55e',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Study of light behavior: reflection, refraction, lenses, and optical instruments' },
        { text: 'Light travels in straight lines (rays) in uniform medium' },
        { text: 'Geometric optics uses ray diagrams; wave optics explains interference' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'Snell\'s law: n₁sinθ₁ = n₂sinθ₂' },
        { text: 'Thin lens: 1/f = 1/do + 1/di (do=object, di=image distance)' },
        { text: 'Magnification: m = -di/do = hi/ho' },
        { text: 'Critical angle: sinθc = n₂/n₁ (for total internal reflection)' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'Law of reflection: angle of incidence = angle of reflection (from normal)' },
        { text: 'Refraction bends light toward normal when entering denser medium (higher n)' },
        { text: 'Converging lens (convex): positive focal length; diverging (concave): negative f' },
        { text: 'Real image: light actually converges there (di > 0); virtual image: di < 0' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Real vs virtual image: real can be projected on screen; virtual cannot' },
        { text: 'Converging vs diverging lens: converging focuses parallel rays; diverging spreads them' },
        { text: 'Index of refraction n = c/v: higher n → slower light, more bending' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Measuring angles from surface instead of normal in reflection/refraction', isTrap: true },
        { text: 'Forgetting sign convention: di negative = virtual image (same side as object)' },
        { text: 'Confusing focal length of lens vs mirror (both use same thin-lens equation)' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: 'Object 30 cm in front of converging lens f=10 cm — find image location and type' },
        { text: 'Light hits glass (n=1.5) at 45° — find refraction angle' },
        { text: 'Fiber optic: n_core=1.5, n_clad=1.4 — find critical angle' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'Magnification negative means image is inverted, not smaller', isTrap: true },
        { text: 'When object is inside focal length of converging lens → virtual, upright, magnified image', isTrap: true },
        { text: 'TIR only occurs going from high-n to low-n medium', isTrap: true },
      ]},
    ],
  },
  {
    id: 'electromagnetism', topic: 'electromagnetism', title: 'E&M', color: '#f59e0b',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Studies electric fields, magnetic fields, and their interaction with charges' },
        { text: 'Maxwell\'s equations unify electricity and magnetism into one framework' },
        { text: 'Foundation for motors, generators, transformers, and radio waves' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'Coulomb: F = kq₁q₂/r² (k = 9×10⁹ N·m²/C²)' },
        { text: 'Electric field: E = F/q = kQ/r²' },
        { text: 'Magnetic force: F = qv×B (F = qvB sinθ)' },
        { text: 'Faraday: ε = -dΦ/dt — changing flux induces EMF' },
        { text: 'Φ = BA cosθ — magnetic flux' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'Electric field lines: from + to - charge; denser = stronger field' },
        { text: 'Gauss\'s law: total flux through closed surface = Q_enc/ε₀' },
        { text: 'Right-hand rule for magnetic force: fingers = v, curl to B, thumb = F (for +)' },
        { text: 'Lenz\'s law: induced current opposes the change in flux that created it' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Electric force acts on charges at rest OR moving; magnetic only on moving charges' },
        { text: 'Voltage (potential) vs electric field: E = -dV/dx; field points toward lower V' },
        { text: 'Solenoid vs toroid: solenoid = uniform B inside; toroid = B confined to ring' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Forgetting that magnetic force is always perpendicular to velocity (no work done)', isTrap: true },
        { text: 'Lenz\'s law sign error — induced field OPPOSES flux change, not the original field' },
        { text: 'Confusing electric field direction (toward - charge) with force on - charge (away from field)' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: 'Charge q=2μC, mass m, in B=0.5T at v=3m/s perpendicular — find radius of circular path' },
        { text: 'Square loop 0.1m², flux changes from 0.5T to 0 in 0.2s — find induced EMF' },
        { text: 'Two point charges +3μC and -3μC separated by 1m — find force between them' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'Magnetic force does NO work on a charge (F ⊥ v always)', isTrap: true },
        { text: 'Right-hand rule for force on NEGATIVE charge: flip the thumb direction', isTrap: true },
        { text: 'EMF is induced by CHANGING flux — steady field, no motion = no EMF', isTrap: true },
      ]},
    ],
  },
  {
    id: 'circuits', topic: 'circuits', title: 'Circuits', color: '#ec4899',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Circuits describe how current flows through networks of resistors, capacitors, inductors' },
        { text: 'Kirchhoff\'s laws solve any circuit by applying conservation of energy and charge' },
        { text: 'Foundation for all electronic devices' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'Ohm\'s law: V = IR' },
        { text: 'Power: P = IV = I²R = V²/R' },
        { text: 'Series resistors: Rtotal = R₁ + R₂ + …' },
        { text: 'Parallel resistors: 1/Rtotal = 1/R₁ + 1/R₂ + …' },
        { text: 'Capacitor: C = Q/V; Energy = ½CV²' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'KVL: sum of voltages around any closed loop = 0 (energy conservation)' },
        { text: 'KCL: sum of currents into any node = 0 (charge conservation)' },
        { text: 'Series: same current through all elements; Parallel: same voltage across all' },
        { text: 'RC circuit charging: V(t) = Vₛ(1 - e^(-t/RC)); time constant τ = RC' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Resistor vs capacitor vs inductor: dissipates / stores E-field energy / stores B-field energy' },
        { text: 'Short circuit (R=0) vs open circuit (I=0)' },
        { text: 'EMF (source voltage) vs terminal voltage: Vterminal = EMF - Ir (internal resistance r)' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Parallel combination ALWAYS less than smallest individual resistor', isTrap: true },
        { text: 'Using wrong reference direction for current in KVL — be consistent around loop' },
        { text: 'Forgetting internal resistance of battery at high current' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: '3Ω and 6Ω in parallel, then in series with 4Ω — find total resistance' },
        { text: 'Battery EMF=12V, r=1Ω, external R=5Ω — find current and terminal voltage' },
        { text: 'RC circuit: C=100μF, R=10kΩ, charged to 9V — find voltage after 1 time constant' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: '2 equal resistors in parallel = half of one resistor (not double)', isTrap: true },
        { text: 'Capacitors in parallel ADD: Ctotal = C₁ + C₂ (opposite of resistors)', isTrap: true },
        { text: 'At t=τ, capacitor is at 63% of final voltage (not 50%)', isTrap: true },
      ]},
    ],
  },
  {
    id: 'modern', topic: 'modern', title: 'Modern', color: '#6366f1',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Describes physics at atomic/subatomic scale where classical mechanics breaks down' },
        { text: 'Explains photoelectric effect, atomic spectra, wave-particle duality' },
        { text: 'Foundation for lasers, semiconductors, MRI, and nuclear technology' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'E = hf — photon energy (h = 6.626×10⁻³⁴ J·s)' },
        { text: 'λ = h/p — de Broglie wavelength of matter' },
        { text: 'E = mc² — mass-energy equivalence' },
        { text: 'KE_max = hf - φ — photoelectric effect (φ = work function)' },
        { text: 'En = -13.6/n² eV — hydrogen energy levels' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'Photoelectric effect: light as particles (photons) — KE of electron = hf - φ' },
        { text: 'Bohr model: electrons in discrete energy levels; photon emitted when transitioning down' },
        { text: 'Wave-particle duality: all matter has wavelength λ = h/mv' },
        { text: 'Heisenberg uncertainty: ΔxΔp ≥ ℏ/2 — can\'t know position and momentum exactly' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Photon vs electron: photon has no mass, always travels at c; electron has mass' },
        { text: 'Emission spectrum vs absorption spectrum: bright lines vs dark lines (same positions)' },
        { text: 'Special relativity: time dilation (Δt\' = γΔt) and length contraction (L\' = L/γ)' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Photoelectric effect: increasing intensity doesn\'t increase KE of electrons (only count)', isTrap: true },
        { text: 'Threshold frequency: below it, no electrons emitted regardless of intensity' },
        { text: 'Confusing emission (n_high → n_low, photon out) with absorption (n_low → n_high, photon in)' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: 'UV light f=1.5×10¹⁵Hz hits metal φ=5.5 eV — find max KE of ejected electron' },
        { text: 'Electron accelerated through 100V — find de Broglie wavelength' },
        { text: 'Hydrogen atom n=3 → n=1 — find emitted photon energy and wavelength' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'Stopping voltage in photoelectric = max KE in eV (not in J!)', isTrap: true },
        { text: 'De Broglie wavelength: use momentum p = mv (or relativistic p = γmv at high speed)', isTrap: true },
        { text: 'E = mc² gives rest-mass energy — total energy includes kinetic in SR', isTrap: true },
      ]},
    ],
  },
  {
    id: 'nuclear', topic: 'nuclear', title: 'Nuclear', color: '#f97316',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Studies atomic nucleus: protons, neutrons, binding energy, and radioactive decay' },
        { text: 'Nuclear reactions release millions of times more energy than chemical reactions' },
        { text: 'Applications: nuclear power, medicine (PET/MRI), carbon dating, weapons' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'N = N₀e^(-λt) — radioactive decay law' },
        { text: 't½ = ln(2)/λ — half-life' },
        { text: 'BE = (Zm_p + Nm_n - m_nucleus)c² — binding energy' },
        { text: 'Q-value: energy released in nuclear reaction (Q > 0 = exothermic)' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'Alpha decay: nucleus emits ⁴He — A decreases by 4, Z decreases by 2' },
        { text: 'Beta- decay: neutron → proton + electron + antineutrino — Z increases by 1' },
        { text: 'Beta+ decay: proton → neutron + positron + neutrino — Z decreases by 1' },
        { text: 'Gamma decay: nucleus releases energy photon — A and Z unchanged' },
        { text: 'Fission: heavy nucleus splits; Fusion: light nuclei combine (both release energy)' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Alpha vs beta vs gamma radiation: helium nucleus / electron / high-energy photon' },
        { text: 'Penetrating power: gamma >> beta > alpha (reversed for ionizing power)' },
        { text: 'Fission vs fusion: fission splits (U-235); fusion combines (H → He in stars)' },
        { text: 'Z = proton number, A = mass number, N = neutron number (N = A - Z)' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Alpha radiation is stopped by paper; confusing shielding materials on exams', isTrap: true },
        { text: 'After one half-life, 50% remains; after two, 25%; not linearly decreasing' },
        { text: 'Mass defect is NOT a mistake — it\'s the energy holding the nucleus together' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: 'C-14 has t½=5730 years — what fraction remains after 11460 years?' },
        { text: 'Ra-226 decays by alpha — write the complete decay equation with products' },
        { text: '1 u = 931.5 MeV/c² — find energy released in nuclear reaction using mass difference' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'Atomic mass number A must balance in any nuclear reaction (conservation)', isTrap: true },
        { text: 'Charge Z must also balance in nuclear reactions', isTrap: true },
        { text: 'Activity (decays/sec) = λN — not just N₀ or just λ alone', isTrap: true },
      ]},
    ],
  },
  {
    id: 'other', topic: 'other', title: 'Other', color: '#6b7280',
    headings: [
      { heading: 'what-and-why', bullets: [
        { text: 'Rotational dynamics, fluid mechanics, simple harmonic motion, and gravitational theory' },
        { text: 'These topics bridge and connect the core areas of physics' },
      ]},
      { heading: 'key-players', bullets: [
        { text: 'SHM: T = 2π√(m/k) for spring; T = 2π√(L/g) for pendulum' },
        { text: 'Rotational: τ = Iα; L = Iω; KE_rot = ½Iω²' },
        { text: 'Gravitation: F = Gm₁m₂/r²; G = 6.67×10⁻¹¹ N·m²/kg²' },
        { text: 'Fluid: P = P₀ + ρgh (pressure); Bernoulli: P + ½ρv² + ρgh = const' },
        { text: 'Buoyancy: F_b = ρ_fluid × V_displaced × g' },
      ]},
      { heading: 'how-it-works', bullets: [
        { text: 'SHM: restoring force ∝ -displacement; x(t) = A cos(ωt + φ)' },
        { text: 'Rotational analog: torque ↔ force, moment of inertia ↔ mass, ω ↔ v' },
        { text: 'Kepler\'s 3rd law: T² ∝ r³ for orbital period and radius' },
        { text: 'Continuity equation: A₁v₁ = A₂v₂ (fluid flow conservation)' },
      ]},
      { heading: 'know-the-differences', bullets: [
        { text: 'Period of pendulum depends on L and g — NOT mass or amplitude (for small angles)' },
        { text: 'Rotational KE is EXTRA — rolling object has both translational and rotational KE' },
        { text: 'Orbital velocity (tangential) vs escape velocity: vesc = √(2GM/r) = √2 × vorbital' },
      ]},
      { heading: 'consequences', bullets: [
        { text: 'Pendulum period does NOT depend on mass — common misconception', isTrap: true },
        { text: 'Pressure in fluid depends on depth, not on the total volume' },
        { text: 'Rolling without slipping: v_cm = ωR (must use this constraint)' },
      ]},
      { heading: 'apply-it', bullets: [
        { text: 'Spring k=200 N/m, mass m=0.5 kg — find period and frequency of oscillation' },
        { text: 'Satellite at r=2R_Earth — find orbital speed and period' },
        { text: 'Sphere rolling down 30° incline without slipping — find acceleration' },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'Moment of inertia depends on shape AND axis of rotation (I=½MR² disk, ⅔MR² sphere)', isTrap: true },
        { text: 'Angular momentum L = Iω is conserved when net torque = 0', isTrap: true },
        { text: 'Bernoulli: faster flow = lower pressure (explains lift on airfoil)', isTrap: true },
      ]},
    ],
  },
]

const EDIT_COLORS = ['#3b82f6','#06b6d4','#ef4444','#8b5cf6','#22c55e','#f59e0b','#ec4899','#6366f1','#f97316','#6b7280']

// ─── Flip card component ─────────────────────────────────────────────────────
function FlipCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div onClick={() => setFlipped(f => !f)} title="Click to flip"
      style={{ cursor: 'pointer', perspective: 600, height: 90, marginBottom: 10 }}>
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d', transition: 'transform 0.5s',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        <div style={{
          position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
          background: '#ef444418', border: '1px solid #ef4444', borderRadius: 8,
          padding: '8px 12px', display: 'flex', alignItems: 'center',
          fontSize: 13, color: '#ef4444', lineHeight: 1.4,
        }}>
          <span style={{ marginRight: 8, fontSize: 16 }}>⚠️</span>{front}
        </div>
        <div style={{
          position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)', background: '#22c55e18', border: '1px solid #22c55e',
          borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center',
          fontSize: 13, color: '#22c55e', lineHeight: 1.4,
        }}>
          <span style={{ marginRight: 8, fontSize: 16 }}>✓</span>{back}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function PhysMindMap({ onBack, onQuizBubble }: Props) {
  const { bubbles, saveBubbles, isEditMode, setIsEditMode } = useMindMapEdits('phys', BUBBLES)
  const [selected, setSelected]   = useState<Bubble | null>(null)
  const [openHeadings, setOpenH]  = useState<Set<Heading>>(new Set(['what-and-why']))
  const [fullscreen, setFullscreen] = useState(false)
  const [pan, setPan]             = useState({ x: 0, y: 0 })
  const [zoom, setZoom]           = useState(1)
  const isPanning                 = useRef(false)
  const panStart                  = useRef({ x: 0, y: 0 })
  const svgRef                    = useRef<SVGSVGElement>(null)

  // Edit mode state
  const [addModal, setAddModal] = useState<{ title: string; color: string } | null>(null)
  const [editingTitle, setEditingTitle] = useState<{ id: string; value: string } | null>(null)
  const [editingBullet, setEditingBullet] = useState<{ heading: Heading; index: number; value: string } | null>(null)

  const total = bubbles.length

  // ─── Edit handlers ────────────────────────────────────────────────────────
  const deleteBubble = (id: string) => {
    if (!confirm('Delete this bubble and all its content?')) return
    saveBubbles(bubbles.filter(b => b.id !== id))
    if (selected?.id === id) setSelected(null)
  }
  const commitTitle = (id: string, title: string) => {
    if (!title.trim()) { setEditingTitle(null); return }
    const next = bubbles.map(b => b.id === id ? { ...b, title: title.trim() } : b)
    saveBubbles(next)
    setSelected(prev => prev?.id === id ? { ...prev, title: title.trim() } : prev)
    setEditingTitle(null)
  }
  const addBulletToHeading = (bubbleId: string, heading: Heading) => {
    saveBubbles(bubbles.map(b => {
      if (b.id !== bubbleId) return b
      const existing = b.headings.find(h => h.heading === heading)
      if (existing) {
        return { ...b, headings: b.headings.map(h => h.heading === heading ? { ...h, bullets: [...h.bullets, { text: 'New bullet' }] } : h) }
      }
      return { ...b, headings: [...b.headings, { heading, bullets: [{ text: 'New bullet' }] }] }
    }))
  }
  const commitBullet = (bubbleId: string, heading: Heading, index: number, value: string) => {
    saveBubbles(bubbles.map(b => b.id !== bubbleId ? b : {
      ...b, headings: b.headings.map(h => h.heading !== heading ? h : {
        ...h, bullets: h.bullets.map((bl, i) => i === index ? { ...bl, text: value } : bl)
      })
    }))
    setEditingBullet(null)
  }
  const deleteBullet = (bubbleId: string, heading: Heading, index: number) => {
    saveBubbles(bubbles.map(b => b.id !== bubbleId ? b : {
      ...b, headings: b.headings.map(h => h.heading !== heading ? h : {
        ...h, bullets: h.bullets.filter((_, i) => i !== index)
      })
    }))
  }
  const addNewBubble = () => {
    if (!addModal?.title.trim()) return
    const id = `user_${Date.now().toString(36)}`
    saveBubbles([...bubbles, { id, topic: id as PhysicsTopic, title: addModal.title.trim(), color: addModal.color, headings: [] }])
    setAddModal(null)
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-bubble]')) return
    isPanning.current = true
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
  }, [])

  const handleMouseUp = useCallback(() => { isPanning.current = false }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.4, Math.min(2.5, z - e.deltaY * 0.001)))
  }, [])

  const selectBubble = useCallback((b: Bubble) => {
    setSelected(b)
    setOpenH(new Set(['what-and-why']))
  }, [])

  const toggleHeading = useCallback((h: Heading) => {
    setOpenH(prev => {
      const next = new Set(prev)
      next.has(h) ? next.delete(h) : next.add(h)
      return next
    })
  }, [])

  // Keyboard close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const containerStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }
    : { display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 500 }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit' }}>
          <ArrowLeft size={16} /> Back to Menu
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚛️ Physics Mind Map
          {isEditMode && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#F5A62333', color: '#F5A623', border: '1px solid #F5A623' }}>Editing</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isEditMode && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scroll to zoom · Drag to pan</span>}
          <button onClick={() => setIsEditMode(m => !m)} title={isEditMode ? 'Exit edit mode' : 'Edit mind map'} style={{ background: isEditMode ? '#F5A62322' : 'none', border: `1px solid ${isEditMode ? '#F5A623' : 'var(--border-color)'}`, borderRadius: 6, cursor: 'pointer', color: isEditMode ? '#F5A623' : 'var(--text-muted)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Pencil size={13} />{isEditMode ? 'Done' : 'Edit'}
          </button>
          <button onClick={() => setFullscreen(f => !f)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Canvas + Detail Panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SVG Canvas */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: isPanning.current ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onWheel={handleWheel}>
          <svg ref={svgRef} width="100%" height="100%"
            viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${SVG_W / zoom} ${SVG_H / zoom}`}
            style={{ display: 'block' }}>

            {/* Connection lines */}
            {bubbles.map((b, i) => {
              const pos = getBubblePos(i, total)
              const isActive = selected?.id === b.id
              return (
                <line key={b.id}
                  x1={CX} y1={CY} x2={pos.x} y2={pos.y}
                  stroke={isActive ? b.color : '#333'}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? 'none' : '4 4'}
                  style={{ transition: 'stroke 0.2s' }}
                />
              )
            })}

            {/* Center node */}
            <circle cx={CX} cy={CY} r={CENTER_R} fill="#1a1a2e" stroke="#3b82f6" strokeWidth={2} />
            <text x={CX} y={CY - 8} textAnchor="middle" fill="#93c5fd" fontSize={13} fontWeight={700}>Physics</text>
            <text x={CX} y={CY + 8} textAnchor="middle" fill="#93c5fd" fontSize={11}>Mind Map</text>
            <text x={CX} y={CY + 22} textAnchor="middle" fill="#60a5fa" fontSize={10}>{total} topics</text>

            {/* Topic bubbles */}
            {bubbles.map((b, i) => {
              const pos = getBubblePos(i, total)
              const isActive = selected?.id === b.id

              return (
                <g key={b.id} data-bubble="true" style={{ cursor: 'pointer' }}
                  onClick={() => selectBubble(b)}>
                  <circle cx={pos.x} cy={pos.y} r={BUBBLE_R}
                    fill={isActive ? b.color : `${b.color}22`}
                    stroke={isEditMode ? '#F5A623' : b.color}
                    strokeWidth={isActive ? 3 : isEditMode ? 2 : 1.5}
                    style={{ transition: 'all 0.2s', filter: isActive ? `drop-shadow(0 0 8px ${b.color})` : 'none' }}
                  />
                  <text x={pos.x} y={pos.y + 4}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={isActive ? '#fff' : b.color}
                    fontSize={11} fontWeight={600}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {b.title}
                  </text>
                  {isEditMode && (
                    <g onClick={(e) => { e.stopPropagation(); deleteBubble(b.id) }}>
                      <circle cx={pos.x + BUBBLE_R - 8} cy={pos.y - BUBBLE_R + 8} r={10} fill="#ef4444" />
                      <text x={pos.x + BUBBLE_R - 8} y={pos.y - BUBBLE_R + 12} textAnchor="middle" fill="#fff" fontSize={12} style={{ pointerEvents: 'none' }}>✕</text>
                    </g>
                  )}
                </g>
              )
            })}

            {/* Add bubble button (edit mode only) */}
            {isEditMode && (
              <g data-bubble="true" style={{ cursor: 'pointer' }} onClick={() => setAddModal({ title: '', color: '#3b82f6' })}>
                <circle cx={CX} cy={CY + CENTER_R + 28} r={18} fill="#F5A62322" stroke="#F5A623" strokeWidth={2} strokeDasharray="4 3" />
                <text x={CX} y={CY + CENTER_R + 33} textAnchor="middle" fill="#F5A623" fontSize={20} style={{ pointerEvents: 'none' }}>+</text>
              </g>
            )}
          </svg>

          {/* Zoom indicator */}
          <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
            {Math.round(zoom * 100)}% · {total} topics
          </div>

          {/* Zoom controls */}
          <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['+', '−', '⟳'].map((label, i) => (
              <button key={label} onClick={() => {
                if (i === 0) setZoom(z => Math.min(2.5, z + 0.15))
                else if (i === 1) setZoom(z => Math.max(0.4, z - 0.15))
                else { setZoom(1); setPan({ x: 0, y: 0 }) }
              }} style={{
                width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 16,
                color: 'var(--text-primary)', fontFamily: 'inherit',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Rename bubble modal */}
        {editingTitle && (
          <div style={{ position: 'absolute', inset: 0, background: '#00000088', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setEditingTitle(null)}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 24, width: 320, border: '1px solid var(--border-color)' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Rename Bubble</div>
              <input autoFocus value={editingTitle.value} onChange={e => setEditingTitle({ ...editingTitle, value: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') commitTitle(editingTitle.id, editingTitle.value); if (e.key === 'Escape') setEditingTitle(null) }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid #F5A623', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingTitle(null)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={() => commitTitle(editingTitle.id, editingTitle.value)} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#F5A623', cursor: 'pointer', color: '#000', fontWeight: 700, fontFamily: 'inherit' }}>Rename</button>
              </div>
            </div>
          </div>
        )}

        {/* Add bubble modal */}
        {addModal && (
          <div style={{ position: 'absolute', inset: 0, background: '#00000088', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setAddModal(null)}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 24, width: 320, border: '1px solid #F5A623' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Add New Bubble</div>
              <input autoFocus placeholder="Topic name…" value={addModal.title} onChange={e => setAddModal({ ...addModal, title: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') addNewBubble(); if (e.key === 'Escape') setAddModal(null) }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', marginBottom: 12 }} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Color:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {EDIT_COLORS.map(c => (
                  <div key={c} onClick={() => setAddModal({ ...addModal, color: c })} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: addModal.color === c ? '3px solid #fff' : '2px solid transparent', boxSizing: 'border-box' }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setAddModal(null)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={addNewBubble} disabled={!addModal.title.trim()} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#F5A623', cursor: addModal.title.trim() ? 'pointer' : 'not-allowed', color: '#000', fontWeight: 700, fontFamily: 'inherit', opacity: addModal.title.trim() ? 1 : 0.5 }}>Add Bubble</button>
              </div>
            </div>
          </div>
        )}

        {/* Detail panel — visible in both view and edit mode */}
        {selected && (
          <div style={{
            width: 360, borderLeft: `3px solid ${selected.color}`, overflowY: 'auto',
            background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', flexShrink: 0,
          }}>
            {/* Panel header */}
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: selected.color, marginBottom: 2 }}>{selected.title}</div>
                    {isEditMode && <button onClick={() => setEditingTitle({ id: selected.id, value: selected.title })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F5A623', padding: 2 }}><Pencil size={13} /></button>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isEditMode ? 'Edit mode — add/edit/delete content' : 'Topic overview — click headings to expand'}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>
              </div>
              <button onClick={() => onQuizBubble(selected.topic)} style={{
                marginTop: 10, width: '100%', padding: '8px 12px',
                background: selected.color, color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              }}>
                🎯 Quiz: {selected.title}
              </button>
            </div>

            {/* Headings accordion */}
            <div style={{ padding: '8px 0', flex: 1 }}>
              {selected.headings.map(hc => {
                const isOpen = openHeadings.has(hc.heading)
                const hasTraps = hc.bullets.some(b => b.isTrap)
                return (
                  <div key={hc.heading}>
                    <button onClick={() => toggleHeading(hc.heading)} style={{
                      width: '100%', textAlign: 'left', padding: '10px 16px',
                      background: isOpen ? `${selected.color}11` : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isOpen ? selected.color : 'var(--text-primary)' }}>
                        {HEADING_LABELS[hc.heading]}
                        {hasTraps && <span style={{ marginLeft: 6, fontSize: 11, color: '#ef4444' }}>⚠</span>}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: '8px 16px 12px' }}>
                        {hc.heading === 'exam-traps' && !isEditMode ? (
                          hc.bullets.map((b, bi) => (
                            <FlipCard key={bi} front={b.text} back="Click to see the correct rule ↓" />
                          ))
                        ) : (
                          hc.bullets.map((b, bi) => (
                            <div key={bi} style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '6px 8px', borderRadius: 6, background: b.isTrap ? '#ef444411' : 'transparent', border: b.isTrap ? '1px solid #ef444433' : 'none', alignItems: 'flex-start' }}>
                              <span style={{ color: b.isTrap ? '#ef4444' : selected.color, flexShrink: 0, marginTop: 1 }}>{b.isTrap ? '⚠' : '•'}</span>
                              {isEditMode && editingBullet?.heading === hc.heading && editingBullet.index === bi ? (
                                <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                                  <textarea value={editingBullet.value} onChange={e => setEditingBullet({ ...editingBullet, value: e.target.value })} rows={2} style={{ flex: 1, fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid #F5A623', background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }} />
                                  <button onClick={() => commitBullet(selected.id, hc.heading, bi, editingBullet.value)} style={{ background: '#22c55e', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 6px', color: '#fff' }}><Check size={12} /></button>
                                  <button onClick={() => setEditingBullet(null)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', padding: '4px 6px', color: 'var(--text-muted)' }}><X size={12} /></button>
                                </div>
                              ) : (
                                <>
                                  <span style={{ fontSize: 13, color: b.isTrap ? '#fca5a5' : 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>{b.text}</span>
                                  {isEditMode && (
                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                      <button onClick={() => setEditingBullet({ heading: hc.heading, index: bi, value: b.text })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Pencil size={11} /></button>
                                      <button onClick={() => deleteBullet(selected.id, hc.heading, bi)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={11} /></button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))
                        )}
                        {isEditMode && (
                          <button onClick={() => addBulletToHeading(selected.id, hc.heading)} style={{ marginTop: 4, width: '100%', padding: '5px', fontSize: 12, background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                            <Plus size={11} style={{ display: 'inline', marginRight: 4 }} />Add bullet
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
