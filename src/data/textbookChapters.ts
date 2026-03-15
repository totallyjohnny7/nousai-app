/**
 * Textbook chapter structures for all courses.
 * Each course's textbook is mapped to CourseTopic[] with subtopics.
 * Used to populate course spaces with comprehensive chapter breakdowns.
 */

import type { CourseTopic } from '../types';

let _tcId = 9000;
function tcUid() { return `tc-${_tcId++}`; }

function topic(name: string, subtopicNames: string[]): CourseTopic {
  return {
    id: tcUid(),
    name,
    status: 'not-started',
    subtopics: subtopicNames.map(s => ({ id: tcUid(), name: s, status: 'not-started' })),
  };
}

/* ================================================================
   BIOL 3020 — The Cell: A Molecular Approach (Cooper & Adams, 9e)
   Source: Oxford Insight / Junction Education platform
   Sections enriched from 8th edition detailed TOC (mapped to 9e chapters)

   8th→9th Edition Mapping:
   8e Ch1  → 9e Ch1  (Introduction to Cells)
   8e Ch2  → 9e Ch2  (Molecules/Membranes merged into Physical Principles)
   8e Ch3  → 9e Ch2  (Bioenergetics merged into Physical Principles)
   8e Ch4  → 9e Ch3  (Fundamentals of Molecular Biology)
   8e Ch5  → 9e Ch9  (Genomics — moved later in 9e)
   8e Ch6  → 9e Ch4  (Genes and Genomes)
   8e Ch7  → 9e Ch5  (Replication, Maintenance)
   8e Ch8  → 9e Ch6  (RNA Synthesis)
   8e Ch9  → 9e Ch8  (Transcriptional Regulation — reordered in 9e)
   8e Ch10 → 9e Ch7  (Protein Synthesis → Translational Control — reordered)
   8e Ch11 → 9e Ch10 (The Nucleus)
   8e Ch12 → 9e Ch11 (Protein Sorting)
   8e Ch13 → 9e Ch12 (Mitochondria, Chloroplasts, Peroxisomes)
   8e Ch14 → 9e Ch13 (Cytoskeleton)
   8e Ch15 → 9e Ch14 (Plasma Membrane)
   8e Ch16 → 9e Ch15 (Cell Walls, ECM)
   8e Ch17 → 9e Ch16 (Cell Signaling)
   8e Ch18 → 9e Ch17 (Cell Cycle)
   8e Ch19 → 9e Ch18 (Cell Renewal, Cell Death)
   8e Ch20 → 9e Ch19 (Cancer)
   ================================================================ */
export const BIOL3020_CHAPTERS: CourseTopic[] = [
  topic('Ch 1: Introduction to Cells and Cell Research', [
    '1.1 The Origin and Evolution of Cells',
    '1.2 Experimental Models in Cell Biology',
    '1.3 Tools of Cell Biology: Microscopy and Subcellular Fractionation',
  ]),
  topic('Ch 2: Physical Principles Underlying Cell Structure and Function', [
    '2.1 Chemical Bonds and Thermodynamics',
    '2.2 Carbohydrates, Lipids, Nucleic Acids, and Proteins',
    '2.3 Enzymes as Biological Catalysts',
    '2.4 Cell Membranes: Lipids, Proteins, and Transport',
    '2.5 Metabolic Energy and ATP',
    '2.6 Glycolysis and Oxidative Phosphorylation',
    '2.7 Photosynthesis',
    '2.8 The Biosynthesis of Cell Constituents',
  ]),
  topic('Ch 3: Fundamentals of Molecular Biology', [
    '3.1 Heredity, Genes, and DNA',
    '3.2 Expression of Genetic Information',
    '3.3 Recombinant DNA',
    '3.4 Detection of Nucleic Acids and Proteins',
    '3.5 Gene Function in Eukaryotes (CRISPR, Gene Transfer, Mutagenesis)',
  ]),
  topic('Ch 4: Genes and Genomes', [
    '4.1 The Structure of Eukaryotic Genes (Introns and Exons)',
    '4.2 Noncoding Sequences (Noncoding RNAs, Repetitive Sequences)',
    '4.3 Chromosomes and Chromatin (Centromeres, Telomeres)',
  ]),
  topic('Ch 5: Replication, Maintenance, and Rearrangements of Genomic DNA', [
    '5.1 DNA Replication (Polymerases, Replication Fork, Fidelity)',
    '5.2 DNA Repair (Direct Reversal, Excision, Double-Strand Break)',
    '5.3 DNA Rearrangements and Gene Amplification (Antibody Genes)',
  ]),
  topic('Ch 6: RNA Synthesis and Processing', [
    '6.1 Transcription in Bacteria (RNA Polymerase, Promoters)',
    '6.2 Eukaryotic RNA Polymerases and General Transcription Factors',
    '6.3 RNA Processing and Turnover (Splicing, Alternative Splicing, Editing)',
  ]),
  topic('Ch 7: Translational Control and Post-Translational Events', [
    '7.1 Translation of mRNA (tRNAs, Ribosomes, Initiation, Regulation)',
    '7.2 Protein Folding and Processing (Chaperones, Misfolding Diseases)',
    '7.3 Regulation of Protein Function and Stability (Phosphorylation, Degradation)',
  ]),
  topic('Ch 8: Transcriptional Regulation and Epigenetics', [
    '8.1 Gene Regulation in E. coli (lac Repressor, Positive Control)',
    '8.2 Transcription Factors in Eukaryotes (Enhancers, Regulatory Proteins)',
    '8.3 Chromatin and Epigenetics (Histone Modifications, DNA Methylation)',
  ]),
  topic('Ch 9: Genomics, Proteomics, and Systems Biology', [
    '9.1 Genomes and Transcriptomes (Bacteria, Yeast, Human)',
    '9.2 Proteomics (Protein Identification, Localization, Interactions)',
    '9.3 Systems Biology (Gene Function Screens, Networks, Synthetic Biology)',
  ]),
  topic('Ch 10: The Nucleus', [
    '10.1 The Nuclear Envelope and Traffic (Nuclear Pore Complex, Import/Export)',
    '10.2 The Organization of Chromatin (Chromosome Territories, Replication Factories)',
    '10.3 Nuclear Bodies (Nucleolus, Polycomb Bodies, Cajal Bodies, Speckles)',
  ]),
  topic('Ch 11: Protein Processing and Sorting', [
    '11.1 The Endoplasmic Reticulum (Signal Hypothesis, Protein Folding, Quality Control)',
    '11.2 The Golgi Apparatus (Glycosylation, Lipid Metabolism, Protein Sorting)',
    '11.3 The Mechanism of Vesicular Transport (Coat Proteins, Vesicle Fusion)',
    '11.4 Lysosomes (Acid Hydrolases, Endocytosis, Autophagy)',
  ]),
  topic('Ch 12: Mitochondria, Chloroplasts, and Peroxisomes', [
    '12.1 Mitochondria (Organization, Genetic System, Protein Import)',
    '12.2 Chloroplasts and Other Plastids (Structure, Genome, Protein Import)',
    '12.3 Peroxisomes (Functions, Assembly)',
  ]),
  topic('Ch 13: The Cytoskeleton and Cell Movement', [
    '13.1 Actin Filaments (Assembly, Organization, Cell Movement)',
    '13.2 Myosin Motors (Muscle Contraction, Nonmuscle Functions)',
    '13.3 Microtubules (Structure, Dynamic Organization, Assembly, MAPs)',
    '13.4 Microtubule Motors and Movement (Kinesin, Dynein, Cilia, Mitosis)',
    '13.5 Intermediate Filaments (Proteins, Assembly, Organization)',
  ]),
  topic('Ch 14: The Plasma Membrane', [
    '14.1 Structure of the Plasma Membrane (Lipid Bilayer, Proteins, Domains)',
    '14.2 Transport of Small Molecules (Facilitated Diffusion, Ion Channels, Active Transport)',
    '14.3 Endocytosis (Phagocytosis, Clathrin-Mediated, Receptor Recycling)',
  ]),
  topic('Ch 15: Cell Walls, the Extracellular Matrix, and Cell Interactions', [
    '15.1 Cell Walls (Bacterial, Eukaryotic)',
    '15.2 The Extracellular Matrix and Cell-Matrix Interactions (Collagen, Integrins)',
    '15.3 Cell-Cell Interactions (Adhesion Junctions, Tight Junctions, Gap Junctions)',
  ]),
  topic('Ch 16: Cell Signaling', [
    '16.1 Signaling Molecules and Their Receptors',
    '16.2 G Proteins and Second Messengers (cAMP, Phospholipase C)',
    '16.3 Tyrosine Kinases (Ras/MAP Kinase, PI 3-Kinase/Akt Pathways)',
    '16.4 Receptors Coupled to Transcription Factors (NF-κB, Notch, Wnt, Hedgehog)',
    '16.5 Signaling Dynamics and Networks (Cross-Talk, Feedback)',
  ]),
  topic('Ch 17: The Cell Cycle', [
    '17.1 The Eukaryotic Cell Cycle (Phases, Checkpoints)',
    '17.2 Regulators of Cell Cycle Progression (Cyclins, Cdks, Rb, p53)',
    '17.3 The Events of M Phase (Mitosis, Cytokinesis, Meiosis)',
  ]),
  topic('Ch 18: Cell Renewal and Cell Death', [
    '18.1 Stem Cells and Maintenance of Adult Tissues',
    '18.2 Pluripotent Stem Cells and Regenerative Medicine (iPS Cells)',
    '18.3 Programmed Cell Death (Apoptosis, Caspases, Bcl-2)',
  ]),
  topic('Ch 19: Cancer', [
    '19.1 The Development and Causes of Cancer (Tumor Types, Carcinogens)',
    '19.2 Oncogenes (Ras, Growth Factors, Transcription Factors)',
    '19.3 Tumor Suppressor Genes (Rb, p53, APC)',
    '19.4 Molecular Approaches to Cancer Treatment (Targeted Therapies, Immunotherapy)',
  ]),
];

/* ================================================================
   PHYS 1120 — College Physics (Physics 2: E&M, Waves, Optics)
   Chapters covering Electricity, Magnetism, Circuits, EM Waves, Optics
   ================================================================ */
export const PHYS1120_CHAPTERS: CourseTopic[] = [
  topic('Ch 18: Electric Charge and Electric Field', [
    '18.1 Static Electricity; Electric Charge and Its Conservation',
    '18.2 Electric Charge in the Atom',
    '18.3 Insulators and Conductors',
    '18.4 Induced Charge; the Electroscope',
    '18.5 Coulomb\'s Law',
    '18.6 The Electric Field',
    '18.7 Electric Field Calculations for Continuous Charge Distributions',
    '18.8 Field Lines',
    '18.9 Electric Fields and Conductors',
  ]),
  topic('Ch 19: Electric Potential', [
    '19.1 Electric Potential Energy and Potential Difference',
    '19.2 Relation between Electric Potential and Electric Field',
    '19.3 Electric Potential Due to Point Charges',
    '19.4 Potential Due to Any Charge Distribution',
    '19.5 Equipotential Surfaces',
    '19.6 Electric Dipole Potential',
  ]),
  topic('Ch 20: Capacitance, Dielectrics, Electric Energy Storage', [
    '20.1 Capacitors',
    '20.2 Determination of Capacitance',
    '20.3 Capacitors in Series and Parallel',
    '20.4 Electric Energy Storage',
    '20.5 Dielectrics',
  ]),
  topic('Ch 21: Electric Current', [
    '21.1 The Electric Battery',
    '21.2 Electric Current',
    '21.3 Ohm\'s Law: Resistance and Resistors',
    '21.4 Resistivity',
    '21.5 Electric Power',
    '21.6 Power in Household Circuits',
    '21.7 Alternating Current',
  ]),
  topic('Ch 22: DC Circuits', [
    '22.1 EMF and Terminal Voltage',
    '22.2 Resistors in Series and Parallel',
    '22.3 Kirchhoff\'s Rules',
    '22.4 RC Circuits',
    '22.5 Electric Hazards',
    '22.6 Ammeters and Voltmeters',
  ]),
  topic('Ch 23: Magnetic Field', [
    '23.1 Magnets and Magnetic Fields',
    '23.2 Electric Currents Produce Magnetic Fields',
    '23.3 Force on an Electric Current in a Magnetic Field',
    '23.4 Force on a Moving Charge in a Magnetic Field (Lorentz Force)',
    '23.5 Torque on a Current Loop; Magnetic Dipole Moment',
    '23.6 Applications: Motors, Speakers, Galvanometers',
  ]),
  topic('Ch 24: Sources of Magnetic Field', [
    '24.1 Biot-Savart Law',
    '24.2 Magnetic Field of a Straight Wire',
    '24.3 Force between Two Parallel Wires',
    '24.4 Ampère\'s Law',
    '24.5 Solenoids and Toroids',
  ]),
  topic('Ch 25: Electromagnetic Induction and Faraday\'s Law', [
    '25.1 Induced EMF',
    '25.2 Faraday\'s Law of Induction; Lenz\'s Law',
    '25.3 EMF Induced in a Moving Conductor',
    '25.4 Changing Magnetic Flux Produces an Electric Field',
    '25.5 Inductance and Self-Inductance',
    '25.6 LR Circuits',
    '25.7 Energy Stored in a Magnetic Field',
  ]),
  topic('Ch 26: AC Circuits', [
    '26.1 AC Circuits with Resistance Only',
    '26.2 AC Circuits with Inductance Only',
    '26.3 AC Circuits with Capacitance Only',
    '26.4 LRC Series AC Circuit',
    '26.5 Resonance in AC Circuits',
    '26.6 Impedance Matching',
  ]),
  topic('Ch 27: Electromagnetic Waves', [
    '27.1 Maxwell\'s Equations',
    '27.2 Production of Electromagnetic Waves',
    '27.3 The Electromagnetic Spectrum',
    '27.4 Energy in EM Waves; the Poynting Vector',
    '27.5 Radiation Pressure',
  ]),
  topic('Ch 28: Light: Reflection and Refraction', [
    '28.1 The Ray Model of Light',
    '28.2 Reflection; Image Formation by a Plane Mirror',
    '28.3 Formation of Images by Spherical Mirrors',
    '28.4 Index of Refraction',
    '28.5 Snell\'s Law (Refraction)',
    '28.6 Total Internal Reflection',
  ]),
  topic('Ch 29: Lenses and Optical Instruments', [
    '29.1 Thin Lenses; Ray Tracing',
    '29.2 The Thin Lens Equation; Magnification',
    '29.3 Combinations of Lenses',
    '29.4 The Human Eye and Corrective Lenses',
    '29.5 Magnifying Glass',
    '29.6 Telescopes and Microscopes',
  ]),
  topic('Ch 30: Wave Nature of Light; Interference', [
    '30.1 Waves versus Particles; Huygens\' Principle',
    '30.2 Young\'s Double-Slit Experiment',
    '30.3 Thin-Film Interference',
    '30.4 Michelson Interferometer',
  ]),
  topic('Ch 31: Diffraction and Polarization', [
    '31.1 Diffraction by a Single Slit',
    '31.2 Diffraction Grating',
    '31.3 Resolving Power and the Rayleigh Criterion',
    '31.4 Polarization',
  ]),
];

/* ================================================================
   BIOL 4230 — Evolution: Making Sense of Life (Zimmer & Emlen, 2e)
   Corrected from study guide — 18 chapters
   ================================================================ */
export const BIOL4230_CHAPTERS: CourseTopic[] = [
  topic('Ch 1: The Whale and the Virus — How Scientists Study Evolution', [
    '1.1 Whales: Mammals Gone to Sea',
    '1.2 Viruses: The Deadly Escape Artists',
  ]),
  topic('Ch 2: From Natural Philosophy to Darwin — A Brief History of Evolutionary Ideas', [
    '2.1 Nature before Darwin',
    '2.2 Evolution before Darwin',
    '2.3 The Unofficial Naturalist',
  ]),
  topic('Ch 3: What the Rocks Say — How Geology and Paleontology Reveal the History of Life', [
    '3.1 The Great Age-of-the-Earth Debate',
    '3.2 A Curious Lack of Radioactivity',
    '3.3 A Vast Museum',
  ]),
  topic('Ch 4: The Tree of Life — How Biologists Use Phylogeny to Reconstruct the Deep Past', [
    '4.1 Tree Thinking',
    '4.2 Phylogeny and Taxonomy',
    '4.3 Reconstructing Phylogenies',
    '4.4 Fossils, Phylogeny, and the Timing of Evolution',
    '4.5 Testing Hypotheses with Phylogenies: From Sea to Land',
    '4.6 Homology as a Window into Evolutionary History',
  ]),
  topic('Ch 5: Raw Material — Heritable Variation Among Individuals', [
    '5.1 Evolution\'s Molecules: Proteins, DNA, and RNA',
    '5.2 Mutations: Creating Variation',
    '5.3 Heredity',
    '5.4 The Complex Link between Most Phenotypes and Genotypes',
    '5.5 How Do Genes Respond to the Environment?',
  ]),
  topic('Ch 6: The Ways of Change — Drift and Selection', [
    '6.1 The Genetics of Populations',
    '6.2 Change over Time — or Not',
    '6.3 Evolution\'s "Null Hypothesis"',
    '6.4 A Random Sample',
    '6.5 Bottlenecks and Founder Effects',
    '6.6 Selection: Winning and Losing',
    '6.7 Inbreeding: The Collapse of a Dynasty',
    '6.8 Landscape Genetics',
  ]),
  topic('Ch 7: Beyond Alleles — Quantitative Genetics and the Evolution of Phenotypes', [
    '7.1 Genetics of Quantitative Traits',
    '7.2 The Evolutionary Response to Selection',
    '7.3 Dissecting Complex Traits: Quantitative Trait Locus Analysis',
    '7.4 The Evolution of Phenotypic Plasticity',
  ]),
  topic('Ch 8: Natural Selection — Empirical Studies in the Wild', [
    '8.1 Evolution in a Bird\'s Beak',
    '8.2 Mice in Black and White',
    '8.3 The Geography of Fitness',
    '8.4 Predators versus Parasitoids',
    '8.5 Replicated Natural Experiments',
    '8.6 Drinking Milk: A Fingerprint of Natural Selection',
    '8.7 Humans as Agents of Selection',
  ]),
  topic('Ch 9: The History in Our Genes', [
    '9.1 Coalescing Genes',
    '9.2 Gene Trees and Species Trees',
    '9.3 Methods of Molecular Phylogenetics',
    '9.4 Four Case Studies in Molecular Phylogeny',
    '9.5 Natural Selection versus Neutral Evolution',
    '9.6 Detecting Genes',
    '9.7 Genome Evolution',
  ]),
  topic('Ch 10: Adaptation — From Genes to Traits', [
    '10.1 Cascades of Genes',
    '10.2 Generating Innovations',
    '10.3 The Origin of New Adaptations in Microbes',
    '10.4 The History of Venom: Evolving Gene Networks',
    '10.5 The Genetic Toolkit for Development',
    '10.6 The Deep History of Limbs',
    '10.7 Sculpting Adaptations',
    '10.8 Evolving Eyes',
    '10.9 Constraining Evolution',
    '10.10 Building on History: Imperfections in Complex Adaptations',
    '10.11 Convergent Evolution',
  ]),
  topic('Ch 11: Sex — Causes and Consequences', [
    '11.1 Evolution of Sex',
    '11.2 Sexual Selection',
    '11.3 The Rules of Attraction',
    '11.4 The Evolution of Mating Systems',
    '11.5 The Hidden Dimension of Sexual Selection',
    '11.6 Sexual Conflict and Antagonistic Coevolution',
  ]),
  topic('Ch 12: After Conception — The Evolution of Life History and Parental Care', [
    '12.1 Selection across a Lifetime',
    '12.2 Parental Investment',
    '12.3 Family Conflicts',
    '12.4 Conflicts within the Genome',
    '12.5 Searching for Immortality Genes',
    '12.6 Menopause: Why Do Women Stop Having Children?',
  ]),
  topic('Ch 13: The Origin of Species', [
    '13.1 What Is a Species?',
    '13.2 Barriers to Gene Flow: Keeping Species Apart',
    '13.3 Models of Speciation',
    '13.4 Testing Speciation Models',
    '13.5 The Speed of Speciation',
    '13.6 Uncovering Hidden Species',
    '13.7 The Puzzle of Microbial "Species"',
  ]),
  topic('Ch 14: Macroevolution — The Long Run', [
    '14.1 Biogeography: Mapping Macroevolution',
    '14.2 The Drivers of Macroevolution: Speciation and Extinction',
    '14.3 The Drivers of Macroevolution: Adaptation',
    '14.4 The Drivers of Macroevolution: Changing Environments',
    '14.5 Adaptive Radiations',
    '14.6 The Cambrian Explosion',
    '14.7 Extinctions: From Background Noise to Mass Die-Offs',
    '14.8 The "Big Five" Mass Extinctions',
    '14.9 Macroevolution and Our "Sixth Mass Extinction"',
  ]),
  topic('Ch 15: Intimate Partnerships — How Species Adapt to Each Other', [
    '15.1 The Web of Life',
    '15.2 Variation and Populations: The Building Blocks of Coevolution',
    '15.3 Coevolution as an Engine of Biodiversity',
    '15.4 Endosymbiosis: How Two Species Become One',
    '15.5 Invasion of the Genomic Parasites',
  ]),
  topic('Ch 16: Brains and Behavior', [
    '16.1 Behavior Evolves',
    '16.2 Behavior without a Brain',
    '16.3 Behavior and the Origin of Nervous Systems',
    '16.4 Innate and Learned Behaviors',
    '16.5 The Vertebrate Brain',
    '16.6 Individuals, Groups, and the Evolution of Social Behavior',
    '16.7 Playing the Evolution Game',
    '16.8 Why Be Social?',
    '16.9 The Importance of Kin',
    '16.10 Creativity in the Animal Kingdom',
  ]),
  topic('Ch 17: Human Evolution — A New Kind of Ape', [
    '17.1 Discovering Our Primate Origins',
    '17.2 Primate Evolution: Molecular and Fossil Evidence',
    '17.3 Making Sense of Hominin Evolution',
    '17.4 Walking into a New Kind of Life',
    '17.5 A Changing Environment',
    '17.6 Staying Alive on the Savanna',
    '17.7 The Toolmakers',
    '17.8 The Emergence of Homo',
    '17.9 Parallel Humans',
    '17.10 New Discoveries from Ancient Genes',
    '17.11 Evolving a Human Brain',
    '17.12 The Language Instinct',
    '17.13 Bottlenecks in the Origin of Modern Humans',
    '17.14 Recent Natural Selection',
    '17.15 Emotions and Other Evolutionary Legacies',
  ]),
  topic('Ch 18: Evolutionary Medicine', [
    '18.1 Maladaptation and Medicine',
    '18.2 Evolving Pathogens',
    '18.3 Defeating Antibiotics',
    '18.4 The Origin of New Diseases',
    '18.5 Ever-Evolving Flu',
    '18.6 Molded by Pathogens',
    '18.7 Human Variation and Medicine',
    '18.8 Old Age and Cancer: Evolution\'s Tradeoffs',
    '18.9 The Natural Selection of Cancer',
    '18.10 Mismatched with Modern Life',
    '18.11 Evolutionary Medicine: Limits and Clues',
  ]),
];

/* ================================================================
   JAPN 1110 — Nakama 1 (Japanese Communication, Culture, Context)
   ================================================================ */
export const JAPN1110_CHAPTERS: CourseTopic[] = [
  topic('Ch 0: Getting Started — Japanese Writing Systems', [
    '0.1 Hiragana',
    '0.2 Katakana',
    '0.3 Introduction to Kanji',
    '0.4 Writing Practice',
  ]),
  topic('Ch 1: The Sound System of Japanese and Greetings', [
    '1.1 Greetings and Introductions (あいさつ)',
    '1.2 Japanese Pronunciation',
    '1.3 Self-Introduction (自己紹介)',
    '1.4 Classroom Expressions',
  ]),
  topic('Ch 2: Everyday Life — Describing Your Daily Routine', [
    '2.1 Telling Time (時間)',
    '2.2 Daily Activities (毎日の生活)',
    '2.3 Particles は, が, を, に, で',
    '2.4 Verb Conjugation: ます Form',
  ]),
  topic('Ch 3: My Town — Talking About Places and Locations', [
    '3.1 Location Words (ここ, そこ, あそこ)',
    '3.2 Existence Verbs (います, あります)',
    '3.3 Describing Your Town',
    '3.4 Giving Directions (道案内)',
  ]),
  topic('Ch 4: Japanese Cities — Getting Around and Transportation', [
    '4.1 Transportation Vocabulary (交通)',
    '4.2 Past Tense (ました / ませんでした)',
    '4.3 Particles から, まで, で',
    '4.4 Time Expressions',
  ]),
  topic('Ch 5: My Home — Describing Houses and Rooms', [
    '5.1 House and Room Vocabulary (家と部屋)',
    '5.2 Adjectives (い-adjectives and な-adjectives)',
    '5.3 Describing Rooms and Furniture',
    '5.4 Counters (つ, 階)',
  ]),
  topic('Ch 6: Leisure Activities — Hobbies and Interests', [
    '6.1 Hobbies Vocabulary (趣味)',
    '6.2 て-Form (て形)',
    '6.3 Making Requests and Giving Permission',
    '6.4 Describing Ongoing Actions (ています)',
  ]),
  topic('Ch 7: My Favorite Foods — Food and Dining', [
    '7.1 Food Vocabulary (食べ物)',
    '7.2 Ordering at a Restaurant (レストラン)',
    '7.3 Counters for Food and Drink',
    '7.4 Expressing Likes and Dislikes (好き / 嫌い)',
  ]),
  topic('Ch 8: Shopping — Buying Things', [
    '8.1 Shopping Vocabulary (買い物)',
    '8.2 Numbers and Prices (値段)',
    '8.3 Comparisons (より, ほう, 一番)',
    '8.4 Colors and Descriptions',
  ]),
  topic('Ch 9: Clothes and Fashion', [
    '9.1 Clothing Vocabulary (服)',
    '9.2 Describing What People Are Wearing',
    '9.3 Giving Advice (たほうがいい)',
    '9.4 Expressing Desire (ほしい / たい)',
  ]),
  topic('Ch 10: Health and the Body', [
    '10.1 Body Parts Vocabulary (体)',
    '10.2 Describing Symptoms (症状)',
    '10.3 Giving and Receiving (あげる / もらう / くれる)',
    '10.4 Expressing Obligation (なければなりません)',
  ]),
  topic('Ch 11: Seasons and Weather', [
    '11.1 Weather Vocabulary (天気)',
    '11.2 Seasons of Japan (季節)',
    '11.3 Conditional Expressions (たら / ば)',
    '11.4 Planning Activities by Season',
  ]),
  topic('Ch 12: Annual Events and Culture', [
    '12.1 Japanese Holidays and Festivals (祭り)',
    '12.2 Describing Past Experiences (ことがある)',
    '12.3 Giving Reasons (から / ので)',
    '12.4 Cultural Practices and Etiquette',
  ]),
];

/** Helper to get textbook chapters for a course ID */
export function getTextbookChapters(courseId: string): CourseTopic[] | null {
  const id = courseId.toUpperCase();
  if (id.includes('BIOL') && id.includes('3020')) return BIOL3020_CHAPTERS;
  if (id.includes('PHYS') && id.includes('1120')) return PHYS1120_CHAPTERS;
  if (id.includes('BIOL') && id.includes('4230')) return BIOL4230_CHAPTERS;
  if (id.includes('JAPN') && id.includes('1110')) return JAPN1110_CHAPTERS;
  return null;
}
