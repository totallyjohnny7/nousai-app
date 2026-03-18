/** Evolution Exam 2 Practicum — Type Definitions */

// ─── Taxonomy ──────────────────────────────────────────────────────────────

export type EvolTopic =
  | 'natural-selection'
  | 'genetic-drift'
  | 'speciation'
  | 'phylogenetics'
  | 'adaptation'
  | 'population-genetics'
  | 'evolution-of-sex'
  | 'coevolution'
  | 'evo-devo'
  | 'life-history'
  | 'behavior'
  | 'other'

export type EvolHeading =
  | 'what-and-why'
  | 'key-players'
  | 'how-it-works'
  | 'know-the-differences'
  | 'consequences-and-failures'
  | 'apply-it'
  | 'exam-traps'

export type EvolSessionMode =
  | 'timed'
  | 'practice'
  | 'weak-topics'
  | 'topic-drill'
  | 'heading-drill'
  | 'due-review'

export type EvolQuestionType = 'mcq' | 'free-response' | 'scenario'

export interface EvolQuestion {
  id: string
  topic: EvolTopic
  heading: EvolHeading
  questionType: EvolQuestionType
  questionText: string
  options?: string[]
  correctIndex?: number
  expectedAnswer: string
  difficulty: 1 | 2 | 3 | 4 | 5
  examTag?: 'exam1' | 'exam2' | 'exam3'
  wrongCount?: number
  lastReviewDate?: string
  srNextReview?: string
  srInterval?: number
}

export interface EvolAnswer {
  questionId: string
  userAnswer: string
  score: number
  correct: boolean
  feedback?: string
  timeTaken?: number
  gradingStatus: 'pending' | 'graded' | 'skipped'
  timeMs: number
}

export interface EvolSession {
  id: string
  mode: EvolSessionMode
  topicFilter?: EvolTopic[]
  headingFilter?: EvolHeading
  questionIds: string[]
  answers: Record<string, EvolAnswer>
  startedAt: string
  finishedAt?: string
}

export interface EvolSessionSummary {
  id: string
  date: string
  mode: EvolSessionMode
  questionCount: number
  averageScore: number
  topicBreakdown: Record<string, { count: number; avgScore: number }>
}

export interface EvolCourseData {
  version: number
  questions: EvolQuestion[]
  sessionHistory: EvolSessionSummary[]
  currentStreak: number
  lastStreakDate: string
}

export interface EvolBullet {
  text: string
  isTrap?: boolean
  examRef?: string
}

export interface EvolHeadingContent {
  heading: EvolHeading
  bullets: EvolBullet[]
}

export interface EvolBubble {
  id: string
  chapter: 'ch10' | 'ch11' | 'ch12' | 'ch15' | 'ch16'
  chapterLabel: string
  topic: EvolTopic
  title: string
  color: string
  headings: EvolHeadingContent[]
}

// ─── Labels & Colors ───────────────────────────────────────────────────────

export const TOPIC_LABELS: Record<EvolTopic, string> = {
  'natural-selection': 'Natural Selection',
  'genetic-drift': 'Genetic Drift',
  'speciation': 'Speciation',
  'phylogenetics': 'Phylogenetics',
  'adaptation': 'Adaptation',
  'population-genetics': 'Pop. Genetics',
  'evolution-of-sex': 'Evolution of Sex',
  'coevolution': 'Coevolution',
  'evo-devo': 'Evo-Devo',
  'life-history': 'Life History',
  'behavior': 'Behavior',
  'other': 'Other',
}

export const TOPIC_COLORS: Record<EvolTopic, string> = {
  'natural-selection': '#4ade80',
  'genetic-drift': '#fb923c',
  'speciation': '#38bdf8',
  'phylogenetics': '#a78bfa',
  'adaptation': '#facc15',
  'population-genetics': '#f472b6',
  'evolution-of-sex': '#f472b6',
  'coevolution': '#a78bfa',
  'evo-devo': '#4ade80',
  'life-history': '#fb923c',
  'behavior': '#38bdf8',
  'other': '#6b7280',
}

export const CHAPTER_COLORS: Record<string, string> = {
  ch10: '#4ade80',
  ch11: '#f472b6',
  ch12: '#fb923c',
  ch15: '#a78bfa',
  ch16: '#38bdf8',
}

export const CHAPTER_LABELS: Record<string, string> = {
  ch10: 'CH 10 — Evo-Devo',
  ch11: 'CH 11 — Sex',
  ch12: 'CH 12 — Life History',
  ch15: 'CH 15 — Coevolution',
  ch16: 'CH 16 — Behavior',
}

export const HEADING_LABELS: Record<EvolHeading, string> = {
  'what-and-why': '📖 What & Why',
  'key-players': '🔑 Key Players',
  'how-it-works': '⚙️ How It Works',
  'know-the-differences': '⚖️ Know the Differences',
  'consequences-and-failures': '💥 Consequences & Failures',
  'apply-it': '🎯 Apply It',
  'exam-traps': '⚠️ Exam Traps',
}

// ─── Bubble Data ───────────────────────────────────────────────────────────

export const EVOL_BUBBLES: EvolBubble[] = [
  // CH 10 — Evo-Devo
  {
    id: 'grn-cascades',
    chapter: 'ch10',
    chapterLabel: 'CH 10 — Evo-Devo',
    topic: 'evo-devo',
    title: 'GRNs & Cascades',
    color: '#4ade80',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'GRNs are networks of TFs + cis-regulatory elements that control gene expression cascades' },
          { text: 'Explain how one genotype → many phenotypes; critical for understanding body plan evolution' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Transcription factors (TFs), cis-regulatory elements (CREs/enhancers), signaling molecules, target genes' },
          { text: 'Master regulators: Pax6 (eye), tinman (heart), Nkx2.5' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'TF binds enhancer → recruits co-activators → RNA Pol II transcribes target gene' },
          { text: 'Cascades = upstream TF activates downstream TFs → amplification' },
          { text: 'Modular enhancers allow tissue-specific expression' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'CRE vs. promoter: CRE can be far away, tissue-specific; promoter is proximal, required for all expression' },
          { text: 'Activator vs. repressor TFs' },
          { text: 'Pleiotropic vs. modular gene: pleiotropy = one gene many effects; modularity = different enhancers drive different expression domains' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Mutation in CRE = tissue-specific change without lethal effect (evolvable)' },
          { text: 'Mutation in TF coding region = pleiotropic disaster' },
          { text: 'GRN rewiring = morphological evolution without new genes' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"If you mutate an enhancer that drives limb-specific expression of gene X, what happens to gene X expression in other tissues?" → Answer: unchanged in other tissues — enhancer is tissue-specific' },
          { text: '"Why are CRE mutations more likely to be preserved by selection than TF coding mutations?" → Answer: modular, non-pleiotropic effects' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'CREs do NOT code for protein — they are regulatory sequences, not coding sequences', isTrap: true },
          { text: 'Enhancers can work in any orientation and at great distance — not just near the promoter', isTrap: true },
          { text: 'Pax6 is a master regulator but IS NOT the only gene needed for eye development — it initiates the cascade', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'gene-duplication',
    chapter: 'ch10',
    chapterLabel: 'CH 10 — Evo-Devo',
    topic: 'evo-devo',
    title: 'Gene Duplication',
    color: '#4ade80',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Gene duplication provides raw material for evolution — one copy maintains original function, other can diverge' },
          { text: 'Mechanism behind novelty without losing existing function' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Paralogs (same species, different function from duplication), orthologs (different species, same function from speciation)' },
          { text: 'Neofunctionalization (new function), subfunctionalization (split ancestral functions), pseudogenization' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'WGD (whole genome duplication) or tandem duplication → duplicate released from constraint → mutations accumulate → divergence' },
          { text: 'Recruitment = coopting a gene for a new role' },
          { text: 'Gene promiscuity = gene expressed in new tissue via new CRE before duplication' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Paralog vs. ortholog: duplication vs. speciation event separates them', examRef: '2022 Q7' },
          { text: 'Neofunctionalization vs. subfunctionalization: new role vs. split ancestral role' },
          { text: 'Gene recruitment vs. de novo gene: coopting existing vs. creating new' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Pseudogenization if duplicate loses both sub-functions' },
          { text: 'Dosage imbalance after WGD can be lethal' },
          { text: 'Relaxed constraint on duplicates → accelerated evolution' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Crystallins in the eye lens were recruited from metabolic enzymes — is this neofunctionalization or gene recruitment?" → Answer: gene recruitment/co-option — enzyme function retained, lens function added' },
          { text: '"If two proteins share 60% sequence identity in vertebrates and invertebrates, are they orthologs or paralogs?" → Answer: likely orthologs — separated by speciation' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Paralogs are NOT the same as orthologs — paralogs arise from duplication within a lineage, orthologs from speciation', isTrap: true },
          { text: 'Subfunctionalization is NOT the same as neofunctionalization — subfunctionalization splits existing functions, neofunctionalization creates a new one', isTrap: true },
          { text: 'High sequence similarity does NOT prove orthology — could be paralogs that have not diverged', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'hox-heterochrony',
    chapter: 'ch10',
    chapterLabel: 'CH 10 — Evo-Devo',
    topic: 'evo-devo',
    title: 'Hox / Heterochrony',
    color: '#4ade80',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Hox genes = master regulators of body axis positional identity' },
          { text: 'Heterochrony = evolutionary change in developmental timing' },
          { text: 'Deep homology = same gene network in wildly different structures across phyla' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Hox gene clusters (HoxA-D in vertebrates), homeodomain TFs' },
          { text: 'Paedomorphosis (adult looks like juvenile), peramorphosis (adult has more exaggerated features)' },
          { text: 'Bicoid, Nanos in Drosophila; Hh, Wnt, BMP signaling' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Hox genes expressed in nested domains along AP axis; anterior Hox = anterior structures; posterior Hox = posterior' },
          { text: 'Heterochrony changes rate/onset of developmental programs' },
          { text: 'Neoteny = retention of juvenile features into adulthood; progenesis = sexual maturity at juvenile stage' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Paedomorphosis vs. peramorphosis: juvenile features retained vs. adult features elaborated' },
          { text: 'Neoteny vs. progenesis: different mechanisms for paedomorphosis' },
          { text: 'Deep homology vs. analogy: same gene network vs. same structure from different genes' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Hox mutations = homeotic transformations (leg where antenna should be)' },
          { text: 'Heterochrony drove human evolution (neoteny — large brain, flat face)' },
          { text: 'Deep homology means toolkit genes are ancient and conserved' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Axolotls remain aquatic and retain gills throughout life due to neoteny — is this paedomorphosis or peramorphosis?" → Answer: paedomorphosis, specifically neoteny' },
          { text: '"If Drosophila and vertebrates both use Pax6 for eye development but have structurally different eyes, what does this indicate?" → Answer: deep homology — same gene network, convergent structures' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Hox genes specify IDENTITY not pattern — they say "this region is a leg" not "build a leg from scratch"', isTrap: true },
          { text: 'Deep homology ≠ structural homology — different structures can share the same genetic toolkit', isTrap: true },
          { text: 'Neoteny is ONE type of paedomorphosis, not the only type — do not conflate them', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'constraints-convergence',
    chapter: 'ch10',
    chapterLabel: 'CH 10 — Evo-Devo',
    topic: 'evo-devo',
    title: 'Constraints & Convergence',
    color: '#4ade80',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Evolution is NOT unlimited — developmental, phylogenetic, and physical constraints channel evolution' },
          { text: 'Convergence and parallelism reveal that similar problems → similar solutions' },
          { text: 'Imperfect adaptations prove history matters' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Developmental constraints (can\'t make structures without developmental toolkit)' },
          { text: 'Convergent evolution (independent origins, different genes), parallel evolution (independent origins, same genes)' },
          { text: 'Imperfect adaptations (e.g., recurrent laryngeal nerve, panda\'s thumb)' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Constraints = certain mutations are not producible or are lethal' },
          { text: 'Convergence occurs when selection independently favors same phenotype via different genetic paths' },
          { text: 'Parallelism = same molecular solution independently; imperfect adaptations = historical baggage' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Convergent vs. parallel evolution: different genes vs. same genes/mechanism' },
          { text: 'Constraint vs. selection: constraint limits options; selection chooses among options' },
          { text: 'Vestigial vs. imperfect adaptation: non-functional remnant vs. functional but suboptimal' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Constraints explain "missing" morphologies in nature' },
          { text: 'Imperfect adaptations are evidence against design and FOR evolution' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Ichthyosaurs and dolphins independently evolved streamlined bodies — is this convergent or parallel?" → Answer: convergent evolution, different lineages, different genes' },
          { text: '"The panda\'s thumb is not a true thumb — what does this illustrate?" → Answer: evolutionary constraint + imperfect adaptation — had to work with existing carpals' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Convergent evolution does NOT mean identical genes — same phenotype can arise from different genetic paths', isTrap: true },
          { text: 'Constraints do NOT prevent evolution, they channel it — there is still plenty of evolutionary variation', isTrap: true },
          { text: 'Imperfect adaptations are evidence FOR evolution, not against selection — they show historical contingency', isTrap: true },
        ],
      },
    ],
  },

  // CH 11 — Sex
  {
    id: 'why-sex',
    chapter: 'ch11',
    chapterLabel: 'CH 11 — Sex',
    topic: 'evolution-of-sex',
    title: 'Why Sex?',
    color: '#f472b6',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Sexual reproduction is costly (2-fold cost of males) yet ubiquitous — must have major benefits' },
          { text: 'Two main hypotheses: Muller\'s Ratchet (asexual accumulates deleterious mutations irreversibly) and Red Queen (sex generates diversity to stay ahead of coevolving parasites)' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Muller\'s Ratchet: irreversible accumulation of deleterious mutations in asexuals' },
          { text: 'Red Queen hypothesis: arms race with parasites favors rare genotypes' },
          { text: 'Cost of sex (2-fold cost of males), recombination' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Muller\'s Ratchet: asexual lineage can only lose alleles, not regain them; sex + recombination shuffles alleles, purges deleterious combos' },
          { text: 'Red Queen: parasites adapt to common host genotypes → rare genotypes have advantage → sex maintains genotypic diversity' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Muller\'s Ratchet vs. Red Queen: mutation load vs. parasite coevolution' },
          { text: 'Sexual vs. asexual: diversity vs. reproductive efficiency' },
          { text: 'Cost of sex vs. benefit of recombination' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Asexual populations accumulate mutations faster (Muller\'s Ratchet)' },
          { text: 'Red Queen supported by snail experiments (Potamopyrgus — more sexual in parasite-rich environments)' },
          { text: 'Most eukaryotes have some sexual stage' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"New Zealand snails reproduce sexually more often in lakes with high trematode parasite loads — which hypothesis does this support?" → Answer: Red Queen hypothesis', examRef: '2021 Q3' },
          { text: '"Why can\'t an asexual population easily evolve to have fewer deleterious mutations?" → Answer: Muller\'s Ratchet — without recombination, can only accumulate, not purge bad alleles' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Muller\'s Ratchet is about DELETERIOUS mutations, not beneficial ones — do not confuse with positive selection', isTrap: true },
          { text: 'Red Queen does NOT predict parasites will win the arms race — it predicts a coevolutionary dynamic', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'anisogamy-osr',
    chapter: 'ch11',
    chapterLabel: 'CH 11 — Sex',
    topic: 'evolution-of-sex',
    title: 'Anisogamy & OSR',
    color: '#f472b6',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Anisogamy (large egg vs. small sperm) → different optimal strategies for each sex → sexual selection' },
          { text: 'OSR (operational sex ratio) determines which sex competes more intensely' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Anisogamy (size difference in gametes), OSR (ratio of sexually active males:females)' },
          { text: 'Intrasexual selection (same-sex competition for mates), intersexual selection (mate choice by opposite sex)' },
          { text: 'Bateman\'s principle (males benefit from multiple matings more than females)' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Eggs are costly → females become choosy; sperm are cheap → males compete' },
          { text: 'OSR male-biased → strong male-male competition; OSR female-biased → female competition' },
          { text: 'Bateman\'s gradient = slope of reproductive success vs. number of mates (steeper = stronger selection)' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Intrasexual vs. intersexual selection: competition vs. choice' },
          { text: 'OSR vs. sex ratio at birth: operational vs. overall' },
          { text: 'Bateman\'s principle vs. parental investment theory: gamete size argument vs. total investment argument' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'When males provide more care (pipefish, seahorses), females are showier' },
          { text: 'OSR can shift within a species (e.g., sex-role reversals)' },
          { text: 'Bateman\'s principle overgeneralized — females also benefit from multiple mates in some species' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"In pipefish, males carry eggs in a brood pouch and females compete for males — how does this fit OSR theory?" → Answer: OSR is female-biased because males are the limiting resource → female-female competition, females more ornamented' },
          { text: '"Why does Bateman\'s gradient explain stronger sexual selection on males in most species?" → Answer: male RS increases with more mates; female RS plateaus → steeper gradient for males' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Anisogamy → different strategies, NOT that females are always choosy — OSR can override this', isTrap: true },
          { text: 'Bateman\'s principle is about VARIANCE in reproductive success, not just number of matings', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'fishers-runaway',
    chapter: 'ch11',
    chapterLabel: 'CH 11 — Sex',
    topic: 'evolution-of-sex',
    title: "Fisher's Runaway",
    color: '#f472b6',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Intersexual selection (mate choice) can be driven by runaway selection (arbitrary preference + trait coevolve) OR honest signals (costly display = reliable indicator of quality)' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Fisher\'s runaway: positive feedback between female preference gene and male trait gene' },
          { text: 'Honest signals: costly signals correlated with genuine quality' },
          { text: 'Zahavian handicap: cost IS the signal — you can\'t fake expensive traits' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Runaway: rare females prefer long tails → long-tail males have more offspring → preference gene and long-tail gene become genetically correlated → runaway until viability cost stops it' },
          { text: 'Handicap: only genuinely healthy males can survive while producing costly ornament → ornament = reliable quality indicator' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Runaway vs. honest signal: arbitrary vs. condition-dependent' },
          { text: 'Handicap vs. signal detection: cost of production vs. cost of assessment' },
          { text: 'Fisher runaway vs. good genes: arbitrary preference vs. preference for actual genetic quality' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Peacock\'s tail = classic honest signal (or runaway)' },
          { text: 'El Nino disrupts condition-dependent displays' },
          { text: 'Runaway can lead to maladaptive extremes (Irish elk antlers)' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"A male bird with a bright red beak has more RS but is also more susceptible to parasites — does this support runaway or honest signaling?" → Answer: honest signaling — parasites create a cost, so only parasite-resistant males can maintain red beaks', examRef: '2020 Q5' },
          { text: '"What would happen to peacock tail evolution if females suddenly chose randomly?" → Answer: runaway stops; directional selection for tail size ends; viability selection shortens tails' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: "Fisher's runaway does NOT require that the trait be good for survival — it's ARBITRARY", isTrap: true },
          { text: 'Handicap principle does NOT mean all costly traits are honest — costs must be condition-dependent', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'mating-systems',
    chapter: 'ch11',
    chapterLabel: 'CH 11 — Sex',
    topic: 'evolution-of-sex',
    title: 'Mating Systems',
    color: '#f472b6',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Mating systems reflect ecological constraints + sexual conflict + parental investment' },
          { text: 'Sperm competition and cryptic female choice operate AFTER mating' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Monogamy, polygyny (1 male:many females), polyandry (1 female:many males), promiscuity' },
          { text: 'Sperm competition (multiple males\' sperm compete), cryptic female choice (female controls fertilization post-mating)' },
          { text: 'Testes size (proxy for sperm competition intensity)' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Sperm competition → males evolve larger testes, more sperm per ejaculate, sperm traits that attack rivals' },
          { text: 'Cryptic female choice → females can bias fertilization toward preferred male\'s sperm via uterine environment' },
          { text: 'Mating system tracks OSR + resource distribution (resource-defense polygyny, female-defense polygyny)' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Sperm competition vs. cryptic female choice: male vs. female control post-mating' },
          { text: 'Polygyny vs. polyandry: male vs. female has multiple mates' },
          { text: 'Resource-defense vs. female-defense polygyny: territory-based vs. female-group-based' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Humans have intermediate testes size → mild sperm competition' },
          { text: 'Gorillas (harems) have tiny testes; chimpanzees (promiscuous) have enormous testes' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Chimpanzees have relatively larger testes per body mass than gorillas — what does this indicate?" → Answer: chimps have higher sperm competition → more promiscuous mating' },
          { text: '"What is cryptic female choice and why is it hard to study?" → Answer: female controls fertilization after copulation; hard to study because it\'s internal and post-mating' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Large testes indicate SPERM COMPETITION, not sexual selection per se — they are proxies for promiscuity', isTrap: true },
          { text: 'Cryptic female choice occurs AFTER copulation — it is not the same as pre-copulatory mate choice', isTrap: true },
          { text: 'Monogamy is not always due to mate guarding — it can be due to biparental care requirements', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'sexual-conflict',
    chapter: 'ch11',
    chapterLabel: 'CH 11 — Sex',
    topic: 'evolution-of-sex',
    title: 'Sexual Conflict',
    color: '#f472b6',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Male and female fitness interests often conflict (interlocus contest evolution, ICE)' },
          { text: 'Adaptations in one sex trigger counter-adaptations in the other → arms race WITHIN a species' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Interlocus sexual conflict (conflict between alleles at different loci in each sex)' },
          { text: 'Intralocus sexual conflict (same allele has different optimal expression in each sex)' },
          { text: 'Drosophila seminal fluid proteins (Sfps/Acps)' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Male evolves to manipulate female (e.g., seminal fluid that increases oviposition but harms female lifespan)' },
          { text: 'Female evolves resistance; intralocus conflict → sexually antagonistic alleles maintained at intermediate frequency' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Interlocus vs. intralocus conflict: different loci conflict vs. same locus different optimum' },
          { text: 'Sexual conflict vs. mutualism: opposing vs. aligned interests' },
          { text: 'Arms race within species vs. between species (coevolution)' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Drosophila SFPs increase female egg-laying but decrease female lifespan' },
          { text: 'Female genome evolves resistance to male manipulation' },
          { text: 'Drives rapid evolution of reproductive proteins' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Drosophila females that mate with males producing high levels of seminal proteins die younger but produce more offspring — whose fitness is being maximized?" → Answer: neither straightforwardly — male fitness increased (more eggs), female fitness may decrease (shorter life) → classic sexual conflict' },
          { text: '"What is intralocus sexual conflict and why is it hard to resolve?" → Answer: same allele is good in one sex, bad in other → selection cannot fix one without harming the other; can be partially resolved by sex-limited expression' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Sexual conflict does NOT mean males and females physically fight — it\'s about allele-level selection pressures', isTrap: true },
          { text: 'Seminal fluid proteins do NOT always harm females — harm is context and dosage specific', isTrap: true },
        ],
      },
    ],
  },

  // CH 12 — Life History
  {
    id: 'life-history-tradeoffs',
    chapter: 'ch12',
    chapterLabel: 'CH 12 — Life History',
    topic: 'life-history',
    title: 'Life History Trade-offs',
    color: '#fb923c',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Life history = schedule of growth, reproduction, survival; trade-offs arise because resources are finite' },
          { text: 'Classic model: how fast to reproduce vs. how long to live' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Stearns\' opossum experiment, r vs. K selection (simplified), fast vs. slow life history continuum' },
          { text: 'Trade-offs: reproduction vs. survival, current vs. future reproduction, number vs. size of offspring' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Opossums on island (low predation) evolved slower reproduction, longer lifespan in just 5,000 years' },
          { text: 'Predation drives fast life history; when predation low → invest in soma (repair/maintenance)' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'r-selected vs. K-selected: many small offspring vs. few large offspring; high vs. low extrinsic mortality', examRef: '2022 Q2' },
          { text: 'Intrinsic vs. extrinsic mortality: aging vs. predation' },
          { text: 'Semelparity vs. iteroparity: one big reproductive bout vs. repeated' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Humans are K-selected: low extrinsic mortality → long lifespan, few offspring, high parental investment' },
          { text: 'Pacific salmon are semelparous (die after spawning)' },
          { text: 'Extrinsic mortality is the key driver of life history evolution' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Island opossums reproduced slower and lived longer than mainland opossums in Stearns\' study — what does this tell us about predation and life history?" → Answer: low predation → survive longer anyway → selection favors investing in soma/repair → slower reproduction' },
          { text: '"Why do annual plants reproduce all at once and die, while perennial plants reproduce repeatedly?" → Answer: annuals face high extrinsic mortality + unpredictable environment → semelparity maximizes current reproduction' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'r vs. K selection is oversimplified — do not use as the only framework; extrinsic mortality is the key variable', isTrap: true },
          { text: 'Slow life history is NOT always better — depends on extrinsic mortality rate', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'parental-investment',
    chapter: 'ch12',
    chapterLabel: 'CH 12 — Life History',
    topic: 'life-history',
    title: 'Parental Investment',
    color: '#fb923c',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Parental investment theory (Trivers 1972) links investment per offspring to sex roles' },
          { text: 'Trivers-Willard hypothesis predicts sex-biased parental investment based on offspring condition' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Trivers\' parental investment theory, Trivers-Willard hypothesis' },
          { text: 'Sex-role reversal species (pipefish, seahorse, jacana), maternal vs. paternal care' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'The sex that invests more per offspring becomes the choosy sex; the sex that invests less becomes the competing sex' },
          { text: 'Trivers-Willard: mothers in good condition bias toward sons (who can use quality advantage to get many mates), mothers in poor condition bias toward daughters' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Trivers-Willard vs. local resource competition: quality-dependent sex bias vs. resource-competition-based bias' },
          { text: 'Parental investment theory vs. Bateman: investment predicts choosiness; Bateman predicts from gamete size' },
          { text: 'Direct vs. indirect benefits to mate choice' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Red deer mothers in good condition have more sons' },
          { text: 'Pipefish males carry eggs → OSR female-biased → females compete' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"A red deer hind in excellent body condition is more likely to produce a male calf according to Trivers-Willard — why?" → Answer: sons of high-quality mothers can achieve high RS because male RS has high variance; daughters achieve moderate RS regardless of quality' },
          { text: '"In seahorses, males get pregnant — what does parental investment theory predict about sex roles?" → Answer: males invest more → males become choosy; females compete for access to males' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Trivers-Willard is about CONDITION-DEPENDENT sex ratio bias, not just producing equal sons and daughters', isTrap: true },
          { text: 'Parental investment ≠ time spent with offspring — includes ANY cost to parent (energy, risk, future reproduction)', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'parent-offspring-conflict',
    chapter: 'ch12',
    chapterLabel: 'CH 12 — Life History',
    topic: 'life-history',
    title: 'Parent-Offspring Conflict',
    color: '#fb923c',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Parent-offspring conflict: offspring want more resources than optimal for parent to give (Trivers 1974)' },
          { text: 'Genomic imprinting: parent-of-origin gene expression, explained by kinship theory' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Trivers\' parent-offspring conflict, Hamilton\'s relatedness (r)' },
          { text: 'Genomic imprinting, Igf2 (paternal, promotes growth), Igf2r (maternal, suppresses growth)' },
          { text: 'Prader-Willi and Angelman syndromes', examRef: '2021 Q6' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Offspring is equally related to itself (r=1) but only r=0.5 to siblings; parent is equally related (r=0.5) to all offspring → conflict' },
          { text: 'Paternally-imprinted genes promote offspring growth (father\'s genes not in future sibs); maternally-imprinted genes suppress growth (mother\'s genes ARE in future sibs)' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Genomic imprinting vs. epigenetics: imprinting IS epigenetic but has specific kinship explanation' },
          { text: 'Prader-Willi (maternal imprint failure → paternal copies overexpress) vs. Angelman (paternal imprint failure → maternal copies overexpress)' },
          { text: 'Parent-offspring conflict vs. kin selection: both invoke r but different mechanism' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Prader-Willi syndrome: hyperphagia (overgrowth drive from paternal genes unleashed)' },
          { text: 'Angelman syndrome: developmental delay' },
          { text: 'Imprinting breakdown in cancer' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Igf2 is paternally expressed and promotes fetal growth. Igf2r is maternally expressed and degrades IGF2 signal. How does kinship theory explain this?" → Answer: paternal genes maximize current offspring growth because father may not share genes with future sibs; maternal genes moderate growth to preserve resources for future offspring' },
          { text: '"Why do offspring demand more resources than parents are selected to give?" → Answer: offspring is equally related to itself vs. 0.5 to siblings; parent is 0.5 related to all → optimal transfer point differs' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Genomic imprinting does NOT mean the silenced copy is deleted — it is present but methylated/silenced epigenetically', isTrap: true },
          { text: 'Igf2 is paternally expressed (NOT maternally expressed) — this is a common confusion', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'senescence',
    chapter: 'ch12',
    chapterLabel: 'CH 12 — Life History',
    topic: 'life-history',
    title: 'Senescence & Menopause',
    color: '#fb923c',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Why do organisms age and die? Two theories: mutation accumulation (deleterious late-acting mutations escape selection) and antagonistic pleiotropy (genes good early are bad late)' },
          { text: 'Menopause as adaptive life history' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Medawar (mutation accumulation theory), Williams (antagonistic pleiotropy), disposable soma theory (Kirkwood)' },
          { text: 'Menopause, grandmother hypothesis' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Mutation accumulation: genes expressed only late in life face little purifying selection → accumulate' },
          { text: 'Antagonistic pleiotropy: gene beneficial at age 20 that causes cancer at 70 is favored by selection because most die before 70' },
          { text: 'Disposable soma: invest in reproduction now, let soma (body) deteriorate' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Mutation accumulation vs. antagonistic pleiotropy: passive accumulation vs. active selection for bad-late genes', examRef: '2024 Q1' },
          { text: 'Senescence vs. aging: senescence = decline in fitness with age; not all organisms senesce' },
          { text: 'Menopause adaptive vs. by-product: grandmother hypothesis vs. reproductive constraint' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Calorie restriction extends lifespan → supports disposable soma' },
          { text: 'BRCA1/2 mutations increase cancer risk — potential antagonistic pleiotropy?' },
          { text: 'Grandmother hypothesis: post-reproductive females increase inclusive fitness by helping grandchildren' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"A gene that increases testosterone (better reproduction at 25) also increases prostate cancer risk at 65 — what evolutionary theory does this illustrate?" → Answer: antagonistic pleiotropy — selection acts strongly on age 25, weakly on age 65' },
          { text: '"Why do whales (and humans) have menopause while other mammals don\'t?" → Answer: grandmother hypothesis — ecological conditions where old female\'s help to grandoffspring outweighs her own reproduction' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Mutation accumulation does NOT predict genes specifically bad at old age — any late-acting deleterious mutation accumulates', isTrap: true },
          { text: 'Antagonistic pleiotropy requires the gene to be BENEFICIAL early, not just neutral — the selection must be positive', isTrap: true },
        ],
      },
    ],
  },

  // CH 15 — Coevolution
  {
    id: 'coevolution-arms-races',
    chapter: 'ch15',
    chapterLabel: 'CH 15 — Coevolution',
    topic: 'coevolution',
    title: 'Arms Races & Geographic Mosaic',
    color: '#a78bfa',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Coevolution = reciprocal evolutionary change between interacting species' },
          { text: 'Can produce arms races, geographic mosaics, and coevolutionary hotspots/coldspots' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Ehrlich & Raven (plant-butterfly coevolution), geographic mosaic theory of coevolution (Thompson)' },
          { text: 'Coevolutionary hotspots (coevolution occurs) vs. coldspots (no coevolution)' },
          { text: 'Garter snake-newt arms race (tetrodotoxin)' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Interacting species exert reciprocal selection pressures → each adapts to the other → arms race' },
          { text: 'Geographic mosaic: interactions vary spatially → coevolution only where selection pressures overlap' },
          { text: 'Garter snakes evolve TTX resistance → newts evolve more TTX → local adaptation' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Coevolution vs. correlated evolution: reciprocal selection vs. shared history' },
          { text: 'Hotspot vs. coldspot: active coevolution vs. none' },
          { text: 'Arms race vs. mutualism coevolution: escalation vs. mutualistic improvement' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Evolutionary escalation (both species get better at offense/defense)' },
          { text: 'Stalemate when arms race is too costly' },
          { text: 'Geographic mosaic explains why one population has high resistance and neighbor doesn\'t' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Garter snake populations near newts with high TTX have higher TTX resistance than snake populations far from newts — what coevolutionary concept does this illustrate?" → Answer: geographic mosaic of coevolution — coevolutionary hotspot near newts, coldspot far from them' },
          { text: '"Why doesn\'t the newt-snake arms race escalate forever?" → Answer: physiological limits + cost of TTX production + cost of nerve resistance — both sides eventually hit constraints' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Coevolution does NOT require that both species benefit — arms races are coevolution too', isTrap: true },
          { text: 'Geographic mosaic does NOT mean coevolution occurs everywhere — just WHERE selection pressures overlap', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'mimicry',
    chapter: 'ch15',
    chapterLabel: 'CH 15 — Coevolution',
    topic: 'coevolution',
    title: 'Mimicry',
    color: '#a78bfa',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Mimicry = resemblance to another species that benefits the mimic' },
          { text: 'Batesian (harmless mimic resembles harmful model) and Müllerian (two harmful species resemble each other)' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Batesian mimicry (harmless mimic + harmful model + trained predator)' },
          { text: 'Müllerian mimicry (two unpalatable species converge), mimicry ring' },
          { text: 'Automimicry (individual mimics palatable to unpalatable form of own species)' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Batesian: predator learns to avoid model → avoids mimic by association (mimic free-rides on model\'s warning)' },
          { text: 'Müllerian: two unpalatable species converge → predator only needs to learn ONE pattern → shared benefit' },
          { text: 'Selection for convergence stronger when both species abundant' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Batesian vs. Müllerian: parasitic/deceptive vs. mutualistic; model harmed vs. mutual benefit' },
          { text: 'Automimicry vs. Batesian: within species vs. between species' },
          { text: 'Mimicry vs. camouflage: resemblance to predator\'s mental model vs. resemblance to background' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Batesian mimics become rarer → model swamped → predators learn mimic is "safe" → mimicry breaks down if mimic too common' },
          { text: 'Müllerian mimicry stable and self-reinforcing' },
          { text: 'Monarch-viceroy (used to be textbook Batesian — now thought to be Müllerian)', examRef: '2020 Q8' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"If a Batesian mimic population becomes very common relative to its model, what happens?" → Answer: predators encounter mimic more, learn it is harmless → mimicry breaks down → selection against mimic' },
          { text: '"Why is Müllerian mimicry considered mutualistic while Batesian is considered parasitic?" → Answer: Müllerian — both species benefit from predator learning one pattern; Batesian — model is harmed when predators associate warning with harmless mimic' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Monarch and Viceroy used to be textbook Batesian but viceroy is ALSO unpalatable — likely Müllerian', isTrap: true },
          { text: 'Batesian mimicry does NOT require that species are related — they just need to look alike', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'mutualism-virulence',
    chapter: 'ch15',
    chapterLabel: 'CH 15 — Coevolution',
    topic: 'coevolution',
    title: 'Mutualism & Virulence',
    color: '#a78bfa',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Mutualism = both partners benefit; endosymbiosis = symbiont lives inside host' },
          { text: 'Virulence evolution = how pathogen virulence evolves relative to transmission mode' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Endosymbiosis theory (Margulis), mitochondria from α-proteobacteria, chloroplasts from cyanobacteria' },
          { text: 'Mycorrhizal fungi, rhizobia (nitrogen fixation), virulence-transmission trade-off' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Endosymbiosis: free-living prokaryote engulfed → became organelle (genome reduction, host-dependent)' },
          { text: 'Virulence evolution: host mobility required for transmission → selection favors lower virulence; vector-borne disease → vector does the work → high virulence can evolve' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Obligate vs. facultative mutualism: can\'t live without vs. beneficial but not required' },
          { text: 'Endosymbiosis vs. horizontal gene transfer: whole genome vs. individual genes' },
          { text: 'Virulence vs. pathogenicity: damage to host vs. ability to infect' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Myxomatosis in rabbits — initially high virulence → rabbits die fast → virus can\'t spread → evolution toward intermediate virulence' },
          { text: 'HIV becomes less virulent when transmitted mostly sexually (host mobility needed)' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Myxoma virus in Australian rabbits evolved to be less lethal over time — what evolutionary principle explains this?" → Answer: virulence-transmission trade-off — killing host too fast prevents transmission; selection favored intermediate virulence' },
          { text: '"What evidence supports the endosymbiotic origin of mitochondria?" → Answer: own circular genome, similar to α-proteobacteria, double membrane, divide by binary fission, 70S ribosomes' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Mitochondria arose from α-proteobacteria, NOT just any gram-negative bacteria — specificity matters', isTrap: true },
          { text: 'Mutualism does NOT require that partners evolved together — can be recent and opportunistic', isTrap: true },
          { text: 'Lower virulence is NOT always favored — depends on transmission route', isTrap: true },
        ],
      },
    ],
  },

  // CH 16 — Behavior
  {
    id: 'proximate-ultimate',
    chapter: 'ch16',
    chapterLabel: 'CH 16 — Behavior',
    topic: 'behavior',
    title: 'Proximate vs. Ultimate',
    color: '#38bdf8',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Tinbergen\'s 4 questions: mechanism (proximate-how), development (proximate-how), function (ultimate-why), evolution (ultimate-why)' },
          { text: 'Behaviors are phenotypes subject to selection; even organisms without brains show "behavior"' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Proximate causes (mechanism, development), ultimate causes (function, phylogeny)' },
          { text: 'Behavioral phenotypes, slime mold maze solving, Venus flytrap, sea anemone' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Proximate = what physiological/developmental processes produce the behavior' },
          { text: 'Ultimate = what is the adaptive value/evolutionary history' },
          { text: 'Same behavior can be explained at both levels (complementary, not competing)' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Proximate vs. ultimate explanation: mechanism/development vs. function/evolution' },
          { text: 'Function vs. adaptive value: immediate benefit vs. fitness consequence' },
          { text: 'Individual selection vs. group selection: levels of explanation' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Asking only proximate OR only ultimate is incomplete — both are needed' },
          { text: 'No-brain behavior challenges anthropocentric definition of behavior' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"A male stickleback attacks a red-colored intruder because rising testosterone triggers aggressive circuits — is this proximate or ultimate?" → Answer: proximate — hormonal mechanism' },
          { text: '"Why do male sticklebacks attack red objects in the first place?" → Answer: ultimate — males with red bellies are rivals; aggression has fitness consequences' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Proximate and ultimate explanations are COMPLEMENTARY, not competing — one does not replace the other', isTrap: true },
          { text: 'Behavior does NOT require a brain — plants and slime molds show behavior-like responses', isTrap: true },
          { text: 'Function does NOT mean purpose — it means fitness consequence of the behavior', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'ess-game-theory',
    chapter: 'ch16',
    chapterLabel: 'CH 16 — Behavior',
    topic: 'behavior',
    title: 'ESS & Game Theory',
    color: '#38bdf8',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'ESS (evolutionarily stable strategy) = strategy that cannot be invaded when rare' },
          { text: 'Game theory models behavioral evolution; individual vs. group selection debate' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Individual selection (Williams), group selection (Wynne-Edwards, mostly rejected), ESS (Maynard Smith)' },
          { text: 'Hawk-Dove game, Prisoner\'s Dilemma, tit-for-tat' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'ESS: a strategy is an ESS if, when adopted by most, it cannot be beaten by rare alternatives' },
          { text: 'Hawk-Dove: Hawk (fight always) vs. Dove (retreat) → ESS is a mixed strategy' },
          { text: 'Tit-for-tat is ESS in iterated Prisoner\'s Dilemma' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Individual vs. group selection: most traits evolve by individual selection; group selection requires very specific conditions', examRef: '2022 Q9' },
          { text: 'ESS vs. Nash equilibrium: ESS is evolutionary stability; NE is strategic stability' },
          { text: 'Frequency-dependent vs. frequency-independent selection: ESS vs. directional' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Group selection once proposed to explain altruism — now largely replaced by kin selection and reciprocal altruism' },
          { text: 'Hawk-Dove predicts polymorphism at ESS frequency' },
          { text: 'Tit-for-tat explains cooperation in iterated games' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"In Hawk-Dove where Hawks are rare, Hawks always win fights — what happens as Hawks become more common?" → Answer: Hawks increasingly fight each other, paying fight costs → ESS equilibrium where frequency of Hawks stabilizes' },
          { text: '"Why is group selection considered a \'special case\' rather than a general mechanism?" → Answer: requires high group-level variation AND low individual selection coefficient — easily undermined by cheaters within groups' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Group selection is NOT universally rejected — it\'s accepted under specific conditions (e.g., structured populations)', isTrap: true },
          { text: 'ESS is not necessarily the optimal strategy for the individual — it is evolutionarily stable, not individually optimal', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'hamiltons-rule',
    chapter: 'ch16',
    chapterLabel: 'CH 16 — Behavior',
    topic: 'behavior',
    title: "Hamilton's Rule",
    color: '#38bdf8',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Hamilton\'s rule: altruism evolves when rB > C (r=relatedness, B=benefit to recipient, C=cost to actor)' },
          { text: 'Inclusive fitness = direct fitness + indirect fitness from relatives' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Hamilton\'s rule (rB > C), inclusive fitness, coefficient of relatedness (r)' },
          { text: 'Full sib (r=0.5), half sib (r=0.25), parent-offspring (r=0.5)' },
          { text: 'Alarm calls in ground squirrels, worker bees', examRef: '2021 Q8' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Altruistic gene spreads if benefit to relatives (weighted by r) exceeds cost to actor' },
          { text: 'Alarm calls in ground squirrels — caller at risk but saves relatives' },
          { text: 'Worker bees give up reproduction (C high) but increase queen\'s reproduction (B very high, r=0.75 in haplodiploidy)' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Kin selection vs. group selection: gene-centric through kin vs. group-level selection' },
          { text: 'Direct vs. indirect fitness: own offspring vs. via relatives' },
          { text: 'Hamilton\'s rule vs. reciprocal altruism: relatedness vs. reciprocity mechanism' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Explains warning calls, cooperative breeding, eusociality' },
          { text: 'Fails when r is low or when actors cannot discriminate kin' },
          { text: 'Bacteria can perform kin selection via quorum sensing' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"A ground squirrel emits an alarm call (C=0.3), warning 4 full sibs (r=0.5, B=0.1 each). Does Hamilton\'s rule predict the call should evolve?" → Answer: rB = 0.5×0.1×4 = 0.2; C = 0.3; rB < C → does NOT evolve with these values' },
          { text: '"Why are worker bees related to queen\'s offspring by r=0.75?" → Answer: haplodiploidy — males are haploid → workers share 100% of father\'s genes + 50% of mother\'s → r=0.75 to sisters' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Hamilton\'s rule predicts when altruism CAN evolve — not that it WILL always evolve', isTrap: true },
          { text: 'Inclusive fitness is NOT the same as group fitness — it is individual fitness plus effects on relatives', isTrap: true },
          { text: 'Kin selection does NOT require kin recognition — familiarity or location cues work', isTrap: true },
        ],
      },
    ],
  },
  {
    id: 'eusociality',
    chapter: 'ch16',
    chapterLabel: 'CH 16 — Behavior',
    topic: 'behavior',
    title: 'Eusociality',
    color: '#38bdf8',
    headings: [
      {
        heading: 'what-and-why',
        bullets: [
          { text: 'Eusociality = overlapping generations + cooperative brood care + reproductive division of labor' },
          { text: 'Evolved multiple times (bees, wasps, ants, termites, naked mole rats)' },
        ],
      },
      {
        heading: 'key-players',
        bullets: [
          { text: 'Eusociality definition (3 criteria), haplodiploidy (males haploid)' },
          { text: 'r=0.75 among sisters in Hymenoptera, sterile worker caste, queen' },
          { text: 'Naked mole rat (diploid eusocial mammal)', examRef: '2022 Q11' },
        ],
      },
      {
        heading: 'how-it-works',
        bullets: [
          { text: 'Haplodiploidy → sisters more related to each other (r=0.75) than to their own offspring (r=0.5) → Hamilton\'s rule favors helping raise sisters over personal reproduction' },
          { text: 'BUT termites are diploid and eusocial → haplodiploidy is NOT sufficient or necessary' },
          { text: 'Fortress defense, assured fitness returns, ecological constraints also drive eusociality' },
        ],
      },
      {
        heading: 'know-the-differences',
        bullets: [
          { text: 'Eusociality vs. cooperative breeding: full 3 criteria vs. just cooperative brood care' },
          { text: 'Haplodiploidy vs. diploid eusociality: termites, mole rats' },
          { text: 'Altruistic workers vs. mutualistic workers: indirect fitness vs. direct benefit' },
        ],
      },
      {
        heading: 'consequences-and-failures',
        bullets: [
          { text: 'Eusociality is evolutionarily rare but enormously ecologically successful (ants = 20% of terrestrial animal biomass)' },
          { text: 'Queen-worker conflict ongoing; worker policing; reproductive cheating in workers' },
        ],
      },
      {
        heading: 'apply-it',
        bullets: [
          { text: '"Termites are diploid yet eusocial — does this disprove Hamilton\'s rule as an explanation for eusociality?" → Answer: no — it shows haplodiploidy is not the only route; termites may have other factors (fortress defense, assured fitness) that push rB > C' },
          { text: '"Why might a worker bee have higher inclusive fitness by raising queen\'s offspring (sisters, r=0.75) than raising her own offspring (r=0.5)?" → Answer: r=0.75 already exceeds 0.5 — so even if B and C were equal, Hamilton\'s rule tips toward helping raise sisters' },
        ],
      },
      {
        heading: 'exam-traps',
        bullets: [
          { text: 'Haplodiploidy is NOT required for eusociality — termites are diploid and eusocial', isTrap: true },
          { text: 'Workers are NOT always sterile — they can have unfertilized (male) eggs', isTrap: true },
          { text: 'Eusociality evolved MULTIPLE TIMES independently — it is not a single derived trait', isTrap: true },
        ],
      },
    ],
  },
]

// ─── DEFAULT QUESTIONS (40+) ───────────────────────────────────────────────

export const DEFAULT_EVOL_QUESTIONS: EvolQuestion[] = [
  // ── Bubble 1: GRNs & Cascades ──
  {
    id: 'evol-q001',
    topic: 'evo-devo',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'You mutate an enhancer that drives limb-specific expression of gene X in mice. Gene X is also expressed in the eye and brain via separate enhancers. What happens to gene X expression in the eye and brain?',
    expectedAnswer: 'Gene X expression in the eye and brain remains unchanged. The mutated enhancer is tissue-specific to limb. Each enhancer drives expression in its own tissue independently — this is the hallmark of modular CREs.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q002',
    topic: 'evo-devo',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which statement about cis-regulatory elements (CREs) is TRUE?',
    options: [
      'CREs code for transcription factor proteins that bind the promoter',
      'CREs are always located immediately upstream of the gene they regulate',
      'CREs are DNA sequences that regulate transcription but do not encode proteins',
      'CREs function only in prokaryotes, not eukaryotes',
    ],
    correctIndex: 2,
    expectedAnswer: 'CREs are DNA sequences that regulate transcription but do not encode proteins. They are non-coding regulatory elements that can be located at great distances from the gene and work in any orientation.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 2: Gene Duplication ──
  {
    id: 'evol-q003',
    topic: 'evo-devo',
    heading: 'apply-it',
    questionType: 'free-response',
    questionText: 'Crystallins in the vertebrate eye lens were recruited from metabolic enzymes (e.g., lactate dehydrogenase). Is this an example of neofunctionalization or gene recruitment/co-option? Explain the key distinction.',
    expectedAnswer: 'This is gene recruitment (co-option). The enzyme retained its metabolic function while also gaining a lens structural role. In true neofunctionalization after duplication, one copy loses the original function and gains a new one. Gene promiscuity/co-option means an existing gene is expressed in a new context and gains an additional function without necessarily losing the original.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q004',
    topic: 'evo-devo',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'After whole genome duplication (WGD), gene A and gene B arise from the same ancestral gene and are found in the same species. What is the relationship between gene A and gene B?',
    options: [
      'Orthologs — they are separated by a speciation event',
      'Paralogs — they are separated by a duplication event within the same species',
      'Alleles — they are alternative forms at the same locus',
      'Homologs — they are identical in sequence and function',
    ],
    correctIndex: 1,
    expectedAnswer: 'Paralogs — they arise from gene duplication within a species. Orthologs arise from speciation. The key distinction: duplication → paralogs; speciation → orthologs.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 3: Hox / Heterochrony ──
  {
    id: 'evol-q005',
    topic: 'evo-devo',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'Axolotls (a salamander species) retain aquatic larval features including external gills throughout their adult life, while remaining sexually mature. What type of heterochrony is this? Is it paedomorphosis or peramorphosis?',
    expectedAnswer: 'This is paedomorphosis, specifically neoteny. Neoteny = adult somatic development slowed while sexual maturity proceeds on schedule → adult retains juvenile body features. Paedomorphosis is the general term; neoteny is one specific mechanism (slowed somatic development rate).',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q006',
    topic: 'evo-devo',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Both Drosophila and vertebrates use the Pax6 gene to initiate eye development, but their eyes are structurally very different (compound vs. camera-type). What does this BEST illustrate?',
    options: [
      'Structural homology — the eyes share the same evolutionary origin',
      'Deep homology — the same gene network is deployed in structurally non-homologous structures',
      'Convergent evolution — the eyes evolved independently using completely different genetic mechanisms',
      'Parallel evolution — the eyes evolved independently using the same genes for identical functions',
    ],
    correctIndex: 1,
    expectedAnswer: 'Deep homology. The same genetic toolkit (Pax6) is used in both, but the structures themselves are not structurally homologous — they evolved independently. Deep homology ≠ structural homology.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 4: Constraints & Convergence ──
  {
    id: 'evol-q007',
    topic: 'evo-devo',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'Ichthyosaurs (extinct marine reptiles) and dolphins (mammals) both evolved streamlined, fishlike body forms independently. Is this an example of convergent or parallel evolution? What is the key criterion?',
    expectedAnswer: 'Convergent evolution. The key criterion: convergent = independent origins via DIFFERENT genetic mechanisms/pathways. Parallel = independent origins via the SAME genes/mechanisms. Ichthyosaurs and dolphins are distantly related and almost certainly used different developmental pathways to achieve similar body forms.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q008',
    topic: 'evo-devo',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'The panda\'s "thumb" is actually an enlarged radial sesamoid bone, not a true digit. This structure is a functional but suboptimal adaptation for grasping bamboo. What does this BEST illustrate?',
    options: [
      'Vestigial structure — the thumb is non-functional',
      'Convergent evolution — pandas independently evolved the same solution as primates',
      'Evolutionary constraint + imperfect adaptation — history limits what selection can produce',
      'Evidence against natural selection — selection would have produced a better thumb',
    ],
    correctIndex: 2,
    expectedAnswer: 'Evolutionary constraint + imperfect adaptation. The panda could not evolve a true opposable thumb because its carpals were already committed to other functions. Selection worked with available material → functional but suboptimal result. Imperfect adaptations are evidence FOR evolution (historical contingency), not against selection.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 5: Why Sex? ──
  {
    id: 'evol-q009',
    topic: 'evolution-of-sex',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'In New Zealand lakes, the freshwater snail Potamopyrgus antipodarum reproduces sexually more frequently in lakes with high trematode parasite loads than in lakes with low parasite loads. Which hypothesis for the evolution of sex does this experiment BEST support, and why?',
    expectedAnswer: 'The Red Queen hypothesis. High parasite loads create selection for rare host genotypes (parasites adapt to common genotypes). Sexual reproduction generates rare genotype combinations via recombination → rare genotype advantage → sex maintained. This is exactly the prediction of the Red Queen: parasites drive the evolution and maintenance of sex.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q010',
    topic: 'evolution-of-sex',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: "Muller's Ratchet explains the evolution of sex by reference to which process?",
    options: [
      'The accumulation of BENEFICIAL mutations that become fixed in asexual populations',
      'The irreversible accumulation of DELETERIOUS mutations in asexual populations',
      'The arms race between hosts and parasites favoring rare host genotypes',
      'The recombination load that reduces fitness in sexual populations',
    ],
    correctIndex: 1,
    expectedAnswer: "Muller's Ratchet: asexual populations irreversibly accumulate deleterious mutations because without recombination, there is no mechanism to purge them. The \"ratchet\" can only click in one direction (more mutations). It is specifically about DELETERIOUS mutations, not beneficial ones.",
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 6: Anisogamy & OSR ──
  {
    id: 'evol-q011',
    topic: 'evolution-of-sex',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'In pipefish, males carry fertilized eggs in a brood pouch. Females compete intensely for access to males, and females are more colorful/ornamented than males. How does Operational Sex Ratio (OSR) theory explain this sex-role reversal?',
    expectedAnswer: 'Because males carry eggs, they are temporarily unavailable for mating (they are the "caring" sex). The OSR becomes female-biased — more females are available for mating than males. This means males are the limiting resource. Females compete for the limiting sex → intrasexual selection on females → females are showier. OSR determines which sex competes, regardless of which sex is "male" or "female."',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q012',
    topic: 'evolution-of-sex',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: "Bateman's principle states that males benefit more from multiple matings than females. Which of the following BEST describes what this principle is about?",
    options: [
      'Males always invest less energy per gamete than females',
      'The variance in reproductive success is greater in males than females in most species, due to anisogamy',
      'Males are always more ornamented than females in any given species',
      'Females are the choosy sex in all species regardless of parental investment',
    ],
    correctIndex: 1,
    expectedAnswer: "Bateman's principle is about VARIANCE in reproductive success — male RS varies more with number of mates than female RS does. This arises from anisogamy (sperm cheap, eggs costly), meaning female RS is limited by resources, not mates. The key is variance, not just number of matings.",
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 7: Fisher's Runaway ──
  {
    id: 'evol-q013',
    topic: 'evolution-of-sex',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: "A male bird species has males with bright red beaks. Males with brighter red beaks are more attractive to females, but they are also more susceptible to blood parasites. Does this evidence better support Fisher's runaway selection or the Zahavian handicap (honest signal) hypothesis? Explain.",
    expectedAnswer: "The Zahavian handicap (honest signal) hypothesis. If males with red beaks suffer higher parasite loads, then only parasite-resistant males can afford to maintain bright red beaks. The susceptibility creates a cost that is condition-dependent — only high-quality males can pay it. In Fisher's runaway, the preference is arbitrary and the trait doesn't have to correlate with survival quality. Here, the correlation with parasite resistance suggests the trait is an honest indicator of genetic quality.",
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q014',
    topic: 'evolution-of-sex',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: "Which statement about Fisher's runaway selection is TRUE?",
    options: [
      "The male trait must be genuinely beneficial for survival for Fisher's runaway to operate",
      "Fisher's runaway requires that females can assess male genetic quality through the ornament",
      "Fisher's runaway involves a positive feedback between female preference and male ornament genes that can produce arbitrary, maladaptive traits",
      "Fisher's runaway predicts the male ornament will stabilize at the level where it maximizes male survival",
    ],
    correctIndex: 2,
    expectedAnswer: "Fisher's runaway is based on positive genetic feedback: preference gene and trait gene become genetically correlated. The ornament does NOT have to be a good indicator of survival quality — it is arbitrary. The runaway can produce maladaptive extremes until viability selection halts it.",
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 8: Mating Systems ──
  {
    id: 'evol-q015',
    topic: 'evolution-of-sex',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'Chimpanzees (promiscuous mating) and gorillas (harem-based polygyny) have very different relative testes sizes. Chimpanzees have much larger testes relative to body size than gorillas. What does this difference in testes size tell us about sperm competition in each species?',
    expectedAnswer: 'Chimps: large testes → high sperm competition → multiple males\' sperm competing in the same female simultaneously → promiscuous mating system confirmed. Gorillas: small testes → low sperm competition → dominant male monopolizes females in harem → little need for sperm to compete. Testes size is a proxy for the intensity of post-copulatory sperm competition.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q016',
    topic: 'evolution-of-sex',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Cryptic female choice refers to which post-mating phenomenon?',
    options: [
      'Females physically hiding from males they prefer not to mate with',
      'Females choosing mates based on hidden genetic markers not visible to researchers',
      'Females biasing fertilization toward preferred male sperm through internal mechanisms after copulation',
      'Females storing sperm from multiple males and then releasing it to fertilize all eggs simultaneously',
    ],
    correctIndex: 2,
    expectedAnswer: 'Cryptic female choice = females control fertilization AFTER copulation through internal mechanisms (selective sperm storage, uterine environment, selective use of stored sperm). It is "cryptic" because it happens internally, post-mating, making it hard to study. It is not about pre-mating choice or simply storing sperm.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 9: Sexual Conflict ──
  {
    id: 'evol-q017',
    topic: 'evolution-of-sex',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'In Drosophila melanogaster, males transfer seminal fluid proteins (Sfps) during mating that increase female egg-laying rate but also reduce female lifespan. Female Drosophila have evolved resistance alleles that reduce the effect of Sfps. What evolutionary dynamic does this describe?',
    expectedAnswer: "This is interlocus sexual conflict / antagonistic coevolution between the sexes. Male seminal proteins increase male fitness (more eggs) but decrease female fitness (shorter life). Females evolve resistance → males evolve more potent Sfps → females evolve more resistance → arms race within species. This is interlocus conflict: different loci in each sex are at evolutionary odds.",
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q018',
    topic: 'evolution-of-sex',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which statement about intralocus sexual conflict is CORRECT?',
    options: [
      'Intralocus conflict occurs when different alleles at different loci have opposing fitness effects in each sex',
      'Intralocus conflict occurs when the same allele has different fitness optima in males vs. females, making it impossible for selection to fully resolve the conflict at that locus',
      'Intralocus conflict is easily resolved by natural selection because one sex will always win',
      'Intralocus conflict only occurs in species with sexual dimorphism',
    ],
    correctIndex: 1,
    expectedAnswer: 'Intralocus conflict: same allele at same locus is beneficial in one sex, deleterious in the other. Selection cannot fully optimize for both sexes simultaneously at that locus. Partially resolved by sex-limited expression, genomic imprinting, or sex chromosomes. It is NOT easily resolved.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 10: Life History Trade-offs ──
  {
    id: 'evol-q019',
    topic: 'life-history',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: "In Stearns' opossum experiment, opossums on a predator-free island evolved slower reproduction and longer lifespans over ~5,000 years compared to mainland opossums facing high predation. What does this tell us about the relationship between extrinsic mortality and life history evolution?",
    expectedAnswer: 'High extrinsic mortality (predation on mainland) selects for fast life history — reproduce quickly before dying. Low extrinsic mortality (island) means animals can expect to survive longer → selection favors investing more in somatic maintenance (repair, immune function) because the animal is likely to survive to use those investments → slower, later reproduction and longer lifespan. Extrinsic mortality is the key driver of life history pace.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q020',
    topic: 'life-history',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'The r vs. K selection framework is often used to describe life history variation. Which statement is most accurate?',
    options: [
      'r-selected species always live in stable environments and invest heavily in each offspring',
      'K-selected species always have high extrinsic mortality and produce many small offspring',
      'r vs. K is a useful simplification but oversimplifies life history — extrinsic mortality rate is the more fundamental predictor of life history pace',
      'r vs. K selection perfectly predicts all life history variation in natural populations',
    ],
    correctIndex: 2,
    expectedAnswer: 'r vs. K selection is an oversimplification. The more fundamental variable is extrinsic mortality rate — high extrinsic mortality favors fast life history (many offspring, short life), low extrinsic mortality favors slow life history. r/K labels can be misleading because environment, density, and age-structure interact.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 11: Parental Investment ──
  {
    id: 'evol-q021',
    topic: 'life-history',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'According to the Trivers-Willard hypothesis, a female red deer (hind) in excellent body condition is predicted to produce a higher proportion of male calves than a hind in poor condition. Why?',
    expectedAnswer: 'Male red deer reproductive success has high variance — a high-quality male can sire many offspring while a low-quality male sires few. Female RS has lower variance — a female always achieves some reproductive success regardless of condition. A high-quality mother produces high-quality sons who can achieve very high RS. A mother in poor condition cannot give sons the quality boost needed to succeed; daughters will at least achieve moderate RS. So condition-dependent investment in sons = Trivers-Willard.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q022',
    topic: 'life-history',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Parental investment theory (Trivers 1972) predicts that the sex providing more parental investment per offspring will become the choosy sex. What is parental investment defined as?',
    options: [
      'The total time a parent spends with offspring',
      'The number of offspring produced per breeding season',
      'Any investment by the parent that increases offspring fitness at a cost to the parent\'s ability to invest in other offspring',
      'The energetic cost of producing gametes (eggs vs. sperm)',
    ],
    correctIndex: 2,
    expectedAnswer: 'Parental investment = ANY investment that increases offspring fitness at a cost to the parent\'s other offspring (future or current). This includes energy, time, risk, and resources. It is NOT just time spent, and it is broader than gamete cost alone (though anisogamy is the starting point).',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 12: Parent-Offspring Conflict ──
  {
    id: 'evol-q023',
    topic: 'life-history',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'The mouse Igf2 gene is paternally expressed (maternal copy is silenced) and promotes fetal growth. The Igf2r gene is maternally expressed (paternal copy is silenced) and degrades the IGF2 signal. Using kinship theory, explain why this pattern of imprinting makes evolutionary sense.',
    expectedAnswer: "Kinship theory: paternal genome benefits from maximizing this offspring's growth because the father's genes may not be present in the mother's future offspring (polyandry or multiple partners). So paternal genes are selected to extract maximum resources from the mother NOW. Maternal genome benefits from moderating current offspring demands to preserve resources for future offspring (all of whom share her genes equally). Igf2 (paternal) promotes growth = maximize current offspring. Igf2r (maternal) suppresses growth = moderate extraction for maternal fitness.",
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q024',
    topic: 'life-history',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Genomic imprinting results in parent-of-origin-specific gene expression. Which statement about imprinted genes is CORRECT?',
    options: [
      'Imprinting deletes the silenced copy of the gene from the genome',
      'The silenced allele is present in the genome but epigenetically silenced (e.g., by DNA methylation)',
      'Imprinting only affects the sex chromosomes, not autosomes',
      'Imprinting is a random process with no consistent parent-of-origin pattern',
    ],
    correctIndex: 1,
    expectedAnswer: 'The silenced allele is present but epigenetically silenced — typically through DNA methylation and histone modification. Imprinting does NOT delete genes. It is a reversible epigenetic modification with consistent parent-of-origin patterns. Many imprinted genes are on autosomes.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 13: Senescence ──
  {
    id: 'evol-q025',
    topic: 'life-history',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'A gene increases testosterone levels, which improves reproductive success in men aged 20-35 but increases prostate cancer risk at age 65+. Would natural selection favor or disfavor this gene, and which evolutionary theory of aging does this illustrate?',
    expectedAnswer: 'Natural selection would favor this gene (or at least not strongly disfavor it). This illustrates antagonistic pleiotropy (Williams): the gene is beneficial early in life (high testosterone → better RS at age 20-35) when selection is strong, and harmful late in life (cancer at 65+) when selection is weak (most reproduction already done). The late cost is not enough to outweigh the early benefit under natural selection.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q026',
    topic: 'life-history',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which statement correctly distinguishes mutation accumulation theory from antagonistic pleiotropy theory of senescence?',
    options: [
      'Mutation accumulation predicts that late-acting deleterious genes are ACTIVELY SELECTED FOR because they are beneficial early; antagonistic pleiotropy predicts they are passively tolerated',
      'Mutation accumulation predicts late-acting deleterious mutations ACCUMULATE PASSIVELY because selection is weak at old ages; antagonistic pleiotropy predicts genes BENEFICIAL EARLY but harmful late are actively favored',
      'Both theories predict the same mechanism — accumulation of late-acting deleterious mutations',
      'Antagonistic pleiotropy applies only to mammals; mutation accumulation applies only to insects',
    ],
    correctIndex: 1,
    expectedAnswer: 'Mutation accumulation (Medawar): late-acting deleterious mutations accumulate because purifying selection is weak at old ages — passive process. Antagonistic pleiotropy (Williams): genes that are BENEFICIAL EARLY but harmful late are ACTIVELY FAVORED by selection — active process. The distinction is passive accumulation vs. active selection for early-benefit genes.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 14: Coevolution / Arms Races ──
  {
    id: 'evol-q027',
    topic: 'coevolution',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: "Garter snake populations that live near rough-skinned newts (which produce tetrodotoxin/TTX) have much higher TTX resistance than garter snake populations that live far from newts. Newt populations near high-resistance snakes produce more TTX than newt populations far from resistant snakes. What coevolutionary concept best explains this geographic pattern?",
    expectedAnswer: "Geographic mosaic of coevolution (Thompson). Near newts = coevolutionary hotspot: reciprocal selection is strong, both species have evolved. Far from newts = coevolutionary coldspot: no selection pressure from TTX, so no resistance evolved in snakes, and newts have no need for high TTX. The coevolutionary dynamic is not uniform across the landscape — it occurs only where the species actually interact and selection pressures overlap.",
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q028',
    topic: 'coevolution',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which statement about coevolution is CORRECT?',
    options: [
      'Coevolution requires that both interacting species benefit from the interaction',
      'Coevolution refers to any case where two species share a similar evolutionary history, even without reciprocal selection',
      'Coevolution involves reciprocal evolutionary change driven by selection pressures between two interacting species',
      'Coevolution only occurs between parasites and their hosts, not between mutualists',
    ],
    correctIndex: 2,
    expectedAnswer: 'Coevolution = reciprocal evolutionary change between interacting species, driven by selection. It does NOT require mutual benefit — antagonistic coevolution (host-parasite arms races) is coevolution. It is NOT just shared evolutionary history (that is correlated evolution). Both mutualistic and antagonistic interactions can coevolve.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 15: Mimicry ──
  {
    id: 'evol-q029',
    topic: 'coevolution',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'A harmless hoverfly has evolved yellow-and-black stripes resembling those of yellowjacket wasps. Predators that have learned to avoid yellowjackets also avoid the hoverfly. If the hoverfly population grows much larger than the yellowjacket population, what would you predict would happen to the effectiveness of the mimicry?',
    expectedAnswer: 'The mimicry would break down. Predators would increasingly encounter the hoverfly (harmless mimic) and, upon eating it without consequence, learn that the yellow-and-black pattern is not always a reliable warning. As the mimic frequency increases relative to the model (yellowjacket), the predator\'s training signal is diluted — the pattern becomes associated with safety rather than danger. Selection would then disfavor the mimicry in hoverflies (predators no longer avoid them as much).',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q030',
    topic: 'coevolution',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'The monarch butterfly and the viceroy butterfly are a classic example taught as Batesian mimicry. What has more recent research revealed?',
    options: [
      'Viceroys are more toxic than monarchs, confirming Batesian mimicry',
      'Viceroys are also unpalatable to predators, suggesting the system is better described as Müllerian mimicry',
      'Neither butterfly is unpalatable — both rely on learned avoidance through repeated encounters',
      'The resemblance between monarchs and viceroys is due to common ancestry, not mimicry at all',
    ],
    correctIndex: 1,
    expectedAnswer: 'More recent research found that viceroy butterflies are also unpalatable to predators (contain their own defensive chemicals). This means both species benefit from the shared warning pattern → Müllerian mimicry, not Batesian. The classic textbook example of Batesian mimicry is now considered incorrect.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 16: Mutualism & Virulence ──
  {
    id: 'evol-q031',
    topic: 'coevolution',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'When myxoma virus was introduced to Australia in 1950 to control rabbit populations, it initially had near 100% lethality. Over subsequent years, both the virus virulence and rabbit resistance evolved. The virus evolved toward intermediate virulence. What evolutionary principle explains why the virus became less virulent over time?',
    expectedAnswer: 'Virulence-transmission trade-off. Very high virulence = kills rabbits too fast → virus cannot spread to new hosts → low transmission success. Low virulence = rabbits survive but virus persists and can spread. Intermediate virulence = optimal trade-off where the virus maximizes transmission before killing the host. Selection favored virus strains that could replicate and transmit before the host died.',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q032',
    topic: 'coevolution',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'What evidence supports the endosymbiotic origin of mitochondria?',
    options: [
      'Mitochondria have their own linear DNA similar to eukaryotic chromosomes and divide by mitosis',
      'Mitochondria have circular DNA, 70S ribosomes, double membranes, and sequence similarity to α-proteobacteria',
      'Mitochondria are found only in animal cells, suggesting they evolved after the divergence of plants and animals',
      'Mitochondria\'s genome is identical to the host cell nucleus, confirming they are derived from nuclear genes',
    ],
    correctIndex: 1,
    expectedAnswer: 'Evidence for endosymbiotic origin: (1) circular DNA (like prokaryotes), (2) 70S ribosomes (not 80S eukaryotic), (3) double membrane (from engulfment), (4) binary fission (not mitosis), (5) sequence similarity to α-proteobacteria specifically. Mitochondrial DNA is NOT identical to nuclear DNA — it is a reduced prokaryotic genome.',
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 17: Proximate vs. Ultimate ──
  {
    id: 'evol-q033',
    topic: 'behavior',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: "A male stickleback fish attacks a red-colored decoy placed in his territory. His testosterone levels are elevated during breeding season and activate aggressive neural circuits. (a) Is 'elevated testosterone activates aggression circuits' a proximate or ultimate explanation? (b) Why do male sticklebacks attack red objects at all — provide an ultimate explanation.",
    expectedAnswer: '(a) Proximate explanation — it describes the physiological mechanism (hormones → neural circuits → behavior). (b) Ultimate explanation: male sticklebacks with red bellies are rival males competing for territory and mates. Attacking red objects has fitness consequences — defending territory → exclusive access to females → higher reproductive success. Natural selection has favored males that respond aggressively to red (honest signal of rival male presence).',
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q034',
    topic: 'behavior',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: "Which statement about Tinbergen's four questions is CORRECT?",
    options: [
      'A proximate explanation replaces the need for an ultimate explanation for the same behavior',
      'Ultimate explanations (function and evolution) are more important than proximate explanations (mechanism and development)',
      'Proximate and ultimate explanations are complementary — both are needed for a complete understanding of any behavior',
      'Tinbergen\'s framework applies only to vertebrate behavior, not to invertebrates or plants',
    ],
    correctIndex: 2,
    expectedAnswer: "Proximate and ultimate explanations are complementary — they answer different questions about the same behavior. Proximate = how does it work mechanistically? Ultimate = why did it evolve? Neither replaces the other. Tinbergen's framework applies to all behavioral phenotypes, including invertebrates and even non-neural organisms.",
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 18: ESS & Game Theory ──
  {
    id: 'evol-q035',
    topic: 'behavior',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'In a Hawk-Dove population where Hawks are initially rare, Hawks always win fights against Doves (gaining the resource) and Doves retreat without cost. As Hawks become more common, what happens to the fitness of Hawks relative to Doves? Where does the population reach an ESS?',
    expectedAnswer: "When Hawks are rare, they mostly fight Doves and always win → high payoff. As Hawks become common, Hawks increasingly fight other Hawks → both pay the cost of injury (losing fights). Average Hawk payoff decreases as Hawk frequency rises. Dove payoff is constant (sometimes get resource when no Hawk is around). ESS is reached at the frequency where average Hawk payoff = average Dove payoff — a mixed strategy equilibrium (or mixed polymorphism). Neither pure Hawk nor pure Dove is an ESS.",
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q036',
    topic: 'behavior',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'Which statement about group selection is most accurate?',
    options: [
      'Group selection is completely invalid and has been fully replaced by kin selection as an explanation for all altruistic behaviors',
      'Group selection can operate under specific conditions (e.g., high between-group variation, low within-group selection), but is not the primary explanation for most social behaviors',
      'Group selection is the primary mechanism explaining all cooperative behaviors in social species',
      'Group selection and individual selection are mutually exclusive — a trait cannot be explained by both',
    ],
    correctIndex: 1,
    expectedAnswer: "Group selection is not universally rejected — it can operate under specific conditions: (1) sufficient variation between groups, (2) group-level selection stronger than within-group individual selection. These conditions are met rarely. Most altruistic behaviors are better explained by kin selection or reciprocal altruism. Group and individual selection are not mutually exclusive — multilevel selection theory allows both to operate simultaneously.",
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 19: Hamilton's Rule ──
  {
    id: 'evol-q037',
    topic: 'behavior',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: "A Belding's ground squirrel emits an alarm call when it spots a predator. The call attracts predator attention (C = 0.25 reduction in caller's own survival probability). The call warns 4 full siblings (r = 0.5 each), increasing each sibling's survival by 0.10. Does Hamilton's rule predict the alarm call should evolve? Show your calculation.",
    expectedAnswer: "Hamilton's rule: rB > C. B = total benefit = 4 × 0.10 = 0.40. r = 0.5 (full sibling relatedness). rB = 0.5 × 0.40 = 0.20. C = 0.25. rB (0.20) < C (0.25) → Hamilton's rule does NOT predict the call evolves with these values. However, if the squirrel warns more relatives, or if relatedness is higher (e.g., more full sibs), the call could evolve. This illustrates that kin selection depends on the actual values of r, B, and C.",
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q038',
    topic: 'behavior',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: "Which statement about Hamilton's rule (rB > C) is CORRECT?",
    options: [
      "Hamilton's rule predicts that altruistic behavior WILL evolve whenever the conditions are met",
      "Hamilton's rule predicts the conditions under which altruism CAN spread by natural selection, not that it will certainly evolve in all cases",
      "Hamilton's rule requires that the actor must be able to consciously recognize and identify kin",
      'Inclusive fitness equals direct fitness only — indirect effects through relatives are not included',
    ],
    correctIndex: 1,
    expectedAnswer: "Hamilton's rule predicts the conditions under which an altruistic allele can spread — when rB > C, the allele increases in frequency. It does not guarantee altruism will evolve (other factors: genetic drift, mutation, etc.). Kin recognition can be based on familiarity or spatial cues — it does not require conscious recognition. Inclusive fitness = direct + indirect fitness from relatives.",
    difficulty: 4,
    examTag: 'exam2',
  },
  // ── Bubble 20: Eusociality ──
  {
    id: 'evol-q039',
    topic: 'behavior',
    heading: 'apply-it',
    questionType: 'scenario',
    questionText: 'Termites are diploid yet are eusocial, with sterile worker castes. Haplodiploidy is often cited as promoting eusociality in Hymenoptera (ants, bees, wasps). Does the existence of eusocial termites disprove the haplodiploidy hypothesis for eusociality? Explain.',
    expectedAnswer: "No — termites do not disprove haplodiploidy's role in Hymenoptera; they show haplodiploidy is not the ONLY route to eusociality. Termites likely evolved eusociality via other mechanisms: fortress defense (the colony is a defended resource worth maintaining), assured fitness returns, or inbreeding increasing relatedness. The existence of diploid eusocial species shows haplodiploidy is neither necessary nor sufficient — it merely lowers the rB > C threshold for Hymenoptera by raising r to 0.75.",
    difficulty: 3,
    examTag: 'exam2',
  },
  {
    id: 'evol-q040',
    topic: 'behavior',
    heading: 'exam-traps',
    questionType: 'mcq',
    questionText: 'In Hymenoptera (ants, bees, wasps), worker females are more closely related to their sisters (r = 0.75) than to their own offspring (r = 0.5). Which statement CORRECTLY explains why r = 0.75 for sisters in haplodiploid species?',
    options: [
      'Because workers share 75% of their genes on average with all individuals in the colony',
      'Because the father is haploid, all daughters receive IDENTICAL copies of all paternal genes (r = 1.0 for paternal alleles), and on average r = 0.5 for maternal alleles, giving r = 0.75 overall to full sisters',
      'Because eusocial insects have 3 sets of chromosomes (triploid), increasing overall relatedness',
      'Because workers sacrifice their own reproduction entirely, transferring all genetic value to sisters',
    ],
    correctIndex: 1,
    expectedAnswer: "Haplodiploidy: father is haploid → all daughters get IDENTICAL paternal genome (r_paternal = 1.0 for full sisters from same father). From diploid mother, daughters share r = 0.5. Overall r to full sisters = (1.0 + 0.5)/2 = 0.75. Compare to r = 0.5 to own offspring. Since 0.75 > 0.5, Hamilton's rule more easily satisfied by helping raise sisters than raising own offspring.",
    difficulty: 4,
    examTag: 'exam2',
  },
]

// ─── Helper Functions ──────────────────────────────────────────────────────

export function todayDateStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function generateEvolId(): string {
  return 'evol-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function createEmptyEvolData(): EvolCourseData {
  return {
    version: 1,
    questions: [...DEFAULT_EVOL_QUESTIONS],
    sessionHistory: [],
    currentStreak: 0,
    lastStreakDate: '',
  }
}

export function migrateEvolCourseData(raw: unknown): EvolCourseData {
  const base = createEmptyEvolData()
  if (typeof raw !== 'object' || raw === null) return base
  const r = raw as Record<string, unknown>
  return {
    version: typeof r.version === 'number' ? r.version : 1,
    questions: Array.isArray(r.questions) ? r.questions as EvolQuestion[] : base.questions,
    sessionHistory: Array.isArray(r.sessionHistory) ? r.sessionHistory as EvolSessionSummary[] : [],
    currentStreak: typeof r.currentStreak === 'number' ? r.currentStreak : 0,
    lastStreakDate: typeof r.lastStreakDate === 'string' ? r.lastStreakDate : '',
  }
}
