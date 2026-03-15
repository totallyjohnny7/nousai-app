import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, CheckCircle, Circle, Filter,
  Plus, Trash2, Clock, BookOpen, Target, Zap, GraduationCap, X, Upload,
  Link, RefreshCw, LogIn, LogOut, Cloud, CloudOff,
} from 'lucide-react'
import { useStore } from '../store'
import { callAI, isAIConfigured } from '../utils/ai'
import {
  connectGoogleCalendar, disconnectGoogle, isGoogleConnected,
  getCalendarEvents, pushStudyBlockToCalendar, getGoogleClientId, setGoogleClientId,
} from '../utils/googleCalendar'
import type { CanvasEvent, StudySchedule, StudyBlock, NousAIData, GoogleCalendarEvent } from '../types'

type Tab = 'events' | 'scheduler' | 'gcal'

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

export default function CalendarPage() {
  const { loaded, data, setData, updatePluginData, events } = useStore()
  const [tab, setTab] = useState<Tab>('events')

  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading calendar...</div>
      </div>
    )
  }

  return (
    <div className="animate-in">
      <h1 className="page-title">Calendar</h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${tab === 'events' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('events')}>
          <Calendar size={13} /> Events
        </button>
        <button className={`btn btn-sm ${tab === 'scheduler' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('scheduler')}>
          <Clock size={13} /> Study Scheduler
        </button>
        <button className={`btn btn-sm ${tab === 'gcal' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('gcal')}>
          <Link size={13} /> Google Calendar
        </button>
      </div>

      {tab === 'events' && <EventsTab events={events} data={data!} setData={setData} />}
      {tab === 'scheduler' && data && <SchedulerTab data={data} updatePluginData={updatePluginData} />}
      {tab === 'gcal' && <GoogleCalendarTab />}
    </div>
  )
}

/* ================================================================
   EVENTS TAB (original calendar)
   ================================================================ */
function parseICS(text: string): CanvasEvent[] {
  const events: CanvasEvent[] = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const get = (key: string): string => {
      const match = block.match(new RegExp(`^${key}[;:](.*)$`, 'm'));
      return match ? match[1].replace(/^.*:/, (m) => m.includes(':') ? m.split(':').pop() || '' : m).trim() : '';
    };
    const getRaw = (key: string): string => {
      const match = block.match(new RegExp(`^${key}[;:](.*)$`, 'm'));
      return match ? match[1].trim() : '';
    };

    const summary = (getRaw('SUMMARY') || 'Untitled Event').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const description = (getRaw('DESCRIPTION') || '').replace(/\\,/g, ',').replace(/\\n/g, '\n');
    const location = (getRaw('LOCATION') || '').replace(/\\,/g, ',');
    const uidVal = get('UID') || `ics-${Date.now()}-${i}`;

    // Parse dates (handle both VALUE=DATE and datetime)
    let dtstart = getRaw('DTSTART');
    let dtend = getRaw('DTEND');
    let allDay = false;

    if (dtstart.includes('VALUE=DATE:')) {
      dtstart = dtstart.split('VALUE=DATE:')[1] || dtstart;
      allDay = true;
    }
    if (dtend.includes('VALUE=DATE:')) {
      dtend = dtend.split('VALUE=DATE:')[1] || dtend;
    }

    // Strip timezone prefix if present (e.g., TZID=America/Chicago:20240101T090000)
    if (dtstart.includes(':')) dtstart = dtstart.split(':').pop() || dtstart;
    if (dtend.includes(':')) dtend = dtend.split(':').pop() || dtend;

    function parseICSDate(s: string): string {
      if (!s) return new Date().toISOString();
      // Format: YYYYMMDD or YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
      const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
      if (s.length === 8) return `${y}-${m}-${d}T00:00:00`;
      const h = s.slice(9, 11), mi = s.slice(11, 13), se = s.slice(13, 15);
      return `${y}-${m}-${d}T${h}:${mi}:${se}`;
    }

    events.push({
      title: summary,
      start: parseICSDate(dtstart),
      end: parseICSDate(dtend || dtstart),
      description,
      uid: uidVal,
      location,
      allDay,
      completed: false,
    });
  }
  return events;
}

function EventsTab({ events, data, setData }: {
  events: CanvasEvent[];
  data: NousAIData;
  setData: (d: NousAIData | ((prev: NousAIData) => NousAIData)) => void;
}) {
  const [selectedCourse, setSelectedCourse] = useState<string>('all')
  const [showPast, setShowPast] = useState(false)
  const [viewWeekOffset, setViewWeekOffset] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importCount, setImportCount] = useState(0)

  const handleICSImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const parsed = parseICS(text)
      if (parsed.length === 0) return
      // Merge: skip duplicates by uid
      const existing = data.settings?.canvasEvents || []
      const existingUids = new Set(existing.map(ev => ev.uid))
      const newEvents = parsed.filter(ev => !existingUids.has(ev.uid))
      if (newEvents.length === 0) { setImportCount(-1); return }
      setData((prev: NousAIData) => ({
        ...prev,
        settings: { ...prev.settings, canvasEvents: [...(prev.settings?.canvasEvents || []).filter((ev: CanvasEvent) => !newEvents.some(ne => ne.uid === ev.uid)), ...newEvents] },
      }))
      setImportCount(newEvents.length)
    }
    reader.readAsText(file)
    // Reset input so same file can be re-imported
    e.target.value = ''
  }, [setData])

  const courseCodes = useMemo(() => {
    const codes = new Set<string>()
    events.forEach(e => {
      const match = e.title.match(/\[([^\]]+)\]/)
      if (match) codes.add(match[1])
    })
    return Array.from(codes).sort()
  }, [events])

  const groupedEvents = useMemo(() => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() + viewWeekOffset * 7 - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    let filtered = events.filter(e => {
      const d = new Date(e.start)
      if (!showPast && d < now) return false
      if (viewWeekOffset !== 0) return d >= weekStart && d < weekEnd
      return true
    })

    if (selectedCourse !== 'all') {
      filtered = filtered.filter(e => e.title.includes(`[${selectedCourse}]`))
    }

    const groups: Record<string, CanvasEvent[]> = {}
    filtered.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).forEach(e => {
      const day = new Date(e.start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      if (!groups[day]) groups[day] = []
      groups[day].push(e)
    })
    return groups
  }, [events, selectedCourse, showPast, viewWeekOffset])

  const days = Object.keys(groupedEvents)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p className="page-subtitle" style={{ margin: 0 }}>{events.length} events</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {importCount > 0 && <span style={{ fontSize: 11, color: 'var(--green)' }}>+{importCount} imported</span>}
          {importCount === -1 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No new events</span>}
          <input ref={fileInputRef} type="file" accept=".ics,.ical" onChange={handleICSImport} style={{ display: 'none' }} />
          <button className="btn btn-sm btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} /> Import .ics
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button className="btn-icon" onClick={() => setViewWeekOffset(w => w - 1)}><ChevronLeft size={18} /></button>
        <button className="btn btn-sm btn-secondary" onClick={() => setViewWeekOffset(0)}>
          {viewWeekOffset === 0 ? 'All Upcoming' : `Week ${viewWeekOffset > 0 ? '+' : ''}${viewWeekOffset}`}
        </button>
        <button className="btn-icon" onClick={() => setViewWeekOffset(w => w + 1)}><ChevronRight size={18} /></button>
      </div>

      <div className="flex gap-2 mb-4" style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <button className={`btn btn-sm ${selectedCourse === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelectedCourse('all')}>
          <Filter size={12} /> All
        </button>
        {courseCodes.map(code => {
          const short = code.split('.')[0].replace(/(\d{3})(\d{3})/, '$1')
          return (
            <button key={code} className={`btn btn-sm ${selectedCourse === code ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCourse(code)} style={{ whiteSpace: 'nowrap' }}>
              {short}
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2 mb-4" style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
        <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }} />
        Show past events
      </label>

      {days.length === 0 ? (
        <div className="empty-state">
          <Calendar />
          <h3>No events to show</h3>
          <p>Connect your Canvas calendar in Settings to see events here.</p>
        </div>
      ) : (
        days.map(day => (
          <div key={day}>
            <div className="cal-day-header">{day}</div>
            {groupedEvents[day].map(ev => {
              const d = new Date(ev.start)
              const course = ev.title.match(/\[([^\]]+)\]/)?.[1] || ''
              const isPast = d < new Date()
              return (
                <div key={ev.uid} className="cal-event" style={{ borderLeftColor: getCourseColor(course), opacity: isPast ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {ev.completed ? (
                      <CheckCircle size={16} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <Circle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="cal-event-title">{ev.title.replace(/\s*\[.*?\]\s*$/, '')}</div>
                      <div className="cal-event-desc">
                        {!ev.allDay && d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {course && <> &bull; {course}</>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

/* ================================================================
   GOOGLE CALENDAR TAB
   ================================================================ */
function GoogleCalendarTab() {
  const [connected, setConnected] = useState(isGoogleConnected())
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientIdInput, setClientIdInput] = useState(getGoogleClientId())
  const [showSetup, setShowSetup] = useState(!getGoogleClientId())
  const [connecting, setConnecting] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const evts = await getCalendarEvents(30)
      setEvents(evts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events')
      if ((e as Error).message?.includes('expired') || (e as Error).message?.includes('authenticated')) {
        setConnected(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (connected) { loadEvents() }
  }, [connected, loadEvents])

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      await connectGoogleCalendar()
      setConnected(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    disconnectGoogle()
    setConnected(false)
    setEvents([])
  }

  const handleSaveClientId = () => {
    setGoogleClientId(clientIdInput.trim())
    setShowSetup(false)
  }

  // Setup: user must enter OAuth Client ID
  if (showSetup || !getGoogleClientId()) {
    return (
      <div>
        <div className="card mb-4">
          <div className="card-title mb-2">
            <Link size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Google Calendar Setup
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            To connect Google Calendar, you need a Google OAuth2 Client ID.
          </p>
          <ol style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 18, marginBottom: 16, lineHeight: 2 }}>
            <li>Go to <strong>console.developers.google.com</strong></li>
            <li>Create a project → Enable <strong>Google Calendar API</strong></li>
            <li>Create OAuth 2.0 credentials (Web application type)</li>
            <li>Add <strong>{window.location.origin}</strong> as an authorized JS origin</li>
            <li>Copy the Client ID below</li>
          </ol>
          <input
            value={clientIdInput}
            onChange={e => setClientIdInput(e.target.value)}
            placeholder="Paste your Google OAuth Client ID here..."
            style={{ width: '100%', fontSize: 13, marginBottom: 10 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSaveClientId}
            disabled={!clientIdInput.trim()}
          >
            Save & Continue
          </button>
        </div>
      </div>
    )
  }

  // Connected state
  if (connected) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={14} style={{ color: 'var(--green)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>Google Calendar Connected</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm btn-secondary" onClick={loadEvents} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleDisconnect}>
              <LogOut size={12} /> Disconnect
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red)18', border: '1px solid var(--red)40', color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {events.length === 0 && !loading ? (
          <div className="empty-state">
            <Calendar />
            <h3>No upcoming events</h3>
            <p>No events in the next 30 days on your primary Google Calendar.</p>
          </div>
        ) : (
          <div>
            <p className="page-subtitle">{events.length} upcoming events (next 30 days)</p>
            {events.map(ev => {
              const startStr = ev.start.dateTime || ev.start.date || ''
              const d = new Date(startStr)
              const isAllDay = !ev.start.dateTime
              const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              return (
                <div key={ev.id} className="cal-event" style={{ borderLeftColor: '#4285f4' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#4285f4',
                      flexShrink: 0, marginTop: 5,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div className="cal-event-title">{ev.summary || '(No title)'}</div>
                      <div className="cal-event-desc">
                        {day}
                        {!isAllDay && <> &bull; {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>}
                        {ev.location && <> &bull; {ev.location}</>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Configured but not authenticated
  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <CloudOff size={24} style={{ color: 'var(--text-muted)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Not Connected</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sign in with Google to sync your calendar</div>
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red)18', border: '1px solid var(--red)40', color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
          <LogIn size={14} /> {connecting ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
        <button
          className="btn btn-sm btn-secondary"
          style={{ marginTop: 8, display: 'block' }}
          onClick={() => setShowSetup(true)}
        >
          Change Client ID
        </button>
      </div>
    </div>
  )
}

/* ================================================================
   STUDY SCHEDULER TAB
   ================================================================ */
function SchedulerTab({
  data, updatePluginData,
}: {
  data: NousAIData;
  updatePluginData: (partial: Partial<NousAIData['pluginData']>) => void;
}) {
  const courses = data.pluginData.coachData.courses;
  const schedules = useMemo(() => data.pluginData.studySchedules || [], [data.pluginData.studySchedules]);
  const [now] = useState(() => Date.now());

  const [showForm, setShowForm] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [viewSchedule, setViewSchedule] = useState<StudySchedule | null>(null);

  // Google Calendar sync state
  const [gcalConnected] = useState(isGoogleConnected);
  const [syncStatus, setSyncStatus] = useState<Record<string, 'syncing' | 'synced' | 'error'>>({});

  const saveSchedules = useCallback((updated: StudySchedule[]) => {
    updatePluginData({ studySchedules: updated } as Partial<NousAIData['pluginData']>);
  }, [updatePluginData]);

  const toggleBlock = useCallback((scheduleId: string, blockId: string) => {
    const updated = schedules.map(s => {
      if (s.id !== scheduleId) return s;
      return {
        ...s,
        blocks: s.blocks.map(b => b.id === blockId ? { ...b, done: !b.done } : b),
      };
    });
    saveSchedules(updated);
    if (viewSchedule?.id === scheduleId) {
      setViewSchedule(updated.find(s => s.id === scheduleId) || null);
    }
  }, [schedules, saveSchedules, viewSchedule]);

  const deleteSchedule = useCallback((id: string) => {
    saveSchedules(schedules.filter(s => s.id !== id));
    if (viewSchedule?.id === id) setViewSchedule(null);
  }, [schedules, saveSchedules, viewSchedule]);

  const syncBlockToGCal = useCallback(async (block: StudyBlock, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncStatus(prev => ({ ...prev, [block.id]: 'syncing' }));
    try {
      await pushStudyBlockToCalendar(block);
      setSyncStatus(prev => ({ ...prev, [block.id]: 'synced' }));
    } catch {
      setSyncStatus(prev => ({ ...prev, [block.id]: 'error' }));
    }
  }, []);

  const generateSchedule = useCallback(async () => {
    if (!courseName.trim() || !examDate) return;
    setGenerating(true);

    const today = new Date();
    const exam = new Date(examDate);
    const daysUntilExam = Math.max(1, Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const weeksUntilExam = Math.max(1, Math.ceil(daysUntilExam / 7));
    const minutesPerWeek = hoursPerWeek * 60;
    const sessionsPerWeek = Math.min(6, Math.max(3, Math.floor(hoursPerWeek / 1.5)));

    // Find course topics if available
    const matchedCourse = courses.find(c =>
      c.name.toLowerCase().includes(courseName.toLowerCase()) ||
      courseName.toLowerCase().includes(c.name.toLowerCase())
    );
    const topics = matchedCourse?.topics.map(t => t.name) || [];

    // Try AI-powered generation first
    if (isAIConfigured() && topics.length > 0) {
      try {
        const prompt = `Create a ${weeksUntilExam}-week study schedule for "${courseName}".
Exam date: ${examDate}. Study budget: ${hoursPerWeek} hrs/week (${sessionsPerWeek} sessions).
Topics: ${topics.join(', ')}

Output ONLY a JSON array of study blocks. Each block:
{"date":"YYYY-MM-DD","topic":"<topic>","durationMin":<number>,"type":"learn|review|practice|exam-prep"}

Rules:
- Spread sessions across the week (not all on one day)
- Earlier weeks: learn new topics. Later weeks: review + practice. Final week: exam-prep
- Cover all topics at least twice
- Each session 30-90 minutes
- Start from tomorrow
- Output ONLY valid JSON array, no other text`;

        const result = await callAI([
          { role: 'system', content: 'You are a study planning assistant. Output only valid JSON.' },
          { role: 'user', content: prompt },
        ]);

        // Parse AI response
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          let aiBlocks: Array<{ date: string; topic: string; durationMin: number; type: string }>;
          try {
            aiBlocks = JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error('AI returned malformed JSON');
          }
          const blocks: StudyBlock[] = aiBlocks.map(b => ({
            id: uid(),
            date: b.date,
            courseId: matchedCourse?.id || '',
            courseName: courseName,
            topic: b.topic,
            durationMin: b.durationMin || 60,
            type: (['learn', 'review', 'practice', 'exam-prep'].includes(b.type) ? b.type : 'learn') as StudyBlock['type'],
          }));

          const schedule: StudySchedule = {
            id: uid(),
            courseName,
            examDate,
            hoursPerWeek,
            blocks,
            createdAt: new Date().toISOString(),
          };

          saveSchedules([...schedules, schedule]);
          setViewSchedule(schedule);
          setShowForm(false);
          setGenerating(false);
          return;
        }
      } catch { /* fall through to template */ }
    }

    // Template-based fallback
    const blocks: StudyBlock[] = [];
    const sessionDuration = Math.round(minutesPerWeek / sessionsPerWeek);
    const topicNames = topics.length > 0 ? topics : [`${courseName} — General Study`];

    for (let week = 0; week < weeksUntilExam; week++) {
      const isLastWeek = week >= weeksUntilExam - 1;
      const isFinalPhase = week >= weeksUntilExam - 2;

      for (let s = 0; s < sessionsPerWeek; s++) {
        const dayOffset = week * 7 + Math.round((s / sessionsPerWeek) * 6) + 1; // spread across week
        const d = new Date(today);
        d.setDate(d.getDate() + dayOffset);
        if (d > exam) break;

        const topicIdx = (week * sessionsPerWeek + s) % topicNames.length;
        const blockType: StudyBlock['type'] = isLastWeek ? 'exam-prep' : isFinalPhase ? 'practice' : week < 2 ? 'learn' : 'review';

        blocks.push({
          id: uid(),
          date: d.toISOString().split('T')[0],
          courseId: matchedCourse?.id || '',
          courseName,
          topic: topicNames[topicIdx],
          durationMin: sessionDuration,
          type: blockType,
        });
      }
    }

    const schedule: StudySchedule = {
      id: uid(),
      courseName,
      examDate,
      hoursPerWeek,
      blocks,
      createdAt: new Date().toISOString(),
    };

    saveSchedules([...schedules, schedule]);
    setViewSchedule(schedule);
    setShowForm(false);
    setGenerating(false);
  }, [courseName, examDate, hoursPerWeek, courses, schedules, saveSchedules]);

  const typeIcon = (type: StudyBlock['type']) => {
    switch (type) {
      case 'learn': return <BookOpen size={13} style={{ color: 'var(--blue)' }} />;
      case 'review': return <Target size={13} style={{ color: 'var(--yellow)' }} />;
      case 'practice': return <Zap size={13} style={{ color: 'var(--green)' }} />;
      case 'exam-prep': return <GraduationCap size={13} style={{ color: 'var(--red)' }} />;
    }
  };

  const typeColor = (type: StudyBlock['type']) => {
    switch (type) {
      case 'learn': return 'var(--blue)';
      case 'review': return 'var(--yellow)';
      case 'practice': return 'var(--green)';
      case 'exam-prep': return 'var(--red)';
    }
  };

  // Viewing a specific schedule
  if (viewSchedule) {
    const completedCount = viewSchedule.blocks.filter(b => b.done).length;
    const totalMin = viewSchedule.blocks.reduce((sum, b) => sum + b.durationMin, 0);
    const completedMin = viewSchedule.blocks.filter(b => b.done).reduce((sum, b) => sum + b.durationMin, 0);

    // Group blocks by date
    const byDate: Record<string, StudyBlock[]> = {};
    viewSchedule.blocks
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(b => {
        if (!byDate[b.date]) byDate[b.date] = [];
        byDate[b.date].push(b);
      });

    return (
      <div>
        <button className="btn btn-sm mb-3" onClick={() => setViewSchedule(null)}>
          <ChevronLeft size={13} /> All Schedules
        </button>

        <div className="card mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{viewSchedule.courseName}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Exam: {new Date(viewSchedule.examDate).toLocaleDateString()} &middot; {viewSchedule.hoursPerWeek} hrs/week
          </div>

          <div className="progress-bar" style={{ marginBottom: 8 }}>
            <div className="progress-fill" style={{
              width: `${viewSchedule.blocks.length > 0 ? (completedCount / viewSchedule.blocks.length) * 100 : 0}%`,
              background: 'var(--green)',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {completedCount}/{viewSchedule.blocks.length} sessions done &middot; {Math.round(completedMin / 60)}h/{Math.round(totalMin / 60)}h studied
          </div>

          {gcalConnected && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Cloud size={11} style={{ color: '#4285f4' }} />
              Click the sync icon on each block to add it to Google Calendar
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-3 mb-3" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {(['learn', 'review', 'practice', 'exam-prep'] as const).map(type => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {typeIcon(type)} {type === 'exam-prep' ? 'Exam Prep' : type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          ))}
        </div>

        {/* Blocks by date */}
        {Object.entries(byDate).map(([date, blocks]) => {
          const d = new Date(date + 'T12:00:00');
          const isPast = new Date(date) < new Date(new Date().toISOString().split('T')[0]);
          return (
            <div key={date} style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid var(--border)',
              }}>
                {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              {blocks.map(block => {
                const ss = syncStatus[block.id];
                return (
                  <div
                    key={block.id}
                    onClick={() => toggleBlock(viewSchedule.id, block.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
                      border: `1px solid ${block.done ? 'var(--green)20' : 'var(--border)'}`,
                      cursor: 'pointer', marginBottom: 4,
                      opacity: block.done ? 0.6 : isPast && !block.done ? 0.8 : 1,
                    }}
                  >
                    {block.done ? (
                      <CheckCircle size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
                    ) : (
                      <Circle size={16} style={{ color: typeColor(block.type), flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        textDecoration: block.done ? 'line-through' : undefined,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {block.topic}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {typeIcon(block.type)}
                        <span>{block.type === 'exam-prep' ? 'Exam Prep' : block.type.charAt(0).toUpperCase() + block.type.slice(1)}</span>
                        <span style={{ opacity: 0.4 }}>|</span>
                        <span>{block.durationMin} min</span>
                      </div>
                    </div>
                    {gcalConnected && (
                      <button
                        onClick={e => syncBlockToGCal(block, e)}
                        disabled={ss === 'syncing' || ss === 'synced'}
                        title={ss === 'synced' ? 'Synced to Google Calendar' : ss === 'error' ? 'Sync failed — retry' : 'Sync to Google Calendar'}
                        style={{
                          background: 'none', border: 'none', cursor: ss === 'synced' ? 'default' : 'pointer',
                          color: ss === 'synced' ? 'var(--green)' : ss === 'error' ? 'var(--red)' : '#4285f4',
                          padding: 4, flexShrink: 0,
                        }}
                      >
                        {ss === 'syncing' ? <RefreshCw size={13} className="animate-spin" /> :
                         ss === 'synced' ? <CheckCircle size={13} /> :
                         <Cloud size={13} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Schedule list view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Study Schedules</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {isAIConfigured() ? 'AI-powered scheduling available' : 'Configure AI in Settings for smart scheduling'}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          <Plus size={13} /> New Schedule
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Create Study Schedule</h4>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Course</label>
              {courses.length > 0 ? (
                <select
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                >
                  <option value="">Select a course...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  placeholder="Course name (e.g. Biology 101)"
                  style={{ width: '100%', fontSize: 13 }}
                />
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Exam Date</label>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Hours per week: {hoursPerWeek}
              </label>
              <input
                type="range"
                min={2}
                max={30}
                value={hoursPerWeek}
                onChange={e => setHoursPerWeek(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
                <span>2 hrs</span><span>30 hrs</span>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={generateSchedule}
              disabled={!courseName.trim() || !examDate || generating}
            >
              {generating ? 'Generating...' : 'Generate Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* Existing schedules */}
      {schedules.length === 0 && !showForm ? (
        <div className="empty-state">
          <Clock size={40} />
          <h3>No study schedules</h3>
          <p>Create a schedule to plan your study sessions leading up to exams.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowForm(true)}>
            Create First Schedule
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {schedules.map(schedule => {
            const done = schedule.blocks.filter(b => b.done).length;
            const total = schedule.blocks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const daysLeft = Math.max(0, Math.ceil((new Date(schedule.examDate).getTime() - now) / (1000 * 60 * 60 * 24)));
            return (
              <div
                key={schedule.id}
                onClick={() => setViewSchedule(schedule)}
                style={{
                  padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{schedule.courseName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Exam: {new Date(schedule.examDate).toLocaleDateString()} &middot; {daysLeft}d left &middot; {schedule.hoursPerWeek} hrs/wk
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteSchedule(schedule.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="progress-bar" style={{ marginTop: 8 }}>
                  <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {done}/{total} sessions ({pct}%)
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getCourseColor(code: string): string {
  if (code.includes('BIOL')) return '#22c55e'
  if (code.includes('JAPN')) return '#f97316'
  if (code.includes('PHYS')) return '#3b82f6'
  if (code.includes('CIST') || code.includes('CSCI')) return '#8b5cf6'
  return 'var(--accent)'
}
