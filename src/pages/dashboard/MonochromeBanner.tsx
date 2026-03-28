import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store'

export default function MonochromeBanner() {
  const { courses, events, data } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef({ x: -999, y: -999, active: false });
  const ripplesRef = useRef<{ x: number; y: number; r: number; maxR: number; alpha: number }[]>([]);
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  // 'random' rotates each visit, or user picks a specific course id
  const [courseMode, setCourseMode] = useState<'random' | string>('random');

  // Resolve which course to show
  const activeCourse = useMemo(() => {
    if (courses.length === 0) return null;
    let course: typeof courses[number];
    if (courseMode === 'random') {
      course = courses[Math.floor(Math.random() * courses.length)];
    } else {
      course = courses.find(c => c.id === courseMode) || courses[0];
    }
    // Check if this course has an upcoming exam
    const now = Date.now();
    const schedules = (data?.pluginData?.studySchedules || []) as { courseName: string; examDate: string }[];
    const assignments = (data?.pluginData?.assignments || []) as { courseId: string; dueDate: string; completed?: boolean }[];
    let nearestMs = Infinity;
    for (const s of schedules) {
      if (s.courseName === course.name || s.courseName === course.shortName) {
        const ms = new Date(s.examDate).getTime() - now;
        if (ms > 0 && ms < nearestMs) nearestMs = ms;
      }
    }
    for (const a of assignments) {
      if (a.courseId === course.id && !a.completed) {
        const ms = new Date(a.dueDate).getTime() - now;
        if (ms > 0 && ms < nearestMs) nearestMs = ms;
      }
    }
    for (const ev of events) {
      const title = ev.title.toLowerCase();
      if ((title.includes('exam') || title.includes('test') || title.includes('midterm') || title.includes('final'))
        && (title.includes(course.shortName.toLowerCase()) || title.includes(course.name.toLowerCase()))) {
        const ms = new Date(ev.start).getTime() - now;
        if (ms > 0 && ms < nearestMs) nearestMs = ms;
      }
    }
    const daysUntilExam = nearestMs < Infinity ? Math.ceil(nearestMs / 86400000) : null;
    return { course, daysUntilExam };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, events, data, courseMode]);

  type MindNode = {
    x: number; y: number; vx: number; vy: number; r: number;
    label: string; desc: string; group: number; brightness: number;
    anchorX: number; anchorY: number;
    parentIdx: number; // correct parent node index (-1 for root)
    connectReason: string; // why this node connects to its parent
  };
  type Particle = {
    x: number; y: number; vx: number; vy: number; r: number;
    brightness: number; life: number; maxLife: number;
  };
  type Link = { a: number; b: number; strength: number; targetStrength: number; broken: boolean };

  const nodesRef = useRef<MindNode[]>([]);
  const linksRef = useRef<Link[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const selectedRef = useRef(-1); // index of currently "grabbed" node
  const [flickerMsg, setFlickerMsg] = useState<{ text: string; type: 'break' | 'fail' | 'success' } | null>(null);
  const flickerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showFlicker = useCallback((text: string, type: 'break' | 'fail' | 'success') => {
    if (flickerTimer.current) clearTimeout(flickerTimer.current);
    setFlickerMsg({ text, type });
    flickerTimer.current = setTimeout(() => setFlickerMsg(null), type === 'success' ? 3000 : 2200);
  }, []);

  const init = useCallback((w: number, h: number) => {
    const nodes: MindNode[] = [];
    const links: Link[] = [];

    if (!activeCourse) {
      nodes.push({
        x: w / 2, y: h / 2, vx: 0, vy: 0, r: 7,
        label: 'No courses', desc: 'Add a course to get started',
        group: 0, brightness: 0.7, anchorX: w / 2, anchorY: h / 2,
        parentIdx: -1, connectReason: '',
      });
    } else {
      const c = activeCourse.course;
      const daysLeft = activeCourse.daysUntilExam;
      const examUrgency = daysLeft !== null ? Math.max(0.3, 1 - daysLeft / 30) : 0.4;

      // Build all content nodes spread across the banner
      type ItemDef = { label: string; desc: string; group: number; size: number; parentGroup: number; reason: string };
      const items: ItemDef[] = [];

      // Course center node (group 0)
      const examInfo = daysLeft !== null ? ` — Exam in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : '';
      const topics = c.topics || [];
      const flashcards = c.flashcards || [];
      items.push({
        label: c.shortName,
        desc: `${c.name}${examInfo} · ${topics.length} topics, ${flashcards.length} cards`,
        group: 0, size: 7, parentGroup: -1, reason: '',
      });

      // Topic nodes (group 1) — random subset each load for variety
      const shuffledTopics = [...topics].sort(() => Math.random() - 0.5);
      const pickedTopics = shuffledTopics.slice(0, Math.min(5, shuffledTopics.length));
      for (const t of pickedTopics) {
        const subs = t.subtopics?.slice(0, 4).map(s => s.name) || [];
        const cleanName = t.name.replace(/^\/\/\s*/, '');
        const tLabel = cleanName.length > 14 ? cleanName.slice(0, 12) + '..' : cleanName;
        // Condensed description: subtopics as key points
        const keyPoints = subs.length > 0
          ? subs.join(' · ')
          : `Core topic in ${c.shortName}`;
        items.push({
          label: tLabel, desc: keyPoints, group: 1, size: 4.5,
          parentGroup: 0,
          reason: `${tLabel} is a core topic in ${c.shortName}`,
        });
      }

      // Flashcard key terms (group 2) — extract actual subject terms, not question stubs
      const extractTerm = (front: string): string => {
        // Strip common question prefixes to get the actual term
        let t = front
          .replace(/^(what|who|where|when|why|how|which|describe|define|explain|list|name|state|identify|compare|contrast)\s+(is|are|does|do|was|were|the|a|an)\s+/i, '')
          .replace(/^(what|who|where|when|why|how|which|describe|define|explain|list|name|state|identify)\s+/i, '')
          .replace(/[?.!]+$/, '')
          .trim();
        // If still starts with "the/a/an", strip it
        t = t.replace(/^(the|a|an)\s+/i, '').trim();
        // Take meaningful portion (up to ~20 chars, break at word boundary)
        if (t.length > 20) {
          const cut = t.lastIndexOf(' ', 18);
          t = t.slice(0, cut > 8 ? cut : 18) + '..';
        }
        // Capitalize first letter
        return t.charAt(0).toUpperCase() + t.slice(1);
      };

      const cards = [...flashcards].sort(() => Math.random() - 0.5).slice(0, Math.min(6, flashcards.length));
      for (const card of cards) {
        const term = extractTerm(card.front);
        if (term.length < 2) continue;
        const desc = card.back;
        items.push({
          label: term, desc, group: 2, size: 3.5,
          parentGroup: 1,
          reason: `Key concept: ${term}`,
        });
      }

      // Subtopic terms as leaf nodes (group 3) — from the selected topics only
      const allSubs: { name: string; parent: string }[] = [];
      for (const t of pickedTopics) {
        for (const s of (t.subtopics || [])) {
          allSubs.push({ name: s.name, parent: t.name });
        }
      }
      const pickedSubs = allSubs.sort(() => Math.random() - 0.5).slice(0, Math.min(3, allSubs.length));
      for (const s of pickedSubs) {
        const label = s.name.length > 18 ? s.name.slice(0, 16) + '..' : s.name;
        items.push({
          label, desc: `Part of ${s.parent}`, group: 3, size: 3,
          parentGroup: 1,
          reason: `Subtopic under ${s.parent}`,
        });
      }

      // Place nodes spread across the FULL banner using force-relaxed positions
      const totalNodes = items.length;
      const padX = 35, padY = 18;
      // Generate well-distributed anchor positions using Halton-like sequence
      const anchors: { x: number; y: number }[] = [];
      // Center node goes to true center
      anchors.push({ x: w * 0.5, y: h * 0.5 });
      // Spread remaining nodes using golden-angle distribution across full area
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      for (let i = 1; i < totalNodes; i++) {
        const t = i / totalNodes;
        const angle = i * goldenAngle;
        const radius = Math.sqrt(t) * Math.min(w * 0.45, h * 0.42);
        let ax = w * 0.5 + Math.cos(angle) * radius * (w / h) * 0.7;
        let ay = h * 0.5 + Math.sin(angle) * radius;
        ax = Math.max(padX, Math.min(w - padX, ax));
        ay = Math.max(padY, Math.min(h - padY, ay));
        anchors.push({ x: ax, y: ay });
      }
      // Relax positions: push overlapping nodes apart
      for (let pass = 0; pass < 8; pass++) {
        for (let i = 0; i < anchors.length; i++) {
          for (let j = i + 1; j < anchors.length; j++) {
            const dx = anchors[j].x - anchors[i].x;
            const dy = anchors[j].y - anchors[i].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const minDist = 55;
            if (d < minDist && d > 0) {
              const push = (minDist - d) / 2;
              anchors[i].x -= (dx / d) * push;
              anchors[i].y -= (dy / d) * push;
              anchors[j].x += (dx / d) * push;
              anchors[j].y += (dy / d) * push;
            }
          }
          anchors[i].x = Math.max(padX, Math.min(w - padX, anchors[i].x));
          anchors[i].y = Math.max(padY, Math.min(h - padY, anchors[i].y));
        }
      }

      for (let i = 0; i < totalNodes; i++) {
        const item = items[i];
        const ax = anchors[i].x;
        const ay = anchors[i].y;

        nodes.push({
          x: ax + (Math.random() - 0.5) * 8,
          y: ay + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.12,
          r: item.size * (i === 0 ? 1 + examUrgency * 0.3 : 1),
          label: item.label, desc: item.desc,
          group: item.group,
          brightness: i === 0 ? 1 : (0.4 + Math.random() * 0.4),
          anchorX: ax, anchorY: ay,
          parentIdx: -1, // set below
          connectReason: item.reason,
        });
      }

      // Create links + assign parentIdx
      // Topics (group 1) -> center (0)
      for (let i = 1; i < nodes.length; i++) {
        if (nodes[i].group === 1) {
          nodes[i].parentIdx = 0;
          links.push({ a: 0, b: i, strength: 1, targetStrength: 1, broken: false });
        }
      }
      // Flashcards/notes/assignments (group 2+) -> nearest topic node
      for (let i = 1; i < nodes.length; i++) {
        if (nodes[i].group >= 2) {
          let nearestTopic = -1, nearestDist = Infinity;
          for (let j = 1; j < nodes.length; j++) {
            if (nodes[j].group !== 1) continue;
            const dx = nodes[i].anchorX - nodes[j].anchorX;
            const dy = nodes[i].anchorY - nodes[j].anchorY;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nearestDist) { nearestDist = d; nearestTopic = j; }
          }
          if (nearestTopic >= 0) {
            nodes[i].parentIdx = nearestTopic;
            links.push({ a: nearestTopic, b: i, strength: 0.8, targetStrength: 0.8, broken: false });
          }
        }
      }
    }

    nodesRef.current = nodes;
    linksRef.current = links;

    // Ambient particles
    const particles: Particle[] = [];
    const pCount = 20 + Math.floor(Math.random() * 10);
    for (let i = 0; i < pCount; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2,
        r: 1 + Math.random() * 1.2, brightness: 0.08 + Math.random() * 0.2,
        life: Math.random() * 200, maxLife: 250 + Math.random() * 300,
      });
    }
    particlesRef.current = particles;
  }, [activeCourse, data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    init(w, h);

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const cx = 'touches' in e ? e.touches[0]?.clientX ?? -999 : e.clientX;
      const cy = 'touches' in e ? e.touches[0]?.clientY ?? -999 : e.clientY;
      return { x: cx - r.left, y: cy - r.top };
    };

    let hoveredIdx = -1;

    // Helper: distance from point to quadratic bezier curve segment
    const distToLink = (px: number, py: number, link: Link) => {
      const na = nodesRef.current[link.a], nb = nodesRef.current[link.b];
      if (!na || !nb) return Infinity;
      const dx = nb.x - na.x, dy = nb.y - na.y;
      const midX = (na.x + nb.x) / 2 + dy * 0.12;
      const midY = (na.y + nb.y) / 2 - dx * 0.12;
      // Sample 6 points along the curve
      let minD = Infinity;
      for (let t = 0; t <= 1; t += 0.17) {
        const cx = (1 - t) * (1 - t) * na.x + 2 * (1 - t) * t * midX + t * t * nb.x;
        const cy = (1 - t) * (1 - t) * na.y + 2 * (1 - t) * t * midY + t * t * nb.y;
        const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (d < minD) minD = d;
      }
      return minD;
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      const pos = getPos(e);
      mouseRef.current = { ...pos, active: true };
      hoveredIdx = -1;
      for (let i = 0; i < nodesRef.current.length; i++) {
        const node = nodesRef.current[i];
        const dx = pos.x - node.x, dy = pos.y - node.y;
        if (Math.sqrt(dx * dx + dy * dy) < 24) {
          setHoveredDesc(node.desc);
          hoveredIdx = i;
          break;
        }
      }
      if (hoveredIdx < 0) setHoveredDesc(null);

      // Subtle link proximity effects (non-broken links only)
      for (const link of linksRef.current) {
        if (link.broken) continue;
        const na = nodesRef.current[link.a], nb = nodesRef.current[link.b];
        if (!na || !nb) continue;
        const dma = Math.sqrt((pos.x - na.x) ** 2 + (pos.y - na.y) ** 2);
        const dmb = Math.sqrt((pos.x - nb.x) ** 2 + (pos.y - nb.y) ** 2);
        link.targetStrength = (dma < 60 || dmb < 60) ? 1 : 0.6;
      }
    };
    const onLeave = () => {
      mouseRef.current.active = false;
      hoveredIdx = -1;
      setHoveredDesc(null);
      for (const link of linksRef.current) {
        if (!link.broken) link.targetStrength = 0.8;
      }
    };
    const onClick = (e: MouseEvent | TouchEvent) => {
      const pos = getPos(e);
      ripplesRef.current.push({ x: pos.x, y: pos.y, r: 0, maxR: 100, alpha: 0.4 });

      const nodes = nodesRef.current;
      const links = linksRef.current;

      // Determine which nodes are free
      const freeSet = new Set<number>();
      for (const link of links) { if (link.broken) freeSet.add(link.b); }

      // Find if clicking on a node
      let clickedNodeIdx = -1;
      for (let i = 0; i < nodes.length; i++) {
        const dx = pos.x - nodes[i].x, dy = pos.y - nodes[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < 22) { clickedNodeIdx = i; break; }
      }

      const held = selectedRef.current;

      // If we have a held free node and clicked a target node → try to connect
      if (held >= 0 && clickedNodeIdx >= 0 && clickedNodeIdx !== held) {
        const freeNode = nodes[held];
        const target = nodes[clickedNodeIdx];
        const link = links.find(l => l.broken && l.b === held);

        if (link && clickedNodeIdx === freeNode.parentIdx) {
          // CORRECT — reconnect!
          link.broken = false;
          link.targetStrength = 1;
          link.strength = 0.1;
          freeNode.vx *= 0.1;
          freeNode.vy *= 0.1;
          selectedRef.current = -1;
          showFlicker(`Connected! ${freeNode.connectReason}`, 'success');
        } else {
          // WRONG — reject with reason
          const groupNames: Record<number, string> = { 0: 'course', 1: 'topic', 2: 'term', 3: 'subtopic' };
          const fType = groupNames[freeNode.group] || 'item';
          if (freeNode.group === target.group) {
            showFlicker(`Can't connect: "${freeNode.label}" and "${target.label}" are both ${fType}s`, 'fail');
          } else if (target.group === 0 && freeNode.group > 1) {
            showFlicker(`Can't connect directly to ${target.label} — find the right topic`, 'fail');
          } else {
            showFlicker(`Can't connect: "${freeNode.label}" doesn't belong under "${target.label}"`, 'fail');
          }
          // Push away
          const dx = freeNode.x - target.x, dy = freeNode.y - target.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          freeNode.vx += (dx / d) * 1.2;
          freeNode.vy += (dy / d) * 0.8;
        }
        return;
      }

      // If clicking on a free node → pick it up (select it)
      if (clickedNodeIdx >= 0 && freeSet.has(clickedNodeIdx)) {
        selectedRef.current = clickedNodeIdx;
        showFlicker(`Holding "${nodes[clickedNodeIdx].label}" — click a node to connect`, 'break');
        return;
      }

      // If holding and clicked empty space → drop / deselect
      if (held >= 0) {
        selectedRef.current = -1;
        showFlicker(`Dropped "${nodes[held].label}"`, 'break');
        return;
      }

      // Check if clicking on a link line → break it
      for (const link of links) {
        if (link.broken) continue;
        const d = distToLink(pos.x, pos.y, link);
        if (d < 12) {
          link.broken = true;
          link.targetStrength = 0;
          const freeNode = nodes[link.b];
          if (freeNode) {
            freeNode.vx = (Math.random() - 0.5) * 1.5;
            freeNode.vy = (Math.random() - 0.5) * 1;
            showFlicker(`Disconnected: "${freeNode.label}" — click it to pick up`, 'break');
          }
          return;
        }
      }

      // Otherwise, ripple burst
      for (const n of nodes) {
        const dx = n.x - pos.x, dy = n.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80 && dist > 0) {
          n.vx += (dx / dist) * (1 - dist / 80) * 1.2;
          n.vy += (dy / dist) * (1 - dist / 80) * 1.2;
        }
      }
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onMove, { passive: true });
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchend', onLeave);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onClick, { passive: true });

    // Auto-disconnect: after 2s, randomly break links one by one so user must reconnect
    const breakTimers: ReturnType<typeof setTimeout>[] = [];
    const allLinks = linksRef.current;
    if (allLinks.length > 0) {
      // Shuffle link indices for random break order
      const indices = allLinks.map((_, i) => i).sort(() => Math.random() - 0.5);
      indices.forEach((li, order) => {
        const delay = 2000 + order * 800; // start at 2s, stagger 0.8s apart
        breakTimers.push(setTimeout(() => {
          const link = allLinks[li];
          if (!link || link.broken) return;
          link.broken = true;
          link.targetStrength = 0;
          const freeNode = nodesRef.current[link.b];
          if (freeNode) {
            freeNode.vx = (Math.random() - 0.5) * 1.2;
            freeNode.vy = (Math.random() - 0.5) * 0.8;
          }
          showFlicker(`"${freeNode?.label || '?'}" disconnected — reconnect it!`, 'break');
        }, delay));
      });
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(10, 10, 14, 0.2)';
      ctx.fillRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const pts = particlesRef.current;
      const mouse = mouseRef.current;

      // Ripples
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const rip = ripplesRef.current[i];
        rip.r += 2;
        rip.alpha *= 0.95;
        if (rip.alpha < 0.01 || rip.r > rip.maxR) { ripplesRef.current.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${rip.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Animate link strengths (smooth breaking/forming)
      for (const link of links) {
        link.strength += (link.targetStrength - link.strength) * 0.04;
      }

      // Draw links as curved branches
      for (let li = 0; li < links.length; li++) {
        const link = links[li];
        const na = nodes[link.a], nb = nodes[link.b];
        if (!na || !nb || link.strength < 0.02) continue;

        const dx = nb.x - na.x, dy = nb.y - na.y;
        const midX = (na.x + nb.x) / 2 + dy * 0.12;
        const midY = (na.y + nb.y) / 2 - dx * 0.12;

        const isHovered = hoveredIdx === link.a || hoveredIdx === link.b;
        const alpha = link.strength * (isHovered ? 0.55 : 0.18);

        // Branch line
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.quadraticCurveTo(midX, midY, nb.x, nb.y);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = isHovered ? 1.6 : (link.strength > 0.5 ? 0.9 : 0.4);

        // Breaking effect: dashed when weak
        if (link.strength < 0.4) {
          const gap = Math.round((1 - link.strength / 0.4) * 6) + 2;
          ctx.setLineDash([3, gap]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Traveling dot (only on strong links)
        if (link.strength > 0.3) {
          const t = ((Date.now() / 3000 + li * 0.5) % 1);
          const dotX = (1 - t) * (1 - t) * na.x + 2 * (1 - t) * t * midX + t * t * nb.x;
          const dotY = (1 - t) * (1 - t) * na.y + 2 * (1 - t) * t * midY + t * t * nb.y;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${link.strength * (isHovered ? 0.5 : 0.12)})`;
          ctx.fill();
        }
      }

      // Mouse glow + lines to nearby particles
      if (mouse.active) {
        for (const p of pts) {
          const d = Math.sqrt((p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2);
          if (d < 70) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / 70) * 0.1})`;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 45);
        grad.addColorStop(0, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 45, 0, Math.PI * 2);
        ctx.fill();
      }

      // Particle-to-particle faint connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.sqrt((pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2);
          if (d < 60) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / 60) * 0.06})`;
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      // Determine which nodes are free (their link is broken)
      const freeSet = new Set<number>();
      for (const link of links) {
        if (link.broken) freeSet.add(link.b);
      }

      // Draw & update nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isFree = freeSet.has(i);
        const isHeld = selectedRef.current === i;

        if (isHeld && mouse.active) {
          // Held node follows cursor smoothly
          node.vx += (mouse.x - node.x) * 0.08;
          node.vy += (mouse.y - node.y) * 0.08;
          node.vx *= 0.7;
          node.vy *= 0.7;
        } else if (isFree) {
          // Free nodes drift randomly, bounce off walls
          node.vx += (Math.random() - 0.5) * 0.04;
          node.vy += (Math.random() - 0.5) * 0.03;
          if (node.x < 20 || node.x > w - 20) node.vx *= -0.8;
          if (node.y < 12 || node.y > h - 12) node.vy *= -0.8;
          node.vx *= 0.99;
          node.vy *= 0.99;
        } else {
          // Connected nodes spring toward anchor
          node.vx += (node.anchorX - node.x) * 0.003;
          node.vy += (node.anchorY - node.y) * 0.003;
          node.vx *= 0.96;
          node.vy *= 0.96;
        }
        // Mouse interaction
        if (mouse.active) {
          const dmx = mouse.x - node.x, dmy = mouse.y - node.y;
          const mDist = Math.sqrt(dmx * dmx + dmy * dmy);
          if (mDist < 70 && mDist > 5) {
            node.vx += (dmx / mDist) * 0.015;
            node.vy += (dmy / mDist) * 0.015;
          }
        }
        if (i === 0) {
          node.anchorX += Math.sin(Date.now() / 5000) * 0.02;
          node.anchorY += Math.cos(Date.now() / 4500) * 0.015;
        }
        node.x += node.vx;
        node.y += node.vy;
        // Keep in bounds
        node.x = Math.max(10, Math.min(w - 10, node.x));
        node.y = Math.max(10, Math.min(h - 10, node.y));

        const hovered = i === hoveredIdx;
        const nodeR = hovered ? node.r * 1.4 : node.r;
        const pulseR = i === 0 ? nodeR + Math.sin(Date.now() / 900) * 1.2 : nodeR;

        // Held node: bright outline following cursor
        if (isHeld) {
          const heldAlpha = 0.4 + Math.sin(Date.now() / 200) * 0.2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeR + 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100,200,255,${heldAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Free node: pulsing outline to indicate it's disconnected
        if (isFree && !isHeld) {
          const pulseAlpha = 0.15 + Math.sin(Date.now() / 300) * 0.12;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeR + 6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,100,100,${pulseAlpha})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Glow
        const glowR = hovered ? 28 : (i === 0 ? 20 : (isFree ? 16 : 12));
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        const glowBase = isFree ? 'rgba(255,120,120,' : 'rgba(255,255,255,';
        glow.addColorStop(0, `${glowBase}${hovered ? 0.16 : (i === 0 ? 0.08 : 0.04)})`);
        glow.addColorStop(1, `${glowBase}0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Node dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
        const nb = Math.round(255 * node.brightness);
        ctx.fillStyle = isHeld
          ? `rgba(${Math.round(nb * 0.5)},${Math.round(nb * 0.8)},${nb},1)`
          : isFree
            ? `rgba(${nb},${Math.round(nb * 0.5)},${Math.round(nb * 0.5)},${hovered ? 1 : 0.85})`
            : `rgba(${nb},${nb},${nb},${hovered ? 1 : 0.8})`;
        ctx.fill();
        if (hovered || i === 0 || isFree) {
          ctx.strokeStyle = isFree
            ? `rgba(255,100,100,${hovered ? 0.7 : 0.35})`
            : `rgba(255,255,255,${hovered ? 0.6 : 0.15})`;
          ctx.lineWidth = hovered ? 1.5 : 0.7;
          ctx.stroke();
        }

        // Label
        const fontSize = i === 0 ? 11 : (hovered ? 10 : 8);
        ctx.font = `${hovered || isFree ? 600 : 400} ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isFree
          ? `rgba(255,150,150,${hovered ? 0.9 : 0.5})`
          : `rgba(255,255,255,${i === 0 ? 0.8 : (hovered ? 0.85 : 0.28)})`;
        ctx.fillText(node.label, node.x, node.y + pulseR + 11);
        ctx.textAlign = 'start';
      }

      // Draw ambient particles
      for (const p of pts) {
        if (mouse.active) {
          const dmx = mouse.x - p.x, dmy = mouse.y - p.y;
          const mDist = Math.sqrt(dmx * dmx + dmy * dmy);
          if (mDist < 90 && mDist > 5) {
            p.vx += (dmx / mDist) * 0.006;
            p.vy += (dmy / mDist) * 0.006;
          }
        }
        p.vx *= 0.997;
        p.vy *= 0.997;
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;

        const lr = p.life / p.maxLife;
        const fade = lr < 0.1 ? lr / 0.1 : lr > 0.9 ? (1 - lr) / 0.1 : 1;
        if (p.life >= p.maxLife) {
          p.life = 0; p.maxLife = 250 + Math.random() * 300;
          p.x = Math.random() * w; p.y = Math.random() * h;
          p.brightness = 0.08 + Math.random() * 0.2;
          p.vx = (Math.random() - 0.5) * 0.3; p.vy = (Math.random() - 0.5) * 0.2;
        }
        const b = Math.round(255 * p.brightness);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${b},${b},${b},${fade * 0.5})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(0, 0, w, h);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      breakTimers.forEach(t => clearTimeout(t));
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('touchend', onLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onClick);
    };
  }, [init]);

  const defaultText = activeCourse
    ? (activeCourse.daysUntilExam !== null
        ? `${activeCourse.course.shortName} — Exam in ${activeCourse.daysUntilExam} day${activeCourse.daysUntilExam !== 1 ? 's' : ''}`
        : `Exploring: ${activeCourse.course.shortName}`)
    : 'Add courses to see your mind map';

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Course selector chips */}
      {courses.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setCourseMode('random')}
            style={{
              padding: '3px 10px', fontSize: 10, fontWeight: courseMode === 'random' ? 700 : 500,
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
              background: courseMode === 'random' ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: courseMode === 'random' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', letterSpacing: 0.3,
            }}
          >Random</button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setCourseMode(c.id)}
              style={{
                padding: '3px 10px', fontSize: 10, fontWeight: courseMode === c.id ? 700 : 500,
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
                background: courseMode === c.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: courseMode === c.id ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', letterSpacing: 0.3,
              }}
            >{c.shortName}</button>
          ))}
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 150,
          borderRadius: 'var(--radius)',
          display: 'block',
          cursor: 'crosshair',
        }}
      />
      {/* Flicker notification for break/connect events */}
      {flickerMsg && (
        <div
          key={flickerMsg.text}
          style={{
            padding: '5px 14px',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'center',
            letterSpacing: 0.5,
            fontFamily: 'monospace',
            color: flickerMsg.type === 'success' ? '#6f6' : flickerMsg.type === 'fail' ? '#f88' : '#fa0',
            animation: 'flicker 0.15s ease-in-out 3',
          }}
        >
          {flickerMsg.type === 'break' ? '! ' : flickerMsg.type === 'fail' ? 'x ' : '+ '}
          {flickerMsg.text}
        </div>
      )}
      {/* Description bar */}
      <div style={{
        minHeight: 20,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 500,
        color: hoveredDesc ? 'var(--text-primary)' : 'var(--text-muted)',
        opacity: hoveredDesc ? 1 : (flickerMsg ? 0.3 : 0.5),
        transition: 'opacity 0.25s, color 0.25s',
        textAlign: 'center',
        letterSpacing: 0.3,
      }}>
        {hoveredDesc || defaultText}
      </div>
    </div>
  );
}
