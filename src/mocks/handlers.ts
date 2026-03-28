/**
 * MSW Request Handlers — Mock AI responses for testing
 *
 * Usage:
 *   1. In browser console: localStorage.setItem('NOUSAI_MOCK_AI', 'true')
 *   2. Reload the app
 *   3. All OpenRouter AI calls return deterministic mock responses
 *   4. To disable: localStorage.removeItem('NOUSAI_MOCK_AI')
 */
import { http, HttpResponse } from 'msw';

// ─── Omni Protocol V6 — Session Plan ─────────────────────────
const mockSessionPlan = {
  sessionId: 'mock-session-001',
  duration: 90,
  cycles: [
    {
      cycleNumber: 1,
      bloomsLevel: 'Remember',
      phases: [
        { type: 'prime', title: 'Prime', minutes: 5, content: 'Review key concepts and activate prior knowledge. Focus on definitions and core terminology.' },
        { type: 'chunk', title: 'Chunk', minutes: 8, content: 'Break material into digestible segments. Identify 3-4 main ideas from your selected topics.' },
        { type: 'encode', title: 'Encode', minutes: 10, content: 'Create visual representations — mind maps, diagrams, or sketch notes for each chunk.' },
        { type: 'connect', title: 'Connect', minutes: 7, content: 'Link new concepts to existing knowledge. WHY does this matter? What breaks without it?' },
        { type: 'break', title: 'Break', minutes: 3, content: 'Rest. Walk, stretch, hydrate.' },
        { type: 'test', title: 'Test', minutes: 8, content: 'Self-test with flashcards. Grade honestly using FSRS ratings.' },
        { type: 'anchor', title: 'Anchor', minutes: 5, content: 'Summarize cycle in your own words. Identify one Feynman gap.' },
        { type: 'report', title: 'Report', minutes: 2, content: 'Log accuracy, confidence, and gaps.' },
      ],
    },
    {
      cycleNumber: 2,
      bloomsLevel: 'Understand',
      phases: [
        { type: 'prime', title: 'Prime', minutes: 4, content: 'Review gaps from Cycle 1. What needs reinforcement?' },
        { type: 'chunk', title: 'Chunk', minutes: 7, content: 'Go deeper — explore relationships between concepts.' },
        { type: 'encode', title: 'Encode', minutes: 10, content: 'Dual-code: pair verbal explanations with visual diagrams.' },
        { type: 'connect', title: 'Connect', minutes: 8, content: 'Cross-topic connections. How do these ideas interact in real scenarios?' },
        { type: 'break', title: 'Break', minutes: 3, content: 'Rest.' },
        { type: 'test', title: 'Test', minutes: 10, content: 'Application questions — not just recall, but "what if" scenarios.' },
        { type: 'anchor', title: 'Anchor', minutes: 5, content: 'Teach the material to an imaginary student. Where do you stumble?' },
        { type: 'report', title: 'Report', minutes: 2, content: 'Final assessment and next steps.' },
      ],
    },
  ],
  arcPhase: 'Foundation',
  motivation: { level: 'high', streak: 3 },
};

// ─── Omni Protocol V6 — Final Report ─────────────────────────
const mockFinalReport = `## Session Complete

### Performance Summary
- **Accuracy**: 78% across 2 cycles
- **Bloom's Progression**: Remember → Understand (on track)
- **Feynman Gaps Identified**: 2

### Strengths
- Strong recall of core definitions
- Good visual encoding — your diagrams captured key relationships

### Areas for Next Session
1. **Gap**: Mechanism of enzyme catalysis — review lock-and-key vs induced fit
2. **Gap**: Signal transduction pathway ordering — practice sequencing

### Recommended Next Session
- Duration: 90 min
- Focus: Application-level questions on identified gaps
- Suggested arc phase: BuildUp`;

// ─── Study Guide Summary ──────────────────────────────────────
const mockGuideSummary = {
  summary: 'This study guide covers cellular respiration, focusing on glycolysis, the citric acid cycle, and oxidative phosphorylation. Key themes include energy conversion, electron transport, and ATP synthesis.',
  keywords: ['glycolysis', 'citric acid cycle', 'oxidative phosphorylation', 'ATP synthase', 'electron transport chain', 'NADH', 'FADH2'],
  mainTopics: ['Glycolysis', 'Citric Acid Cycle', 'Electron Transport Chain', 'ATP Synthesis', 'Fermentation'],
};

// ─── MC Pre-Test Questions ────────────────────────────────────
const mockMCQuestions = [
  {
    question: 'Where does glycolysis occur in the cell?',
    options: ['A. Mitochondrial matrix', 'B. Cytoplasm', 'C. Inner mitochondrial membrane', 'D. Nucleus'],
    correct: 1,
    topic: 'Glycolysis',
  },
  {
    question: 'How many ATP molecules are produced per glucose in glycolysis?',
    options: ['A. 36', 'B. 4', 'C. 2 (net)', 'D. 10'],
    correct: 2,
    topic: 'Glycolysis',
  },
  {
    question: 'What is the final electron acceptor in the electron transport chain?',
    options: ['A. NAD+', 'B. FAD', 'C. Oxygen', 'D. Carbon dioxide'],
    correct: 2,
    topic: 'Electron Transport Chain',
  },
];

// ─── Crisis Mode Plan ─────────────────────────────────────────
const mockCrisisPlan = {
  day1: {
    focus: 'Triage & Foundation',
    sessions: [
      { duration: 45, topics: ['Glycolysis', 'Citric Acid Cycle'], strategy: 'Rapid recall + mnemonic anchors' },
      { duration: 45, topics: ['Electron Transport Chain'], strategy: 'Visual encoding + process mapping' },
    ],
  },
  day2: {
    focus: 'Application & Gaps',
    sessions: [
      { duration: 45, topics: ['ATP Synthesis', 'Fermentation'], strategy: 'Practice problems + edge cases' },
      { duration: 30, topics: ['All topics'], strategy: 'Full mock test + gap review' },
    ],
  },
};

// ─── Generic AI Response (for callAI) ─────────────────────────
const mockGenericResponse = 'This is a mock AI response for testing. The AI service is being simulated by MSW (Mock Service Worker). All features should behave normally — only the AI content is replaced with deterministic test data.';

// ─── Flashcard Generation ─────────────────────────────────────
const mockFlashcards = [
  { q: 'What is the net ATP yield of glycolysis?', a: '2 ATP per glucose molecule (gross: 4 ATP, minus 2 ATP investment phase)' },
  { q: 'Name the 3 irreversible enzymes in glycolysis', a: 'Hexokinase, Phosphofructokinase-1 (PFK-1), Pyruvate kinase' },
  { q: 'What connects glycolysis to the citric acid cycle?', a: 'Pyruvate dehydrogenase complex — converts pyruvate to acetyl-CoA' },
];

// ─── Request Handlers ─────────────────────────────────────────
export const handlers = [
  // OpenRouter API — catch all chat completions
  http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
    const body = (await request.json()) as { messages?: Array<{ content: string }> };
    const lastMessage = body.messages?.[body.messages.length - 1]?.content || '';

    // Route to appropriate mock based on prompt content
    let responseContent: string;

    if (lastMessage.includes('session plan') || lastMessage.includes('SESSION_PLAN')) {
      responseContent = '```json\n' + JSON.stringify(mockSessionPlan, null, 2) + '\n```';
    } else if (lastMessage.includes('final report') || lastMessage.includes('FINAL_REPORT')) {
      responseContent = mockFinalReport;
    } else if (lastMessage.includes('summarize') && lastMessage.includes('study guide')) {
      responseContent = JSON.stringify(mockGuideSummary);
    } else if (lastMessage.includes('multiple choice') || lastMessage.includes('pre-test')) {
      responseContent = JSON.stringify(mockMCQuestions);
    } else if (lastMessage.includes('crisis') && lastMessage.includes('plan')) {
      responseContent = JSON.stringify(mockCrisisPlan);
    } else if (lastMessage.includes('flashcard')) {
      responseContent = JSON.stringify(mockFlashcards);
    } else {
      responseContent = mockGenericResponse;
    }

    return HttpResponse.json({
      id: 'mock-completion-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'mock/test-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: responseContent },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    });
  }),

  // OpenRouter streaming — return non-streaming response for simplicity
  http.post('https://openrouter.ai/api/v1/chat/completions', async ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('stream') === 'true') {
      return HttpResponse.json({
        id: 'mock-stream-' + Date.now(),
        choices: [{ message: { role: 'assistant', content: mockGenericResponse }, finish_reason: 'stop' }],
      });
    }
  }),
];
