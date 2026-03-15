import { useState, useMemo, useCallback, useRef } from 'react';
import { ChevronLeft, Users, ArrowRight, Camera, Library } from 'lucide-react';
import { useStore } from '../../store';
import { sanitizeHtml } from '../../utils/sanitize';
import { callAI, isAIConfigured } from '../../utils/ai';
import { renderMd } from '../../utils/renderMd';
import { useImageOCR } from '../../hooks/useImageOCR';
import ImageInputBar from '../ImageInputBar';
import { uid, inputStyle } from './learnHelpers';

// renderMd + safeRenderMd imported from ../utils/renderMd

export default function TutorsMode() {
  const { courses, quizHistory } = useStore();
  const [view, setView] = useState<'courses' | 'tutor'>('courses');
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [style, setStyle] = useState<'strict' | 'encouraging' | 'socratic' | 'visual' | 'coach'>('encouraging');
  const [topic, setTopic] = useState('');
  const [conversation, setConversation] = useState<{ role: 'tutor' | 'student'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const imageOCR = useImageOCR();

  const styles = [
    { id: 'strict' as const, name: 'Professor', desc: 'Rigorous, detailed, expects precision' },
    { id: 'encouraging' as const, name: 'Cheerleader', desc: 'Positive, supportive, celebrates effort' },
    { id: 'socratic' as const, name: 'Philosopher', desc: 'Answers with questions, makes you think' },
    { id: 'visual' as const, name: 'Visualizer', desc: 'Uses diagrams, analogies, mental images' },
    { id: 'coach' as const, name: 'Coach', desc: 'Action-oriented, drills, practice-focused' },
  ];

  const allCards = useMemo(() => courses.flatMap(c => c.flashcards || []), [courses]);

  // Get quiz count per course
  const quizCountByCourse = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of quizHistory) {
      const key = q.subject || q.name || '';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [quizHistory]);

  const activeCourse = useMemo(() => courses.find(c => c.id === activeCourseId), [courses, activeCourseId]);

  const stylePrompts: Record<string, string> = {
    strict: 'You are a rigorous, demanding professor. Expect precision and correct students firmly but fairly. Push them to think deeper. Never accept vague answers.',
    encouraging: 'You are an enthusiastic, supportive tutor. Celebrate effort and progress. Be warm and positive while still teaching effectively. Use exclamation marks!',
    socratic: 'You are a Socratic tutor. Answer questions with thought-provoking questions. Guide the student to discover answers themselves. Never give answers directly.',
    visual: 'You are a visual-oriented tutor. Use analogies, mental images, diagrams described in text, and spatial metaphors to explain concepts. Paint pictures with words.',
    coach: 'You are an action-oriented study coach. Focus on drills, practice, and rapid recall. Keep energy high. Give timed challenges and push for speed.',
  };

  function openTutor(courseId: string) {
    setActiveCourseId(courseId);
    const course = courses.find(c => c.id === courseId);
    setTopic(course?.name || '');
    setView('tutor');
  }

  const startTutoring = useCallback(async () => {
    if (!topic.trim()) return;

    if (isAIConfigured() && activeCourse) {
      const cardsSample = (activeCourse.flashcards || []).slice(0, 30)
        .map(f => `Q: ${f.front} → A: ${f.back}`).join('\n');
      const topicsList = (activeCourse.topics || []).map(t => t.name).join(', ');

      const systemPrompt = `${stylePrompts[style]}

You are tutoring a student on "${topic}" from the course "${activeCourse.name}".
Course topics: ${topicsList || 'N/A'}
Key flashcards:\n${cardsSample || 'None'}

Keep responses concise (under 200 words). Use markdown formatting.`;

      setConversation([{ role: 'tutor', text: '...' }]);
      setIsTyping(true);

      try {
        let streamed = '';
        await callAI(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `I want to study "${topic}". Start our tutoring session.` },
          ],
          {
            onChunk: (chunk: string) => {
              streamed += chunk;
              setConversation([{ role: 'tutor', text: streamed }]);
            },
          },
          'chat',
        );
        if (!streamed) {
          const text = await callAI(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `I want to study "${topic}". Start our tutoring session.` },
            ],
            {},
            'chat',
          );
          setConversation([{ role: 'tutor', text }]);
        }
      } catch (err: any) {
        setConversation([{ role: 'tutor', text: `⚠ AI error: ${err.message}. Check Settings → AI Provider.` }]);
      }
      setIsTyping(false);
    } else {
      // Fallback intros
      const intros: Record<string, string> = {
        strict: `Let us begin with "${topic}". Define the core concept precisely.`,
        encouraging: `Great choice picking "${topic}"! Tell me what you already know!`,
        socratic: `You wish to study "${topic}". Why is this topic important to you?`,
        visual: `Let us paint a picture of "${topic}". What does it look like in your mind?`,
        coach: `Time to drill "${topic}"! Give me a 30-second explanation. Go!`,
      };
      setConversation([{ role: 'tutor', text: intros[style] + '\n\n*Configure AI in Settings for smarter tutoring.*' }]);
    }
  }, [topic, style, activeCourse, stylePrompts]);

  const respond = useCallback(async () => {
    const userText = input.trim();
    if (!userText && !imageOCR.ocrText) return;
    if (isTyping) return;

    // Capture image data before clearing
    const imgBase64 = imageOCR.imageBase64;
    const imgMime = imageOCR.imageMimeType || 'image/png';
    const hasImage = !!imageOCR.imagePreview;

    let fullText = userText;
    if (imageOCR.ocrText) {
      fullText += (userText ? '\n\n' : '') + '[Extracted from image]:\n' + imageOCR.ocrText;
    }
    if (hasImage) imageOCR.clearImage();

    const newConv = [...conversation, { role: 'student' as const, text: fullText }];
    setConversation(newConv);
    setInput('');
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);

    if (isAIConfigured() && activeCourse) {
      const cardsSample = (activeCourse.flashcards || []).slice(0, 30)
        .map(f => `Q: ${f.front} → A: ${f.back}`).join('\n');
      const topicsList = (activeCourse.topics || []).map(t => t.name).join(', ');

      const systemPrompt = `${stylePrompts[style]}

Tutoring "${topic}" from "${activeCourse.name}".
Topics: ${topicsList || 'N/A'}
Flashcards:\n${cardsSample || 'None'}

Keep responses concise. Use markdown.`;

      const recentMsgs = newConv.slice(-20);
      const aiMessages: any[] = [
        { role: 'system' as const, content: systemPrompt },
        ...recentMsgs.map((m, i) => {
          const role = (m.role === 'student' ? 'user' : 'assistant') as 'user' | 'assistant';
          // Attach image to the last user message if we have one
          if (hasImage && imgBase64 && i === recentMsgs.length - 1 && role === 'user') {
            return {
              role,
              content: [
                { type: 'image_url' as const, image_url: { url: `data:${imgMime};base64,${imgBase64}` } },
                { type: 'text' as const, text: m.text + '\n\nPlease analyze the image above carefully. Extract and read ALL text including any Japanese, Chinese, or other non-Latin characters accurately.' },
              ],
            };
          }
          return { role, content: m.text };
        }),
      ];

      setIsTyping(true);
      const placeholderIdx = newConv.length;

      try {
        let streamed = '';
        setConversation(prev => [...prev, { role: 'tutor', text: '...' }]);

        await callAI(aiMessages, {
          onChunk: (chunk: string) => {
            streamed += chunk;
            setConversation(prev => prev.map((m, i) =>
              i === placeholderIdx ? { ...m, text: streamed } : m
            ));
          },
        }, 'chat');
        if (!streamed) {
          const text = await callAI(aiMessages, {}, 'chat');
          setConversation(prev => prev.map((m, i) =>
            i === placeholderIdx ? { ...m, text } : m
          ));
        }
      } catch (err: any) {
        setConversation(prev => [...prev, { role: 'tutor', text: `⚠ AI error: ${err.message}` }]);
      }
      setIsTyping(false);
    } else {
      // Fallback
      const fallbackReplies = [
        'That is a good start. Can you elaborate further?',
        'Interesting. What else do you know about this?',
        'Keep going! What connections can you make?',
      ];
      const reply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      setTimeout(() => {
        setConversation(prev => [...prev, { role: 'tutor', text: reply + '\n\n*For AI-powered tutoring, configure an API key in Settings.*' }]);
      }, 500);
    }
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 100);
  }, [input, isTyping, conversation, style, topic, activeCourse, stylePrompts]);

  // ── Course Tutors Grid View ──
  if (view === 'courses') {
    return (
      <div>
        <div style={{
          fontWeight: 800, fontSize: 13, letterSpacing: 1.5,
          color: '#888', marginBottom: 6, textTransform: 'uppercase',
        }}>
          COURSE TUTORS
        </div>
        <p className="text-sm text-muted mb-3">
          Select a course to start a personalized tutoring session with an AI tutor
          that knows your material.
        </p>

        <button
          className="btn btn-sm btn-secondary mb-3"
          onClick={() => window.location.hash = '#/library'}
          style={{
            fontSize: 11, padding: '6px 12px', gap: 4,
            border: '1px solid #444', background: 'transparent', color: '#ccc',
          }}
        >
          <Library size={12} /> Manage All Textbooks
        </button>

        {courses.length === 0 ? (
          <div className="text-center" style={{ padding: 24 }}>
            <Users size={32} style={{ color: '#555', margin: '0 auto 12px' }} />
            <p className="text-sm text-muted">No courses found. Add courses to get started with tutors.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}>
            {courses.map(course => {
              const abbr = (course.shortName || course.name).slice(0, 2).toUpperCase();
              const quizCount = quizCountByCourse[course.name] || quizCountByCourse[course.shortName] || 0;
              return (
                <div
                  key={course.id}
                  style={{
                    background: '#1a1a1e',
                    border: '1px solid #333',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 10,
                    background: '#2a2a2e', border: '1px solid #444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 800, color: '#ccc',
                    letterSpacing: 1,
                  }}>
                    {abbr}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#e0e0e0', lineHeight: 1.3 }}>
                      {course.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#777', marginTop: 3 }}>
                      {course.flashcards?.length || 0} cards | {course.topics?.length || 0} topics | {quizCount} quizzes
                    </div>
                  </div>
                  <button
                    onClick={() => openTutor(course.id)}
                    style={{
                      width: '100%', padding: '7px 0',
                      background: 'transparent',
                      border: '1px solid #555',
                      borderRadius: 8,
                      color: '#ccc', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                    }}
                  >
                    Open Tutor
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Tutor Chat View ──
  return (
    <div>
      <button
        onClick={() => { setView('courses'); setConversation([]); setTopic(''); }}
        className="btn btn-sm btn-secondary mb-3"
        style={{ gap: 4, border: '1px solid #444', background: 'transparent', color: '#ccc' }}
      >
        <ChevronLeft size={14} /> Back to Courses
      </button>

      <p className="text-sm text-muted mb-2">Choose a teaching style, then start tutoring.</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {styles.map(s => (
          <button key={s.id} className={`btn btn-sm ${style === s.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setStyle(s.id); setConversation([]); }}
            style={{ fontSize: 10, padding: '4px 8px' }}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="text-xs text-muted mb-3">
        {styles.find(s => s.id === style)?.desc}
      </div>

      {conversation.length === 0 ? (
        <div className="flex gap-2">
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="Topic to study..." style={{ ...inputStyle, flex: 1, fontSize: 13 }}
            onKeyDown={e => e.key === 'Enter' && startTutoring()}
          />
          <button className="btn btn-primary btn-sm" onClick={startTutoring}>
            <Users size={14} /> Start
          </button>
        </div>
      ) : (
        <>
          <div ref={chatRef} style={{
            maxHeight: 240, overflowY: 'auto', marginBottom: 8,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {conversation.map((m, i) => (
              <div key={i} style={{
                padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, lineHeight: 1.6,
                background: m.role === 'tutor' ? 'var(--accent-glow)' : 'var(--bg-primary)',
                alignSelf: m.role === 'student' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                borderLeft: m.role === 'tutor' ? '3px solid var(--accent)' : undefined,
              }}>
                {m.role === 'tutor' && <div className="text-xs" style={{ fontWeight: 700, color: 'var(--accent-light)', marginBottom: 2 }}>
                  {styles.find(s => s.id === style)?.name}
                </div>}
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(m.text)) }} />
              </div>
            ))}
          </div>
          {isTyping && (
            <div style={{
              padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11,
              background: 'var(--accent-glow)', color: 'var(--text-muted)', alignSelf: 'flex-start',
              animation: 'pulse 1.5s infinite',
            }}>
              Tutor is thinking...
            </div>
          )}
          <ImageInputBar ocr={imageOCR} compact />
          <form onSubmit={e => { e.preventDefault(); respond(); }} className="flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onPaste={imageOCR.handlePaste}
              placeholder="Your response..." style={{ ...inputStyle, flex: 1, fontSize: 13 }} autoFocus
              disabled={isTyping} />
            <button type="button" onClick={imageOCR.triggerFileInput} className="btn btn-secondary btn-sm" title="Upload image" style={{ padding: '6px 8px' }}>
              <Camera size={14} />
            </button>
            <button className="btn btn-primary btn-sm" type="submit" disabled={isTyping || imageOCR.isProcessing}><ArrowRight size={14} /></button>
          </form>
          <button className="btn btn-secondary btn-sm mt-2 w-full" onClick={() => { setConversation([]); setTopic(''); }}
            style={{ fontSize: 10 }}>
            End Session
          </button>
        </>
      )}
    </div>
  );
}
