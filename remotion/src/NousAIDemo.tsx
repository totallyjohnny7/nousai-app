import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion';

// ── Color palette matching NousAI's dark theme
const COLORS = {
  bg: '#0a0a0a',
  card: '#141414',
  border: '#2a2a2a',
  accent: '#6366f1',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  red: '#ef4444',
  text: '#f1f5f9',
  muted: '#64748b',
};

// ── Scene 1 (0–150): Logo + tagline fade-in
function Scene1() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOpacity = spring({ frame, fps, config: { damping: 80, stiffness: 120 } });
  const taglineOpacity = interpolate(frame, [30, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame, [30, 80], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      {/* Logo mark */}
      <div style={{
        opacity: logoOpacity,
        width: 80,
        height: 80,
        borderRadius: 20,
        background: `linear-gradient(135deg, ${COLORS.accent}, #8b5cf6)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        boxShadow: `0 0 60px ${COLORS.accent}60`,
      }}>
        <span style={{ fontSize: 40, fontWeight: 900, color: 'white', fontFamily: 'sans-serif' }}>N</span>
      </div>

      {/* Brand name */}
      <div style={{
        opacity: logoOpacity,
        fontSize: 52,
        fontWeight: 900,
        color: COLORS.text,
        fontFamily: 'sans-serif',
        letterSpacing: -1,
        marginBottom: 12,
      }}>
        NousAI
      </div>

      {/* Tagline */}
      <div style={{
        opacity: taglineOpacity,
        transform: `translateY(${taglineY}px)`,
        fontSize: 22,
        color: COLORS.muted,
        fontFamily: 'sans-serif',
        fontWeight: 400,
      }}>
        Your AI-powered study companion
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 2 (150–450): Dashboard XP animation
function Scene2() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const xp = Math.round(interpolate(frame, [0, 180], [0, 1250], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const level = xp >= 1000 ? 6 : xp >= 750 ? 5 : 4;
  const xpProgress = ((xp % 250) / 250) * 100;

  const cardOpacity = spring({ frame, fps, config: { damping: 60 } });
  const statsScale = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 70 } });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      {/* Dashboard card */}
      <div style={{
        opacity: cardOpacity,
        width: '100%',
        maxWidth: 600,
        background: COLORS.card,
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        padding: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: 'sans-serif', marginBottom: 4 }}>LEVEL</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              {/* Level badge */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${COLORS.accent}, #8b5cf6)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 900,
                color: 'white',
                fontFamily: 'sans-serif',
              }}>
                {level}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, fontFamily: 'sans-serif' }}>{xp} XP</div>
                <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: 'sans-serif' }}>Scholar</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 48 }}>🎓</div>
        </div>

        {/* XP Progress bar */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.muted, fontFamily: 'sans-serif' }}>Progress to Level {level + 1}</span>
            <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: 'sans-serif' }}>{Math.round(xpProgress)}%</span>
          </div>
          <div style={{ height: 8, background: COLORS.border, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${xpProgress}%`,
              background: `linear-gradient(90deg, ${COLORS.accent}, #8b5cf6)`,
              borderRadius: 4,
              transition: 'width 0.1s',
            }} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 24,
          transform: `scale(${statsScale})`,
        }}>
          {[
            { label: 'Streak', value: '7 days', icon: '🔥', color: COLORS.yellow },
            { label: 'Quizzes', value: '42', icon: '📝', color: COLORS.blue },
            { label: 'Cards Due', value: '18', icon: '🃏', color: COLORS.green },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1,
              background: COLORS.bg,
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              padding: '12px 16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, fontFamily: 'sans-serif' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: 'sans-serif' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 3 (450–660): Quiz question with animated options
function Scene3() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const questionOpacity = spring({ frame, fps, config: { damping: 80 } });
  const scoreCount = Math.round(interpolate(frame, [60, 150], [0, 3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));

  const options = [
    { text: 'Mitochondria', correct: true },
    { text: 'Nucleus', correct: false },
    { text: 'Ribosome', correct: false },
    { text: 'Golgi apparatus', correct: false },
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* Score */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 14, color: COLORS.muted, fontFamily: 'sans-serif' }}>Quiz — Biology 101</div>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.green,
            fontFamily: 'sans-serif',
            background: `${COLORS.green}22`,
            padding: '4px 12px',
            borderRadius: 20,
          }}>
            {scoreCount}/4 ✓
          </div>
        </div>

        {/* Question */}
        <div style={{
          opacity: questionOpacity,
          background: COLORS.card,
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
          padding: 28,
          marginBottom: 16,
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.text,
          fontFamily: 'sans-serif',
          lineHeight: 1.5,
        }}>
          Which organelle is known as the "powerhouse of the cell"?
        </div>

        {/* Options */}
        {options.map((opt, i) => {
          const optOpacity = interpolate(frame, [i * 15 + 10, i * 15 + 35], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const optX = interpolate(frame, [i * 15 + 10, i * 15 + 35], [30, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const isSelected = i === 0 && frame > 80;
          return (
            <div key={i} style={{
              opacity: optOpacity,
              transform: `translateX(${optX}px)`,
              background: isSelected ? `${COLORS.green}22` : COLORS.card,
              border: `1px solid ${isSelected ? COLORS.green : COLORS.border}`,
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 8,
              fontSize: 15,
              color: isSelected ? COLORS.green : COLORS.text,
              fontFamily: 'sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                border: `2px solid ${isSelected ? COLORS.green : COLORS.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: isSelected ? COLORS.green : COLORS.muted,
                flexShrink: 0,
              }}>
                {isSelected ? '✓' : String.fromCharCode(65 + i)}
              </span>
              {opt.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 4 (660–840): Flashcard flip
function Scene4() {
  const frame = useCurrentFrame();

  // Each card: show front (0–50), flip at 50, show back (50–120), pause, next card
  const cardIndex = frame < 120 ? 0 : frame < 240 ? 1 : 2;
  const localFrame = frame % 120;
  const flipProgress = interpolate(localFrame, [30, 60], [0, 180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const showBack = flipProgress > 90;

  const cards = [
    { front: 'What is photosynthesis?', back: 'Process by which plants convert light → glucose using CO₂ and H₂O', grade: 'Good' },
    { front: 'Define osmosis', back: 'Movement of water across a semi-permeable membrane from low → high solute concentration', grade: 'Easy' },
    { front: 'What is the Central Dogma?', back: 'DNA → RNA → Protein (transcription then translation)', grade: 'Hard' },
  ];

  const card = cards[Math.min(cardIndex, cards.length - 1)];
  const gradeColors: Record<string, string> = { Easy: COLORS.green, Good: COLORS.blue, Hard: COLORS.red };

  const containerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 60, opacity: containerOpacity }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ fontSize: 13, color: COLORS.muted, fontFamily: 'sans-serif', marginBottom: 16, textAlign: 'center' }}>
          Spaced Repetition — Card {cardIndex + 1} of 3
        </div>

        {/* Card with 3D flip */}
        <div style={{
          perspective: 1000,
          marginBottom: 20,
        }}>
          <div style={{
            position: 'relative',
            height: 200,
            transformStyle: 'preserve-3d',
            transform: `rotateY(${flipProgress}deg)`,
            transition: 'transform 0.05s',
          }}>
            {/* Front */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              background: COLORS.card,
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
            }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.text, fontFamily: 'sans-serif', textAlign: 'center' }}>
                {card.front}
              </div>
            </div>

            {/* Back */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: `linear-gradient(135deg, ${COLORS.card}, #1a1a2e)`,
              borderRadius: 16,
              border: `1px solid ${COLORS.accent}60`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
            }}>
              <div style={{ fontSize: 16, color: COLORS.text, fontFamily: 'sans-serif', textAlign: 'center', lineHeight: 1.6 }}>
                {card.back}
              </div>
            </div>
          </div>
        </div>

        {/* FSRS grade buttons (visible after flip) */}
        {showBack && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {(['Hard', 'Good', 'Easy'] as const).map(g => (
              <div key={g} style={{
                flex: 1,
                padding: '10px 0',
                background: g === card.grade ? `${gradeColors[g]}30` : COLORS.card,
                border: `1px solid ${g === card.grade ? gradeColors[g] : COLORS.border}`,
                borderRadius: 10,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: g === card.grade ? 700 : 400,
                color: g === card.grade ? gradeColors[g] : COLORS.muted,
                fontFamily: 'sans-serif',
              }}>
                {g}
              </div>
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ── Scene 5 (840–900): CTA
function Scene5() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 60, stiffness: 100 } });
  const urlOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{
        transform: `scale(${scale})`,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 48,
          fontWeight: 900,
          color: COLORS.text,
          fontFamily: 'sans-serif',
          marginBottom: 12,
          background: `linear-gradient(135deg, ${COLORS.text}, ${COLORS.accent})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Study Smarter
        </div>
        <div style={{
          fontSize: 20,
          color: COLORS.muted,
          fontFamily: 'sans-serif',
          marginBottom: 32,
        }}>
          AI quizzes · Flashcards · Smart scheduling
        </div>
        <div style={{
          opacity: urlOpacity,
          display: 'inline-block',
          padding: '14px 32px',
          background: COLORS.accent,
          borderRadius: 50,
          fontSize: 18,
          fontWeight: 700,
          color: 'white',
          fontFamily: 'sans-serif',
          letterSpacing: 0.5,
        }}>
          nousai-app.vercel.app
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Root composition
export const NousAIDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Scene 1: 0–150 */}
      <Sequence from={0} durationInFrames={150}>
        <Scene1 />
      </Sequence>

      {/* Scene 2: 150–450 */}
      <Sequence from={150} durationInFrames={300}>
        <Scene2 />
      </Sequence>

      {/* Scene 3: 450–660 */}
      <Sequence from={450} durationInFrames={210}>
        <Scene3 />
      </Sequence>

      {/* Scene 4: 660–840 */}
      <Sequence from={660} durationInFrames={180}>
        <Scene4 />
      </Sequence>

      {/* Scene 5: 840–900 */}
      <Sequence from={840} durationInFrames={60}>
        <Scene5 />
      </Sequence>
    </AbsoluteFill>
  );
};
