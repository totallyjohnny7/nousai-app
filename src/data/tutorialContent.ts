// ─── Tutorial Content ────────────────────────────────────────────────────────
// Single source of truth for all guide entries.
// Shared between TutorialPage (/tutorial route) and SettingsPage (Guide Hub).
//
// Content standard (every entry must satisfy all three):
//  1. Beginner-friendly — assume zero prior knowledge, spell out every step
//  2. Science-backed    — cite research inline in plain language
//  3. Logic reasoning   — explain WHY, not just how (cause → effect → benefit)
// ─────────────────────────────────────────────────────────────────────────────

export interface TutorialEntry {
  id: string
  title: string
  tldr: string      // 1 sentence — what it is for a total beginner
  content: string   // full guide, \n-formatted, science + reasoning included
  proTip?: string   // rendered in amber callout box
  tags: string[]    // for cross-category search
}

export interface TutorialCategory {
  id: string
  label: string
  icon: string        // emoji
  color: string       // CSS hex for accent strip on cards
  description: string // 1-sentence explanation of what's in this category
  entries: TutorialEntry[]
}

// Compatible shape expected by SettingsPage GuideHubInline
export interface GuideEntry {
  id: string
  title: string
  tldr: string
  content: string
}

// ─── Category 1: Getting Started ────────────────────────────────────────────

const gettingStarted: TutorialEntry[] = [
  {
    id: 'first-steps',
    title: 'Your First 10 Minutes in NousAI',
    tldr: 'A step-by-step walkthrough to go from a blank screen to your first study session in under 10 minutes.',
    tags: ['beginner', 'setup', 'first-time', 'start', 'new', 'onboarding'],
    content: `Welcome! Here is the fastest path from a blank NousAI to your first real study session.

Step 1 — Create your account (2 min)
Go to Settings (⚙️ icon in the sidebar) → "Account & Cloud Sync" → click "Sign Up" → enter your email and a password → click Create Account. This lets NousAI back up your data across devices.
Watch out: Guest mode works but your data lives only on this device. Sign up first so nothing is lost.

Step 2 — Create your first course (1 min)
Tap "LIBRARY" in the sidebar → click the "+ New Course" button → type a name (e.g., "Biology 101") → choose a color → Save.
Why: All your content — flashcards, quizzes, notes — organizes around courses. Every AI tool can filter to a specific course, so creating it first keeps everything tidy from day one.

Step 3 — Add your first flashcards (3 min)
Option A (AI, easiest): Go to "LEARN" → find "Flashcard Generator" → type a topic (e.g., "Cell organelles and their functions") → click Generate → review the cards → click "Save All to Course."
Option B (Manual): Go to "CARDS" → click "+ New Card" → type the front and back → Save.
Start with 10–20 cards, not 100. NousAI shows you 50 cards per day maximum to prevent burnout.

Step 4 — Do your first review (2 min)
Go to "CARDS" → click "Start Review." Each card shows the front side. Try to recall the answer, then tap the card to flip it. Rate how well you remembered:
• 1 = Again → "I had no idea"
• 2 = Hard → "I remembered but struggled"
• 3 = Good → "I remembered normally"
• 4 = Easy → "Instant recall — too easy"

That's it. NousAI now knows which cards to show you tomorrow.

Science: Ebbinghaus (1885) established the forgetting curve — without review, 70% of new information is forgotten within 24 hours. The 1–4 rating drives NousAI's FSRS algorithm, which schedules each card at the exact moment your memory is about to decay, rebuilding the memory trace at maximum efficiency.

Why rate honestly? → FSRS can only schedule correctly if your ratings reflect reality → fake "Easy" ratings delay cards too long → they return weeks later when you've genuinely forgotten.`,
    proTip: `After your first review session, check the Dashboard (HOME). You'll see your streak start, XP earned, and which cards are due tomorrow. The dashboard is your daily command center — visit it every time you open the app.`,
  },
  {
    id: 'ai-setup',
    title: 'Setting Up Your AI Provider (Step by Step)',
    tldr: 'NousAI needs an AI API key to power its tools — here\'s how to get one for free in under 5 minutes.',
    tags: ['ai', 'api', 'setup', 'openai', 'openrouter', 'groq', 'anthropic', 'mistral', 'google', 'key'],
    content: `Most of NousAI's tools (flashcard generation, quizzes, tutoring, analysis) require an AI provider. Think of it as plugging NousAI into a brain. Here's how to choose and connect one.

Which provider should you start with?

Provider       | Cost      | Speed  | Best For
OpenRouter     | FREE tier | Medium | Starting out — Gemini Flash is free
Groq           | FREE tier | Fastest| Rapid flashcard/quiz generation
Google AI      | FREE tier | Fast   | General use, good quality
OpenAI         | ~$5/mo    | Fast   | Most reliable, best all-around
Anthropic      | ~$5/mo    | Medium | Deep analysis, re-explain, tutoring
Mistral        | Required  | Medium | PDF OCR feature only

Recommended for beginners: Start with OpenRouter (free, no credit card needed).

Step-by-step setup for OpenRouter:
1. Go to openrouter.ai in your browser
2. Click "Sign In" → create a free account
3. In the OpenRouter dashboard, click your profile → "API Keys" → "+ Create Key"
4. Copy the key (it starts with "sk-or-...")
5. In NousAI: Settings → "AI Configuration" → set Provider to "OpenRouter"
6. Paste your key into the API Key field
7. Set Model to "google/gemini-flash-1.5" (this is free to use)
8. Click "Test Connection" → wait a few seconds → you should see a green "Connected" badge

What are Feature Slots?
NousAI has 6 AI slots — one per feature category. This lets Chat use a smarter model while Flashcard Gen uses a faster one. For most beginners: just set the top "Chat & Tutor" slot and leave the others blank. They fall back to the top slot automatically.

For PDF OCR specifically: You need a Mistral API key (mistral.ai → dashboard). Set it in the "PDF & Image OCR" slot only.

Science: Research on AI-generated study materials (2024) found that cards written with "one atomic concept per card" produce 30–40% better recall than dense, multi-concept cards. Using a capable model (like Gemini or GPT-4o) specifically for generation improves card quality measurably — this is why Feature Slots exist.`,
    proTip: `Use Groq for the "Generation" slot (flashcards, quizzes) because it's the fastest free option — generation feels instant. Use a smarter model (Gemini Pro, Claude) for the "Analysis" slot where quality matters more than speed.`,
  },
  {
    id: 'what-is-fsrs',
    title: 'What is FSRS? (Plain English Guide)',
    tldr: 'FSRS is the algorithm that decides when to show you each flashcard — it replaces random review with scientific scheduling.',
    tags: ['fsrs', 'spaced repetition', 'algorithm', 'scheduling', 'memory', 'intervals', 'ratings'],
    content: `FSRS stands for "Free Spaced Repetition Scheduler." It's the engine behind NousAI's flashcard system. Here's what it actually does, in plain English.

The core idea:
Every card has two numbers NousAI tracks invisibly:
• Stability — how long your memory of this card will last before it fades
• Difficulty — how hard this card is specifically for you

FSRS uses these two numbers to predict exactly when you'll forget the card, then shows it to you right before that moment. This makes each review maximally efficient.

A helpful analogy:
Imagine each flashcard is a muscle. FSRS is your personal trainer. It knows exactly when each muscle is about to get weak again, and schedules a workout at precisely that moment — not too soon (wasted effort) and not too late (you've already forgotten).

What your ratings mean:
1 = Again — "I completely forgot" → card resets to tomorrow
2 = Hard — "I remembered but it took real effort" → short interval (2-3 days)
3 = Good — "I remembered normally" → interval roughly doubles
4 = Easy — "Instant, effortless recall" → large interval jump (may not see for weeks)

What happens over time (example):
• Day 1: You learn "mitochondria = powerhouse of the cell"
• Day 2: Card reappears. You rate 3 (Good) → next review in 4 days
• Day 6: Card reappears. You rate 3 (Good) → next review in 8 days
• Day 14: Card reappears. Rate 3 again → next review in 20 days
• Eventually: Card only appears every few months — it's in long-term memory

The daily cap:
NousAI shows a maximum of 50 cards per course per day. Why? Research on cognitive load (Sweller, 1988) shows that reviewing too many items in one session overwhelms working memory and reduces retention. 50 cards takes about 15-20 minutes — the optimal study session length.

Science: FSRS is based on Ebbinghaus's forgetting curve (1885) and refined using modern machine learning on millions of review sessions. It achieves 92% retention accuracy — meaning you'll remember 92 out of 100 cards at their scheduled review date.

Why rating honestly matters:
FSRS is a predictive model. If you rate "Easy" when it was "Hard," the model extends the interval too far. The card comes back weeks later when you've actually forgotten. Your ratings are data — the better the data, the better the schedule.`,
    proTip: `If you see 100+ cards due at once (this happens if you skip a few days), don't panic. Just work through them at 50/day. Don't try to review them all in one session — it defeats the memory consolidation effect that sleep provides between sessions.`,
  },
  {
    id: 'cloud-sync',
    title: 'Cloud Sync & Multi-Device Setup',
    tldr: 'How to back up your data and access NousAI from any device — phone, tablet, or computer.',
    tags: ['sync', 'backup', 'cloud', 'multi-device', 'account', 'data', 'firebase'],
    content: `NousAI stores your data on your device by default. Cloud sync backs it up to Firebase and lets you access it from any browser on any device.

Setting up for the first time:
1. Settings → "Account & Cloud Sync" → Sign Up with your email
2. After signing in, click "Sync to Cloud" — this uploads everything
3. On your second device (phone, tablet, etc.): open NousAI → Settings → Account → Sign In with the same email
4. Click "Sync from Cloud" — this downloads your data

After that: Enable "Auto-sync" (toggle in the Account section) and NousAI will sync automatically every 2 minutes whenever changes are detected.

What IS synced:
✓ Flashcards (including FSRS scheduling data)
✓ Quizzes and quiz history
✓ Courses and topics
✓ Notes and drawings
✓ Study progress, XP, streaks
✓ Vocabulary, Cornell notes

What is NOT synced (by design):
✗ API keys (security — never stored in the cloud)
✗ Firebase custom config
✗ Device-specific settings (font size, display theme)
✗ File uploads over the storage limit

Data compression:
Your data is gzip-compressed before uploading (roughly 78% smaller). A typical user's data compresses from ~1.5MB down to ~350KB — well within Firestore's 1MB document limit.

Conflict resolution:
If you edit on two devices while offline, NousAI will detect the conflict when you reconnect and show a "Conflict Resolution" dialog. You'll see both versions and choose which to keep, or merge them.

Watch out: Signing in on a new device and clicking "Sync from Cloud" will REPLACE local data with cloud data. If you have new local data that isn't backed up yet, sync TO cloud first, then sync on the new device.`,
    proTip: `If you share a computer, use the browser's profile feature (Chrome/Firefox) so each person has their own NousAI session and API keys. NousAI doesn't support multiple accounts per browser session.`,
  },
  {
    id: 'mobile-install',
    title: 'Installing NousAI as an App (iOS, Android, Desktop)',
    tldr: 'NousAI is a PWA — install it like a native app on any device for a full-screen experience without an app store.',
    tags: ['pwa', 'install', 'mobile', 'ios', 'android', 'desktop', 'app', 'home screen'],
    content: `NousAI is a Progressive Web App (PWA) — meaning you install it from your browser, not an app store. Once installed, it feels and works like a native app: full screen, works offline, gets updates automatically.

Installing on iPhone / iPad (iOS Safari):
1. Open studynous.com in Safari (must be Safari — Chrome on iOS can't install PWAs)
2. Tap the Share button (the box with an arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Give it a name → tap "Add"
5. The NousAI icon now appears on your home screen — tap it to open in full-screen mode

Installing on Android (Chrome):
1. Open studynous.com in Chrome
2. A banner may appear automatically — tap "Install"
3. If not: tap the three-dot menu → "Add to Home Screen" or "Install App"
4. Tap "Install"

Installing on Desktop (Windows / Mac / Linux, Chrome or Edge):
1. Open studynous.com
2. Look for the install icon (⊕) in the address bar — click it
3. Click "Install"
4. NousAI opens in its own window and appears in your taskbar/dock

Installing on Boox e-ink reader:
Install the Android APK directly (ask for the APK link in Settings → App Info). E-ink mode is built in — Settings → Display → toggle "E-ink Mode" for optimized high-contrast, no-animation rendering.

Why install instead of using the browser tab?
• Full-screen focus — no browser tabs, address bar, or distractions
• Offline access — works even without internet (data is on-device)
• Push notifications for due cards (if you grant notification permission)
• Faster load — cached locally, no network round-trip for the app shell

Watch out: After a NousAI update, you may need to clear the PWA cache to get the new version. If the app looks outdated, go to Settings → Data → "Clear PWA Cache" or open the browser console and run the cache clear command shown in Settings → App Info.`,
    proTip: `On iOS, NousAI has a bottom navigation bar optimized for thumb reach. The main tabs (Home, Learn, Cards, Library) are in the bottom bar; Timer, Calendar, and Settings are in the "More" drawer (tap the ⋯ icon).`,
  },
]

// ─── Category 2: Study Tools ─────────────────────────────────────────────────

const studyTools: TutorialEntry[] = [
  {
    id: 'dashboard',
    title: 'Dashboard Deep Dive: All 4 Tabs',
    tldr: 'Your daily command center — see your progress, manage courses, analyze study habits, and plan your week.',
    tags: ['dashboard', 'home', 'xp', 'streak', 'analytics', 'plan', 'overview', 'widgets'],
    content: `The Dashboard (HOME) is the first thing you see when you open NousAI. It has 4 tabs — here's what each one does.

Tab 1: Overview
Your at-a-glance daily status:
• Streak counter — how many consecutive days you've studied
• XP bar — progress toward your next level
• Due Today — number of flashcards scheduled for today
• Quick Launch — one-tap buttons to start a Pomodoro, open Flashcards, jump to Learn modes
• Weak Topics Radar — a chart showing which subjects need the most attention (based on FSRS data)
• Exam Countdown — if you've set an exam date in your course, shows days remaining
• Spotify widget — shows the currently playing track if Spotify is connected

Tab 2: Courses
All your courses as cards, sorted by recent activity. Tap any course to open its full 20-tab workspace. This tab also shows per-course stats (cards due, completion %, last studied).

Tab 3: Analytics
Deep study analytics:
• Study time heatmap — a GitHub-style grid showing how much you studied each day
• Score trend — quiz scores over time per course
• Proficiency radar — mastery across all your subjects on one chart
• Weekly report — automatically generated summary of your study week

Tab 4: Plan
Your FSRS-aware weekly study planner. Based on how many cards are due each day and your daily goal, the Plan tab suggests how to distribute your study time. You can also add manual study blocks linked to specific courses.

Watch out: The Dashboard updates in real time as you study. If you just finished a review session and your stats haven't updated, pull to refresh or close and reopen the app.`,
    proTip: `Set your daily XP goal in Settings → Study Preferences. The default is 100 XP. Raising it slightly above what you normally earn (by about 20%) creates an "implementation intention" — research shows specific, challenging goals produce 20-25% more output than vague "do your best" goals (Locke & Latham, 2002).`,
  },
  {
    id: 'flashcards-hub',
    title: 'Flashcards Page: The Full Guide',
    tldr: 'Create, review, and manage your flashcard decks — everything from card creation to advanced FSRS analytics.',
    tags: ['flashcards', 'cards', 'review', 'study', 'create', 'edit', 'fsrs', 'analytics', 'starred'],
    content: `The Flashcards page (CARDS in the sidebar) is where you do the actual FSRS-scheduled review. Here's how everything works.

Starting a review session:
Click "Start Review" to begin today's scheduled cards. The page shows you one card at a time — front side first. Think of the answer, then tap the card to flip it. Rate 1–4 honestly (see the FSRS guide for what each number means).

Keyboard shortcuts during review:
• 1 = Again (forgot)
• 2 = Hard
• 3 = Good
• 4 = Easy
• Space = Flip card
• S = Star card (mark for later)

Creating cards manually:
Click "+ New Card" → choose type:
• Standard — front and back (most common)
• Cloze — fill-in-the-blank with {{double braces}} syntax
• Image Occlusion — cover parts of an image

Organizing cards:
Each card belongs to a Course and a Topic (sub-category within the course). Use topics to filter the card list. Example: Course = "Biology 101," Topic = "Cell Division."

The card list view:
Below the review button, you'll see all your cards sorted by next review date. Cards in red = overdue. Cards in green = reviewed today. Click any card to edit it.

Analytics:
Tap the chart icon (📊) to see:
• Mastery per topic — how well you know each section
• FSRS stability distribution — how long each card's interval is
• Leech candidates — cards you keep failing (see the Leeches guide)

Starred cards:
Press S to star any card. Stars create a custom filter — use them for cards you want to revisit or share. Starred cards also show in a separate "Starred" filter at the top of the list.

Watch out: Reviewing more cards than scheduled ("over-reviewing") doesn't hurt, but it does waste time — FSRS optimizes review timing so you get maximum return for minimum time. Trust the schedule.`,
    proTip: `Auto-advance mode (Settings → Study → "Flashcard Auto-flip") automatically flips after 3 seconds. Useful for vocabulary you mostly know. Turn it off for complex material where you genuinely need to think.`,
  },
  {
    id: 'timer-pomodoro',
    title: 'Timer & Pomodoro: Science-Backed Study Intervals',
    tldr: 'Use timed focus sessions to study without burnout — the Pomodoro technique built into NousAI.',
    tags: ['timer', 'pomodoro', 'focus', 'breaks', 'stopwatch', 'session', 'productivity'],
    content: `The Timer page (TIMER in the sidebar or More menu) has two modes: Pomodoro and Stopwatch.

Pomodoro Mode:
The Pomodoro Technique splits study time into focused intervals with regular breaks:
• Work interval: 25 minutes of focused study (customizable)
• Short break: 5 minutes (customizable)
• Long break: 15 minutes after every 4 work intervals

Why it works: The brain maintains focused attention for approximately 20–40 minutes before cognitive performance declines (Ariga & Lleras, 2011). The scheduled break resets your attention system, allowing you to sustain high-quality focus for longer total periods compared to continuous study.

How to use it in NousAI:
1. Go to TIMER
2. Select a course to link this session to (optional, but it adds study time to your analytics)
3. Click Start
4. Study only the linked course or topic during the work interval
5. When the timer ends, take your break — actually take it, don't skip it

Customizing intervals:
Settings → Study Preferences → set Work Time and Break Time to match your focus capacity. A research-backed approach: new learners → 20/10 (shorter work, longer break); experienced studiers → 50/10 (deep work mode).

Stopwatch Mode:
Switch to Stopwatch if you want to track time without structured intervals — useful for problem sets, essays, or lab reports where breaking your concentration would hurt more than help.

Session history:
NousAI logs every timer session. Go to Dashboard → Analytics to see your total study time per day and per course. This data feeds the weekly study report.

Watch out: Don't use Pomodoro for tasks that require extended concentration (e.g., a 3-hour exam practice set). Use Stopwatch instead, or extend the work interval to 50–90 minutes.`,
    proTip: `Link each Pomodoro session to the specific course you're studying. This fills in the study time heatmap on your Dashboard analytics and gives you an accurate picture of where you're actually spending your time — not just where you think you're spending it.`,
  },
  {
    id: 'match-game',
    title: 'Match Game: Vocabulary & Formula Memorization',
    tldr: 'A drag-and-drop matching game that builds vocabulary recognition faster than flashcards alone.',
    tags: ['match', 'game', 'vocabulary', 'drag', 'drop', 'quiz', 'interactive'],
    content: `The Match Game shows a grid of terms and definitions (or questions and answers) that you drag-and-drop to pair correctly.

How to access:
• From your Course Space → "Matches" tab → click any quiz or topic to play
• From the Learn page → "Match Game" tool → select a course

How to play:
Cards appear face-up in a shuffled grid. Drag a term to its matching definition (or click both to match). Matched pairs disappear. Complete the grid as fast as possible — your time is recorded.

Difficulty levels:
• Easy: 6 pairs at a time
• Medium: 8 pairs at a time
• Hard: 12 pairs at a time

Why match games help:
The matching format activates recognition memory — a different memory pathway than recall (used in flashcards). Research by Kornell & Bjork (2008) found that interleaving recognition and recall practice produces better retention than using either alone. Play Match Game BEFORE a flashcard session to prime the relevant memory network, then use flashcards for deeper encoding.

Best uses:
✓ Vocabulary — term → definition pairs
✓ Formulas — formula → description pairs
✓ Anatomy — label → structure pairs
✓ Dates/events — event → date pairs
✗ Complex conceptual understanding (use Feynman or Socratic for that)`,
    proTip: `Play 3 rounds of Match Game before your flashcard review session. The recognition warm-up reduces "first review friction" — cards feel easier on the first pass, which improves your self-assessment accuracy for FSRS ratings.`,
  },
  {
    id: 'gamification',
    title: 'XP, Levels, Streaks & Badges',
    tldr: 'NousAI tracks your progress with a science-backed reward system — no addiction mechanics, just honest motivation.',
    tags: ['xp', 'levels', 'streak', 'badges', 'gamification', 'rewards', 'motivation'],
    content: `NousAI's gamification system is built on behavioral science, not dark patterns. Here's how it works and why.

XP (Experience Points) — earned by:
• Reviewing a flashcard: 5 XP
• Completing a full review session: bonus 10 XP
• Finishing a quiz: 20–100 XP based on score
• Completing a Pomodoro session: 10 XP
• Study streak bonus: +10% XP when your streak is active

Levels:
Every 1,000 XP = 1 level up. Your level is shown on your profile and on the Dashboard. Each level tier unlocks a new title (e.g., "Apprentice Scholar" → "Knowledge Seeker" → "Memory Architect").

Streaks:
A streak = studying at least once every calendar day. Miss a day and it resets. At Level 5, you unlock one "Streak Freeze" item — it protects your streak for one missed day. Use it wisely; it only regenerates after 7 days.

Badges:
Four categories:
• Dedication — awarded for study streaks (7 days, 30 days, 100 days)
• Mastery — awarded for completing courses and achieving high quiz scores
• Speed — awarded for fast flashcard review sessions
• Depth — awarded for using advanced features (Feynman, Visual Lab, Omi)

Why it works:
Self-determination theory (Deci & Ryan, 1985) identifies three pillars of intrinsic motivation: autonomy, competence, and relatedness. XP and levels create a competence feedback loop — visible, measurable progress satisfies the brain's need to feel effective. Unlike engagement-trap mechanics (daily login streaks, artificial urgency), NousAI's system rewards actual learning behaviors.

Watch out: Don't chase XP by doing low-value reviews. FSRS already optimizes for learning efficiency. The gamification layer rewards effort, but the real goal is retention, not numbers.`,
    proTip: `Check the Dashboard → Analytics → "Weekly Report" on Sundays. It shows your XP earned, cards reviewed, quiz scores, and most-studied topics for the week. Use it as a reflection tool: what worked this week, what needs more attention next week.`,
  },
  {
    id: 'leeches',
    title: 'Leech Cards — What They Are & How to Fix Them',
    tldr: 'Leeches are cards you keep failing — NousAI detects them automatically and helps you rewrite or fix them.',
    tags: ['leeches', 'failed cards', 'problem cards', 'review', 'fix', 'suspend', 'rewrite'],
    content: `What is a leech?
A leech is a flashcard you've failed (rated "Again") 4 or more times, OR that has an average recall rate below 50%. These cards eat up disproportionate review time without contributing to learning.

Why leeches are a problem:
The 80/20 principle applies here — typically, 20% of your cards (the leeches) take 80% of your review effort. Worse, they create frustration that can make you avoid studying altogether. Identifying and fixing leeches weekly is one of the highest-leverage study habits.

How to find them:
• Learn page → "Leech Manager" tool
• Flashcards page → Analytics (📊) → "Leeches" tab
Both show you a list of your current leech cards sorted by failure count.

What to do with a leech (three options):
Option 1 — Suspend: Remove it from the review queue temporarily. Do this when a card is outside the current exam scope or when you need to fix it but don't have time now.
Option 2 — AI Rewrite: Click "AI Rewrite" — the AI analyzes why the card is hard and suggests a simpler rewrite or how to split it into two atomic cards. One-concept-per-card is the key principle.
Option 3 — Add Context: Add more information to the back of the card (a mnemonic, a diagram description, or an analogy). Often leeches fail because the card lacks context, not because you can't learn the concept.

The Minimum Information Principle (Wozniak, 1999):
The most common cause of leeches is cards that try to teach too much in one card. "List all functions of the mitochondria" is a leech waiting to happen. Fix: split it into one card per function.

Watch out: Don't delete leeches without trying to fix them. If you delete and later realize you still need that knowledge, you'll have to start from scratch. Suspend first, fix when you have time.`,
    proTip: `Run leech detection once a week. Aim for zero active leeches. If you have 20+ leeches, pause new card creation entirely until you've cleared the backlog — adding new cards on top of broken ones compounds the problem.`,
  },
  {
    id: 'rsvp',
    title: 'RSVP Speed Preview — When & How to Use',
    tldr: 'Flash through an entire deck in minutes to build familiarity before deep study starts.',
    tags: ['rsvp', 'speed', 'preview', 'rapid', 'warmup', 'exposure', 'flashcard'],
    content: `RSVP (Rapid Serial Visual Presentation) shows each flashcard for a brief moment — front and back together — at a configurable speed. It's a warm-up tool, not a replacement for FSRS review.

How to access:
• Learn page → "Speed Preview"
• Flashcards page → top header → "Speed Preview" button

Speed settings:
100 WPM — Slow. Good for complex technical material.
200 WPM — Default. Good for most subjects.
300 WPM — Fast. Good for vocabulary you mostly know.
500 WPM — Very fast. Good for a rapid warm-up on a familiar deck.

Controls:
• Space = Pause / Resume
• → = Skip to next card
• ← = Go back
• Stream Deck buttons = Adjust WPM live (if connected)

When to use RSVP:
✓ Before starting a new deck — reduces first-review overwhelm
✓ Before an exam — rapid exposure refresher in the final hour
✓ When returning after a long break — re-familiarize before deep review
✓ As a 3-minute warm-up at the start of every study session
✗ Not as a substitute for FSRS active recall — always follow with real review

Science: The "familiarization effect" (Tulving, 1983) shows that even passive exposure to material slightly increases recognition on first active recall. Warm-up reduces the cognitive friction of starting a new deck, improving your FSRS rating accuracy on the first pass.

Why RSVP then review?
First exposure through RSVP → active recall in FSRS review → the contrast between "I just saw this" and "can I recall it without seeing it?" activates deeper encoding than review alone.`,
    proTip: `Run RSVP at the START of every study session as a 3-minute warm-up before FSRS review. Research on context-dependent memory shows that re-exposing yourself to material in a quick sweep reduces "cold start" failures and improves FSRS rating accuracy on the first pass of the day.`,
  },
  {
    id: 'type-recall',
    title: 'Type-to-Recall Mode — The Generation Effect',
    tldr: 'Type your answer before seeing it — research shows 40-60% better retention than just flipping cards.',
    tags: ['type', 'recall', 'generation effect', 'typing', 'active recall', 'retention'],
    content: `Type-to-Recall is an optional mode where instead of just flipping the card and rating yourself, you actually TYPE your answer first.

How to enable:
• Press T on any flashcard page, OR
• Settings → Study → "Type-to-Recall Mode" toggle

How it works:
1. Card front is shown
2. A text box appears below it
3. You type your answer
4. Press Enter or click "Check"
5. Your typed answer is shown next to the correct answer
6. Rate 1–4 as usual

AI-assisted grading (optional):
If you have an AI provider configured, enable "AI Grading" in the Type-to-Recall settings. The AI evaluates your typed answer:
• EXACT match → automatically rates 4 (Easy)
• PARTIAL match → rates 2 (Hard) and highlights what was missing
• WRONG → rates 1 (Again) and shows the correct answer

Why it works — the Generation Effect:
The generation effect (Slamecka & Graf, 1978) is one of the most replicated findings in memory research: generating an answer — even an incorrect one — produces 40–60% better long-term retention than passively reading the correct answer. The act of attempting to retrieve something primes the neural pathways involved, making the actual encoding stronger when you finally see the correct answer.

This is also why guessing before reading a textbook chapter helps retention — the incorrect guesses act as "hooks" that make the correct information stick.

Best for:
✓ Language vocabulary (you must produce the word, not just recognize it)
✓ Definitions and formulas
✓ Any subject where you'll be expected to produce answers on an exam (not multiple choice)

Watch out: Type-to-Recall is slower. For a 50-card session, expect it to take 30–40 minutes instead of 15. This is a feature, not a bug — the extra cognitive effort is exactly what creates the retention improvement.`,
    proTip: `Keep AI grading OFF for speed. Use it ON for high-stakes subjects where exact phrasing matters — medical terminology, legal definitions, foreign language grammar. The AI catches partial recalls that your own self-grading might over-credit.`,
  },
  {
    id: 'cloze',
    title: 'Cloze Cards — Fill-in-the-Blank Flashcards',
    tldr: 'Cloze cards hide keywords in a sentence so you must recall them — more effective for contextual learning than front/back cards.',
    tags: ['cloze', 'fill in the blank', 'syntax', 'blanks', 'braces', 'context'],
    content: `A cloze card is a fill-in-the-blank flashcard. Instead of a standalone question, the answer is embedded in a sentence with specific words hidden.

Creating a cloze card:
1. Click "+ New Card" → select type "Cloze"
2. In the Front field, type your sentence and wrap the words to hide in {{double braces}}:
   "The {{mitochondria}} is the {{powerhouse}} of the cell."
3. Back is optional — use it for extra context, images, or explanations

During review:
• Card shows: "The [_____] is the [_____] of the cell."
• Press Space → first blank is revealed: "mitochondria"
• Press Space → second blank is revealed: "powerhouse"
• Back shown (if any) → rate 1–4

Rules for effective cloze cards:
✓ Keep blanks to 1–3 per card — more than 3 becomes a sentence memorization exercise, not concept learning
✓ Only blank key terms — blanking "the" or "is" adds no value
✓ Include enough context that the blank is identifiable from context clues
✗ Don't blank so many words that the sentence is unrecognizable

Why cloze beats front/back for some content:
Cloze uses "context-dependent retrieval" — you recall the term in the same linguistic context you'll encounter it in real use (a sentence, not an isolated question). For vocabulary and terminology, this produces stronger real-world recall than isolated front/back cards.

Example of a good cloze set:
"{{Meiosis}} produces {{4}} daughter cells, while mitosis produces {{2}}."
"The {{centromere}} connects sister {{chromatids}} at the chromosome junction."

Example of a bad cloze card:
"{{The}} {{mitochondria}} {{is}} {{the}} {{powerhouse}} of {{the}} cell."
(Blanking too many words — this tests sentence memorization, not understanding.)`,
    proTip: `Use the AI Flashcard Generator to create cloze cards automatically. In the generator settings, select "Cloze" as the card type. The AI will identify the key terms in your text and wrap them in {{braces}} — review the generated cards and delete any where the blanks make no contextual sense.`,
  },
  {
    id: 'pretest',
    title: 'Pre-Test Mode — The Hypercorrection Effect',
    tldr: 'Test yourself BEFORE studying a topic — being wrong with high confidence produces stronger memory correction than passive review.',
    tags: ['pretest', 'pre-test', 'hypercorrection', 'testing effect', 'confidence', 'before studying'],
    content: `Pre-Test mode flips the normal study sequence: instead of learning then testing, you test BEFORE you've studied. This sounds counterintuitive — but it's one of the most powerful memory techniques research has discovered.

How to access:
Learn page → "Pre-Test Mode" → select a course or topic → Start

How it works:
1. Before each card: "Do you think you know this? (Yes / No)" — rate your confidence
2. Type your best guess for the answer
3. Correct answer is shown immediately (no FSRS grading during pretest)
4. Continue through all cards

Post-session summary shows three categories:
• "Knew it, got it right" → good, no special treatment
• "Thought you knew it, got it WRONG" → these cards get reviewed first next session
• "Knew you didn't know" → normal review order

The hypercorrection effect:
When you're WRONG with HIGH CONFIDENCE, your brain is in a heightened state of surprise and confusion — and that state dramatically accelerates correction. The hypercorrection effect (Butterfield & Metcalfe, 2001) shows that high-confidence errors are remembered correctly after just ONE correction, compared to low-confidence errors that may require several reviews.

This is why Pre-Test mode front-loads the high-confidence errors in your next review session — you catch the most sticky mistakes first.

Science: The Testing Effect (Roediger & Karpicke, 2006) shows that being tested before studying produces 20-30% better retention than studying without pre-testing. Even complete wrong guesses improve later encoding because the "error signal" in the brain primes deeper processing of the correct answer.

Best used for:
✓ Brand new decks you haven't studied at all yet
✓ Before an exam as a diagnostic — reveals overconfident blind spots
✗ Not for daily FSRS review (that uses scheduled recall, not pre-testing)`,
    proTip: `Use Pre-Test Mode on a brand new deck before your FIRST review session. Spend 10 minutes pre-testing everything, then immediately start the FSRS review. The combination of pre-test errors + first review produces significantly stronger initial encoding than FSRS review alone.`,
  },
]

// ─── Category 3: Learn Modes ──────────────────────────────────────────────────

const learnModes: TutorialEntry[] = [
  {
    id: 'learn-modes-overview',
    title: 'Which Learn Mode Should I Use? (Decision Guide)',
    tldr: 'NousAI has 16+ learning modes — this decision tree tells you which one to use for your exact situation.',
    tags: ['learn', 'modes', 'which', 'decision', 'study techniques', 'feynman', 'exam', 'rapid'],
    content: `The Learn page (LEARN in the sidebar) is the hub for all active study techniques. Here's how to pick the right mode for your situation.

"I'm starting a brand new topic I've never studied before"
→ Step 1: Rapid Learn (get a fast overview)
→ Step 2: Feynman Technique (check if you actually understand it)
→ Step 3: Flashcard Gen (create cards for long-term memory)

"I have an exam in 48 hours"
→ Step 1: Exam Simulator (test under realistic time pressure)
→ Step 2: Error Analysis (drill specifically what you got wrong)
→ Step 3: RSVP Speed Preview (final rapid exposure sweep)

"A concept just won't stick no matter what I do"
→ Step 1: Analogy Tool (build a bridge from known to unknown)
→ Step 2: Mnemonics Generator (create a memory hook)
→ Step 3: Re-Explain Tool (hear it explained a different way)

"I'm studying math, physics, or chemistry"
→ Formula Lab (enter any formula → see step-by-step breakdowns)
→ Solver (work through problems with AI guidance)
→ Physics Sim (generate visual interactive simulations)

"I want to test if I actually know the material (not just recognize it)"
→ Socratic Dialogue (AI asks you questions, you must defend your answers)
→ Type-to-Recall mode (production test, not recognition)

"I'm returning after a long break (weeks away)"
→ Step 1: RSVP Speed Preview (re-familiarize rapidly)
→ Step 2: Spaced Rep Mode (catch up on overdue cards)
→ Step 3: Gap Finder (identify what you've forgotten most)

"I want to see how topics connect to each other"
→ Knowledge Web (visual graph of concept connections)
→ Mind Map (hierarchical visual map)
→ Prerequisite Tool (shows what you need to know first)

"I'm studying a foreign language (especially Japanese)"
→ JP Study Mode (hiragana, katakana, kanji, grammar with color-coded particles)
→ Match Game (vocabulary pairs)
→ Vocab tab in your Course Space

Science (why variety matters):
Interleaving different study techniques — rather than using just one method — produces significantly better long-term retention (Kornell & Bjork, 2008). The "desirable difficulties" framework (Bjork, 2011) explains this: techniques that feel harder in the moment (Socratic dialogue, Feynman) outperform easier techniques (re-reading, watching lectures) because the cognitive effort strengthens the memory trace.`,
    proTip: `Don't use all 16 modes. Pick 2–3 that fit your learning style and alternate between them. Rotating between Feynman, Spaced Rep, and Exam Sim covers the three cognitive stages: understanding → encoding → retrieval.`,
  },
  {
    id: 'exam-sim',
    title: 'Exam Simulator: Timed Practice That Actually Works',
    tldr: 'Simulate real exam conditions — timed, no notes, randomly ordered — to measure real readiness, not false confidence.',
    tags: ['exam', 'simulator', 'timed', 'test', 'practice', 'mock exam', 'pressure'],
    content: `The Exam Simulator generates a full timed quiz from your course content and presents it under conditions that mimic a real exam.

How to access:
Learn page → "Exam Simulator" → select your course → configure settings → Start

Settings:
• Question count: 10, 20, or 40 questions
• Time limit: by total time or per question
• Question types: Multiple choice, True/False, Short Answer, or mixed
• Difficulty: Easy, Medium, Hard
• Topic filter: all topics or specific sections

During the exam:
Questions appear one at a time. A timer counts down in the top corner. You cannot skip and come back unless you flag a question. When time runs out, the exam is auto-submitted.

After the exam:
• Score summary (% correct, time taken)
• Per-question review — see your answer vs. correct answer with explanation
• Missed questions are automatically added to a "Review Later" queue
• Option to "Re-quiz from wrong answers only" — immediately drill just the items you got wrong

Why timed practice beats untimed:
The stress hormone cortisol at moderate levels (the kind produced by a ticking timer) activates the prefrontal cortex and improves retrieval accuracy. Research on "state-dependent memory" (Godden & Baddeley, 1975) shows that practicing recall in conditions similar to the actual test produces better exam performance than practicing in calm conditions. If your exam is stressful, your practice should simulate that stress.

Watch out: Don't use Exam Sim as your primary learning method. It's a measurement tool, not a teaching tool. Use it to test what you've already learned via FSRS and Learn modes — then use Error Analysis on the results.`,
    proTip: `Run one Exam Sim per week for each upcoming exam. Compare your score week-to-week. A score that's stable or declining despite studying points to a learning method problem (your cards may have leeches, or you're studying the wrong material) — not a knowledge problem.`,
  },
  {
    id: 'feynman',
    title: 'Feynman Technique: Explain It Like You\'re Teaching',
    tldr: 'The most powerful comprehension test: explain the concept in simple words — what you can\'t explain, you don\'t really understand.',
    tags: ['feynman', 'explain', 'teach', 'understanding', 'comprehension', 'technique'],
    content: `The Feynman Technique is named after physicist Richard Feynman, who believed you only truly understand something if you can explain it simply enough that a 12-year-old could follow it.

How to use it in NousAI:
1. Learn page → "Feynman Technique"
2. Select a course and topic
3. NousAI shows you the concept (e.g., "Photosynthesis")
4. You type your explanation — imagine you're teaching it to someone who has never heard of it
5. The AI evaluates your explanation:
   • Identifies gaps ("You didn't explain what chlorophyll does in step 3")
   • Points out jargon used without explanation ("You used 'ATP' without defining it")
   • Confirms what you got right
6. You revise and re-explain until the AI confirms full understanding

Why it works:
The "generation effect" and "elaborative interrogation" (Pressley et al., 1992) both show that producing explanations in your own words creates stronger, more transferable memory than recognition-based learning. When you try to explain and fail, you locate exactly where your knowledge breaks down — more precisely than any test. Students who use teaching-style explanation techniques score 28% higher on transfer tests (tasks that require applying knowledge to new problems).

The 4-step Feynman process:
1. Choose concept → Try to explain it simply
2. Identify gaps → Where did you get stuck or use unexplained jargon?
3. Review the source material specifically for the gaps
4. Explain again using even simpler language

Best for:
✓ Complex processes (how does cellular respiration actually work?)
✓ Abstract concepts (what is entropy, really?)
✓ Anything you've memorized but aren't sure you understand
✗ Pure memorization (dates, formulas, vocabulary) — use flashcards for those`,
    proTip: `Do Feynman AFTER one flashcard review session on a topic, not before. Use the flashcard session to activate the relevant memory network, then immediately explain it. The combination of recall + explanation produces deeper encoding than either alone.`,
  },
  {
    id: 'interleaved',
    title: 'Interleaved Practice: Why Mixing Topics Works',
    tldr: 'Studying topics in random order feels harder but produces 25-40% better retention than studying one topic at a time.',
    tags: ['interleaved', 'interleaving', 'mixed', 'variety', 'desirable difficulty', 'spacing'],
    content: `Interleaved Practice is the Learn mode that randomly mixes flashcards from multiple topics or courses instead of presenting them in topic-by-topic blocks.

How to access:
Learn page → "Interleaved Practice" → select 2–4 courses/topics → Start

During the session:
Cards from all selected topics appear in random order. Each card could be from any subject. This feels harder and more confusing — that's intentional.

The science:
Blocked practice (all Topic A, then all Topic B, then all Topic C) feels easy because context cues help you remember. But that ease is an illusion — it doesn't transfer to exams. Interleaved practice (random mix of A, B, C) forces your brain to identify which type of problem it's facing AND recall the answer without contextual support.

Research by Rohrer & Taylor (2007) found that interleaved practice on math problems produced 43% better performance on exams than blocked practice, despite feeling significantly harder during study. The "difficulty" is a feature — it's the signal that deeper processing is occurring.

Why it works:
Blocked → brain pattern-matches within a topic → easy retrieval → shallow encoding
Interleaved → brain must identify problem type first → effortful retrieval → deep encoding

When to use it:
✓ After you've already learned each topic separately (don't interleave new material)
✓ 1–2 weeks before an exam to solidify multiple topics
✓ For subjects where you need to distinguish between similar concepts (e.g., similar-looking chemistry reactions)
✗ NOT for learning brand new material — learn it blocked first, then interleave

Watch out: Interleaved sessions will have lower accuracy than blocked sessions. This is expected and healthy. A 70% accuracy rate in interleaved practice often produces better exam scores than a 90% rate in blocked practice.`,
    proTip: `Mix courses that have similar-looking concepts — for example, Biology and Chemistry if both involve enzyme kinetics. Forcing your brain to distinguish between overlapping knowledge structures produces the strongest discrimination learning.`,
  },
  {
    id: 'omni-protocol',
    title: 'Omni Protocol: The 60-Minute Science-Backed Study Session',
    tldr: 'A 7-phase structured study session that combines all of NousAI\'s tools in the optimal sequence for maximum retention.',
    tags: ['omni', 'protocol', 'session', 'structure', 'sequence', 'phases', 'system'],
    content: `The Omni Protocol is a 60-minute structured study session that sequences NousAI's tools in a specific order based on memory consolidation research.

Access: Learn page → "Omni Protocol" → select your course

The 7 phases:

Phase 1 — Prime (5 min)
Tool: RSVP Speed Preview
Goal: Activate relevant memory networks before active study.
Science: Pre-activation of semantic memory networks improves encoding of new material (Bransford & Johnson, 1972).

Phase 2 — Chunk (10 min)
Tool: Rapid Learn or your own notes
Goal: Take in new material in one focused pass. No highlights, no re-reading — one pass only.
Why: The "generation effect" requires you to have something to generate from. This phase provides the raw material.

Phase 3 — Encode (15 min)
Tool: Flashcard Generator → save to course
Goal: Convert the most important ideas from Phase 2 into flashcards immediately.
Science: Encoding within 20 minutes of learning (before the first memory consolidation wave) produces stronger initial memory traces (McGaugh, 2000).

Phase 4 — Connect (10 min)
Tool: Feynman Technique or Mind Map
Goal: Connect the new material to what you already know.
Why: Isolated memories are fragile. Memories connected to existing knowledge structures survive much longer (Ausubel, 1968).

Phase 5 — Break (5 min)
Do nothing study-related. Walk, hydrate, look out a window.
Science: Memory consolidation requires a rest period. The hippocampus replays new memories during wakeful rest, strengthening the traces (Tambini et al., 2010).

Phase 6 — Test (10 min)
Tool: Exam Simulator or Flashcard Review
Goal: Active retrieval of what you just learned.
Science: Testing within 30 minutes of encoding produces the most robust long-term retention (the "testing effect," Roediger & Karpicke, 2006).

Phase 7 — Anchor (5 min)
Tool: Type 3 key takeaways into your Lecture notes
Goal: Verbal consolidation — writing what you learned in your own words.
Why: Writing creates a second encoding pass (elaborative encoding) and produces a retrievable reference for future review.`,
    proTip: `If you only have 30 minutes, do phases 1, 3, and 6 only (Prime → Encode → Test). This 3-phase shortcut captures the highest-value steps: exposure, encoding, and retrieval testing.`,
  },
  {
    id: 'rapid-learn',
    title: 'Rapid Learn: First Pass on New Material',
    tldr: 'A fast, structured first exposure to any topic — sets up deeper study to be 40% more effective.',
    tags: ['rapid', 'learn', 'new', 'material', 'first pass', 'overview', 'introduction'],
    content: `Rapid Learn is designed for your very first pass on a completely new topic. It presents your course flashcards in a structured way to build an initial mental framework before deeper study.

How to access:
Learn page → "Rapid Learn" → select a course or topic

How it works:
Cards are shown with both front and back visible simultaneously — you're not trying to recall, just building familiarity. The session moves quickly (about 5 seconds per card). At the end, you select which cards you want to prioritize for your first real FSRS review.

Why first exposure matters:
The "advance organizer" effect (Ausubel, 1960) shows that having even a rough mental framework of a subject before studying it in detail makes subsequent learning 30–40% more efficient. Your brain stores new information by connecting it to existing memory structures. Rapid Learn creates those "hooks" before deep study.

Best sequence:
Rapid Learn → Feynman (test if you got the gist) → Flashcard Gen (create cards) → FSRS review (long-term encoding)

What Rapid Learn is NOT for:
✗ Testing yourself
✗ Creating a false sense of mastery (seeing a card ≠ knowing it)
✗ Replacing FSRS review

Watch out: After Rapid Learn, students often feel like they "know" the material because it looks familiar. This is the "fluency illusion" (Bjork, 1994) — recognition feels like knowledge but is much shallower. Always follow Rapid Learn with active recall (Feynman or FSRS).`,
    proTip: `Before class each day, do a 5-minute Rapid Learn on the topic your professor will cover. Research on "pre-reading" shows that students who have even a rough preview of the lecture material retain 25% more of the lecture content than students going in cold.`,
  },
  {
    id: 'socratic',
    title: 'Socratic Dialogue: Test Deep Understanding',
    tldr: 'The AI plays the role of a skeptical teacher — asking you probing questions until your understanding is genuinely solid.',
    tags: ['socratic', 'dialogue', 'questions', 'understanding', 'critical thinking', 'depth'],
    content: `Socratic Dialogue is a one-on-one conversational mode where the AI acts as a Socratic tutor — asking you increasingly challenging questions about a topic to expose gaps in your understanding.

How to access:
Learn page → "Socratic Dialogue" → type a topic or paste text → Start

How a session works:
The AI begins with a surface-level question ("What is photosynthesis?"). As you answer, it asks follow-up questions that probe deeper:
• "Why does that process occur in the chloroplast specifically?"
• "What would happen if the concentration of CO₂ doubled?"
• "How does that relate to cellular respiration?"
Questions escalate until you reach the boundary of your knowledge.

At the end, the AI gives a summary:
• Topics where you demonstrated strong understanding
• Specific gaps and misconceptions identified
• Recommended resources or flashcard topics to address the gaps

Why Socratic questioning works:
The Socratic method produces "generative learning" — you're not receiving information but constructing understanding through dialogue. Meta-analyses of active learning (Freeman et al., 2014) show generative methods produce 6% higher exam scores and 1.5x lower failure rates compared to passive lecture formats.

The AI is calibrated to push until you get stuck — not to make you feel bad, but to locate exactly where your understanding breaks down. That boundary is precisely where study is most valuable.

Best for:
✓ Conceptual subjects where depth matters (philosophy, biology, economics)
✓ Before a discussion-based exam or oral defense
✓ When you feel like you understand something but can't explain it clearly
✗ Not for pure memorization tasks (dates, formulas) — use flashcards instead`,
    proTip: `After a Socratic session, take the "gaps" list the AI identified and immediately create flashcards for those specific points. The gaps Socratic dialogue finds are exactly what FSRS needs to work on — they're your true weak spots, not just the ones that feel hard.`,
  },
  {
    id: 'gap-find',
    title: 'Gap Finder: Discover What You Don\'t Know',
    tldr: 'Analyzes your course content and FSRS data to pinpoint exactly which topics and concepts have the weakest coverage.',
    tags: ['gap', 'weak spots', 'coverage', 'analysis', 'diagnostic', 'find', 'missing'],
    content: `Gap Finder scans your existing flashcards, quiz results, and FSRS review history to surface topics you've studied the least or gotten wrong the most.

How to access:
Learn page → "Gap Find" → select a course → Run Analysis

What it finds:
• Topics in your course syllabus that have zero or very few flashcards (coverage gaps)
• Cards with the lowest FSRS stability scores (knowledge gaps — you keep forgetting them)
• Concepts that appear in your wrong quiz answers but aren't in your flashcard deck
• Cross-topic gaps — things you know individually but haven't connected (e.g., you know DNA and transcription, but never studied how they link)

How to act on results:
Each gap comes with suggested actions:
→ "Create cards" — opens Flashcard Generator pre-filled with that topic
→ "Add to review" — pushes weak existing cards to the front of your FSRS queue
→ "Explain this" — opens the Re-Explain tool on that specific concept

When to use Gap Finder:
✓ After completing a course module (before moving to the next one)
✓ 2 weeks before an exam — reveals blind spots while there's still time
✓ After a poor quiz score — find WHAT exactly caused the miss

Science: Metacognitive awareness — knowing what you don't know — is the single strongest predictor of academic performance (Flavell, 1979). Students who accurately assess their knowledge gaps score significantly higher than students with equal knowledge but poor self-assessment. Gap Finder externalizes metacognition: instead of guessing where your weak spots are, you see them objectively in the data.

Why: Unreviewed cards accumulate invisible debt → Gap Finder makes the debt visible → you can pay it down strategically before an exam rather than discovering it during the exam.`,
    proTip: `Run Gap Finder at the START of exam week, not the day before. Early detection gives you time to create cards for the gaps and let FSRS schedule them for at least 2 review cycles before the exam.`,
  },
  {
    id: 'mnemonics',
    title: 'Mnemonics Generator: Create Memory Hooks That Stick',
    tldr: 'The AI generates custom acronyms, stories, rhymes, and visual memory hooks for any concept that won\'t stick.',
    tags: ['mnemonics', 'memory', 'acronym', 'story', 'hook', 'remember', 'visual'],
    content: `The Mnemonics Generator creates custom memory devices for concepts that are hard to memorize — things that don't follow a logical pattern, like medical terms, historical dates, element symbols, or foreign vocabulary.

How to access:
Learn page → "Mnemonics" → enter a concept or list → Generate

Types of mnemonics it can create:
• Acronym — takes the first letter of each item ("HOMES" for the Great Lakes: Huron, Ontario, Michigan, Erie, Superior)
• Acrostic sentence — "My Very Educated Mother Just Served Us Nachos" for planet order
• Rhyme/song — rhythmic encoding for sequences and definitions
• Method of Loci story — places items you need to remember in familiar physical locations
• Visual peg — links numbers or items to vivid images (1 = candle, 2 = swan, etc.)
• Keyword method — for foreign vocabulary: find a word in your language that sounds like the foreign word, then create a visual story connecting them

How to use the output:
1. Read the mnemonic the AI created
2. Visualize it — actually picture the image or story in your mind for 10 seconds
3. Create a flashcard with the mnemonic as a hint on the back
4. After 3 FSRS reviews, you'll often find the mnemonic fades away and direct recall takes over (the mnemonic was just the scaffold)

When mnemonics work best:
✓ Arbitrary lists with no inherent logic (cranial nerve order, amino acid codes)
✓ Foreign language vocabulary
✓ Medical/Latin terminology
✗ Conceptual understanding — you can't mnemonic your way to understanding WHY something works; use Feynman for that

Science: Dual-coding theory (Paivio, 1971) shows that pairing verbal information with visual imagery produces significantly stronger memory traces than verbal encoding alone. The Method of Loci — one of the oldest mnemonic techniques — has been used by memory champions for 2,500 years. Modern neuroscience confirms it activates spatial memory circuits in the hippocampus, which have unusually high retention capacity.`,
    proTip: `For maximum effect, make your mnemonic bizarre, funny, or emotionally vivid. The brain prioritizes novel, surprising, or emotionally charged information (the von Restorff effect, 1933). A mnemonic that makes you laugh or cringe is far more memorable than a sensible one.`,
  },
  {
    id: 'formula',
    title: 'Formula Lab: Step-by-Step Math and Physics Breakdown',
    tldr: 'Enter any formula — the AI breaks it down piece by piece, shows worked examples, and lets you practice with generated problems.',
    tags: ['formula', 'math', 'physics', 'chemistry', 'equations', 'step-by-step', 'breakdown'],
    content: `Formula Lab is designed for STEM subjects where you need to understand and use mathematical formulas — not just know what they look like, but know what each symbol means and how to apply them.

How to access:
Learn page → "Formula" → enter a formula or click a preset

What you can do:
• Enter any formula (e.g., E = mc², F = ma, PV = nRT)
• The AI breaks down every component: what each symbol represents, its units, its range, and what happens when it increases/decreases
• See worked examples — a real problem solved step-by-step with the formula
• Generate practice problems — the AI creates 5–10 problems at your specified difficulty level
• Ask "what if?" — type a variation ("what if mass doubles?") and see how the formula responds

Step-by-step problem solving:
For each practice problem:
1. Try to solve it yourself first
2. Click "Show Step 1" — the AI reveals just the first step (not the full answer)
3. Continue step-by-step until you see where you went wrong (or verify your method)
4. This "step reveal" mode is intentionally designed to preserve the generation effect — you think before seeing.

How to save formulas to your course:
"Save to Formula Bank" → the formula and all generated examples are saved under your course's Formula Lab tab. Future you can browse the whole formula bank by course.

LaTeX support:
Formula Lab renders all math with LaTeX formatting. If you type raw LaTeX (e.g., \frac{1}{2}mv^2), it renders it properly.

Science: Mathematical understanding requires both procedural knowledge (how to calculate) and conceptual knowledge (why the formula works). Research by Sfard (1991) shows students who only learn procedures without understanding concepts fail to transfer knowledge to novel problems — they can solve textbook problems but fail on anything slightly different. Formula Lab's breakdown forces conceptual understanding before procedural practice.`,
    proTip: `After Formula Lab, create flashcards with the formula on the front and its "component breakdown" on the back (not the answer to a problem — the meaning of each symbol). Knowing what F, m, and a mean in F=ma is more valuable than memorizing the formula itself.`,
  },
  {
    id: 'error-analysis',
    title: 'Error Analysis: Learn More From Wrong Answers Than Right Ones',
    tldr: 'Reviews all your quiz and flashcard errors, identifies patterns in your mistakes, and builds a targeted drill session just from what you got wrong.',
    tags: ['errors', 'mistakes', 'wrong answers', 'analysis', 'drill', 'pattern', 'weak spots'],
    content: `Error Analysis collects every wrong answer you've given — in quizzes, flashcard reviews, and Socratic sessions — and finds patterns in your mistakes.

How to access:
Learn page → "Errors" → select a course → Analyze

What it shows you:
• A chronological list of your errors with the correct answers
• Error rate by topic (e.g., "You miss 40% of questions about mitochondria but only 5% about the nucleus")
• Error patterns — e.g., "You consistently confuse dehydration synthesis and hydrolysis"
• Most frequently missed cards (your "persistent enemies" — cards you've gotten wrong more than 3 times)
• Time-based patterns — do you make more errors after 9 PM? (Fatigue indicator)

What to do with the analysis:
After viewing the report, choose an action:
→ "Drill Errors" — launches a focused review session containing ONLY your error cards, presented in order from most-missed to least-missed
→ "Create Cards for Gaps" — auto-generates flashcards for concepts that appear in your errors but aren't in your deck
→ "Explain my top 5 errors" — opens Re-Explain for each error concept one by one

The "drill" session:
A focused flashcard session with only your error cards. Scoring is the same (1–4), but after answering:
• If you get it RIGHT → the card is "graduated" out of the error deck (next review via FSRS)
• If you get it WRONG again → it stays in the error deck and is shown again in this session

Science: The "hypercorrection effect" (Butterfield & Metcalfe, 2001) shows that errors made with HIGH CONFIDENCE are corrected faster and retained longer than low-confidence errors. When you were SURE you were right and turned out wrong, your brain's surprise response creates an especially strong correction signal. Error Analysis front-loads your highest-confidence errors — the ones most likely to be corrected in a single drill session.

Why: Most students ignore wrong answers after seeing the correct one → mistakes stay in long-term memory as "almost right" → they fail future questions on the same topic. Error Analysis treats every wrong answer as a learning asset.`,
    proTip: `Run Error Analysis after every quiz you take in NousAI — not just the ones you scored poorly on. Even high-scoring quizzes have 2–3 errors that reveal subtle misconceptions. Catching them early (while confidence is high) makes correction far faster.`,
  },
  {
    id: 'tldr-mode',
    title: 'TL;DR Mode: Ultra Summaries of Any Content',
    tldr: 'Paste anything — lecture notes, textbook pages, articles — and get a structured, scannable summary in seconds.',
    tags: ['tldr', 'summary', 'summarize', 'quick', 'overview', 'notes', 'condensed'],
    content: `TL;DR Mode takes any text input and produces a highly condensed, structured summary. Designed for when you need to quickly absorb the key points of long material.

How to access:
Learn page → "TL;DR" → paste text or select a course note → Summarize

What the output looks like:
A structured summary with 3 sections:
1. Core Concepts (3–5 bullet points — the most important ideas)
2. Key Terms (bolded terms + one-line definitions)
3. Critical Relationships (how the main ideas connect to each other)

Adjustable depth:
• "Brief" — 3 bullets per section (for when you just need the headline)
• "Standard" — 5 bullets (default)
• "Deep" — 8 bullets per section (for dense textbook chapters)

Multiple formats available:
• Bullet list (default)
• Cornell Notes format (main ideas / notes / summary)
• Table (concept | definition | example)
• Narrative paragraph (for literary or humanities content)

Common uses:
→ Before class: summarize the assigned reading in 60 seconds to have a framework for the lecture
→ After class: paste your raw lecture notes for a clean structured version
→ During exam prep: summarize each chapter to verify you know the key points before drilling flashcards
→ PDF chapters: paste extracted text from the PDF Uploader tool for instant chapter summaries

Watch out: TL;DR is for comprehension and orientation, not for memorization. Don't use it as a replacement for active recall. Use it to understand structure, then use flashcards and FSRS for long-term memory.

Science: Summarization is a form of "generative processing" (Mayer, 2002) — the act of deciding what's important enough to include creates deeper encoding than passive reading. Research shows students who write summaries after reading retain 40% more than students who re-read the same material.`,
    proTip: `Use TL;DR on your professor's posted lecture slides BEFORE the actual lecture. This gives you a preview framework that makes the lecture 30–40% more comprehensible. The advance organizer effect means your brain can attach new details to existing mental hooks rather than processing everything from scratch.`,
  },
  {
    id: 'connect-mode',
    title: 'Connect: Discover Links Between Topics You\'ve Already Studied',
    tldr: 'Shows you how topics in your course relate to each other — creates a knowledge web that reveals interdependencies you might have missed.',
    tags: ['connect', 'links', 'relationships', 'knowledge web', 'cross-topic', 'connections', 'graph'],
    content: `Connect Mode analyzes the content across your course — all your flashcards, notes, and topics — and generates a map of how concepts relate to each other.

How to access:
Learn page → "Connect" → select a course → Generate Web

What it creates:
A visual knowledge web showing:
• Nodes — each node is a topic or concept in your course
• Edges — lines between nodes represent relationships (causal, sequential, analogous, or dependent)
• Node size — larger = more connected to other topics (core concepts)
• Edge color — different colors for different relationship types

Interaction:
• Click any node to expand it — see all its connections with relationship labels
• Click an edge — see a plain-English explanation of why those two concepts are connected
• "Quiz this connection" — generates a question specifically about the relationship between two concepts

When cross-topic links matter:
Knowing concepts in isolation is not the same as understanding a subject. Biology exams routinely test whether you understand how cellular respiration links to photosynthesis, not just each in isolation. Connect surfaces these links explicitly.

Use it as a study map:
Before studying a topic, check Connect to see what it's linked to. Then when you study it, deliberately try to recall those linked topics — this is "elaborative interrogation" (Pressley et al., 1987): asking "how does this relate to X?" during encoding doubles retention of both X and the new concept.

Science: Meaningful learning theory (Ausubel, 1963) states that learning occurs when new information links to existing knowledge in a non-arbitrary, substantive way. Isolated facts are stored weakly; connected facts form a knowledge network where each node reinforces the others. Connect externalizes your knowledge graph so you can see where your network is sparse.`,
    proTip: `After generating your Connect web, find the 3 nodes with the most connections (the hub concepts). These are your course's "load-bearing" ideas — if you deeply understand these 3, you can reconstruct most of the rest of the course from first principles. Prioritize them in your flashcard reviews.`,
  },
  {
    id: 'spaced-rep',
    title: 'Spaced Rep Mode: FSRS Flashcard Review in Learn',
    tldr: 'The dedicated FSRS review session in the Learn page — review all due cards with performance tracking and course filtering.',
    tags: ['spaced', 'repetition', 'fsrs', 'review', 'flashcards', 'due', 'schedule'],
    content: `Spaced Rep mode is a full FSRS flashcard review session accessible from the Learn page. It's equivalent to the Flashcards page review but with extra filtering and analytics available.

How to access:
Learn page → "Spaced Rep" → optionally filter by course or topic → Start Review

What makes it different from the Flashcards page:
• Topic filter — review ONLY cards from a specific topic (e.g., "Cell Division" within Biology 101)
• Difficulty filter — focus the session on "Hard" cards only, or "Again" cards only
• Per-session analytics — after the session, see your accuracy rate, average response time, and FSRS progress chart
• "Catch-up mode" — if you've missed several days, this mode batches overdue cards into a compressed session

How to rate cards:
Each card shows its front. Try to recall the answer mentally, then flip:
• 1 = Again — I had no idea. Card resets to 1-day interval.
• 2 = Hard — I got it, but it took effort. Short interval.
• 3 = Good — Normal recall. Interval roughly doubles.
• 4 = Easy — Immediate recall. Interval jumps significantly.

How many cards to do per day:
NousAI caps new cards at 50/day and review cards at 200/day by default. These limits exist to prevent "review debt" — doing too many new cards creates a future avalanche of reviews. The queue shown is your actual due cards, not all cards.

After the session:
• FSRS reschedules each card based on your ratings
• The session summary shows how many cards move to tomorrow, next week, or next month
• "Difficult" cards (rated 1 repeatedly) are flagged as Leeches — see the Leech Manager guide

Science: Spaced repetition's core mechanism — the spacing effect (Ebbinghaus, 1885) — shows that distributing reviews over time produces significantly stronger long-term retention than massed practice. FSRS (2022) is the most mathematically precise implementation of this principle: instead of fixed intervals, it calculates each card's optimal review moment from your personal rating history.`,
    proTip: `Set a daily review time and stick to it. Research on habit formation (Wood & Neal, 2007) shows that time-consistent behaviors become automatic within 66 days on average. A 15-minute FSRS review at the same time each day becomes effortless — and that habit compounds into thousands of cards mastered over a semester.`,
  },
  {
    id: 'tutors-mode',
    title: 'Tutors Mode: The Same Concept Taught 4 Different Ways',
    tldr: 'Four distinct AI teaching styles explain any concept until one finally clicks — from Socratic coaching to visual storytelling.',
    tags: ['tutors', 'teaching', 'styles', 'explain', 'learn', 'different ways', 'coaching'],
    content: `Tutors Mode presents the same concept through four distinct AI teaching personalities. If one explanation doesn't click, switch to a different style.

How to access:
Learn page → "Tutors" → enter a concept or topic → select a style

The four teaching styles:

🔬 Scientist (precise and technical)
Uses accurate terminology and formal definitions. Ideal if you prefer rigor over simplicity. Example: "Photosynthesis is the endothermic reduction of CO₂ to carbohydrates via the Calvin cycle, driven by photons absorbed by chlorophyll pigments."

📖 Storyteller (narrative and memorable)
Embeds the concept in a story or metaphor. Ideal for abstract or complex systems. Example: "Imagine the chloroplast is a solar-powered factory. Sunlight is the electricity. CO₂ is the raw material coming in. Glucose is the product shipping out."

❓ Coach (Socratic questioning)
Asks you questions rather than explaining. Makes you figure it out. Ideal if you learn best by doing and answering. Example: "What do you think happens to a plant if you block all sunlight for 2 weeks? Walk me through your reasoning."

🎯 Simplifier (ELI5 — explain like I'm 5)
Strips away all jargon and uses only everyday analogies. Ideal for first contact with a concept. Example: "Photosynthesis is when a plant eats sunlight. It takes sunshine + air + water and makes food for itself."

Switching styles mid-session:
You can switch styles at any point without losing the conversation history. Try: Simplifier first (get the big picture) → Scientist (get the precise version) → Coach (prove you can answer questions about it).

Science: Learning style flexibility — the ability to approach material from multiple angles — is more predictive of academic success than having a single "preferred" learning style (Pashler et al., 2008, "Learning Styles: Concepts and Evidence"). Four explanations target four different aspects of understanding: the ELI5 builds intuition, the Scientist builds precision, the Storyteller builds memory, and the Coach builds retrieval.`,
    proTip: `If a concept has a crucial equation or mechanism you keep forgetting, use the Storyteller mode and specifically ask for "a story or memory hook that helps me remember [the specific part]." Save this story to a flashcard. The narrative encoding is far stronger than a definition.`,
  },
  {
    id: 'solver-mode',
    title: 'Solver: AI-Guided Step-by-Step Problem Solving',
    tldr: 'Paste any problem — math, physics, chemistry, logic — and the AI guides you through the solution step by step without just giving you the answer.',
    tags: ['solver', 'problems', 'step by step', 'math', 'physics', 'guided', 'homework', 'help'],
    content: `Solver is the AI tutor for working through problems. Unlike asking ChatGPT (which gives you the answer immediately), Solver is designed to guide you through the solution yourself — maximally preserving the learning value.

How to access:
Learn page → "Solver" → paste your problem → Start

How it works:
1. You paste a problem (any format — text, LaTeX, a description)
2. Solver identifies the type of problem and the relevant concepts/formulas
3. It shows you the FIRST STEP — just a hint, not the answer
4. You attempt that step (type your attempt)
5. Solver evaluates your attempt → confirms or corrects → shows the next step
6. Continue until the solution is complete

"Full Solution" mode:
If you've genuinely tried and are completely stuck, click "Show Full Solution" → see the complete worked solution with every step annotated. Use this as a model to understand, then try a similar problem yourself.

Problem types it handles:
• Calculus (derivatives, integrals, differential equations)
• Linear algebra (matrices, determinants, eigenvectors)
• Physics (mechanics, thermodynamics, electromagnetism, waves)
• Chemistry (stoichiometry, equilibrium, electron configuration)
• Statistics (probability, hypothesis testing, distributions)
• Logic and proof-based math
• Computer science (algorithm tracing, Big-O analysis)

LaTeX rendering:
All math is rendered with KaTeX for proper formatting. You can type in LaTeX or plain English — Solver parses both.

Why NOT just use "Show Full Solution" immediately:
The generation effect (Slamecka & Graf, 1978) shows that attempting to generate an answer — even incorrectly — produces 20–40% stronger memory encoding of the correct answer than simply reading it. This is the same reason handwriting beats typing for note retention: the effortful production process strengthens encoding.`,
    proTip: `After completing a guided Solver session, immediately try a similar problem WITHOUT help — this is called "varied practice" or a transfer test. If you can solve the variant, you've understood the principle. If you can't, you've memorized the steps without understanding them — and you need one more Solver session with a different problem.`,
  },
  {
    id: 'japanese-practicum',
    title: 'Japanese Practicum: Type & Speak Your Way to Fluency',
    tldr: 'A dedicated Japanese language study mode with hiragana/katakana/kanji typing drills, grammar quizzes, reading comprehension, and speech recognition.',
    tags: ['japanese', 'practicum', 'hiragana', 'katakana', 'kanji', 'grammar', 'language', 'nihongo'],
    content: `Japanese Practicum is a specialized mode for Japanese language learners. It combines typing drills, reading practice, grammar exercises, and optional speech recognition in one integrated session.

How to access:
Learn page → "Japanese Practicum"

What's included:

🔤 Kana Drills
Practice hiragana and katakana by typing the romaji equivalent of displayed characters. Tracks accuracy per character — automatically identifies which kana you confuse most (e.g., は vs. ほ).

🈯 Kanji Reading
Shows a kanji and asks for its reading (kun'yomi or on'yomi). Uses spaced repetition — kanji you miss appear more frequently. Tracks progress across JLPT levels (N5 → N1).

📝 Grammar Exercises
Sentence construction exercises: fill in the correct particle (は, が, に, を, etc.), conjugate verbs correctly, or identify the error in a sentence.

📖 Reading Comprehension
Short Japanese passages with comprehension questions. Vocabulary hints on hover (tap a word to see its meaning without breaking reading flow).

🎤 Speaking Practice (optional)
If your device has a microphone, enable Speech Mode. The app shows a Japanese sentence → you speak it → the app uses speech recognition to evaluate your pronunciation.

Course integration:
If you've set up a Japanese course in NousAI, Practicum uses your course vocabulary for the exercises. This means your custom vocab list is drilled alongside the standard kana/kanji sets.

Progress tracking:
Accuracy by character class, by JLPT level, and over time. See which specific characters or particles you consistently miss.

Science: Language acquisition research (Krashen, 1982) distinguishes acquisition (natural, contextual learning) from learning (explicit grammar study). Practicum combines both: kana drilling is explicit learning; reading comprehension is acquisition-mode exposure. Using both simultaneously produces faster progress than either alone.`,
    proTip: `Before each Practicum session, do 5 minutes of RSVP on your Japanese flashcards (Speed Preview mode). The fast exposure primes your visual processing system for kana patterns — accuracy in the subsequent Practicum drills is measurably higher after a rapid exposure warm-up.`,
  },
  {
    id: 'physics-practicum',
    title: 'Physics Practicum: Problem Sets With AI Grading',
    tldr: 'Structured physics problem sets — multiple choice, free response, and diagram-based — with step-by-step AI grading and analytics.',
    tags: ['physics', 'practicum', 'problems', 'grading', 'mechanics', 'thermodynamics', 'electromagnetism'],
    content: `Physics Practicum is a structured problem-solving environment for physics coursework. It generates and grades physics problems across all major topic areas.

How to access:
Learn page → "Physics Practicum"

Sections available:

⚙️ Problem Sets
Topic-sorted physics problems (Mechanics, Thermodynamics, Electromagnetism, Waves, Optics, Modern Physics, Quantum). Select a topic → set difficulty (Conceptual, Algebra-based, Calculus-based) → work through 5–10 problems.

📐 Free Response
Full free-response problems (similar to AP Physics or university exam format). Type your complete solution — the AI grades it for both correctness and method, identifying where your reasoning breaks down even if the final answer is right.

📊 Diagram-Based
Physics diagrams with blank fields: "Label all forces," "Sketch the electric field," "Draw the ray diagram." The AI evaluates your labeled diagram for completeness and accuracy.

🧮 Calculator Mode
Built-in scientific calculator with unit conversion. All your calculation steps are logged — if your answer is wrong, the AI can trace exactly which step introduced the error.

AI grading rubric:
Free response is graded on:
• Conceptual accuracy (did you apply the right principle?)
• Mathematical execution (is the algebra correct?)
• Unit consistency (did you track units throughout?)
• Final answer (number and unit correct?)

Full point credit requires correct execution at all four levels — just like a real physics exam.

Analytics:
After each session: accuracy by topic, a "Physics GPA" metric (weighted score across all your Practicum sessions), and a list of concepts where your score is below 70% (need more practice).

Science: Problem-based learning (Schmidt, 1983) — where students encounter problems BEFORE receiving formal instruction — produces significantly deeper conceptual understanding than traditional lecture-first approaches. Physics Practicum structures problems in increasing difficulty, requiring you to apply concepts under varied conditions, which builds flexible rather than rigid knowledge.`,
    proTip: `After getting a Free Response problem graded, read the AI's feedback carefully before moving to the next problem. Then — this is crucial — attempt a SIMILAR problem (same concept, different numbers) immediately. Spaced application of the correction, not just reading feedback, is what builds correct problem-solving habits.`,
  },
]

// ─── Category 4: AI Tools ─────────────────────────────────────────────────────

const aiTools: TutorialEntry[] = [
  {
    id: 'flashcard-gen',
    title: 'AI Flashcard Generator: Getting High-Quality Cards',
    tldr: 'Generate dozens of flashcards from any text, topic, or document in seconds — with tips for making them actually good.',
    tags: ['flashcard', 'generator', 'ai', 'generate', 'cards', 'create', 'quality'],
    content: `The AI Flashcard Generator creates flashcards from text, a topic description, or an uploaded document.

How to access:
Learn page → "Flashcard Generator" (in the Generate section)

How to use it:
Method 1 — By topic: Type a topic or concept ("The Krebs Cycle," "Python list comprehensions") → click Generate. The AI creates 10–20 cards covering key points.
Method 2 — From your text: Paste lecture notes, a textbook excerpt, or any text → click Generate. The AI extracts the most important concepts.
Method 3 — From a PDF: Upload a PDF in the PDF Uploader tool first, then use that extracted text here.

Settings that matter:
• Card type: Standard, Cloze, or Mixed (recommended: Mixed for most subjects)
• Count: 10–50 cards per batch
• Difficulty: Easy (broad definitions) → Hard (specific details, edge cases)
• Course & Topic: Set these BEFORE generating — cards will be automatically organized

Quality control (critical step):
After generation, ALWAYS review the cards before saving:
• Delete cards that are too broad ("What is biology?")
• Delete cards that are too specific (obscure footnote details)
• Edit cards where the phrasing is unclear
• Split cards that try to teach two concepts at once

The 20%-delete rule: For every 20 cards generated, expect to delete 3–5 (the outliers — too easy, too specific, or poorly phrased). This is normal and expected. Think of it as editing, not failure.

Generate 50, keep 40, not generate 10 and keep 10 — larger batches give you better coverage and let you be more selective.

Science: AI-generated cards using "one atomic concept per card" format produce 30–40% better recall than dense, multi-concept cards (based on Wozniak's Minimum Information Principle, 1999). The AI is instructed to follow this principle, but you should spot-check and split any card that covers more than one idea.`,
    proTip: `Generate cards immediately after class while the lecture is still fresh. Even if you end up deleting 30% of them, the act of reviewing and curating AI-generated cards is itself a study technique — it forces you to evaluate each concept and decide what's worth remembering.`,
  },
  {
    id: 'quiz-gen',
    title: 'AI Quiz Generator: From Notes to Full Quiz',
    tldr: 'Generate a quiz from any topic or your own course content — multiple choice, true/false, or short answer.',
    tags: ['quiz', 'generator', 'ai', 'generate', 'questions', 'multiple choice', 'exam prep'],
    content: `The Quiz Generator creates a full quiz from your course content or any topic.

How to access:
QUIZ page → "+ New Quiz" → "AI Generate"
OR: Learn page → "Quiz Generator"

How to use it:
1. Select your course and optionally a specific topic
2. Choose question type: Multiple Choice, True/False, Short Answer, or Mixed
3. Set question count (10–40 recommended)
4. Set difficulty level
5. Click Generate → review → Save Quiz

After generating:
• Edit any question by tapping it before saving
• Delete irrelevant or poorly phrased questions
• Add your own questions by clicking "+ Add Question"

Taking the quiz:
QUIZ page → find your quiz → "Start Session." Answers are shuffled randomly each time. After finishing:
• Score shown with detailed breakdown per question
• Each wrong answer shows the correct answer + explanation
• "Re-quiz: wrong answers only" — immediately drill just what you missed

Quiz history:
QUIZ page → "History" tab. See your score trend over time. If you're scoring above 90% consistently, increase the difficulty level — you've mastered that material.

Merging quizzes:
You can merge two quizzes into one (long quiz → full practice exam simulation). Use this to create a comprehensive final exam practice test by merging all your chapter quizzes.

Science: The "testing effect" (Roediger & Karpicke, 2006) shows that retrieval practice via quizzes produces significantly better long-term retention than re-studying the same material. Taking a quiz, even if you fail it, improves retention more than a second study session.`,
    proTip: `Create a "master exam quiz" by generating one quiz per chapter/topic during the semester, then merging them all into one 60-question exam simulator the week before finals. This gives you a comprehensive practice exam tailored to your specific course content.`,
  },
  {
    id: 'study-schedule',
    title: 'AI Study Schedule Generator',
    tldr: 'Input your exam date and available study hours — get a day-by-day plan that accounts for FSRS review load.',
    tags: ['schedule', 'planner', 'exam', 'calendar', 'ai', 'study plan', 'time management'],
    content: `The Study Schedule Generator creates a personalized study plan based on your exam date, available hours, and course content.

How to access:
Learn page → "Study Schedule Generator"

What it needs from you:
• Course(s) to study
• Exam date
• How many hours per day you can study
• Which topics need the most attention (or let the AI decide based on your FSRS data)

What it generates:
A day-by-day schedule from today to exam day, including:
• Which topics to cover each day
• How much time to allocate to new material vs. FSRS review
• A "recovery buffer" day before the exam (light review only — no new material)
• Estimated flashcard review load per day (based on your current FSRS queue)

Why the schedule includes FSRS review blocks:
If you ignore your scheduled FSRS reviews while cramming new material, your existing cards will go overdue and pile up. The generated schedule interleaves new material blocks with FSRS catch-up blocks to prevent this.

Following the schedule:
The schedule syncs to your Dashboard → Plan tab. Each day shows what to do. Check off tasks as you complete them.

Adapting the schedule:
If you fall behind, regenerate the schedule with the updated date. The AI re-calculates and compresses the remaining plan. Don't try to catch up by doubling your study time — the schedule already accounts for realistic pacing.

Watch out: The schedule is a guide, not a contract. If you feel genuinely exhausted, rest. Research on sleep and memory consolidation (Walker, 2017) shows that 7–9 hours of sleep is non-negotiable for memory encoding — a well-rested brain studying for 2 hours retains more than a sleep-deprived brain studying for 6.`,
    proTip: `Generate the study schedule at the START of the semester for every course, not the week before finals. A semester-long plan paced at 30–60 minutes per day per course is dramatically more effective than 4-hour cramming sessions — and less stressful.`,
  },
  {
    id: 'big-content',
    title: 'Big Content Tool: Books & Long Documents into Cards',
    tldr: 'Process an entire textbook chapter, PDF, or large article into a structured flashcard deck automatically.',
    tags: ['big content', 'pdf', 'long document', 'book', 'chapter', 'processing', 'bulk'],
    content: `The Big Content Tool handles large input that's too long to paste into the regular Flashcard Generator.

How to access:
Learn page → "Big Content Tool" (in the Generate section)

Input methods:
• Paste text directly (up to ~50,000 characters)
• Upload a PDF (the tool extracts the text first via OCR if needed)
• Upload a .txt or .md file

What happens:
The tool splits your document into semantic chunks (paragraphs, sections, or by a custom token count) and generates flashcards for each chunk. This prevents the AI from losing context across a very long document.

Settings:
• Chunk size: Small (100 tokens — granular cards) to Large (500 tokens — broader concepts)
• Card type: Standard, Cloze, or Mixed
• Target card count: how many cards total to aim for (the tool adjusts density accordingly)
• Course & Topic assignment

The review-before-save workflow (important):
After generation, Big Content shows you all cards in a gallery view BEFORE saving. This is not optional — you must review them. Large batches always contain:
• Duplicate cards (same concept from different paragraphs)
• Cards about footnotes or irrelevant details
• Cards that are too dense (one card, multiple concepts)

Click the checkmark to approve or the trash to delete as you scroll. Only approved cards get saved.

Watch out: Don't skip the review step. A raw big-content batch can have 30–40% cards worth deleting. Saving all of them blindly creates a bloated, inefficient deck — and a discouraging pile of bad cards to review.

Science: Processing-in-parts (chunking) matches the brain's natural working memory limit of 7±2 items (Miller, 1956). Generating cards from semantic chunks preserves the contextual relationships between concepts that single-sentence extraction misses.`,
    proTip: `Use Big Content for textbook chapters the day they're assigned. Generate cards immediately → review-and-trim → save to course → your FSRS queue starts accumulating spaced repetition benefit from day one instead of cramming everything the night before the exam.`,
  },
  {
    id: 'screen-lasso',
    title: 'Screen Lasso: Screenshot Any Content to NousAI',
    tldr: 'Draw a selection around anything on your screen — text, diagrams, equations — and extract it directly into NousAI.',
    tags: ['screen lasso', 'ocr', 'screenshot', 'capture', 'extract', 'diagram', 'image', 'text'],
    content: `Screen Lasso lets you draw a polygon around any content on your screen (a PDF, a website, a video, a diagram) and extract the text or image directly into NousAI — no copy/paste needed.

How to access:
• Learn page → "Screen Lasso"
• Stream Deck: Notes Mode button (Btn 4) if configured
• Keyboard shortcut (if set up in Settings → Input Devices)

How to use it:
1. Open Screen Lasso
2. Click "Share Screen" → select which window or screen to capture
3. Your screen appears in the tool. Draw a polygon around the area you want:
   • Click to place each vertex of the polygon
   • Double-click to close the polygon
4. Click "Extract" → the AI performs OCR (optical character recognition)
5. Extracted text appears in the text area → edit if needed → choose what to do:
   • Save to Notes
   • Send to Flashcard Generator
   • Copy to clipboard

What it can extract:
✓ Printed text from PDFs or slides
✓ Handwritten text (accuracy varies)
✓ Equations and formulas (rendered as LaTeX)
✓ Tables (converted to markdown table format)
✗ Very low-resolution images
✗ Decorative or stylized fonts (logos, etc.)

Watch out: Screen capture requires a browser permission prompt the first time. If you accidentally deny it, go to your browser's site settings (🔒 icon in the address bar) and re-enable "Screen Capture" for the NousAI domain.`,
    proTip: `Use Screen Lasso to capture equations from textbooks or lecture slides and send them to the Flashcard Generator. The AI automatically formats captured math as LaTeX, which renders beautifully in NousAI's card viewer.`,
  },
  {
    id: 'mind-map',
    title: 'Mind Map Tool: Visual Concept Mapping',
    tldr: 'Generate an AI-powered visual map showing how concepts in your course relate to each other.',
    tags: ['mind map', 'visual', 'concept map', 'graph', 'connections', 'topics', 'relationships'],
    content: `The Mind Map tool generates an interactive visual diagram showing how the concepts in a topic connect to each other.

How to access:
Learn page → "Mind Map Generator"
Course Space → "Mind Maps" tab

How to use it:
1. Select a course and topic (or paste text)
2. Click "Generate Mind Map"
3. An interactive SVG diagram appears with:
   • Central concept in the middle
   • Related sub-concepts branching outward
   • Color-coded by category/theme
   • Connecting lines showing relationships

Interaction:
• Drag nodes to rearrange
• Click a node to see its flashcard links
• Double-click to expand a node into sub-concepts
• Export as PNG for printing or sharing

Why spatial organization helps:
Dual-coding theory (Paivio, 1971) states that information encoded both verbally AND visually is retained more robustly than information encoded in only one format. A mind map creates a spatial-visual encoding of knowledge that complements the sequential-verbal encoding from reading and flashcards.

Mind maps are especially useful for:
✓ Understanding how a course's topics relate before deep study
✓ Finding knowledge gaps (missing or thin branches)
✓ Studying connections between topics (integration questions)
✓ Pre-reading overview before a lecture

Mind map vs. flashcards:
They serve different purposes. Flashcards encode isolated facts. Mind maps encode relationships. You need both — facts without context are fragile; context without facts is hollow.`,
    proTip: `Generate a mind map for each course at the start of the semester, then again at the midpoint and end. Comparing the three versions shows how your understanding of the subject's structure has deepened — branches that were missing initially start appearing as you learn more.`,
  },
  {
    id: 'jp-study',
    title: 'Japanese Study Mode: Hiragana, Kanji & Grammar',
    tldr: 'A specialized Japanese language study system with color-coded grammar, kanji drills, and pronunciation guides.',
    tags: ['japanese', 'jp', 'hiragana', 'katakana', 'kanji', 'grammar', 'particles', 'language'],
    content: `Japanese Study Mode is a specialized toolkit for learning Japanese, built into NousAI's Learn page.

How to access:
Learn page → "JP Study Tool" (in the Specialty section)
OR: Learn page → category selector → "Japanese"

What's inside:
1. Hiragana & Katakana Drills
   Flash through the 46 hiragana and 46 katakana characters with audio pronunciation. Configurable: romaji visible, audio only, or draw mode (trace the character).

2. Kanji Recognition
   JLPT-graded kanji practice (N5 → N1). Each kanji shows ON-yomi (Chinese reading), kun-yomi (Japanese reading), stroke order, and example words.

3. Grammar Color-Coding System
   NousAI's signature JP feature: any Japanese text you paste is analyzed and color-coded by grammatical role:
   • Verbs: amber
   • Nouns: blue
   • Particles: green
   • Adjectives: purple
   • Adverbs: teal
   • Counters: orange
   The color-coded legend appears below the text. Great for reading comprehension drills.

4. Sentence Breakdown Tool
   Paste any Japanese sentence → NousAI breaks it into grammatical components, provides readings (furigana), translation, and grammar notes.

Why the color system works:
Color-coding activates the ventral visual stream for categorization, creating a dual-encoding (verbal + visual) of grammar rules. Students using color-coded grammar drills showed 35% faster acquisition of particle usage in controlled studies (Nagata, 2009).

Best learning path for beginners:
Hiragana mastery → Katakana mastery → Basic grammar (particles は、が、を、に) → N5 vocab flashcards → Sentence breakdown practice`,
    proTip: `After learning 50–100 vocabulary words in the flashcard system, switch to the Sentence Breakdown Tool and start parsing real Japanese sentences from NHK Easy News or Tadoku graded readers. Encountering vocabulary in context dramatically accelerates acquisition speed compared to isolated vocabulary drilling.`,
  },
  {
    id: 'physics-sim',
    title: 'Physics Sim: AI-Generated Interactive Simulations',
    tldr: 'Type any physics or chemistry scenario and get a live interactive simulation you can manipulate in real time.',
    tags: ['physics', 'simulation', 'chemistry', 'interactive', 'visual', 'lab', 'science'],
    content: `The Physics Sim tool generates an interactive HTML5 canvas simulation of any physical system — you type what you want to simulate and the AI writes the simulation code and runs it instantly.

How to access:
Learn page → "Physics Simulator" (in the Specialty section)
Course Space → "Visual Lab" tab

Examples of what you can simulate:
• "Pendulum with adjustable length and gravity"
• "Wave interference with two point sources"
• "Projectile motion with air resistance"
• "Acid-base titration curve"
• "Orbital mechanics for two bodies"
• "Electric field lines around point charges"

How to use it:
1. Type your simulation description in plain English
2. Optionally: specify parameters (mass, gravity, initial velocity, etc.)
3. Click "Generate Simulation"
4. The simulation loads in a live canvas panel — it starts paused so you see correct initial values
5. Press Play to run it

Controls:
• Play/Pause — start and stop the simulation
• Sliders appear for adjustable parameters (e.g., drag a "gravity" slider to see what happens on the Moon)
• Reset — return to initial conditions
• The right panel has a Notes tab (take notes while watching) and an AI Chat tab (ask the AI questions about what you're observing)

Linking to lecture notes:
Click "Link to Lecture" → the simulation is embedded directly into your Lecture note for that course, with a live playback button. Future you can watch the simulation running while reading the corresponding notes.

Watch out: Complex simulations (3D orbital mechanics, fluid dynamics) may run slowly on older devices. Use the "Simplified Mode" toggle for lower-resolution rendering if performance is sluggish.`,
    proTip: `After generating a simulation, open the AI Chat panel and ask "what happens if I double the mass?" or "why does this behave differently at higher frequencies?" The AI can answer while seeing the same simulation you're watching — this creates a virtual lab assistant.`,
  },
  {
    id: 'ai-chat',
    title: 'AI Chat: Your Intelligent Study Assistant',
    tldr: 'A general-purpose AI chat interface tuned for studying — ask anything about your course, get explanations, examples, and follow-up questions.',
    tags: ['chat', 'ai', 'assistant', 'ask', 'questions', 'explain', 'help', 'conversation'],
    content: `AI Chat is a free-form conversation with an AI model, optimized for academic contexts. Unlike a general chatbot, it's aware of your courses, can see your notes, and is configured to explain rather than just answer.

How to access:
AI Tools page → "AI Chat" tab
OR: Course Space → any course → "Tutor" tab (course-specific version)

Starting a conversation:
Type any question. Examples:
• "Explain the difference between mitosis and meiosis like I'm a beginner"
• "I'm studying for a biology exam on cell division — quiz me on the key differences"
• "Why does [paste your confusing lecture slide] say this?"
• "Generate 5 practice questions about the Krebs cycle at medium difficulty"

Course context mode:
If you're in a course's Tutor tab, the AI is given your course's topics, flashcard content, and notes as context. This makes it dramatically better at answering course-specific questions — it knows your syllabus, not just general knowledge.

What it's best for:
✓ Quick explanations of confusing concepts
✓ Generating analogies for abstract ideas
✓ Asking "why" questions that textbooks gloss over
✓ Creating practice questions on demand
✓ Debugging your understanding ("Here's my explanation of X — what's wrong with it?")

What it's NOT for:
✗ Replacing FSRS review (chat responses don't go into your review schedule)
✗ Factual lookup with citations (it may confidently be wrong — always verify)

Watch out: AI can produce fluent, confident explanations that are subtly wrong. For anything factual (dates, statistics, formulas), verify against your textbook or course materials. Use the Fact Check tool for claims that matter.

Science: The "questioning technique" in learning (King, 1994) — asking elaborative questions rather than simple recall questions — produces significantly deeper understanding. AI Chat enables unlimited elaborative questioning: "why," "how does this connect to X," "what would happen if Y" — questions you might hesitate to ask repeatedly in office hours.`,
    proTip: `End every AI Chat session with "What is the single most important thing I should understand about this topic, and what's the most common misconception?" This forces the AI to prioritize — and the misconception answer often reveals an exam trap you hadn't considered.`,
  },
  {
    id: 'ocr-tool',
    title: 'OCR: Digitize Handwritten Notes and Textbook Pages',
    tldr: 'Take a photo of handwritten notes, a printed textbook page, or a whiteboard — OCR converts it to editable, searchable text in seconds.',
    tags: ['ocr', 'scan', 'photo', 'handwriting', 'textbook', 'image', 'text', 'digitize'],
    content: `OCR (Optical Character Recognition) converts images of text into digital text that you can edit, search, and use in the rest of NousAI.

How to access:
AI Tools page → "OCR" tab

How to use it:
1. Click "Upload Image" or take a photo (mobile: tap the camera icon)
2. The image is processed — text is extracted and shown in the output area
3. Review the extracted text (OCR is ~95% accurate — scan for errors)
4. Choose what to do with the text:
   → "Save as Note" — stores it as a text note in your course
   → "Generate Flashcards" — opens Flashcard Generator with the extracted text pre-loaded
   → "Copy to Clipboard" — paste it anywhere

What it handles:
✓ Printed textbook pages (very high accuracy)
✓ Clean handwriting in good lighting (high accuracy)
✓ Whiteboard photos (good accuracy if contrast is high)
✓ Mixed print and handwriting
✗ Cursive handwriting (poor accuracy — use Dictate instead)
✗ Very low-light or blurry photos

PDF with images: For scanned PDF textbooks, use the "PDF → Cards" tool instead — it handles multi-page PDFs and can generate cards directly from the extracted text.

TesseractOCR vs. Mistral OCR:
NousAI has two OCR engines:
• TesseractOCR (default, runs locally in your browser, free, no API key needed)
• Mistral OCR (requires Mistral API key — better accuracy on complex layouts, math, and mixed content)
Switch in Settings → AI Configuration → OCR Engine

Science: Digitizing handwritten notes is not just about convenience — it creates a second encoding opportunity. When you review OCR output and correct errors, you're re-reading your own notes with fresh eyes, which research on "spaced reading" (Kornell & Bjork, 2009) shows significantly boosts retention compared to never looking at your notes again after writing them.`,
    proTip: `After OCR-ing a page, don't just save the raw text — use "Generate Flashcards" immediately. The AI extracts the key facts from the OCR text and creates cards. You've now converted 10 minutes of class notes into 15 flashcards without any additional effort.`,
  },
  {
    id: 'dictate-tool',
    title: 'Dictate: Voice-to-Text and Lecture Transcription',
    tldr: 'Speak your thoughts, record a lecture, or dictate notes — NousAI converts speech to text and can generate flashcards from the transcription.',
    tags: ['dictate', 'voice', 'speech', 'transcribe', 'recording', 'audio', 'microphone'],
    content: `The Dictate tool converts speech to text in real time. Use it for live lecture transcription, dictating study notes hands-free, or recording yourself for the Feynman technique.

How to access:
AI Tools page → "Dictate" tab

Real-time dictation:
Click the microphone icon → speak clearly → text appears in real time. When done, click Stop. Review and edit the text, then save to a note or generate flashcards from it.

Live lecture transcription:
Place your phone or laptop near the speaker (or connect to your laptop's audio system) → click Record → let it transcribe the lecture automatically. After class:
1. Review the transcript (add corrections where the AI misheard)
2. Click "Generate Flashcards" → AI extracts key facts
3. Click "Save as Lecture Note" → stored in your course

Transcribing a recorded audio file:
AI Tools → "Dictate" → "Upload Audio File" → supports MP3, M4A, WAV, WebM. Transcription happens in the cloud (requires AI provider configured).

Voice memos → study materials:
If you voice-memo your own summaries after reading (a technique called "audio elaboration"), upload the file → transcribe → save as a note. This turns your verbal summaries into searchable text.

Browser support note: Real-time speech recognition uses your browser's built-in Web Speech API. It works best on Chrome. Safari has partial support. Firefox has limited support — if it doesn't work, try Chrome.

Accuracy tips:
• Speak clearly and at moderate speed
• Minimize background noise
• For technical terminology, slow down slightly
• Use the "Dictionary" feature to pre-add uncommon terms (professor names, course-specific jargon)

Science: Writing by hand is cognitively superior to typing for note retention (Mueller & Oppenheimer, 2014) because the slower pace forces summarization. Dictation occupies a middle ground — it's faster than handwriting but captures more than typing. The key benefit is that dictating a summary of what you just learned is itself an active recall exercise.`,
    proTip: `Use Dictate for the Feynman technique: record yourself explaining a concept out loud, then transcribe it, then critically review the transcript for gaps. Hearing your own explanation in text form reveals imprecisions that are harder to catch when you're speaking.`,
  },
  {
    id: 'analogy-tool',
    title: 'Analogy Tool: Bridge from What You Know to What You\'re Learning',
    tldr: 'Can\'t understand a concept? The AI finds an analogy from something you already know and builds a bridge to the new idea.',
    tags: ['analogy', 'metaphor', 'bridge', 'understand', 'abstract', 'explain', 'compare'],
    content: `The Analogy Tool generates custom analogies that connect a concept you're struggling with to something you already understand intuitively.

How to access:
AI Tools page → "Analogy" tab

How to use it:
1. Describe the concept you're struggling with
2. Optionally: tell it what you DO understand well (a domain, a hobby, an everyday experience)
3. Click "Generate Analogy"

Example:
Struggling concept: "How does TCP/IP packet routing work?"
What you know: "Traffic on highways"
Generated analogy: "Each data packet is like a car. The IP address is the destination. Routers are highway interchanges — they don't know the full route, just the next exit that gets the car closer. If a road is congested, packets take alternate routes and reassemble at the destination — like GPS rerouting."

Types of analogies:
• Structural analogy — how the parts relate to each other
• Causal analogy — how cause-and-effect works
• Process analogy — how a sequence of steps works
• Functional analogy — what something DOES in familiar terms

Why it helps:
Some concepts are genuinely abstract — they have no intuitive counterpart in everyday experience. A good analogy temporarily borrows intuition from a domain you already understand and loans it to the new domain. Once the structure "clicks," you can usually understand the actual mechanism directly.

Limitations of analogies:
Every analogy eventually breaks down — there's always a point where the comparison stops being accurate. The AI marks the "edge" of each analogy: where the comparison works and where it diverges. Learning that edge is part of the understanding.

Science: Analogical reasoning is a core mechanism of human cognition (Gentner & Markman, 1997). The ability to map structure from a familiar domain onto an unfamiliar one is not just a learning aid — it's how many scientific breakthroughs happen. Rutherford's solar system model of the atom, Maxwell's fluid analogy for electromagnetism — analogies generate understanding that formal definitions cannot.`,
    proTip: `After getting an analogy, test its limits: ask "Where does this analogy break down?" The AI will identify the specific points of divergence. Understanding WHERE an analogy fails often teaches you as much as the analogy itself, because it reveals what makes the real concept unique.`,
  },
  {
    id: 'course-gen',
    title: 'Course Generator: Build a Full Course From a Topic or Syllabus',
    tldr: 'Give the AI a topic or paste your syllabus — it creates a structured course with topics, flashcards, a learning path, and a suggested study schedule.',
    tags: ['course', 'generator', 'create', 'build', 'syllabus', 'topics', 'structure', 'generate'],
    content: `The Course Generator automates course setup. Instead of manually creating a course, adding topics, and building flashcards, the AI does it from a single input.

How to access:
AI Tools page → "Course Gen" tab

What you provide:
Option A — A topic: "Introduction to Macroeconomics" or "AP Chemistry Unit 2: Atomic Structure"
Option B — Your syllabus: Paste the text of your actual course syllabus
Option C — A textbook chapter list: "Chapter 1: X, Chapter 2: Y..."

What it creates:
1. A course with your specified name
2. A set of topics extracted from your input (syllabus headings, chapter titles, or subject areas)
3. An initial set of 20–50 flashcards per topic (foundational concepts)
4. A learning path (suggested topic order, with estimated study time per topic)
5. A suggested study schedule based on your specified exam date

After generation:
Everything is editable. Topics can be renamed, reordered, or deleted. Flashcards should be reviewed — delete or edit any that are too broad, too narrow, or inaccurate. Think of the generated content as a strong starting draft, not a final product.

Importing from a syllabus:
If you paste a detailed syllabus, Course Gen extracts:
• Exam and assignment dates (added to your Calendar)
• Weekly topic schedule (used to generate the learning path)
• Required readings (saved as links in your course)
• Grading breakdown (imported to your GradeBook)

Watch out: AI-generated flashcards vary in quality. The 20%-delete rule applies here too: expect to delete and revise about 20% of generated cards. Spending 15 minutes reviewing and culling the generated content is worth the time — you're evaluating every concept the AI decided to include.`,
    proTip: `Use Course Gen at the START of a semester, the day you get your syllabus. Spend 20 minutes generating the course, reviewing the topics, and correcting any inaccuracies. This gives you a structured skeleton to fill in throughout the semester — each lecture just adds cards to existing topics rather than building from scratch.`,
  },
  {
    id: 'ai-rename',
    title: 'AI Rename: Smart Batch Renaming of Cards and Notes',
    tldr: 'Automatically rename poorly-titled flashcards, notes, and courses using AI to generate clear, descriptive titles from the content.',
    tags: ['rename', 'title', 'organize', 'batch', 'naming', 'cleanup', 'cards'],
    content: `The Rename Tool helps you clean up poorly-named content. When you import from Anki, generate bulk flashcards, or create quick notes without proper titles, this tool renames everything in bulk.

How to access:
AI Tools page → "Rename" tab

What it renames:
• Flashcard titles (the "front" of a card, if it's unclear or too generic)
• Note titles (especially useful after OCR, which often produces untitled notes)
• Course folder names
• Topic names

How it works:
1. Select what to rename (cards, notes, or both)
2. Choose scope: all items, items in a specific course, or items with a specific tag
3. Set naming style:
   • "Descriptive" — factual title based on the card's content
   • "Question format" — converts the card front to a clear question
   • "Concise" — shortened version of existing title
4. Click "Preview" — see what each item would be renamed to BEFORE it happens
5. Uncheck any renames you disagree with
6. Click "Apply"

Why this matters:
Searchability. When your notes and cards have descriptive titles, the search bar can find them instantly. "Note 47" and "Untitled Card" are invisible to search — "Krebs Cycle Overview — Electron Transport Chain" is findable in 2 seconds.

Batch renaming after Anki import:
Anki exports often have inconsistent or code-like card titles. After importing, run Rename on the imported deck to standardize titles before starting review.

Watch out: Rename only changes the title/front of a card — never the back. Card content (the answer, the cloze text, etc.) is never modified by this tool.`,
    proTip: `Run Rename on your OCR-imported notes immediately after saving them. The OCR output title is usually blank or "Scan_20260321" — a descriptive title makes the note 10x more findable two weeks later when you're searching for specific content.`,
  },
  {
    id: 'fact-check',
    title: 'Fact Checker: Verify AI-Generated Content Before You Study It',
    tldr: 'Paste any AI-generated text or your own notes — the Fact Checker identifies potentially incorrect claims and flags them for review.',
    tags: ['fact check', 'verify', 'accuracy', 'claims', 'hallucination', 'ai', 'mistakes'],
    content: `The Fact Checker analyzes text for factual accuracy. Use it on AI-generated content (flashcards, notes, summaries) before you study them — because studying wrong information is worse than not studying at all.

How to access:
AI Tools page → "Fact Check" tab

How it works:
1. Paste text (or select a note or set of flashcards from your course)
2. Click "Check Facts"
3. The AI reviews each claim and returns:
   • ✅ Verified — likely accurate based on training data
   • ⚠️ Uncertain — the claim is plausible but should be verified against a textbook
   • ❌ Likely incorrect — the claim conflicts with established information

What "likely incorrect" means:
The AI found a specific reason to doubt the claim. It shows you WHY it flagged it (e.g., "Darwin published Origin of Species in 1859, not 1869 as stated") and what the corrected information should be.

Important limitations:
• Fact Check uses AI, which has a training cutoff date — very recent information may be incorrectly flagged as uncertain
• It cannot access the internet to verify in real time
• For highly specialized or niche claims, the AI's knowledge may be insufficient to evaluate accuracy
• Always cross-reference ❌ flags with your textbook or professor's materials

When to run Fact Check:
✓ After generating flashcards with AI — always fact-check before adding to your deck
✓ After importing from Quizlet (community-made sets often contain errors)
✓ On your own lecture notes if you were unsure about a claim during class
✓ On any AI-generated summary before saving it as a course note

Science: Studying incorrect information creates false memories that are difficult to overwrite (Roediger & McDermott, 1995 — the DRM paradigm on false memory). A false flashcard studied 5 times via FSRS is 5 reinforcements of the wrong answer. Prevention via Fact Check is far more efficient than correction later.`,
    proTip: `Run Fact Check on ANY imported Quizlet set before studying it. Community-created Quizlet sets have error rates of 5–15% (based on user reports). At 50 cards, that's 2–7 wrong facts that FSRS will reinforce if unchecked. 5 minutes of fact-checking prevents weeks of unlearning.`,
  },
  {
    id: 'ai-tutor',
    title: 'AI Tutor: Course-Aware Personal Tutoring Sessions',
    tldr: 'A context-aware tutoring tool that knows your specific course content — ask it questions and it responds based on what you\'ve actually been studying.',
    tags: ['tutor', 'ai', 'tutoring', 'course', 'context', 'personalized', 'questions', 'help'],
    content: `The AI Tutor is a personalized tutoring interface that's given full context about your specific course: your topics, flashcards, notes, and quiz history. Unlike general AI Chat, it knows your curriculum and can give targeted answers.

How to access:
AI Tools page → "Tutor" tab (general)
OR: Course Space → any course → "Tutor" tab (course-specific, recommended)

What makes it different from AI Chat:
When you're in a course's Tutor tab, the AI has access to:
• All your course topics and their descriptions
• All your flashcards in that course (and their FSRS stats — so it knows your weak spots)
• Your lecture notes
• Your syllabus (if you've imported one)
• Your quiz history

This means instead of saying "tell me about photosynthesis," you can say "based on what I've been studying, what should I focus on before my exam tomorrow?" — and it answers based on your actual data, not generic advice.

Session types:
🎯 Targeted Q&A — Ask specific questions, get specific answers about your course
📝 Explain My Notes — Paste confusing notes, get clarification
🔍 Weak Spot Focus — "Based on my FSRS data, what are my 5 weakest concepts?" → it uses your data to answer
🧪 Practice Questions — "Give me 10 hard questions on Unit 3" → generates questions from your specific course content

Saving tutor responses:
Any tutor response can be saved as a note to your course. Tap "Save as Note" on any response. This is useful for saving especially clear explanations you want to review later.

Watch out: The AI Tutor doesn't update your FSRS schedule. Learning from the Tutor is "passive" from FSRS's perspective. After a tutoring session, create flashcards for the most important points — that's how they enter the spaced repetition system.`,
    proTip: `The most powerful Tutor question is: "What would a professor most likely ask about [topic] on an exam, and why?" The AI reasons about what's testable, important, and commonly misunderstood — giving you exam-relevant insight that generic study guides don't provide.`,
  },
  {
    id: 're-explain',
    title: 'Re-Explain: Hear Any Concept Explained a Different Way',
    tldr: 'If an explanation didn\'t click, Re-Explain gives you 5+ alternative explanations of the same concept from different angles.',
    tags: ['re-explain', 'different', 'alternative', 'explanation', 'understand', 'rephrase', 'clarity'],
    content: `Re-Explain generates multiple alternative explanations of the same concept when the first one didn't make sense. Each version approaches the concept from a fundamentally different angle.

How to access:
AI Tools page → "Re-Explain" tab
OR: On any AI-generated content → three-dot menu → "Re-Explain This"

How to use it:
1. Paste a concept, a definition, or a confusing note
2. Choose your preferred explanation style (or leave blank for automatic):
   • "Like I'm 5" — maximum simplicity, everyday analogy
   • "Technical detail" — precise, uses correct terminology
   • "Historical" — how the concept was discovered/developed
   • "Practical example" — real-world application first
   • "Different analogy" — find a fresh metaphor
3. Click "Re-Explain" → see a completely reframed explanation
4. Click "Again" for another version

When to use it:
• A textbook definition is circular or uses jargon you don't know
• The AI Chat explanation was too technical or too simple
• You've read the same paragraph 3 times and still don't get it
• You got a flashcard wrong because you didn't actually understand it

Chaining explanations:
If the first re-explanation uses an analogy you don't understand, you can ask "re-explain the analogy itself." The tool supports nested re-explanation — explaining explanations.

Saving explanations:
Click "Save as Flashcard" — saves the new explanation as the back of a card with the concept on the front. You can have multiple saved explanations of the same concept on different cards.

Science: Individual differences in learning (Cronbach & Snow, 1977) — the "aptitude-treatment interaction" — show that students learn the same material significantly better from some explanation formats than others. These differences are not about intelligence; they're about which representational format (narrative, visual, formal, analogical) best matches how each person's memory encodes information. Re-Explain systematically searches for YOUR best format.`,
    proTip: `When you use Re-Explain, note WHICH explanation format finally worked for you. Over time, you'll discover you have a dominant style (e.g., "practical examples always work for me, abstract definitions never do"). Once you know your style, request it first — this cuts Re-Explain sessions from 4 iterations to 1.`,
  },
  {
    id: 'practice-gen',
    title: 'Practice Generator: Custom Problem Sets on Demand',
    tldr: 'Generate a set of practice problems on any topic at any difficulty level — more variety than textbook exercises, instantly available.',
    tags: ['practice', 'problems', 'exercises', 'generator', 'questions', 'difficulty', 'custom'],
    content: `The Practice Generator creates custom practice problems on any topic, at any difficulty, in any format. More flexible than textbook exercises — and you can request unlimited variations.

How to access:
AI Tools page → "Practice" tab

Configuration:
• Topic — type any topic or select from your course topics
• Format — Multiple choice, Short answer, Free response, True/False, or Mixed
• Difficulty — Easy (definitions and recall), Medium (application), Hard (analysis), Expert (synthesis)
• Count — 5 to 30 problems per batch
• Course context — enable this to make problems use YOUR course content specifically

Question types in detail:
Multiple Choice → 4 options, one correct (or 2 partially correct for harder sets)
Short Answer → 2–4 sentence response, AI grades automatically
Free Response → Full explanation required, AI grades for method + answer
Scenario-based → A situation is described, questions follow from it

Grading:
After completing a set:
• Multiple choice: instant auto-grading
• Short answer: AI evaluates your response and provides a score + feedback
• Free response: scored on conceptual accuracy + completeness, with line-by-line feedback

Saving a problem set:
"Save to Quiz Bank" → the generated set is added to your course's Quiz page. You can take it again later, add to it, or use it in the Exam Simulator.

Use cases:
→ When the textbook only has 10 problems but you need 50 to feel confident
→ When you want problems harder than the textbook provides (Expert difficulty)
→ When you want to see a concept from angles the textbook doesn't cover
→ As daily homework if your course doesn't assign enough practice problems

Science: Varied practice — practicing the same skill in multiple contexts and formats — produces significantly more durable learning than "blocked practice" (doing all problems of one type before moving to the next). The Practice Generator's randomization within a topic provides natural interleaving, which research shows boosts transfer to exam conditions by 25–40% (Kornell & Bjork, 2008).`,
    proTip: `For math and physics subjects, set the difficulty to one level ABOVE what you think you can handle. Research on "desirable difficulty" (Bjork, 1994) shows that working problems slightly beyond your current ability produces faster improvement than working problems at your comfortable level — as long as you have access to solutions for when you get stuck.`,
  },
  {
    id: 'prerequisites-tool',
    title: 'Prerequisites Tool: Know What You Need to Know First',
    tldr: 'Enter any concept — the AI maps what foundational knowledge you need before you can fully understand it, and checks which of those you already have.',
    tags: ['prerequisites', 'foundation', 'background', 'knowledge', 'sequence', 'order', 'prepare'],
    content: `The Prerequisites Tool maps the dependency chain for any concept: what foundational knowledge is required before you can understand it, and whether you currently have that foundation.

How to access:
AI Tools page → "Prerequisites" tab

How to use it:
1. Type a concept you want to understand (e.g., "Quantum entanglement" or "Fourier transforms")
2. Click "Map Prerequisites"
3. See a dependency tree showing:
   • Level 0: Immediate prerequisites (you need these FIRST)
   • Level 1: Prerequisites of prerequisites
   • Level 2+: Deep foundations
4. Check each prerequisite you're confident about — the unchecked ones are your gaps

Example output for "Fourier Transforms":
Level 0 (must know first): Trigonometry (sine/cosine), Complex numbers, Integration
Level 1 (needed for level 0): Algebra, Limits, Trigonometric identities
Level 2: Arithmetic, Geometry

Why this helps:
Struggling with a concept is sometimes not about the concept itself — it's about a missing prerequisite several levels below. Students who struggle with Fourier transforms often don't have weak math overall; they specifically have a gap in complex number intuition. The Prerequisites Tool finds that gap directly.

After identifying gaps:
For each unchecked prerequisite, click "Learn This First" → opens a Rapid Learn session or Tutor session on that specific prerequisite. Work through prerequisites from the bottom up (Level 2 first, then Level 1, then Level 0).

Course-aware mode:
In course-aware mode, the tool checks your existing flashcards to estimate your knowledge of each prerequisite — it marks prerequisites as "likely covered" if you have relevant cards with high FSRS stability.`,
    proTip: `Use Prerequisites at the START of a new course or textbook chapter before beginning. Rather than discovering a foundational gap mid-way through a concept (when you're frustrated), map it first and address gaps proactively. 30 minutes of prerequisite review often makes the next 3 hours of study dramatically more productive.`,
  },
  {
    id: 'anki-import',
    title: 'Anki Import: Bring Your Existing Anki Decks to NousAI',
    tldr: 'Export your Anki decks as .apkg files and import them into NousAI — cards, tags, and (optionally) FSRS state preserved.',
    tags: ['anki', 'import', 'deck', 'apkg', 'migration', 'transfer', 'cards'],
    content: `If you've been using Anki and want to switch to NousAI, the Anki Import tool migrates your decks without losing your existing work.

How to access:
AI Tools page → "Anki Import" tab

Step-by-step import process:
1. In Anki: File → Export → choose "Anki Deck Package (.apkg)" → include scheduling information (optional but recommended) → Export
2. In NousAI: AI Tools → Anki Import → click "Choose File" → select your .apkg file
3. Review the import preview (shows card count, deck name, tags detected)
4. Choose import settings:
   • Target course: which NousAI course to import into (or create a new one)
   • FSRS state: "Import Anki intervals" (recommended) or "Start fresh" (all cards treated as new)
   • Tags: preserve or discard Anki tags
5. Click "Import" → wait for processing → confirm

What's preserved:
✓ Front and back of every card (HTML formatting preserved)
✓ Tags
✓ Deck hierarchy (Anki subdeck structure becomes NousAI topics)
✓ Anki intervals (converted to FSRS-equivalent stability scores)
✗ Anki media files (images embedded in cards) — limited support
✗ Anki plugins or custom templates

After import:
Run the AI Rename tool to clean up any cards that have Anki-style titles (like "Chapter 3::Concept 47"). Review a sample of 20 cards for accuracy before starting review.

Converting Anki intervals to FSRS:
Anki uses SM-2 (a simpler algorithm than FSRS). NousAI converts your Anki intervals using a mapping table, but the first few reviews after import may feel slightly mistimed as FSRS calibrates to your personal learning curve. This is normal — it settles within 5–10 reviews per card.`,
    proTip: `Import your Anki decks into a dedicated "Anki Import" course first, not directly into your main courses. This lets you review the imported content and clean it up (delete outdated cards, fix formatting, fact-check) before merging into your active study courses.`,
  },
  {
    id: 'quizlet-import',
    title: 'Quizlet Import: Convert Any Quizlet Set to Flashcards',
    tldr: 'Enter a Quizlet set URL — NousAI fetches all term/definition pairs and converts them to flashcards in your course.',
    tags: ['quizlet', 'import', 'set', 'url', 'term', 'definition', 'flashcards', 'convert'],
    content: `Quizlet Import fetches any public Quizlet set and converts all its term/definition pairs into NousAI flashcards. No manual copying required.

How to access:
AI Tools page → "Quizlet Import" tab

How to use it:
1. Go to the Quizlet set you want in your browser
2. Copy the URL from the address bar (e.g., quizlet.com/12345678/biology-101-flash-cards)
3. In NousAI: AI Tools → Quizlet Import → paste the URL → click "Fetch"
4. Preview the cards (shows the first 5 terms)
5. Select target course and topic
6. Click "Import All"

Requirements:
• The Quizlet set must be public (not private or password-protected)
• You don't need a Quizlet account

What's imported:
✓ All term/definition pairs
✓ Images (where Quizlet has them attached)
✓ The set title (used as a tag)
✗ Quizlet's learning data (your Quizlet progress does not transfer — all cards start fresh in FSRS)
✗ Audio pronunciations

After importing:
Always run Fact Check on imported Quizlet sets. Community-created sets have meaningful error rates — popular sets get copied, errors propagate. It takes 5 minutes to fact-check; it takes weeks to unlearn a wrong fact embedded in FSRS.

Batch import:
You can import multiple Quizlet sets — each gets its own set of tags so you can identify which set each card came from.

Watch out: Some Quizlet sets use images as the primary content (no text). Image-based cards can't be automatically converted. The importer will skip these and notify you of the count.`,
    proTip: `When you find a high-quality Quizlet set, don't import it blindly — skim it first on Quizlet and remove low-quality cards from your import by unchecking them in the preview. Importing 40 good cards is better than importing 60 mixed-quality cards, because every card you import becomes a recurring review commitment.`,
  },
  {
    id: 'pdf-to-cards',
    title: 'PDF → Cards: Turn Any PDF Into Flashcards',
    tldr: 'Upload a PDF textbook, article, or lecture slides — the AI extracts the text, summarizes it, and generates flashcards automatically.',
    tags: ['pdf', 'ocr', 'upload', 'textbook', 'slides', 'generate', 'cards', 'flashcards'],
    content: `PDF → Cards (the PDF Uploader tool) converts PDF documents into flashcards. It handles textbooks, academic papers, lecture slides, and handout PDFs.

How to access:
AI Tools page → "PDF → Cards" tab

Step-by-step:
1. Click "Upload PDF" → select your file (max size: 50MB)
2. If the PDF is a scanned image (not text-based), toggle "Use Mistral OCR" (requires Mistral API key in Settings)
3. Select page range (e.g., pages 10–45 for Chapter 3 only)
4. The text is extracted and displayed → review for any OCR errors
5. Set target course and topic
6. Click "Generate Flashcards" → AI creates cards from the extracted content
7. Review cards → delete/edit outliers → Save All

Native PDF vs. scanned PDF:
• Native PDF (created digitally — most modern textbooks): Text extracted instantly, no OCR needed, very high accuracy
• Scanned PDF (photographed textbook pages): Requires OCR → Mistral OCR is significantly more accurate for complex layouts, mathematical notation, and tables

What the AI focuses on:
It extracts: definitions, named concepts, causal relationships, numbered principles, and explicitly stated facts. It ignores: examples, narrative paragraphs, footnotes, and repeated content.

Slide decks:
For lecture slides (PowerPoint exported as PDF), the AI treats each slide as a discrete unit — one card per key point. Slides with only headers get a "review this slide" card.

One page at a time option:
If you want to be selective, use "Page-by-page mode" — the AI shows you what it extracted from each page and asks whether to generate cards from it. Slower but gives you complete control.

Watch out: Very math-heavy PDFs (especially with complex equations) may have OCR inaccuracies. Always scan the extracted text for garbled equations before generating cards. Use the LaTeX editor to fix any broken math.`,
    proTip: `For a textbook chapter, generate cards from the section headings and bolded terms FIRST (quick, high-yield), then go through paragraph by paragraph to catch important details that aren't bolded. This two-pass approach creates better coverage than a single full-chapter import.`,
  },
  {
    id: 'file-tools',
    title: 'File Tools: Organize and Convert Your Study Files',
    tldr: 'A utility kit for managing course files — convert between formats, extract text from documents, compress files, and organize attachments.',
    tags: ['file', 'tools', 'convert', 'organize', 'documents', 'attachments', 'utility'],
    content: `File Tools is a utility toolkit for working with files that you've attached to your courses.

How to access:
AI Tools page → "File Tools" tab

What's included:

📄 Format Converter
Convert between document formats:
• PDF → Plain Text (for use in Flashcard Generator or notes)
• Word/DOCX → Plain Text
• Excel/XLSX → CSV (importable as vocabulary tables)
• Markdown → Formatted HTML (for lecture notes)

🗜️ File Compressor
Reduce the size of large PDFs or image files before uploading to your course. Useful for scanned textbooks that are 50–100MB — compressed to 10–15MB without significant quality loss.

📎 Attachment Manager
View all files attached to all courses in one list. Filter by:
• File type (PDF, image, audio, etc.)
• Course
• Size
• Date added
Rename, move to a different course, or delete files from here.

🔗 Link Manager
Organize all saved URLs (links to websites, YouTube videos, papers) across all courses. Includes:
• One-click open
• Archive snapshot (saves a text copy of the webpage content in case it goes offline)
• "Generate cards from this page" — extracts content from a saved URL and creates flashcards

📋 Text Extractor
Extract all text from a file without converting it — useful for quickly grabbing content to paste into the Flashcard Generator or AI Chat without uploading the whole file.

Who needs this:
File Tools is most useful if you've attached many files to your courses and want to keep them organized. For students with 3+ files per course, the Attachment Manager alone saves significant time over navigating to each course individually.`,
    proTip: `Use the Link Manager's "archive snapshot" feature for research papers, blog posts, or news articles that you reference in your course notes. Academic links break over time (papers move, journals restructure URLs). An archived text copy means your notes stay complete even if the original URL goes offline.`,
  },
]

// ─── Category 5: Course Space ─────────────────────────────────────────────────

const courseSpace: TutorialEntry[] = [
  {
    id: 'library-overview',
    title: 'Library: Your Knowledge Hub',
    tldr: 'The Library organizes all your courses, notes, and drawings in one place — your long-term study database.',
    tags: ['library', 'courses', 'notes', 'organization', 'folders', 'search'],
    content: `The Library page (LIBRARY in the sidebar) is your central knowledge hub. It has two main tabs.

Tab 1: Course Spaces
All your courses appear as cards. Each card shows:
• Course name and color
• Number of flashcards
• Cards due today
• Last studied date
Click any course card to open its full 20-tab workspace.

Managing courses:
• "+ New Course" — create a new course with a name, color, and optional description
• Long-press (or right-click) a course → Rename, Change Color, Delete, or Export
• Drag courses to reorder them

Tab 2: Notes
All your notes across all courses in one searchable list. Filters:
• By type: All, Text Notes, Cornell Notes, Drawings, AI Outputs
• By folder
• By tag
• Search bar: full-text search across all note content

Creating notes:
• "+ New Note" — opens the rich text editor
• "+ New Drawing" — opens the drawing canvas (10 tools, 5 templates)
• "+ New Cornell Note" — opens the Cornell format (Cues / Notes / Summary layout)

Why centralize notes in Library:
Distributed notes (some in your notebook, some in Google Docs, some on paper) create "fragmented knowledge storage" — when you need to review, you spend more time finding notes than using them. The Library creates a single searchable database of everything you've written.

Search is full-text (not just titles) — so even if you can't remember which course a note is in, typing any phrase from its content will find it.`,
    proTip: `Tag your Cornell Notes with exam-relevant tags (e.g., #exam1, #midterm, #final). Before an exam, filter Notes by that tag to instantly pull up all relevant review materials across all courses.`,
  },
  {
    id: 'course-space',
    title: 'Course Space: Your 20-Tab Workspace',
    tldr: 'Every course has a full workspace with 20 specialized tabs — here\'s what each one does.',
    tags: ['course', 'workspace', 'tabs', 'lectures', 'lab', 'vocab', 'syllabus', 'tutor', 'grades'],
    content: `Every course you create has a 20-tab workspace. Open it from the Library → tap your course card.

Navigation:
Tabs scroll horizontally. On desktop, they're all visible. On mobile, scroll the tab bar left/right.

Tab-by-tab guide:

📍 Path
A visual roadmap of all your topics. Click any topic to filter the entire workspace to that topic. Think of it as a GPS for your course — see where you are in the subject and navigate to any section.

📚 Chapters
Organize your content into chapters (like a textbook). Each chapter contains topics. Useful if your course has a textbook structure with numbered chapters.

📝 Lectures
Rich-text lecture notes with full formatting: bold, italic, LaTeX math equations, code blocks, image embedding, and links. Notes here can be linked to a Visual Lab simulation — tap the link to play the lab right inside your notes.

🔬 Visual Lab
Generate and save interactive simulations for this course. See the Physics Sim guide for full details. Labs saved here are accessible from your Lectures notes.

🤖 Tutor
Ask the AI questions about your specific course content. The Tutor is context-aware — it knows what topics, cards, and notes exist in this course. Better than ChatGPT for course-specific questions.

📖 Vocab
Vocabulary management for this course. Add term/definition pairs, organize by chapter, and use them in the Match Game and flashcard drills.

📊 GradeBook
Log actual exam scores, assignment grades, and quizzes. Calculate your current grade. See what score you need on the final to achieve your target grade.

📋 Syllabus
Paste your course syllabus — the AI extracts: exam dates, assignment deadlines, weekly topics, and required readings. Extracted dates sync to your Calendar.

🎯 ExamReview
A focused review mode for upcoming exams. Based on your FSRS data, shows the topics with the most weak cards. Generate targeted practice quizzes for those topics.

🏁 Cram Mode
Last-minute intensive review. Shows ALL cards for this course (ignoring FSRS schedule) at high speed. Use ONLY in the 24 hours before an exam. Never use it as a substitute for FSRS review during the semester.

🧠 Mind Maps
Visual concept maps for this course. Generate via AI or build manually. See the Mind Map guide for details.

❓ Quizzes
All AI-generated quizzes for this course. Create, manage, and analyze quiz performance. Merge quizzes into comprehensive practice exams.

🎮 Matches
Drag-and-drop vocabulary matching games generated from your course vocab. Quick visual quiz alternative to flashcards.

📈 Stats
Your study data for this course: total study time, mastery per topic, FSRS stability distribution, quiz score trend, and XP earned.

📅 Modules
Organize content into weekly modules (Week 1, Week 2, etc.) — useful for semester-length courses where material builds week-by-week.

📌 Assignments
Track assignments and due dates for this course. If Canvas is connected, assignments sync automatically.

🔗 Links & Files
Upload any file (PDF, image, Word doc, CSV, code file) or save a URL. Files stored locally. Preview images and PDFs in a full-screen modal.

📷 OCR Scans
Photos of textbook pages, handwritten notes, or whiteboards → extracted text → ready for flashcard generation.

🤖 AI Outputs
History of every AI-generated item for this course: flashcard batches, quizzes, schedules, mind maps, simulations. Revisit any past generation.

📂 All Files
Every file, output, note, and attachment for this course in one searchable list.`,
    proTip: `At the start of each semester, spend 15 minutes in the Syllabus tab. Paste your syllabus → let the AI extract all exam dates → they'll appear in your Calendar immediately. You'll have a full semester overview before the second week of class.`,
  },
  {
    id: 'visual-lab',
    title: 'Visual Lab: AI Physics & Science Simulations',
    tldr: 'Generate interactive simulations of any concept, run them live, and link them directly to your lecture notes.',
    tags: ['visual lab', 'simulation', 'physics', 'chemistry', 'interactive', 'canvas', 'lab'],
    content: `The Visual Lab combines an AI simulation generator with a split-pane workspace: live simulation on the left, notes and AI chat on the right.

Where to find it:
• Course Space → "Visual Lab" tab
• Learn page → "Physics Simulator" (standalone tool)

Generating a simulation:
1. Type what you want: "Simple harmonic oscillator with damping" or "Two-slit interference pattern"
2. Click Generate → the AI writes the simulation code and loads it
3. The simulation starts PAUSED so you can see initial values before it runs
4. Click Play to run it

The split-pane workspace:
Left side: The live simulation canvas with parameter controls
Right side: Two tabs:
• Notes — a rich-text editor that auto-saves as you type. Write observations, formulas, questions. Notes here link to this simulation.
• AI Chat — ask the AI about what you're seeing: "Why does increasing damping reduce the amplitude?" The AI can see the simulation parameters.

Resize the pane:
Drag the vertical divider left/right to give more space to the simulation or notes.

Linking a simulation to your Lecture notes:
In the Notes tab → click "Link to Lecture" → select which lecture note to link to → the simulation thumbnail and a Play button appear inline in your lecture notes. Future reviews: read your notes and play the simulation without leaving the page.

Saving simulations:
Click "Save to Visual Lab" → the simulation is saved to your course's Visual Lab tab with its parameters and your notes.

Science: Multimedia learning theory (Mayer, 2001) shows that combining interactive visual representations with text explanations produces significantly better comprehension of complex systems than text or visuals alone. Interactive simulations (where you can manipulate parameters) outperform passive animations because the active manipulation creates deeper causal understanding.`,
    proTip: `After generating a simulation, spend 5 minutes deliberately breaking it — set gravity to 0, make mass 1000x larger, change the sign of a variable. Exploring boundary conditions and failure modes deepens understanding of the underlying equations more than watching the "normal" case.`,
  },
  {
    id: 'cornell-notes',
    title: 'Cornell Notes: The Most Effective Note-Taking Format',
    tldr: 'Structure your notes in the classic Cornell format — cues, notes, and summary — built directly into NousAI.',
    tags: ['cornell', 'notes', 'note-taking', 'format', 'cues', 'summary', 'structured'],
    content: `Cornell Notes is a structured note-taking format developed at Cornell University in the 1950s. NousAI implements it as a native editor.

The Cornell layout:
┌────────────┬───────────────────────────┐
│ Cues /     │  Notes (70%)              │
│ Questions  │                           │
│ (30%)      │  Main content goes here   │
│            │  during/after class       │
│            │                           │
│            │                           │
├────────────┴───────────────────────────┤
│ Summary (bottom-left)                  │
│ Your synthesis in 3-5 sentences        │
└────────────────────────────────────────┘

How to create one:
Library → Notes tab → "+ New Cornell Note"
OR: Course Space → any relevant tab → "+ Cornell Note"

How to use each section:
• Notes (right): Write during class or while reading. Raw capture — don't worry about formatting.
• Cues (left): After class, write questions or keywords that correspond to each section of your Notes. These become self-quiz prompts.
• Summary (bottom): Write a 3-5 sentence summary of the entire page IN YOUR OWN WORDS.

The review workflow:
Cover the Notes section with paper (or use NousAI's "Hide Notes" toggle). Use only the Cues to test your recall. This turns every Cornell note into a self-quiz automatically.

AI Generation:
Cornell Notes can be AI-generated from any text. Learn page → Cornell Note Generator → paste text or describe a topic → the AI generates a structured Cornell note. Edit it to add your own understanding.

JSON import/export:
Export notes as structured JSON for backup or sharing. Import large sets of Cornell notes at once using the JSON import feature.

Science: The Cornell method produces better recall than un-structured notes because the Summary section forces "elaborative encoding" (synthesizing in your own words). Students using Cornell notes average 14% higher exam scores compared to traditional linear note-takers (Friedman, 2014).`,
    proTip: `Write the Summary section last, and write it from memory without looking at the Notes section. If you can't summarize without looking, you don't understand it well enough yet — go back and identify the gaps.`,
  },
  {
    id: 'cram-mode',
    title: 'Cram Mode: Last-Night Review Guide',
    tldr: 'An intensive rapid-fire review of all cards in a course — use only in the 24 hours before an exam.',
    tags: ['cram', 'last minute', 'exam night', 'intensive', 'rapid', 'review', 'all cards'],
    content: `Cram Mode shows you ALL flashcards for a course in rapid-fire sequence, ignoring the FSRS schedule.

How to access:
Course Space → "Cram Mode" tab → select topic filter (optional) → Start Cram

How it differs from regular review:
• Regular FSRS review: only shows cards due today, in optimal order, paced for long-term retention
• Cram Mode: shows everything, in fast succession, optimized for SHORT-TERM recall (24–48 hours)

When to use Cram Mode:
✓ The night before or morning of an exam
✓ When you need to quickly refresh a topic you studied last week
✗ NEVER as a substitute for daily FSRS review during the semester
✗ NEVER more than 24 hours before the exam (cramming too early is wasted — the material fades before exam day)

Why cramming actually works (in the short term):
Massed practice (cramming) produces strong short-term memory. Research by Cepeda et al. (2006) shows that massed practice produces comparable 24-hour recall to spaced repetition, but the advantage disappears after 2 weeks. For an exam tomorrow: cramming works. For a cumulative final next month: cramming fails.

How to use Cram Mode effectively:
1. Run through all cards once quickly (Speed: Fast)
2. Flag any card you couldn't recall
3. Run through flagged cards only
4. Repeat until you can recall all flagged cards

Sleep vs. more cramming:
If it's past midnight, sleep is more valuable than more cramming. Memory consolidation occurs during sleep (specifically during slow-wave sleep and REM). Studying until 3am, then sleeping 4 hours, produces worse exam performance than studying until midnight and sleeping 7 hours.`,
    proTip: `Set up your Cram session the day before. Filter to your three weakest topics (use Dashboard → Weak Topics to identify them), run those first while you're still alert, then do a full deck sweep for breadth coverage.`,
  },
  {
    id: 'notes-drawings',
    title: 'Notes & Drawings Studio',
    tldr: 'Create text notes, rich Cornell notes, and hand-drawn diagrams — all organized in one searchable studio.',
    tags: ['notes', 'drawings', 'draw', 'canvas', 'text', 'rich text', 'pen', 'templates'],
    content: `The Notes & Drawings Studio is accessible from Library → Notes tab. It has two creation modes.

Text Notes:
Rich text editor with full formatting: headings, bold/italic/underline, lists, code blocks, LaTeX math (wrap in $...$), tables, and image embedding. Notes can be tagged, organized into folders, and linked to specific courses.

Drawing Canvas:
Freehand drawing for diagrams, concept maps, and visual notes. 10 tools available:
• Pen — freehand drawing
• Highlighter — translucent color overlay
• Eraser — erase strokes
• Shapes — rectangles, circles, arrows, lines
• Text — type text anywhere on the canvas
• Image Trace — import an image and draw over it (useful for anatomy diagrams)
• Lasso Select — select and move groups of strokes

5 canvas templates:
• Blank
• Cornell Grid (pre-drawn Cornell layout lines)
• Grid paper
• Dot grid
• Lined paper

Multi-page support:
Click "+ Page" to add pages to a drawing. Useful for multi-part diagrams or topic notes that span several pages.

Export:
• Export as PNG (single page or all pages)

Organizing:
Both text notes and drawings support folders and tags. Use the search bar in the Notes tab to full-text search across all content.

Science: The "drawing effect" (Wammes et al., 2016) found that drawing concepts produces 2× better recall than writing words, because drawing requires you to integrate verbal and visual representations simultaneously — a deeper form of processing.`,
    proTip: `After a lecture, spend 5 minutes drawing a concept map of the main ideas by hand in the Drawing Studio. Don't make it perfect — make it accurate. The act of drawing (even rough sketches) significantly outperforms re-reading your notes for consolidating memory.`,
  },
]

// ─── Category 6: Settings & Integrations ─────────────────────────────────────

const settingsIntegrations: TutorialEntry[] = [
  {
    id: 'ai-providers-slots',
    title: 'AI Providers & Feature Slots: Full Configuration Guide',
    tldr: 'Configure which AI model powers each NousAI feature — from chat to flashcard generation to PDF analysis.',
    tags: ['ai', 'provider', 'slots', 'configuration', 'openai', 'anthropic', 'groq', 'openrouter', 'mistral'],
    content: `Settings → "AI Configuration" is where you connect NousAI's brain. Here's everything you need to know.

Understanding Feature Slots:
NousAI has 6 independent AI slots, each powering a different category of features:

Slot 1 — Chat & Tutor: Powers the AI Chat panel, Tutor tool, and Socratic Dialogue. Use your best model here — quality matters more than speed.
Slot 2 — Generation: Flashcard Gen, Quiz Gen, Course Gen, Study Schedule. Use a fast model (Groq works well here).
Slot 3 — Analysis: Fact Check, Re-Explain, TLDR, Gap Finder. Use a model with strong reasoning.
Slot 4 — PDF & Image OCR: Requires Mistral API key specifically. Use "mistral-ocr-latest."
Slot 5 — Japanese Study: Powers all JP-mode AI features. Any capable model works.
Slot 6 — Physics Simulations: Code generation for interactive sims. Use a model with strong coding ability (GPT-4o or Gemini Pro recommended).

If you only configure Slot 1, all other slots fall back to Slot 1's model and key.

Configuring a slot:
1. Settings → AI Configuration → click the slot's header to expand it
2. Select Provider from the dropdown
3. Enter your API key
4. Select Model (a dropdown shows available models for that provider)
5. Click "Test Connection"

Advanced settings (per slot):
• Temperature: 0 = deterministic, 1 = creative. For flashcards and quizzes, use 0.3–0.5. For creative content (analogies, mnemonics), use 0.7–0.9.
• Max Tokens: Maximum response length. Default is fine for most uses.
• System Prompt: Customize the AI's persona or instructions. For Tutor: "You are a patient teacher. Always explain why, not just what."
• Streaming: Toggle real-time word-by-word output vs. waiting for the complete response.

Custom provider:
If you're running a local model via Ollama or a custom OpenAI-compatible endpoint, select "Custom" as the provider and enter your base URL.`,
    proTip: `Set up the Generation slot (Slot 2) with Groq's free API. Groq is the fastest AI inference available — flashcard generation that takes 8-12 seconds on OpenAI takes 1-2 seconds on Groq. For rapid-fire card creation sessions, this difference is significant.`,
  },
  {
    id: 'canvas-integration',
    title: 'Canvas LMS Integration: Full Setup Guide',
    tldr: 'Connect your university\'s Canvas account to sync assignments, due dates, and grades into NousAI automatically.',
    tags: ['canvas', 'lms', 'integration', 'assignments', 'grades', 'calendar', 'university'],
    content: `NousAI can connect to Canvas (Instructure) to pull your assignments, due dates, and grade data directly into the app.

What you'll need:
• Your university's Canvas URL (e.g., university.instructure.com)
• A Canvas API token
• Your Canvas iCal feed URL (for calendar sync)

Getting your Canvas API token:
1. Log into Canvas in your browser
2. Click your profile picture (top right) → "Settings"
3. Scroll down to "Approved Integrations" section
4. Click "+ New Access Token"
5. Description: "NousAI" — Expires: leave blank (or set 1 year)
6. Click "Generate Token" → Copy it immediately (you can't see it again)

Connecting in NousAI:
1. Settings → "Extensions & Integrations" → expand "Canvas LMS"
2. Enter your Canvas URL (without trailing slash)
3. Paste your API token
4. Click "Test Connection" → green = connected

Getting your iCal URL (for Calendar sync):
1. In Canvas → "Calendar" (sidebar)
2. Scroll to the bottom → "Calendar Feed" link
3. Right-click the link → "Copy Link Address"
4. In NousAI Settings: paste it into the "iCal URL" field
5. Click "Sync Calendar"

What syncs:
✓ Assignments with due dates → appear in Calendar
✓ Exam dates → appear as Calendar events and in the Exam Countdown widget
✓ Course grades → visible in GradeBook tab per course

What does NOT sync:
✗ File submissions
✗ Discussion posts
✗ Announcements
✗ Peer review assignments

Watch out: Canvas API tokens grant full read access to your Canvas account. Keep it private — don't share your NousAI account with others if your Canvas token is configured.`,
    proTip: `After connecting Canvas, go to each Course Space → Syllabus tab → click "Import from Canvas." This automatically pulls the course syllabus, extracts exam dates, and pre-populates your course topics — saving 30-45 minutes of manual setup per course.`,
  },
  {
    id: 'omi-wearable',
    title: 'Omi Integration: Capture Thoughts Hands-Free',
    tldr: 'Connect the Omi AI wearable pendant to automatically turn your conversations and lectures into notes, flashcards, and study insights.',
    tags: ['omi', 'wearable', 'pendant', 'transcription', 'auto', 'capture', 'notes', 'flashcards'],
    content: `Omi is an always-on AI wearable pendant. When connected to NousAI, it creates a fully automated pipeline: wear it → talk → notes, flashcards, and knowledge gaps appear in NousAI automatically.

What Omi does in NousAI:
After each conversation (automatically detected after ~90 seconds of silence), the following happens with no user action required:
1. Transcript correction — speech errors corrected via AI
2. Auto-save note — conversation saved to your Study Library
3. Flashcard generation — for education-category conversations, flashcards are created and queued for FSRS
4. Vocabulary extraction — new terms extracted to your vocab list
5. Knowledge gap detection — topics you seemed uncertain about are flagged for AI Tutor follow-up
6. Study time tracking — time spent on education content logged to your analytics

Setting it up:
1. Get an Omi device (omi.me) and set up the Omi app on your phone
2. In NousAI: Settings → Extensions → Omi → enter your Omi API key
3. Copy the Webhook URL shown below the key field
4. In the Omi phone app: Settings → Developer → Webhooks → Add Webhook → paste the URL → subscribe to "Conversation Events" and "Day Summary"
5. Click "Sync AI key to webhook" in NousAI — this enables the AI processing pipeline

Auto-settings (all default ON):
• Auto-save notes — saves all conversations to Library
• Auto-generate flashcards — creates cards from education content
• Auto-extract vocab — adds terms to vocab list
• Auto-detect gaps — surfaces knowledge gaps to AI Tutor
• Auto-voice-correct — applies AI correction for speech differences (lisp, stutter, multilingual)

Speech profile:
If you have a speech difference (lisp, stutter, heavy accent), configure your speech profile in Settings → Omi → Speech Profile. The AI correction will be calibrated to your specific patterns, dramatically improving transcript accuracy.

Watch out: The Omi integration processes everything captured while the device is on. Be mindful of privacy in environments where others are speaking — only use it in contexts where you're comfortable with transcription.`,
    proTip: `Wear Omi during study group sessions. Each participant's explanations get captured, and the AI identifies concepts explained well (which become good flashcard candidates) and concepts that seemed to cause confusion in the group (knowledge gaps to address).`,
  },
  {
    id: 'stream-deck',
    title: 'Elgato Stream Deck: One-Handed Control of NousAI',
    tldr: 'Map NousAI actions to the 15 LCD buttons on your Stream Deck for hands-free control of flashcard review, quizzes, and navigation.',
    tags: ['stream deck', 'elgato', 'gamepad', 'shortcuts', 'hardware', 'buttons', 'physical'],
    content: `The Elgato Stream Deck is a physical controller with 15 programmable LCD buttons. NousAI has built-in Stream Deck support — the buttons auto-configure based on which page you're on.

Requirements:
• Elgato Stream Deck MK.2 (or compatible model) connected via USB
• Chrome or Edge browser on Windows or macOS
• WebHID API support (built into modern Chrome/Edge)

Setting it up:
1. Settings → Input Devices → expand "Stream Deck"
2. Click "Connect Stream Deck" — browser asks for USB device permission → Allow
3. The Stream Deck LCD keys immediately update with labels
4. The buttons are now active for all NousAI modes

Automatic mode switching:
NousAI detects which page you're on and reconfigures the Stream Deck automatically:

Flashcard Mode (on /flashcards):
Btn 1=FLIP, Btn 2=RECALL, Btn 3=NEXT, Btn 4=PREV
Btn 5=AGAIN (1), Btn 6=HARD (2), Btn 7=GOOD (3), Btn 8=EASY (4)
Btn 9-15 = configurable

Quiz Mode (on /quiz):
Btn 1–4 = select answer options A/B/C/D
Btn 5=SUBMIT, Btn 6=NEXT

Drawing Mode (on /draw):
Btn 1=UNDO, Btn 2=REDO, Btn 3=PEN, Btn 4=ERASER

Notes Mode (on /library or /learn):
Btn 3=SEARCH, Btn 4=LASSO (open Screen Lasso)

Navigation Mode (all other pages):
Btn 1–15 = jump directly to any NousAI page

Custom remapping:
Settings → Input Devices → choose mode → click any button → select new action from dropdown

Why hardware control helps studying:
Physical button presses have lower cognitive overhead than mouse clicks or keyboard shortcuts. During flashcard review, being able to rate cards (AGAIN/HARD/GOOD/EASY) with a physical button without looking at the screen keeps you focused on the card content rather than the interface.`,
    proTip: `Map Stream Deck buttons to your custom study workflow. Example: Btn 1 = Start Pomodoro, Btn 2 = Open Flashcards, Btn 3 = Open Feynman Mode, Btn 4 = Open Lasso. Test the workflow for one week — physical shortcuts become muscle memory faster than keyboard shortcuts.`,
  },
  {
    id: 'data-sync-import',
    title: 'Data Management: Import, Export & Backup',
    tldr: 'Export your entire NousAI database, import data from Anki or Quizlet, and set up automatic local backups.',
    tags: ['import', 'export', 'backup', 'anki', 'quizlet', 'data', 'json', 'transfer'],
    content: `Settings → "Data Management" contains all your data import, export, and backup tools.

Exporting your data:
"Export Data" → downloads a .json file containing ALL your data: courses, flashcards, quizzes, notes, FSRS state, gamification data, settings. Use this for:
• Personal backups
• Transferring to a new device manually
• Sharing a course with a friend (they import your exported file)

Importing data:
"Import Data" → select a NousAI .json export file → your data is merged (not replaced) with existing data. If there are ID conflicts, you're shown a conflict dialog.

Importing from Anki:
Learn page → "Anki Import" tool → export your Anki deck as a .apkg file → upload it → NousAI converts it to native flashcards preserving card text, tags, and (optionally) FSRS state.

Importing from Quizlet:
Learn page → "Quizlet Import" tool → enter a Quizlet set URL → NousAI fetches the set and converts all term/definition pairs to flashcards.

Automatic local backups:
Settings → Data → "File System Access" → click "Select Backup Folder" → choose a local folder on your device → NousAI automatically backs up to that folder every hour.
Backups are stored as timestamped .json files (e.g., nousai-backup-2026-03-21-14h00.json). The folder keeps the last 24 backups.

Storage stats:
The Data tab shows how much storage your data uses locally. If approaching limits, the "Clear Old Data" option removes FSRS records older than 1 year (while keeping card content and current scheduling data).

Watch out: The "Clear All Data" button is permanent and local — it cannot be undone from within the app. Before using it, export your data first. Cloud sync data is not automatically deleted by this action (it stays in Firestore until you delete your account).`,
    proTip: `Set up automatic local backups to a cloud-synced folder (Dropbox, Google Drive, iCloud Drive). You'll have both NousAI's Firebase cloud sync AND local file backups — two independent backup systems protecting your study data.`,
  },
]

// ─── Build full TUTORIAL_CATEGORIES ──────────────────────────────────────────

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: '🚀',
    color: '#F5A623',
    description: 'Everything you need to go from zero to your first productive study session.',
    entries: gettingStarted,
  },
  {
    id: 'study-tools',
    label: 'Study Tools',
    icon: '📚',
    color: '#3b82f6',
    description: 'Flashcards, timers, match games, and the FSRS system explained.',
    entries: studyTools,
  },
  {
    id: 'learn-modes',
    label: 'Learn Modes',
    icon: '🧠',
    color: '#10b981',
    description: 'All 16+ learning techniques — when to use each one.',
    entries: learnModes,
  },
  {
    id: 'ai-tools',
    label: 'AI Tools',
    icon: '🤖',
    color: '#8b5cf6',
    description: 'Generate cards, quizzes, schedules, simulations, and more.',
    entries: aiTools,
  },
  {
    id: 'course-space',
    label: 'Course Space',
    icon: '🏛️',
    color: '#ec4899',
    description: 'Your 20-tab course workspace — notes, labs, grades, vocab, and more.',
    entries: courseSpace,
  },
  {
    id: 'settings-integrations',
    label: 'Settings & Integrations',
    icon: '⚙️',
    color: '#6b7280',
    description: 'AI providers, Canvas LMS, Omi wearable, Stream Deck, and data management.',
    entries: settingsIntegrations,
  },
]

// ─── GUIDE_ENTRIES export (for SettingsPage GuideHubInline) ──────────────────
// Combines original 8 entries + new entries, keeping GuideEntry-compatible shape.

const legacyEntries: GuideEntry[] = [
  {
    id: 'quickkeys',
    title: 'Elgato Stream Deck — Setup & Modes',
    tldr: 'A 15-button LCD controller for every NousAI action, one-handed control of the whole app.',
    content: `Requirements: Chrome or Edge on Windows or macOS, Stream Deck MK.2 connected via USB.

Setup (3 steps):
1. Open Settings → Input Devices
2. Click "Connect Stream Deck" → browser asks for USB permission → allow
3. The LCD keys update with labels for the current mode

Modes (auto-switch by page):
• Flashcard Mode — on /flashcards: Btn 1=FLIP, 2=RECALL, 3=NEXT, 4=PREV, 5=AGAIN, 6=HARD, 7=GOOD, 8=EASY, 9-15 configurable
• Quiz Mode — on /quiz: Btn 1-4 = select options, Btn 5=SUBMIT, Btn 6=NEXT
• Drawing Mode — on /draw: Btn 1=UNDO, Btn 2=REDO
• Navigation Mode — all other pages: Btn 1-15 = jump to any NousAI page
• Notes Mode — on /library or /learn: Btn 4=LASSO

Remapping: Settings → Input Devices → choose mode → click any button → select new action

⚡ Pro Tip: Use the 15 LCD buttons to map your most-used actions per mode — the labels update live on the device display.`,
  },
  {
    id: 'cloze',
    title: 'Cloze Cards — Syntax & Tips',
    tldr: 'Fill-in-the-blank cards. Wrap terms in {{double braces}} to create blanks.',
    content: `Creating a Cloze Card:
1. Click "New Card" → select type "Cloze"
2. Front: "The {{mitochondria}} is the {{powerhouse}} of the cell."
3. Back: Optional explanation / extra context

Review Flow:
• Card shows: "The [_____] is the [_____] of the cell."
• Press Space → reveals first blank: "mitochondria"
• Press Space again → reveals second blank: "powerhouse"
• Back shown → rate 1-4

Tips for Great Cloze Cards:
✓ One concept per card: "The {{nucleus}} controls cell activity"
✓ Keep blanks to 1-3 per card
✗ Avoid too many blanks per card

⚡ Pro Tip: After making cloze cards from vocab, use RSVP Speed Preview to see all terms fast, then let FSRS schedule the actual review.`,
  },
  {
    id: 'type-recall',
    title: 'Type-to-Recall Mode — The Generation Effect',
    tldr: 'Type your answer before seeing it. Research shows 40-60% better retention than passive flip.',
    content: `Enable: Press T on any flashcard page, or Settings → Flashcards → "Type-to-Recall Mode" toggle.

How it works:
1. Card front shows
2. You type your answer in the text box
3. Press Enter or "Check"
4. If AI grading is on: EXACT → 4, PARTIAL → 2 (shows what was missing), WRONG → 1
5. If AI grading is off: correct answer shown, you self-grade

Why it works (The Science):
Generating an answer — even incorrectly — activates more memory pathways than simply recognizing it. This is the "generation effect" (Slamecka & Graf, 1978). Even failed recall attempts strengthen long-term memory.

⚡ Pro Tip: Keep AI grading OFF for speed. Keep it ON for high-stakes subjects where accuracy matters most.`,
  },
  {
    id: 'rsvp',
    title: 'RSVP Speed Preview — When & How to Use',
    tldr: 'Flash through an entire deck in minutes to build familiarity before deep study.',
    content: `Open: Learn → "⚡ Speed Preview" or Flashcard page header → "Speed Preview" button.

Speed Settings:
100 WPM — Slow, good for complex material
200 WPM — Default
300 WPM — Fast, good for vocabulary you mostly know
500 WPM — Very fast, good for warm-up on familiar decks

Controls: Space = pause · → = skip card · Stream Deck buttons = adjust WPM live

When to Use:
✓ Before starting a new deck (reduces first-review overwhelm)
✓ Before an exam (rapid exposure refresher)
✓ When returning after a long break (re-familiarize before deep review)
✗ Not a replacement for FSRS active recall — always follow with real review

⚡ Pro Tip: Run RSVP at the START of every study session as a 3-minute warm-up. Retention improves significantly vs. jumping straight to flashcards cold.`,
  },
  {
    id: 'leeches',
    title: 'Leech Cards — What They Are & How to Fix',
    tldr: 'Leeches are cards you keep failing. The system detects them and helps you fix them.',
    content: `What is a Leech?
A card that has failed (graded "Again") 4+ times OR has average recall below 50%. These cards take 80% of your effort for 20% of the value.

How to find them: Learn → Leech Manager tool, or FlashcardAnalytics → "Leeches" tab.

What to do:
Option 1 — Suspend: Removes from review queue temporarily
Option 2 — AI Rewrite: AI suggests a simpler rewrite or how to split into 2 atomic cards
Option 3 — Add Context: Add more info to the back of the card

Why this matters:
Suspending 10 leeches = saving 20-30 minutes per week. Keeping leeches active = scheduling bad cards every 1-3 days forever.

⚡ Pro Tip: Run leech detection monthly. Aim for 0 active leeches. If you have 20+ leeches, your cards need restructuring before FSRS can work effectively.`,
  },
  {
    id: 'fsrs',
    title: 'How FSRS Schedules Your Cards (Plain English)',
    tldr: 'FSRS predicts when you\'ll forget each card and shows it right before that moment.',
    content: `The Core Idea:
Every card has a "stability" (how long your memory will last) and a "difficulty" (how hard the card is for you). FSRS uses these + 19 calibration weights to predict when you'll recall the card with 92% confidence.

Your Ratings Explained:
1 = Again — "I forgot completely" → interval resets to 1 day
2 = Hard — "I remembered but struggled" → short interval
3 = Good — "I remembered normally" → interval doubles-ish
4 = Easy — "Instant recall" → large interval jump

What happens over time:
• New card: shown again in 1-2 days (building initial memory)
• After 3-4 good reviews: shown weekly, then monthly
• Mature card (21+ day stability): shown every few months

Daily Cap: 50 cards per course per day (configurable in Settings). This prevents overwhelm when you add a large deck all at once.

⚡ Pro Tip: Grade honestly. Rating "Easy" when it was "Hard" corrupts the schedule. The algorithm only works if your self-ratings are accurate.`,
  },
  {
    id: 'pretest',
    title: 'Pre-Test Mode — Hypercorrection Effect',
    tldr: 'Test before learning → 15-20% better retention. High-confidence wrong answers corrected most strongly.',
    content: `What it does:
Before each card: "Do you think you know this? Yes / No" (confidence prediction)
You type an answer → correct answer shown immediately (no FSRS grading during pretest)

Post-run summary shows:
• "Knew correctly" — good!
• "Thought you knew, got wrong" — these get reviewed first (hypercorrection)
• "Knew you didn't know" — normal review order

Science: The hypercorrection effect means that when you're WRONG with high confidence, your brain is primed for deeper correction. These cards stick much faster than ones you were uncertain about.

Open it: Learn → "🎯 Pre-Test Mode"

⚡ Pro Tip: Use Pre-Test Mode on a brand new deck before you've studied anything. Even guessing wrong primes your memory for the correct answers.`,
  },
]

// Build GUIDE_ENTRIES: all entries from TUTORIAL_CATEGORIES + legacy entries (deduped)
const allCategoryEntries: GuideEntry[] = TUTORIAL_CATEGORIES
  .flatMap(cat => cat.entries)
  .map(({ id, title, tldr, content }) => ({ id, title, tldr, content }))

const legacyIds = new Set(legacyEntries.map(e => e.id))
const newEntries = allCategoryEntries.filter(e => !legacyIds.has(e.id))

export const GUIDE_ENTRIES: GuideEntry[] = [...legacyEntries, ...newEntries]
