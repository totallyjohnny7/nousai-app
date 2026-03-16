/**
 * Canvas LMS Sync — client-side functions that call /api/canvas-proxy
 */

import type {
  CanvasLiveCourse,
  CanvasLiveAssignment,
  CanvasAnnouncement,
} from '../types';

interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  submission_types: string[];
  has_submitted_submissions: boolean;
  grading_type: string;
  assignment_group_id: number;
  submission?: {
    score: number | null;
    grade: string | null;
    workflow_state: string;
  };
}

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
}

interface CanvasAssignmentGroup {
  id: number;
  name: string;
  group_weight: number;
  assignments?: CanvasAssignment[];
}

export interface SyncedAssignment {
  id: string;
  name: string;
  dueDate: string;
  weight: number;
  completed: boolean;
  canvasId: number;
}

export interface SyncedGrade {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  category: string;
  canvasId: number;
}

async function canvasProxyFetch(canvasUrl: string, canvasToken: string, endpoint: string): Promise<unknown> {
  const res = await fetch('/api/canvas-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canvasUrl, canvasToken, endpoint }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || err.details || `Canvas API error: ${res.status}`);
  }
  return res.json();
}

export async function testCanvasConnection(canvasUrl: string, canvasToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await canvasProxyFetch(canvasUrl, canvasToken, 'users/self');
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

export async function syncCanvasCourses(canvasUrl: string, canvasToken: string): Promise<CanvasCourse[]> {
  const data = await canvasProxyFetch(canvasUrl, canvasToken, 'courses?enrollment_state=active&per_page=50');
  return data as CanvasCourse[];
}

export async function syncCanvasAssignments(
  canvasUrl: string, canvasToken: string, canvasCourseId: number
): Promise<SyncedAssignment[]> {
  const data = await canvasProxyFetch(
    canvasUrl, canvasToken,
    `courses/${canvasCourseId}/assignments?per_page=100&order_by=due_at&include[]=submission`
  ) as CanvasAssignment[];

  return data.map(a => ({
    id: `canvas-${a.id}`,
    name: a.name,
    dueDate: a.due_at ? a.due_at.split('T')[0] : new Date().toISOString().split('T')[0],
    weight: a.points_possible || 0,
    completed: a.submission?.workflow_state === 'graded' || a.has_submitted_submissions,
    canvasId: a.id,
  }));
}

export async function syncCanvasGrades(
  canvasUrl: string, canvasToken: string, canvasCourseId: number
): Promise<SyncedGrade[]> {
  const groups = await canvasProxyFetch(
    canvasUrl, canvasToken,
    `courses/${canvasCourseId}/assignment_groups?per_page=50&include[]=assignments&include[]=submission`
  ) as CanvasAssignmentGroup[];

  const grades: SyncedGrade[] = [];
  for (const group of groups) {
    for (const a of (group.assignments || [])) {
      if (a.submission?.score != null && a.points_possible > 0) {
        grades.push({
          id: `canvas-grade-${a.id}`,
          name: a.name,
          score: a.submission.score,
          maxScore: a.points_possible,
          weight: group.group_weight || 0,
          category: group.name,
          canvasId: a.id,
        });
      }
    }
  }
  return grades;
}

export function matchCanvasCourse(
  canvasCourses: CanvasCourse[],
  localCourseName: string
): CanvasCourse | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const localNorm = norm(localCourseName);

  // Try exact-ish match first
  let match = canvasCourses.find(c =>
    norm(c.name).includes(localNorm) || localNorm.includes(norm(c.course_code))
  );
  if (match) return match;

  // Try course code match
  match = canvasCourses.find(c => {
    const code = norm(c.course_code);
    return localNorm.includes(code) || code.includes(localNorm);
  });
  return match || null;
}

export async function syncCanvasLiveCourses(
  canvasUrl: string,
  canvasToken: string
): Promise<CanvasLiveCourse[]> {
  const data = await canvasProxyFetch(
    canvasUrl, canvasToken,
    'courses?enrollment_state=active&per_page=50&include[]=total_scores&include[]=current_grading_period_scores'
  ) as Array<{
    id: number;
    name: string;
    course_code: string;
    enrollments?: Array<{
      computed_current_score: number | null;
      computed_final_score: number | null;
      computed_current_grade: string | null;
    }>;
  }>;

  return data.map(c => {
    const enrollment = c.enrollments?.[0];
    return {
      canvasId: c.id,
      name: c.name,
      courseCode: c.course_code,
      currentScore: enrollment?.computed_current_score ?? null,
      finalScore: enrollment?.computed_final_score ?? null,
      currentGrade: enrollment?.computed_current_grade ?? null,
      lastSynced: new Date().toISOString(),
    };
  });
}

export async function syncCanvasLiveAssignments(
  canvasUrl: string,
  canvasToken: string,
  canvasCourseId: number
): Promise<CanvasLiveAssignment[]> {
  const data = await canvasProxyFetch(
    canvasUrl, canvasToken,
    `courses/${canvasCourseId}/assignments?per_page=50&order_by=due_at&include[]=submission`
    // No bucket=future — we want overdue assignments too (shown in red)
  ) as Array<{
    id: number;
    name: string;
    due_at: string | null;
    points_possible: number;
    html_url: string;
    submission?: {
      workflow_state: string;
      score: number | null;
      grade: string | null;
    };
  }>;

  return data.map(a => ({
    id: a.id,
    courseId: canvasCourseId,
    name: a.name,
    dueAt: a.due_at,
    pointsPossible: a.points_possible,
    submissionState: (a.submission?.workflow_state as CanvasLiveAssignment['submissionState']) ?? null,
    score: a.submission?.score ?? null,
    grade: a.submission?.grade ?? null,
    htmlUrl: a.html_url,
  }));
}

export async function syncCanvasAnnouncements(
  canvasUrl: string,
  canvasToken: string,
  canvasCourseId: number
): Promise<CanvasAnnouncement[]> {
  const data = await canvasProxyFetch(
    canvasUrl, canvasToken,
    `courses/${canvasCourseId}/discussion_topics?only_announcements=true&per_page=5&order_by=recent_activity`
  ) as Array<{
    id: number;
    title: string;
    message: string;
    posted_at: string;
    html_url: string;
  }>;

  return data.map(a => ({
    id: a.id,
    courseId: canvasCourseId,
    title: a.title,
    message: a.message?.replace(/<[^>]*>/g, '').trim().slice(0, 300) ?? '',
    postedAt: a.posted_at,
    htmlUrl: a.html_url,
  }));
}

export async function runFullCanvasSync(
  canvasUrl: string,
  canvasToken: string
): Promise<{
  courses: CanvasLiveCourse[];
  assignments: CanvasLiveAssignment[];
  announcements: CanvasAnnouncement[];
  errors: string[];
}> {
  const errors: string[] = [];

  let courses: CanvasLiveCourse[] = [];
  try {
    courses = await syncCanvasLiveCourses(canvasUrl, canvasToken);
  } catch (e) {
    errors.push(`Courses: ${e instanceof Error ? e.message : 'failed'}`);
    return { courses: [], assignments: [], announcements: [], errors };
  }

  const allAssignments: CanvasLiveAssignment[] = [];
  const allAnnouncements: CanvasAnnouncement[] = [];

  const CONCURRENCY = 5;
  for (let i = 0; i < courses.length; i += CONCURRENCY) {
    const batch = courses.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.flatMap(c => [
        syncCanvasLiveAssignments(canvasUrl, canvasToken, c.canvasId),
        syncCanvasAnnouncements(canvasUrl, canvasToken, c.canvasId),
      ])
    );
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        if (idx % 2 === 0) allAssignments.push(...(r.value as CanvasLiveAssignment[]));
        else allAnnouncements.push(...(r.value as CanvasAnnouncement[]));
      } else {
        errors.push(`Course ${batch[Math.floor(idx / 2)].courseCode}: ${r.reason}`);
      }
    });
  }

  return { courses, assignments: allAssignments, announcements: allAnnouncements, errors };
}
