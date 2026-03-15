/**
 * Cell Biology Study Content — BIOL 3020
 * The Cell: A Molecular Approach, Cooper & Adams
 * Key terms mapped from 8th edition to 9th edition chapter structure
 *
 * 8th→9th Edition Chapter Mapping:
 * 8e Ch1  → 9e Ch1  | 8e Ch2+3 → 9e Ch2  | 8e Ch4  → 9e Ch3
 * 8e Ch6  → 9e Ch4  | 8e Ch7   → 9e Ch5  | 8e Ch8  → 9e Ch6
 * 8e Ch10 → 9e Ch7  | 8e Ch9   → 9e Ch8  | 8e Ch5  → 9e Ch9
 * 8e Ch11 → 9e Ch10 | 8e Ch12  → 9e Ch11 | 8e Ch13 → 9e Ch12
 * 8e Ch14 → 9e Ch13 | 8e Ch15  → 9e Ch14 | 8e Ch16 → 9e Ch15
 * 8e Ch17 → 9e Ch16 | 8e Ch18  → 9e Ch17 | 8e Ch19 → 9e Ch18
 * 8e Ch20 → 9e Ch19
 */

export interface KeyTerm {
  term: string;
  category?: 'structure' | 'process' | 'molecule' | 'technique' | 'concept' | 'organism' | 'disease';
}

export interface ChapterStudyContent {
  chapter9e: number;
  title: string;
  chapter8e: number[];  // which 8e chapters map here
  keyTerms: KeyTerm[];
  keyConcepts: string[];
  keyExperiments: string[];
}

export const BIOL3020_STUDY_CONTENT: ChapterStudyContent[] = [
  // ═══════════════════════════════════════════════════════════════
  // Ch 1 (9e) ← Ch 1 (8e): Introduction to Cells and Cell Research
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 1,
    title: 'Introduction to Cells and Cell Research',
    chapter8e: [1],
    keyTerms: [
      { term: 'RNA world', category: 'concept' },
      { term: 'Genes', category: 'concept' },
      { term: 'Transcription', category: 'process' },
      { term: 'Translation', category: 'process' },
      { term: 'Phospholipids', category: 'molecule' },
      { term: 'Amphipathic', category: 'concept' },
      { term: 'ATP (adenosine 5\'-triphosphate)', category: 'molecule' },
      { term: 'Glycolysis', category: 'process' },
      { term: 'Photosynthesis', category: 'process' },
      { term: 'Oxidative metabolism', category: 'process' },
      { term: 'Prokaryotes', category: 'organism' },
      { term: 'Archaea', category: 'organism' },
      { term: 'Bacteria', category: 'organism' },
      { term: 'Cyanobacteria', category: 'organism' },
      { term: 'Eukaryotic cells', category: 'structure' },
      { term: 'Nucleus', category: 'structure' },
      { term: 'Mitochondria', category: 'structure' },
      { term: 'Chloroplasts', category: 'structure' },
      { term: 'Endoplasmic reticulum (ER)', category: 'structure' },
      { term: 'Golgi apparatus', category: 'structure' },
      { term: 'Lysosomes', category: 'structure' },
      { term: 'Peroxisomes', category: 'structure' },
      { term: 'Cytoskeleton', category: 'structure' },
      { term: 'Endosymbiosis', category: 'concept' },
      { term: 'Saccharomyces cerevisiae', category: 'organism' },
      { term: 'Caenorhabditis elegans', category: 'organism' },
      { term: 'Drosophila melanogaster', category: 'organism' },
      { term: 'Arabidopsis thaliana', category: 'organism' },
      { term: 'Embryonic stem (ES) cells', category: 'structure' },
      { term: 'Primary cultures', category: 'technique' },
      { term: 'Cell lines', category: 'technique' },
      { term: 'Bright-field microscopy', category: 'technique' },
      { term: 'Phase-contrast microscopy', category: 'technique' },
      { term: 'Fluorescence microscopy', category: 'technique' },
      { term: 'Green fluorescent protein (GFP)', category: 'molecule' },
      { term: 'FRAP (fluorescence recovery after photobleaching)', category: 'technique' },
      { term: 'FRET (fluorescence resonance energy transfer)', category: 'technique' },
      { term: 'Confocal microscopy', category: 'technique' },
      { term: 'Super-resolution microscopy', category: 'technique' },
      { term: 'Electron microscopy', category: 'technique' },
      { term: 'Subcellular fractionation', category: 'technique' },
      { term: 'Differential centrifugation', category: 'technique' },
      { term: 'Density-gradient centrifugation', category: 'technique' },
    ],
    keyConcepts: [
      'RNA World hypothesis',
      'Endosymbiotic theory of mitochondria and chloroplasts',
      'Central Dogma: DNA → RNA → Protein',
      'Prokaryote vs eukaryote cell organization',
      'Evolution of multicellularity',
      'Model organisms in cell biology',
    ],
    keyExperiments: [
      'HeLa Cells: The First Human Cell Line',
      'Viruses and Cancer (molecular medicine)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 2 (9e) ← Ch 2+3 (8e): Physical Principles
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 2,
    title: 'Physical Principles Underlying Cell Structure and Function',
    chapter8e: [2, 3],
    keyTerms: [
      // From 8e Ch 2: Molecules and Membranes
      { term: 'Covalent bonds', category: 'concept' },
      { term: 'Ionic bonds', category: 'concept' },
      { term: 'Hydrogen bonds', category: 'concept' },
      { term: 'Hydrophobic interactions', category: 'concept' },
      { term: 'Van der Waals interactions', category: 'concept' },
      { term: 'Carbohydrates', category: 'molecule' },
      { term: 'Monosaccharides', category: 'molecule' },
      { term: 'Polysaccharides (glycogen, starch, cellulose)', category: 'molecule' },
      { term: 'Fatty acids', category: 'molecule' },
      { term: 'Triacylglycerols', category: 'molecule' },
      { term: 'Phospholipids', category: 'molecule' },
      { term: 'Cholesterol', category: 'molecule' },
      { term: 'Nucleotides', category: 'molecule' },
      { term: 'Amino acids', category: 'molecule' },
      { term: 'Peptide bonds', category: 'concept' },
      { term: 'Primary structure', category: 'concept' },
      { term: 'Secondary structure (α helix, β sheet)', category: 'concept' },
      { term: 'Tertiary structure', category: 'concept' },
      { term: 'Quaternary structure', category: 'concept' },
      { term: 'Enzymes', category: 'molecule' },
      { term: 'Active site', category: 'structure' },
      { term: 'Induced fit', category: 'concept' },
      { term: 'Coenzymes (NAD⁺/NADH)', category: 'molecule' },
      { term: 'Feedback inhibition', category: 'process' },
      { term: 'Allosteric regulation', category: 'process' },
      { term: 'Phospholipid bilayer', category: 'structure' },
      { term: 'Fluid mosaic model', category: 'concept' },
      { term: 'Integral membrane proteins', category: 'molecule' },
      { term: 'Peripheral membrane proteins', category: 'molecule' },
      { term: 'Channel proteins', category: 'molecule' },
      { term: 'Carrier proteins', category: 'molecule' },
      { term: 'Passive transport', category: 'process' },
      { term: 'Active transport', category: 'process' },
      // From 8e Ch 3: Bioenergetics and Metabolism
      { term: 'Entropy', category: 'concept' },
      { term: 'Enthalpy', category: 'concept' },
      { term: 'Gibbs free energy (ΔG)', category: 'concept' },
      { term: 'Glycolysis', category: 'process' },
      { term: 'Citric acid cycle (Krebs cycle)', category: 'process' },
      { term: 'Electron transport chain', category: 'process' },
      { term: 'Oxidative phosphorylation', category: 'process' },
      { term: 'Chemiosmotic coupling', category: 'concept' },
      { term: 'ATP synthase', category: 'molecule' },
      { term: 'Photosystems I and II', category: 'structure' },
      { term: 'Calvin cycle', category: 'process' },
      { term: 'Gluconeogenesis', category: 'process' },
      { term: 'Catabolism', category: 'process' },
      { term: 'Anabolism', category: 'process' },
    ],
    keyConcepts: [
      'Laws of thermodynamics and free energy',
      'Protein folding hierarchy (1°, 2°, 3°, 4°)',
      'Enzyme kinetics and regulation',
      'Fluid mosaic model of membranes',
      'Chemiosmotic theory (Peter Mitchell)',
      'Glycolysis → Krebs → ETC energy flow',
      'Photosynthesis light and dark reactions',
    ],
    keyExperiments: [
      'The Folding of Polypeptide Chains',
      'The Structure of Cell Membranes',
      'The Chemiosmotic Theory',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 3 (9e) ← Ch 4 (8e): Fundamentals of Molecular Biology
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 3,
    title: 'Fundamentals of Molecular Biology',
    chapter8e: [4],
    keyTerms: [
      { term: 'Genes', category: 'concept' },
      { term: 'Allele', category: 'concept' },
      { term: 'Genotype', category: 'concept' },
      { term: 'Phenotype', category: 'concept' },
      { term: 'Chromosomes', category: 'structure' },
      { term: 'Diploid / Haploid', category: 'concept' },
      { term: 'Meiosis', category: 'process' },
      { term: 'Transformation', category: 'technique' },
      { term: 'Semiconservative replication', category: 'concept' },
      { term: 'Messenger RNA (mRNA)', category: 'molecule' },
      { term: 'Genetic code (codons)', category: 'concept' },
      { term: 'Reverse transcription', category: 'process' },
      { term: 'Restriction endonucleases', category: 'molecule' },
      { term: 'Recombinant DNA', category: 'technique' },
      { term: 'DNA sequencing', category: 'technique' },
      { term: 'Polymerase chain reaction (PCR)', category: 'technique' },
      { term: 'Nucleic acid hybridization', category: 'technique' },
      { term: 'Antibodies as probes', category: 'technique' },
      { term: 'Gene transfer (transfection)', category: 'technique' },
      { term: 'Site-directed mutagenesis', category: 'technique' },
      { term: 'CRISPR/Cas system', category: 'technique' },
      { term: 'RNA interference (RNAi)', category: 'technique' },
      { term: 'Expression vectors', category: 'technique' },
    ],
    keyConcepts: [
      'Chromosomal basis of heredity',
      'DNA as the genetic material',
      'Watson-Crick base pairing',
      'Central dogma: DNA → RNA → Protein',
      'Recombinant DNA technology revolution',
      'CRISPR/Cas9 genome engineering',
    ],
    keyExperiments: [
      'DNA Provirus Hypothesis',
      'RNA Interference discovery',
      'Avery-MacLeod-McCarty: DNA is genetic material',
      'Meselson-Stahl: Semiconservative replication',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 4 (9e) ← Ch 6 (8e): Genes and Genomes
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 4,
    title: 'Genes and Genomes',
    chapter8e: [6],
    keyTerms: [
      { term: 'Introns', category: 'structure' },
      { term: 'Exons', category: 'structure' },
      { term: 'Noncoding RNAs', category: 'molecule' },
      { term: 'ENCODE Project', category: 'concept' },
      { term: 'Repetitive sequences', category: 'structure' },
      { term: 'Gene duplication', category: 'process' },
      { term: 'Pseudogenes', category: 'structure' },
      { term: 'Chromatin', category: 'structure' },
      { term: 'Nucleosomes', category: 'structure' },
      { term: 'Histones', category: 'molecule' },
      { term: 'Centromeres', category: 'structure' },
      { term: 'Telomeres', category: 'structure' },
      { term: 'Heterochromatin', category: 'structure' },
      { term: 'Euchromatin', category: 'structure' },
    ],
    keyConcepts: [
      'Split genes: introns and exons',
      'Noncoding sequences comprise majority of genome',
      'Chromatin organization and compaction',
      'Centromere and telomere function',
    ],
    keyExperiments: [
      'The Discovery of Introns',
      'The ENCODE Project',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 5 (9e) ← Ch 7 (8e): DNA Replication, Repair, Rearrangements
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 5,
    title: 'Replication, Maintenance, and Rearrangements of Genomic DNA',
    chapter8e: [7],
    keyTerms: [
      { term: 'DNA polymerases', category: 'molecule' },
      { term: 'Replication fork', category: 'structure' },
      { term: 'Leading strand / Lagging strand', category: 'concept' },
      { term: 'Okazaki fragments', category: 'structure' },
      { term: 'DNA ligase', category: 'molecule' },
      { term: 'Helicase', category: 'molecule' },
      { term: 'Primase', category: 'molecule' },
      { term: 'Proofreading', category: 'process' },
      { term: 'Origins of replication', category: 'structure' },
      { term: 'Telomerase', category: 'molecule' },
      { term: 'Direct reversal of DNA damage', category: 'process' },
      { term: 'Base excision repair', category: 'process' },
      { term: 'Nucleotide excision repair', category: 'process' },
      { term: 'Mismatch repair', category: 'process' },
      { term: 'Double-strand break repair', category: 'process' },
      { term: 'Homologous recombination', category: 'process' },
      { term: 'Nonhomologous end joining', category: 'process' },
      { term: 'Translesion DNA synthesis', category: 'process' },
      { term: 'V(D)J recombination', category: 'process' },
      { term: 'Gene amplification', category: 'process' },
    ],
    keyConcepts: [
      'Semiconservative DNA replication mechanism',
      'Fidelity of replication (proofreading + mismatch repair)',
      'Telomere maintenance by telomerase',
      'Multiple DNA repair pathways',
      'Antibody gene rearrangement',
    ],
    keyExperiments: [
      'Telomerase Is a Reverse Transcriptase',
      'Colon Cancer and DNA Repair (molecular medicine)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 6 (9e) ← Ch 8 (8e): RNA Synthesis and Processing
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 6,
    title: 'RNA Synthesis and Processing',
    chapter8e: [8],
    keyTerms: [
      { term: 'RNA polymerase', category: 'molecule' },
      { term: 'Promoter', category: 'structure' },
      { term: 'Sigma factor', category: 'molecule' },
      { term: 'Termination signals', category: 'structure' },
      { term: 'RNA polymerase I, II, III', category: 'molecule' },
      { term: 'General transcription factors (TFIIA-H)', category: 'molecule' },
      { term: 'TATA box', category: 'structure' },
      { term: 'Pre-mRNA processing', category: 'process' },
      { term: '5\' cap', category: 'structure' },
      { term: '3\' polyadenylation', category: 'process' },
      { term: 'Splicing', category: 'process' },
      { term: 'Spliceosome', category: 'structure' },
      { term: 'snRNPs', category: 'molecule' },
      { term: 'Alternative splicing', category: 'process' },
      { term: 'RNA editing', category: 'process' },
      { term: 'RNA degradation', category: 'process' },
      { term: 'Self-splicing introns (ribozymes)', category: 'molecule' },
    ],
    keyConcepts: [
      'Bacterial vs eukaryotic transcription',
      'Three eukaryotic RNA polymerases and their roles',
      'Pre-mRNA processing: capping, splicing, polyadenylation',
      'Spliceosome mechanism',
      'Alternative splicing increases protein diversity',
    ],
    keyExperiments: [
      'The Discovery of snRNPs',
      'Splicing Therapy for Duchenne Muscular Dystrophy',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 7 (9e) ← Ch 10 (8e): Translational Control
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 7,
    title: 'Translational Control and Post-Translational Events',
    chapter8e: [10],
    keyTerms: [
      { term: 'Transfer RNAs (tRNAs)', category: 'molecule' },
      { term: 'Aminoacyl-tRNA synthetases', category: 'molecule' },
      { term: 'Ribosome (40S, 60S)', category: 'structure' },
      { term: 'Kozak sequence', category: 'structure' },
      { term: 'Start codon (AUG)', category: 'concept' },
      { term: 'Initiation factors (eIF)', category: 'molecule' },
      { term: 'Elongation factors', category: 'molecule' },
      { term: 'Translational regulation', category: 'process' },
      { term: 'Chaperones', category: 'molecule' },
      { term: 'Protein misfolding diseases', category: 'disease' },
      { term: 'Protein phosphorylation', category: 'process' },
      { term: 'Tyrosine kinases', category: 'molecule' },
      { term: 'Ubiquitin', category: 'molecule' },
      { term: 'Proteasome', category: 'structure' },
      { term: 'Glycosylation', category: 'process' },
      { term: 'Protein cleavage', category: 'process' },
    ],
    keyConcepts: [
      'Translation mechanism: initiation, elongation, termination',
      'Regulation of translation initiation',
      'Protein folding by chaperones',
      'Post-translational modifications',
      'Ubiquitin-proteasome degradation pathway',
    ],
    keyExperiments: [
      'The Discovery of Tyrosine Kinases',
      'Alzheimer\'s Disease (molecular medicine)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 8 (9e) ← Ch 9 (8e): Transcriptional Regulation and Epigenetics
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 8,
    title: 'Transcriptional Regulation and Epigenetics',
    chapter8e: [9],
    keyTerms: [
      { term: 'lac repressor', category: 'molecule' },
      { term: 'Operon', category: 'structure' },
      { term: 'Positive control of transcription', category: 'process' },
      { term: 'Enhancers', category: 'structure' },
      { term: 'Silencers', category: 'structure' },
      { term: 'Transcription factor binding sites', category: 'structure' },
      { term: 'Zinc finger domains', category: 'structure' },
      { term: 'Leucine zipper', category: 'structure' },
      { term: 'Helix-turn-helix', category: 'structure' },
      { term: 'Mediator complex', category: 'molecule' },
      { term: 'Histone modifications', category: 'process' },
      { term: 'Histone acetylation', category: 'process' },
      { term: 'Histone methylation', category: 'process' },
      { term: 'Chromatin remodeling', category: 'process' },
      { term: 'DNA methylation', category: 'process' },
      { term: 'Epigenetic inheritance', category: 'concept' },
      { term: 'CpG islands', category: 'structure' },
      { term: 'Noncoding RNAs in regulation', category: 'molecule' },
    ],
    keyConcepts: [
      'lac operon: negative and positive control',
      'Eukaryotic enhancers and transcription factors',
      'DNA-binding domain families',
      'Histone code hypothesis',
      'Epigenetic mechanisms: DNA methylation, histone modification',
      'Chromatin remodeling and gene expression',
    ],
    keyExperiments: [
      'Isolation of a Eukaryotic Transcription Factor',
      'The Role of Histone Modification',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 9 (9e) ← Ch 5 (8e): Genomics, Proteomics, Systems Biology
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 9,
    title: 'Genomics, Proteomics, and Systems Biology',
    chapter8e: [5],
    keyTerms: [
      { term: 'Genome', category: 'concept' },
      { term: 'Transcriptome', category: 'concept' },
      { term: 'Proteome', category: 'concept' },
      { term: 'Next-generation sequencing', category: 'technique' },
      { term: 'Microarrays', category: 'technique' },
      { term: 'RNA-Seq', category: 'technique' },
      { term: 'Mass spectrometry', category: 'technique' },
      { term: 'Two-dimensional gel electrophoresis', category: 'technique' },
      { term: 'Yeast two-hybrid system', category: 'technique' },
      { term: 'Protein interaction networks', category: 'concept' },
      { term: 'Systems biology', category: 'concept' },
      { term: 'Synthetic biology', category: 'concept' },
      { term: 'Gene regulatory networks', category: 'concept' },
    ],
    keyConcepts: [
      'Human Genome Project and personal genomes',
      'Global analysis of gene expression',
      'Proteomics: identifying all cell proteins',
      'Biological networks and systems approaches',
      'Synthetic biology applications',
    ],
    keyExperiments: [
      'The Human Genome Project',
      'Malaria and Synthetic Biology',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 10 (9e) ← Ch 11 (8e): The Nucleus
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 10,
    title: 'The Nucleus',
    chapter8e: [11],
    keyTerms: [
      { term: 'Nuclear envelope', category: 'structure' },
      { term: 'Nuclear lamina', category: 'structure' },
      { term: 'Nuclear pore complex (NPC)', category: 'structure' },
      { term: 'Nuclear localization signal (NLS)', category: 'concept' },
      { term: 'Importins / Exportins', category: 'molecule' },
      { term: 'Ran GTPase', category: 'molecule' },
      { term: 'Chromosome territories', category: 'concept' },
      { term: 'Nucleolus', category: 'structure' },
      { term: 'Cajal bodies', category: 'structure' },
      { term: 'Nuclear speckles', category: 'structure' },
      { term: 'Polycomb bodies', category: 'structure' },
      { term: 'Lamin A/C', category: 'molecule' },
    ],
    keyConcepts: [
      'Nuclear envelope structure and function',
      'Nuclear pore complex and selective transport',
      'Ran GTPase cycle drives nuclear transport',
      'Chromosome organization in the nucleus',
      'Nuclear bodies and their functions',
    ],
    keyExperiments: [
      'Identification of Nuclear Localization Signals',
      'Nuclear Lamina Diseases (molecular medicine)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 11 (9e) ← Ch 12 (8e): Protein Processing and Sorting
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 11,
    title: 'Protein Processing and Sorting',
    chapter8e: [12],
    keyTerms: [
      { term: 'Signal sequence (signal peptide)', category: 'concept' },
      { term: 'Signal recognition particle (SRP)', category: 'molecule' },
      { term: 'Translocon (Sec61)', category: 'structure' },
      { term: 'Rough ER', category: 'structure' },
      { term: 'Smooth ER', category: 'structure' },
      { term: 'Glycosylation in ER', category: 'process' },
      { term: 'ER quality control', category: 'process' },
      { term: 'Unfolded protein response (UPR)', category: 'process' },
      { term: 'COPII vesicles', category: 'structure' },
      { term: 'COPI vesicles', category: 'structure' },
      { term: 'cis-Golgi / trans-Golgi', category: 'structure' },
      { term: 'Clathrin-coated vesicles', category: 'structure' },
      { term: 'SNARE proteins', category: 'molecule' },
      { term: 'Rab GTPases', category: 'molecule' },
      { term: 'Lysosomes', category: 'structure' },
      { term: 'Mannose-6-phosphate', category: 'molecule' },
      { term: 'Autophagy', category: 'process' },
      { term: 'Endocytosis', category: 'process' },
    ],
    keyConcepts: [
      'Signal hypothesis for protein targeting',
      'Co-translational insertion into ER',
      'Vesicular transport between compartments',
      'SNARE-mediated vesicle fusion',
      'Lysosome biogenesis and function',
      'Autophagy: cellular self-eating',
    ],
    keyExperiments: [
      'The Signal Hypothesis',
      'Gaucher Disease (molecular medicine)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 12 (9e) ← Ch 13 (8e): Mitochondria, Chloroplasts, Peroxisomes
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 12,
    title: 'Mitochondria, Chloroplasts, and Peroxisomes',
    chapter8e: [13],
    keyTerms: [
      { term: 'Outer mitochondrial membrane', category: 'structure' },
      { term: 'Inner mitochondrial membrane', category: 'structure' },
      { term: 'Cristae', category: 'structure' },
      { term: 'Matrix', category: 'structure' },
      { term: 'Mitochondrial DNA (mtDNA)', category: 'molecule' },
      { term: 'TOM / TIM complexes', category: 'molecule' },
      { term: 'Mitochondrial transit peptide', category: 'concept' },
      { term: 'Thylakoids', category: 'structure' },
      { term: 'Stroma', category: 'structure' },
      { term: 'Chloroplast genome', category: 'molecule' },
      { term: 'Plastids', category: 'structure' },
      { term: 'Peroxisomes', category: 'structure' },
      { term: 'Catalase', category: 'molecule' },
      { term: 'PTS1/PTS2 (peroxisomal targeting signals)', category: 'concept' },
    ],
    keyConcepts: [
      'Mitochondrial structure and function',
      'Protein import into mitochondria (TOM/TIM)',
      'Chloroplast structure and photosynthetic function',
      'Semi-autonomous organelles with own genomes',
      'Peroxisome function and assembly',
    ],
    keyExperiments: [
      'Mitochondrial Replacement Therapy',
      'Peroxisome Biogenesis Disorders',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 13 (9e) ← Ch 14 (8e): Cytoskeleton and Cell Movement
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 13,
    title: 'The Cytoskeleton and Cell Movement',
    chapter8e: [14],
    keyTerms: [
      { term: 'Actin filaments (microfilaments)', category: 'structure' },
      { term: 'G-actin / F-actin', category: 'molecule' },
      { term: 'Actin nucleation (Arp2/3, formins)', category: 'process' },
      { term: 'Treadmilling', category: 'process' },
      { term: 'Lamellipodia', category: 'structure' },
      { term: 'Filopodia', category: 'structure' },
      { term: 'Stress fibers', category: 'structure' },
      { term: 'Myosin (I, II, V)', category: 'molecule' },
      { term: 'Sarcomere', category: 'structure' },
      { term: 'Microtubules', category: 'structure' },
      { term: 'α/β tubulin', category: 'molecule' },
      { term: 'Dynamic instability', category: 'concept' },
      { term: 'MAPs (microtubule-associated proteins)', category: 'molecule' },
      { term: 'Centrosome / MTOC', category: 'structure' },
      { term: 'Kinesin', category: 'molecule' },
      { term: 'Dynein', category: 'molecule' },
      { term: 'Cilia and flagella', category: 'structure' },
      { term: 'Mitotic spindle', category: 'structure' },
      { term: 'Intermediate filaments', category: 'structure' },
      { term: 'Keratins', category: 'molecule' },
      { term: 'Lamins', category: 'molecule' },
      { term: 'Vimentin', category: 'molecule' },
    ],
    keyConcepts: [
      'Three cytoskeletal filament systems',
      'Actin polymerization drives cell movement',
      'Myosin motor proteins and muscle contraction',
      'Microtubule dynamic instability',
      'Motor protein-based intracellular transport',
      'Ciliary and flagellar movement',
    ],
    keyExperiments: [
      'The Isolation of Kinesin',
      'Function of Intermediate Filaments',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 14 (9e) ← Ch 15 (8e): The Plasma Membrane
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 14,
    title: 'The Plasma Membrane',
    chapter8e: [15],
    keyTerms: [
      { term: 'Lipid rafts', category: 'structure' },
      { term: 'Glycocalyx', category: 'structure' },
      { term: 'Facilitated diffusion', category: 'process' },
      { term: 'Ion channels (voltage-gated, ligand-gated)', category: 'molecule' },
      { term: 'Na⁺/K⁺ ATPase (sodium-potassium pump)', category: 'molecule' },
      { term: 'Ca²⁺ pump', category: 'molecule' },
      { term: 'ABC transporters', category: 'molecule' },
      { term: 'Symport / Antiport', category: 'process' },
      { term: 'Phagocytosis', category: 'process' },
      { term: 'Pinocytosis', category: 'process' },
      { term: 'Clathrin-mediated endocytosis', category: 'process' },
      { term: 'Receptor-mediated endocytosis', category: 'process' },
      { term: 'LDL receptor', category: 'molecule' },
    ],
    keyConcepts: [
      'Membrane lipid composition and asymmetry',
      'Membrane protein types and functions',
      'Ion channels and membrane potential',
      'Active transport mechanisms (pumps)',
      'Receptor-mediated endocytosis pathway',
    ],
    keyExperiments: [
      'The LDL Receptor',
      'Cystic Fibrosis (molecular medicine)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 15 (9e) ← Ch 16 (8e): Cell Walls, ECM, Cell Interactions
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 15,
    title: 'Cell Walls, the Extracellular Matrix, and Cell Interactions',
    chapter8e: [16],
    keyTerms: [
      { term: 'Peptidoglycan', category: 'molecule' },
      { term: 'Cellulose', category: 'molecule' },
      { term: 'Collagen', category: 'molecule' },
      { term: 'Elastin', category: 'molecule' },
      { term: 'Fibronectin', category: 'molecule' },
      { term: 'Laminin', category: 'molecule' },
      { term: 'Proteoglycans', category: 'molecule' },
      { term: 'Glycosaminoglycans', category: 'molecule' },
      { term: 'Integrins', category: 'molecule' },
      { term: 'Focal adhesions', category: 'structure' },
      { term: 'Cadherins', category: 'molecule' },
      { term: 'Adherens junctions', category: 'structure' },
      { term: 'Desmosomes', category: 'structure' },
      { term: 'Tight junctions (zonula occludens)', category: 'structure' },
      { term: 'Gap junctions (connexins)', category: 'structure' },
      { term: 'Plasmodesmata', category: 'structure' },
    ],
    keyConcepts: [
      'Bacterial vs plant cell walls',
      'ECM composition and organization',
      'Integrin-mediated cell-matrix adhesion',
      'Cell-cell junction types and functions',
      'Gap junctions enable cell communication',
    ],
    keyExperiments: [
      'The Characterization of Integrin',
      'Gap Junction Diseases (molecular medicine)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 16 (9e) ← Ch 17 (8e): Cell Signaling
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 16,
    title: 'Cell Signaling',
    chapter8e: [17],
    keyTerms: [
      { term: 'G protein-coupled receptors (GPCRs)', category: 'molecule' },
      { term: 'Heterotrimeric G proteins (Gα, Gβγ)', category: 'molecule' },
      { term: 'Adenylyl cyclase', category: 'molecule' },
      { term: 'cAMP', category: 'molecule' },
      { term: 'Protein kinase A (PKA)', category: 'molecule' },
      { term: 'Phospholipase C', category: 'molecule' },
      { term: 'IP₃ and DAG', category: 'molecule' },
      { term: 'Protein kinase C (PKC)', category: 'molecule' },
      { term: 'Receptor tyrosine kinases (RTKs)', category: 'molecule' },
      { term: 'Ras', category: 'molecule' },
      { term: 'MAP kinase cascade (Raf/MEK/ERK)', category: 'process' },
      { term: 'PI 3-kinase / Akt pathway', category: 'process' },
      { term: 'JAK/STAT pathway', category: 'process' },
      { term: 'NF-κB', category: 'molecule' },
      { term: 'Notch signaling', category: 'process' },
      { term: 'Wnt signaling', category: 'process' },
      { term: 'Hedgehog signaling', category: 'process' },
      { term: 'Signal amplification', category: 'concept' },
      { term: 'Scaffold proteins', category: 'molecule' },
    ],
    keyConcepts: [
      'G protein signaling cycle',
      'Second messengers (cAMP, Ca²⁺, IP₃, DAG)',
      'RTK → Ras → MAP kinase cascade',
      'PI 3-kinase/Akt survival pathway',
      'Signaling crosstalk and networks',
      'Developmental signaling pathways (Notch, Wnt, Hedgehog)',
    ],
    keyExperiments: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 17 (9e) ← Ch 18 (8e): The Cell Cycle
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 17,
    title: 'The Cell Cycle',
    chapter8e: [18],
    keyTerms: [
      { term: 'G1, S, G2, M phases', category: 'concept' },
      { term: 'Restriction point', category: 'concept' },
      { term: 'Cyclins (A, B, D, E)', category: 'molecule' },
      { term: 'Cyclin-dependent kinases (Cdks)', category: 'molecule' },
      { term: 'Cdk inhibitors (CKIs)', category: 'molecule' },
      { term: 'Retinoblastoma protein (Rb)', category: 'molecule' },
      { term: 'E2F transcription factors', category: 'molecule' },
      { term: 'p53', category: 'molecule' },
      { term: 'p21', category: 'molecule' },
      { term: 'DNA damage checkpoints', category: 'concept' },
      { term: 'Spindle assembly checkpoint', category: 'concept' },
      { term: 'Anaphase-promoting complex (APC)', category: 'molecule' },
      { term: 'Mitosis (prophase → telophase)', category: 'process' },
      { term: 'Cytokinesis', category: 'process' },
      { term: 'Meiosis', category: 'process' },
    ],
    keyConcepts: [
      'Cell cycle phases and checkpoints',
      'Cyclin-Cdk regulation of cell cycle',
      'Rb pathway: G1 checkpoint control',
      'p53: guardian of the genome',
      'Stages of mitosis',
      'Meiosis vs mitosis',
    ],
    keyExperiments: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 18 (9e) ← Ch 19 (8e): Cell Renewal and Cell Death
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 18,
    title: 'Cell Renewal and Cell Death',
    chapter8e: [19],
    keyTerms: [
      { term: 'Stem cells', category: 'structure' },
      { term: 'Self-renewal', category: 'process' },
      { term: 'Transit-amplifying cells', category: 'structure' },
      { term: 'Niche', category: 'concept' },
      { term: 'Hematopoietic stem cells', category: 'structure' },
      { term: 'Intestinal stem cells', category: 'structure' },
      { term: 'Induced pluripotent stem cells (iPS)', category: 'technique' },
      { term: 'Yamanaka factors (Oct4, Sox2, Klf4, c-Myc)', category: 'molecule' },
      { term: 'Apoptosis', category: 'process' },
      { term: 'Caspases', category: 'molecule' },
      { term: 'Bcl-2 family', category: 'molecule' },
      { term: 'Cytochrome c release', category: 'process' },
      { term: 'Intrinsic pathway (mitochondrial)', category: 'process' },
      { term: 'Extrinsic pathway (death receptors)', category: 'process' },
      { term: 'Necrosis', category: 'process' },
      { term: 'Necroptosis', category: 'process' },
    ],
    keyConcepts: [
      'Adult stem cell maintenance of tissues',
      'Stem cell niche concept',
      'iPS cell reprogramming',
      'Apoptosis: intrinsic and extrinsic pathways',
      'Caspase cascade',
      'Balance between cell proliferation and death',
    ],
    keyExperiments: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 19 (9e) ← Ch 20 (8e): Cancer
  // ═══════════════════════════════════════════════════════════════
  {
    chapter9e: 19,
    title: 'Cancer',
    chapter8e: [20],
    keyTerms: [
      { term: 'Oncogenes', category: 'concept' },
      { term: 'Proto-oncogenes', category: 'concept' },
      { term: 'Tumor suppressor genes', category: 'concept' },
      { term: 'Carcinogens', category: 'concept' },
      { term: 'Tumor initiation', category: 'process' },
      { term: 'Tumor promotion', category: 'process' },
      { term: 'Tumor progression', category: 'process' },
      { term: 'Metastasis', category: 'process' },
      { term: 'Ras oncogene', category: 'molecule' },
      { term: 'Growth factors (EGF, PDGF)', category: 'molecule' },
      { term: 'Rb (retinoblastoma)', category: 'molecule' },
      { term: 'p53', category: 'molecule' },
      { term: 'APC', category: 'molecule' },
      { term: 'BRCA1/BRCA2', category: 'molecule' },
      { term: 'Two-hit hypothesis', category: 'concept' },
      { term: 'Angiogenesis', category: 'process' },
      { term: 'Targeted therapy (imatinib)', category: 'concept' },
      { term: 'Immunotherapy', category: 'concept' },
      { term: 'Checkpoint inhibitors', category: 'molecule' },
    ],
    keyConcepts: [
      'Multi-step model of cancer development',
      'Oncogenes: gain-of-function mutations',
      'Tumor suppressors: loss-of-function (two-hit)',
      'Hallmarks of cancer',
      'Molecular targeted cancer therapies',
      'Cancer immunotherapy',
    ],
    keyExperiments: [],
  },
];

/** Get study content for a specific 9th edition chapter */
export function getChapterStudyContent(chapter9e: number): ChapterStudyContent | undefined {
  return BIOL3020_STUDY_CONTENT.find(c => c.chapter9e === chapter9e);
}

/** Get all key terms across all chapters */
export function getAllKeyTerms(): KeyTerm[] {
  return BIOL3020_STUDY_CONTENT.flatMap(c => c.keyTerms);
}

/** Get key terms by category */
export function getKeyTermsByCategory(category: KeyTerm['category']): KeyTerm[] {
  return getAllKeyTerms().filter(t => t.category === category);
}

/** Map an 8th edition chapter number to 9th edition */
export function map8eTo9e(chapter8e: number): number | undefined {
  const mapping: Record<number, number> = {
    1: 1, 2: 2, 3: 2, 4: 3, 5: 9, 6: 4, 7: 5, 8: 6,
    9: 8, 10: 7, 11: 10, 12: 11, 13: 12, 14: 13, 15: 14,
    16: 15, 17: 16, 18: 17, 19: 18, 20: 19,
  };
  return mapping[chapter8e];
}
