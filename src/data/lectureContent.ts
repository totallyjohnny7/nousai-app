/**
 * Lecture content data for all NousAI courses.
 * Sourced from Canvas course pages — includes lectures, exams, assignments, and study guides.
 * Provides helpers to look up lecture schedules per course.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LectureItem {
  id: string;
  title: string;
  description: string;
  chapterRef?: string;
  unit?: string;
  weekNumber?: number;
  lectureNumber?: number;
  type: 'lecture' | 'exam' | 'assignment' | 'study-guide' | 'video';
  date?: string;
}

export interface CourseLectures {
  courseId: string;
  courseName: string;
  lectures: LectureItem[];
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

let _lcId = 0;
function lcUid(): string {
  return `lc-${_lcId++}`;
}

// ---------------------------------------------------------------------------
// BIOL 3020 — Molecular Biology of the Cell
// ---------------------------------------------------------------------------

export const BIOL3020_LECTURES: CourseLectures = {
  courseId: 'BIOL3020',
  courseName: '26SP BIOL3020-001:Molecular Biology Of The Cell',
  lectures: [
    // ---- Unit 1: Introduction to Cells (Ch 1) ----
    {
      id: lcUid(),
      title: 'L1: Introduction to Cells Pt1',
      description: 'Overview of cell biology; origin and evolution of cells; prokaryotes vs eukaryotes.',
      chapterRef: 'Ch 1',
      unit: 'Unit 1 — Introduction to Cells',
      weekNumber: 1,
      lectureNumber: 1,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L2: Introduction to Cells Pt2',
      description: 'Experimental models in cell biology; model organisms (E. coli, yeast, Drosophila, C. elegans, mice).',
      chapterRef: 'Ch 1',
      unit: 'Unit 1 — Introduction to Cells',
      weekNumber: 1,
      lectureNumber: 2,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L3: Introduction to Cells Pt3',
      description: 'Tools of cell biology: light microscopy, electron microscopy, and subcellular fractionation.',
      chapterRef: 'Ch 1',
      unit: 'Unit 1 — Introduction to Cells',
      weekNumber: 1,
      lectureNumber: 3,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L4: Introduction to Cells Pt4',
      description: 'Advanced microscopy techniques; fluorescence microscopy; cell culture methods.',
      chapterRef: 'Ch 1',
      unit: 'Unit 1 — Introduction to Cells',
      weekNumber: 2,
      lectureNumber: 4,
      type: 'lecture',
    },

    // ---- Unit 2: Chemical Components and Cell Chemistry (Ch 2) ----
    {
      id: lcUid(),
      title: 'L5: Chemical Components Pt1',
      description: 'Chemical bonds, thermodynamics, water properties; carbohydrates and lipids.',
      chapterRef: 'Ch 2',
      unit: 'Unit 2 — Chemical Components & Cell Chemistry',
      weekNumber: 2,
      lectureNumber: 5,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L6: Chemical Components Pt2',
      description: 'Nucleic acids and proteins; enzymes as biological catalysts; cell membranes.',
      chapterRef: 'Ch 2',
      unit: 'Unit 2 — Chemical Components & Cell Chemistry',
      weekNumber: 2,
      lectureNumber: 6,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L7: Chemical Components Pt3',
      description: 'Metabolic energy and ATP; glycolysis and oxidative phosphorylation; biosynthesis of cell constituents.',
      chapterRef: 'Ch 2',
      unit: 'Unit 2 — Chemical Components & Cell Chemistry',
      weekNumber: 3,
      lectureNumber: 7,
      type: 'lecture',
    },

    // ---- Unit 3: Proteins (Ch 3) ----
    {
      id: lcUid(),
      title: 'L8: Proteins Pt1',
      description: 'Heredity, genes, and DNA; the central dogma; expression of genetic information.',
      chapterRef: 'Ch 3',
      unit: 'Unit 3 — Fundamentals of Molecular Biology',
      weekNumber: 3,
      lectureNumber: 8,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L9: Proteins Pt2',
      description: 'Recombinant DNA technology; restriction enzymes; cloning vectors and PCR.',
      chapterRef: 'Ch 3',
      unit: 'Unit 3 — Fundamentals of Molecular Biology',
      weekNumber: 3,
      lectureNumber: 9,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L10: Proteins Pt3',
      description: 'Detection of nucleic acids and proteins; gene function in eukaryotes; CRISPR and gene editing.',
      chapterRef: 'Ch 3',
      unit: 'Unit 3 — Fundamentals of Molecular Biology',
      weekNumber: 4,
      lectureNumber: 10,
      type: 'lecture',
    },

    // ---- Unit 4: DNA and Chromosomes (Ch 4) ----
    {
      id: lcUid(),
      title: 'L11: DNA & Chromosomes Pt1',
      description: 'Structure of eukaryotic genes; introns and exons; gene organization.',
      chapterRef: '§4.1',
      unit: 'Unit 4 — DNA and Chromosomes',
      weekNumber: 4,
      lectureNumber: 11,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L12: DNA & Chromosomes Pt2',
      description: 'Noncoding sequences; noncoding RNAs; repetitive DNA sequences.',
      chapterRef: '§4.2',
      unit: 'Unit 4 — DNA and Chromosomes',
      weekNumber: 4,
      lectureNumber: 12,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L13: DNA & Chromosomes Pt3',
      description: 'Chromosomes and chromatin; centromeres, telomeres; chromosome structure and packaging.',
      chapterRef: '§4.3',
      unit: 'Unit 4 — DNA and Chromosomes',
      weekNumber: 5,
      lectureNumber: 13,
      type: 'lecture',
    },

    // ---- Unit 5: Genomes (Ch 4 continued, Ch 9) ----
    {
      id: lcUid(),
      title: 'L14: Genomes Pt1',
      description: 'Introduction to genomes; genome size and complexity; gene density across organisms.',
      chapterRef: '§4.1–4.2',
      unit: 'Unit 5 — Genomes',
      weekNumber: 5,
      lectureNumber: 14,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L15: Genomes Pt2',
      description: 'Genome sequencing approaches; comparative genomics; genome annotation.',
      chapterRef: 'Ch 4',
      unit: 'Unit 5 — Genomes',
      weekNumber: 5,
      lectureNumber: 15,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L16: Genomes Pt3',
      description: 'Eukaryotic genome organization; repetitive sequences; transposable elements; genomes and transcriptomes.',
      chapterRef: '§4.2–4.3, §9.1',
      unit: 'Unit 5 — Genomes',
      weekNumber: 6,
      lectureNumber: 16,
      type: 'lecture',
    },

    // ---- Unit 6: Bioinformatics (Ch 4 continued, Ch 9) ----
    {
      id: lcUid(),
      title: 'L17: Genomes Pt4 + Bioinformatics Pt1',
      description: 'Completing genomes unit; introduction to bioinformatics; sequence databases and BLAST.',
      chapterRef: '§4.3',
      unit: 'Unit 6 — Bioinformatics',
      weekNumber: 6,
      lectureNumber: 17,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L18: Bioinformatics Pt2',
      description: 'Sequence alignment algorithms; phylogenetic analysis from sequence data; genome browsers.',
      chapterRef: 'Ch 9',
      unit: 'Unit 6 — Bioinformatics',
      weekNumber: 6,
      lectureNumber: 18,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L19: Bioinformatics Pt3',
      description: 'Proteomics approaches; protein identification and localization; protein interaction networks.',
      chapterRef: 'Ch 9',
      unit: 'Unit 6 — Bioinformatics',
      weekNumber: 7,
      lectureNumber: 19,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L20: Bioinformatics Pt4',
      description: 'Systems biology; gene function screens; regulatory networks; synthetic biology overview.',
      chapterRef: 'Ch 9',
      unit: 'Unit 6 — Bioinformatics',
      weekNumber: 7,
      lectureNumber: 20,
      type: 'lecture',
    },

    // ---- Exam 1 ----
    {
      id: lcUid(),
      title: 'Exam 1',
      description: 'First exam covering Units 1–4 (Chapters 1–4): Introduction to Cells, Chemical Components, Fundamentals of Molecular Biology, DNA and Chromosomes.',
      unit: 'Exam',
      type: 'exam',
      date: '2026-02-18',
    },

    // ---- Unit 7: Replication and Repair (Ch 5) ----
    {
      id: lcUid(),
      title: 'L21: Replication & Repair Pt1',
      description: 'DNA replication machinery; DNA polymerases; replication fork; leading and lagging strands; Okazaki fragments.',
      chapterRef: '§5.1, §5.3',
      unit: 'Unit 7 — Replication & Repair',
      weekNumber: 7,
      lectureNumber: 21,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L22: Replication & Repair Pt2',
      description: 'DNA repair mechanisms; direct reversal; base excision and nucleotide excision repair; mismatch repair; double-strand break repair.',
      chapterRef: '§5.2, §10.1',
      unit: 'Unit 7 — Replication & Repair',
      weekNumber: 8,
      lectureNumber: 22,
      type: 'lecture',
    },

    // ---- Unit 8: The Nucleus (Ch 10) ----
    {
      id: lcUid(),
      title: 'L23: The Nucleus',
      description: 'Nuclear envelope and nuclear pore complex; nuclear import/export; chromatin organization; chromosome territories; nuclear bodies (nucleolus, Cajal bodies, speckles).',
      chapterRef: 'Ch 10',
      unit: 'Unit 8 — The Nucleus',
      weekNumber: 8,
      lectureNumber: 23,
      type: 'lecture',
    },

    // ---- Unit 9: RNA Synthesis (Ch 6, Ch 7) ----
    {
      id: lcUid(),
      title: 'L24: RNA Synthesis Pt1',
      description: 'Transcription in bacteria; RNA polymerase structure; bacterial promoters; sigma factors; translation of mRNA introduction.',
      chapterRef: '§6.1, §7.1',
      unit: 'Unit 9 — RNA Synthesis',
      weekNumber: 8,
      lectureNumber: 24,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L25: RNA Synthesis Pt2',
      description: 'Eukaryotic RNA polymerases (Pol I, II, III); general transcription factors; promoter elements; protein folding and processing.',
      chapterRef: '§6.2, §6.3, §7.2',
      unit: 'Unit 9 — RNA Synthesis',
      weekNumber: 9,
      lectureNumber: 25,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L26: RNA Synthesis Pt3',
      description: 'RNA processing: 5\' capping, 3\' polyadenylation, splicing; alternative splicing; RNA editing; protein stability and degradation.',
      chapterRef: '§7.2, §7.3',
      unit: 'Unit 9 — RNA Synthesis',
      weekNumber: 9,
      lectureNumber: 26,
      type: 'lecture',
    },

    // ---- Exam 2 ----
    {
      id: lcUid(),
      title: 'Exam 2',
      description: 'Second exam covering Units 5–8 (Chapters 4, 5, 9, 10): Genomes, Bioinformatics, Replication & Repair, The Nucleus.',
      unit: 'Exam',
      type: 'exam',
      date: '2026-03-25',
    },
  ],
};

// ---------------------------------------------------------------------------
// BIOL 4230 — Evolution
// ---------------------------------------------------------------------------

export const BIOL4230_LECTURES: CourseLectures = {
  courseId: 'BIOL4230',
  courseName: '26SP BIOL4230-001:Evolution',
  lectures: [
    {
      id: lcUid(),
      title: 'L#1: Introduction to Evolution',
      description: 'The whale and the virus; how scientists study evolution; overview of evolutionary biology as a discipline.',
      chapterRef: 'Ch 1',
      weekNumber: 1,
      lectureNumber: 1,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#2: Evolutionary Thinking',
      description: 'From natural philosophy to Darwin; a brief history of evolutionary ideas; nature before Darwin; the unofficial naturalist.',
      chapterRef: 'Ch 2',
      weekNumber: 1,
      lectureNumber: 2,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#3: Genes and Heritable Variation',
      description: 'Raw material for evolution; proteins, DNA, and RNA; mutations creating variation; heredity and the genotype-phenotype link.',
      chapterRef: 'Ch 5',
      weekNumber: 2,
      lectureNumber: 3,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#4: Genetic Evolution in Populations',
      description: 'Population genetics; Hardy-Weinberg equilibrium; genetic drift; bottlenecks and founder effects; selection; inbreeding.',
      chapterRef: 'Ch 6',
      weekNumber: 2,
      lectureNumber: 4,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#5: Quantitative Genetics Pt1',
      description: 'Genetics of quantitative traits; the evolutionary response to selection; heritability; quantitative trait locus analysis.',
      chapterRef: 'Ch 7',
      weekNumber: 3,
      lectureNumber: 5,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#6: Quantitative Genetics Pt2 — Selection and Plasticity',
      description: 'Continued quantitative genetics; phenotypic plasticity; reaction norms; genotype-by-environment interactions.',
      chapterRef: 'Ch 7',
      weekNumber: 3,
      lectureNumber: 6,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#7: Empirical Studies of Natural Selection',
      description: 'Darwin\'s finches; adaptive coloration in mice; geography of fitness; predators vs parasitoids; lactase persistence.',
      chapterRef: 'Ch 8',
      weekNumber: 4,
      lectureNumber: 7,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#8: Complex Adaptations',
      description: 'Cascades of genes; generating innovations; genetic toolkit for development; evolving eyes; convergent evolution; constraints.',
      chapterRef: 'Ch 10',
      weekNumber: 4,
      lectureNumber: 8,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#9: Coevolution',
      description: 'The web of life; building blocks of coevolution; coevolution as an engine of biodiversity; endosymbiosis; genomic parasites.',
      chapterRef: 'Ch 15',
      weekNumber: 5,
      lectureNumber: 9,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#10: Dinosaurs (Online Video)',
      description: 'Online lecture — watch assigned dinosaur evolution video and complete the associated quiz.',
      type: 'video',
      weekNumber: 5,
      lectureNumber: 10,
    },
    {
      id: lcUid(),
      title: 'L#10-11: Sex and Sexual Selection Pt1',
      description: 'Evolution of sex; why sex exists; sexual selection theory; rules of attraction; mating systems.',
      chapterRef: 'Ch 11',
      weekNumber: 6,
      lectureNumber: 10,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'L#11: Sex and Sexual Selection Pt2',
      description: 'Hidden dimensions of sexual selection; sexual conflict; antagonistic coevolution between the sexes.',
      chapterRef: 'Ch 11',
      weekNumber: 6,
      lectureNumber: 11,
      type: 'lecture',
    },

    // ---- Study Guides ----
    {
      id: lcUid(),
      title: 'Study Guide — Exam 1',
      description: 'Study guide for Exam 1 covering Chapters 1, 2, 5, 6, 7, and 8: Introduction, Evolutionary Thinking, Genes, Population Genetics, Quantitative Genetics, and Natural Selection.',
      type: 'study-guide',
    },
    {
      id: lcUid(),
      title: 'Study Guide — Exam 2',
      description: 'Study guide for Exam 2 covering Chapters 10, 15, and 11: Complex Adaptations, Coevolution, and Sex/Sexual Selection.',
      type: 'study-guide',
    },

    // ---- Assignments ----
    {
      id: lcUid(),
      title: 'Assignment: Hardy-Weinberg Problem Set',
      description: 'Practice problems applying Hardy-Weinberg equilibrium; calculating allele and genotype frequencies; testing for evolutionary forces.',
      chapterRef: 'Ch 6',
      type: 'assignment',
    },
    {
      id: lcUid(),
      title: 'Assignment: Narrow-Sense Heritability',
      description: 'Calculating narrow-sense heritability (h²); breeder\'s equation; predicting response to selection.',
      chapterRef: 'Ch 7',
      type: 'assignment',
    },
    {
      id: lcUid(),
      title: 'Assignment: Paper Review',
      description: 'Critical review of a primary research paper in evolutionary biology; summarizing methods, results, and significance.',
      type: 'assignment',
    },
  ],
};

// ---------------------------------------------------------------------------
// JAPN 1110 — Japanese (Nakama 1)
// ---------------------------------------------------------------------------

export const JAPN1110_LECTURES: CourseLectures = {
  courseId: 'JAPN1110',
  courseName: '26SP JAPN1110-004:Japanese',
  lectures: [
    {
      id: lcUid(),
      title: 'The Japanese Sound System',
      description: 'Introduction to Japanese phonetics; hiragana and katakana writing systems; basic pronunciation; mora timing.',
      chapterRef: 'Ch 1',
      weekNumber: 1,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'Greetings and Introductions',
      description: 'Common greetings (あいさつ); self-introductions (自己紹介); classroom expressions; basic sentence structure with です.',
      chapterRef: 'Ch 2',
      weekNumber: 2,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'Everyday Life',
      description: 'Telling time; describing daily activities (毎日の生活); particles は, が, を, に, で; verb conjugation in ます form.',
      chapterRef: 'Ch 3',
      weekNumber: 3,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'Japanese Cities',
      description: 'Location words (ここ, そこ, あそこ); existence verbs (います, あります); transportation vocabulary; past tense (ました).',
      chapterRef: 'Ch 4',
      weekNumber: 5,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'Japanese Homes',
      description: 'House and room vocabulary (家と部屋); い-adjectives and な-adjectives; describing rooms and furniture; counters.',
      chapterRef: 'Ch 5',
      weekNumber: 7,
      type: 'lecture',
    },
    {
      id: lcUid(),
      title: 'Leisure Activities',
      description: 'Hobbies vocabulary (趣味); て-form (て形); making requests and giving permission; describing ongoing actions (ています).',
      chapterRef: 'Ch 6',
      weekNumber: 9,
      type: 'lecture',
    },
  ],
};

// ---------------------------------------------------------------------------
// Master list of all courses
// ---------------------------------------------------------------------------

export const ALL_COURSE_LECTURES: CourseLectures[] = [
  BIOL3020_LECTURES,
  BIOL4230_LECTURES,
  JAPN1110_LECTURES,
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Look up a course's lectures by course name (uses substring matching like studyContentIndex).
 * @param courseName - Full or partial course name (e.g. "BIOL3020", "Evolution", "PHYS1120")
 * @returns Array of LectureItem for the matching course, or empty array if not found.
 */
export function getLecturesForCourse(courseName: string): LectureItem[] {
  const id = courseName.toUpperCase();

  if (id.includes('BIOL') && id.includes('3020')) {
    return BIOL3020_LECTURES.lectures;
  }
  if (id.includes('BIOL') && id.includes('4230')) {
    return BIOL4230_LECTURES.lectures;
  }
  if (id.includes('JAPN') && id.includes('1110')) {
    return JAPN1110_LECTURES.lectures;
  }

  // Fallback: try matching against courseId or courseName fields
  const match = ALL_COURSE_LECTURES.find(
    (c) =>
      c.courseId.toUpperCase().includes(id) ||
      c.courseName.toUpperCase().includes(id)
  );
  return match ? match.lectures : [];
}

/**
 * Check whether lecture content data is available for a given course.
 * @param courseName - Full or partial course name
 */
/**
 * Get lectures that reference a specific chapter (for cross-linking in Chapters tab).
 * @param courseName - Course name
 * @param chapterNum - The chapter number (e.g. 1, 5, 18)
 */
export function getLecturesForChapter(courseName: string, chapterNum: number): LectureItem[] {
  const all = getLecturesForCourse(courseName);
  if (all.length === 0 || !chapterNum) return [];

  // For BIOL3020, the course uses 8th edition numbering but lectures reference 9th edition chapters
  // The chapter index from the UI (1-14) maps to textbook chapters via chapter9e numbering
  // We try both the exact number and common section references
  return all.filter(l => {
    if (!l.chapterRef) return false;
    const ref = l.chapterRef;
    // Match "Ch 5", "§5.1", "§5.2", etc.
    const patterns = [
      new RegExp(`Ch\\s*${chapterNum}\\b`, 'i'),
      new RegExp(`§${chapterNum}\\.`, 'i'),
      new RegExp(`§${chapterNum}\\b`, 'i'),
    ];
    return patterns.some(p => p.test(ref));
  });
}

export function hasLectureContent(courseName: string): boolean {
  const id = courseName.toUpperCase();
  return (
    (id.includes('BIOL') && id.includes('3020')) ||
    (id.includes('BIOL') && id.includes('4230')) ||
    (id.includes('JAPN') && id.includes('1110'))
  );
}
