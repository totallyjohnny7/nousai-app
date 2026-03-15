/**
 * Physics Study Content — PHYS 1120
 * Physics for Life Science II
 * "Physics: Principles with Applications" by Giancoli
 * Chapters 18-31: Electricity, Magnetism, EM Waves, Optics
 */

export interface KeyTerm {
  term: string;
  category?: 'concept' | 'equation' | 'unit' | 'technique' | 'device' | 'phenomenon';
}

export interface ChapterStudyContent {
  chapter: number;
  title: string;
  keyTerms: KeyTerm[];
  keyConcepts: string[];
  keyEquations: string[];
}

export const PHYS1120_STUDY_CONTENT: ChapterStudyContent[] = [
  // ═══════════════════════════════════════════════════════════════
  // Ch 18: Electric Charge and Electric Field
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 18,
    title: 'Electric Charge and Electric Field',
    keyTerms: [
      { term: 'Electric charge', category: 'concept' },
      { term: 'Conservation of charge', category: 'concept' },
      { term: 'Coulomb (C)', category: 'unit' },
      { term: 'Elementary charge (e)', category: 'concept' },
      { term: 'Conductor', category: 'concept' },
      { term: 'Insulator', category: 'concept' },
      { term: 'Semiconductor', category: 'concept' },
      { term: 'Induced charge', category: 'phenomenon' },
      { term: 'Electroscope', category: 'device' },
      { term: 'Polarization', category: 'phenomenon' },
      { term: 'Coulomb\'s law', category: 'concept' },
      { term: 'Coulomb constant (k)', category: 'concept' },
      { term: 'Permittivity of free space (ε₀)', category: 'concept' },
      { term: 'Superposition principle', category: 'concept' },
      { term: 'Electric field (E)', category: 'concept' },
      { term: 'Electric field lines', category: 'concept' },
      { term: 'Test charge', category: 'concept' },
      { term: 'Electric dipole', category: 'concept' },
      { term: 'Dipole moment', category: 'concept' },
      { term: 'Continuous charge distribution', category: 'concept' },
      { term: 'Static electricity', category: 'phenomenon' },
      { term: 'Triboelectric effect', category: 'phenomenon' },
      { term: 'Newtons per coulomb (N/C)', category: 'unit' },
      { term: 'Electrostatic equilibrium', category: 'concept' },
    ],
    keyConcepts: [
      'There are two types of electric charge: positive and negative. Like charges repel; unlike charges attract.',
      'Electric charge is quantized in units of e = 1.6 × 10⁻¹⁹ C and is always conserved in any process.',
      'Conductors allow free movement of charges; insulators do not. Charging by induction does not require contact.',
      'Coulomb\'s law gives the force between two point charges, proportional to the product of charges and inversely proportional to the square of the distance.',
      'The electric field at a point is the force per unit positive test charge; it is a vector field that exists throughout space.',
      'Electric field lines start on positive charges and end on negative charges; their density indicates field strength.',
      'The principle of superposition states that the net electric field is the vector sum of fields from all individual charges.',
      'A conductor in electrostatic equilibrium has zero electric field inside and charge resides only on the surface.',
    ],
    keyEquations: [
      'F = kq₁q₂/r²',
      'k = 1/(4πε₀) = 8.99 × 10⁹ N·m²/C²',
      'E = F/q',
      'E = kQ/r² (point charge)',
      'p = qd (electric dipole moment)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 19: Electric Potential
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 19,
    title: 'Electric Potential',
    keyTerms: [
      { term: 'Electric potential energy', category: 'concept' },
      { term: 'Electric potential (V)', category: 'concept' },
      { term: 'Volt (V)', category: 'unit' },
      { term: 'Potential difference (voltage)', category: 'concept' },
      { term: 'Electron volt (eV)', category: 'unit' },
      { term: 'Equipotential surface', category: 'concept' },
      { term: 'Equipotential line', category: 'concept' },
      { term: 'Potential gradient', category: 'concept' },
      { term: 'Point charge potential', category: 'equation' },
      { term: 'Electric potential of a dipole', category: 'concept' },
      { term: 'Potential due to continuous distribution', category: 'concept' },
      { term: 'Grounding', category: 'concept' },
      { term: 'Van de Graaff generator', category: 'device' },
      { term: 'Electrostatic potential energy', category: 'concept' },
      { term: 'Work-energy theorem (electric)', category: 'concept' },
      { term: 'Voltage (common term)', category: 'concept' },
      { term: 'Joules per coulomb (J/C)', category: 'unit' },
    ],
    keyConcepts: [
      'Electric potential is the electric potential energy per unit charge: V = U/q. The SI unit is the volt (1 V = 1 J/C).',
      'The potential difference between two points equals the work done per unit charge by the electric field: ΔV = −W/q.',
      'Equipotential surfaces are always perpendicular to electric field lines; no work is done moving a charge along an equipotential.',
      'The electric field points from high potential to low potential; E = −dV/dx relates field and potential.',
      'The potential due to a point charge is V = kQ/r, a scalar quantity that can be positive or negative.',
      'The electron volt (eV) is the energy gained by an electron accelerated through a potential difference of 1 V: 1 eV = 1.6 × 10⁻¹⁹ J.',
    ],
    keyEquations: [
      'V = kQ/r (point charge)',
      'V = U/q = −W/q',
      'U = kq₁q₂/r',
      'E = −ΔV/Δx',
      '1 eV = 1.6 × 10⁻¹⁹ J',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 20: Capacitance, Dielectrics, Electric Energy Storage
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 20,
    title: 'Capacitance, Dielectrics, Electric Energy Storage',
    keyTerms: [
      { term: 'Capacitor', category: 'device' },
      { term: 'Capacitance (C)', category: 'concept' },
      { term: 'Farad (F)', category: 'unit' },
      { term: 'Parallel-plate capacitor', category: 'device' },
      { term: 'Dielectric', category: 'concept' },
      { term: 'Dielectric constant (κ)', category: 'concept' },
      { term: 'Dielectric strength', category: 'concept' },
      { term: 'Capacitors in series', category: 'concept' },
      { term: 'Capacitors in parallel', category: 'concept' },
      { term: 'Electric energy storage', category: 'concept' },
      { term: 'Energy density', category: 'concept' },
      { term: 'Breakdown voltage', category: 'concept' },
      { term: 'Cylindrical capacitor', category: 'device' },
      { term: 'Spherical capacitor', category: 'device' },
      { term: 'Electrolytic capacitor', category: 'device' },
      { term: 'Microfarad (μF)', category: 'unit' },
      { term: 'Picofarad (pF)', category: 'unit' },
    ],
    keyConcepts: [
      'A capacitor stores charge and energy. Capacitance C = Q/V measures the ability to store charge per unit voltage.',
      'For a parallel-plate capacitor, C = ε₀A/d, where A is plate area and d is plate separation.',
      'Capacitors in parallel add: C_total = C₁ + C₂ + ... Capacitors in series combine as: 1/C_total = 1/C₁ + 1/C₂ + ...',
      'The energy stored in a capacitor is U = ½CV² = ½Q²/C = ½QV.',
      'A dielectric inserted between capacitor plates increases capacitance by a factor κ: C = κε₀A/d.',
      'The energy density in an electric field is u = ½ε₀E², giving the energy stored per unit volume.',
    ],
    keyEquations: [
      'C = Q/V',
      'C = ε₀A/d (parallel plate)',
      'C = κε₀A/d (with dielectric)',
      'U = ½CV² = ½Q²/C = ½QV',
      'u = ½ε₀E² (energy density)',
      '1/C_series = 1/C₁ + 1/C₂ + ...',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 21: Electric Current
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 21,
    title: 'Electric Current',
    keyTerms: [
      { term: 'Electric current (I)', category: 'concept' },
      { term: 'Ampere (A)', category: 'unit' },
      { term: 'Conventional current', category: 'concept' },
      { term: 'Drift velocity', category: 'concept' },
      { term: 'Battery', category: 'device' },
      { term: 'Electromotive force (EMF)', category: 'concept' },
      { term: 'Ohm\'s law', category: 'concept' },
      { term: 'Resistance (R)', category: 'concept' },
      { term: 'Ohm (Ω)', category: 'unit' },
      { term: 'Resistivity (ρ)', category: 'concept' },
      { term: 'Conductivity (σ)', category: 'concept' },
      { term: 'Temperature coefficient of resistivity', category: 'concept' },
      { term: 'Electric power', category: 'concept' },
      { term: 'Watt (W)', category: 'unit' },
      { term: 'Kilowatt-hour (kWh)', category: 'unit' },
      { term: 'Alternating current (AC)', category: 'concept' },
      { term: 'Direct current (DC)', category: 'concept' },
      { term: 'RMS current', category: 'concept' },
      { term: 'RMS voltage', category: 'concept' },
      { term: 'Peak voltage', category: 'concept' },
      { term: 'Superconductor', category: 'phenomenon' },
      { term: 'Household circuit', category: 'device' },
      { term: 'Circuit breaker', category: 'device' },
      { term: 'Fuse', category: 'device' },
    ],
    keyConcepts: [
      'Electric current is the rate of flow of charge: I = ΔQ/Δt. Conventional current flows from high to low potential.',
      'Ohm\'s law states V = IR; resistance is proportional to length and inversely proportional to cross-sectional area: R = ρL/A.',
      'Resistivity depends on temperature: ρ = ρ₀(1 + α(T − T₀)), where α is the temperature coefficient.',
      'Electric power is P = IV = I²R = V²/R. Energy is measured in kilowatt-hours for household billing.',
      'Alternating current varies sinusoidally; the RMS values relate to peak values as I_rms = I₀/√2 and V_rms = V₀/√2.',
      'A battery provides EMF that drives current through a circuit. Real batteries have internal resistance.',
      'Superconductors have zero resistivity below a critical temperature.',
    ],
    keyEquations: [
      'I = ΔQ/Δt',
      'V = IR (Ohm\'s law)',
      'R = ρL/A',
      'P = IV = I²R = V²/R',
      'I_rms = I₀/√2',
      'V_rms = V₀/√2',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 22: DC Circuits
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 22,
    title: 'DC Circuits',
    keyTerms: [
      { term: 'EMF (electromotive force)', category: 'concept' },
      { term: 'Terminal voltage', category: 'concept' },
      { term: 'Internal resistance', category: 'concept' },
      { term: 'Resistors in series', category: 'concept' },
      { term: 'Resistors in parallel', category: 'concept' },
      { term: 'Kirchhoff\'s junction rule', category: 'technique' },
      { term: 'Kirchhoff\'s loop rule', category: 'technique' },
      { term: 'RC circuit', category: 'concept' },
      { term: 'Time constant (τ = RC)', category: 'concept' },
      { term: 'Charging curve', category: 'concept' },
      { term: 'Discharging curve', category: 'concept' },
      { term: 'Ammeter', category: 'device' },
      { term: 'Voltmeter', category: 'device' },
      { term: 'Galvanometer', category: 'device' },
      { term: 'Shunt resistor', category: 'device' },
      { term: 'Wheatstone bridge', category: 'device' },
      { term: 'Electrical safety', category: 'concept' },
      { term: 'Ground fault circuit interrupter (GFCI)', category: 'device' },
      { term: 'Equivalent resistance', category: 'concept' },
    ],
    keyConcepts: [
      'Terminal voltage of a battery: V = EMF − Ir, where r is the internal resistance.',
      'Resistors in series add: R_total = R₁ + R₂ + ... Resistors in parallel: 1/R_total = 1/R₁ + 1/R₂ + ...',
      'Kirchhoff\'s junction rule: the sum of currents entering a junction equals the sum leaving (conservation of charge).',
      'Kirchhoff\'s loop rule: the sum of potential changes around any closed loop is zero (conservation of energy).',
      'In an RC circuit, charge builds up exponentially: Q(t) = Q_max(1 − e^(−t/RC)) with time constant τ = RC.',
      'An ammeter is connected in series with low resistance; a voltmeter is connected in parallel with high resistance.',
      'Electric shock hazard depends on current through the body; currents above ~10 mA can be dangerous.',
    ],
    keyEquations: [
      'V_terminal = EMF − Ir',
      'R_series = R₁ + R₂ + ...',
      '1/R_parallel = 1/R₁ + 1/R₂ + ...',
      'Q(t) = Q_max(1 − e^(−t/RC)) (charging)',
      'Q(t) = Q₀e^(−t/RC) (discharging)',
      'τ = RC',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 23: Magnetic Field
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 23,
    title: 'Magnetic Field',
    keyTerms: [
      { term: 'Magnetic field (B)', category: 'concept' },
      { term: 'Tesla (T)', category: 'unit' },
      { term: 'Gauss (G)', category: 'unit' },
      { term: 'Magnetic pole', category: 'concept' },
      { term: 'Magnetic field lines', category: 'concept' },
      { term: 'Right-hand rule', category: 'technique' },
      { term: 'Lorentz force', category: 'concept' },
      { term: 'Force on a current-carrying wire', category: 'concept' },
      { term: 'Magnetic force on moving charge', category: 'concept' },
      { term: 'Cyclotron motion', category: 'phenomenon' },
      { term: 'Cyclotron radius', category: 'concept' },
      { term: 'Velocity selector', category: 'device' },
      { term: 'Mass spectrometer', category: 'device' },
      { term: 'Hall effect', category: 'phenomenon' },
      { term: 'Torque on a current loop', category: 'concept' },
      { term: 'Magnetic dipole moment', category: 'concept' },
      { term: 'Electric motor', category: 'device' },
      { term: 'Loudspeaker', category: 'device' },
      { term: 'Galvanometer', category: 'device' },
    ],
    keyConcepts: [
      'A magnetic field exerts a force on a moving charged particle: F = qv × B. The force is perpendicular to both v and B.',
      'The right-hand rule determines the direction of magnetic force: point fingers along v, curl toward B, thumb gives F for positive charges.',
      'A charged particle moving perpendicular to a uniform B field follows a circular path with radius r = mv/(qB).',
      'A current-carrying wire in a magnetic field experiences a force: F = ILB sin θ.',
      'A current loop in a magnetic field experiences a torque: τ = NIAB sin θ, which is the principle behind electric motors.',
      'The magnetic dipole moment of a loop is μ = NIA, where N is the number of turns and A is the loop area.',
      'The Hall effect produces a voltage across a conductor carrying current in a magnetic field, used to measure B.',
    ],
    keyEquations: [
      'F = qvB sin θ (magnetic force on charge)',
      'r = mv/(qB) (cyclotron radius)',
      'F = ILB sin θ (force on wire)',
      'τ = NIAB sin θ (torque on loop)',
      'μ = NIA (magnetic dipole moment)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 24: Sources of Magnetic Field
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 24,
    title: 'Sources of Magnetic Field',
    keyTerms: [
      { term: 'Biot-Savart law', category: 'concept' },
      { term: 'Permeability of free space (μ₀)', category: 'concept' },
      { term: 'Magnetic field of a straight wire', category: 'equation' },
      { term: 'Force between parallel wires', category: 'concept' },
      { term: 'Ampere (definition)', category: 'unit' },
      { term: 'Ampere\'s law', category: 'concept' },
      { term: 'Solenoid', category: 'device' },
      { term: 'Toroid', category: 'device' },
      { term: 'Magnetic field of a solenoid', category: 'equation' },
      { term: 'Electromagnet', category: 'device' },
      { term: 'Ferromagnetism', category: 'phenomenon' },
      { term: 'Paramagnetism', category: 'phenomenon' },
      { term: 'Diamagnetism', category: 'phenomenon' },
      { term: 'Magnetic domain', category: 'concept' },
      { term: 'Hysteresis', category: 'phenomenon' },
      { term: 'Curie temperature', category: 'concept' },
      { term: 'Magnetic permeability', category: 'concept' },
      { term: 'Amperian loop', category: 'technique' },
    ],
    keyConcepts: [
      'The Biot-Savart law gives the magnetic field from a small current element: dB = (μ₀/4π)(I dℓ × r̂)/r².',
      'The magnetic field around a long straight wire is B = μ₀I/(2πr), forming concentric circles around the wire.',
      'Two parallel wires carrying currents in the same direction attract; opposite currents repel. F/L = μ₀I₁I₂/(2πd).',
      'Ampere\'s law: the line integral of B around a closed path equals μ₀ times the enclosed current: ∮B·dℓ = μ₀I_enc.',
      'Inside a solenoid with n turns per unit length, the field is uniform: B = μ₀nI.',
      'Ferromagnetic materials have magnetic domains that align in an external field, greatly enhancing the field.',
      'Above the Curie temperature, ferromagnetic materials become paramagnetic.',
    ],
    keyEquations: [
      'dB = (μ₀/4π)(I dℓ × r̂)/r² (Biot-Savart)',
      'B = μ₀I/(2πr) (long straight wire)',
      'F/L = μ₀I₁I₂/(2πd) (parallel wires)',
      '∮B·dℓ = μ₀I_enc (Ampere\'s law)',
      'B = μ₀nI (solenoid)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 25: Electromagnetic Induction and Faraday's Law
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 25,
    title: 'Electromagnetic Induction and Faraday\'s Law',
    keyTerms: [
      { term: 'Electromagnetic induction', category: 'phenomenon' },
      { term: 'Magnetic flux (Φ_B)', category: 'concept' },
      { term: 'Weber (Wb)', category: 'unit' },
      { term: 'Faraday\'s law', category: 'concept' },
      { term: 'Lenz\'s law', category: 'concept' },
      { term: 'Induced EMF', category: 'concept' },
      { term: 'Motional EMF', category: 'concept' },
      { term: 'Eddy currents', category: 'phenomenon' },
      { term: 'Self-inductance', category: 'concept' },
      { term: 'Inductor', category: 'device' },
      { term: 'Henry (H)', category: 'unit' },
      { term: 'Mutual inductance', category: 'concept' },
      { term: 'Transformer', category: 'device' },
      { term: 'LR circuit', category: 'concept' },
      { term: 'Time constant (τ = L/R)', category: 'concept' },
      { term: 'Magnetic energy', category: 'concept' },
      { term: 'Energy density of magnetic field', category: 'concept' },
      { term: 'Generator (AC)', category: 'device' },
      { term: 'Back EMF', category: 'concept' },
      { term: 'Changing magnetic flux', category: 'phenomenon' },
    ],
    keyConcepts: [
      'Faraday\'s law: an EMF is induced when the magnetic flux through a circuit changes: EMF = −N dΦ_B/dt.',
      'Magnetic flux is Φ_B = BA cos θ, where θ is the angle between B and the area normal.',
      'Lenz\'s law: the induced current flows in a direction to oppose the change in flux that produced it.',
      'A motional EMF is generated when a conductor moves through a magnetic field: EMF = BLv.',
      'Self-inductance of a coil: L = NΦ_B/I. An inductor opposes changes in current: EMF = −L dI/dt.',
      'A transformer changes AC voltage: V_s/V_p = N_s/N_p. Energy is conserved: V_pI_p = V_sI_s.',
      'In an LR circuit, current grows as I(t) = (EMF/R)(1 − e^(−t·R/L)) with time constant τ = L/R.',
      'Energy stored in an inductor is U = ½LI². The magnetic energy density is u = B²/(2μ₀).',
    ],
    keyEquations: [
      'Φ_B = BA cos θ',
      'EMF = −N dΦ_B/dt (Faraday\'s law)',
      'EMF = BLv (motional EMF)',
      'L = NΦ_B/I (self-inductance)',
      'V_s/V_p = N_s/N_p (transformer)',
      'U = ½LI² (inductor energy)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 26: AC Circuits
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 26,
    title: 'AC Circuits',
    keyTerms: [
      { term: 'AC voltage source', category: 'device' },
      { term: 'Reactance', category: 'concept' },
      { term: 'Inductive reactance (X_L)', category: 'concept' },
      { term: 'Capacitive reactance (X_C)', category: 'concept' },
      { term: 'Impedance (Z)', category: 'concept' },
      { term: 'Phase angle (φ)', category: 'concept' },
      { term: 'Power factor (cos φ)', category: 'concept' },
      { term: 'LRC series circuit', category: 'concept' },
      { term: 'Resonance', category: 'phenomenon' },
      { term: 'Resonant frequency', category: 'concept' },
      { term: 'Quality factor (Q)', category: 'concept' },
      { term: 'Phasor diagram', category: 'technique' },
      { term: 'Impedance matching', category: 'technique' },
      { term: 'Average power', category: 'concept' },
      { term: 'Hertz (Hz)', category: 'unit' },
      { term: 'Angular frequency (ω)', category: 'concept' },
      { term: 'RMS values in AC', category: 'concept' },
      { term: 'Bandwidth', category: 'concept' },
    ],
    keyConcepts: [
      'In a purely resistive AC circuit, voltage and current are in phase. Average power: P = I_rms V_rms.',
      'In a purely inductive circuit, current lags voltage by 90°. Inductive reactance: X_L = ωL = 2πfL.',
      'In a purely capacitive circuit, current leads voltage by 90°. Capacitive reactance: X_C = 1/(ωC) = 1/(2πfC).',
      'In an LRC series circuit, impedance Z = √(R² + (X_L − X_C)²) and tan φ = (X_L − X_C)/R.',
      'Resonance occurs when X_L = X_C, giving f₀ = 1/(2π√(LC)). At resonance, impedance is minimum (Z = R) and current is maximum.',
      'Average power in AC: P = I_rms V_rms cos φ, where cos φ is the power factor.',
    ],
    keyEquations: [
      'X_L = ωL = 2πfL',
      'X_C = 1/(ωC) = 1/(2πfC)',
      'Z = √(R² + (X_L − X_C)²)',
      'tan φ = (X_L − X_C)/R',
      'f₀ = 1/(2π√(LC)) (resonant frequency)',
      'P_avg = I_rms V_rms cos φ',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 27: Electromagnetic Waves
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 27,
    title: 'Electromagnetic Waves',
    keyTerms: [
      { term: 'Maxwell\'s equations', category: 'concept' },
      { term: 'Displacement current', category: 'concept' },
      { term: 'Electromagnetic wave', category: 'phenomenon' },
      { term: 'Speed of light (c)', category: 'concept' },
      { term: 'Electromagnetic spectrum', category: 'concept' },
      { term: 'Radio waves', category: 'phenomenon' },
      { term: 'Microwaves', category: 'phenomenon' },
      { term: 'Infrared radiation', category: 'phenomenon' },
      { term: 'Visible light', category: 'phenomenon' },
      { term: 'Ultraviolet radiation', category: 'phenomenon' },
      { term: 'X-rays', category: 'phenomenon' },
      { term: 'Gamma rays', category: 'phenomenon' },
      { term: 'Poynting vector (S)', category: 'concept' },
      { term: 'Intensity of EM wave', category: 'concept' },
      { term: 'Radiation pressure', category: 'concept' },
      { term: 'Antenna', category: 'device' },
      { term: 'Wavelength (λ)', category: 'concept' },
      { term: 'Frequency (f)', category: 'concept' },
      { term: 'Transverse wave', category: 'concept' },
      { term: 'Watts per square meter (W/m²)', category: 'unit' },
    ],
    keyConcepts: [
      'Maxwell\'s equations unify electricity and magnetism and predict electromagnetic waves that travel at c = 1/√(μ₀ε₀).',
      'EM waves are transverse waves with oscillating E and B fields perpendicular to each other and to the direction of propagation.',
      'The electromagnetic spectrum ranges from radio waves (long λ) to gamma rays (short λ); all travel at speed c in vacuum.',
      'The Poynting vector S = (1/μ₀)(E × B) gives the direction and magnitude of energy flow in an EM wave.',
      'The intensity of an EM wave is the average power per unit area: I = S_avg = E₀B₀/(2μ₀) = cε₀E₀²/2.',
      'Radiation pressure on a fully absorbing surface is P = I/c; on a fully reflecting surface it is P = 2I/c.',
    ],
    keyEquations: [
      'c = 1/√(μ₀ε₀) = 3.0 × 10⁸ m/s',
      'c = fλ',
      'S = (1/μ₀)(E × B) (Poynting vector)',
      'I = cε₀E₀²/2 (wave intensity)',
      'P = I/c (radiation pressure, absorbed)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 28: Light — Reflection and Refraction
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 28,
    title: 'Light: Reflection and Refraction',
    keyTerms: [
      { term: 'Ray model of light', category: 'concept' },
      { term: 'Law of reflection', category: 'concept' },
      { term: 'Angle of incidence', category: 'concept' },
      { term: 'Angle of reflection', category: 'concept' },
      { term: 'Plane mirror', category: 'device' },
      { term: 'Virtual image', category: 'concept' },
      { term: 'Real image', category: 'concept' },
      { term: 'Concave mirror', category: 'device' },
      { term: 'Convex mirror', category: 'device' },
      { term: 'Focal point', category: 'concept' },
      { term: 'Focal length (f)', category: 'concept' },
      { term: 'Radius of curvature (R)', category: 'concept' },
      { term: 'Mirror equation', category: 'equation' },
      { term: 'Magnification (m)', category: 'concept' },
      { term: 'Ray tracing (mirrors)', category: 'technique' },
      { term: 'Index of refraction (n)', category: 'concept' },
      { term: 'Snell\'s law', category: 'concept' },
      { term: 'Total internal reflection', category: 'phenomenon' },
      { term: 'Critical angle', category: 'concept' },
      { term: 'Dispersion', category: 'phenomenon' },
      { term: 'Fiber optics', category: 'device' },
      { term: 'Refraction', category: 'phenomenon' },
      { term: 'Prism', category: 'device' },
    ],
    keyConcepts: [
      'The law of reflection: the angle of incidence equals the angle of reflection, measured from the normal.',
      'A plane mirror produces a virtual, upright, same-size image located as far behind the mirror as the object is in front.',
      'The mirror equation: 1/f = 1/d_o + 1/d_i, with f = R/2. Magnification: m = −d_i/d_o = h_i/h_o.',
      'Concave mirrors can form real or virtual images; convex mirrors always form virtual, upright, reduced images.',
      'Snell\'s law: n₁ sin θ₁ = n₂ sin θ₂. Light bends toward the normal when entering a denser medium.',
      'Total internal reflection occurs when light travels from a denser to a less dense medium and θ > θ_c, where sin θ_c = n₂/n₁.',
      'Dispersion occurs because the index of refraction depends on wavelength, causing white light to separate into colors.',
    ],
    keyEquations: [
      '1/d_o + 1/d_i = 1/f (mirror equation)',
      'f = R/2',
      'm = −d_i/d_o = h_i/h_o',
      'n₁ sin θ₁ = n₂ sin θ₂ (Snell\'s law)',
      'sin θ_c = n₂/n₁ (critical angle)',
      'n = c/v (index of refraction)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 29: Lenses and Optical Instruments
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 29,
    title: 'Lenses and Optical Instruments',
    keyTerms: [
      { term: 'Thin lens', category: 'device' },
      { term: 'Converging lens', category: 'device' },
      { term: 'Diverging lens', category: 'device' },
      { term: 'Thin lens equation', category: 'equation' },
      { term: 'Lensmaker\'s equation', category: 'equation' },
      { term: 'Diopter (D)', category: 'unit' },
      { term: 'Power of a lens', category: 'concept' },
      { term: 'Lens combination', category: 'concept' },
      { term: 'Ray tracing (lenses)', category: 'technique' },
      { term: 'Human eye', category: 'device' },
      { term: 'Near point', category: 'concept' },
      { term: 'Far point', category: 'concept' },
      { term: 'Accommodation', category: 'phenomenon' },
      { term: 'Nearsightedness (myopia)', category: 'concept' },
      { term: 'Farsightedness (hyperopia)', category: 'concept' },
      { term: 'Magnifying glass', category: 'device' },
      { term: 'Angular magnification', category: 'concept' },
      { term: 'Compound microscope', category: 'device' },
      { term: 'Telescope', category: 'device' },
      { term: 'Aberration', category: 'phenomenon' },
      { term: 'Chromatic aberration', category: 'phenomenon' },
      { term: 'Spherical aberration', category: 'phenomenon' },
    ],
    keyConcepts: [
      'The thin lens equation is 1/f = 1/d_o + 1/d_i. Converging lenses have f > 0; diverging lenses have f < 0.',
      'The power of a lens is P = 1/f (in diopters, D). For lens combinations, total power is P = P₁ + P₂.',
      'Ray tracing for thin lenses uses three principal rays: parallel ray, focal ray, and central ray.',
      'The human eye focuses by changing lens shape (accommodation). The normal near point is about 25 cm.',
      'Myopia is corrected with a diverging lens; hyperopia is corrected with a converging lens.',
      'A magnifying glass provides angular magnification M = N/f, where N = 25 cm is the near point.',
      'A compound microscope uses two lenses: the objective forms a real magnified image that the eyepiece further magnifies.',
      'A refracting telescope uses an objective lens to form a real image magnified by the eyepiece; M = −f_o/f_e.',
    ],
    keyEquations: [
      '1/d_o + 1/d_i = 1/f (thin lens equation)',
      'P = 1/f (lens power in diopters)',
      'm = −d_i/d_o (lateral magnification)',
      'M = N/f (magnifying glass, N = 25 cm)',
      'M = −(d_i · N)/(f_o · f_e) (microscope)',
      'M = −f_o/f_e (telescope)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 30: Wave Nature of Light; Interference
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 30,
    title: 'Wave Nature of Light; Interference',
    keyTerms: [
      { term: 'Wave-particle duality', category: 'concept' },
      { term: 'Huygens\' principle', category: 'concept' },
      { term: 'Wavefront', category: 'concept' },
      { term: 'Constructive interference', category: 'phenomenon' },
      { term: 'Destructive interference', category: 'phenomenon' },
      { term: 'Young\'s double-slit experiment', category: 'technique' },
      { term: 'Interference fringes', category: 'phenomenon' },
      { term: 'Path difference', category: 'concept' },
      { term: 'Coherent sources', category: 'concept' },
      { term: 'Monochromatic light', category: 'concept' },
      { term: 'Thin-film interference', category: 'phenomenon' },
      { term: 'Phase change on reflection', category: 'phenomenon' },
      { term: 'Newton\'s rings', category: 'phenomenon' },
      { term: 'Anti-reflective coating', category: 'device' },
      { term: 'Michelson interferometer', category: 'device' },
      { term: 'Optical path length', category: 'concept' },
      { term: 'Order of interference (m)', category: 'concept' },
      { term: 'Fringe spacing', category: 'concept' },
      { term: 'Nanometer (nm)', category: 'unit' },
    ],
    keyConcepts: [
      'Huygens\' principle: every point on a wavefront acts as a source of secondary wavelets; the new wavefront is the envelope of these wavelets.',
      'Young\'s double-slit experiment demonstrates light interference: bright fringes at d sin θ = mλ, dark fringes at d sin θ = (m + ½)λ.',
      'Constructive interference occurs when the path difference is a whole number of wavelengths; destructive when it is a half-integer number.',
      'Thin-film interference depends on film thickness, index of refraction, and whether a phase change occurs on reflection.',
      'A phase change of 180° (half wavelength) occurs when light reflects from a medium with higher index of refraction.',
      'The Michelson interferometer splits a beam into two paths and recombines them, producing interference fringes sensitive to path differences.',
    ],
    keyEquations: [
      'd sin θ = mλ (double-slit bright fringes)',
      'd sin θ = (m + ½)λ (double-slit dark fringes)',
      'y_m = mλL/d (fringe position on screen)',
      '2nt = mλ (thin-film constructive, no phase change)',
      '2nt = (m + ½)λ (thin-film constructive, one phase change)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 31: Diffraction and Polarization
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 31,
    title: 'Diffraction and Polarization',
    keyTerms: [
      { term: 'Diffraction', category: 'phenomenon' },
      { term: 'Single-slit diffraction', category: 'phenomenon' },
      { term: 'Diffraction grating', category: 'device' },
      { term: 'Central maximum', category: 'concept' },
      { term: 'Secondary maxima', category: 'concept' },
      { term: 'Diffraction minima', category: 'concept' },
      { term: 'Resolving power', category: 'concept' },
      { term: 'Rayleigh criterion', category: 'concept' },
      { term: 'Angular resolution', category: 'concept' },
      { term: 'Polarization', category: 'phenomenon' },
      { term: 'Polarizer', category: 'device' },
      { term: 'Analyzer', category: 'device' },
      { term: 'Malus\'s law', category: 'concept' },
      { term: 'Brewster\'s angle', category: 'concept' },
      { term: 'Polarization by reflection', category: 'phenomenon' },
      { term: 'Polarization by scattering', category: 'phenomenon' },
      { term: 'Birefringence', category: 'phenomenon' },
      { term: 'Unpolarized light', category: 'concept' },
      { term: 'Linearly polarized light', category: 'concept' },
      { term: 'Circular polarization', category: 'phenomenon' },
      { term: 'X-ray diffraction', category: 'technique' },
    ],
    keyConcepts: [
      'Single-slit diffraction produces a central maximum twice as wide as secondary maxima, with minima at a sin θ = mλ.',
      'A diffraction grating has many closely spaced slits and produces very sharp, bright maxima at d sin θ = mλ.',
      'The Rayleigh criterion for resolution: two sources are just resolved when the central maximum of one falls on the first minimum of the other: θ_min = 1.22λ/D.',
      'Polarization demonstrates the transverse nature of light. A polarizer transmits only the component of E along its transmission axis.',
      'Malus\'s law: when polarized light passes through an analyzer, transmitted intensity is I = I₀ cos² θ.',
      'Brewster\'s angle is the angle of incidence at which reflected light is completely polarized: tan θ_B = n₂/n₁.',
      'X-ray diffraction from crystals satisfies Bragg\'s law: 2d sin θ = mλ, used to determine crystal structures.',
    ],
    keyEquations: [
      'a sin θ = mλ (single-slit minima)',
      'd sin θ = mλ (grating maxima)',
      'θ_min = 1.22λ/D (Rayleigh criterion)',
      'I = I₀ cos² θ (Malus\'s law)',
      'tan θ_B = n₂/n₁ (Brewster\'s angle)',
      '2d sin θ = mλ (Bragg\'s law)',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

export function getPhysicsChapter(ch: number): ChapterStudyContent | null {
  return PHYS1120_STUDY_CONTENT.find(c => c.chapter === ch) || null;
}

export function getAllPhysicsTerms(): KeyTerm[] {
  return PHYS1120_STUDY_CONTENT.flatMap(c => c.keyTerms);
}

export function getPhysicsTermsByCategory(cat: KeyTerm['category']): KeyTerm[] {
  return getAllPhysicsTerms().filter(t => t.category === cat);
}

export function getAllPhysicsEquations(): string[] {
  return PHYS1120_STUDY_CONTENT.flatMap(c => c.keyEquations);
}
