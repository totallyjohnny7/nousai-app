/**
 * jpVocabBank — Default pre-populated Japanese vocabulary & grammar bank
 * Covers all 13 parts of speech from Nakama 1 / JAPN 1110 Spring.
 * Users can add to, edit, or clear this via VocabBankTab.
 */
import type { VocabBankItem, VocabCategory } from '../components/jpquiz/types'

let _seq = 0
function id(): string { return `vb_default_${(++_seq).toString(36)}` }
function item(
  word: string, meaning: string, category: VocabCategory,
  extras: Partial<Omit<VocabBankItem, 'id' | 'word' | 'meaning' | 'category'>> = {}
): VocabBankItem {
  return { id: id(), word, meaning, category, source: 'nakama1', ...extras }
}

// ─── 1. NOUNS 名詞 ────────────────────────────────────────────────────────────
const NOUNS: VocabBankItem[] = [
  item('ほん',       'book',            'noun'),
  item('くるま',     'car',             'noun'),
  item('じかん',     'time',            'noun'),
  item('きもち',     'feeling',         'noun'),
  item('がっこう',   'school',          'noun', { reading: 'がっこう' }),
  item('せんせい',   'teacher',         'noun'),
  item('がくせい',   'student',         'noun'),
  item('ともだち',   'friend',          'noun'),
  item('かぞく',     'family',          'noun'),
  item('いえ',       'house/home',      'noun'),
  item('まち',       'town/city',       'noun'),
  item('にほん',     'Japan',           'noun'),
  item('にほんご',   'Japanese language','noun'),
  item('えいご',     'English language','noun'),
  item('おかね',     'money',           'noun'),
  item('しごと',     'work/job',        'noun'),
  item('たべもの',   'food',            'noun'),
  item('のみもの',   'drink/beverage',  'noun'),
  item('でんしゃ',   'train',           'noun'),
  item('みせ',       'store/shop',      'noun'),
]

// ─── Verbal Nouns (する-nouns) ─────────────────────────────────────────────
const VERBAL_NOUNS: VocabBankItem[] = [
  item('べんきょう', 'studying → べんきょうする', 'verbal-noun',
    { example: 'まいにちにほんごをべんきょうします。', exampleEn: 'I study Japanese every day.' }),
  item('りょこう',   'travel → りょこうする',     'verbal-noun',
    { example: 'なつにりょこうします。', exampleEn: 'I travel in the summer.' }),
  item('かいもの',   'shopping → かいものする',   'verbal-noun'),
  item('りょうり',   'cooking → りょうりする',    'verbal-noun'),
  item('うんどう',   'exercise → うんどうする',   'verbal-noun'),
  item('しゅくだい', 'homework → しゅくだいをする','verbal-noun'),
]

// ─── 2. PRONOUNS 代名詞 ───────────────────────────────────────────────────────
const PRONOUNS: VocabBankItem[] = [
  item('わたし',     'I / me',          'pronoun'),
  item('あなた',     'you',             'pronoun'),
  item('かれ',       'he / him',        'pronoun'),
  item('かのじょ',   'she / her',       'pronoun'),
  item('わたしたち', 'we / us',         'pronoun'),
  item('かれら',     'they (masc.)',     'pronoun'),
]

// ─── 3. VERBS 動詞 ────────────────────────────────────────────────────────────
const VERBS_U: VocabBankItem[] = [
  item('かく',   'to write (u-verb)',   'verb-u',
    { example: 'てがみをかきます。', exampleEn: 'I write a letter.' }),
  item('のむ',   'to drink (u-verb)',   'verb-u',
    { example: 'みずをのみます。', exampleEn: 'I drink water.' }),
  item('はなす', 'to speak (u-verb)',   'verb-u',
    { example: 'にほんごをはなします。', exampleEn: 'I speak Japanese.' }),
  item('きく',   'to listen (u-verb)',  'verb-u',
    { example: 'おんがくをききます。', exampleEn: 'I listen to music.' }),
  item('よむ',   'to read (u-verb)',    'verb-u',
    { example: 'ほんをよみます。', exampleEn: 'I read a book.' }),
  item('かう',   'to buy (u-verb)',     'verb-u'),
  item('いく',   'to go (u-verb)',      'verb-u',
    { example: 'がっこうにいきます。', exampleEn: 'I go to school.' }),
  item('くる',   'to come (irregular)', 'verb-irregular',
    { example: 'うちにきます。', exampleEn: 'I come home.', notes: 'Irregular — memorize all forms.' }),
  item('かえる', 'to return home (u-verb)', 'verb-u'),
  item('まつ',   'to wait (u-verb)',    'verb-u'),
]

const VERBS_RU: VocabBankItem[] = [
  item('たべる', 'to eat (ru-verb)',    'verb-ru',
    { example: 'あさごはんをたべます。', exampleEn: 'I eat breakfast.' }),
  item('みる',   'to see/watch (ru-verb)', 'verb-ru',
    { example: 'テレビをみます。', exampleEn: 'I watch TV.' }),
  item('おきる', 'to wake up (ru-verb)','verb-ru',
    { example: 'しちじにおきます。', exampleEn: 'I wake up at 7 o\'clock.' }),
  item('ねる',   'to sleep (ru-verb)',  'verb-ru'),
  item('みせる', 'to show (ru-verb)',   'verb-ru'),
  item('おしえる','to teach (ru-verb)', 'verb-ru'),
]

const VERBS_IRR: VocabBankItem[] = [
  item('する',   'to do (irregular)',   'verb-irregular',
    { notes: 'Irregular: します／しません／しました／しませんでした' }),
  item('べんきょうする', 'to study',    'verb-irregular'),
]

// ─── 4. i-ADJECTIVES い形容詞 ─────────────────────────────────────────────────
const I_ADJ: VocabBankItem[] = [
  item('たかい', 'expensive / tall (i-adj)', 'i-adj',
    { example: 'このくるまはたかいです。', exampleEn: 'This car is expensive.',
      notes: 'Neg: たかくありません  Past: たかかったです' }),
  item('やすい', 'cheap / inexpensive (i-adj)', 'i-adj'),
  item('おおきい','big / large (i-adj)',  'i-adj'),
  item('ちいさい','small (i-adj)',         'i-adj'),
  item('あたらしい','new (i-adj)',         'i-adj'),
  item('ふるい', 'old (thing) (i-adj)',   'i-adj'),
  item('いい',   'good (i-adj, IRREGULAR)','i-adj',
    { notes: '⚠️ Irregular: Neg→よくありません  Past→よかったです  Adv→よく' }),
  item('たのしい','fun / enjoyable (i-adj)', 'i-adj'),
  item('むずかしい','difficult (i-adj)',   'i-adj'),
  item('やさしい','easy / kind (i-adj)',  'i-adj'),
  item('いそがしい','busy (i-adj)',        'i-adj'),
  item('さむい', 'cold (weather) (i-adj)', 'i-adj'),
  item('あつい', 'hot (weather) (i-adj)', 'i-adj'),
]

// ─── 5. na-ADJECTIVES な形容詞 ────────────────────────────────────────────────
const NA_ADJ: VocabBankItem[] = [
  item('しずか',  'quiet (na-adj)',      'na-adj',
    { example: 'としょかんはしずかです。', exampleEn: 'The library is quiet.',
      notes: 'Before noun: しずかなまち' }),
  item('きれい',  'pretty / clean (na-adj)', 'na-adj',
    { notes: '⚠️ Ends in い but is な-adjective!' }),
  item('ゆうめい','famous (na-adj)',      'na-adj'),
  item('りっぱ',  'splendid / fine (na-adj)', 'na-adj'),
  item('すき',    'liked / favorite (na-adj)', 'na-adj',
    { example: 'すしがすきです。', exampleEn: 'I like sushi.' }),
  item('きらい',  'disliked (na-adj)',   'na-adj'),
  item('げんき',  'healthy / energetic (na-adj)', 'na-adj'),
  item('ひま',    'free time / not busy (na-adj)', 'na-adj'),
  item('べんり',  'convenient (na-adj)', 'na-adj'),
  item('たいせつ','important / precious (na-adj)', 'na-adj'),
]

// ─── 6. ADVERBS 副詞 ──────────────────────────────────────────────────────────
const ADVERBS: VocabBankItem[] = [
  item('とても',    'very',            'adverb'),
  item('すこし',    'a little',        'adverb'),
  item('ちょっと',  'a little (casual)','adverb'),
  item('もっと',    'more',            'adverb'),
  item('いつも',    'always',          'adverb'),
  item('よく',      'often',           'adverb'),
  item('たいてい',  'usually',         'adverb'),
  item('ときどき',  'sometimes',       'adverb'),
  item('あまり',    'not much (+ neg)', 'adverb',
    { notes: '⚠️ Must pair with negative form: あまり〜ません' }),
  item('ぜんぜん',  'not at all (+ neg)', 'adverb',
    { notes: '⚠️ Must pair with negative: ぜんぜん〜ません' }),
  item('もう',      'already',         'adverb'),
  item('まだ',      'still / not yet', 'adverb'),
  item('すぐ',      'right away',      'adverb'),
  item('また',      'again',           'adverb'),
  item('いっしょに','together',        'adverb'),
  item('ひとりで',  'alone / by oneself','adverb'),
]

// ─── 7. PARTICLES 助詞 ────────────────────────────────────────────────────────
const PARTICLES: VocabBankItem[] = [
  item('は', 'topic marker ("as for X")', 'particle',
    { example: 'わたしはがくせいです。', exampleEn: 'I am a student.' }),
  item('が', 'subject marker (new info, question answers, existence)', 'particle',
    { notes: 'Question words always take が not は in the answer.' }),
  item('も', 'also / too (replaces は or が)', 'particle'),
  item('を', 'direct object marker', 'particle',
    { example: 'りんごをたべます。', exampleEn: 'I eat an apple.' }),
  item('に', 'time / destination / location of existence / recipient', 'particle',
    { example: 'ともだちにてがみをかきます。', exampleEn: 'I write a letter to my friend.' }),
  item('へ', 'direction toward (interchangeable with に for destinations)', 'particle'),
  item('で', 'where action happens / by what means', 'particle',
    { example: 'としょかんでべんきょうします。', exampleEn: 'I study at the library.' }),
  item('と', 'with (person) / and (nouns only)', 'particle'),
  item('の', 'possessive / noun connector / pronoun substitute', 'particle',
    { example: 'わたしのほん', exampleEn: 'my book' }),
  item('や', 'and (listing, not exhaustive)', 'particle'),
  item('から', 'from', 'particle'),
  item('まで', 'until / to', 'particle'),
  item('か', 'question marker (sentence-end)', 'particle'),
  item('よ', 'assertion ("I\'m telling you!")', 'particle'),
  item('ね', 'agreement-seeking ("right?")', 'particle'),
  item('よね','assertion + agreement', 'particle'),
  item('ぐらい/くらい', 'approximately / about', 'particle'),
]

// ─── 8. CONJUNCTIONS 接続詞 ──────────────────────────────────────────────────
const CONJUNCTIONS: VocabBankItem[] = [
  item('そして',   'and then',         'conjunction'),
  item('でも',     'but / however',    'conjunction'),
  item('だから',   'so / therefore',   'conjunction'),
  item('それから', 'and after that',   'conjunction'),
  item('または',   'or',               'conjunction'),
]

// ─── 9. INTERJECTIONS 感動詞 ─────────────────────────────────────────────────
const INTERJECTIONS: VocabBankItem[] = [
  item('はい',   'yes (formal)',       'interjection'),
  item('いいえ', 'no (formal)',        'interjection'),
  item('ええ',   'yes / yeah (casual)','interjection'),
  item('あ',     'ah / oh',           'interjection'),
  item('ねえ',   'hey',               'interjection'),
  item('うん',   'uh-huh / yeah (casual)', 'interjection'),
  item('えーと', 'um / well (hesitation)', 'interjection'),
  item('あのう', 'um / excuse me',    'interjection'),
]

// ─── 11. DEMONSTRATIVES 指示詞 (Ko-So-A-Do) ──────────────────────────────────
const DEMONSTRATIVES: VocabBankItem[] = [
  item('これ', 'this (thing, near speaker)',        'demonstrative'),
  item('それ', 'that (thing, near listener)',       'demonstrative'),
  item('あれ', 'that (thing, far from both)',       'demonstrative'),
  item('どれ', 'which (thing)?',                   'demonstrative'),
  item('ここ', 'here',                              'demonstrative'),
  item('そこ', 'there (near listener)',             'demonstrative'),
  item('あそこ','over there',                       'demonstrative'),
  item('どこ', 'where?',                            'demonstrative'),
  item('こちら','this way / here (polite)',         'demonstrative'),
  item('そちら','that way / there (polite)',        'demonstrative'),
  item('あちら','over there (polite)',              'demonstrative'),
  item('どちら','which way? (polite)',              'demonstrative'),
  item('この', 'this ___ (modifies noun)',          'demonstrative'),
  item('その', 'that ___ (modifies noun)',          'demonstrative'),
  item('あの', 'that ___ over there (modifies noun)','demonstrative'),
  item('どの', 'which ___? (modifies noun)',        'demonstrative'),
  item('こう', 'like this (manner)',                'demonstrative'),
  item('そう', 'like that (manner)',                'demonstrative'),
  item('ああ', 'like that (far, manner)',           'demonstrative'),
  item('どう', 'how? / in what way?',              'demonstrative'),
]

// ─── 12. QUESTION WORDS 疑問詞 ───────────────────────────────────────────────
const QUESTION_WORDS: VocabBankItem[] = [
  item('なに/なん', 'what?',           'question-word',
    { notes: 'なん before です/の/counter; なに elsewhere' }),
  item('だれ',      'who?',            'question-word'),
  item('どこ',      'where?',          'question-word'),
  item('いつ',      'when?',           'question-word'),
  item('どうして',  'why? (casual)',   'question-word'),
  item('なぜ',      'why? (formal)',   'question-word'),
  item('どう',      'how?',            'question-word'),
  item('いくら',    'how much? (price)','question-word'),
  item('いくつ',    'how many? (general)','question-word'),
  item('なんさい',  'how old?',        'question-word'),
]

// ─── 13. COUNTERS 助数詞 ─────────────────────────────────────────────────────
const COUNTERS: VocabBankItem[] = [
  item('〜じ',      '~o\'clock',       'counter',
    { example: 'しちじにおきます。', exampleEn: 'I wake up at 7 o\'clock.' }),
  item('〜ふん/ぷん','~minutes',        'counter'),
  item('〜まい',    '~flat things (sheets, paper)', 'counter'),
  item('〜ほん',    '~long thin things (pens, bottles)', 'counter'),
  item('〜ひき',    '~small animals',  'counter'),
  item('〜さつ',    '~bound books',    'counter'),
  item('〜だい',    '~machines / vehicles', 'counter'),
  item('〜にん',    '~people',         'counter'),
  item('〜つ',      '~general objects (up to 10)', 'counter'),
  item('〜えん',    '~yen',            'counter'),
]

// ─── GRAMMAR PATTERNS (for Sentence Builder) ─────────────────────────────────
const GRAMMAR: VocabBankItem[] = [
  item('Xは Y です',
    'X is Y (affirmative copula)',
    'grammar',
    { example: 'わたしはがくせいです。', exampleEn: 'I am a student.' }),
  item('Xは Y じゃありません',
    'X is not Y (negative copula)',
    'grammar',
    { example: 'これはほんじゃありません。', exampleEn: 'This is not a book.' }),
  item('Xは Y ですか',
    'Is X Y? (yes/no question)',
    'grammar',
    { example: 'あなたはがくせいですか。', exampleEn: 'Are you a student?' }),
  item('〜ます / 〜ません',
    'polite present/future affirmative / negative',
    'grammar',
    { example: 'まいにちにほんごをべんきょうします。', exampleEn: 'I study Japanese every day.' }),
  item('〜ました / 〜ませんでした',
    'polite past affirmative / negative',
    'grammar',
    { example: 'きのうえいがをみました。', exampleEn: 'I watched a movie yesterday.' }),
  item('〜てください',
    'Please do ~ (polite request)',
    'grammar',
    { example: 'ゆっくりはなしてください。', exampleEn: 'Please speak slowly.' }),
  item('〜ませんか',
    'Won\'t you ~? (invitation)',
    'grammar',
    { example: 'いっしょにたべませんか。', exampleEn: 'Won\'t you eat together with me?' }),
  item('Xに Yがあります / います',
    'There is Y at X (あります=thing, います=living)',
    'grammar',
    { example: 'つくえのうえにほんがあります。', exampleEn: 'There is a book on the desk.' }),
  item('Xから Yまで',
    'from X to/until Y',
    'grammar',
    { example: 'くじからごじまではたらきます。', exampleEn: 'I work from 9 to 5.' }),
  item('〜たいです',
    'I want to ~ (desire)',
    'grammar',
    { example: 'すしをたべたいです。', exampleEn: 'I want to eat sushi.' }),
  item('〜ながら',
    'while doing ~ (simultaneous actions)',
    'grammar',
    { example: 'おんがくをききながらべんきょうします。', exampleEn: 'I study while listening to music.' }),
  item('い-adj → く + ない',
    'i-adjective negative conjugation',
    'grammar',
    { example: 'このくるまはたかくありません。', exampleEn: 'This car is not expensive.' }),
  item('な-adj + じゃありません',
    'na-adjective negative conjugation',
    'grammar',
    { example: 'このへやはしずかじゃありません。', exampleEn: 'This room is not quiet.' }),
]

// ─── Full export ──────────────────────────────────────────────────────────────
export const DEFAULT_VOCAB_BANK: VocabBankItem[] = [
  ...NOUNS,
  ...VERBAL_NOUNS,
  ...PRONOUNS,
  ...VERBS_U,
  ...VERBS_RU,
  ...VERBS_IRR,
  ...I_ADJ,
  ...NA_ADJ,
  ...ADVERBS,
  ...PARTICLES,
  ...CONJUNCTIONS,
  ...INTERJECTIONS,
  ...DEMONSTRATIVES,
  ...QUESTION_WORDS,
  ...COUNTERS,
  ...GRAMMAR,
]

export const CATEGORY_LABELS: Record<string, string> = {
  'noun':             '名詞 Noun',
  'verbal-noun':      'する-Verb Noun',
  'pronoun':          '代名詞 Pronoun',
  'demonstrative':    '指示詞 Demonstrative',
  'verb-u':           '動詞 u-Verb',
  'verb-ru':          '動詞 ru-Verb',
  'verb-irregular':   '動詞 Irregular',
  'i-adj':            'い形容詞 i-Adj',
  'na-adj':           'な形容詞 na-Adj',
  'adverb':           '副詞 Adverb',
  'particle':         '助詞 Particle',
  'conjunction':      '接続詞 Conjunction',
  'interjection':     '感動詞 Interjection',
  'question-word':    '疑問詞 Question Word',
  'counter':          '助数詞 Counter',
  'grammar':          '文法 Grammar Pattern',
  'other':            'その他 Other',
}
