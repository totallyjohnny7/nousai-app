import { useState, useRef, useMemo } from 'react';
import { Mic, MicOff, Globe, AlertCircle, Copy, Save, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import type { Note } from '../../types';
import { uid, copyText, selectStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

function DictateTool() {
  const { data, updatePluginData } = useStore();
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [saved, setSaved] = useState(false);
  const recognitionRef = useRef<any>(null);

  const available = useMemo(() => {
    return typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }, []);

  function startListening() {
    if (!available) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t;
        } else {
          interimText += t;
        }
      }
      if (finalText) {
        setTranscript(prev => prev + (prev ? ' ' : '') + finalText);
        setSaved(false);
        setInterim('');
      } else {
        setInterim(interimText);
      }
    };

    recognition.onerror = () => {
      setListening(false);
      setInterim('');
    };

    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setInterim('');
  }

  function saveToLibrary() {
    if (!transcript || !data) return;
    const note: Note = {
      id: uid(),
      title: `Dictation — ${new Date().toLocaleDateString()}`,
      content: transcript,
      folder: 'AI Tools',
      tags: ['dictation', language],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output' as const,
    };
    const notes = [...(data.pluginData?.notes || []), note];
    updatePluginData({ notes });
    setSaved(true);
  }

  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'zh-CN', name: 'Chinese' },
    { code: 'ko-KR', name: 'Korean' },
    { code: 'pt-BR', name: 'Portuguese' },
    { code: 'it-IT', name: 'Italian' },
    { code: 'ru-RU', name: 'Russian' },
    { code: 'ar-SA', name: 'Arabic' },
    { code: 'hi-IN', name: 'Hindi' },
  ];

  return (
    <div>
      {!available && (
        <div className="card mb-3" style={{ borderColor: 'var(--red)', borderWidth: 1 }}>
          <p className="text-sm" style={{ color: 'var(--red)' }}>
            <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Speech recognition not supported. Try Chrome or Edge.
          </p>
        </div>
      )}

      <div className="card mb-3">
        <div className="card-title mb-3">
          <Mic size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Speech to Text
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2 mb-3">
          <Globe size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={selectStyle}
            disabled={listening}
          >
            {languages.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Record button */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button
            onClick={listening ? stopListening : startListening}
            disabled={!available}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              border: `3px solid ${listening ? 'var(--red)' : 'var(--accent)'}`,
              background: listening ? 'var(--red-dim)' : 'var(--accent-glow)',
              color: listening ? 'var(--red)' : 'var(--accent)',
              cursor: available ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s',
              animation: listening ? 'pulse 1.5s infinite' : 'none',
            }}
          >
            {listening ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          <p className="text-xs text-muted" style={{ marginTop: 8 }}>
            {listening ? 'Tap to stop recording' : 'Tap to start recording'}
          </p>
        </div>

        {/* Transcript display */}
        <div style={{
          minHeight: 120, padding: 12, border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
          fontSize: 14, lineHeight: 1.7, marginBottom: 12,
        }}>
          {transcript || <span className="text-muted">Transcript will appear here...</span>}
          {interim && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> {interim}</span>}
        </div>

        <div className="flex gap-2">
          <button className="btn btn-sm btn-secondary" onClick={() => copyText(transcript)} disabled={!transcript}>
            <Copy size={14} /> Copy
          </button>
          <button className="btn btn-sm btn-secondary" onClick={saveToLibrary} disabled={!transcript || saved}>
            <Save size={14} /> {saved ? 'Saved!' : 'Save to Library'}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => { setTranscript(''); setInterim(''); }}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {listening && (
        <div className="text-center text-sm" style={{ color: 'var(--green)' }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%', background: 'var(--green)',
            display: 'inline-block', marginRight: 6, animation: 'pulse 1s infinite',
          }} />
          Listening...
        </div>
      )}
    </div>
  );
}

export default function DictateToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Dictate">
      <DictateTool />
    </ToolErrorBoundary>
  );
}
