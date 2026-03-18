/**
 * jpVocabBank — Official Nakama 1 vocabulary, Ch. 1–6 (JAPN 1110)
 *
 * Flashcard direction: word    = English (FRONT / term shown to user)
 *                      meaning = Japanese hiragana/katakana (BACK / recalled answer)
 *
 * Source: Nakama 1: Introductory Japanese (Hatasa, Hatasa, Makino), 3rd ed.
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
// item(ENGLISH_FRONT, JAPANESE_BACK, category)

// ─── CH. 1 VOCAB (pp. 29–30): Expressions & Address Titles ───────────────────
const CH1_EXPRESSIONS: VocabBankItem[] = [
  item('Good morning (formal)',                          'おはようございます',              'expression'),
  item('Good morning (casual)',                          'おはよう',                        'expression'),
  item('Good afternoon / Hello',                        'こんにちは',                      'expression'),
  item('Good evening / Hello',                          'こんばんは',                      'expression'),
  item('How do you do (first meeting)',                  'はじめまして',                    'expression'),
  item('I am ~ / It is ~',                              '～です',                          'expression'),
  item('Pleased to meet you',                           'どうぞよろしく',                  'expression'),
  item('Same here / It is I who should say that',       'こちらこそ',                      'expression'),
  item('Good-bye (to superior) / Excuse me',            'しつれいします',                  'expression'),
  item('See you later (to friends)',                     'じゃあ、また',                    'expression'),
  item('Good-bye (long absence)',                        'さようなら',                      'expression'),
  item('Thank you (formal)',                             'ありがとうございます',             'expression'),
  item('Thank you (casual)',                             'ありがとう',                      'expression'),
  item("You're welcome",                                 'どういたしまして',                'expression'),
  item("Excuse me / I'm sorry",                         'すみません',                      'expression'),
  item('Please listen',                                  'きいてください',                  'expression'),
  item('Please look',                                    'みてください',                    'expression'),
  item('Please write',                                   'かいてください',                  'expression'),
  item('Please read',                                    'よんでください',                  'expression'),
  item('Please say it',                                  'いってください',                  'expression'),
  item('Please say it again',                            'もういちどいってください',        'expression'),
  item('Please speak louder',                            'おおきいこえでいってください',    'expression'),
  item('(It/someone) is called ~',                       '～といいます／～っていいます',    'expression'),
  item('Please give me ~',                               '～をください',                    'expression'),
  item('Please show me ~',                               '～をみせてください',              'expression'),
  item('What is this in Japanese?',                      'これはにほんごでなんといいますか', 'expression'),
  item('What is this in English?',                       'これはえいごでなんといいますか',  'expression'),
  item("I don't understand",                             'わかりません',                    'expression'),
  item('Please speak slowly',                            'ゆっくりいってください',          'expression'),
  item("It's ~, right? (confirming)",                   '～ですね？',                      'expression'),
]

const CH1_ADDRESS: VocabBankItem[] = [
  item('Mr./Ms. (general polite title)',                    '～さん',   'expression'),
  item('Teacher/Professor (title — never use for yourself)','せんせい', 'expression'),
  item('Title for young boys',                             '～くん',   'expression'),
  item('Title for small children',                         '～ちゃん', 'expression'),
]

// ─── CH. 2 VOCAB (pp. 32–35) ─────────────────────────────────────────────────
const CH2_NOUNS: VocabBankItem[] = [
  item('Asian studies',           'アジアけんきゅう', 'noun'),
  item('America',                 'アメリカ',         'noun'),
  item('England',                 'イギリス',         'noun'),
  item('freshman (1st year)',     'いちねんせい',     'noun'),
  item('now',                     'いま',             'noun'),
  item('English (language)',      'えいご',           'noun'),
  item('Australia',               'オーストラリア',   'noun'),
  item('student',                 'がくせい',         'noun'),
  item('Canada',                  'カナダ',           'noun'),
  item('South Korea',             'かんこく',         'noun'),
  item('management',              'けいえいがく',     'noun'),
  item('engineering',             'こうがく',         'noun'),
  item('high school',             'こうこう',         'noun'),
  item('p.m.',                    'ごご',             'noun'),
  item('a.m.',                    'ごぜん',           'noun'),
  item('this person / this way',  'こちら',           'noun'),
  item('junior (3rd year)',       'さんねんせい',     'noun'),
  item('Spain',                   'スペイン',         'noun'),
  item('major (field of study)',  'せんこう',         'noun'),
  item('college / university',    'だいがく',         'noun'),
  item('grad student',            'だいがくいんせい', 'noun'),
  item('college student',         'だいがくせい',     'noun'),
  item('Taiwan',                  'たいわん',         'noun'),
  item('China',                   'ちゅうごく',       'noun'),
  item('name',                    'なまえ',           'noun'),
  item('sophomore (2nd year)',    'にねんせい',       'noun'),
  item('Japan',                   'にほん',           'noun'),
  item('business',                'ビジネス',         'noun'),
  item('France',                  'フランス',         'noun'),
  item('literature',              'ぶんがく',         'noun'),
  item('Mexico',                  'メキシコ',         'noun'),
  item('senior (4th year)',       'よねんせい',       'noun'),
  item('next year',               'らいねん',         'noun'),
  item('international student',   'りゅうがくせい',   'noun'),
  item('history',                 'れきし',           'noun'),
]

const CH2_PRONOUNS: VocabBankItem[] = [
  item('I (male, casual)',  'ぼく',   'pronoun'),
  item('I',                 'わたし', 'pronoun'),
]

const CH2_COPULA: VocabBankItem[] = [
  item('to be (copula)', 'です', 'grammar',
    { notes: 'Neg: じゃありません / じゃないです  Past: でした  Past neg: じゃありませんでした' }),
]

const CH2_TIME: VocabBankItem[] = [
  item("1 o'clock",  'いちじ',       'counter'),
  item("2 o'clock",  'にじ',         'counter'),
  item("3 o'clock",  'さんじ',       'counter'),
  item("4 o'clock",  'よじ',         'counter', { notes: '⚠️ Irregular: よじ (not しじ)' }),
  item("5 o'clock",  'ごじ',         'counter'),
  item("6 o'clock",  'ろくじ',       'counter'),
  item("7 o'clock",  'しちじ',       'counter', { notes: '⚠️ Irregular: しちじ (not ななじ)' }),
  item("8 o'clock",  'はちじ',       'counter'),
  item("9 o'clock",  'くじ',         'counter', { notes: '⚠️ Irregular: くじ (not きゅうじ)' }),
  item("10 o'clock", 'じゅうじ',     'counter'),
  item("11 o'clock", 'じゅういちじ', 'counter'),
  item("12 o'clock", 'じゅうにじ',   'counter'),
  item('half past',  'はん',         'counter'),
]

const CH2_QUESTION_WORDS: VocabBankItem[] = [
  item('where',          'どこ',       'question-word'),
  item('where (polite)', 'どちら',     'question-word'),
  item('what',           'なに／なん', 'question-word',
    { notes: 'なん before です/の/counter; なに elsewhere' }),
]

const CH2_PARTICLES: VocabBankItem[] = [
  item('question marker (sentence-end)',                    'か', 'particle'),
  item('noun modifier / possessive connector',              'の', 'particle',
    { example: 'わたし の ほん', exampleEn: 'my book' }),
  item('topic marker ("as for X")',                         'は', 'particle',
    { example: 'わたし は がくせい です。', exampleEn: 'I am a student.' }),
  item('similarity marker (also / too — replaces は or が)','も', 'particle'),
]

const CH2_SUFFIXES: VocabBankItem[] = [
  item('~ language (suffix)',      '〜ご',  'other'),
  item("~ o'clock (suffix)",       '〜じ',  'counter'),
  item('~ nationality (suffix)',   '〜じん','other'),
  item('~ year student (suffix)',  '〜せい','other'),
  item('~ year (suffix)',          '〜ねん','other'),
]

// ─── CH. 3 VOCAB (pp. 84–87) ─────────────────────────────────────────────────
const CH3_NOUNS: VocabBankItem[] = [
  item('morning',              'あさ',          'noun'),
  item('breakfast',            'あさごはん',    'noun'),
  item('day after tomorrow',   'あさって',      'noun'),
  item('tomorrow',             'あした',        'noun'),
  item('home',                 'うち',          'noun'),
  item('movie',                'えいが',        'noun'),
  item('day before yesterday', 'おととい',      'noun'),
  item('bath',                 'おふろ',        'noun'),
  item('school',               'がっこう',      'noun'),
  item('Tuesday',              'かようび',      'noun'),
  item('yesterday',            'きのう',        'noun'),
  item('today',                'きょう',        'noun'),
  item('Friday',               'きんようび',    'noun'),
  item('class',                'クラス',        'noun'),
  item('Monday',               'げつようび',    'noun'),
  item('coffee',               'コーヒー',      'noun'),
  item('rice / meal',          'ごはん',        'noun'),
  item('this week',            'こんしゅう',    'noun'),
  item('tonight',              'こんばん',      'noun'),
  item('shower',               'シャワー',      'noun'),
  item('weekend',              'しゅうまつ',    'noun'),
  item('class / course',       'じゅぎょう',    'noun'),
  item('homework',             'しゅくだい',    'noun'),
  item('Wednesday',            'すいようび',    'noun'),
  item('life / living',        'せいかつ',      'noun'),
  item('last week',            'せんしゅう',    'noun'),
  item('next',                 'つぎ',          'noun'),
  item('TV',                   'テレビ',        'noun'),
  item('phone number',         'でんわばんごう','noun'),
  item('library',              'としょかん',    'noun'),
  item('Saturday',             'どようび',      'noun'),
  item('Sunday',               'にちようび',    'noun'),
  item('night / evening',      'ばん',          'noun'),
  item('dinner',               'ばんごはん',    'noun'),
  item('afternoon',            'ひる',          'noun'),
  item('lunch',                'ひるごはん',    'noun'),
  item('study (noun)',         'べんきょう',    'noun'),
  item('book',                 'ほん',          'noun'),
  item('every morning',        'まいあさ',      'noun'),
  item('every week',           'まいしゅう',    'noun'),
  item('every day',            'まいにち',      'noun'),
  item('every night',          'まいばん',      'noun'),
  item('Thursday',             'もくようび',    'noun'),
]

const CH3_VERBS_U: VocabBankItem[] = [
  item('to exist (inanimate) / to have', 'あります',   'verb-u'),
  item('to go',                          'いきます',   'verb-u'),
  item('to go home',                     'かえります', 'verb-u'),
  item('to drink',                       'のみます',   'verb-u'),
  item('to enter / to take (a bath)',    'はいります', 'verb-u'),
  item('to read',                        'よみます',   'verb-u'),
]

const CH3_VERBS_RU: VocabBankItem[] = [
  item('to take (a shower)', 'あびます', 'verb-ru'),
  item('to wake up',         'おきます', 'verb-ru'),
  item('to eat',             'たべます', 'verb-ru'),
  item('to go to bed',       'ねます',   'verb-ru'),
  item('to see / watch',     'みます',   'verb-ru'),
]

const CH3_VERBS_IRR: VocabBankItem[] = [
  item('to come',    'きます',           'verb-irregular'),
  item('to do',      'します',           'verb-irregular'),
  item('to study',   'べんきょうします', 'verb-irregular'),
]

const CH3_QUESTION: VocabBankItem[] = [
  item('when', 'いつ', 'question-word'),
]

const CH3_NUMBERS: VocabBankItem[] = [
  item('zero',  'ゼロ／れい', 'counter'),
  item('one',   'いち',       'counter'),
  item('two',   'に',         'counter'),
  item('three', 'さん',       'counter'),
  item('four',  'よん／し',   'counter'),
  item('five',  'ご',         'counter'),
  item('six',   'ろく',       'counter'),
  item('seven', 'なな／しち', 'counter'),
  item('eight', 'はち',       'counter'),
  item('nine',  'きゅう／く', 'counter'),
  item('ten',   'じゅう',     'counter'),
]

const CH3_COUNTER: VocabBankItem[] = [
  item('~ minutes (counter)', '〜ふん', 'counter',
    { notes: 'Sound change: 1,3,6,8,10 minutes use ぷん instead of ふん' }),
]

const CH3_ADVERBS: VocabBankItem[] = [
  item('not very often (⚠️ + negative verb)', 'あまり',   'adverb',
    { notes: '⚠️ Must pair with negative: あまり〜ません' }),
  item('always',                               'いつも',   'adverb'),
  item('not at all (⚠️ + negative verb)',     'ぜんぜん', 'adverb',
    { notes: '⚠️ Must pair with negative: ぜんぜん〜ません' }),
  item('usually',                              'たいてい', 'adverb'),
  item('sometimes',                            'ときどき', 'adverb'),
  item('often',                                'よく',     'adverb'),
]

const CH3_PARTICLES: VocabBankItem[] = [
  item('location of action (at / in)',     'で', 'particle',
    { example: 'としょかん で べんきょう します。', exampleEn: 'I study at the library.' }),
  item('point in time / goal of movement', 'に', 'particle'),
  item('direction (toward)',               'へ', 'particle'),
  item('direct object marker',             'を', 'particle'),
]

const CH3_AFFIXES: VocabBankItem[] = [
  item('this ~ (prefix for current period)', 'こん〜',  'other'),
  item('every ~ (prefix)',                   'まい〜',  'other'),
  item('about ~ (approximate time suffix)', '〜ごろ',  'other'),
  item('day of the week (suffix)',           '〜ようび','other'),
]

// ─── CH. 4 VOCAB (pp. 124–126) ───────────────────────────────────────────────
const CH4_NOUNS: VocabBankItem[] = [
  item('apartment',               'アパート',      'noun'),
  item('station',                 'えき',          'noun'),
  item('pencil',                  'えんぴつ',      'noun'),
  item('bag',                     'かばん',        'noun'),
  item('café',                    'カフェ',        'noun'),
  item('coffee shop (traditional)','きっさてん',   'noun'),
  item('textbook',                'きょうかしょ',  'noun'),
  item('bank',                    'ぎんこう',      'noun'),
  item('eraser',                  'けしゴム',      'noun'),
  item('park',                    'こうえん',      'noun'),
  item('police box',              'こうばん',      'noun'),
  item('this area / around here', 'このへん',      'noun'),
  item('convenience store',       'コンビニ',      'noun'),
  item('dictionary',              'じしょ',        'noun'),
  item('supermarket',             'スーパー',      'noun'),
  item('building',                'たてもの',      'noun'),
  item('test',                    'テスト',        'noun'),
  item('department store',        'デパート',      'noun'),
  item('notebook',                'ノート',        'noun'),
  item('building (multi-story)',  'ビル',          'noun'),
  item('hospital',                'びょういん',    'noun'),
  item('pen',                     'ペン',          'noun'),
  item('ballpoint pen',           'ボールペン',    'noun'),
  item('bookstore',               'ほんや',        'noun'),
  item('town',                    'まち',          'noun'),
  item('post office',             'ゆうびんきょく','noun'),
  item('dormitory',               'りょう',        'noun'),
  item('restaurant',              'レストラン',    'noun'),
]

const CH4_VERB_RU: VocabBankItem[] = [
  item('to exist / to be (animate beings)', 'います', 'verb-ru'),
]

const CH4_DEMONSTRATIVES: VocabBankItem[] = [
  item('over there',                              'あそこ', 'demonstrative'),
  item('that (far from both speaker & listener)', 'あれ',   'demonstrative'),
  item('here',                                    'ここ',   'demonstrative'),
  item('this (near speaker)',                     'これ',   'demonstrative'),
  item('there (near listener)',                   'そこ',   'demonstrative'),
  item('that (near listener)',                    'それ',   'demonstrative'),
]

const CH4_I_ADJ: VocabBankItem[] = [
  item('blue',                          'あおい',    'i-adj'),
  item('red',                           'あかい',    'i-adj'),
  item('new',                           'あたらしい','i-adj'),
  item('good',                          'いい',      'i-adj',
    { notes: '⚠️ Irregular: Neg→よくない  Past→よかった  NEVER いくない / いかった' }),
  item('big',                           'おおきい',  'i-adj'),
  item('yellow',                        'きいろい',  'i-adj'),
  item('black',                         'くろい',    'i-adj'),
  item('white',                         'しろい',    'i-adj'),
  item('tall / high / expensive',       'たかい',    'i-adj'),
  item('small',                         'ちいさい',  'i-adj'),
  item('brown',                         'ちゃいろい','i-adj'),
  item('old (things, not people)',       'ふるい',    'i-adj'),
]

const CH4_NA_ADJ: VocabBankItem[] = [
  item('pretty / clean',   'きれい(な)', 'na-adj',
    { notes: '⚠️ Ends in い but is a な-adjective! Neg: きれいじゃないです' }),
  item('famous',           'ゆうめい(な)','na-adj'),
  item('splendid / fine',  'りっぱ(な)', 'na-adj'),
]

const CH4_PARTICLES: VocabBankItem[] = [
  item('subject marker (new info, question answers, existence)', 'が', 'particle',
    { notes: 'Question words always take が in the answer.' }),
  item('location of existence (at / in / on)',                  'に', 'particle'),
]

// ─── CH. 5 VOCAB (pp. 166–167) ───────────────────────────────────────────────
const CH5_LOCATION_NOUNS: VocabBankItem[] = [
  item('above / on top', 'うえ',   'noun'),
  item('behind',         'うしろ', 'noun'),
  item('under / below',  'した',   'noun'),
  item('outside',        'そと',   'noun'),
  item('near',           'ちかく', 'noun'),
  item('next to',        'となり', 'noun'),
  item('inside',         'なか',   'noun'),
  item('left',           'ひだり', 'noun'),
  item('in front',       'まえ',   'noun'),
  item('right',          'みぎ',   'noun'),
  item('beside',         'よこ',   'noun'),
]

const CH5_NOUNS: VocabBankItem[] = [
  item('chair',              'いす',             'noun'),
  item('dog',                'いぬ',             'noun'),
  item('picture',            'え',               'noun'),
  item('Japanese closet',    'おしいれ',         'noun'),
  item('school cafeteria',   'がくしょく',       'noun'),
  item('student union',      'がくせいかいかん', 'noun'),
  item('river',              'かわ',             'noun'),
  item('tree',               'き',               'noun'),
  item('classroom',          'きょうしつ',       'noun'),
  item('car',                'くるま',           'noun'),
  item('cell phone',         'けいたい(でんわ)', 'noun'),
  item('chalkboard',         'こくばん',         'noun'),
  item('computer',           'コンピュータ',     'noun'),
  item('bicycle',            'じてんしゃ',       'noun'),
  item('photograph',         'しゃしん',         'noun'),
  item('sofa',               'ソファ',           'noun'),
  item('gym',                'たいいくかん',     'noun'),
  item('chest of drawers',   'たんす',           'noun'),
  item('desk',               'つくえ',           'noun'),
  item('table',              'テーブル',         'noun'),
  item('telephone',          'でんわ',           'noun'),
  item('door',               'ドア',             'noun'),
  item('restroom',           'トイレ',           'noun'),
  item('clock / watch',      'とけい',           'noun'),
  item('place',              'ところ',           'noun'),
  item('cat',                'ねこ',             'noun'),
  item('bus',                'バス',             'noun'),
  item('video',              'ビデオ',           'noun'),
  item('person',             'ひと',             'noun'),
  item('futon',              'ふとん',           'noun'),
  item('bed',                'ベッド',           'noun'),
  item('room',               'へや',             'noun'),
  item('bookshelf',          'ほんだな',         'noun'),
  item('window',             'まど',             'noun'),
  item('thing (tangible)',   'もの',             'noun'),
  item('mountain',           'やま',             'noun'),
  item('room (loanword)',    'ルーム',           'noun'),
]

const CH5_VERB_U: VocabBankItem[] = [
  item('to take (time / cost)', 'かかります', 'verb-u'),
]

const CH5_DEMONSTRATIVES: VocabBankItem[] = [
  item('that ___ (far from both) [+ noun]',      'あの', 'demonstrative'),
  item('this ___ [+ noun]',                       'この', 'demonstrative'),
  item('that ___ (near listener) [+ noun]',       'その', 'demonstrative'),
  item('which ___? [+ noun]',                     'どの', 'demonstrative'),
]

// ─── CH. 6 VOCAB (pp. 210–212) ───────────────────────────────────────────────
const CH6_NOUNS: VocabBankItem[] = [
  item('part-time job',    'アルバイト', 'noun'),
  item('exercise',         'うんどう',   'noun'),
  item('music',            'おんがく',   'noun'),
  item('shopping',         'かいもの',   'noun'),
  item('game',             'ゲーム',     'noun'),
  item('concert',          'コンサート', 'noun'),
  item('next time',        'こんど',     'noun'),
  item('magazine',         'ざっし',     'noun'),
  item('walk',             'さんぽ',     'noun'),
  item('job',              'しごと',     'noun'),
  item('question',         'しつもん',   'noun'),
  item('jogging',          'ジョギング', 'noun'),
  item('newspaper',        'しんぶん',   'noun'),
  item('laundry',          'せんたく',   'noun'),
  item('cleaning',         'そうじ',     'noun'),
  item('letter',           'てがみ',     'noun'),
  item('tennis',           'テニス',     'noun'),
  item('friend',           'ともだち',   'noun'),
  item('party',            'パーティ',   'noun'),
  item('picnic',           'ピクニック', 'noun'),
  item('pool',             'プール',     'noun'),
  item('email',            'メール',     'noun'),
  item('day off / rest',   'やすみ',     'noun'),
  item('holiday / day off','やすみのひ', 'noun'),
  item('parents',          'りょうしん', 'noun'),
  item('cooking',          'りょうり',   'noun'),
]

const CH6_VERBS_U: VocabBankItem[] = [
  item('to meet',         'あいます',   'verb-u'),
  item('to play',         'あそびます', 'verb-u'),
  item('to walk',         'あるきます', 'verb-u'),
  item('to say',          'いいます',   'verb-u'),
  item('to swim',         'およぎます', 'verb-u'),
  item('to write',        'かきます',   'verb-u'),
  item('to ask / listen', 'ききます',   'verb-u'),
  item('to talk',         'はなします', 'verb-u'),
  item('to wait',         'まちます',   'verb-u'),
  item('to call / invite','よびます',   'verb-u'),
]

const CH6_VERBS_RU: VocabBankItem[] = [
  item('to make (a phone call)', 'かけます',   'verb-ru'),
  item('to go out',              'でかけます', 'verb-ru'),
]

const CH6_I_ADJ: VocabBankItem[] = [
  item('busy',        'いそがしい', 'i-adj'),
  item('happy',       'うれしい',   'i-adj'),
  item('interesting', 'おもしろい', 'i-adj'),
  item('sad',         'かなしい',   'i-adj'),
  item('lonely',      'さびしい',   'i-adj'),
  item('fun',         'たのしい',   'i-adj'),
]

const CH6_NA_ADJ: VocabBankItem[] = [
  item('free / not busy',    'ひま(な)',    'na-adj'),
  item('lively',             'にぎやか(な)','na-adj'),
  item('healthy / energetic','げんき(な)',  'na-adj'),
  item('quiet',              'しずか(な)',  'na-adj'),
]

const CH6_PARTICLES: VocabBankItem[] = [
  item('with (person) / and (listing nouns)', 'と', 'particle'),
]

// ─── Full export ──────────────────────────────────────────────────────────────
export const DEFAULT_VOCAB_BANK: VocabBankItem[] = [
  ...CH1_EXPRESSIONS, ...CH1_ADDRESS,
  ...CH2_NOUNS, ...CH2_PRONOUNS, ...CH2_COPULA, ...CH2_TIME,
  ...CH2_QUESTION_WORDS, ...CH2_PARTICLES, ...CH2_SUFFIXES,
  ...CH3_NOUNS, ...CH3_VERBS_U, ...CH3_VERBS_RU, ...CH3_VERBS_IRR,
  ...CH3_QUESTION, ...CH3_NUMBERS, ...CH3_COUNTER, ...CH3_ADVERBS,
  ...CH3_PARTICLES, ...CH3_AFFIXES,
  ...CH4_NOUNS, ...CH4_VERB_RU, ...CH4_DEMONSTRATIVES,
  ...CH4_I_ADJ, ...CH4_NA_ADJ, ...CH4_PARTICLES,
  ...CH5_LOCATION_NOUNS, ...CH5_NOUNS, ...CH5_VERB_U, ...CH5_DEMONSTRATIVES,
  ...CH6_NOUNS, ...CH6_VERBS_U, ...CH6_VERBS_RU,
  ...CH6_I_ADJ, ...CH6_NA_ADJ, ...CH6_PARTICLES,
]

export const CATEGORY_LABELS: Record<string, string> = {
  'noun':           '名詞 Noun',
  'verbal-noun':    'する-Verb Noun',
  'pronoun':        '代名詞 Pronoun',
  'demonstrative':  '指示詞 Demonstrative',
  'verb-u':         '動詞 u-Verb',
  'verb-ru':        '動詞 ru-Verb',
  'verb-irregular': '動詞 Irregular',
  'i-adj':          'い形容詞 i-Adj',
  'na-adj':         'な形容詞 na-Adj',
  'adverb':         '副詞 Adverb',
  'particle':       '助詞 Particle',
  'conjunction':    '接続詞 Conjunction',
  'interjection':   '感動詞 Interjection',
  'question-word':  '疑問詞 Question Word',
  'counter':        '助数詞 Counter',
  'grammar':        '文法 Grammar Pattern',
  'expression':     '表現 Expression / Phrase',
  'other':          'その他 Other',
}
