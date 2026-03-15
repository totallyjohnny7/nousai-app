import { useState, useEffect, useCallback } from 'react';
import { Languages, Plus, Trash2, Copy, Save } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { Note } from '../../types';
import { sanitizeHtml } from '../../utils/sanitize';
import { uid, copyText, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { ClipboardPaste } from 'lucide-react';

type JpWordType = 'verb' | 'particle' | 'place' | 'time' | 'object' | 'adjective' | 'adverb' | 'greeting' | 'other';

interface JpWordAnalysis {
  word: string;
  reading: string;
  romaji: string;
  meaning: string;
  type: JpWordType;
}

interface JpSentenceAnalysis {
  sentence: string;
  words: JpWordAnalysis[];
}

interface JpQAPair {
  id: string;
  questionText: string;
  answerText: string;
  questionAnalysis: JpSentenceAnalysis | null;
  answerAnalysis: JpSentenceAnalysis | null;
}

const JP_WORD_COLORS: Record<JpWordType, { bg: string; emoji: string; label: string }> = {
  verb:      { bg: '#fecaca', emoji: '🔴', label: 'Verb' },
  particle:  { bg: '#bfdbfe', emoji: '🔵', label: 'Particle' },
  place:     { bg: '#bbf7d0', emoji: '🟢', label: 'Place' },
  time:      { bg: '#fef08a', emoji: '🟡', label: 'Frequency/Time' },
  object:    { bg: '#ddd6fe', emoji: '🟣', label: 'Object' },
  adjective: { bg: '#fed7aa', emoji: '🟠', label: 'Adjective' },
  adverb:    { bg: '#fbcfe8', emoji: '🟤', label: 'Adverb' },
  greeting:  { bg: '#99f6e4', emoji: '⚪', label: 'Greeting' },
  other:     { bg: '#d1d5db', emoji: '⚫', label: 'Other' },
};

function generateStudyHtml(pairs: JpQAPair[], title: string): string {
  const usedTypes = new Set<JpWordType>();
  for (const p of pairs) {
    for (const w of (p.questionAnalysis?.words || [])) usedTypes.add(w.type);
    for (const w of (p.answerAnalysis?.words || [])) usedTypes.add(w.type);
  }

  const legendHtml = Object.entries(JP_WORD_COLORS)
    .filter(([type]) => usedTypes.has(type as JpWordType) && type !== 'other')
    .map(([, { emoji, label }]) => `${emoji} <strong>${label}</strong>`)
    .join(' &nbsp;|&nbsp; ');

  const renderSentence = (words: JpWordAnalysis[]) =>
    words.map(w => {
      const c = JP_WORD_COLORS[w.type];
      return `<mark style="background-color:${c.bg};padding:2px 4px;border-radius:3px">${w.word}</mark>`;
    }).join(' ');

  const renderBreakdown = (words: JpWordAnalysis[]) =>
    words.filter(w => w.type !== 'other').map(w => {
      const c = JP_WORD_COLORS[w.type];
      return `${c.emoji}(${w.romaji}/${w.word}/${w.meaning})`;
    }).join(' &nbsp;');

  const rowsHtml = pairs.map((pair, idx) => {
    if (!pair.questionAnalysis || !pair.answerAnalysis) return '';
    return `<tr>
      <td style="padding:12px;border:1px solid var(--border);vertical-align:top">
        <div style="font-size:16px;margin-bottom:8px"><strong style="color:#ef4444">${idx + 1}.</strong> ${renderSentence(pair.questionAnalysis.words)}</div>
        <div style="font-size:12px;margin-top:8px;line-height:1.8">${renderBreakdown(pair.questionAnalysis.words)}</div>
      </td>
      <td style="padding:12px;border:1px solid var(--border);vertical-align:top">
        <div style="font-size:16px;margin-bottom:8px">${renderSentence(pair.answerAnalysis.words)}</div>
        <div style="font-size:12px;margin-top:8px;line-height:1.8">${renderBreakdown(pair.answerAnalysis.words)}</div>
      </td>
    </tr>`;
  }).join('');

  return `<div>
    <p style="font-size:13px;margin-bottom:16px;padding:6px 10px;background:var(--accent-glow);border-radius:6px;display:inline-block"><strong>Legend:</strong> ${legendHtml}</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid var(--border)">
      <thead>
        <tr>
          <th style="padding:10px 12px;border:1px solid var(--border);text-align:left;font-weight:700;color:#ef4444;font-style:italic">QUESTION</th>
          <th style="padding:10px 12px;border:1px solid var(--border);text-align:left;font-weight:700;color:#ef4444;font-style:italic">ANSWER</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>`;
}

function generateFullNoteHtml(sentences: JpSentenceAnalysis[], title: string): string {
  const usedTypes = new Set<JpWordType>();
  for (const s of sentences) {
    for (const w of s.words) usedTypes.add(w.type);
  }

  const legendHtml = Object.entries(JP_WORD_COLORS)
    .filter(([type]) => usedTypes.has(type as JpWordType) && type !== 'other')
    .map(([, { emoji, label }]) => `${emoji} <strong>${label}</strong>`)
    .join(' &nbsp;|&nbsp; ');

  const renderSentence = (words: JpWordAnalysis[]) =>
    words.map(w => {
      const c = JP_WORD_COLORS[w.type];
      return `<mark style="background-color:${c.bg};padding:2px 4px;border-radius:3px">${w.word}</mark>`;
    }).join(' ');

  const renderBreakdown = (words: JpWordAnalysis[]) =>
    words.filter(w => w.type !== 'other').map(w => {
      const c = JP_WORD_COLORS[w.type];
      return `${c.emoji}(${w.romaji}/${w.word}/${w.meaning})`;
    }).join(' &nbsp;');

  const sentencesHtml = sentences.map((s, idx) =>
    `<div style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:8px">
      <div style="font-size:16px;margin-bottom:8px"><strong style="color:#ef4444">${idx + 1}.</strong> ${renderSentence(s.words)}</div>
      <div style="font-size:12px;line-height:1.8">${renderBreakdown(s.words)}</div>
    </div>`
  ).join('');

  return `<div>
    ${title ? `<h3 style="margin-bottom:12px">${title}</h3>` : ''}
    <p style="font-size:13px;margin-bottom:16px;padding:6px 10px;background:var(--accent-glow);border-radius:6px;display:inline-block"><strong>Legend:</strong> ${legendHtml}</p>
    ${sentencesHtml}
  </div>`;
}

function NihongoStudyTool() {
  const { data, updatePluginData } = useStore();
  const [pairs, setPairs] = useState<JpQAPair[]>([
    { id: uid(), questionText: '', answerText: '', questionAnalysis: null, answerAnalysis: null },
  ]);
  const [titleInput, setTitleInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [mode, setMode] = useState<'pairs' | 'fullnote'>('pairs');
  const [fullNoteText, setFullNoteText] = useState('');
  const [fullNoteAnalysis, setFullNoteAnalysis] = useState<JpSentenceAnalysis[]>([]);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedHtml, setPastedHtml] = useState('');

  // Check for prefill from library note
  useEffect(() => {
    const raw = localStorage.getItem('nousai-jp-prefill');
    if (raw) {
      localStorage.removeItem('nousai-jp-prefill');
      try {
        const { title, content, fullNote } = JSON.parse(raw);
        if (title) setTitleInput(title);
        if (fullNote && content) {
          // Full note mode — paste entire content
          setMode('fullnote');
          setFullNoteText(content);
        } else if (content) {
          // Try to split content into Q/A pairs by line breaks
          const lines = content.split(/[\n\r]+/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
          const newPairs: JpQAPair[] = [];
          for (let i = 0; i < lines.length - 1; i += 2) {
            newPairs.push({ id: uid(), questionText: lines[i], answerText: lines[i + 1] || '', questionAnalysis: null, answerAnalysis: null });
          }
          if (lines.length % 2 === 1) {
            newPairs.push({ id: uid(), questionText: lines[lines.length - 1], answerText: '', questionAnalysis: null, answerAnalysis: null });
          }
          if (newPairs.length > 0) setPairs(newPairs);
        }
      } catch { /* ignore */ }
    }
  }, []);

  const addPair = () => {
    setPairs(p => [...p, { id: uid(), questionText: '', answerText: '', questionAnalysis: null, answerAnalysis: null }]);
  };

  const removePair = (id: string) => {
    if (pairs.length <= 1) return;
    setPairs(p => p.filter(x => x.id !== id));
  };

  const updatePair = (id: string, field: 'questionText' | 'answerText', value: string) => {
    setPairs(p => p.map(x => x.id === id ? { ...x, [field]: value } : x));
  };

  const analyzeWithAI = useCallback(async () => {
    const validPairs = pairs.filter(p => p.questionText.trim() && p.answerText.trim());
    if (validPairs.length === 0) return;
    if (!isAIConfigured()) { setError('AI provider not configured. Go to Settings to set up.'); return; }

    setAnalyzing(true);
    setError('');
    setSaved(false);

    try {
      const prompt = `You are a Japanese language analysis tool. Analyze each Japanese sentence word-by-word.

For each word/morpheme, classify it as one of:
- "verb" — action words including conjugated forms (います, 行きます, 食べます, いきません)
- "particle" — は, が, を, に, で, へ, と, も, の, か, etc.
- "place" — location nouns (カフェ, 図書館, 大学, うち, コンビニ)
- "time" — time/frequency words (よく, あまり, 毎日, なんじごろ, ごごの)
- "object" — object nouns, things acted upon (本, ごはん, 日本語, コーヒー)
- "adjective" — descriptive words (大きい, きれい, 新しい)
- "adverb" — modifying words (とても, もう, まだ)
- "greeting" — set phrases (はい, いいえ, ええ, すみません)
- "other" — copula です, conjunctions, etc.

For each word provide: the word as written, hiragana reading, romaji, and English meaning.

Sentences to analyze:
${validPairs.map((p, i) => `Q${i + 1}: ${p.questionText}\nA${i + 1}: ${p.answerText}`).join('\n')}

Return ONLY valid JSON:
{
  "pairs": [
    {
      "question": {
        "sentence": "full question",
        "words": [{ "word": "よく", "reading": "よく", "romaji": "yoku", "meaning": "often", "type": "time" }]
      },
      "answer": {
        "sentence": "full answer",
        "words": [{ "word": "いいえ", "reading": "いいえ", "romaji": "iie", "meaning": "no", "type": "greeting" }]
      }
    }
  ]
}`;

      const response = await callAI([{ role: 'user', content: prompt }], { json: true, maxTokens: 4096 });
      let jsonStr = response.trim();
      const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) jsonStr = codeBlock[1].trim();
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) jsonStr = objMatch[0];
      const parsed = JSON.parse(jsonStr);

      if (parsed.pairs && Array.isArray(parsed.pairs)) {
        const validTypes = Object.keys(JP_WORD_COLORS);
        const updated = validPairs.map((p, i) => {
          const aiPair = parsed.pairs[i];
          if (!aiPair) return p;
          const sanitizeWords = (words: Record<string, unknown>[]): JpWordAnalysis[] =>
            (words || []).map(w => ({
              word: String(w.word || ''),
              reading: String(w.reading || ''),
              romaji: String(w.romaji || ''),
              meaning: String(w.meaning || ''),
              type: (validTypes.includes(String(w.type)) ? w.type : 'other') as JpWordType,
            }));
          return {
            ...p,
            questionAnalysis: aiPair.question ? {
              sentence: String(aiPair.question.sentence || p.questionText),
              words: sanitizeWords(aiPair.question.words),
            } : null,
            answerAnalysis: aiPair.answer ? {
              sentence: String(aiPair.answer.sentence || p.answerText),
              words: sanitizeWords(aiPair.answer.words),
            } : null,
          };
        });
        // Keep any empty pairs that weren't sent to AI
        const emptyPairs = pairs.filter(p => !p.questionText.trim() || !p.answerText.trim());
        setPairs([...updated, ...emptyPairs]);
        setAnalyzed(true);
      } else {
        setError('AI returned unexpected format. Try again.');
      }
    } catch (e) {
      setError(`Analysis failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    setAnalyzing(false);
  }, [pairs]);

  const analyzeFullNote = useCallback(async () => {
    if (!fullNoteText.trim()) return;
    if (!isAIConfigured()) { setError('AI provider not configured. Go to Settings to set up.'); return; }

    setAnalyzing(true);
    setError('');
    setSaved(false);

    try {
      const prompt = `You are a Japanese language analysis tool. Analyze each Japanese sentence word-by-word.

For each word/morpheme, classify it as one of:
- "verb" — action words including conjugated forms (います, 行きます, 食べます, いきません)
- "particle" — は, が, を, に, で, へ, と, も, の, か, etc.
- "place" — location nouns (カフェ, 図書館, 大学, うち, コンビニ)
- "time" — time/frequency words (よく, あまり, 毎日, なんじごろ, ごごの)
- "object" — object nouns, things acted upon (本, ごはん, 日本語, コーヒー)
- "adjective" — descriptive words (大きい, きれい, 新しい)
- "adverb" — modifying words (とても, もう, まだ)
- "greeting" — set phrases (はい, いいえ, ええ, すみません)
- "other" — copula です, conjunctions, etc.

For each word provide: the word as written, hiragana reading, romaji, and English meaning.

Text to analyze (treat each line as a separate sentence):
${fullNoteText}

Return ONLY valid JSON:
{
  "sentences": [
    {
      "sentence": "original sentence",
      "words": [{ "word": "よく", "reading": "よく", "romaji": "yoku", "meaning": "often", "type": "time" }]
    }
  ]
}`;

      const response = await callAI([{ role: 'user', content: prompt }], { json: true, maxTokens: 4096 });
      let jsonStr = response.trim();
      const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlock) jsonStr = codeBlock[1].trim();
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) jsonStr = objMatch[0];
      const parsed = JSON.parse(jsonStr);

      if (parsed.sentences && Array.isArray(parsed.sentences)) {
        const validTypes = Object.keys(JP_WORD_COLORS);
        const results: JpSentenceAnalysis[] = parsed.sentences.map((s: Record<string, unknown>) => ({
          sentence: String(s.sentence || ''),
          words: ((s.words as Record<string, unknown>[]) || []).map(w => ({
            word: String(w.word || ''),
            reading: String(w.reading || ''),
            romaji: String(w.romaji || ''),
            meaning: String(w.meaning || ''),
            type: (validTypes.includes(String(w.type)) ? w.type : 'other') as JpWordType,
          })),
        }));
        setFullNoteAnalysis(results);
        setAnalyzed(true);
      } else {
        setError('AI returned unexpected format. Try again.');
      }
    } catch (e) {
      setError(`Analysis failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    setAnalyzing(false);
  }, [fullNoteText]);

  const saveToLibrary = useCallback(() => {
    if (!data || !analyzed) return;
    const aiHtml = mode === 'fullnote' ? generateFullNoteHtml(fullNoteAnalysis, titleInput) : generateStudyHtml(pairs, titleInput);
    let html = pastedHtml.trim() || aiHtml;
    // Ensure pasted HTML starts with a tag so Library detects it as HTML
    if (html && !html.startsWith('<')) html = `<div>${html}</div>`;
    const note: Note = {
      id: `jp-study-${Date.now()}`,
      title: titleInput || `Japanese Study — ${new Date().toLocaleDateString()}`,
      content: html,
      folder: 'AI Outputs',
      tags: ['japanese', 'language-study'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output',
    };
    const existing = (data.pluginData as Record<string, unknown>).notes as Note[] | undefined || [];
    updatePluginData({ notes: [...existing, note] });
    setSaved(true);
  }, [data, updatePluginData, analyzed, pairs, titleInput, pastedHtml, mode, fullNoteAnalysis]);

  const previewHtml = analyzed
    ? (mode === 'fullnote' ? generateFullNoteHtml(fullNoteAnalysis, titleInput) : generateStudyHtml(pairs, titleInput))
    : '';

  return (
    <div>
      {/* Input Section */}
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Languages size={18} /> Japanese Study Notes
        </div>

        <input
          style={{ ...inputStyle, marginBottom: 12 }}
          placeholder="Note title (e.g. Chapter 6 Dialogue)"
          value={titleInput}
          onChange={e => setTitleInput(e.target.value)}
        />

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button
            onClick={() => { setMode('pairs'); setAnalyzed(false); }}
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: mode === 'pairs' ? 'var(--accent)' : 'var(--bg-primary)',
              color: mode === 'pairs' ? '#fff' : 'var(--text-muted)',
            }}
          >Q&A Pairs</button>
          <button
            onClick={() => { setMode('fullnote'); setAnalyzed(false); }}
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: mode === 'fullnote' ? 'var(--accent)' : 'var(--bg-primary)',
              color: mode === 'fullnote' ? '#fff' : 'var(--text-muted)',
            }}
          >Full Note</button>
        </div>

        {mode === 'pairs' ? (
          <>
            {pairs.map((pair, idx) => (
              <div key={pair.id} style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: 12, marginBottom: 10, background: 'var(--bg-primary)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>Pair {idx + 1}</span>
                  {pairs.length > 1 && (
                    <button onClick={() => removePair(pair.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', padding: 4,
                    }}><Trash2 size={14} /></button>
                  )}
                </div>
                <textarea
                  style={{ ...inputStyle, minHeight: 50, marginBottom: 8, resize: 'vertical' }}
                  placeholder="Question (Japanese) e.g. よく カフェ に いきますか"
                  value={pair.questionText}
                  onChange={e => updatePair(pair.id, 'questionText', e.target.value)}
                />
                <textarea
                  style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
                  placeholder="Answer (Japanese) e.g. いいえ、あまり カフェ に いきません"
                  value={pair.answerText}
                  onChange={e => updatePair(pair.id, 'answerText', e.target.value)}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={addPair} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={14} /> Add Pair
              </button>
            </div>
          </>
        ) : (
          <textarea
            style={{ ...inputStyle, minHeight: 150, marginBottom: 12, resize: 'vertical' }}
            placeholder="Paste your entire Japanese note here (one sentence per line)&#10;&#10;e.g.&#10;よく カフェ に いきますか&#10;いいえ、あまり カフェ に いきません&#10;毎日 日本語 を 勉強します"
            value={fullNoteText}
            onChange={e => setFullNoteText(e.target.value)}
          />
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={mode === 'fullnote' ? analyzeFullNote : analyzeWithAI}
            className="btn btn-primary"
            disabled={analyzing || (mode === 'pairs' ? !pairs.some(p => p.questionText.trim() && p.answerText.trim()) : !fullNoteText.trim())}
            style={{ flex: 1, padding: 12, fontWeight: 700 }}
          >
            {analyzing ? 'Analyzing...' : 'Analyze & Generate'}
          </button>
          <button
            onClick={() => {
              const colorInstructions = `Analyze each Japanese sentence word-by-word and return the result as color-coded study notes.

For each word/morpheme, classify it as one of these types and use the corresponding background color in a <mark> tag:
- "verb" (Red #fecaca) — action words including conjugated forms (います, 行きます, 食べます)
- "particle" (Blue #bfdbfe) — は, が, を, に, で, へ, と, も, の, か, etc.
- "place" (Green #bbf7d0) — location nouns (カフェ, 図書館, 大学, うち)
- "time" (Yellow #fef08a) — time/frequency words (よく, あまり, 毎日, なんじごろ)
- "object" (Purple #ddd6fe) — object nouns, things acted upon (本, ごはん, 日本語)
- "adjective" (Orange #fed7aa) — descriptive words (大きい, きれい, 新しい)
- "adverb" (Pink #fbcfe8) — modifying words (とても, もう, まだ)
- "greeting" (Teal #99f6e4) — set phrases (はい, いいえ, ええ, すみません)
- "other" (Gray #d1d5db) — copula です, conjunctions, etc.

For each sentence:
1. Show the sentence with each word wrapped in <mark style="background-color:[color]"> tags
2. Below the sentence, show a breakdown line with colored circle emoji + (romaji / meaning)

Include a color legend at the top.`;

              if (mode === 'fullnote') {
                if (!fullNoteText.trim()) return;
                const prompt = `${colorInstructions}\n\nHere is my full note (each line is a sentence):\n${fullNoteText}`;
                copyText(prompt);
              } else {
                const validPairs = pairs.filter(p => p.questionText.trim() && p.answerText.trim());
                if (validPairs.length === 0) return;
                const prompt = `${colorInstructions}\n\nFormat as a Q&A table.\n\nHere are my Q&A pairs:\n${validPairs.map((p, i) => `Q${i + 1}: ${p.questionText}\nA${i + 1}: ${p.answerText}`).join('\n')}`;
                copyText(prompt);
              }
              setCopiedPrompt(true);
              setTimeout(() => setCopiedPrompt(false), 2000);
            }}
            className="btn btn-secondary"
            disabled={mode === 'pairs' ? !pairs.some(p => p.questionText.trim() && p.answerText.trim()) : !fullNoteText.trim()}
            style={{ padding: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Copy size={14} /> {copiedPrompt ? 'Copied!' : 'Copy Prompt'}
          </button>
        </div>

        {/* Extra prompt copy buttons for other study formats */}
        {(mode === 'pairs' ? pairs.some(p => p.questionText.trim() && p.answerText.trim()) : fullNoteText.trim()) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Quiz', 'Match', 'Fill-in-Blank'].map(type => (
              <button
                key={type}
                onClick={() => {
                  const textBlock = mode === 'fullnote'
                    ? `Japanese text:\n${fullNoteText}`
                    : `Q&A Pairs:\n${pairs.filter(p => p.questionText.trim() && p.answerText.trim()).map((p, i) => `Q${i + 1}: ${p.questionText}\nA${i + 1}: ${p.answerText}`).join('\n')}`;
                  const prompts: Record<string, string> = {
                    'Quiz': `Generate flashcard-style quiz questions from this Japanese text. For each sentence, create:\n1. A question card (front) with the Japanese sentence\n2. An answer card (back) with: romaji reading, English translation, and key grammar notes\n\nFormat as a numbered list of flashcards.\n\n${textBlock}`,
                    'Match': `Create a matching exercise from this Japanese text. Generate two columns:\n- Column A: Japanese words/phrases extracted from the sentences\n- Column B: Their English meanings (shuffled order)\n\nStudents must draw lines to match each Japanese term with its English meaning. Include 10-15 terms.\n\n${textBlock}`,
                    'Fill-in-Blank': `Create a fill-in-the-blank worksheet from this Japanese text. For each sentence:\n1. Remove one key word (verb, object, or particle) and replace with a blank ____\n2. Provide the answer and a hint (e.g. word type or English meaning)\n3. Include romaji for the full sentence at the bottom as an answer key\n\n${textBlock}`,
                  };
                  copyText(prompts[type]);
                  setCopiedPrompt(true);
                  setTimeout(() => setCopiedPrompt(false), 2000);
                }}
                className="btn btn-sm btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
              >
                <Copy size={12} /> {type} Prompt
              </button>
            ))}
          </div>
        )}

        {/* Paste AI Response toggle */}
        <button
          onClick={() => setPasteMode(!pasteMode)}
          className="btn btn-sm btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 4 }}
        >
          <ClipboardPaste size={13} /> {pasteMode ? 'Hide Paste Area' : 'Paste AI Response'}
        </button>

        {pasteMode && (
          <div style={{ marginTop: 8 }}>
            <textarea
              value={pastedHtml}
              onChange={e => setPastedHtml(e.target.value)}
              placeholder="Paste the AI-generated HTML response here (from ChatGPT, Claude, etc.)..."
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
            {pastedHtml.trim() && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setAnalyzed(true); setPasteMode(false); }}
                  className="btn btn-sm btn-primary"
                  style={{ fontWeight: 700 }}
                >
                  Preview & Use
                </button>
                <button
                  onClick={() => { setPastedHtml(''); }}
                  className="btn btn-sm btn-secondary"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {!isAIConfigured() && !pasteMode && (
          <p className="text-xs text-muted" style={{ marginTop: 8, textAlign: 'center' }}>
            Requires AI provider — configure in Settings, or use "Copy Prompt" to paste into any AI chat
          </p>
        )}
        {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Preview */}
      {analyzed && (previewHtml || pastedHtml) && (
        <div className="card mb-3">
          <div className="card-title mb-3">Preview</div>
          <div
            style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', overflow: 'auto' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(pastedHtml.trim() || previewHtml) }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => copyText(pastedHtml.trim() || previewHtml)} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Copy size={14} /> Copy HTML
            </button>
            <button onClick={saveToLibrary} className="btn btn-sm btn-primary" disabled={saved} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Save size={14} /> {saved ? 'Saved!' : 'Save to Library'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analyzed && !analyzing && (
        <div className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>
          <Languages size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p className="text-sm">Enter Japanese Q&A pairs to generate color-coded study notes</p>
          <p className="text-xs text-muted" style={{ marginTop: 8 }}>
            Words are color-coded by type: verbs, particles, places, time expressions, objects
          </p>
        </div>
      )}
    </div>
  );
}

export default function JpStudyToolWrapped() {
  return (
    <ToolErrorBoundary toolName="JP Study">
      <NihongoStudyTool />
    </ToolErrorBoundary>
  );
}
