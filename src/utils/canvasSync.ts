/**
 * Canvas LMS Sync — client-side functions that call /api/canvas-proxy
 */

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
