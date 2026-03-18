/** BIOL 3020 Exam 2 Practicum — Type Definitions */

// ─── Taxonomy ──────────────────────────────────────────────────────────────

export type BiolTopic =
  | 'genomes'
  | 'chromatin-chromosomes'
  | 'bioinformatics'
  | 'dna-replication'
  | 'dna-repair'
  | 'nucleus'
  | 'other'

export type BiolHeading =
  | 'what-and-why'
  | 'key-players'
  | 'how-it-works'
  | 'know-the-differences'
  | 'consequences-failures'
  | 'apply-it'
  | 'exam-traps'

export type BiolSessionMode = 'timed' | 'practice' | 'weak-topics' | 'topic-drill' | 'due-review'

export type BiolQuestionType = 'mcq' | 'free-response' | 'scenario'

export interface BiolOption { label: string; text: string }

export interface BiolQuestion {
  id: string
  topic: BiolTopic
  heading: BiolHeading
  questionType: BiolQuestionType
  questionText: string
  options?: BiolOption[]        // for MCQ
  correctAnswer: string
  explanation: string
  examTag?: 'exam1' | 'exam2' | 'exam3'
  examRef?: string              // e.g. "2021 Q4"
  difficulty: 1 | 2 | 3 | 4 | 5
  wrongCount?: number
  srNextReview?: string         // YYYY-MM-DD
  srInterval?: number
}

export interface BiolAnswer {
  questionId: string
  userAnswer: string
  correct: boolean
  score: number                 // 0–100
  feedback?: string
  gradingStatus: 'pending' | 'graded' | 'skipped'
  timeMs: number
}

export interface BiolSession {
  id: string
  mode: BiolSessionMode
  topicFilter?: BiolTopic
  questionIds: string[]
  answers: Record<string, BiolAnswer>
  startedAt: string
  finishedAt?: string
  scrambleValues?: boolean
}

export interface BiolSessionSummary {
  id: string
  date: string
  mode: BiolSessionMode
  questionCount: number
  averageScore: number
  topicBreakdown: Record<BiolTopic, { count: number; avgScore: number }>
}

export interface BiolCourseData {
  questions: BiolQuestion[]
  sessionHistory: BiolSessionSummary[]
  currentStreak: number
  lastStreakDate: string
  version: number
}

// ─── Bubble content types ──────────────────────────────────────────────────

export interface BiolBullet {
  text: string
  isTrap?: boolean
  examRef?: string
}

export interface BiolHeadingContent {
  heading: BiolHeading
  label: string
  bullets: BiolBullet[]
}

export interface BiolBubble {
  id: string
  topic: BiolTopic
  title: string
  color: string
  headings: BiolHeadingContent[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function generateBiolId(): string {
  return `biol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function createEmptyBiolData(): BiolCourseData {
  return {
    questions: [...DEFAULT_BIOL_QUESTIONS],
    sessionHistory: [],
    currentStreak: 0,
    lastStreakDate: '',
    version: 1,
  }
}

export function migrateBiolCourseData(data: unknown): BiolCourseData {
  if (!data || typeof data !== 'object') return createEmptyBiolData()
  const r = data as Partial<BiolCourseData>
  return {
    questions: Array.isArray(r.questions) ? r.questions : [...DEFAULT_BIOL_QUESTIONS],
    sessionHistory: Array.isArray(r.sessionHistory) ? r.sessionHistory : [],
    currentStreak: typeof r.currentStreak === 'number' ? r.currentStreak : 0,
    lastStreakDate: typeof r.lastStreakDate === 'string' ? r.lastStreakDate : '',
    version: 1,
  }
}

export const TOPIC_LABELS: Record<BiolTopic, string> = {
  'genomes': 'Genomes',
  'chromatin-chromosomes': 'Chromatin & Chromosomes',
  'bioinformatics': 'Bioinformatics',
  'dna-replication': 'DNA Replication',
  'dna-repair': 'DNA Repair',
  'nucleus': 'The Nucleus',
  'other': 'Other',
}

export const TOPIC_COLORS: Record<BiolTopic, string> = {
  'genomes': '#22c55e',
  'chromatin-chromosomes': '#3b82f6',
  'bioinformatics': '#f59e0b',
  'dna-replication': '#8b5cf6',
  'dna-repair': '#ef4444',
  'nucleus': '#06b6d4',
  'other': '#6b7280',
}

export const HEADING_LABELS: Record<BiolHeading, string> = {
  'what-and-why': 'What & Why',
  'key-players': 'Key Players',
  'how-it-works': 'How It Works',
  'know-the-differences': 'Know the Differences',
  'consequences-failures': 'Consequences & Failures',
  'apply-it': 'Apply It',
  'exam-traps': 'Exam Traps',
}

// ─── Bubble data (complete study content) ─────────────────────────────────

export const BIOL_BUBBLES: BiolBubble[] = [
  {
    id: 'bubble-genomes',
    topic: 'genomes',
    title: 'Genomes',
    color: '#22c55e',
    headings: [
      {
        heading: 'what-and-why',
        label: 'What & Why',
        bullets: [
          { text: 'Genomics = study of entire genome content, size, organization, and composition' },
          { text: 'Purpose: understand why genomes differ, how complexity arose, where all the non-coding DNA comes from' },
          { text: 'Bigger genome ≠ more complex organism = C-value paradox' },
          { text: 'Best correlation: log genome size vs. % protein-coding DNA → r² ~0.99' },
        ],
      },
      {
        heading: 'key-players',
        label: 'Key Players',
        bullets: [
          { text: 'Protein-coding DNA = ~1.2% of human genome' },
          { text: 'Introns = ~30%' },
          { text: 'Retrotransposons + retroviral elements (LINEs + SINEs) = ~45% — biggest fraction' },
          { text: 'Simple sequence repeats = ~3%' },
          { text: 'DNA transposons = ~3%' },
          { text: 'Unique noncoding = ~25%' },
        ],
      },
      {
        heading: 'how-it-works',
        label: 'How It Works',
        bullets: [
          { text: "LINEs: copy-paste via RNA intermediate → LINE's own reverse transcriptase → new DNA copy inserted elsewhere. Up to 6 kb." },
          { text: "SINEs: same RNA copy-paste BUT borrows LINE's machinery. ~300 bp. Alu = main human SINE." },
          { text: 'DNA transposons: cut-paste directly via transposase. No RNA step.' },
          { text: "Simple sequence repeats: don't move. Short tandem repeats. Used in forensics/fingerprinting." },
          { text: 'Gene family: gene duplicates → copies diverge over time → related but distinct genes. Example: α-globin, β-globin, myoglobin.' },
          { text: 'Processed pseudogene: mRNA reverse transcribed → inserted into genome. No introns, no promoter = silent dead copy.' },
          { text: 'Shotgun sequencing: shred whole genome randomly → sequence all fragments → computer reassembles by overlapping sequences.' },
          { text: 'BAC-based: map genome first → sequence ordered BAC clones one-by-one. Organized, slower.' },
        ],
      },
      {
        heading: 'know-the-differences',
        label: 'Know the Differences',
        bullets: [
          { text: 'Shotgun vs. BAC: shotgun = random, no BACs; BAC = ordered, map-first' },
          { text: "LINEs vs. SINEs: LINEs encode their own reverse transcriptase; SINEs borrow it from LINEs" },
          { text: 'Bacteria vs. Yeast vs. Human: bacteria = circular/no introns/operons; yeast = linear/~6k genes/few introns; human = massive introns/repetitive DNA' },
          { text: 'lncRNA gene count tracks complexity better than protein-coding gene count' },
          { text: 'Gene family vs. pseudogene: gene family = functional copies; pseudogene = dead nonfunctional copy' },
        ],
      },
      {
        heading: 'consequences-failures',
        label: 'Consequences & Failures',
        bullets: [
          { text: 'Transposon jumping into a gene = disrupts function → mutation or disease' },
          { text: 'Retrotransposon expansion = genome bloat, contributes to genome size differences between species' },
          { text: 'Failure to suppress retrotransposons = genomic instability, insertional mutations' },
          { text: 'Processed pseudogenes = can rarely be "reactivated" if they pick up a promoter = chimeric transcript' },
        ],
      },
      {
        heading: 'apply-it',
        label: 'Apply It',
        bullets: [
          { text: "Given a genome with 45% repetitive DNA and 1.2% protein-coding: what's the biggest fraction? → Retrotransposons, not introns, not protein-coding", examRef: '2021 Q4' },
          { text: 'Given two sequencing descriptions — one uses random fragmentation + computer assembly, one uses ordered cloning — which is shotgun? → The random one, no BACs involved' },
          { text: 'Given a nonfunctional gene copy with no introns and no promoter — what type? → Processed pseudogene (retrotransposed mRNA copy)' },
        ],
      },
      {
        heading: 'exam-traps',
        label: 'Exam Traps',
        bullets: [
          { text: 'Retrotransposons (~45%) = biggest genome fraction, NOT protein-coding (~1.2%)', isTrap: true, examRef: '2021 Q4' },
          { text: 'Shotgun sequencing does NOT use BACs', isTrap: true },
          { text: 'Log genome size vs. % protein-coding = strongest correlation (r² ~0.99), not raw genome size', isTrap: true },
          { text: 'lncRNA tracks complexity better than protein-coding gene count', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'bubble-chromatin',
    topic: 'chromatin-chromosomes',
    title: 'Chromatin & Chromosomes',
    color: '#3b82f6',
    headings: [
      {
        heading: 'what-and-why',
        label: 'What & Why',
        bullets: [
          { text: 'Chromatin = DNA + proteins (histones + non-histones) — the physical form of packaged DNA inside the nucleus' },
          { text: 'Purpose: fit ~2 meters of DNA into a 6-micron nucleus + regulate which genes are accessible' },
          { text: 'Compaction levels: DNA → nucleosome (10 nm) → 30 nm fiber → loops → full chromosome' },
        ],
      },
      {
        heading: 'key-players',
        label: 'Key Players',
        bullets: [
          { text: 'Core histones: H2A, H2B, H3, H4 — 2 copies each = octamer (8 total)' },
          { text: 'H1 = linker histone, sits outside core, seals entry/exit DNA, required for 30 nm fiber' },
          { text: 'Non-histone proteins = scaffold proteins, transcription factors — more diverse types than histones' },
          { text: 'Nuclear lamina = lamin intermediate filaments lining inner nuclear membrane — structural support + heterochromatin anchor' },
          { text: 'Centromere = alpha-satellite AT-rich repeat DNA — kinetochore assembles here' },
          { text: "Telomere = TTAGGG repeats, 3' single-stranded overhang, stabilized by shelterin proteins" },
          { text: "Telomerase = ribonucleoprotein: has built-in RNA template + reverse transcriptase activity" },
        ],
      },
      {
        heading: 'how-it-works',
        label: 'How It Works',
        bullets: [
          { text: 'Nucleosome: 147 bp wraps around histone octamer → looks like beads on a string at 10 nm level' },
          { text: '30 nm fiber: nucleosomes coil into solenoid, 6 per turn, H1 required to stabilize' },
          { text: 'Loops: 30 nm fiber anchored to non-histone scaffold proteins → ~50,000–100,000 bp per loop' },
          { text: "Telomerase: RNA template base-pairs with 3' overhang → reverse transcriptase extends it (adds TTAGGG) → DNA pol + primase fill in other strand via lagging strand synthesis" },
          { text: 'Centromere: kinetochore assembles on centromeric DNA → spindle microtubules attach → chromosomes pulled to poles' },
          { text: 'Barr body = one inactivated X chromosome in female cells = condensed heterochromatin, silenced by lncRNA Xist' },
        ],
      },
      {
        heading: 'know-the-differences',
        label: 'Know the Differences',
        bullets: [
          { text: 'Heterochromatin: condensed, silent, late replication, at nuclear periphery' },
          { text: 'Euchromatin: open, active, early replication, at nuclear interior' },
          { text: "Centromere vs. telomere: centromere = AT-rich repeats, NO single-stranded regions; telomere = TTAGGG, HAS 3' single-stranded overhang" },
          { text: 'Histones in BOTH hetero- and euchromatin — NOT exclusive to either' },
          { text: 'Homologous chromosomes: occupy DIFFERENT chromosome territories in interphase — do NOT pair up' },
        ],
      },
      {
        heading: 'consequences-failures',
        label: 'Consequences & Failures',
        bullets: [
          { text: 'No telomerase in somatic cells → telomeres shorten each division → cell senescence → aging' },
          { text: 'Telomerase reactivated in cancer cells → telomeres maintained → cells become immortal' },
          { text: "Centromere deletion/mutation → kinetochore can't form → chromosome not pulled → aneuploidy (wrong chromosome number)" },
          { text: 'Lamin mutation (progeria disease) → nuclear lamina collapses → premature aging' },
          { text: 'Loss of H1 → 30 nm fiber destabilizes → chromatin more open → inappropriate gene expression' },
        ],
      },
      {
        heading: 'apply-it',
        label: 'Apply It',
        bullets: [
          { text: 'A somatic cell divides 50 times with no telomerase. What happens to telomere length? → Decreases each division → eventually triggers senescence. Mnemonic: somatic = shortening.' },
          { text: "You're told a region of chromatin replicates late in S phase and is transcriptionally silent. What type? → Heterochromatin." },
          { text: 'A protein has no NLS and is 15 kDa. Can it enter the nucleus? → Yes — freely diffuses through pore (<40 kDa threshold).' },
        ],
      },
      {
        heading: 'exam-traps',
        label: 'Exam Traps',
        bullets: [
          { text: 'Heterochromatin is NOT only at centromeres', isTrap: true, examRef: '2016, 2021, 2022, 2024' },
          { text: 'Histones are in BOTH hetero- and euchromatin', isTrap: true },
          { text: 'Centromeres have NO single-stranded regions — telomeres do', isTrap: true },
          { text: 'Telomere length DECREASES with age in somatic cells — NOT increases', isTrap: true },
          { text: 'Homologous chromosomes = DIFFERENT territories in interphase', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'bubble-bioinformatics',
    topic: 'bioinformatics',
    title: 'Bioinformatics',
    color: '#f59e0b',
    headings: [
      {
        heading: 'what-and-why',
        label: 'What & Why',
        bullets: [
          { text: 'Bioinformatics = using computers to store, retrieve, and analyze biological sequence data' },
          { text: 'Goals: find genes, predict function, compare sequences across species, infer evolutionary relationships' },
          { text: 'Main databases: NCBI (GenBank = DNA sequences, PubMed = literature), UniProt (proteins)' },
        ],
      },
      {
        heading: 'key-players',
        label: 'Key Players',
        bullets: [
          { text: 'NCBI = hub: sequences, genes, articles, BLAST, alignments, phylogenetic trees' },
          { text: 'PubMed = journal articles — search by author, keyword, title' },
          { text: 'BLAST = Basic Local Alignment Search Tool — finds similar sequences in database' },
          { text: 'ORF = Open Reading Frame = ATG → stop codon, no internal stops, long enough to encode protein' },
          { text: 'E-value = statistical chance a BLAST hit is random. Lower = better match.' },
          { text: 'UPGMA = algorithm building phylogenetic trees by grouping most similar sequences first' },
        ],
      },
      {
        heading: 'how-it-works',
        label: 'How It Works',
        bullets: [
          { text: '6-frame translation of genomic sequence → find ORFs → compare to known genes' },
          { text: 'Gene function prediction: BLAST unknown sequence → top hits are known genes → infer same function' },
          { text: 'Nucleotide alignment scoring: match = +1, mismatch = -2, gap = -5. Sum all positions.' },
          { text: 'Protein alignment adds conservative substitution tier: match > conservative sub > mismatch > gap' },
          { text: 'Conservative substitution = chemically similar amino acid swap (Leu→Ile, Lys→Arg, Asp→Glu)' },
          { text: 'E-value: lower = better. 1.0e-80 >> 1.0e-4. 0 = perfect match. 1.0 = likely random.' },
          { text: 'Phylogenetic tree: align homologous genes from all species → count differences → group most similar → build branching tree' },
          { text: 'UPGMA: groups two most similar first, then next most similar, builds outward until all connected' },
          { text: 'Molecular clock: gene mutates at constant rate → count mutations between species → estimate divergence time' },
        ],
      },
      {
        heading: 'know-the-differences',
        label: 'Know the Differences',
        bullets: [
          { text: 'Similarity vs. homology: similarity = %, quantifiable; homology = binary, yes/no, shared ancestor' },
          { text: 'Nucleotide vs. protein BLAST: protein detects more distant relationships (amino acids more conserved than nucleotides)' },
          { text: 'Node vs. clade: node = single branching point = one common ancestor; clade = ancestor + ALL descendants' },
          { text: 'Rooted vs. unrooted tree: rooted has defined ancestral base using outgroup; unrooted shows relationships only' },
          { text: 'Conservative sub applies to PROTEIN alignments only, not nucleotide alignments' },
        ],
      },
      {
        heading: 'consequences-failures',
        label: 'Consequences & Failures',
        bullets: [
          { text: 'Bad E-value cutoff → false positives in BLAST → wrong function predicted → bad science' },
          { text: 'Using non-homologous gene for phylogenetics → tree is wrong → false evolutionary relationships' },
          { text: 'Molecular clock gene under selection pressure → mutation rate not constant → inaccurate divergence dates' },
          { text: 'Ignoring gaps in alignment → inflated similarity score → overestimate relatedness' },
        ],
      },
      {
        heading: 'apply-it',
        label: 'Apply It',
        bullets: [
          { text: 'Alignment given: A-CGTAATG / ATCGTCATG. Score with +1, -2, -5. Count: gap(-5) + matches and mismatches.', examRef: '2024 Q3' },
          { text: 'Two genes share 90% identity in BLAST. Are they homologous? → You infer they are LIKELY homologous — you cannot say "90% homologous"', examRef: '2021 Q14' },
          { text: 'E-values given: 100, 1.0e4, -10, 1.0e-80, 1.0e10. Which strongest evidence? → 1.0e-80. -10 is impossible.', examRef: '2021 Q17, 2024 Q2' },
          { text: 'Given a phylogenetic tree, find common ancestor of two species → trace both lineages back to where they first join = their node' },
        ],
      },
      {
        heading: 'exam-traps',
        label: 'Exam Traps',
        bullets: [
          { text: 'NEVER say "X% homologous" — homology is binary', isTrap: true },
          { text: 'E-value is NEVER negative — -10 appeared as a trap answer', isTrap: true, examRef: '2021, 2024' },
          { text: 'Lower E-value = stronger match — students flip this constantly', isTrap: true },
          { text: 'Conservative substitutions only in PROTEIN alignments', isTrap: true, examRef: '2022 Q1' },
          { text: '"Likely homologous" requires high identity + low E-value — you\'re inferring, not proving', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'bubble-replication',
    topic: 'dna-replication',
    title: 'DNA Replication',
    color: '#8b5cf6',
    headings: [
      {
        heading: 'what-and-why',
        label: 'What & Why',
        bullets: [
          { text: 'Replication = copying the entire genome before cell division so each daughter cell gets a complete identical copy' },
          { text: "Semiconservative: each new double helix = 1 original strand + 1 new strand" },
          { text: "Rules: synthesis only 5'→3', always needs RNA primer to start, eukaryotes use thousands of origins" },
        ],
      },
      {
        heading: 'key-players',
        label: 'Key Players',
        bullets: [
          { text: 'Helicase: unwinds/separates strands at replication fork' },
          { text: 'Topoisomerase: relieves supercoiling tension ahead of helicase' },
          { text: 'SSB proteins: stabilize single-stranded DNA, prevent re-annealing' },
          { text: 'Primase: synthesizes short RNA primer (~10 nt) on both strands — RNA not DNA' },
          { text: "DNA Pol III: main synthesizer, extends from primer 5'→3', fast and accurate" },
          { text: "DNA Pol I: removes RNA primers via 5'→3' exonuclease, fills gaps with DNA" },
          { text: 'Sliding clamp: ring encircles DNA, keeps Pol III attached = processivity' },
          { text: 'Clamp-loading protein: loads sliding clamp AND tethers both polymerases + helicase into one replisome' },
          { text: "DNA Ligase: seals nicks between Okazaki fragments, joins 3'-OH to 5'-phosphate" },
        ],
      },
      {
        heading: 'how-it-works',
        label: 'How It Works',
        bullets: [
          { text: 'Helicase opens fork → SSBs stabilize → primase lays RNA primer → Pol III extends leading strand continuously' },
          { text: 'Lagging strand: new primer every ~1-2 kb → Pol III extends backward (Okazaki fragment) → Pol I removes primer + fills gap → ligase seals' },
          { text: 'Clamp-loading protein coordinates both polymerases so they move as one unit — lagging strand template loops around' },
          { text: 'Eukaryotes: thousands of origins fire simultaneously → replication bubbles merge → full linear chromosome copied' },
          { text: "Pol III has 3'→5' exonuclease = proofreading built in — catches its own errors in real time" },
          { text: "Telomerase extends 3' overhang after replication to prevent chromosome shortening" },
        ],
      },
      {
        heading: 'know-the-differences',
        label: 'Know the Differences',
        bullets: [
          { text: 'Leading vs. lagging: leading = continuous, 1 primer; lagging = discontinuous, Okazaki fragments, many primers' },
          { text: 'DNA Pol I vs. Pol III: Pol III = main synthesizer; Pol I = primer removal + gap fill only' },
          { text: 'Sliding clamp vs. clamp-loader: sliding clamp = processivity ring; clamp-loader = loads it + coordinates both strands' },
          { text: 'Bacteria vs. eukaryotes: bacteria = 1 circular origin; eukaryotes = thousands of linear origins' },
        ],
      },
      {
        heading: 'consequences-failures',
        label: 'Consequences & Failures',
        bullets: [
          { text: 'No primase → no primers → no replication at all — neither strand can start' },
          { text: 'No ligase → Okazaki fragments never joined → lagging strand remains fragmented → broken chromosomes' },
          { text: 'No helicase → fork never opens → replication stalls immediately' },
          { text: 'No topoisomerase → supercoiling builds up ahead of fork → replication physically jams' },
          { text: "No telomerase in somatic cells → lagging strand can't fully replicate chromosome end → telomere shortens each division" },
        ],
      },
      {
        heading: 'apply-it',
        label: 'Apply It',
        bullets: [
          { text: 'Given a replication fork diagram: identify which strand is leading (continuous, toward fork) and which is lagging (fragments, away from fork)' },
          { text: "Clamp-loading protein is mutated and can't tether both polymerases. What happens? → Leading and lagging strand synthesis become uncoordinated — fork slows or stalls", examRef: '2020 Q22' },
          { text: 'A cell lacks DNA Pol I. What accumulates? → RNA primers remain unremoved, gaps in lagging strand remain unfilled, Okazaki fragments are never completed' },
        ],
      },
      {
        heading: 'exam-traps',
        label: 'Exam Traps',
        bullets: [
          { text: 'Both strands are NOT synthesized continuously — lagging is discontinuous', isTrap: true, examRef: '2020 Q21' },
          { text: 'Primase makes RNA not DNA primers', isTrap: true, examRef: '2016 Q5' },
          { text: 'Clamp-loading protein coordinates BOTH polymerases — not just a ring loader', isTrap: true, examRef: '2020 Q22' },
          { text: 'DNA Ligase seals Okazaki fragments — NOT polymerase', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'bubble-repair',
    topic: 'dna-repair',
    title: 'DNA Repair',
    color: '#ef4444',
    headings: [
      {
        heading: 'what-and-why',
        label: 'What & Why',
        bullets: [
          { text: 'DNA is constantly damaged by replication errors, chemical exposure, and radiation' },
          { text: 'Without repair: mutations become permanent → cancer, aging, cell death' },
          { text: 'Each repair mechanism is specialized for one damage type — knowing which fixes what is the whole exam' },
        ],
      },
      {
        heading: 'key-players',
        label: 'Key Players',
        bullets: [
          { text: "DNA Pol (3'→5' exonuclease) = proofreading" },
          { text: 'Photolyase = light-activated enzyme that directly splits pyrimidine dimers. Humans lack this.' },
          { text: 'Alkyl/methyl-transferase = suicide enzyme for alkylated bases' },
          { text: 'DNA glycosylase = removes single damaged base in BER' },
          { text: 'AP endonuclease = cuts backbone at AP site in BER' },
          { text: 'NER enzyme complex = recognizes helix distortion, cuts ~25-30 nt patch' },
          { text: 'Mismatch repair proteins = scan for mismatches, distinguish new vs. old strand' },
          { text: 'Translesion polymerases = low-fidelity, bypass lesions when normal pol stalls' },
          { text: 'NHEJ proteins / HR machinery = fix double-strand breaks' },
        ],
      },
      {
        heading: 'how-it-works',
        label: 'How It Works',
        bullets: [
          { text: "Proofreading: pol adds wrong base → 3'→5' exonuclease backs up → removes wrong base → reinserts correct one" },
          { text: 'Photolyase: absorbs visible light → energy breaks covalent bond between dimerized pyrimidines. Direct reversal, no excision.' },
          { text: 'Alkyl-transferase: transfers methyl group from O⁶-methylguanine to itself → enzyme destroyed. One shot.' },
          { text: 'BER: glycosylase removes damaged base → AP endonuclease cuts backbone → pol fills 1 nt → ligase seals' },
          { text: 'NER: proteins sense helix distortion → cut strand ~25-30 nt on both sides → oligonucleotide released → pol fills → ligase seals' },
          { text: 'MMR: protein senses mismatch → identifies new strand (bacteria = unmethylated; eukaryotes = nicked strand) → excises segment → pol resynthesizes → ligase seals' },
          { text: 'Translesion: normal pol stalls → specialized pol swaps in → inserts base across lesion (often A) → hands back to normal pol. Error-prone.' },
          { text: 'NHEJ: broken ends directly joined. Fast. Can lose bases at junction. Any cell cycle phase.' },
          { text: 'HR: uses sister chromatid as perfect template. Accurate. Only S/G2 phase.' },
        ],
      },
      {
        heading: 'know-the-differences',
        label: 'Know the Differences',
        bullets: [
          { text: 'BER vs. NER: BER = removes 1 base (small damage); NER = removes 25-30 nt patch (bulky distorting lesions)' },
          { text: 'NHEJ vs. HR: both fix DSBs; NHEJ = fast + error-prone + any phase; HR = accurate + S/G2 only' },
          { text: 'Photolyase vs. NER: both fix pyrimidine dimers; photolyase = direct reversal using light; NER = excision + resynthesis. Humans only have NER.' },
          { text: 'Proofreading vs. MMR: proofreading = real-time during synthesis; MMR = post-replication patrol' },
          { text: 'Alkyl-transferase vs. BER: alkyl-transferase = direct chemical transfer, no excision; BER = removes and replaces base' },
        ],
      },
      {
        heading: 'consequences-failures',
        label: 'Consequences & Failures',
        bullets: [
          { text: "NER defect → XP disease → can't repair pyrimidine dimers → massive skin cancer from UV exposure", examRef: '2016 Q2' },
          { text: 'MMR defect → Lynch syndrome → inherited colon cancer risk → replication errors accumulate in dividing cells only' },
          { text: 'No proofreading → error rate increases ~100-1000x during replication' },
          { text: 'NHEJ error → bases lost at break junction → frameshift or deletion mutation' },
          { text: 'HR failure in S/G2 → DSB cannot be accurately repaired → chromosomal rearrangement or cell death' },
        ],
      },
      {
        heading: 'apply-it',
        label: 'Apply It',
        bullets: [
          { text: 'A patient gets extreme sunburns and develops skin cancer young. Which repair pathway is defective? → NER. Which disease? → XP.', examRef: '2016 Q2, 2020 Q26' },
          { text: "DNA pol incorporates wrong base. Two mechanisms to fix it? → Proofreading (immediate, by pol itself) + MMR (post-replication)", examRef: '2021 SA Q34, 2024 SA Q33' },
          { text: 'A cell is in G1 and gets a double-strand break. Which repair pathway? → NHEJ (HR requires sister chromatid, only available S/G2)' },
          { text: 'A repair enzyme transfers the methyl group to itself and gets destroyed. Which repair type? → Alkyl/methyl-transferase = suicide enzyme' },
        ],
      },
      {
        heading: 'exam-traps',
        label: 'Exam Traps',
        bullets: [
          { text: 'Humans lack photolyase — NER is ONLY UV repair in humans', isTrap: true, examRef: '2016, 2020, 2024' },
          { text: "Proofreading = 3'→5' exonuclease NOT 5'→3'", isTrap: true, examRef: '2022 Q3' },
          { text: 'NER removes ~25-30 nt patch NOT just 1 nucleotide — students confuse with BER', isTrap: true },
          { text: 'Pyrimidine dimers block BOTH replication AND transcription on that strand', isTrap: true },
          { text: 'Translesion synthesis is error-prone — it does NOT accurately repair, it bypasses', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'bubble-nucleus',
    topic: 'nucleus',
    title: 'The Nucleus',
    color: '#06b6d4',
    headings: [
      {
        heading: 'what-and-why',
        label: 'What & Why',
        bullets: [
          { text: 'Nucleus = membrane-bound compartment housing and protecting DNA, separated from cytoplasm' },
          { text: 'Why separate: RNA processing (splicing, capping, poly-A) completes BEFORE export = quality control checkpoint' },
          { text: 'What happens inside: DNA replication, transcription, RNA processing, ribosome subunit assembly' },
          { text: 'Nuclear envelope = inner membrane + outer membrane (outer is continuous with rough ER)' },
        ],
      },
      {
        heading: 'key-players',
        label: 'Key Players',
        bullets: [
          { text: 'Lamins = intermediate filament proteins lining inner membrane = nuclear lamina = structural support + chromatin anchor' },
          { text: 'Nucleoporins = ~30 proteins composing nuclear pore complexes (NPCs)' },
          { text: 'NLS = Nuclear Localization Signal = short basic amino acid patch on proteins destined for nucleus' },
          { text: 'NES = Nuclear Export Signal = leucine-rich hydrophobic sequence on proteins leaving nucleus' },
          { text: 'Importin (α + β) = cytoplasmic receptor binding NLS, escorts cargo to pore' },
          { text: 'Exportin = nuclear receptor binding NES + Ran-GTP, escorts cargo out' },
          { text: 'Ran = small GTPase. Ran-GTP = HIGH in nucleus (RanGEF there). Ran-GDP = HIGH in cytoplasm (RanGAP there).' },
          { text: 'NTF2 = reimports Ran-GDP back into nucleus to be recharged' },
        ],
      },
      {
        heading: 'how-it-works',
        label: 'How It Works',
        bullets: [
          { text: 'Import 1: importin binds NLS on protein in cytoplasm' },
          { text: 'Import 2: importin-cargo complex translocates through NPC into nucleus' },
          { text: 'Import 3: Ran-GTP (high in nucleus) binds importin → releases cargo inside nucleus' },
          { text: 'Import 4: importin + Ran-GTP exit nucleus through NPC' },
          { text: 'Import 5: in cytoplasm, RanGAP activates Ran to hydrolyze GTP → Ran-GDP → importin released, free to recycle' },
          { text: 'Import 6: Ran-GDP reimported by NTF2 → RanGEF in nucleus swaps GDP→GTP → Ran-GTP regenerated' },
          { text: 'Export: exportin + Ran-GTP + NES cargo form complex INSIDE nucleus → translocate out → RanGAP hydrolyzes → complex falls apart → cargo released in cytoplasm' },
          { text: 'Ran gradient drives everything: Ran-GTP high in nucleus = drives export complex formation AND import complex dissociation' },
          { text: 'mRNA export: uses NXF1/TAP pathway — completely separate from Ran system. mRNA must be capped + spliced + poly-A tailed first.' },
          { text: 'Nucleolus: rDNA → RNA Pol I → rRNA → assembled with ribosomal proteins → subunits exported to cytoplasm' },
        ],
      },
      {
        heading: 'know-the-differences',
        label: 'Know the Differences',
        bullets: [
          { text: 'Import vs. export: import = cargo released in nucleus by Ran-GTP; export = cargo released in cytoplasm when Ran-GTP hydrolyzed' },
          { text: 'Nuclear bodies vs. cytoplasmic organelles: nuclear bodies (nucleolus, Cajal, PML, speckles) have NO membrane' },
          { text: 'Heterochromatin vs. euchromatin location: heterochromatin at periphery near lamina; euchromatin at interior' },
          { text: 'mRNA export vs. protein transport: mRNA uses NXF1/TAP, completely different from Ran-based importin/exportin system' },
          { text: 'Small vs. large molecules: <40 kDa pass freely through pore; >40 kDa require active signal-mediated transport' },
        ],
      },
      {
        heading: 'consequences-failures',
        label: 'Consequences & Failures',
        bullets: [
          { text: "Importin mutation → proteins with NLS can't enter nucleus → transcription factors stuck in cytoplasm → gene expression fails" },
          { text: 'RanGAP inhibited → Ran-GTP stays high in cytoplasm → import complexes form but never release cargo → nuclear import jams' },
          { text: 'Lamin mutation → nuclear lamina collapses → nucleus deforms → progeria (premature aging disease)' },
          { text: 'NPC blocked → nothing in or out → nucleus isolated → replication, transcription, translation all fail' },
          { text: 'mRNA export blocked → processed mRNA trapped in nucleus → no protein synthesis in cytoplasm' },
        ],
      },
      {
        heading: 'apply-it',
        label: 'Apply It',
        bullets: [
          { text: 'A protein has NLS but importin is non-functional. Where does the protein stay? → Cytoplasm — importin must bind NLS first', examRef: '2016, 2021, 2024 Q4' },
          { text: "Ran-GTP is experimentally depleted from nucleus. What happens to nuclear import? → Import fails — cargo reaches pore but can't be released inside nucleus", examRef: '2020 SA Q31' },
          { text: 'What is exported from nucleus vs. imported? → Exported: processed mRNA, rRNA subunits, tRNA. Imported: proteins with NLS.' },
          { text: 'A 200 kDa protein has no NLS. Can it enter the nucleus? → No — too large to diffuse freely, no signal for active transport' },
        ],
      },
      {
        heading: 'exam-traps',
        label: 'Exam Traps',
        bullets: [
          { text: 'Importin alone CANNOT release cargo — needs Ran-GTP', isTrap: true, examRef: '2020' },
          { text: 'GTP hydrolysis occurs in CYTOPLASM (RanGAP is cytoplasmic) NOT in nucleus', isTrap: true },
          { text: 'NLS does NOT need to be at N-terminus — it can be anywhere in protein', isTrap: true },
          { text: 'NLS is recognized by IMPORTIN not Ran, not exportin', isTrap: true, examRef: '2016, 2021, 2024' },
          { text: 'mRNA export does NOT use the Ran system', isTrap: true },
          { text: 'Nucleolus is NOT membrane-bound — it is a nuclear body', isTrap: true, examRef: '2021 Q30' },
          { text: 'Molecules exported = processed mRNA. NOT unprocessed mRNA, NOT DNA', isTrap: true, examRef: '2016 Q3, 2021, 2024 Q4' },
        ],
      },
    ],
  },
]

// ─── Default questions (~30, derived from Apply It + Exam Traps) ───────────

export const DEFAULT_BIOL_QUESTIONS: BiolQuestion[] = [
  // ── GENOMES ──
  {
    id: 'biol-q001',
    topic: 'genomes',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: 'A human genome contains approximately 45% repetitive DNA. Which fraction is the single largest category?',
    options: [
      { label: 'A', text: 'Protein-coding genes (~1.2%)' },
      { label: 'B', text: 'Introns (~30%)' },
      { label: 'C', text: 'Retrotransposons and retroviral elements (LINEs + SINEs, ~45%)' },
      { label: 'D', text: 'Simple sequence repeats (~3%)' },
    ],
    correctAnswer: 'C',
    explanation: 'Retrotransposons (LINEs + SINEs) make up ~45% of the human genome — the single largest fraction. Protein-coding DNA is only ~1.2%.',
    examTag: 'exam2',
    examRef: '2021 Q4',
    difficulty: 2,
  },
  {
    id: 'biol-q002',
    topic: 'genomes',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which sequencing strategy does NOT use BAC clones?',
    options: [
      { label: 'A', text: 'BAC-based hierarchical shotgun' },
      { label: 'B', text: 'Whole-genome shotgun sequencing' },
      { label: 'C', text: 'Clone-by-clone sequencing' },
      { label: 'D', text: 'Map-first, sequence-second approach' },
    ],
    correctAnswer: 'B',
    explanation: 'Whole-genome shotgun sequencing randomly shreds the genome and reassembles computationally — it does NOT use BAC clones. BAC-based approaches require ordered mapping first.',
    examTag: 'exam2',
    difficulty: 2,
  },
  {
    id: 'biol-q003',
    topic: 'genomes',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: 'A gene copy is found with no introns, no promoter, and a poly-A tail at one end. What type of sequence is this?',
    options: [
      { label: 'A', text: 'Functional gene family member' },
      { label: 'B', text: 'DNA transposon' },
      { label: 'C', text: 'Processed pseudogene' },
      { label: 'D', text: 'LINE element' },
    ],
    correctAnswer: 'C',
    explanation: 'A processed pseudogene is created when mRNA is reverse-transcribed back into DNA and inserted into the genome. It lacks introns (they were spliced out) and has no promoter — it is a non-functional dead copy.',
    examTag: 'exam2',
    difficulty: 3,
  },
  {
    id: 'biol-q004',
    topic: 'genomes',
    heading: 'know-the-differences',
    questionType: 'free-response',
    questionText: 'Explain the difference between LINEs and SINEs in terms of their mechanism of transposition and their dependence on each other.',
    correctAnswer: 'LINEs encode their own reverse transcriptase and can transpose autonomously via an RNA intermediate. SINEs use the same RNA copy-paste mechanism but lack reverse transcriptase — they borrow LINEs\' machinery. SINEs are therefore non-autonomous and dependent on LINEs for mobility.',
    explanation: 'Both LINEs and SINEs are retrotransposons that move via RNA intermediates, but only LINEs are autonomous. Alu is the main human SINE at ~300 bp.',
    examTag: 'exam2',
    difficulty: 3,
  },
  {
    id: 'biol-q005',
    topic: 'genomes',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which metric shows the STRONGEST correlation with organism complexity?',
    options: [
      { label: 'A', text: 'Raw genome size in base pairs' },
      { label: 'B', text: 'Number of protein-coding genes' },
      { label: 'C', text: 'Log genome size vs. percentage protein-coding DNA' },
      { label: 'D', text: 'Number of chromosomes' },
    ],
    correctAnswer: 'C',
    explanation: 'Log genome size vs. % protein-coding DNA has an r² of ~0.99, the strongest correlation. Raw genome size shows the C-value paradox (bigger ≠ more complex). Protein-coding gene count alone does not track complexity well.',
    examTag: 'exam2',
    difficulty: 2,
  },

  // ── CHROMATIN & CHROMOSOMES ──
  {
    id: 'biol-q006',
    topic: 'chromatin-chromosomes',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: 'A somatic cell undergoes 50 divisions with no telomerase activity. What happens to telomere length?',
    options: [
      { label: 'A', text: 'Increases due to DNA replication at origins near telomeres' },
      { label: 'B', text: 'Remains constant — telomeres are protected by shelterin' },
      { label: 'C', text: 'Decreases with each division → eventually triggers senescence' },
      { label: 'D', text: 'Is replaced by retrotransposon insertion' },
    ],
    correctAnswer: 'C',
    explanation: 'Without telomerase, the lagging strand cannot fully replicate the chromosome end, so telomeres shorten with each division. Eventually shortening triggers cell senescence or apoptosis.',
    examTag: 'exam2',
    difficulty: 2,
  },
  {
    id: 'biol-q007',
    topic: 'chromatin-chromosomes',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which statement about heterochromatin is CORRECT?',
    options: [
      { label: 'A', text: 'Heterochromatin is found only at centromeres' },
      { label: 'B', text: 'Heterochromatin lacks histones' },
      { label: 'C', text: 'Heterochromatin is condensed, transcriptionally silent, and located at the nuclear periphery' },
      { label: 'D', text: 'Heterochromatin replicates early in S phase' },
    ],
    correctAnswer: 'C',
    explanation: 'Heterochromatin is condensed, transcriptionally silent, replicates LATE in S phase, and is located at the nuclear periphery near the lamina. It is NOT only at centromeres and does contain histones.',
    examTag: 'exam2',
    examRef: '2016, 2021, 2022, 2024',
    difficulty: 2,
  },
  {
    id: 'biol-q008',
    topic: 'chromatin-chromosomes',
    heading: 'know-the-differences',
    questionType: 'mcq',
    questionText: 'Which structural feature distinguishes a telomere from a centromere?',
    options: [
      { label: 'A', text: 'Telomeres contain AT-rich alpha-satellite repeats; centromeres do not' },
      { label: "B", text: "Telomeres have a 3' single-stranded DNA overhang; centromeres do not" },
      { label: 'C', text: 'Only centromeres are protected by shelterin proteins' },
      { label: 'D', text: 'Only telomeres assemble kinetochores' },
    ],
    correctAnswer: 'B',
    explanation: "Telomeres have a 3' single-stranded G-rich overhang stabilized by shelterin. Centromeres contain alpha-satellite AT-rich repeats and assemble kinetochores — they have NO single-stranded regions.",
    examTag: 'exam2',
    difficulty: 3,
  },
  {
    id: 'biol-q009',
    topic: 'chromatin-chromosomes',
    heading: 'apply-it',
    questionType: 'free-response',
    questionText: 'A region of chromatin replicates late in S phase and is transcriptionally silent. What type of chromatin is this, and where would you find it in the interphase nucleus?',
    correctAnswer: 'This is heterochromatin. It is located at the nuclear periphery, near the nuclear lamina. Heterochromatin is condensed, transcriptionally inactive, and replicates late in S phase.',
    explanation: 'Euchromatin is open, active, and replicates early. Heterochromatin is the condensed, silent form at the periphery.',
    examTag: 'exam2',
    difficulty: 2,
  },
  {
    id: 'biol-q010',
    topic: 'chromatin-chromosomes',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'In interphase, where do homologous chromosomes reside relative to each other?',
    options: [
      { label: 'A', text: 'They are paired together at the nuclear center' },
      { label: 'B', text: 'They occupy separate, distinct chromosome territories and do NOT pair up' },
      { label: 'C', text: 'They are both at the nuclear periphery in heterochromatin' },
      { label: 'D', text: 'They are fused at centromeres during interphase' },
    ],
    correctAnswer: 'B',
    explanation: 'Homologous chromosomes occupy DIFFERENT chromosome territories in interphase — they do not pair up until meiosis.',
    examTag: 'exam2',
    difficulty: 2,
  },

  // ── BIOINFORMATICS ──
  {
    id: 'biol-q011',
    topic: 'bioinformatics',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Two proteins share 85% sequence identity in a BLAST search. Which statement is correct?',
    options: [
      { label: 'A', text: 'They are 85% homologous' },
      { label: 'B', text: 'They are likely homologous, sharing a common ancestor' },
      { label: 'C', text: 'Homology can only be determined by X-ray crystallography' },
      { label: 'D', text: 'High similarity means they are definitely identical in function' },
    ],
    correctAnswer: 'B',
    explanation: 'Homology is binary — sequences either share a common ancestor or they do not. You CANNOT say "85% homologous." High similarity with a low E-value allows you to INFER they are likely homologous.',
    examTag: 'exam2',
    examRef: '2021 Q14',
    difficulty: 2,
  },
  {
    id: 'biol-q012',
    topic: 'bioinformatics',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: 'A BLAST search returns E-values of: 100, 1.0e4, -10, 1.0e-80, 1.0e10. Which E-value represents the strongest evidence of homology?',
    options: [
      { label: 'A', text: '100' },
      { label: 'B', text: '-10' },
      { label: 'C', text: '1.0e-80' },
      { label: 'D', text: '1.0e10' },
    ],
    correctAnswer: 'C',
    explanation: '1.0e-80 is the strongest match — E-values approaching 0 mean extremely unlikely to be random. E-values are NEVER negative, so -10 is impossible and would be a trap answer.',
    examTag: 'exam2',
    examRef: '2021 Q17, 2024 Q2',
    difficulty: 2,
  },
  {
    id: 'biol-q013',
    topic: 'bioinformatics',
    heading: 'know-the-differences',
    questionType: 'mcq',
    questionText: 'Which type of BLAST search is better for detecting distantly related proteins?',
    options: [
      { label: 'A', text: 'Nucleotide BLAST (blastn) — because DNA is more conserved' },
      { label: 'B', text: 'Protein BLAST (blastp) — because amino acid sequences are more conserved than nucleotides' },
      { label: 'C', text: 'Both are equally sensitive for distant homologs' },
      { label: 'D', text: 'Nucleotide BLAST because it uses a longer query sequence' },
    ],
    correctAnswer: 'B',
    explanation: 'Protein BLAST is more sensitive for distant evolutionary relationships because amino acid sequences change more slowly than DNA sequences (multiple codons can encode the same amino acid).',
    examTag: 'exam2',
    difficulty: 2,
  },
  {
    id: 'biol-q014',
    topic: 'bioinformatics',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Conservative substitutions are scored in which type of alignment?',
    options: [
      { label: 'A', text: 'Nucleotide alignments only' },
      { label: 'B', text: 'Both nucleotide and protein alignments' },
      { label: 'C', text: 'Protein alignments only' },
      { label: 'D', text: 'Conservative substitutions are penalized in all alignments' },
    ],
    correctAnswer: 'C',
    explanation: 'Conservative substitutions (chemically similar amino acid swaps like Leu→Ile) apply ONLY to protein alignments. Nucleotide alignments only distinguish match, mismatch, and gap.',
    examTag: 'exam2',
    examRef: '2022 Q1',
    difficulty: 2,
  },
  {
    id: 'biol-q015',
    topic: 'bioinformatics',
    heading: 'apply-it',
    questionType: 'free-response',
    questionText: 'A nucleotide alignment scoring scheme uses: match = +1, mismatch = -2, gap = -5. Calculate the score for this alignment:\nStrand 1: A-CGTAATG\nStrand 2: ATCGTCATG',
    correctAnswer: 'Positions: A/A (+1), gap/T (-5), C/C (+1), G/G (+1), T/T (+1), A/C (-2), A/A (+1), T/T (+1), G/G (+1). Total = +1 -5 +1 +1 +1 -2 +1 +1 +1 = 0.',
    explanation: 'Each column is scored independently. Gaps incur the largest penalty. Count each column carefully using the scoring matrix.',
    examTag: 'exam2',
    examRef: '2024 Q3',
    difficulty: 4,
  },

  // ── DNA REPLICATION ──
  {
    id: 'biol-q016',
    topic: 'dna-replication',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which statement about DNA replication is CORRECT?',
    options: [
      { label: 'A', text: 'Both the leading and lagging strands are synthesized continuously' },
      { label: 'B', text: 'The lagging strand is synthesized discontinuously as Okazaki fragments' },
      { label: 'C', text: 'Primase synthesizes short DNA primers to initiate synthesis' },
      { label: 'D', text: 'DNA Ligase synthesizes new DNA to fill primer gaps' },
    ],
    correctAnswer: 'B',
    explanation: 'Only the leading strand is synthesized continuously. The lagging strand is made in short Okazaki fragments because synthesis must go 5\'→3\' but the template runs 3\'→5\'. Primase makes RNA (not DNA) primers. Ligase seals nicks, not fills gaps.',
    examTag: 'exam2',
    examRef: '2020 Q21',
    difficulty: 2,
  },
  {
    id: 'biol-q017',
    topic: 'dna-replication',
    heading: 'key-players',
    questionType: 'mcq',
    questionText: 'Which enzyme removes RNA primers and fills in the gaps with DNA during lagging strand synthesis in bacteria?',
    options: [
      { label: 'A', text: 'DNA Pol III' },
      { label: 'B', text: 'DNA Pol I' },
      { label: 'C', text: 'Primase' },
      { label: 'D', text: 'DNA Ligase' },
    ],
    correctAnswer: 'B',
    explanation: "DNA Pol I uses its 5'→3' exonuclease to remove RNA primers and then fills the gap with DNA. DNA Pol III is the main synthesizer. Ligase seals the final nick.",
    examTag: 'exam2',
    difficulty: 2,
  },
  {
    id: 'biol-q018',
    topic: 'dna-replication',
    heading: 'apply-it',
    questionType: 'free-response',
    questionText: 'A mutation inactivates the clamp-loading protein so it can no longer tether both polymerases together. What happens to replication fork progression?',
    correctAnswer: 'The clamp-loading protein normally coordinates the leading and lagging strand polymerases into a single replisome complex. Without this tethering, leading and lagging strand synthesis become uncoordinated — the fork slows or stalls because the two strands cannot be synthesized at the same rate.',
    explanation: 'The clamp-loading protein does more than load the sliding clamp — it coordinates the entire replisome. This is a common exam question about its role beyond just loading the clamp.',
    examTag: 'exam2',
    examRef: '2020 Q22',
    difficulty: 4,
  },
  {
    id: 'biol-q019',
    topic: 'dna-replication',
    heading: 'consequences-failures',
    questionType: 'mcq',
    questionText: 'What happens if DNA Ligase is completely non-functional during replication?',
    options: [
      { label: 'A', text: 'Replication cannot initiate because primers cannot be laid down' },
      { label: 'B', text: 'Okazaki fragments are never joined → lagging strand remains fragmented → broken chromosomes' },
      { label: 'C', text: 'RNA primers are never removed, leaving RNA in the final DNA' },
      { label: 'D', text: 'Topoisomerase builds up supercoiling stress and the fork jams' },
    ],
    correctAnswer: 'B',
    explanation: 'DNA Ligase joins Okazaki fragments by sealing the nicks. Without it, the lagging strand stays as unjoined fragments, resulting in broken chromosomes after cell division.',
    examTag: 'exam2',
    difficulty: 3,
  },
  {
    id: 'biol-q020',
    topic: 'dna-replication',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'What does primase synthesize?',
    options: [
      { label: 'A', text: 'Short DNA primers to initiate synthesis' },
      { label: 'B', text: 'Short RNA primers to initiate synthesis' },
      { label: 'C', text: 'Okazaki fragments on the lagging strand' },
      { label: 'D', text: 'The leading strand continuously from the origin' },
    ],
    correctAnswer: 'B',
    explanation: 'Primase synthesizes short RNA primers (~10 nt) — NOT DNA primers. This is a classic trap. DNA polymerases cannot start from scratch; they require a primer.',
    examTag: 'exam2',
    examRef: '2016 Q5',
    difficulty: 1,
  },

  // ── DNA REPAIR ──
  {
    id: 'biol-q021',
    topic: 'dna-repair',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: 'A patient develops severe sunburns with minimal UV exposure and has a very high rate of skin cancer at a young age. Which DNA repair pathway is most likely defective?',
    options: [
      { label: 'A', text: 'Mismatch repair (MMR)' },
      { label: 'B', text: 'Homologous recombination (HR)' },
      { label: 'C', text: 'Nucleotide excision repair (NER)' },
      { label: 'D', text: 'Base excision repair (BER)' },
    ],
    correctAnswer: 'C',
    explanation: 'This is the classic Xeroderma Pigmentosum (XP) presentation. UV causes pyrimidine dimers, which are repaired by NER in humans. A NER defect causes UV-induced dimers to accumulate → skin cancer. Humans lack photolyase.',
    examTag: 'exam2',
    examRef: '2016 Q2, 2020 Q26',
    difficulty: 2,
  },
  {
    id: 'biol-q022',
    topic: 'dna-repair',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Why do humans NOT use photolyase to repair UV-induced pyrimidine dimers?',
    options: [
      { label: 'A', text: 'Humans have photolyase but it requires darkness rather than light' },
      { label: 'B', text: 'Humans lack the photolyase enzyme — they rely exclusively on NER for UV damage repair' },
      { label: 'C', text: 'Photolyase only works in bacteria, not eukaryotes' },
      { label: 'D', text: 'Humans use BER instead of photolyase for pyrimidine dimers' },
    ],
    correctAnswer: 'B',
    explanation: 'Humans lack photolyase entirely. NER is the sole mechanism for removing pyrimidine dimers in humans. This is a high-frequency exam trap.',
    examTag: 'exam2',
    examRef: '2016, 2020, 2024',
    difficulty: 2,
  },
  {
    id: 'biol-q023',
    topic: 'dna-repair',
    heading: 'know-the-differences',
    questionType: 'mcq',
    questionText: 'Which repair mechanism removes a patch of approximately 25-30 nucleotides flanking a lesion?',
    options: [
      { label: 'A', text: 'Base excision repair (BER)' },
      { label: 'B', text: 'Mismatch repair (MMR)' },
      { label: 'C', text: 'Nucleotide excision repair (NER)' },
      { label: 'D', text: 'Proofreading by DNA Pol' },
    ],
    correctAnswer: 'C',
    explanation: 'NER removes a ~25-30 nt oligonucleotide patch around helix-distorting lesions like pyrimidine dimers. BER removes only a single damaged base. Students often confuse BER and NER on this point.',
    examTag: 'exam2',
    difficulty: 2,
  },
  {
    id: 'biol-q024',
    topic: 'dna-repair',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: 'A cell is in G1 phase and sustains a double-strand break. Which repair pathway is most likely used?',
    options: [
      { label: 'A', text: 'Homologous recombination (HR) — uses sister chromatid' },
      { label: 'B', text: 'Non-homologous end joining (NHEJ) — available in any cell cycle phase' },
      { label: 'C', text: 'Nucleotide excision repair (NER)' },
      { label: 'D', text: 'Mismatch repair (MMR)' },
    ],
    correctAnswer: 'B',
    explanation: 'HR requires a sister chromatid as a template and is only available in S/G2 phase after DNA replication. In G1, NHEJ is the primary DSB repair pathway — it is fast but can lose bases at the junction.',
    examTag: 'exam2',
    difficulty: 3,
  },
  {
    id: 'biol-q025',
    topic: 'dna-repair',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: 'A repair enzyme transfers an alkyl group from a damaged base to itself, permanently inactivating the enzyme. What type of repair is this?',
    options: [
      { label: 'A', text: 'Base excision repair (BER)' },
      { label: 'B', text: 'Nucleotide excision repair (NER)' },
      { label: 'C', text: 'Alkyl/methyl-transferase direct reversal (suicide enzyme)' },
      { label: 'D', text: 'Translesion synthesis' },
    ],
    correctAnswer: 'C',
    explanation: 'Alkyl-transferase (also called methyl-transferase) is a "suicide enzyme" — it accepts the alkyl group onto itself and is permanently inactivated. This is direct reversal, not excision.',
    examTag: 'exam2',
    difficulty: 3,
  },

  // ── NUCLEUS ──
  {
    id: 'biol-q026',
    topic: 'nucleus',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: 'A protein has a functional NLS but importin is non-functional. Where will this protein be found?',
    options: [
      { label: 'A', text: 'In the nucleus — the NLS is sufficient for entry' },
      { label: 'B', text: 'In the cytoplasm — importin must bind the NLS to escort the protein through the NPC' },
      { label: 'C', text: 'Degraded in the proteasome — unescorted proteins are degraded' },
      { label: 'D', text: 'On the nuclear envelope outer membrane' },
    ],
    correctAnswer: 'B',
    explanation: 'The NLS is recognized BY importin. Without functional importin, the NLS signal cannot be read and the protein cannot enter the nucleus. It stays in the cytoplasm.',
    examTag: 'exam2',
    examRef: '2016, 2021, 2024 Q4',
    difficulty: 2,
  },
  {
    id: 'biol-q027',
    topic: 'nucleus',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Where does GTP hydrolysis of Ran occur, and what does this step accomplish?',
    options: [
      { label: 'A', text: 'In the nucleus — Ran-GTP hydrolysis releases cargo from importin inside the nucleus' },
      { label: 'B', text: 'In the cytoplasm — RanGAP catalyzes hydrolysis, converting Ran-GTP to Ran-GDP, which releases importin' },
      { label: 'C', text: 'At the nuclear pore — hydrolysis drives cargo through the pore by a power stroke' },
      { label: 'D', text: 'In the endoplasmic reticulum — Ran is activated there before transport' },
    ],
    correctAnswer: 'B',
    explanation: 'RanGAP is located in the CYTOPLASM and catalyzes GTP hydrolysis. This converts Ran-GTP → Ran-GDP, causing the importin-Ran complex to fall apart and releasing importin to recycle. The release of CARGO from importin happens inside the nucleus (by Ran-GTP binding importin).',
    examTag: 'exam2',
    difficulty: 4,
  },
  {
    id: 'biol-q028',
    topic: 'nucleus',
    heading: 'apply-it',
    questionType: 'free-response',
    questionText: 'Ran-GTP is experimentally depleted from the nucleus while maintaining normal Ran-GDP levels in the cytoplasm. What happens to nuclear protein import, and why?',
    correctAnswer: 'Nuclear import fails. Ran-GTP inside the nucleus is required to bind importin and release the cargo (NLS-containing protein). Without Ran-GTP in the nucleus, the importin-cargo complex enters the NPC but cannot dissociate — cargo is never released inside the nucleus.',
    explanation: 'The Ran-GTP gradient (high inside nucleus, low in cytoplasm) is the driving force for directional transport. It is maintained by RanGEF (nuclear) and RanGAP (cytoplasmic).',
    examTag: 'exam2',
    examRef: '2020 SA Q31',
    difficulty: 4,
  },
  {
    id: 'biol-q029',
    topic: 'nucleus',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which molecules are exported from the nucleus? (Select the CORRECT answer)',
    options: [
      { label: 'A', text: 'Unprocessed pre-mRNA and DNA' },
      { label: 'B', text: 'Processed mRNA, ribosomal subunits, and tRNA' },
      { label: 'C', text: 'Importins carrying NLS-tagged proteins' },
      { label: 'D', text: 'Histones and lamins' },
    ],
    correctAnswer: 'B',
    explanation: 'Only fully processed mRNA (capped, spliced, poly-A tailed), ribosomal subunits, and tRNA are exported. Unprocessed RNA is retained as a quality control step. DNA is never exported.',
    examTag: 'exam2',
    examRef: '2016 Q3, 2021, 2024 Q4',
    difficulty: 2,
  },
  {
    id: 'biol-q030',
    topic: 'nucleus',
    heading: 'know-the-differences',
    questionType: 'mcq',
    questionText: 'The nucleolus is best described as:',
    options: [
      { label: 'A', text: 'A membrane-bound organelle inside the nucleus where rRNA is processed' },
      { label: 'B', text: 'A non-membrane-bound nuclear body where rDNA is transcribed and ribosome subunits are assembled' },
      { label: 'C', text: 'A region of the nuclear envelope where nuclear pores are concentrated' },
      { label: 'D', text: 'A chromatin domain composed exclusively of heterochromatin' },
    ],
    correctAnswer: 'B',
    explanation: 'The nucleolus is a nuclear body — it has NO membrane. It is where rDNA (ribosomal DNA) is transcribed by RNA Pol I into rRNA, and ribosomal proteins are assembled into subunits for export.',
    examTag: 'exam2',
    examRef: '2021 Q30',
    difficulty: 2,
  },
]
