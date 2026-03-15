import type {
  NousAIData,
  Course,
  CourseTopic,
  FlashcardItem,
  QuizAttempt,
  QuizAnswer,
  ProficiencyData,
  ProficiencyEntry,
  SRCard,
  SRData,
  GamificationData,
  TimerState,
  Note,
  Drawing,
  StudySession,
  WeeklyPlan,
  Assignment,
  Badge,
} from '../types';

/* ── Helpers ──────────────────────────────────────────── */

let _idCounter = 0;
function uid(): string {
  _idCounter += 1;
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${_idCounter}`;
}

/** Return an ISO date string offset from today (2026-03-06) by `days`. */
function daysAgo(days: number): string {
  const d = new Date('2026-03-06T12:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date('2026-03-06T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function dateOnlyFuture(days: number): string {
  const d = new Date('2026-03-06T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/* ── Courses ──────────────────────────────────────────── */

function buildBiolCourse(): Course {
  const id = uid();
  const topics: CourseTopic[] = [
    {
      id: uid(),
      name: 'Cell Membrane Structure',
      status: 'mastered',
      subtopics: [
        { id: uid(), name: 'Phospholipid Bilayer', status: 'mastered' },
        { id: uid(), name: 'Membrane Proteins', status: 'mastered' },
        { id: uid(), name: 'Fluid Mosaic Model', status: 'learned' },
      ],
    },
    {
      id: uid(),
      name: 'Cellular Respiration',
      status: 'learned',
      subtopics: [
        { id: uid(), name: 'Glycolysis', status: 'learned' },
        { id: uid(), name: 'Krebs Cycle', status: 'in-progress' },
        { id: uid(), name: 'Electron Transport Chain', status: 'in-progress' },
      ],
    },
    {
      id: uid(),
      name: 'Cell Division',
      status: 'in-progress',
      subtopics: [
        { id: uid(), name: 'Mitosis Phases', status: 'learned' },
        { id: uid(), name: 'Meiosis I & II', status: 'in-progress' },
        { id: uid(), name: 'Cell Cycle Regulation', status: 'not-started' },
      ],
    },
    {
      id: uid(),
      name: 'Signal Transduction',
      status: 'in-progress',
      subtopics: [
        { id: uid(), name: 'G-Protein Coupled Receptors', status: 'in-progress' },
        { id: uid(), name: 'Receptor Tyrosine Kinases', status: 'not-started' },
        { id: uid(), name: 'Second Messengers', status: 'not-started' },
      ],
    },
    {
      id: uid(),
      name: 'Gene Expression',
      status: 'not-started',
      subtopics: [
        { id: uid(), name: 'Transcription', status: 'not-started' },
        { id: uid(), name: 'Translation', status: 'not-started' },
        { id: uid(), name: 'Post-Translational Modifications', status: 'not-started' },
      ],
    },
  ];

  const flashcards: FlashcardItem[] = [
    { front: 'What is the primary role of the phospholipid bilayer?', back: 'It forms a semi-permeable barrier that separates the interior of the cell from the external environment, controlling the passage of substances.' },
    { front: 'Define integral membrane proteins.', back: 'Proteins that span the entire lipid bilayer, often serving as channels, transporters, or receptors.' },
    { front: 'What are the net products of one round of glycolysis?', back: '2 pyruvate, 2 ATP (net), and 2 NADH per glucose molecule.' },
    { front: 'Where does the Krebs Cycle take place?', back: 'In the mitochondrial matrix.' },
    { front: 'What is the role of oxygen in the electron transport chain?', back: 'Oxygen is the final electron acceptor; it combines with electrons and hydrogen ions to form water.' },
    { front: 'Describe the key difference between mitosis and meiosis.', back: 'Mitosis produces two genetically identical diploid daughter cells, while meiosis produces four genetically unique haploid cells.' },
    { front: 'What are cyclins?', back: 'Regulatory proteins whose concentrations fluctuate during the cell cycle and activate cyclin-dependent kinases (CDKs) to drive cell cycle progression.' },
    { front: 'What is a second messenger in signal transduction?', back: 'A small intracellular signaling molecule (e.g., cAMP, Ca2+, IP3) released in response to an extracellular signal to propagate signaling cascades.' },
  ];

  return { id, name: 'BIOL 3020 - Cell Biology', shortName: 'BIOL', color: '#22c55e', topics, flashcards };
}

function buildChemCourse(): Course {
  const id = uid();
  const topics: CourseTopic[] = [
    {
      id: uid(),
      name: 'Alkanes and Cycloalkanes',
      status: 'mastered',
      subtopics: [
        { id: uid(), name: 'Nomenclature', status: 'mastered' },
        { id: uid(), name: 'Conformational Analysis', status: 'mastered' },
      ],
    },
    {
      id: uid(),
      name: 'Stereochemistry',
      status: 'learned',
      subtopics: [
        { id: uid(), name: 'Chirality and Enantiomers', status: 'mastered' },
        { id: uid(), name: 'R/S Configuration', status: 'learned' },
        { id: uid(), name: 'Diastereomers & Meso Compounds', status: 'in-progress' },
      ],
    },
    {
      id: uid(),
      name: 'Substitution Reactions',
      status: 'in-progress',
      subtopics: [
        { id: uid(), name: 'SN1 Mechanism', status: 'learned' },
        { id: uid(), name: 'SN2 Mechanism', status: 'in-progress' },
      ],
    },
    {
      id: uid(),
      name: 'Elimination Reactions',
      status: 'not-started',
      subtopics: [
        { id: uid(), name: 'E1 Mechanism', status: 'not-started' },
        { id: uid(), name: 'E2 Mechanism', status: 'not-started' },
        { id: uid(), name: 'Zaitsev vs Hofmann', status: 'not-started' },
      ],
    },
  ];

  const flashcards: FlashcardItem[] = [
    { front: 'What defines a chiral center?', back: 'A carbon atom bonded to four different substituents, making the molecule non-superimposable on its mirror image.' },
    { front: 'How do you assign R/S configuration?', back: 'Rank substituents by Cahn-Ingold-Prelog priority rules, orient the lowest priority group away, then determine if the remaining priorities go clockwise (R) or counterclockwise (S).' },
    { front: 'What conditions favor an SN2 reaction?', back: 'Strong nucleophile, primary or methyl substrate, polar aprotic solvent, and a good leaving group.' },
    { front: 'What is the rate law for SN1?', back: 'Rate = k[substrate]. It is first-order, depending only on the concentration of the substrate (unimolecular).' },
    { front: 'Define a meso compound.', back: 'A compound that has chiral centers but is optically inactive because it possesses an internal plane of symmetry.' },
    { front: 'What is Zaitsev\'s rule?', back: 'In elimination reactions, the more substituted (more stable) alkene product is typically the major product.' },
  ];

  return { id, name: 'CHEM 2010 - Organic Chemistry', shortName: 'CHEM', color: '#3b82f6', topics, flashcards };
}

function buildMathCourse(): Course {
  const id = uid();
  const topics: CourseTopic[] = [
    {
      id: uid(),
      name: 'Systems of Linear Equations',
      status: 'mastered',
      subtopics: [
        { id: uid(), name: 'Gaussian Elimination', status: 'mastered' },
        { id: uid(), name: 'Row Echelon Form', status: 'mastered' },
        { id: uid(), name: 'Homogeneous Systems', status: 'learned' },
      ],
    },
    {
      id: uid(),
      name: 'Matrix Algebra',
      status: 'learned',
      subtopics: [
        { id: uid(), name: 'Matrix Multiplication', status: 'mastered' },
        { id: uid(), name: 'Inverse Matrices', status: 'learned' },
        { id: uid(), name: 'Elementary Matrices', status: 'learned' },
      ],
    },
    {
      id: uid(),
      name: 'Determinants',
      status: 'in-progress',
      subtopics: [
        { id: uid(), name: 'Cofactor Expansion', status: 'learned' },
        { id: uid(), name: 'Properties of Determinants', status: 'in-progress' },
        { id: uid(), name: 'Cramer\'s Rule', status: 'not-started' },
      ],
    },
    {
      id: uid(),
      name: 'Vector Spaces',
      status: 'not-started',
      subtopics: [
        { id: uid(), name: 'Subspaces', status: 'not-started' },
        { id: uid(), name: 'Basis and Dimension', status: 'not-started' },
        { id: uid(), name: 'Rank and Nullity', status: 'not-started' },
      ],
    },
  ];

  const flashcards: FlashcardItem[] = [
    { front: 'What is the rank of a matrix?', back: 'The number of linearly independent rows (or columns), equivalently the number of pivot positions in its row echelon form.' },
    { front: 'When is a square matrix invertible?', back: 'When its determinant is non-zero, equivalently when it has full rank (all rows/columns are linearly independent).' },
    { front: 'State the Rank-Nullity Theorem.', back: 'For an m x n matrix A: rank(A) + nullity(A) = n, where n is the number of columns.' },
    { front: 'What does it mean for vectors to be linearly independent?', back: 'No vector in the set can be written as a linear combination of the others; the only solution to c1v1 + c2v2 + ... = 0 is the trivial solution.' },
    { front: 'Define the null space of a matrix A.', back: 'The set of all vectors x such that Ax = 0. It is a subspace of R^n.' },
    { front: 'How is the determinant affected by row operations?', back: 'Swapping rows multiplies det by -1, scaling a row by k multiplies det by k, adding a multiple of one row to another does not change det.' },
    { front: 'What is Cramer\'s Rule?', back: 'For a system Ax = b where det(A) != 0, each variable xi = det(Ai)/det(A), where Ai is A with column i replaced by b.' },
  ];

  return { id, name: 'MATH 2350 - Linear Algebra', shortName: 'MATH', color: '#a855f7', topics, flashcards };
}

/* ── Quiz History ─────────────────────────────────────── */

function buildQuizHistory(courses: Course[]): QuizAttempt[] {
  const [biol, chem, math] = courses;

  function makeAnswer(question: string, options: string[], correctAnswer: string, userAnswer: string): QuizAnswer {
    return {
      question: { type: 'multiple-choice', question, options, correctAnswer },
      userAnswer,
      correct: userAnswer === correctAnswer,
      timeMs: Math.floor(8000 + Math.random() * 25000),
    };
  }

  const attempts: QuizAttempt[] = [
    // Attempt 1 - BIOL - 12 days ago - 80%
    {
      id: uid(),
      name: 'Cell Membrane Quiz',
      subject: biol.name,
      subtopic: 'Cell Membrane Structure',
      date: daysAgo(12),
      questionCount: 5,
      score: 80,
      correct: 4,
      mode: 'standard',
      questions: [],
      answers: [
        makeAnswer('What is the main component of the cell membrane?', ['Cholesterol', 'Phospholipids', 'Glycoproteins', 'Carbohydrates'], 'Phospholipids', 'Phospholipids'),
        makeAnswer('Which model describes the cell membrane?', ['Lock and Key', 'Fluid Mosaic', 'Central Dogma', 'Induced Fit'], 'Fluid Mosaic', 'Fluid Mosaic'),
        makeAnswer('Integral proteins span the entire membrane.', ['True', 'False'], 'True', 'True'),
        makeAnswer('What maintains membrane fluidity at low temperatures?', ['Saturated fatty acids', 'Cholesterol', 'Peripheral proteins', 'Glycolipids'], 'Cholesterol', 'Cholesterol'),
        makeAnswer('Which type of transport requires ATP?', ['Osmosis', 'Facilitated diffusion', 'Active transport', 'Simple diffusion'], 'Active transport', 'Osmosis'),
      ],
    },
    // Attempt 2 - BIOL - 9 days ago - 60%
    {
      id: uid(),
      name: 'Cellular Respiration Quiz',
      subject: biol.name,
      subtopic: 'Cellular Respiration',
      date: daysAgo(9),
      questionCount: 5,
      score: 60,
      correct: 3,
      mode: 'standard',
      questions: [],
      answers: [
        makeAnswer('Where does glycolysis occur?', ['Mitochondria', 'Cytoplasm', 'Nucleus', 'ER'], 'Cytoplasm', 'Cytoplasm'),
        makeAnswer('Net ATP from glycolysis?', ['1', '2', '4', '36'], '2', '4'),
        makeAnswer('The Krebs Cycle occurs in the?', ['Cytoplasm', 'Matrix', 'Inner membrane', 'Outer membrane'], 'Matrix', 'Matrix'),
        makeAnswer('Final electron acceptor in ETC?', ['NADH', 'FADH2', 'Oxygen', 'CO2'], 'Oxygen', 'Oxygen'),
        makeAnswer('Total ATP per glucose (approx)?', ['2', '4', '30-32', '100'], '30-32', '4'),
      ],
    },
    // Attempt 3 - CHEM - 8 days ago - 100%
    {
      id: uid(),
      name: 'Stereochemistry Quiz',
      subject: chem.name,
      subtopic: 'Stereochemistry',
      date: daysAgo(8),
      questionCount: 4,
      score: 100,
      correct: 4,
      mode: 'standard',
      questions: [],
      answers: [
        makeAnswer('A chiral center requires how many different substituents?', ['2', '3', '4', '5'], '4', '4'),
        makeAnswer('Enantiomers rotate plane-polarized light in?', ['Same direction', 'Opposite directions', 'No rotation', 'Random directions'], 'Opposite directions', 'Opposite directions'),
        makeAnswer('A meso compound is optically active.', ['True', 'False'], 'False', 'False'),
        makeAnswer('R configuration means priority order is?', ['Counterclockwise', 'Clockwise', 'Depends on solvent', 'Cannot determine'], 'Clockwise', 'Clockwise'),
      ],
    },
    // Attempt 4 - MATH - 5 days ago - 86%
    {
      id: uid(),
      name: 'Matrix Algebra Quiz',
      subject: math.name,
      subtopic: 'Matrix Algebra',
      date: daysAgo(5),
      questionCount: 7,
      score: 86,
      correct: 6,
      mode: 'standard',
      questions: [],
      answers: [
        makeAnswer('A matrix is invertible when its determinant is?', ['Zero', 'Non-zero', 'Positive', 'Negative'], 'Non-zero', 'Non-zero'),
        makeAnswer('(AB)^-1 equals?', ['A^-1 B^-1', 'B^-1 A^-1', 'AB', 'BA'], 'B^-1 A^-1', 'B^-1 A^-1'),
        makeAnswer('The identity matrix has all 1s on the?', ['First row', 'Last column', 'Main diagonal', 'Anti-diagonal'], 'Main diagonal', 'Main diagonal'),
        makeAnswer('Matrix multiplication is commutative.', ['True', 'False'], 'False', 'False'),
        makeAnswer('An elementary matrix is obtained by performing one row operation on?', ['Any matrix', 'The identity matrix', 'A zero matrix', 'The original matrix'], 'The identity matrix', 'The identity matrix'),
        makeAnswer('If A is 3x2 and B is 2x4, AB is?', ['3x4', '2x2', '3x2', '4x3'], '3x4', '3x4'),
        makeAnswer('The transpose of a product (AB)^T is?', ['A^T B^T', 'B^T A^T', 'AB', 'B A'], 'B^T A^T', 'A^T B^T'),
      ],
    },
    // Attempt 5 - CHEM - 3 days ago - 67%
    {
      id: uid(),
      name: 'SN1/SN2 Reactions Quiz',
      subject: chem.name,
      subtopic: 'Substitution Reactions',
      date: daysAgo(3),
      questionCount: 6,
      score: 67,
      correct: 4,
      mode: 'standard',
      questions: [],
      answers: [
        makeAnswer('SN2 is favored by which substrate?', ['Tertiary', 'Secondary', 'Primary/methyl', 'Neopentyl'], 'Primary/methyl', 'Primary/methyl'),
        makeAnswer('SN1 proceeds through a?', ['Concerted mechanism', 'Carbocation intermediate', 'Free radical', 'Carbanion'], 'Carbocation intermediate', 'Carbocation intermediate'),
        makeAnswer('SN2 reaction kinetics are?', ['Zero order', 'First order', 'Second order', 'Third order'], 'Second order', 'Second order'),
        makeAnswer('Best solvent for SN2?', ['Polar protic', 'Polar aprotic', 'Nonpolar', 'Water'], 'Polar aprotic', 'Polar protic'),
        makeAnswer('SN1 produces which stereochemical outcome?', ['Inversion', 'Retention', 'Racemization', 'No change'], 'Racemization', 'Racemization'),
        makeAnswer('Which is the best leaving group?', ['OH-', 'NH2-', 'I-', 'F-'], 'I-', 'F-'),
      ],
    },
    // Attempt 6 - MATH - 1 day ago - 75%
    {
      id: uid(),
      name: 'Determinants Quiz',
      subject: math.name,
      subtopic: 'Determinants',
      date: daysAgo(1),
      questionCount: 4,
      score: 75,
      correct: 3,
      mode: 'standard',
      questions: [],
      answers: [
        makeAnswer('Swapping two rows multiplies the determinant by?', ['0', '1', '-1', '2'], '-1', '-1'),
        makeAnswer('det(AB) equals?', ['det(A) + det(B)', 'det(A) * det(B)', 'det(A) - det(B)', 'det(A) / det(B)'], 'det(A) * det(B)', 'det(A) * det(B)'),
        makeAnswer('If a row of zeros exists, the determinant is?', ['1', '0', 'Undefined', '-1'], '0', '0'),
        makeAnswer('Cofactor expansion can be performed along any?', ['Diagonal only', 'Row or column', 'Row only', 'Column only'], 'Row or column', 'Row only'),
      ],
    },
  ];

  return attempts;
}

/* ── Proficiency Data ─────────────────────────────────── */

function buildProficiency(): ProficiencyData {
  function entry(subject: string, subtopic: string, scores: number[], streak: number): [string, string, ProficiencyEntry] {
    const attempts = scores.map((p, i) => ({ date: daysAgo(scores.length - i), percentage: p }));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return [
      subject,
      subtopic,
      {
        subject,
        subtopic,
        attempts,
        proficiencyScore: Math.round(avg),
        isProficient: avg >= 85,
        currentStreak: streak,
        bestStreak: Math.max(streak, Math.floor(streak * 1.5)),
      },
    ];
  }

  const entries = [
    entry('BIOL 3020 - Cell Biology', 'Cell Membrane Structure', [75, 80, 90, 95], 3),
    entry('BIOL 3020 - Cell Biology', 'Cellular Respiration', [50, 60, 65, 70], 1),
    entry('BIOL 3020 - Cell Biology', 'Cell Division', [55, 60], 0),
    entry('CHEM 2010 - Organic Chemistry', 'Stereochemistry', [85, 90, 95, 100], 4),
    entry('CHEM 2010 - Organic Chemistry', 'Alkanes and Cycloalkanes', [80, 85, 90], 3),
    entry('CHEM 2010 - Organic Chemistry', 'Substitution Reactions', [60, 67], 0),
    entry('MATH 2350 - Linear Algebra', 'Matrix Algebra', [70, 80, 86], 2),
    entry('MATH 2350 - Linear Algebra', 'Systems of Linear Equations', [88, 92, 95], 3),
    entry('MATH 2350 - Linear Algebra', 'Determinants', [65, 75], 1),
  ];

  const subjects: Record<string, Record<string, ProficiencyEntry>> = {};
  for (const [subj, sub, e] of entries) {
    if (!subjects[subj]) subjects[subj] = {};
    subjects[subj][sub] = e;
  }

  return {
    settings: {
      proficiencyThreshold: 85,
      minAttempts: 3,
      recentWeight: 0.7,
    },
    subjects,
  };
}

/* ── Spaced Repetition Data ───────────────────────────── */

function buildSRData(): SRData {
  const cards: SRCard[] = [
    // New cards
    {
      key: 'biol-gene-transcription', subject: 'BIOL 3020 - Cell Biology', subtopic: 'Transcription',
      S: 0, D: 5, reps: 0, lapses: 0, state: 'new',
      lastReview: '', nextReview: daysAgo(0),
      elapsedDays: 0, scheduledDays: 0,
      history: [],
    },
    {
      key: 'biol-gene-translation', subject: 'BIOL 3020 - Cell Biology', subtopic: 'Translation',
      S: 0, D: 5, reps: 0, lapses: 0, state: 'new',
      lastReview: '', nextReview: daysAgo(0),
      elapsedDays: 0, scheduledDays: 0,
      history: [],
    },
    // Learning cards
    {
      key: 'biol-resp-krebs', subject: 'BIOL 3020 - Cell Biology', subtopic: 'Krebs Cycle',
      S: 1.2, D: 5.8, reps: 2, lapses: 0, state: 'learning',
      lastReview: daysAgo(1), nextReview: daysAgo(0),
      elapsedDays: 1, scheduledDays: 1,
      history: [
        { date: daysAgo(3), grade: 2, S: 0.5, D: 5.8, R: 0.9, interval: 1 },
        { date: daysAgo(1), grade: 3, S: 1.2, D: 5.8, R: 0.85, interval: 1 },
      ],
    },
    {
      key: 'chem-sub-sn2', subject: 'CHEM 2010 - Organic Chemistry', subtopic: 'SN2 Mechanism',
      S: 0.8, D: 6.2, reps: 1, lapses: 0, state: 'learning',
      lastReview: daysAgo(1), nextReview: daysAgo(0),
      elapsedDays: 1, scheduledDays: 1,
      history: [
        { date: daysAgo(1), grade: 2, S: 0.8, D: 6.2, R: 0.88, interval: 1 },
      ],
    },
    // Review cards (well-learned)
    {
      key: 'biol-mem-phospholipid', subject: 'BIOL 3020 - Cell Biology', subtopic: 'Phospholipid Bilayer',
      S: 14.5, D: 4.2, reps: 8, lapses: 0, state: 'review',
      lastReview: daysAgo(7), nextReview: daysFromNow(7),
      elapsedDays: 7, scheduledDays: 14,
      history: [
        { date: daysAgo(60), grade: 3, S: 1.0, D: 5.0, R: 0.9, interval: 1 },
        { date: daysAgo(45), grade: 3, S: 3.2, D: 4.8, R: 0.88, interval: 3 },
        { date: daysAgo(30), grade: 4, S: 7.1, D: 4.5, R: 0.91, interval: 7 },
        { date: daysAgo(7), grade: 3, S: 14.5, D: 4.2, R: 0.9, interval: 14 },
      ],
    },
    {
      key: 'chem-stereo-chirality', subject: 'CHEM 2010 - Organic Chemistry', subtopic: 'Chirality and Enantiomers',
      S: 21.0, D: 3.8, reps: 10, lapses: 1, state: 'review',
      lastReview: daysAgo(5), nextReview: daysFromNow(16),
      elapsedDays: 5, scheduledDays: 21,
      history: [
        { date: daysAgo(90), grade: 3, S: 1.0, D: 5.0, R: 0.9, interval: 1 },
        { date: daysAgo(60), grade: 4, S: 5.0, D: 4.2, R: 0.92, interval: 5 },
        { date: daysAgo(30), grade: 3, S: 12.0, D: 3.9, R: 0.88, interval: 12 },
        { date: daysAgo(5), grade: 4, S: 21.0, D: 3.8, R: 0.91, interval: 21 },
      ],
    },
    {
      key: 'math-sys-gaussian', subject: 'MATH 2350 - Linear Algebra', subtopic: 'Gaussian Elimination',
      S: 18.0, D: 4.0, reps: 9, lapses: 0, state: 'review',
      lastReview: daysAgo(4), nextReview: daysFromNow(14),
      elapsedDays: 4, scheduledDays: 18,
      history: [
        { date: daysAgo(50), grade: 3, S: 2.0, D: 5.0, R: 0.9, interval: 2 },
        { date: daysAgo(35), grade: 3, S: 6.0, D: 4.5, R: 0.87, interval: 6 },
        { date: daysAgo(20), grade: 4, S: 12.0, D: 4.0, R: 0.92, interval: 12 },
        { date: daysAgo(4), grade: 3, S: 18.0, D: 4.0, R: 0.89, interval: 18 },
      ],
    },
    {
      key: 'math-matrix-inverse', subject: 'MATH 2350 - Linear Algebra', subtopic: 'Inverse Matrices',
      S: 8.5, D: 4.8, reps: 5, lapses: 0, state: 'review',
      lastReview: daysAgo(3), nextReview: daysFromNow(5),
      elapsedDays: 3, scheduledDays: 8,
      history: [
        { date: daysAgo(20), grade: 3, S: 1.5, D: 5.2, R: 0.9, interval: 1 },
        { date: daysAgo(12), grade: 3, S: 4.0, D: 5.0, R: 0.86, interval: 4 },
        { date: daysAgo(3), grade: 4, S: 8.5, D: 4.8, R: 0.91, interval: 8 },
      ],
    },
    // Relearning cards (lapsed)
    {
      key: 'biol-div-meiosis', subject: 'BIOL 3020 - Cell Biology', subtopic: 'Meiosis I & II',
      S: 0.6, D: 7.5, reps: 4, lapses: 2, state: 'relearning',
      lastReview: daysAgo(1), nextReview: daysAgo(0),
      elapsedDays: 1, scheduledDays: 1,
      history: [
        { date: daysAgo(30), grade: 3, S: 3.0, D: 5.5, R: 0.9, interval: 3 },
        { date: daysAgo(20), grade: 1, S: 0.5, D: 6.5, R: 0.6, interval: 1 },
        { date: daysAgo(10), grade: 3, S: 2.0, D: 7.0, R: 0.85, interval: 2 },
        { date: daysAgo(1), grade: 1, S: 0.6, D: 7.5, R: 0.55, interval: 1 },
      ],
    },
    {
      key: 'math-det-cofactor', subject: 'MATH 2350 - Linear Algebra', subtopic: 'Cofactor Expansion',
      S: 0.4, D: 6.8, reps: 3, lapses: 1, state: 'relearning',
      lastReview: daysAgo(2), nextReview: daysAgo(0),
      elapsedDays: 2, scheduledDays: 1,
      history: [
        { date: daysAgo(15), grade: 3, S: 2.5, D: 5.5, R: 0.88, interval: 2 },
        { date: daysAgo(8), grade: 3, S: 5.0, D: 5.2, R: 0.86, interval: 5 },
        { date: daysAgo(2), grade: 1, S: 0.4, D: 6.8, R: 0.5, interval: 1 },
      ],
    },
  ];

  return { cards };
}

/* ── Gamification ─────────────────────────────────────── */

function buildGamification(): GamificationData {
  const badges: Badge[] = [
    { id: 'first-quiz', name: 'Quiz Starter', icon: 'trophy', description: 'Completed your first quiz', earnedAt: daysAgo(14) },
    { id: 'streak-7', name: 'Week Warrior', icon: 'flame', description: 'Maintained a 7-day study streak', earnedAt: daysAgo(2) },
    { id: 'perfect-score', name: 'Perfect Score', icon: 'star', description: 'Achieved 100% on a quiz', earnedAt: daysAgo(8) },
  ];

  return {
    xp: 1250,
    level: 5,
    totalQuizzes: 42,
    totalCorrect: 158,
    totalAnswered: 196,
    totalMinutes: 840,
    streak: 7,
    bestStreak: 14,
    streakFreezes: 1,
    lastStudyDate: daysAgo(0),
    perfectScores: 3,
    badges,
    dailyGoal: {
      todayXp: 65,
      todayMinutes: 35,
      todayQuestions: 12,
      targetXp: 100,
    },
  };
}

/* ── Study Sessions ───────────────────────────────────── */

function buildStudySessions(courses: Course[]): StudySession[] {
  const [biol, chem, math] = courses;
  return [
    { id: uid(), courseId: biol.id, type: 'review', durationMs: 45 * 60 * 1000, date: daysAgo(13), notes: 'Reviewed cell membrane notes and diagrams' },
    { id: uid(), courseId: chem.id, type: 'practice', durationMs: 30 * 60 * 1000, date: daysAgo(11), notes: 'Worked through stereochemistry practice problems' },
    { id: uid(), courseId: math.id, type: 'lecture', durationMs: 50 * 60 * 1000, date: daysAgo(10), notes: 'Matrix algebra lecture - covered inverse matrices' },
    { id: uid(), courseId: biol.id, type: 'quiz', durationMs: 25 * 60 * 1000, date: daysAgo(9) },
    { id: uid(), courseId: chem.id, type: 'review', durationMs: 40 * 60 * 1000, date: daysAgo(7), notes: 'Reviewed SN1/SN2 reaction mechanisms' },
    { id: uid(), courseId: math.id, type: 'practice', durationMs: 55 * 60 * 1000, date: daysAgo(5), notes: 'Determinant calculation practice' },
    { id: uid(), courseId: biol.id, type: 'flashcards', durationMs: 20 * 60 * 1000, date: daysAgo(2), notes: 'Spaced repetition flashcard session' },
    { id: uid(), courseId: chem.id, type: 'quiz', durationMs: 35 * 60 * 1000, date: daysAgo(1) },
  ];
}

/* ── Notes ────────────────────────────────────────────── */

function buildNotes(): Note[] {
  return [
    {
      id: uid(),
      title: 'Cell Membrane Key Concepts',
      content: '# Cell Membrane\n\n## Structure\n- Phospholipid bilayer with hydrophilic heads and hydrophobic tails\n- Cholesterol maintains fluidity\n- Integral and peripheral proteins\n\n## Functions\n- Selective permeability\n- Cell signaling\n- Cell adhesion\n\n## Transport\n- Passive: diffusion, osmosis, facilitated diffusion\n- Active: pumps, vesicular transport',
      folder: 'BIOL 3020',
      tags: ['cell-biology', 'membrane', 'lecture-notes'],
      createdAt: daysAgo(14),
      updatedAt: daysAgo(7),
      type: 'note',
    },
    {
      id: uid(),
      title: 'Stereochemistry Quiz Results',
      content: '# Stereochemistry Quiz - 100%\n\nAll 4 questions correct.\n\nKey takeaways:\n- Confident with chirality identification\n- R/S configuration assignment is solid\n- Meso compounds understood\n\nNext: Focus on diastereomer relationships and optical rotation calculations.',
      folder: 'CHEM 2010',
      tags: ['quiz', 'stereochemistry', 'organic-chemistry'],
      createdAt: daysAgo(8),
      updatedAt: daysAgo(8),
      type: 'quiz',
    },
    {
      id: uid(),
      title: 'AI Study Guide: Cellular Respiration',
      content: '# Cellular Respiration Study Guide\n\n## Overview\nCellular respiration is the process by which cells break down glucose to produce ATP.\n\n## Three Stages\n1. **Glycolysis** (cytoplasm): Glucose -> 2 Pyruvate + 2 ATP + 2 NADH\n2. **Krebs Cycle** (mitochondrial matrix): Acetyl-CoA -> CO2 + NADH + FADH2 + GTP\n3. **Electron Transport Chain** (inner membrane): NADH/FADH2 -> ~28 ATP\n\n## Total Yield\n~30-32 ATP per glucose molecule\n\n## Key Enzymes\n- Hexokinase (glycolysis)\n- Pyruvate dehydrogenase (link reaction)\n- Citrate synthase (Krebs)\n- ATP synthase (ETC)',
      folder: 'BIOL 3020',
      tags: ['ai-generated', 'cellular-respiration', 'study-guide'],
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
      type: 'ai-output',
    },
    {
      id: uid(),
      title: 'Linear Algebra Formula Sheet',
      content: '# Linear Algebra Formulas\n\n## Determinant\n- 2x2: ad - bc\n- nxn: cofactor expansion along any row/column\n- det(AB) = det(A) * det(B)\n\n## Matrix Inverse\n- A^(-1) = (1/det(A)) * adj(A)\n- (AB)^(-1) = B^(-1) A^(-1)\n\n## Rank-Nullity\nrank(A) + nullity(A) = n (number of columns)\n\n## Cramer\'s Rule\nx_i = det(A_i) / det(A)',
      folder: 'MATH 2350',
      tags: ['formulas', 'linear-algebra', 'reference'],
      createdAt: daysAgo(6),
      updatedAt: daysAgo(3),
      type: 'note',
    },
    {
      id: uid(),
      title: 'AI Explanation: SN1 vs SN2',
      content: '# SN1 vs SN2 Comparison\n\n| Feature | SN1 | SN2 |\n|---------|-----|-----|\n| Rate Law | First order | Second order |\n| Substrate | Tertiary > Secondary | Methyl > Primary |\n| Nucleophile | Weak | Strong |\n| Solvent | Polar protic | Polar aprotic |\n| Mechanism | Two steps (carbocation) | One step (concerted) |\n| Stereochemistry | Racemization | Inversion |\n\n## When to choose SN1 vs SN2?\n- Look at the substrate first\n- Then consider nucleophile strength\n- Finally consider solvent',
      folder: 'CHEM 2010',
      tags: ['ai-generated', 'substitution', 'mechanisms'],
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
      type: 'ai-output',
    },
  ];
}

/* ── Drawings ─────────────────────────────────────────── */

function buildDrawings(): Drawing[] {
  return [
    {
      id: uid(),
      name: 'Cell Membrane Diagram',
      data: '', // placeholder - would be canvas data in real usage
      createdAt: daysAgo(12),
      updatedAt: daysAgo(12),
      width: 800,
      height: 600,
      folder: 'BIOL 3020',
      template: 'blank',
    },
    {
      id: uid(),
      name: 'SN2 Reaction Mechanism',
      data: '', // placeholder
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
      width: 1000,
      height: 500,
      folder: 'CHEM 2010',
      template: 'blank',
    },
  ];
}

/* ── Assignments ──────────────────────────────────────── */

function buildAssignments(courses: Course[]): Assignment[] {
  const [biol, chem, math] = courses;
  return [
    // Completed
    { id: uid(), name: 'Lab Report: Osmosis Experiment', courseId: biol.id, dueDate: daysAgo(5), type: 'lab-report', weight: 10, completed: true },
    { id: uid(), name: 'Problem Set 3: Stereochemistry', courseId: chem.id, dueDate: daysAgo(3), type: 'homework', weight: 5, completed: true },
    // Due soon (upcoming)
    { id: uid(), name: 'Midterm Exam: Chapters 1-6', courseId: biol.id, dueDate: dateOnlyFuture(4), type: 'exam', weight: 25, completed: false },
    { id: uid(), name: 'Homework 5: Determinants & Cramer\'s Rule', courseId: math.id, dueDate: dateOnlyFuture(2), type: 'homework', weight: 5, completed: false },
    // Overdue
    { id: uid(), name: 'Reading Response: Reaction Kinetics', courseId: chem.id, dueDate: daysAgo(1), type: 'reading', weight: 3, completed: false },
    // Future
    { id: uid(), name: 'Final Project: Vector Space Application', courseId: math.id, dueDate: dateOnlyFuture(21), type: 'project', weight: 20, completed: false },
  ];
}

/* ── Weekly Plan ──────────────────────────────────────── */

function buildWeeklyPlan(courses: Course[]): WeeklyPlan {
  const [biol, chem, math] = courses;
  // Week of 2026-03-02 (Monday)
  return {
    weekOf: '2026-03-02',
    notes: 'Focus on midterm prep for BIOL. Keep up with CHEM problem sets. Catch up on MATH determinants.',
    days: [
      {
        day: 'Monday',
        blocks: [
          { courseId: biol.id, type: 'review', minutes: 45, description: 'Review cell membrane and respiration notes', done: true },
          { courseId: math.id, type: 'practice', minutes: 30, description: 'Practice Gaussian elimination problems', done: true },
        ],
      },
      {
        day: 'Tuesday',
        blocks: [
          { courseId: chem.id, type: 'lecture', minutes: 50, description: 'Attend Organic Chemistry lecture', done: true },
          { courseId: biol.id, type: 'flashcards', minutes: 20, description: 'Spaced repetition - cell biology cards', done: true },
        ],
      },
      {
        day: 'Wednesday',
        blocks: [
          { courseId: math.id, type: 'lecture', minutes: 50, description: 'Linear Algebra lecture - determinants', done: true },
          { courseId: chem.id, type: 'practice', minutes: 40, description: 'SN1/SN2 practice problems', done: true },
        ],
      },
      {
        day: 'Thursday',
        blocks: [
          { courseId: biol.id, type: 'review', minutes: 60, description: 'Midterm study session - cell division', done: true },
          { courseId: math.id, type: 'quiz', minutes: 25, description: 'Self-test on matrix algebra', done: true },
        ],
      },
      {
        day: 'Friday',
        blocks: [
          { courseId: biol.id, type: 'review', minutes: 90, description: 'Comprehensive midterm review', done: false },
          { courseId: chem.id, type: 'review', minutes: 30, description: 'Review substitution reaction notes', done: false },
        ],
      },
      {
        day: 'Saturday',
        blocks: [
          { courseId: biol.id, type: 'practice', minutes: 60, description: 'Practice exam for midterm', done: false },
          { courseId: math.id, type: 'practice', minutes: 45, description: 'Determinant and Cramer\'s Rule homework', done: false },
        ],
      },
      {
        day: 'Sunday',
        blocks: [
          { courseId: biol.id, type: 'review', minutes: 30, description: 'Light review before Monday midterm', done: false },
          { courseId: chem.id, type: 'flashcards', minutes: 20, description: 'Flash card review - organic chemistry', done: false },
        ],
      },
    ],
  };
}

/* ── Timer State ──────────────────────────────────────── */

function buildTimerState(): TimerState {
  return {
    swRunning: false,
    swAccumulatedMs: 0,
    swResumedAt: null,
    swCourseId: '',
    swType: 'review',
    pomoRunning: false,
    pomoEndTime: null,
    pomoWorkMin: 25,
    pomoBreakMin: 5,
    pomoLongBreakMin: 15,
    pomoPhase: 'idle',
    pomoSession: 0,
    pomoTotalSessions: 0,
    pomoRemainingMs: 0,
    savedAt: Date.now(),
  };
}

/* ── Main generator ───────────────────────────────────── */

export function generateTestData(): NousAIData {
  // Reset the counter for deterministic-ish IDs within a single call
  _idCounter = 0;

  const biol = buildBiolCourse();
  const chem = buildChemCourse();
  const math = buildMathCourse();
  const courses = [biol, chem, math];

  return {
    settings: {
      aiProvider: 'openai',
      model: 'gpt-5.4',
      canvasUrl: '',
      canvasToken: '',
      canvasIcalUrl: '',
      canvasEvents: [],
    },
    pluginData: {
      quizHistory: buildQuizHistory(courses),
      coachData: {
        courses,
        sessions: [],
        streak: 7,
        totalStudyMinutes: 840,
        weeklyPlan: null,
      },
      proficiencyData: buildProficiency(),
      srData: buildSRData(),
      timerState: buildTimerState(),
      gamificationData: buildGamification(),
      quizBank: {},
      notes: buildNotes(),
      drawings: buildDrawings(),
      studySessions: buildStudySessions(courses),
      weeklyPlan: buildWeeklyPlan(courses),
      assignments: buildAssignments(courses),
      matchSets: [],
      knowledgeWeb: [],
    },
  };
}

/* ── Injection helper ─────────────────────────────────── */

export function injectTestData(setData: (d: NousAIData) => void): void {
  const data = generateTestData();
  setData(data);
}
