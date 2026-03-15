/**
 * Evolution Study Content — BIOL 4230
 * Evolution: Making Sense of Life, Zimmer & Emlen, 2nd Edition
 * 18 chapters covering evolutionary biology
 */

export interface KeyTerm {
  term: string;
  category?: 'structure' | 'process' | 'molecule' | 'technique' | 'concept' | 'organism' | 'disease';
}

export interface ChapterStudyContent {
  chapter: number;
  title: string;
  keyTerms: KeyTerm[];
  keyConcepts: string[];
  keyExperiments: string[];
}

export const BIOL4230_STUDY_CONTENT: ChapterStudyContent[] = [
  // ═══════════════════════════════════════════════════════════════
  // Ch 1: The Whale and the Virus — How Scientists Study Evolution
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 1,
    title: 'The Whale and the Virus — How Scientists Study Evolution',
    keyTerms: [
      { term: 'Evolution', category: 'concept' },
      { term: 'Natural selection', category: 'concept' },
      { term: 'Descent with modification', category: 'concept' },
      { term: 'Transitional fossils', category: 'concept' },
      { term: 'Cetaceans', category: 'organism' },
      { term: 'Pakicetus', category: 'organism' },
      { term: 'Ambulocetus', category: 'organism' },
      { term: 'Basilosaurus', category: 'organism' },
      { term: 'Dorudon', category: 'organism' },
      { term: 'HIV (human immunodeficiency virus)', category: 'organism' },
      { term: 'Phylogenetic tree', category: 'concept' },
      { term: 'Homology', category: 'concept' },
      { term: 'Vestigial structures', category: 'structure' },
      { term: 'Adaptation', category: 'concept' },
      { term: 'Viral evolution', category: 'process' },
      { term: 'Drug resistance', category: 'concept' },
      { term: 'Reverse transcriptase', category: 'molecule' },
      { term: 'Molecular phylogenetics', category: 'technique' },
      { term: 'Fossil record', category: 'concept' },
      { term: 'Comparative anatomy', category: 'technique' },
    ],
    keyConcepts: [
      'Evolution is the central organizing principle of biology',
      'Transitional fossils document whale evolution from terrestrial to aquatic mammals',
      'HIV evolution within patients demonstrates natural selection in real time',
      'Phylogenetic trees represent hypotheses about evolutionary relationships',
      'Vestigial structures in whales (hind limb bones) provide evidence of ancestry',
      'Viral populations evolve rapidly due to high mutation rates and short generation times',
    ],
    keyExperiments: [
      'Gingerich: Discovery and analysis of Pakicetus and other early whale fossils in Pakistan',
      'Thewissen: Discovery of Ambulocetus and reconstruction of whale locomotion evolution',
      'Molecular phylogenetic analysis tracing HIV transmission between patients in the Florida dentist case',
      'Comparison of whale embryonic development showing hind limb bud formation and regression',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 2: From Natural Philosophy to Darwin
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 2,
    title: 'From Natural Philosophy to Darwin',
    keyTerms: [
      { term: 'Natural theology', category: 'concept' },
      { term: 'Great Chain of Being', category: 'concept' },
      { term: 'Uniformitarianism', category: 'concept' },
      { term: 'Catastrophism', category: 'concept' },
      { term: 'Lamarckism', category: 'concept' },
      { term: 'Inheritance of acquired characteristics', category: 'concept' },
      { term: 'Transmutation', category: 'concept' },
      { term: 'Artificial selection', category: 'process' },
      { term: 'Struggle for existence', category: 'concept' },
      { term: 'On the Origin of Species', category: 'concept' },
      { term: 'HMS Beagle', category: 'concept' },
      { term: 'Galapagos Islands', category: 'concept' },
      { term: 'Charles Darwin', category: 'concept' },
      { term: 'Alfred Russel Wallace', category: 'concept' },
      { term: 'Thomas Malthus', category: 'concept' },
      { term: 'Charles Lyell', category: 'concept' },
      { term: 'Jean-Baptiste Lamarck', category: 'concept' },
      { term: 'Georges Cuvier', category: 'concept' },
      { term: 'Biogeography', category: 'concept' },
      { term: 'Common descent', category: 'concept' },
    ],
    keyConcepts: [
      'Pre-Darwinian views held species as fixed and immutable (essentialism)',
      'Lyell\'s uniformitarianism established that geological processes act gradually over vast time',
      'Lamarck proposed the first coherent theory of evolution but with incorrect mechanisms',
      'Darwin\'s observations on the Beagle voyage (especially Galapagos) shaped his theory',
      'Malthus\'s essay on population growth inspired Darwin\'s concept of struggle for existence',
      'Darwin and Wallace independently arrived at the theory of natural selection',
      'Artificial selection provided Darwin with an analogy for natural selection',
    ],
    keyExperiments: [
      'Darwin\'s observations of Galapagos finches and tortoises showing island-specific variation',
      'Comparative study of South American fossils and living species by Darwin',
      'Darwin\'s extensive study of pigeon breeding as evidence for artificial selection',
      'Wallace\'s biogeographic observations in the Malay Archipelago',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 3: What the Rocks Say
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 3,
    title: 'What the Rocks Say',
    keyTerms: [
      { term: 'Radiometric dating', category: 'technique' },
      { term: 'Half-life', category: 'concept' },
      { term: 'Isotopes', category: 'concept' },
      { term: 'Stratigraphy', category: 'technique' },
      { term: 'Fossilization', category: 'process' },
      { term: 'Geologic time scale', category: 'concept' },
      { term: 'Precambrian', category: 'concept' },
      { term: 'Paleozoic era', category: 'concept' },
      { term: 'Mesozoic era', category: 'concept' },
      { term: 'Cenozoic era', category: 'concept' },
      { term: 'Cambrian explosion', category: 'concept' },
      { term: 'Uranium-lead dating', category: 'technique' },
      { term: 'Carbon-14 dating', category: 'technique' },
      { term: 'Potassium-argon dating', category: 'technique' },
      { term: 'Index fossils', category: 'concept' },
      { term: 'Principle of superposition', category: 'concept' },
      { term: 'Strata', category: 'structure' },
      { term: 'Permineralization', category: 'process' },
      { term: 'Amber preservation', category: 'process' },
      { term: 'Lord Kelvin', category: 'concept' },
      { term: 'Radioactive decay', category: 'process' },
    ],
    keyConcepts: [
      'Radiometric dating provides absolute ages for rocks and fossils using radioactive decay',
      'Kelvin\'s estimate of Earth\'s age was too young because he did not know about radioactivity',
      'The fossil record reveals a succession of life forms through geological time',
      'Different radiometric methods are suited for different time scales (C-14 vs. U-Pb)',
      'Stratigraphy and the principle of superposition allow relative dating of rock layers',
      'The Earth is approximately 4.54 billion years old based on radiometric evidence',
    ],
    keyExperiments: [
      'Rutherford and Boltwood: First radiometric dating using uranium-lead decay',
      'Patterson: Determination of Earth\'s age using lead isotopes from meteorites',
      'Kelvin\'s thermodynamic calculations of Earth\'s age and their refutation by radioactivity',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 4: The Tree of Life
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 4,
    title: 'The Tree of Life',
    keyTerms: [
      { term: 'Phylogeny', category: 'concept' },
      { term: 'Cladistics', category: 'technique' },
      { term: 'Clade', category: 'concept' },
      { term: 'Monophyletic group', category: 'concept' },
      { term: 'Paraphyletic group', category: 'concept' },
      { term: 'Polyphyletic group', category: 'concept' },
      { term: 'Synapomorphy', category: 'concept' },
      { term: 'Plesiomorphy', category: 'concept' },
      { term: 'Parsimony', category: 'technique' },
      { term: 'Maximum likelihood', category: 'technique' },
      { term: 'Bayesian inference', category: 'technique' },
      { term: 'Outgroup', category: 'concept' },
      { term: 'Sister taxa', category: 'concept' },
      { term: 'Node', category: 'concept' },
      { term: 'Molecular clock', category: 'technique' },
      { term: 'Homology', category: 'concept' },
      { term: 'Homoplasy', category: 'concept' },
      { term: 'Convergent evolution', category: 'process' },
      { term: 'Analogous structures', category: 'structure' },
      { term: 'Taxonomy', category: 'concept' },
      { term: 'Linnaean classification', category: 'concept' },
      { term: 'Bootstrap support', category: 'technique' },
      { term: 'Character matrix', category: 'technique' },
    ],
    keyConcepts: [
      'Phylogenetic trees are hypotheses about evolutionary relationships, not ladders of progress',
      'Synapomorphies (shared derived characters) define monophyletic groups (clades)',
      'Parsimony, maximum likelihood, and Bayesian methods are used to reconstruct phylogenies',
      'Molecular clocks calibrated with fossils estimate divergence times',
      'Homoplasy (convergent evolution, reversal) can mislead phylogenetic reconstruction',
      'All life shares common ancestry, as supported by molecular and morphological evidence',
      'Phylogenies can be tested using independent datasets (molecular vs. morphological)',
    ],
    keyExperiments: [
      'Hennig: Development of cladistic methodology for phylogenetic systematics',
      'Woese: Use of ribosomal RNA sequences to discover the three domains of life',
      'Molecular phylogenetic analysis confirming whales are nested within Artiodactyla',
      'Zuckerkandl and Pauling: Proposal of the molecular clock hypothesis using hemoglobin sequences',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 5: Raw Material — Heritable Variation Among Individuals
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 5,
    title: 'Raw Material — Heritable Variation Among Individuals',
    keyTerms: [
      { term: 'DNA (deoxyribonucleic acid)', category: 'molecule' },
      { term: 'RNA (ribonucleic acid)', category: 'molecule' },
      { term: 'Point mutation', category: 'process' },
      { term: 'Insertion', category: 'process' },
      { term: 'Deletion', category: 'process' },
      { term: 'Gene duplication', category: 'process' },
      { term: 'Chromosomal inversion', category: 'process' },
      { term: 'Polyploidy', category: 'process' },
      { term: 'Transposable elements', category: 'molecule' },
      { term: 'Recombination', category: 'process' },
      { term: 'Allele', category: 'concept' },
      { term: 'Locus', category: 'concept' },
      { term: 'Genotype', category: 'concept' },
      { term: 'Phenotype', category: 'concept' },
      { term: 'Epistasis', category: 'concept' },
      { term: 'Pleiotropy', category: 'concept' },
      { term: 'Polygenic traits', category: 'concept' },
      { term: 'Heritability', category: 'concept' },
      { term: 'Mutation rate', category: 'concept' },
      { term: 'Synonymous mutation', category: 'concept' },
      { term: 'Nonsynonymous mutation', category: 'concept' },
      { term: 'Reaction norm', category: 'concept' },
      { term: 'Phenotypic plasticity', category: 'concept' },
      { term: 'DNA polymerase', category: 'molecule' },
    ],
    keyConcepts: [
      'Mutations are the ultimate source of all genetic variation',
      'Most mutations are neutral or deleterious; beneficial mutations are rare',
      'Gene duplication provides raw material for evolving new gene functions',
      'Recombination shuffles existing alleles into new combinations each generation',
      'The genotype-phenotype map is complex: one gene can affect many traits (pleiotropy) and one trait can be affected by many genes (polygenic)',
      'Phenotypic plasticity allows a single genotype to produce different phenotypes in different environments',
      'Transposable elements are a major source of genomic variation and mutation',
    ],
    keyExperiments: [
      'Muller: X-ray mutagenesis experiments demonstrating that mutations can be artificially induced',
      'Luria and Delbruck: Fluctuation test showing mutations arise randomly, not in response to selection',
      'Ohno: Hypothesis of evolution by gene duplication and its role in generating novelty',
      'Studies of Hox gene duplications in vertebrate evolution',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 6: The Ways of Change — Drift and Selection
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 6,
    title: 'The Ways of Change — Drift and Selection',
    keyTerms: [
      { term: 'Hardy-Weinberg equilibrium', category: 'concept' },
      { term: 'Allele frequency', category: 'concept' },
      { term: 'Genotype frequency', category: 'concept' },
      { term: 'Genetic drift', category: 'process' },
      { term: 'Founder effect', category: 'process' },
      { term: 'Bottleneck effect', category: 'process' },
      { term: 'Gene flow', category: 'process' },
      { term: 'Natural selection', category: 'process' },
      { term: 'Directional selection', category: 'process' },
      { term: 'Stabilizing selection', category: 'process' },
      { term: 'Disruptive selection', category: 'process' },
      { term: 'Balancing selection', category: 'process' },
      { term: 'Heterozygote advantage', category: 'concept' },
      { term: 'Fitness', category: 'concept' },
      { term: 'Relative fitness', category: 'concept' },
      { term: 'Selection coefficient', category: 'concept' },
      { term: 'Effective population size', category: 'concept' },
      { term: 'Inbreeding', category: 'process' },
      { term: 'Inbreeding depression', category: 'concept' },
      { term: 'Fixation', category: 'concept' },
      { term: 'Population genetics', category: 'concept' },
      { term: 'Landscape genetics', category: 'concept' },
      { term: 'Frequency-dependent selection', category: 'process' },
    ],
    keyConcepts: [
      'Hardy-Weinberg equilibrium describes a non-evolving population and identifies the forces that cause evolution',
      'Genetic drift is random change in allele frequencies, stronger in small populations',
      'Bottlenecks and founder events drastically reduce genetic variation through drift',
      'Natural selection is the only evolutionary force that produces adaptation',
      'Directional, stabilizing, and disruptive selection affect the distribution of phenotypes differently',
      'Balancing selection (heterozygote advantage, frequency-dependent selection) maintains polymorphism',
      'Gene flow homogenizes allele frequencies between populations',
      'Inbreeding increases homozygosity and can expose deleterious recessive alleles',
    ],
    keyExperiments: [
      'Buri: Experimental demonstration of genetic drift using Drosophila populations of different sizes',
      'Sickle cell anemia and malaria: Classic example of heterozygote advantage (balancing selection)',
      'Northern elephant seal bottleneck: Dramatic loss of genetic variation from near-extinction',
      'Amish founder effect: High frequency of Ellis-van Creveld syndrome due to small founding population',
      'Hardy and Weinberg: Independent derivation of the equilibrium principle for Mendelian genetics',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 7: Beyond Alleles — Quantitative Genetics and Evolution
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 7,
    title: 'Beyond Alleles — Quantitative Genetics and Evolution',
    keyTerms: [
      { term: 'Quantitative trait', category: 'concept' },
      { term: 'Continuous variation', category: 'concept' },
      { term: 'Heritability (broad-sense)', category: 'concept' },
      { term: 'Heritability (narrow-sense)', category: 'concept' },
      { term: 'Additive genetic variance', category: 'concept' },
      { term: 'Environmental variance', category: 'concept' },
      { term: 'Breeder\'s equation', category: 'concept' },
      { term: 'Selection differential', category: 'concept' },
      { term: 'Response to selection', category: 'concept' },
      { term: 'QTL (quantitative trait locus)', category: 'concept' },
      { term: 'QTL mapping', category: 'technique' },
      { term: 'GWAS (genome-wide association study)', category: 'technique' },
      { term: 'Phenotypic plasticity', category: 'concept' },
      { term: 'Norm of reaction', category: 'concept' },
      { term: 'G x E interaction', category: 'concept' },
      { term: 'Selection gradient', category: 'concept' },
      { term: 'Genetic correlation', category: 'concept' },
      { term: 'Trade-off', category: 'concept' },
      { term: 'Multivariate selection', category: 'concept' },
    ],
    keyConcepts: [
      'Most traits of ecological and evolutionary importance are quantitative (polygenic, continuous)',
      'Heritability measures the proportion of phenotypic variation due to genetic variation',
      'The breeder\'s equation (R = h^2 * S) predicts evolutionary response to selection',
      'QTL mapping identifies genomic regions contributing to quantitative trait variation',
      'Genetic correlations between traits can constrain or facilitate evolutionary change',
      'Phenotypic plasticity is itself a trait that can evolve via selection on reaction norms',
    ],
    keyExperiments: [
      'Falconer: Selective breeding experiments demonstrating heritability and response to selection',
      'Lande and Arnold: Multivariate selection analysis framework for natural populations',
      'QTL mapping of tomato fruit size revealing the genetic architecture of a quantitative trait',
      'Twin studies in humans partitioning genetic and environmental contributions to traits',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 8: Natural Selection — Empirical Studies of Adaptation
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 8,
    title: 'Natural Selection — Empirical Studies of Adaptation',
    keyTerms: [
      { term: 'Darwin\'s finches (Geospiza)', category: 'organism' },
      { term: 'Deer mice (Peromyscus)', category: 'organism' },
      { term: 'Cline', category: 'concept' },
      { term: 'Selective sweep', category: 'concept' },
      { term: 'Predator-prey coevolution', category: 'process' },
      { term: 'Industrial melanism', category: 'concept' },
      { term: 'Peppered moth (Biston betularia)', category: 'organism' },
      { term: 'Lactase persistence', category: 'concept' },
      { term: 'Beak morphology', category: 'structure' },
      { term: 'Guppies (Poecilia reticulata)', category: 'organism' },
      { term: 'Replicated natural experiments', category: 'technique' },
      { term: 'Coat color adaptation', category: 'concept' },
      { term: 'Mc1r gene', category: 'molecule' },
      { term: 'LCT gene', category: 'molecule' },
      { term: 'Ecotype', category: 'concept' },
      { term: 'Human-driven selection', category: 'process' },
      { term: 'Anthropogenic selection', category: 'process' },
      { term: 'Parasitoid', category: 'organism' },
      { term: 'Stickleback fish', category: 'organism' },
      { term: 'Aposematic coloration', category: 'concept' },
    ],
    keyConcepts: [
      'Grant & Grant\'s long-term study of Darwin\'s finches demonstrates natural selection acting on beak size in real time',
      'Coat color evolution in deer mice shows how selection links genotype to phenotype to fitness',
      'Clines represent gradual genetic or phenotypic change across environmental gradients',
      'Guppy experiments demonstrate that predation regime shapes life history and coloration',
      'Lactase persistence evolved independently in multiple human populations with dairying traditions',
      'Human activities (hunting, pollution, fishing) impose strong selection on wild populations',
      'Replicated natural experiments (e.g., island colonizations) provide powerful evidence for adaptation',
    ],
    keyExperiments: [
      'Grant & Grant: 40+ year study of natural selection on beak size in Galapagos finches during droughts',
      'Hoekstra: Mc1r gene and coat color adaptation in beach-dwelling deer mice (Peromyscus)',
      'Endler: Experimental guppy transplants demonstrating rapid evolution of color patterns under different predation regimes',
      'Kettlewell: Peppered moth experiments on industrial melanism and predation by birds',
      'Tishkoff: Genetic analysis of convergent evolution of lactase persistence in African and European populations',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 9: The History in Our Genes
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 9,
    title: 'The History in Our Genes',
    keyTerms: [
      { term: 'Coalescent theory', category: 'concept' },
      { term: 'Gene tree', category: 'concept' },
      { term: 'Species tree', category: 'concept' },
      { term: 'Most recent common ancestor (MRCA)', category: 'concept' },
      { term: 'Neutral theory of molecular evolution', category: 'concept' },
      { term: 'Synonymous substitution rate', category: 'concept' },
      { term: 'Nonsynonymous substitution rate', category: 'concept' },
      { term: 'dN/dS ratio (Ka/Ks)', category: 'technique' },
      { term: 'Purifying selection', category: 'process' },
      { term: 'Positive selection', category: 'process' },
      { term: 'Molecular clock', category: 'concept' },
      { term: 'Incomplete lineage sorting', category: 'concept' },
      { term: 'Horizontal gene transfer', category: 'process' },
      { term: 'Genome duplication', category: 'process' },
      { term: 'Pseudogene', category: 'concept' },
      { term: 'Mitochondrial DNA (mtDNA)', category: 'molecule' },
      { term: 'Mitochondrial Eve', category: 'concept' },
      { term: 'Effective population size (Ne)', category: 'concept' },
      { term: 'Kimura, Motoo', category: 'concept' },
      { term: 'Nearly neutral theory', category: 'concept' },
    ],
    keyConcepts: [
      'Coalescent theory traces gene copies backward in time to their most recent common ancestor',
      'Gene trees and species trees can differ due to incomplete lineage sorting and other processes',
      'The neutral theory predicts that most molecular evolution is due to drift of neutral mutations',
      'The dN/dS ratio distinguishes purifying selection (<1), neutral evolution (=1), and positive selection (>1)',
      'Mitochondrial DNA provides a matrilineal history of populations due to maternal inheritance',
      'Horizontal gene transfer is common in prokaryotes and complicates tree-of-life reconstruction',
      'Genome-wide analyses reveal signatures of selection, drift, and demographic history',
    ],
    keyExperiments: [
      'Kimura: Formulation of the neutral theory based on protein substitution rates',
      'Cann, Stoneking, and Wilson: Mitochondrial Eve study tracing human mtDNA lineages to Africa',
      'McDonald-Kreitman test: Comparing synonymous and nonsynonymous polymorphism to detect selection',
      'Analysis of gene tree discordance across primate genomes revealing incomplete lineage sorting',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 10: Adaptation — From Genes to Traits
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 10,
    title: 'Adaptation — From Genes to Traits',
    keyTerms: [
      { term: 'Gene regulatory network', category: 'concept' },
      { term: 'Cis-regulatory element', category: 'molecule' },
      { term: 'Enhancer', category: 'molecule' },
      { term: 'Transcription factor', category: 'molecule' },
      { term: 'Hox genes', category: 'molecule' },
      { term: 'Toolkit genes', category: 'concept' },
      { term: 'Evo-devo (evolutionary developmental biology)', category: 'concept' },
      { term: 'Deep homology', category: 'concept' },
      { term: 'Pax6', category: 'molecule' },
      { term: 'Convergent evolution', category: 'process' },
      { term: 'Constraint', category: 'concept' },
      { term: 'Exaptation', category: 'concept' },
      { term: 'Co-option', category: 'process' },
      { term: 'Tiktaalik', category: 'organism' },
      { term: 'Evolutionary novelty', category: 'concept' },
      { term: 'Modularity', category: 'concept' },
      { term: 'Developmental constraint', category: 'concept' },
      { term: 'Venom evolution', category: 'process' },
      { term: 'Gene cascade', category: 'process' },
      { term: 'Limb development', category: 'process' },
      { term: 'Eye evolution', category: 'process' },
      { term: 'Antifreeze proteins', category: 'molecule' },
    ],
    keyConcepts: [
      'Changes in cis-regulatory elements can produce large phenotypic changes while preserving gene function',
      'Toolkit genes (e.g., Hox, Pax6) are deeply conserved and reused across vastly different body plans',
      'Co-option recruits existing genes and structures for new functions (exaptation)',
      'Convergent evolution can arise from changes in the same genes (deep homology) or different genetic paths',
      'Developmental constraints limit the range of phenotypic variation available to selection',
      'Modularity allows independent evolution of different body regions',
      'Tiktaalik illustrates the fin-to-limb transition as an example of evolutionary novelty',
      'Eye evolution demonstrates that complex organs can evolve incrementally from simple precursors',
    ],
    keyExperiments: [
      'Shubin: Discovery of Tiktaalik, a transitional fossil bridging fish and tetrapods',
      'Gehring: Demonstration that Pax6 can induce ectopic eyes across phyla (flies and mice)',
      'Carroll: Evo-devo studies showing cis-regulatory changes drive morphological evolution in Drosophila',
      'Comparative studies of venom gene recruitment showing repeated co-option from non-venom genes',
      'Nilsson and Pelger: Computational model of eye evolution from a simple photoreceptor to a camera eye',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 11: Sex — Causes and Consequences
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 11,
    title: 'Sex — Causes and Consequences',
    keyTerms: [
      { term: 'Sexual reproduction', category: 'process' },
      { term: 'Asexual reproduction', category: 'process' },
      { term: 'Twofold cost of sex', category: 'concept' },
      { term: 'Red Queen hypothesis', category: 'concept' },
      { term: 'Muller\'s ratchet', category: 'concept' },
      { term: 'Sexual selection', category: 'process' },
      { term: 'Intrasexual selection', category: 'process' },
      { term: 'Intersexual selection (mate choice)', category: 'process' },
      { term: 'Runaway selection (Fisherian)', category: 'concept' },
      { term: 'Handicap principle (Zahavi)', category: 'concept' },
      { term: 'Good genes hypothesis', category: 'concept' },
      { term: 'Sexual dimorphism', category: 'concept' },
      { term: 'Cryptic female choice', category: 'process' },
      { term: 'Sperm competition', category: 'process' },
      { term: 'Sexual conflict', category: 'concept' },
      { term: 'Mating system', category: 'concept' },
      { term: 'Polygyny', category: 'concept' },
      { term: 'Polyandry', category: 'concept' },
      { term: 'Monogamy', category: 'concept' },
      { term: 'Bateman\'s principle', category: 'concept' },
      { term: 'Operational sex ratio', category: 'concept' },
    ],
    keyConcepts: [
      'Sex is costly (twofold cost) yet ubiquitous, suggesting powerful advantages',
      'The Red Queen hypothesis proposes sex is maintained by coevolution with parasites',
      'Muller\'s ratchet suggests asexual populations accumulate deleterious mutations irreversibly',
      'Sexual selection drives the evolution of ornaments, weapons, and exaggerated traits',
      'Female mate choice (intersexual selection) can drive runaway selection for elaborate male traits',
      'Sexual conflict arises when the reproductive interests of males and females diverge',
      'Mating systems (monogamy, polygyny, polyandry) evolve in response to ecological and social factors',
    ],
    keyExperiments: [
      'Andersson: Experimental manipulation of tail length in widowbirds demonstrating female preference',
      'Lively: Studies of New Zealand snails (Potamopyrgus) showing sex is advantageous against parasites (Red Queen)',
      'Bateman: Experiments on Drosophila showing different variance in reproductive success between sexes',
      'Arnqvist and Rowe: Studies of water striders demonstrating sexually antagonistic coevolution',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 12: After Conception — Life History and Parental Care
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 12,
    title: 'After Conception — Life History and Parental Care',
    keyTerms: [
      { term: 'Life history theory', category: 'concept' },
      { term: 'Trade-off', category: 'concept' },
      { term: 'Reproductive effort', category: 'concept' },
      { term: 'Parental investment', category: 'concept' },
      { term: 'Semelparity', category: 'concept' },
      { term: 'Iteroparity', category: 'concept' },
      { term: 'r-selection', category: 'concept' },
      { term: 'K-selection', category: 'concept' },
      { term: 'Parent-offspring conflict', category: 'concept' },
      { term: 'Sibling rivalry', category: 'concept' },
      { term: 'Genomic imprinting', category: 'process' },
      { term: 'Kinship theory of imprinting', category: 'concept' },
      { term: 'Senescence (aging)', category: 'process' },
      { term: 'Antagonistic pleiotropy', category: 'concept' },
      { term: 'Mutation accumulation theory', category: 'concept' },
      { term: 'Disposable soma theory', category: 'concept' },
      { term: 'Grandmother hypothesis', category: 'concept' },
      { term: 'Menopause', category: 'concept' },
      { term: 'Clutch size', category: 'concept' },
      { term: 'Age at maturity', category: 'concept' },
    ],
    keyConcepts: [
      'Life history traits (age at maturity, clutch size, lifespan) evolve as a suite of trade-offs',
      'Parental investment theory predicts which sex provides more care based on costs and benefits',
      'Parent-offspring conflict arises because parents and offspring have different optimal investment levels',
      'Genomic imprinting reflects intragenomic conflict between maternally and paternally inherited genes',
      'Aging evolves because natural selection weakens with age (mutation accumulation, antagonistic pleiotropy)',
      'The grandmother hypothesis proposes menopause evolved due to benefits of helping grandchildren',
    ],
    keyExperiments: [
      'Trivers: Theory of parental investment and its relationship to sexual selection',
      'Lack: Optimal clutch size experiments in birds balancing offspring number vs. survival',
      'Medawar and Williams: Theoretical foundations of the evolutionary biology of aging',
      'Haig: Kinship theory explaining genomic imprinting through parent-of-origin gene expression conflicts',
      'Reznick: Guppy life history evolution experiments showing rapid shifts in age/size at maturity under different predation',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 13: The Origin of Species
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 13,
    title: 'The Origin of Species',
    keyTerms: [
      { term: 'Biological species concept', category: 'concept' },
      { term: 'Morphological species concept', category: 'concept' },
      { term: 'Phylogenetic species concept', category: 'concept' },
      { term: 'Reproductive isolation', category: 'concept' },
      { term: 'Prezygotic barrier', category: 'concept' },
      { term: 'Postzygotic barrier', category: 'concept' },
      { term: 'Allopatric speciation', category: 'process' },
      { term: 'Sympatric speciation', category: 'process' },
      { term: 'Parapatric speciation', category: 'process' },
      { term: 'Peripatric speciation', category: 'process' },
      { term: 'Reinforcement', category: 'process' },
      { term: 'Hybrid zone', category: 'concept' },
      { term: 'Dobzhansky-Muller incompatibility', category: 'concept' },
      { term: 'Ring species', category: 'concept' },
      { term: 'Cryptic species', category: 'concept' },
      { term: 'Ecological speciation', category: 'process' },
      { term: 'Sexual isolation', category: 'concept' },
      { term: 'Temporal isolation', category: 'concept' },
      { term: 'Mechanical isolation', category: 'concept' },
      { term: 'Hybrid sterility', category: 'concept' },
      { term: 'Speciation genes', category: 'concept' },
    ],
    keyConcepts: [
      'Multiple species concepts exist; the biological species concept emphasizes reproductive isolation',
      'Prezygotic barriers prevent mating or fertilization; postzygotic barriers reduce hybrid fitness',
      'Allopatric speciation (geographic isolation) is the most well-documented mode of speciation',
      'Sympatric speciation can occur through ecological specialization or polyploidy (especially in plants)',
      'Reinforcement strengthens prezygotic isolation when hybrids are less fit',
      'Dobzhansky-Muller incompatibilities explain how reproductive isolation evolves gradually',
      'Cryptic species are morphologically similar but genetically and reproductively distinct',
    ],
    keyExperiments: [
      'Mayr: Development of the biological species concept and allopatric speciation model',
      'Coyne and Orr: Comparative analysis showing prezygotic isolation evolves faster in sympatry (reinforcement)',
      'Cichlid fish in African lakes: Rapid sympatric and ecological speciation',
      'Apple maggot fly (Rhagoletis): Host race formation as a model for sympatric speciation',
      'Ensatina ring species complex in California demonstrating gradual accumulation of reproductive isolation',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 14: Macroevolution — The Long Run
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 14,
    title: 'Macroevolution — The Long Run',
    keyTerms: [
      { term: 'Macroevolution', category: 'concept' },
      { term: 'Adaptive radiation', category: 'process' },
      { term: 'Mass extinction', category: 'concept' },
      { term: 'Background extinction rate', category: 'concept' },
      { term: 'Cambrian explosion', category: 'concept' },
      { term: 'Ediacaran fauna', category: 'organism' },
      { term: 'Burgess Shale', category: 'concept' },
      { term: 'Punctuated equilibrium', category: 'concept' },
      { term: 'Gradualism', category: 'concept' },
      { term: 'Stasis', category: 'concept' },
      { term: 'Species selection', category: 'process' },
      { term: 'Key innovation', category: 'concept' },
      { term: 'Biogeography', category: 'concept' },
      { term: 'Vicariance', category: 'process' },
      { term: 'Dispersal', category: 'process' },
      { term: 'Continental drift', category: 'concept' },
      { term: 'Pangaea', category: 'concept' },
      { term: 'End-Permian extinction', category: 'concept' },
      { term: 'K-Pg (Cretaceous-Paleogene) extinction', category: 'concept' },
      { term: 'Taxon diversity curves', category: 'concept' },
      { term: 'Evolutionary fauna', category: 'concept' },
      { term: 'Snowball Earth', category: 'concept' },
    ],
    keyConcepts: [
      'Macroevolution encompasses large-scale patterns: adaptive radiations, mass extinctions, and long-term trends',
      'Adaptive radiations occur when lineages diversify rapidly into many ecological niches, often after key innovations or extinctions',
      'The Cambrian explosion (~540 Mya) saw the rapid appearance of most major animal phyla',
      'Five major mass extinctions drastically reduced biodiversity but opened ecological opportunities',
      'Punctuated equilibrium proposes species remain in stasis, with change concentrated at speciation events',
      'Biogeography is shaped by both vicariance (splitting of landmasses) and dispersal',
      'Continental drift (plate tectonics) explains many biogeographic distribution patterns',
    ],
    keyExperiments: [
      'Eldredge and Gould: Punctuated equilibrium model based on trilobite and land snail fossil records',
      'Alvarez: Impact hypothesis for the K-Pg mass extinction based on the iridium anomaly',
      'Walcott and later Gould: Study of the Burgess Shale fauna and Cambrian diversification',
      'Sepkoski: Compilation of marine diversity curves revealing patterns of diversification and extinction',
      'Molecular clock analyses dating the Cambrian explosion and animal phylum divergence times',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 15: Intimate Partnerships
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 15,
    title: 'Intimate Partnerships',
    keyTerms: [
      { term: 'Coevolution', category: 'process' },
      { term: 'Cospeciation', category: 'process' },
      { term: 'Arms race (coevolutionary)', category: 'concept' },
      { term: 'Mutualism', category: 'concept' },
      { term: 'Parasitism', category: 'concept' },
      { term: 'Endosymbiosis', category: 'process' },
      { term: 'Mitochondrial origin', category: 'concept' },
      { term: 'Chloroplast origin', category: 'concept' },
      { term: 'Wolbachia', category: 'organism' },
      { term: 'Mycorrhizae', category: 'organism' },
      { term: 'Genomic parasites (transposable elements)', category: 'molecule' },
      { term: 'Retrotransposon', category: 'molecule' },
      { term: 'Selfish genetic elements', category: 'concept' },
      { term: 'Meiotic drive', category: 'process' },
      { term: 'Gene-for-gene model', category: 'concept' },
      { term: 'Geographic mosaic theory', category: 'concept' },
      { term: 'Pollination syndrome', category: 'concept' },
      { term: 'Symbiosis', category: 'concept' },
    ],
    keyConcepts: [
      'Coevolution is reciprocal evolutionary change between interacting species',
      'Coevolutionary arms races drive escalation of defenses and counter-defenses between hosts and parasites',
      'The geographic mosaic theory proposes that coevolution varies spatially across landscapes',
      'Endosymbiosis gave rise to mitochondria (from alphaproteobacteria) and chloroplasts (from cyanobacteria)',
      'Wolbachia is an intracellular parasite that manipulates host reproduction and has major evolutionary effects',
      'Genomic parasites (transposable elements) make up large fractions of eukaryotic genomes and drive genome evolution',
      'Mutualisms can evolve into parasitism and vice versa depending on ecological context',
    ],
    keyExperiments: [
      'Margulis: Endosymbiotic theory proposing mitochondria and chloroplasts originated from free-living bacteria',
      'Thompson: Geographic mosaic theory of coevolution based on studies of crossbills and conifers',
      'Brodie and Brodie: Coevolutionary arms race between garter snakes (Thamnophis) and toxic newts (Taricha)',
      'Studies of Wolbachia-induced cytoplasmic incompatibility and reproductive manipulation in arthropods',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 16: Brains and Behavior
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 16,
    title: 'Brains and Behavior',
    keyTerms: [
      { term: 'Behavioral ecology', category: 'concept' },
      { term: 'Innate behavior', category: 'concept' },
      { term: 'Learned behavior', category: 'concept' },
      { term: 'Fixed action pattern', category: 'concept' },
      { term: 'Kin selection', category: 'concept' },
      { term: 'Hamilton\'s rule', category: 'concept' },
      { term: 'Inclusive fitness', category: 'concept' },
      { term: 'Reciprocal altruism', category: 'concept' },
      { term: 'Eusociality', category: 'concept' },
      { term: 'Altruism', category: 'concept' },
      { term: 'Selfish behavior', category: 'concept' },
      { term: 'Game theory', category: 'concept' },
      { term: 'Prisoner\'s dilemma', category: 'concept' },
      { term: 'Tit-for-tat strategy', category: 'concept' },
      { term: 'Evolutionarily stable strategy (ESS)', category: 'concept' },
      { term: 'Hawk-dove game', category: 'concept' },
      { term: 'Coefficient of relatedness (r)', category: 'concept' },
      { term: 'Social brain hypothesis', category: 'concept' },
      { term: 'Encephalization quotient', category: 'concept' },
      { term: 'Optimal foraging theory', category: 'concept' },
      { term: 'Naked mole-rat', category: 'organism' },
      { term: 'Hymenoptera (ants, bees, wasps)', category: 'organism' },
    ],
    keyConcepts: [
      'Behaviors evolve through natural selection when they have a heritable genetic basis that affects fitness',
      'Kin selection explains altruistic behaviors toward relatives via Hamilton\'s rule (rb > c)',
      'Eusociality (reproductive division of labor) has evolved independently in multiple lineages',
      'Game theory models (hawk-dove, prisoner\'s dilemma) predict when cooperation or conflict evolves',
      'The social brain hypothesis links encephalization to the demands of complex social living',
      'Optimal foraging theory predicts when animals should maximize energy intake vs. minimize risk',
      'Reciprocal altruism can evolve when individuals interact repeatedly and can recognize cheaters',
      'Innate and learned behaviors both contribute to fitness and can evolve',
    ],
    keyExperiments: [
      'Hamilton: Mathematical formulation of kin selection and inclusive fitness theory',
      'Axelrod and Hamilton: Computer tournament demonstrating tit-for-tat as an ESS in iterated prisoner\'s dilemma',
      'Tinbergen: Four questions framework (causation, development, function, evolution) for studying behavior',
      'Studies of eusociality in naked mole-rats showing convergence with social insects',
      'Dunbar: Correlation between neocortex ratio and social group size across primate species',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 17: Human Evolution
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 17,
    title: 'Human Evolution',
    keyTerms: [
      { term: 'Hominins', category: 'concept' },
      { term: 'Australopithecus', category: 'organism' },
      { term: 'Australopithecus afarensis (Lucy)', category: 'organism' },
      { term: 'Homo erectus', category: 'organism' },
      { term: 'Homo habilis', category: 'organism' },
      { term: 'Homo neanderthalensis', category: 'organism' },
      { term: 'Homo sapiens', category: 'organism' },
      { term: 'Denisovans', category: 'organism' },
      { term: 'Homo floresiensis', category: 'organism' },
      { term: 'Ardipithecus', category: 'organism' },
      { term: 'Sahelanthropus', category: 'organism' },
      { term: 'Bipedalism', category: 'concept' },
      { term: 'Oldowan tools', category: 'concept' },
      { term: 'Acheulean tools', category: 'concept' },
      { term: 'Out-of-Africa hypothesis', category: 'concept' },
      { term: 'Multiregional hypothesis', category: 'concept' },
      { term: 'Ancient DNA (aDNA)', category: 'technique' },
      { term: 'FOXP2 gene', category: 'molecule' },
      { term: 'Encephalization', category: 'concept' },
      { term: 'Introgression (archaic admixture)', category: 'process' },
      { term: 'Population bottleneck (Toba)', category: 'concept' },
      { term: 'Recent positive selection', category: 'process' },
      { term: 'Language evolution', category: 'concept' },
      { term: 'Savanna hypothesis', category: 'concept' },
    ],
    keyConcepts: [
      'Humans are African great apes; our closest relatives are chimpanzees and bonobos',
      'Bipedalism evolved early in hominin evolution, preceding brain enlargement by millions of years',
      'Homo erectus was the first hominin to leave Africa and spread widely across the Old World',
      'Ancient DNA reveals that Homo sapiens interbred with Neanderthals and Denisovans',
      'The Out-of-Africa model is supported by genetic evidence showing modern humans originated in Africa',
      'Brain size increased dramatically in the genus Homo, likely driven by social and dietary factors',
      'Stone tool technology shows increasing complexity through hominin evolution (Oldowan to Acheulean and beyond)',
      'Human populations experienced genetic bottlenecks and subsequent expansions during migration out of Africa',
    ],
    keyExperiments: [
      'Johanson: Discovery of "Lucy" (Australopithecus afarensis), establishing early bipedalism',
      'Paabo: Sequencing of the Neanderthal genome revealing interbreeding with Homo sapiens',
      'White: Discovery and analysis of Ardipithecus ramidus, one of the earliest known hominins',
      'Green et al.: Identification of Denisovans from ancient DNA extracted from a finger bone',
      'Studies of FOXP2 gene mutations and their role in speech and language capacity',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ch 18: Evolutionary Medicine
  // ═══════════════════════════════════════════════════════════════
  {
    chapter: 18,
    title: 'Evolutionary Medicine',
    keyTerms: [
      { term: 'Evolutionary medicine (Darwinian medicine)', category: 'concept' },
      { term: 'Mismatch hypothesis', category: 'concept' },
      { term: 'Pathogen evolution', category: 'process' },
      { term: 'Antibiotic resistance', category: 'concept' },
      { term: 'Virulence evolution', category: 'concept' },
      { term: 'Virulence-transmission trade-off', category: 'concept' },
      { term: 'Zoonosis', category: 'concept' },
      { term: 'Emerging infectious disease', category: 'concept' },
      { term: 'Influenza (antigenic shift and drift)', category: 'process' },
      { term: 'Cancer as somatic evolution', category: 'concept' },
      { term: 'Clonal expansion (cancer)', category: 'process' },
      { term: 'Tumor heterogeneity', category: 'concept' },
      { term: 'MRSA (methicillin-resistant Staphylococcus aureus)', category: 'organism' },
      { term: 'Thrifty genotype hypothesis', category: 'concept' },
      { term: 'Hygiene hypothesis', category: 'concept' },
      { term: 'Autoimmune disease', category: 'disease' },
      { term: 'Type 2 diabetes', category: 'disease' },
      { term: 'Obesity', category: 'disease' },
      { term: 'Fever as adaptive response', category: 'concept' },
      { term: 'Smoke of defense hypothesis', category: 'concept' },
      { term: 'Antagonistic pleiotropy (disease)', category: 'concept' },
      { term: 'Pharmacogenomics', category: 'technique' },
    ],
    keyConcepts: [
      'Evolutionary medicine applies evolutionary principles to understand disease and health',
      'Mismatch between modern environments and ancestral adaptations contributes to chronic diseases (obesity, diabetes, allergies)',
      'Antibiotic resistance evolves through natural selection of resistant bacterial variants',
      'Virulence evolves as a trade-off between pathogen transmission success and host exploitation',
      'Cancer is somatic evolution: tumor cells undergo mutation, selection, and clonal expansion within the body',
      'The hygiene hypothesis suggests reduced pathogen exposure leads to immune dysregulation and autoimmune diseases',
      'Emerging infectious diseases often arise from zoonotic spillover events facilitated by ecological change',
      'Some disease symptoms (fever, nausea) may be evolved defenses rather than pathology',
    ],
    keyExperiments: [
      'Nesse and Williams: Foundational framework for evolutionary (Darwinian) medicine',
      'Lenski: Long-term E. coli evolution experiment demonstrating adaptation and emergence of novel traits',
      'Ewald: Virulence-transmission trade-off model predicting evolution of pathogen virulence',
      'Nowell: Clonal evolution model of cancer proposing tumors evolve by natural selection',
      'Studies of antibiotic resistance evolution in hospital settings (MRSA, tuberculosis)',
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/** Get a specific chapter's study content */
export function getEvolutionChapter(ch: number): ChapterStudyContent | null {
  return BIOL4230_STUDY_CONTENT.find(c => c.chapter === ch) || null;
}

/** Get all key terms across all chapters */
export function getAllEvolutionTerms(): KeyTerm[] {
  return BIOL4230_STUDY_CONTENT.flatMap(c => c.keyTerms);
}

/** Get evolution key terms filtered by category */
export function getEvolutionTermsByCategory(cat: KeyTerm['category']): KeyTerm[] {
  return getAllEvolutionTerms().filter(t => t.category === cat);
}
