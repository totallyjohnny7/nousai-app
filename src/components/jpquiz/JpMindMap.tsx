/**
 * JpMindMap — Interactive SVG mind map for Japanese language study.
 * 12 topic bubbles arranged radially. Pan/zoom. Detail panel with topic-specific content.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, X, Maximize2, Minimize2, Pencil, Plus, Trash2, Check } from 'lucide-react'
import { useMindMapEdits } from '../../hooks/useMindMapEdits'

const EDIT_COLORS = ['#3b82f6','#06b6d4','#ef4444','#8b5cf6','#22c55e','#f59e0b','#ec4899','#6366f1','#f97316','#6b7280']

interface Props {
  onBack: () => void
}

// ─── Layout constants ───────────────────────────────────────────────────────
const SVG_W = 1100
const SVG_H = 880
const CX = SVG_W / 2
const CY = SVG_H / 2
const ORBIT_R = 320
const BUBBLE_R = 50
const CENTER_R = 58

function getBubblePos(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  return { x: CX + ORBIT_R * Math.cos(angle), y: CY + ORBIT_R * Math.sin(angle) }
}

// ─── Data ──────────────────────────────────────────────────────────────────

type Heading = 'what-it-is' | 'key-patterns' | 'usage' | 'differences' | 'mistakes' | 'examples' | 'exam-traps'

interface Bullet { text: string; isTrap?: boolean; jp?: boolean }
interface HeadingContent { heading: Heading; bullets: Bullet[] }
interface Bubble { id: string; title: string; titleJp?: string; color: string; headings: HeadingContent[] }

const HEADING_LABELS: Record<Heading, string> = {
  'what-it-is':   'What It Is',
  'key-patterns': 'Key Patterns',
  'usage':        'When & How to Use',
  'differences':  'Common Confusions',
  'mistakes':     'Learner Mistakes',
  'examples':     'Example Sentences',
  'exam-traps':   'Exam / Test Traps',
}

const BUBBLES: Bubble[] = [
  {
    id: 'particles', title: 'Particles', titleJp: '助詞', color: '#3b82f6',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Particles (じょし) mark the grammatical role of words in a sentence' },
        { text: 'Japanese is agglutinative — particles attach to words to give them function' },
        { text: 'Without particles, meaning becomes ambiguous (unlike English word order)' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'は (wa) — topic marker: 私は学生です (I am a student)', jp: true },
        { text: 'が (ga) — subject marker: 猫が好きです (I like cats — "cats" is the subject)', jp: true },
        { text: 'を (wo) — direct object: 本を読む (read a book)', jp: true },
        { text: 'に (ni) — direction / time / indirect object: 学校に行く (go to school)', jp: true },
        { text: 'で (de) — location of action / means: 電車で行く (go by train)', jp: true },
        { text: 'と (to) — "and" (between nouns) or "with": 友達と行く (go with a friend)', jp: true },
        { text: 'の (no) — possession / noun modifier: 私の本 (my book)', jp: true },
        { text: 'から (kara) — from; まで (made) — until/to' },
      ]},
      { heading: 'usage', bullets: [
        { text: 'は marks the TOPIC — what the sentence is about; が marks the SUBJECT doing the action' },
        { text: 'で vs に for location: で = where action happens; に = where something IS or goes' },
        { text: 'と vs や for listing: と = complete list; や = partial list (among others)' },
      ]},
      { heading: 'differences', bullets: [
        { text: 'は vs が: 猫は好き (as for cats, I like them) vs 猫が好き (it is CATS that I like)', jp: true },
        { text: 'に vs で for location: 図書館に本がある vs 図書館で勉強する', jp: true },
        { text: 'へ vs に for direction: へ is more literary; に is more common in speech' },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Using は when が is needed in new-information sentences', isTrap: true },
        { text: 'Forgetting を for direct objects of transitive verbs', isTrap: true },
        { text: 'Confusing に (destination) with で (location of action)' },
      ]},
      { heading: 'examples', bullets: [
        { text: '私は毎日学校に電車で行きます。 (I go to school by train every day.)', jp: true },
        { text: '田中さんが来ました。 (Mr. Tanaka came.) — が emphasizes who came', jp: true },
        { text: '東京から大阪まで新幹線で行きます。 (Go from Tokyo to Osaka by Shinkansen.)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'は is dropped after に, で, から, まで in natural speech', isTrap: true },
        { text: 'が can replace を for potential verbs: 日本語が話せる (can speak Japanese)', isTrap: true },
        { text: 'の can turn almost any adjective/verb clause into a noun (nominalization)', isTrap: true },
      ]},
    ],
  },
  {
    id: 'verbs', title: 'Verbs', titleJp: '動詞', color: '#ef4444',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Japanese verbs conjugate by tense, politeness, and form (te-form, ta-form, potential, etc.)' },
        { text: 'Two main groups: U-verbs (Group 1) and RU-verbs (Group 2) + 2 irregular (する, くる)' },
        { text: 'Verb always comes at end of clause in Japanese' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'U-verbs: dictionary form ends in u-sound → change u→i for stem: 書く→書き', jp: true },
        { text: 'RU-verbs: drop る for stem: 食べる→食べ', jp: true },
        { text: 'て-form: U: く→いて, ぐ→いで, す→して, つ/る/う→って, ぬ/ぶ/む→んで; RU: just て', jp: true },
        { text: 'Plain past (た-form): same pattern as て-form but with た/だ', jp: true },
        { text: 'Negative: U-verb: change u→a + ない; RU: stem + ない', jp: true },
        { text: 'Potential: U: change u→e + る; RU: stem + られる', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: '〜ている (te-iru): ongoing action or resulting state — 食べている (eating / has eaten)', jp: true },
        { text: '〜てみる: try doing — 食べてみる (try eating)', jp: true },
        { text: '〜てしまう: unfortunate completion / completion with regret — 食べてしまった', jp: true },
        { text: '〜てもいい: permission — 食べてもいいですか (may I eat?)', jp: true },
        { text: '〜てはいけない: prohibition — 食べてはいけない (must not eat)', jp: true },
      ]},
      { heading: 'differences', bullets: [
        { text: 'U vs RU: 切る (kiru=cut, U-verb) vs 着る (kiru=wear, RU-verb) — same pronunciation, different conjugation!', isTrap: true },
        { text: '〜ている for motion verbs = result state: 結婚している (is married)', jp: true },
        { text: '行く te-form is 行って (not 行いて) — exception to く→いて rule', isTrap: true },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Conjugating U-verbs like RU-verbs (very common error for N5 learners)', isTrap: true },
        { text: 'Forgetting irregular: する→して(て-form); くる→きて', isTrap: true },
        { text: '帰る (kaeru) is a U-verb — common mistake to treat as RU' },
      ]},
      { heading: 'examples', bullets: [
        { text: '毎日日本語を勉強しています。 (I am studying Japanese every day.)', jp: true },
        { text: '宿題をしてしまいました。 (I (unfortunately) finished all my homework.)', jp: true },
        { text: '映画を見てもいいですか。 (May I watch the movie?)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'ある (to exist, inanimate) is a U-verb but its negative is ない, not あらない', isTrap: true },
        { text: 'Potential form: 食べられる (can eat) — this also means passive "to be eaten"', isTrap: true },
        { text: 'Causative: 〜させる (make/let do); Causative-passive: 〜させられる (be made to do)', isTrap: true },
      ]},
    ],
  },
  {
    id: 'adjectives', title: 'Adjectives', titleJp: '形容詞', color: '#8b5cf6',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Two types: i-adjectives (ends in い) and na-adjectives (use な before nouns)' },
        { text: 'i-adjectives conjugate; na-adjectives behave more like nouns' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'i-adj negative: drop い, add くない — 高い→高くない (not expensive)', jp: true },
        { text: 'i-adj past: drop い, add かった — 高い→高かった (was expensive)', jp: true },
        { text: 'i-adj past negative: drop い, add くなかった', jp: true },
        { text: 'na-adj uses じゃない / ではない for negative; だった for past', jp: true },
        { text: 'Adverb from i-adj: drop い, add く — 速い→速く (quickly)', jp: true },
        { text: 'Adverb from na-adj: add に — 静か→静かに (quietly)', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'Predicate: これは高いです。 (This is expensive.)', jp: true },
        { text: 'Modifying noun: 高い車 (expensive car); 静かな部屋 (quiet room)', jp: true },
        { text: 'Comparison: AよりBの方が〜 (B is more ~ than A)', jp: true },
        { text: 'Superlative: 一番 + adj (the most ~)', jp: true },
      ]},
      { heading: 'differences', bullets: [
        { text: 'いい (good) conjugates irregularly: negative = よくない; past = よかった', isTrap: true },
        { text: 'きれい ends in い but is a NA-adjective, not an i-adjective', isTrap: true },
        { text: 'i-adjectives do NOT need だ/です in plain form before conjugation' },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Treating きれい/嫌い as i-adjectives (they are na-adjectives)', isTrap: true },
        { text: 'Conjugating いい as いくない instead of よくない', isTrap: true },
      ]},
      { heading: 'examples', bullets: [
        { text: 'この映画は面白くなかったです。 (This movie was not interesting.)', jp: true },
        { text: '彼女は親切な人です。 (She is a kind person.)', jp: true },
        { text: '東京は大阪より大きいです。 (Tokyo is bigger than Osaka.)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'な-adj + noun: 静かな部屋 (NOT 静かい部屋)', isTrap: true },
        { text: 'Te-form of i-adj: drop い, add くて (linking adjectives)', isTrap: true },
        { text: 'Te-form of na-adj: add で (linking adjectives)', isTrap: true },
      ]},
    ],
  },
  {
    id: 'nouns', title: 'Nouns', titleJp: '名詞', color: '#22c55e',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Japanese nouns do not inflect for number, gender, or case' },
        { text: 'Plurals are usually inferred by context; 〜たち adds a loose plural for people' },
        { text: 'Nouns can be linked with の (possession) or な (na-adj) to modify other nouns' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'Possession: 私の本 (my book); 日本語の先生 (Japanese teacher)', jp: true },
        { text: 'Compound nouns: 日本語 + 学校 → 日本語学校 (Japanese language school)', jp: true },
        { text: '〜たち for groups: 私たち (we/us); 子供たち (children — group)', jp: true },
        { text: 'Verbal noun with する: 勉強する (study), 運動する (exercise)', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'Nouns become adjectives using の (nominal adj): 日本の食べ物 (Japanese food)', jp: true },
        { text: 'Nominalization: verb + こと or の → turns verb/adj into a noun', jp: true },
        { text: '〜ことが好き: like doing ~ ; 〜のが上手: good at ~', jp: true },
      ]},
      { heading: 'differences', bullets: [
        { text: 'こと vs の for nominalization: こと is more abstract; の is more immediate/sensory' },
        { text: '〜たち is not a true plural — 学生たち means "students (as a group)" not "3 students"' },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Adding plural -s thinking Japanese has the same plural system', isTrap: true },
        { text: 'Using の for na-adjective attribute (should use な): 静かな部屋 not 静かの部屋', isTrap: true },
      ]},
      { heading: 'examples', bullets: [
        { text: '日本語を話すことは難しいです。 (Speaking Japanese is difficult.)', jp: true },
        { text: '友達の誕生日パーティーに行きます。 (I am going to my friend\'s birthday party.)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'の can replace が in embedded clauses (relative clause subject)', isTrap: true },
        { text: 'する-verbs: 電話する, 結婚する, 卒業する — don\'t forget to conjugate する not the noun', isTrap: true },
      ]},
    ],
  },
  {
    id: 'numbers', title: 'Numbers', titleJp: '数・助数詞', color: '#f59e0b',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Japanese numbers use two systems: Chinese-derived (ichi, ni, san) and native Japanese (hitotsu, futatsu)' },
        { text: 'Counter words (助数詞) must match the type of object being counted' },
        { text: 'The correct counter is non-negotiable — wrong counter = wrong sentence' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: '1-10 native: ひとつ、ふたつ、みっつ、よっつ、いつつ、むっつ、ななつ、やっつ、ここのつ、とお', jp: true },
        { text: 'Flat things (paper, stamps): 〜枚 (まい) — 一枚、二枚', jp: true },
        { text: 'Long thin things (pens, bottles): 〜本 (ほん/ぼん/ぽん) — 一本、二本、三本', jp: true },
        { text: 'Bound things (books, magazines): 〜冊 (さつ) — 一冊、二冊', jp: true },
        { text: 'Small animals: 〜匹 (ひき/びき/ぴき); Large animals: 〜頭 (とう)', jp: true },
        { text: 'People: 一人 (ひとり)、二人 (ふたり)、三人以上: 〜人 (にん)', jp: true },
        { text: 'Times: 〜回 (かい/がい) — 一回、二回; Floors: 〜階 (かい)', jp: true },
        { text: 'Age: 〜歳 (さい) — 一歳、二歳; exceptions: 20 = はたち', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'Counter attaches after the number: 三枚の紙 (3 sheets of paper)', jp: true },
        { text: 'When counter follows noun directly, の is not needed: 紙が三枚ある', jp: true },
        { text: 'Numbers modify sentences differently: 三回行った (went 3 times) — no particle needed', jp: true },
      ]},
      { heading: 'differences', bullets: [
        { text: '一本 (ippon) vs 二本 (nihon) vs 三本 (sanbon) — sound changes based on number', isTrap: true },
        { text: 'Native Japanese numbers (ひとつ etc.) used for generic uncategorized items up to 9' },
        { text: '二人 (futari) and 一人 (hitori) are exceptions — not ichinIN/ninIN' },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Using 一本 for flat objects (should be 一枚)', isTrap: true },
        { text: 'Forgetting that 二人 = ふたり (not ににん)', isTrap: true },
        { text: 'Using native numbers beyond 9 (とお is 10, but 11+ uses Chinese-derived system)', isTrap: true },
      ]},
      { heading: 'examples', bullets: [
        { text: 'ノートを三冊買いました。 (I bought 3 notebooks.)', jp: true },
        { text: 'この学校には先生が五人います。 (This school has 5 teachers.)', jp: true },
        { text: '猫を二匹飼っています。 (I keep 2 cats.)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: '三本 = sanBON (not sanhon — phonetic change)', isTrap: true },
        { text: '六匹 = roppiki; 一匹 = ippiki; 八匹 = happiki — irregular sound changes', isTrap: true },
        { text: '日本 (Japan) = にほん — same kanji as 二本 (nihon) — context distinguishes', isTrap: true },
      ]},
    ],
  },
  {
    id: 'sentence-structure', title: 'Sentence', titleJp: '文の構造', color: '#06b6d4',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Japanese is SOV (Subject-Object-Verb) — verb always comes last' },
        { text: 'Topic-comment structure: topic (は) + comment — differs from English subject-predicate' },
        { text: 'Modifiers always PRECEDE what they modify (relative clauses before nouns)' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'Basic: [Topic]は [Subject]が [Object]を [Verb]。', jp: true },
        { text: 'Relative clause before noun: [昨日買った] 本 (the book [I bought yesterday])', jp: true },
        { text: 'Noun-modifying clause: no が→の substitution possible in relative clauses', jp: true },
        { text: 'Question formation: add か at end — 行きますか？ (Will you go?)', jp: true },
        { text: 'Negative: verb negative form + sentence-final marker', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'Topicalization: move any element to front + mark with は to make it topic' },
        { text: 'Subject drop: in context, subject/topic commonly omitted (pro-drop language)' },
        { text: 'Sentence-final particles: ね (seeking agreement), よ (asserting), ね (soft confirmation)' },
      ]},
      { heading: 'differences', bullets: [
        { text: 'SOV vs SVO: cannot place verb before object in standard Japanese', isTrap: true },
        { text: 'Relative clauses in Japanese come BEFORE the noun (opposite of English)', isTrap: true },
        { text: 'Conjunction order: reason/condition comes before result — から/ので clause first' },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Putting verb in middle of sentence (English word order habit)', isTrap: true },
        { text: 'Forgetting to end questions with か in formal speech', isTrap: true },
        { text: 'Placing relative clause AFTER the noun (English habit)' },
      ]},
      { heading: 'examples', bullets: [
        { text: '昨日図書館で借りた本は面白かったです。 (The book I borrowed at the library yesterday was interesting.)', jp: true },
        { text: '雨が降っているから、傘を持って行きます。 (Because it\'s raining, I\'ll take an umbrella.)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'If it feels like English order, it\'s probably wrong in Japanese', isTrap: true },
        { text: 'Multiple は in one sentence: first は = main topic, second = contrast', isTrap: true },
        { text: 'から (because) vs ので (because): ので is softer/more polite', isTrap: true },
      ]},
    ],
  },
  {
    id: 'jlpt-n5-grammar', title: 'N5 Grammar', titleJp: 'N5 文法', color: '#ec4899',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'JLPT N5 is the most basic level — about 800 vocabulary words, hiragana, katakana' },
        { text: 'Core grammar patterns every Japanese learner must know' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: '〜たいです: want to do — 食べたいです (I want to eat)', jp: true },
        { text: '〜ましょう: let\'s / shall we — 行きましょう (Let\'s go)', jp: true },
        { text: '〜てください: please do — 食べてください (Please eat)', jp: true },
        { text: '〜てもいいですか: may I? — 入ってもいいですか (May I enter?)', jp: true },
        { text: '〜てはいけません: must not — 写真を撮ってはいけません (No photos)', jp: true },
        { text: 'もう + past: already — もう食べました (already ate)', jp: true },
        { text: 'まだ + negative: not yet — まだ食べていません (haven\'t eaten yet)', jp: true },
        { text: '〜から: because / from — 忙しいから行けません (Can\'t go because I\'m busy)', jp: true },
        { text: '〜ながら: while doing — 音楽を聴きながら勉強する (Study while listening to music)', jp: true },
        { text: '〜前に / 〜後で: before / after — 食べる前に手を洗う (Wash hands before eating)', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: '〜たい: only for speaker\'s desires (not third person); third person: 〜たがっている' },
        { text: 'もう with negative = anymore: もう行きません (I won\'t go anymore)', jp: true },
        { text: '〜前に + plain form verb; 〜後で + past form verb', jp: true },
      ]},
      { heading: 'differences', bullets: [
        { text: 'たい vs ましょう: たい = I want to; ましょう = let\'s (inclusive invitation)', isTrap: true },
        { text: '〜てください (please do) vs 〜てもいいですか (may I do)', isTrap: true },
        { text: 'もう (already/anymore) vs まだ (still/not yet) — opposite meanings', isTrap: true },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Using たい for what others want (must use たがる/たがっている)', isTrap: true },
        { text: 'Forgetting past form after 後で: 食べた後で (after eating) not 食べる後で', isTrap: true },
      ]},
      { heading: 'examples', bullets: [
        { text: '日本に行きたいです。 (I want to go to Japan.)', jp: true },
        { text: '宿題をした後で、テレビを見ます。 (I\'ll watch TV after doing homework.)', jp: true },
        { text: '音楽を聴きながら料理します。 (I cook while listening to music.)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: '〜前に uses dictionary form (present); 〜後で uses ta-form (past)', isTrap: true },
        { text: 'もう can mean "already" (+ affirmative) OR "anymore/no longer" (+ negative)', isTrap: true },
        { text: 'ながら: both actions performed by SAME subject — can\'t use for different people', isTrap: true },
      ]},
    ],
  },
  {
    id: 'conversation', title: 'Conversation', titleJp: '会話', color: '#10b981',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Real Japanese conversation relies heavily on context, politeness level, and set phrases' },
        { text: 'Keigo (formal) vs casual: different forms used depending on relationship' },
        { text: 'Many conversation phrases are memorized fixed expressions, not translated word-for-word' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'Greetings: おはようございます、こんにちは、こんばんは、おやすみなさい', jp: true },
        { text: 'Thanks: ありがとうございます (formal) / ありがとう (casual)', jp: true },
        { text: 'Apology: すみません (excuse me/sorry light) / 申し訳ありません (deep sorry)', jp: true },
        { text: 'Before eating: いただきます; After eating: ごちそうさまでした', jp: true },
        { text: 'At a store: いらっしゃいませ (staff), 〜をください (I\'d like ~), いくらですか (how much?)', jp: true },
        { text: 'Introducing: はじめまして。〜と申します。よろしくお願いします。', jp: true },
        { text: 'Leaving: 行ってきます (leaving home) / 行ってらっしゃい (send-off)', jp: true },
        { text: 'Returning: ただいま (I\'m home) / おかえりなさい (welcome back)', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'すみません is also used to call a waiter or get someone\'s attention (not just apology)' },
        { text: 'ちょっと... (chotto) = a little / somewhat — also used to politely refuse', jp: true },
        { text: 'どうぞ = please (go ahead / take it) — versatile polite offering', jp: true },
        { text: 'そうですね = "that\'s right" / "I see" — filler for showing you\'re listening', jp: true },
      ]},
      { heading: 'differences', bullets: [
        { text: 'すみません vs ごめんなさい: すみません is lighter / excuse me; ごめんなさい is a sincere apology' },
        { text: 'どうぞ vs どうも: どうぞ = please go ahead; どうも = thanks/hello (versatile, casual)', jp: true },
        { text: 'いらっしゃる (polite ある/いる/来る/行く) — honorific form, only for others\'actions' },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Using casual speech with strangers or older people', isTrap: true },
        { text: 'Forgetting that Japanese often implies rather than states — "ちょっと" = no', isTrap: true },
        { text: 'Translating "you\'re welcome" as どういたしまして — Japanese often just say どうも or nothing' },
      ]},
      { heading: 'examples', bullets: [
        { text: 'すみません、トイレはどこですか。 (Excuse me, where is the bathroom?)', jp: true },
        { text: 'これをください。 (I\'ll take this, please.)', jp: true },
        { text: 'お名前は何とおっしゃいますか。 (What is your name? [formal])', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'いただきます has no English equivalent — it\'s thanks for the food/whoever prepared it', isTrap: true },
        { text: 'お邪魔します (ojama shimasu) when entering someone\'s home — required politeness', isTrap: true },
        { text: 'よろしくお願いします: used at first meeting, when asking favors, and at end of emails/letters', isTrap: true },
      ]},
    ],
  },
  {
    id: 'keigo', title: 'Keigo', titleJp: '敬語', color: '#a78bfa',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Keigo (敬語) = honorific language used to show respect or humility' },
        { text: 'Three types: 尊敬語 (sonkeigo — respectful), 謙譲語 (kenjougo — humble), 丁寧語 (teineigo — polite)' },
        { text: 'Used with: superiors, customers, strangers, in formal situations, writing' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'Teineigo (polite): ます/です forms — 食べます、行きます (most important for learners)', jp: true },
        { text: 'Sonkeigo: いらっしゃる (be/go/come), おっしゃる (say), なさる (do), ご〜になる', jp: true },
        { text: 'Kenjougo: おる (humble "to be"), 申す (humble "say"), いたす (humble "do"), うかがう (humble "visit/ask")', jp: true },
        { text: 'お/ご prefix: お + Japanese noun; ご + Chinese-origin noun — お電話 (your call)', jp: true },
        { text: 'Special keigo verbs: 食べる→召し上がる (son.) / いただく (ken.)', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'Elevate OTHERS with sonkeigo (sonkeigo = about their actions, shows respect)' },
        { text: 'Lower YOURSELF with kenjougo (kenjougo = about your own actions, shows humility)' },
        { text: 'Business: ご連絡いただき、ありがとうございます (Thank you for contacting us)', jp: true },
      ]},
      { heading: 'differences', bullets: [
        { text: 'Using kenjougo for others\' actions is WRONG — never humble someone else', isTrap: true },
        { text: 'Using sonkeigo for yourself is WRONG — never elevate your own actions', isTrap: true },
        { text: 'お and ご on your OWN belongings = humility; on THEIR belongings = honor', jp: true },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Mixing up sonkeigo and kenjougo — the most common keigo error', isTrap: true },
        { text: '先生がいただく (WRONG — should use 召し上がる for teacher)', isTrap: true },
        { text: 'Overusing keigo in casual situations (sounds stiff/weird to native speakers)' },
      ]},
      { heading: 'examples', bullets: [
        { text: '先生はもう召し上がりましたか。 (Has the teacher already eaten?)', jp: true },
        { text: '私がご説明いたします。 (I will explain.) [humble]', jp: true },
        { text: '山田部長はいらっしゃいますか。 (Is Manager Yamada here?)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'いらっしゃる covers ある/いる/行く/来る — context determines which meaning', isTrap: true },
        { text: 'On phone: こちら田中と申します (I am Tanaka [humble]) — not 私は田中です', isTrap: true },
        { text: 'どうぞよろしくお願いいたします — most formal version of よろしく', isTrap: true },
      ]},
    ],
  },
  {
    id: 'reading-scripts', title: 'Scripts', titleJp: '文字', color: '#f97316',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: '3 writing systems: Hiragana (46 chars), Katakana (46 chars), Kanji (2000+ for literacy)' },
        { text: 'Hiragana: native Japanese words, grammatical endings, children\'s text' },
        { text: 'Katakana: foreign loanwords, emphasis, onomatopoeia, scientific terms' },
        { text: 'Kanji: Chinese-origin characters with Japanese readings' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'Hiragana: あ(a) い(i) う(u) え(e) お(o); か(ka) き(ki) く(ku) け(ke) こ(ko)', jp: true },
        { text: 'Voiced: が(ga) ぎ(gi) ぐ(gu) げ(ge) ご(go); add ゛(dakuten)', jp: true },
        { text: 'Long vowels in katakana: ー (lengthens previous vowel) — コーヒー (koohii = coffee)', jp: true },
        { text: 'Double consonant: small っ (tsu) before consonant — きって (stamp)', jp: true },
        { text: 'Okurigana: hiragana following kanji to complete the word — 食べる (ta-BE-ru)', jp: true },
        { text: 'Kun-reading (Japanese) vs On-reading (Chinese): 山 = やま(kun) / さん(on)', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'Hiragana is the first script learned — all Japanese can be written in hiragana' },
        { text: 'Katakana for: コーヒー, パソコン, テレビ, スマホ, ピザ (all loanwords)' },
        { text: 'Modern Japanese text mixes all three + romaji in ads/signs' },
      ]},
      { heading: 'differences', bullets: [
        { text: 'Similar looking hiragana: ぬ vs め; は vs ほ; り vs い vs /) — practice carefully', isTrap: true },
        { text: 'Similar katakana: ソ(so) vs ン(n); ツ(tsu) vs シ(shi) — stroke direction matters', isTrap: true },
        { text: 'Romaji is NOT used in real Japanese text — it\'s a learning crutch only' },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Confusing ソ(so) with ン(n) — stroke angle/direction: ソ tilts right, ン tilts left', isTrap: true },
        { text: 'Writing ん (n) as ん before vowels causes N+vowel confusion (use apostrophe in romaji)', isTrap: true },
        { text: 'Forgetting that small ゃゅょ create combined sounds: きゃ(kya), にゅ(nyu)' },
      ]},
      { heading: 'examples', bullets: [
        { text: 'アメリカ (Amerika = America); コンピューター (konpyuutaa = computer)', jp: true },
        { text: '切手 (きって — stamp); 学校 (がっこう — school); 一 (いち/ひとつ — one)', jp: true },
        { text: 'ラーメン (raamen), スシ (sushi), テンプラ (tenpura) — katakana loanwords', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: 'ち = chi (not "ti"); つ = tsu (not "tu"); し = shi (not "si") in Hepburn romaji', isTrap: true },
        { text: 'Small っ DOUBLES the consonant that follows it: きって = kit-te (not ki-te)', isTrap: true },
        { text: 'ん before は/ま/ぱ row can sound like "m" in speech — but written ん always', isTrap: true },
      ]},
    ],
  },
  {
    id: 'n4-n5-vocab', title: 'Core Vocab', titleJp: '基本語彙', color: '#14b8a6',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'N5 requires ~800 words; N4 requires ~1500 additional words' },
        { text: 'Core vocabulary is organized by theme: time, family, food, transportation, body' },
        { text: 'Learning vocab in context (sentences) beats flashcard word-lists' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'Time: 今(いま now) 今日(きょう today) 明日(あした tomorrow) 昨日(きのう yesterday)', jp: true },
        { text: 'Daily: 朝(あさ morning) 昼(ひる noon) 夜(よる night) 毎日(まいにち every day)', jp: true },
        { text: 'Family: 父(ちち my dad) お父さん(your dad) 母(はは) お母さん 兄 弟 姉 妹', jp: true },
        { text: 'Directions: 右(みぎ right) 左(ひだり left) 前(まえ front) 後ろ(うしろ back) 隣(となり next to)', jp: true },
        { text: 'Transport: 電車 バス タクシー 飛行機 新幹線', jp: true },
        { text: 'Food: ご飯 パン 肉 魚 野菜 果物 水 お茶 コーヒー', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'In-group vs out-group vocabulary for family: ちち (my father) vs お父さん (your/their father)', jp: true },
        { text: 'Loanwords in katakana are often recognizable from English — use them!' },
        { text: 'Compound words: kanji compounds often predictable from individual kanji meanings' },
      ]},
      { heading: 'differences', bullets: [
        { text: '今日 = きょう (today) but also TODAY = こんにち in compounds (今日は = konnichiwa)', isTrap: true },
        { text: 'Humble family terms (ちち,はは,あに,あね) vs honorific (お父さん,お母さん,お兄さん,お姉さん)', isTrap: true },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Using お父さん to refer to your own father in formal context (should use ちち)', isTrap: true },
        { text: '来週 (らいしゅう next week) vs 先週 (せんしゅう last week) — 来/先 confusion', isTrap: true },
      ]},
      { heading: 'examples', bullets: [
        { text: '明日の午後三時に駅で会いましょう。 (Let\'s meet at the station at 3pm tomorrow.)', jp: true },
        { text: '私の父は会社員です。 (My father is a company employee.)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: '来年 vs 去年: らいねん (next year) vs きょねん (last year)', isTrap: true },
        { text: '先 means "previous" in time but "ahead" in space: 先週 vs この先', isTrap: true },
        { text: 'On JLPT, many vocabulary items test similar-looking kanji — context is key', isTrap: true },
      ]},
    ],
  },
  {
    id: 'kanji-basics', title: 'Kanji', titleJp: '漢字', color: '#6366f1',
    headings: [
      { heading: 'what-it-is', bullets: [
        { text: 'Kanji are Chinese-origin characters adopted into Japanese' },
        { text: 'Each kanji has at least one on-reading (Chinese) and one kun-reading (Japanese)' },
        { text: 'N5 requires ~80 kanji; N4 ~300; N3 ~650; N2 ~1000; N1 ~2000+' },
      ]},
      { heading: 'key-patterns', bullets: [
        { text: 'Radicals: building blocks of kanji — 口(mouth), 手(hand), 木(tree), 水(water)', jp: true },
        { text: 'N5 kanji examples: 一二三四五 日月年時分 人口目耳手足 山川木火水', jp: true },
        { text: 'Compound readings: 日本語 = にほんご (Nihon+go); 大学 = だいがく (university)', jp: true },
        { text: 'Okurigana: kanji root + hiragana ending — 食べる, 書く, 見る', jp: true },
        { text: 'Stroke order: top-to-bottom, left-to-right, horizontal before vertical (general rules)', jp: true },
      ]},
      { heading: 'usage', bullets: [
        { text: 'Kun-reading usually used when kanji stands alone or with okurigana: 山(やま), 食べる' },
        { text: 'On-reading usually used in compound words: 山岳(さんがく), 食事(しょくじ)' },
        { text: 'Furigana (small hiragana above kanji) used in children\'s books, learner materials' },
      ]},
      { heading: 'differences', bullets: [
        { text: '日 as standalone = ひ (fire) or にち(day); in compound 日本 = に; 曜日 = よう/び', isTrap: true },
        { text: '大 = だい(big) in 大学, but おお in 大きい — same kanji, different readings', isTrap: true },
        { text: 'Traditional vs simplified: Japanese kanji ≠ Chinese simplified in some characters' },
      ]},
      { heading: 'mistakes', bullets: [
        { text: 'Assuming all kanji have only one reading (most have at least 2)', isTrap: true },
        { text: 'Writing kanji with wrong stroke order causes recognition issues in handwriting', isTrap: true },
        { text: 'Confusing 土(つち/ど soil) with 士(さむらい/し samurai) — one stroke difference' },
      ]},
      { heading: 'examples', bullets: [
        { text: '今日は学校で日本語の先生に会いました。 (Today I met a Japanese teacher at school.)', jp: true },
        { text: '山の上から川が見えます。 (You can see the river from the top of the mountain.)', jp: true },
      ]},
      { heading: 'exam-traps', bullets: [
        { text: '生 has 4+ readings: せい(student), しょう(life), き(raw), う(born) — context needed', isTrap: true },
        { text: 'JLPT kanji questions often test whether you know compound readings', isTrap: true },
        { text: '高校生 vs 高生: 高校生 (koukoUSEI=high school student) — must know compound boundaries', isTrap: true },
      ]},
    ],
  },
]

// ─── Flip card ───────────────────────────────────────────────────────────────
function FlipCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div onClick={() => setFlipped(f => !f)} title="Click to flip"
      style={{ cursor: 'pointer', perspective: 600, height: 90, marginBottom: 10 }}>
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d', transition: 'transform 0.5s',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        <div style={{
          position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
          background: '#ef444418', border: '1px solid #ef4444', borderRadius: 8,
          padding: '8px 12px', display: 'flex', alignItems: 'center',
          fontSize: 13, color: '#ef4444', lineHeight: 1.4,
        }}>
          <span style={{ marginRight: 8, fontSize: 16 }}>⚠️</span>{front}
        </div>
        <div style={{
          position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)', background: '#22c55e18', border: '1px solid #22c55e',
          borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center',
          fontSize: 13, color: '#22c55e', lineHeight: 1.4,
        }}>
          <span style={{ marginRight: 8, fontSize: 16 }}>✓</span>{back}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function JpMindMap({ onBack }: Props) {
  const { bubbles, saveBubbles, isEditMode, setIsEditMode } = useMindMapEdits('jp', BUBBLES)
  const [selected, setSelected]     = useState<Bubble | null>(null)
  const [openHeadings, setOpenH]    = useState<Set<Heading>>(new Set(['what-it-is']))
  const [fullscreen, setFullscreen] = useState(false)
  const [pan, setPan]               = useState({ x: 0, y: 0 })
  const [zoom, setZoom]             = useState(1)
  const isPanning                   = useRef(false)
  const panStart                    = useRef({ x: 0, y: 0 })
  const svgRef                      = useRef<SVGSVGElement>(null)

  const [addModal, setAddModal] = useState<{ title: string; color: string } | null>(null)
  const [editingTitle, setEditingTitle] = useState<{ id: string; value: string } | null>(null)
  const [editingBullet, setEditingBullet] = useState<{ heading: Heading; index: number; value: string } | null>(null)

  const total = bubbles.length

  const deleteBubble = (id: string) => {
    if (!confirm('Delete this bubble and all its content?')) return
    saveBubbles(bubbles.filter(b => b.id !== id))
    if (selected?.id === id) setSelected(null)
  }
  const commitTitle = (id: string, title: string) => {
    if (!title.trim()) { setEditingTitle(null); return }
    const next = bubbles.map(b => b.id === id ? { ...b, title: title.trim() } : b)
    saveBubbles(next)
    setSelected(prev => prev?.id === id ? { ...prev, title: title.trim() } : prev)
    setEditingTitle(null)
  }
  const addBulletToHeading = (bubbleId: string, heading: Heading) => {
    saveBubbles(bubbles.map(b => {
      if (b.id !== bubbleId) return b
      const existing = b.headings.find(h => h.heading === heading)
      if (existing) return { ...b, headings: b.headings.map(h => h.heading === heading ? { ...h, bullets: [...h.bullets, { text: 'New bullet' }] } : h) }
      return { ...b, headings: [...b.headings, { heading, bullets: [{ text: 'New bullet' }] }] }
    }))
  }
  const commitBullet = (bubbleId: string, heading: Heading, index: number, value: string) => {
    saveBubbles(bubbles.map(b => b.id !== bubbleId ? b : { ...b, headings: b.headings.map(h => h.heading !== heading ? h : { ...h, bullets: h.bullets.map((bl, i) => i === index ? { ...bl, text: value } : bl) }) }))
    setEditingBullet(null)
  }
  const deleteBullet = (bubbleId: string, heading: Heading, index: number) => {
    saveBubbles(bubbles.map(b => b.id !== bubbleId ? b : { ...b, headings: b.headings.map(h => h.heading !== heading ? h : { ...h, bullets: h.bullets.filter((_, i) => i !== index) }) }))
  }
  const addNewBubble = () => {
    if (!addModal?.title.trim()) return
    const id = `user_${Date.now().toString(36)}`
    saveBubbles([...bubbles, { id, title: addModal.title.trim(), color: addModal.color, headings: [] }])
    setAddModal(null)
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-bubble]')) return
    isPanning.current = true
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
  }, [])

  const handleMouseUp = useCallback(() => { isPanning.current = false }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.4, Math.min(2.5, z - e.deltaY * 0.001)))
  }, [])

  const selectBubble = useCallback((b: Bubble) => {
    setSelected(b)
    setOpenH(new Set(['what-it-is']))
  }, [])

  const toggleHeading = useCallback((h: Heading) => {
    setOpenH(prev => {
      const next = new Set(prev)
      next.has(h) ? next.delete(h) : next.add(h)
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const containerStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }
    : { display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 500 }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontFamily: 'inherit' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          🇯🇵 日本語 Mind Map
          {isEditMode && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#F5A62333', color: '#F5A623', border: '1px solid #F5A623' }}>Editing</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isEditMode && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Scroll to zoom · Drag to pan</span>}
          <button onClick={() => setIsEditMode(m => !m)} style={{ background: isEditMode ? '#F5A62322' : 'none', border: `1px solid ${isEditMode ? '#F5A623' : 'var(--border-color)'}`, borderRadius: 6, cursor: 'pointer', color: isEditMode ? '#F5A623' : 'var(--text-muted)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Pencil size={13} />{isEditMode ? 'Done' : 'Edit'}
          </button>
          <button onClick={() => setFullscreen(f => !f)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Canvas + Detail Panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: isPanning.current ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onWheel={handleWheel}>
          <svg ref={svgRef} width="100%" height="100%"
            viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${SVG_W / zoom} ${SVG_H / zoom}`}
            style={{ display: 'block' }}>

            {bubbles.map((b, i) => {
              const pos = getBubblePos(i, total)
              const isActive = selected?.id === b.id
              return (
                <line key={b.id}
                  x1={CX} y1={CY} x2={pos.x} y2={pos.y}
                  stroke={isActive ? b.color : '#333'}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={isActive ? 'none' : '4 4'}
                  style={{ transition: 'stroke 0.2s' }}
                />
              )
            })}

            <circle cx={CX} cy={CY} r={CENTER_R} fill="#1a0a2e" stroke="#ec4899" strokeWidth={2} />
            <text x={CX} y={CY - 10} textAnchor="middle" fill="#f9a8d4" fontSize={14} fontWeight={700}>日本語</text>
            <text x={CX} y={CY + 8} textAnchor="middle" fill="#f9a8d4" fontSize={11}>Mind Map</text>
            <text x={CX} y={CY + 22} textAnchor="middle" fill="#ec4899" fontSize={10}>{total} topics</text>

            {bubbles.map((b, i) => {
              const pos = getBubblePos(i, total)
              const isActive = selected?.id === b.id

              return (
                <g key={b.id} data-bubble="true" style={{ cursor: 'pointer' }}
                  onClick={() => selectBubble(b)}>
                  <circle cx={pos.x} cy={pos.y} r={BUBBLE_R}
                    fill={isActive ? b.color : `${b.color}22`}
                    stroke={b.color}
                    strokeWidth={isActive ? 3 : 1.5}
                    style={{ transition: 'all 0.2s', filter: isActive ? `drop-shadow(0 0 8px ${b.color})` : 'none' }}
                  />
                  <text x={pos.x} y={b.titleJp ? pos.y - 6 : pos.y + 4}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={isActive ? '#fff' : b.color}
                    fontSize={11} fontWeight={600}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {b.title}
                  </text>
                  {b.titleJp && (
                    <text x={pos.x} y={pos.y + 10}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={isActive ? 'rgba(255,255,255,0.8)' : `${b.color}cc`}
                      fontSize={10}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}>
                      {b.titleJp}
                    </text>
                  )}
                  {isEditMode && (
                    <g onClick={(e) => { e.stopPropagation(); deleteBubble(b.id) }}>
                      <circle cx={pos.x + BUBBLE_R - 8} cy={pos.y - BUBBLE_R + 8} r={10} fill="#ef4444" />
                      <text x={pos.x + BUBBLE_R - 8} y={pos.y - BUBBLE_R + 12} textAnchor="middle" fill="#fff" fontSize={12} style={{ pointerEvents: 'none' }}>✕</text>
                    </g>
                  )}
                </g>
              )
            })}

            {isEditMode && (
              <g data-bubble="true" style={{ cursor: 'pointer' }} onClick={() => setAddModal({ title: '', color: '#ec4899' })}>
                <circle cx={CX} cy={CY + CENTER_R + 28} r={18} fill="#F5A62322" stroke="#F5A623" strokeWidth={2} strokeDasharray="4 3" />
                <text x={CX} y={CY + CENTER_R + 33} textAnchor="middle" fill="#F5A623" fontSize={20} style={{ pointerEvents: 'none' }}>+</text>
              </g>
            )}
          </svg>

          <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-color)' }}>
            {Math.round(zoom * 100)}% · {total} topics
          </div>

          <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['+', '−', '⟳'].map((label, i) => (
              <button key={label} onClick={() => {
                if (i === 0) setZoom(z => Math.min(2.5, z + 0.15))
                else if (i === 1) setZoom(z => Math.max(0.4, z - 0.15))
                else { setZoom(1); setPan({ x: 0, y: 0 }) }
              }} style={{
                width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 16,
                color: 'var(--text-primary)', fontFamily: 'inherit',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            width: 360, borderLeft: `3px solid ${selected.color}`, overflowY: 'auto',
            background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', flexShrink: 0,
          }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: selected.color, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {selected.title} {selected.titleJp && <span style={{ fontSize: 14, opacity: 0.7 }}>{selected.titleJp}</span>}
                    {isEditMode && <button onClick={() => setEditingTitle({ id: selected.id, value: selected.title })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F5A623', padding: 2 }}><Pencil size={13} /></button>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isEditMode ? 'Edit mode — add/edit/delete content' : 'Click headings to expand'}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={16} /></button>
              </div>
            </div>

            <div style={{ padding: '8px 0', flex: 1 }}>
              {selected.headings.map(hc => {
                const isOpen = openHeadings.has(hc.heading)
                const hasTraps = hc.bullets.some(b => b.isTrap)
                return (
                  <div key={hc.heading}>
                    <button onClick={() => toggleHeading(hc.heading)} style={{
                      width: '100%', textAlign: 'left', padding: '10px 16px',
                      background: isOpen ? `${selected.color}11` : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isOpen ? selected.color : 'var(--text-primary)' }}>
                        {HEADING_LABELS[hc.heading]}
                        {hasTraps && <span style={{ marginLeft: 6, fontSize: 11, color: '#ef4444' }}>⚠</span>}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: '8px 16px 12px' }}>
                        {hc.heading === 'exam-traps' && !isEditMode ? (
                          hc.bullets.map((b, bi) => (
                            <FlipCard key={bi} front={b.text} back="Click to review the correct rule ↓" />
                          ))
                        ) : (
                          hc.bullets.map((b, bi) => (
                            <div key={bi} style={{ display: 'flex', gap: 8, marginBottom: 6, padding: '6px 8px', borderRadius: 6, background: b.isTrap ? '#ef444411' : b.jp ? `${selected.color}08` : 'transparent', border: b.isTrap ? '1px solid #ef444433' : 'none', alignItems: 'flex-start' }}>
                              <span style={{ color: b.isTrap ? '#ef4444' : selected.color, flexShrink: 0, marginTop: 1, fontSize: 13 }}>{b.isTrap ? '⚠' : '•'}</span>
                              {isEditMode && editingBullet?.heading === hc.heading && editingBullet.index === bi ? (
                                <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                                  <textarea value={editingBullet.value} onChange={e => setEditingBullet({ ...editingBullet, value: e.target.value })} rows={2} style={{ flex: 1, fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid #F5A623', background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }} />
                                  <button onClick={() => commitBullet(selected.id, hc.heading, bi, editingBullet.value)} style={{ background: '#22c55e', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 6px', color: '#fff' }}><Check size={12} /></button>
                                  <button onClick={() => setEditingBullet(null)} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer', padding: '4px 6px', color: 'var(--text-muted)' }}><X size={12} /></button>
                                </div>
                              ) : (
                                <>
                                  <span style={{ fontSize: 13, color: b.isTrap ? '#fca5a5' : 'var(--text-primary)', lineHeight: 1.6, flex: 1 }}>{b.text}</span>
                                  {isEditMode && (
                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                      <button onClick={() => setEditingBullet({ heading: hc.heading, index: bi, value: b.text })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Pencil size={11} /></button>
                                      <button onClick={() => deleteBullet(selected.id, hc.heading, bi)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><Trash2 size={11} /></button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))
                        )}
                        {isEditMode && (
                          <button onClick={() => addBulletToHeading(selected.id, hc.heading)} style={{ marginTop: 4, width: '100%', padding: '5px', fontSize: 12, background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                            <Plus size={11} style={{ display: 'inline', marginRight: 4 }} />Add bullet
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Rename modal */}
      {editingTitle && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditingTitle(null)}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 24, width: 320, border: '1px solid var(--border-color)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Rename Bubble</div>
            <input autoFocus value={editingTitle.value} onChange={e => setEditingTitle({ ...editingTitle, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') commitTitle(editingTitle.id, editingTitle.value); if (e.key === 'Escape') setEditingTitle(null) }} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid #F5A623', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingTitle(null)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => commitTitle(editingTitle.id, editingTitle.value)} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#F5A623', cursor: 'pointer', color: '#000', fontWeight: 700, fontFamily: 'inherit' }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Add bubble modal */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAddModal(null)}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 24, width: 320, border: '1px solid #F5A623' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Add New Bubble</div>
            <input autoFocus placeholder="Topic name…" value={addModal.title} onChange={e => setAddModal({ ...addModal, title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') addNewBubble(); if (e.key === 'Escape') setAddModal(null) }} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', marginBottom: 12 }} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Color:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {EDIT_COLORS.map(c => <div key={c} onClick={() => setAddModal({ ...addModal, color: c })} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: addModal.color === c ? '3px solid #fff' : '2px solid transparent', boxSizing: 'border-box' }} />)}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAddModal(null)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={addNewBubble} disabled={!addModal.title.trim()} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#F5A623', cursor: addModal.title.trim() ? 'pointer' : 'not-allowed', color: '#000', fontWeight: 700, fontFamily: 'inherit', opacity: addModal.title.trim() ? 1 : 0.5 }}>Add Bubble</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
