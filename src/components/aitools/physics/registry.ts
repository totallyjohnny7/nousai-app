import type { SimDef } from './types';
import { ElectricFieldSim, electricFieldSliders } from './sims/ElectricFieldSim';
import { EMPointChargesSim, emPointChargesSliders } from './sims/EMPointChargesSim';
import { MagneticFieldSim, magneticFieldSliders } from './sims/MagneticFieldSim';
import { GaussLawSim, gaussLawSliders } from './sims/GaussLawSim';

export const SIM_REGISTRY: SimDef[] = [
  {
    id: 'electric-field',
    title: 'Electric Field',
    subtitle: 'Charges and field lines',
    type: 'canvas',
    sliders: electricFieldSliders,
    sim: ElectricFieldSim,
  },
  {
    id: 'coulombs-law',
    title: "Coulomb's Law",
    subtitle: 'Force between two point charges',
    type: 'phet',
    phetUrl: 'https://phet.colorado.edu/sims/html/coulombs-law/latest/coulombs-law_en.html',
  },
  {
    id: 'capacitor-lab',
    title: 'Capacitor Lab',
    subtitle: 'Parallel plate capacitor',
    type: 'phet',
    phetUrl: 'https://phet.colorado.edu/sims/html/capacitor-lab-basics/latest/capacitor-lab-basics_en.html',
  },
  {
    id: 'faradays-law',
    title: "Faraday's Law",
    subtitle: 'Induced EMF from changing flux',
    type: 'phet',
    phetUrl: 'https://phet.colorado.edu/sims/html/faradays-law/latest/faradays-law_en.html',
  },
  {
    id: 'circuit-builder',
    title: 'Circuit Builder',
    subtitle: 'DC circuit R, C, L',
    type: 'phet',
    phetUrl: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_en.html',
  },
  {
    id: 'wave-interference',
    title: 'Wave Interference',
    subtitle: 'Two-source interference pattern',
    type: 'phet',
    phetUrl: 'https://phet.colorado.edu/sims/html/wave-interference/latest/wave-interference_en.html',
  },
  {
    id: 'geometric-optics',
    title: 'Geometric Optics',
    subtitle: 'Refraction, lenses, mirrors',
    type: 'phet',
    phetUrl: 'https://phet.colorado.edu/sims/html/geometric-optics/latest/geometric-optics_en.html',
  },
  {
    id: 'em-point-charges',
    title: 'EM Point Charges',
    subtitle: 'Moving charge field lines',
    type: 'canvas',
    sliders: emPointChargesSliders,
    sim: EMPointChargesSim,
  },
  {
    id: 'magnetic-field',
    title: 'Magnetic Field',
    subtitle: 'Field lines around current wire',
    type: 'canvas',
    sliders: magneticFieldSliders,
    sim: MagneticFieldSim,
  },
  {
    id: 'gauss-law',
    title: "Gauss's Law",
    subtitle: 'Flux through closed surface',
    type: 'canvas',
    sliders: gaussLawSliders,
    sim: GaussLawSim,
  },
  {
    id: 'custom',
    title: 'Custom Sim',
    subtitle: 'Build your own',
    type: 'canvas',
    sliders: [],
  },
];
