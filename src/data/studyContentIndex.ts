/**
 * Unified study content index — maps course IDs to study content
 * Provides a single function to get key terms/concepts for any course chapter
 */

import { BIOL3020_STUDY_CONTENT } from './cellBioStudyContent';
import { PHYS1120_STUDY_CONTENT } from './physicsStudyContent';
import { BIOL4230_STUDY_CONTENT } from './evolutionStudyContent';

export interface StudyTermDisplay {
  term: string;
  category?: string;
}

export interface StudyContentForChapter {
  keyTerms: StudyTermDisplay[];
  keyConcepts: string[];
  keyEquationsOrExperiments: string[];
}

/**
 * Extract chapter number from a chapter name like "Ch 18: Electric Charge..."
 */
function extractChapterNum(chapterName: string): number | null {
  const m = chapterName.match(/Ch\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Get study content for a specific chapter in a specific course.
 * @param courseName - The course name (e.g. "26SP BIOL3020-001:Molecular Biology Of The Cell")
 * @param chapterName - The chapter topic name (e.g. "Ch 1: Introduction to Cells...")
 * @param chapterIndex - 0-based index fallback
 */
export function getStudyContent(
  courseName: string,
  chapterName: string,
  chapterIndex: number
): StudyContentForChapter | null {
  const id = courseName.toUpperCase();
  const chNum = extractChapterNum(chapterName);

  if (id.includes('BIOL') && id.includes('3020')) {
    // Cell Bio uses chapter9e numbering (1-19)
    const lookupNum = chNum ?? (chapterIndex + 1);
    const ch = BIOL3020_STUDY_CONTENT.find(c => c.chapter9e === lookupNum);
    if (!ch) return null;
    return {
      keyTerms: ch.keyTerms || [],
      keyConcepts: ch.keyConcepts || [],
      keyEquationsOrExperiments: ch.keyExperiments || [],
    };
  }

  if (id.includes('PHYS') && id.includes('1120')) {
    // Physics uses chapter numbering (18-31)
    const lookupNum = chNum ?? (chapterIndex + 18);
    const ch = PHYS1120_STUDY_CONTENT.find(c => c.chapter === lookupNum);
    if (!ch) return null;
    return {
      keyTerms: ch.keyTerms || [],
      keyConcepts: ch.keyConcepts || [],
      keyEquationsOrExperiments: (ch as any).keyEquations || [],
    };
  }

  if (id.includes('BIOL') && id.includes('4230')) {
    // Evolution uses chapter numbering (1-18)
    const lookupNum = chNum ?? (chapterIndex + 1);
    const ch = BIOL4230_STUDY_CONTENT.find((c: any) => c.chapter === lookupNum);
    if (!ch) return null;
    return {
      keyTerms: ch.keyTerms || [],
      keyConcepts: ch.keyConcepts || [],
      keyEquationsOrExperiments: ch.keyExperiments || [],
    };
  }

  return null;
}

/** Check if any study content is available for a course */
export function hasStudyContent(courseName: string): boolean {
  const id = courseName.toUpperCase();
  return (
    (id.includes('BIOL') && id.includes('3020')) ||
    (id.includes('PHYS') && id.includes('1120')) ||
    (id.includes('BIOL') && id.includes('4230'))
  );
}
