/**
 * Nakama 1 Structured Study Content — Chapters 1-4 (JAPN 1110 Spring)
 *
 * Extracted linguistic reference data: vocabulary lists, grammar pattern names,
 * and kanji with readings. This file contains factual language-learning data
 * (words, readings, meanings, grammatical structures) for use in the study app.
 *
 * Source: Nakama 1: Introductory Japanese (Hatasa, Hatasa, Makino), 3rd ed.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VocabEntry {
  /** Japanese word in kana or mixed script */
  word: string;
  /** Reading in hiragana (if word uses kanji/katakana) */
  reading?: string;
  /** Kanji representation (if applicable) */
  kanji?: string;
  /** English meaning */
  meaning: string;
  /** Part of speech or category */
  category: 'noun' | 'u-verb' | 'ru-verb' | 'irregular-verb' | 'i-adj' | 'na-adj'
    | 'adverb' | 'particle' | 'expression' | 'suffix' | 'prefix' | 'counter'
    | 'question-word' | 'number' | 'demonstrative';
}

export interface GrammarPattern {
  /** Pattern name/formula */
  pattern: string;
  /** Brief description */
  description: string;
  /** Example sentence in Japanese */
  example?: string;
  /** English translation of example */
  exampleEn?: string;
}

export interface KanjiEntry {
  /** The kanji character */
  kanji: string;
  /** On'yomi readings */
  onyomi: string[];
  /** Kun'yomi readings */
  kunyomi: string[];
  /** English meaning */
  meaning: string;
  /** Stroke count (if known) */
  strokes?: number;
}

export interface ChapterContent {
  /** Chapter number (0 = preliminary) */
  chapter: number;
  /** Chapter title in English */
  titleEn: string;
  /** Chapter title in Japanese */
  titleJp: string;
  /** Vocabulary list */
  vocabulary: VocabEntry[];
  /** Grammar patterns */
  grammar: GrammarPattern[];
  /** Kanji introduced */
  kanji: KanjiEntry[];
}

// ─── Chapter 1: The Japanese Sound System & Hiragana ─────────────────────────

const chapter1: ChapterContent = {
  chapter: 1,
  titleEn: 'The Japanese Sound System and Hiragana',
  titleJp: 'にほんごのおとと ひらがな',
  vocabulary: [
    // Nouns
    { word: 'せんせい', meaning: 'teacher, professor', category: 'noun' },

    // Suffixes
    { word: '〜さん', meaning: 'Mr./Mrs./Miss/Ms.', category: 'suffix' },
    { word: '〜せんせい', meaning: 'Professor ~', category: 'suffix' },

    // Expressions / Classroom Phrases
    { word: 'おはようございます', meaning: 'Good morning (polite)', category: 'expression' },
    { word: 'おはよう', meaning: 'Good morning (casual)', category: 'expression' },
    { word: 'こんにちは', meaning: 'Good afternoon / Hello', category: 'expression' },
    { word: 'こんばんは', meaning: 'Good evening / Hello', category: 'expression' },
    { word: 'さようなら', meaning: 'Goodbye', category: 'expression' },
    { word: 'じゃあ、また', meaning: 'See you later', category: 'expression' },
    { word: 'ありがとうございます', meaning: 'Thank you (polite)', category: 'expression' },
    { word: 'ありがとう', meaning: 'Thanks (casual)', category: 'expression' },
    { word: 'どういたしまして', meaning: 'You are welcome', category: 'expression' },
    { word: 'すみません', meaning: 'Excuse me / I am sorry', category: 'expression' },
    { word: 'しつれいします', meaning: 'Goodbye / Excuse me (formal)', category: 'expression' },
    { word: 'はい、わかりました', meaning: 'Yes, I understand', category: 'expression' },
    { word: 'いいえ、わかりません', meaning: 'No, I don\'t understand', category: 'expression' },
    { word: 'はじめまして', meaning: 'How do you do? (first meeting)', category: 'expression' },
    { word: 'どうぞよろしく', meaning: 'Pleased to meet you', category: 'expression' },
    { word: 'これは にほんごで なんと いいますか', meaning: 'How do you say this in Japanese?', category: 'expression' },
    { word: 'それは にほんごで なんと いいますか', meaning: 'How do you say that in Japanese?', category: 'expression' },
    { word: '〜って なんですか', meaning: 'What does ~ mean?', category: 'expression' },
    { word: '〜と いいます', meaning: 'You say ~ / You call it ~', category: 'expression' },
    { word: 'いって ください', meaning: 'Please say it / Repeat after me', category: 'expression' },
    { word: 'かいて ください', meaning: 'Please write', category: 'expression' },
    { word: 'きいて ください', meaning: 'Please listen', category: 'expression' },
    { word: 'みて ください', meaning: 'Please look at it', category: 'expression' },
    { word: 'よんで ください', meaning: 'Please read', category: 'expression' },
    { word: 'もう いちど いってください', meaning: 'Please say it again', category: 'expression' },
    { word: 'もう いちど おねがいします', meaning: 'Please say it again (student request)', category: 'expression' },
    { word: 'もう すこし ゆっくり おねがいします', meaning: 'Please speak more slowly', category: 'expression' },
    { word: 'おおきい こえで いってください', meaning: 'Please speak loudly', category: 'expression' },
    { word: 'わかりましたか', meaning: 'Do you understand?', category: 'expression' },
  ],
  grammar: [
    {
      pattern: 'Three Writing Systems',
      description: 'Japanese uses three writing systems: hiragana (native words, grammar), katakana (foreign words), and kanji (Chinese characters for content words)',
    },
    {
      pattern: 'Hiragana Chart (46 base characters)',
      description: 'あ-row vowels (a/i/u/e/o), か-row through わ-row consonant+vowel syllables, plus ん (n)',
    },
    {
      pattern: 'Dakuten (゛) Voiced Consonants',
      description: 'Adding ゛ voices consonants: か→が, さ→ざ, た→だ, は→ば',
    },
    {
      pattern: 'Handakuten (゜) Semi-voiced',
      description: 'Adding ゜ to は-row creates p-sounds: は→ぱ, ひ→ぴ, etc.',
    },
    {
      pattern: 'Glides (きゃ/きゅ/きょ etc.)',
      description: 'Small や/ゆ/よ after i-column characters create combination sounds',
    },
    {
      pattern: 'Long Vowels',
      description: 'Double the vowel sound to hold it longer: おかあさん (o-kaa-san)',
    },
    {
      pattern: 'Double Consonant (っ)',
      description: 'Small っ creates a pause before the next consonant: きって (ki-t-te = stamp)',
    },
    {
      pattern: 'Irregular Sounds',
      description: 'し=shi (not si), ち=chi (not ti), つ=tsu (not tu), ふ=fu (not hu)',
    },
  ],
  kanji: [],
};

// ─── Chapter 2: Greetings and Introductions ──────────────────────────────────

const chapter2: ChapterContent = {
  chapter: 2,
  titleEn: 'Greetings and Introductions',
  titleJp: 'あいさつと じこしょうかい',
  vocabulary: [
    // School-related nouns
    { word: 'がくせい', kanji: '学生', meaning: 'student', category: 'noun' },
    { word: 'だいがく', kanji: '大学', meaning: 'college, university', category: 'noun' },
    { word: 'だいがくいんせい', kanji: '大学院生', meaning: 'graduate student', category: 'noun' },
    { word: 'いちねんせい', kanji: '一年生', meaning: 'freshman (1st year)', category: 'noun' },
    { word: 'にねんせい', kanji: '二年生', meaning: 'sophomore (2nd year)', category: 'noun' },
    { word: 'さんねんせい', kanji: '三年生', meaning: 'junior (3rd year)', category: 'noun' },
    { word: 'よねんせい', kanji: '四年生', meaning: 'senior (4th year)', category: 'noun' },
    { word: 'せんこう', kanji: '専攻', meaning: 'major (field of study)', category: 'noun' },
    { word: 'せんせい', kanji: '先生', meaning: 'teacher, professor', category: 'noun' },

    // Languages
    { word: 'えいご', kanji: '英語', meaning: 'English language', category: 'noun' },
    { word: 'にほんご', kanji: '日本語', meaning: 'Japanese language', category: 'noun' },
    { word: 'ちゅうごくご', kanji: '中国語', meaning: 'Chinese language', category: 'noun' },
    { word: 'かんこくご', kanji: '韓国語', meaning: 'Korean language', category: 'noun' },
    { word: 'スペインご', meaning: 'Spanish language', category: 'noun' },
    { word: 'フランスご', meaning: 'French language', category: 'noun' },

    // Academic subjects
    { word: 'こうがく', kanji: '工学', meaning: 'engineering', category: 'noun' },
    { word: 'ぶんがく', kanji: '文学', meaning: 'literature', category: 'noun' },
    { word: 'れきし', kanji: '歴史', meaning: 'history', category: 'noun' },
    { word: 'ビジネス', meaning: 'business', category: 'noun' },
    { word: 'アジアけんきゅう', meaning: 'Asian studies', category: 'noun' },

    // Time-related
    { word: 'ごぜん', kanji: '午前', meaning: 'a.m., morning', category: 'noun' },
    { word: 'ごご', kanji: '午後', meaning: 'p.m., afternoon', category: 'noun' },
    { word: 'いま', kanji: '今', meaning: 'now', category: 'noun' },
    { word: 'なまえ', kanji: '名前', meaning: 'name', category: 'noun' },

    // Pronouns
    { word: 'わたし', meaning: 'I (neutral)', category: 'noun' },
    { word: 'ぼく', meaning: 'I (male, casual)', category: 'noun' },

    // Countries
    { word: 'にほん', kanji: '日本', meaning: 'Japan', category: 'noun' },
    { word: 'アメリカ', meaning: 'USA', category: 'noun' },
    { word: 'かんこく', kanji: '韓国', meaning: 'South Korea', category: 'noun' },
    { word: 'ちゅうごく', kanji: '中国', meaning: 'China', category: 'noun' },
    { word: 'イギリス', meaning: 'England, UK', category: 'noun' },
    { word: 'カナダ', meaning: 'Canada', category: 'noun' },
    { word: 'フランス', meaning: 'France', category: 'noun' },
    { word: 'スペイン', meaning: 'Spain', category: 'noun' },
    { word: 'オーストラリア', meaning: 'Australia', category: 'noun' },
    { word: 'メキシコ', meaning: 'Mexico', category: 'noun' },

    // Suffix
    { word: '〜じん', kanji: '〜人', meaning: 'person from ~ (nationality)', category: 'suffix' },
    { word: '〜ねんせい', kanji: '〜年生', meaning: '~ year student', category: 'suffix' },
    { word: '〜ご', kanji: '〜語', meaning: '~ language', category: 'suffix' },
    { word: '〜じ', kanji: '〜時', meaning: '~ o\'clock', category: 'suffix' },

    // Introduction phrases
    { word: 'こちらこそ', meaning: 'Same here, likewise', category: 'expression' },
    { word: 'そうですか', meaning: 'I see, is that so?', category: 'expression' },
    { word: 'あのう', meaning: 'Um... (polite hesitation)', category: 'expression' },
    { word: 'ええ', meaning: 'Yes (softer than はい)', category: 'expression' },
    { word: 'そうです', meaning: 'That\'s right', category: 'expression' },
    { word: 'ちがいます', meaning: 'That\'s not right, it\'s different', category: 'expression' },
    { word: 'どこからきましたか', meaning: 'Where are you from?', category: 'expression' },

    // Question words
    { word: 'なに/なん', meaning: 'what', category: 'question-word' },
    { word: 'どこ', meaning: 'where', category: 'question-word' },
    { word: 'だれ/どなた', meaning: 'who / who (polite)', category: 'question-word' },
    { word: 'なんじ', kanji: '何時', meaning: 'what time', category: 'question-word' },
  ],
  grammar: [
    {
      pattern: 'X は Y です',
      description: 'Topic marker は + copula です: "X is Y"',
      example: 'わたしは がくせいです。',
      exampleEn: 'I am a student.',
    },
    {
      pattern: 'X は Y じゃありません / じゃないです',
      description: 'Negative copula: "X is not Y"',
      example: 'たなかさんは さんねんせいじゃありません。',
      exampleEn: 'Mr. Tanaka is not a junior.',
    },
    {
      pattern: 'X は Y ですか',
      description: 'Yes/No question: add か to make a question',
      example: 'スミスさんは がくせいですか。',
      exampleEn: 'Is Mr. Smith a student?',
    },
    {
      pattern: 'A の B',
      description: 'Noun connector の: possession, affiliation, description (A\'s B / B of A)',
      example: 'わたしの せんこうは れきしです。',
      exampleEn: 'My major is history.',
    },
    {
      pattern: 'Question words (なに/どこ/だれ/なんじ)',
      description: 'Replace the unknown with a question word; word order stays the same',
      example: 'せんこうは なんですか。',
      exampleEn: 'What is your major?',
    },
    {
      pattern: 'X も (also/too)',
      description: 'も replaces は to mean "also/too"',
      example: 'リーさんも さんねんせいです。',
      exampleEn: 'Mr. Li is also a junior.',
    },
    {
      pattern: 'Telling time: Number + じ',
      description: 'Number + じ = o\'clock. はん = half-past. Irregular: 4時=よじ, 7時=しちじ, 9時=くじ',
      example: 'ごぜん よじはんです。',
      exampleEn: 'It is 4:30 a.m.',
    },
  ],
  kanji: [],
};

// ─── Chapter 3: Daily Routines ───────────────────────────────────────────────

const chapter3: ChapterContent = {
  chapter: 3,
  titleEn: 'Daily Routines',
  titleJp: 'まいにちの せいかつ',
  vocabulary: [
    // Time-related nouns
    { word: 'あさ', kanji: '朝', meaning: 'morning', category: 'noun' },
    { word: 'ひる', kanji: '昼', meaning: 'afternoon', category: 'noun' },
    { word: 'ばん', kanji: '晩', meaning: 'night, evening', category: 'noun' },
    { word: 'きょう', kanji: '今日', meaning: 'today', category: 'noun' },
    { word: 'きのう', kanji: '昨日', meaning: 'yesterday', category: 'noun' },
    { word: 'あした', kanji: '明日', meaning: 'tomorrow', category: 'noun' },
    { word: 'おととい', kanji: '一昨日', meaning: 'the day before yesterday', category: 'noun' },
    { word: 'あさって', kanji: '明後日', meaning: 'the day after tomorrow', category: 'noun' },
    { word: 'こんしゅう', kanji: '今週', meaning: 'this week', category: 'noun' },
    { word: 'せんしゅう', kanji: '先週', meaning: 'last week', category: 'noun' },
    { word: 'こんばん', kanji: '今晩', meaning: 'tonight', category: 'noun' },
    { word: 'しゅうまつ', kanji: '週末', meaning: 'weekend', category: 'noun' },

    // Daily routine nouns
    { word: 'あさごはん', kanji: '朝御飯', meaning: 'breakfast', category: 'noun' },
    { word: 'ひるごはん', kanji: '昼御飯', meaning: 'lunch', category: 'noun' },
    { word: 'ばんごはん', kanji: '晩御飯', meaning: 'dinner, supper', category: 'noun' },
    { word: 'ごはん', kanji: '御飯', meaning: 'meal, cooked rice', category: 'noun' },

    // Places & things
    { word: 'うち', kanji: '家', meaning: 'home, house', category: 'noun' },
    { word: 'がっこう', kanji: '学校', meaning: 'school', category: 'noun' },
    { word: 'としょかん', kanji: '図書館', meaning: 'library', category: 'noun' },
    { word: 'えいが', kanji: '映画', meaning: 'movie', category: 'noun' },
    { word: 'おふろ', kanji: 'お風呂', meaning: 'bath', category: 'noun' },
    { word: 'シャワー', meaning: 'shower', category: 'noun' },
    { word: 'コーヒー', meaning: 'coffee', category: 'noun' },
    { word: 'テレビ', meaning: 'television, TV', category: 'noun' },
    { word: 'ほん', kanji: '本', meaning: 'book', category: 'noun' },
    { word: 'クラス', meaning: 'class', category: 'noun' },
    { word: 'じゅぎょう', kanji: '授業', meaning: 'class, course', category: 'noun' },
    { word: 'しゅくだい', kanji: '宿題', meaning: 'homework', category: 'noun' },
    { word: 'べんきょう', kanji: '勉強', meaning: 'study', category: 'noun' },
    { word: 'せいかつ', kanji: '生活', meaning: 'life, living', category: 'noun' },
    { word: 'でんわばんごう', kanji: '電話番号', meaning: 'telephone number', category: 'noun' },
    { word: 'つぎ', kanji: '次', meaning: 'next', category: 'noun' },

    // Days of the week
    { word: 'にちようび', kanji: '日曜日', meaning: 'Sunday', category: 'noun' },
    { word: 'げつようび', kanji: '月曜日', meaning: 'Monday', category: 'noun' },
    { word: 'かようび', kanji: '火曜日', meaning: 'Tuesday', category: 'noun' },
    { word: 'すいようび', kanji: '水曜日', meaning: 'Wednesday', category: 'noun' },
    { word: 'もくようび', kanji: '木曜日', meaning: 'Thursday', category: 'noun' },
    { word: 'きんようび', kanji: '金曜日', meaning: 'Friday', category: 'noun' },
    { word: 'どようび', kanji: '土曜日', meaning: 'Saturday', category: 'noun' },

    // う-verbs
    { word: 'いきます', kanji: '行きます', meaning: 'to go', category: 'u-verb' },
    { word: 'かえります', kanji: '帰ります', meaning: 'to return, to go home', category: 'u-verb' },
    { word: 'のみます', kanji: '飲みます', meaning: 'to drink', category: 'u-verb' },
    { word: 'はいります', kanji: '入ります', meaning: 'to take (a bath), to enter', category: 'u-verb' },
    { word: 'よみます', kanji: '読みます', meaning: 'to read', category: 'u-verb' },
    { word: 'あります', meaning: 'to exist (inanimate), to have', category: 'u-verb' },

    // る-verbs
    { word: 'あびます', kanji: '浴びます', meaning: 'to take (a shower)', category: 'ru-verb' },
    { word: 'おきます', kanji: '起きます', meaning: 'to get up, to wake up', category: 'ru-verb' },
    { word: 'たべます', kanji: '食べます', meaning: 'to eat', category: 'ru-verb' },
    { word: 'ねます', kanji: '寝ます', meaning: 'to go to bed, to sleep', category: 'ru-verb' },
    { word: 'みます', kanji: '見ます', meaning: 'to see, to watch', category: 'ru-verb' },

    // Irregular verbs
    { word: 'きます', kanji: '来ます', meaning: 'to come', category: 'irregular-verb' },
    { word: 'します', meaning: 'to do', category: 'irregular-verb' },
    { word: 'べんきょうします', kanji: '勉強します', meaning: 'to study', category: 'irregular-verb' },

    // Question word
    { word: 'いつ', meaning: 'when', category: 'question-word' },

    // Numbers 0-10
    { word: 'ゼロ/れい', kanji: '零', meaning: 'zero', category: 'number' },
    { word: 'いち', kanji: '一', meaning: 'one', category: 'number' },
    { word: 'に', kanji: '二', meaning: 'two', category: 'number' },
    { word: 'さん', kanji: '三', meaning: 'three', category: 'number' },
    { word: 'よん/し', kanji: '四', meaning: 'four', category: 'number' },
    { word: 'ご', kanji: '五', meaning: 'five', category: 'number' },
    { word: 'ろく', kanji: '六', meaning: 'six', category: 'number' },
    { word: 'なな/しち', kanji: '七', meaning: 'seven', category: 'number' },
    { word: 'はち', kanji: '八', meaning: 'eight', category: 'number' },
    { word: 'きゅう/く', kanji: '九', meaning: 'nine', category: 'number' },
    { word: 'じゅう', kanji: '十', meaning: 'ten', category: 'number' },

    // Counter
    { word: '〜ふん', kanji: '〜分', meaning: '~ minute(s)', category: 'counter' },

    // Adverbs
    { word: 'いつも', meaning: 'always', category: 'adverb' },
    { word: 'たいてい', meaning: 'usually', category: 'adverb' },
    { word: 'よく', meaning: 'often, well', category: 'adverb' },
    { word: 'ときどき', kanji: '時々', meaning: 'sometimes', category: 'adverb' },
    { word: 'あまり', meaning: 'not very often (+ negative verb)', category: 'adverb' },
    { word: 'ぜんぜん', kanji: '全然', meaning: 'not at all (+ negative verb)', category: 'adverb' },

    // Particles
    { word: 'で', meaning: 'at, in (location of action)', category: 'particle' },
    { word: 'に', meaning: 'at, on, in (point in time); to (goal)', category: 'particle' },
    { word: 'へ', meaning: 'to, toward (direction)', category: 'particle' },
    { word: 'を', meaning: 'direct object marker', category: 'particle' },

    // Prefixes
    { word: 'こん〜', kanji: '今〜', meaning: 'this ~ (current)', category: 'prefix' },
    { word: 'まい〜', kanji: '毎〜', meaning: 'every ~', category: 'prefix' },

    // Suffixes
    { word: '〜ごろ', kanji: '〜頃', meaning: 'about ~ (time)', category: 'suffix' },
    { word: '〜ようび', kanji: '〜曜日', meaning: 'day of the week', category: 'suffix' },

    // Expressions
    { word: 'まいにち', kanji: '毎日', meaning: 'every day', category: 'noun' },
    { word: 'まいあさ', kanji: '毎朝', meaning: 'every morning', category: 'noun' },
    { word: 'まいばん', kanji: '毎晩', meaning: 'every evening/night', category: 'noun' },
    { word: 'まいしゅう', kanji: '毎週', meaning: 'every week', category: 'noun' },
  ],
  grammar: [
    {
      pattern: 'Polite present form (~ます / ~ません)',
      description: 'Verb stem + ます (affirmative) or ません (negative) for polite speech',
      example: 'がっこうに いきます。',
      exampleEn: 'I go to school.',
    },
    {
      pattern: 'Polite past form (~ました / ~ませんでした)',
      description: 'Verb stem + ました (past affirmative) or ませんでした (past negative)',
      example: 'きのう えいがを みました。',
      exampleEn: 'I watched a movie yesterday.',
    },
    {
      pattern: 'Three verb classes (う-verb, る-verb, irregular)',
      description: 'う-verbs end in う-row sounds; る-verbs end in -iru/-eru; only 2 irregular: する, くる',
    },
    {
      pattern: 'Direct object particle を',
      description: 'を marks the direct object of an action verb',
      example: 'ほんを よみます。',
      exampleEn: 'I read a book.',
    },
    {
      pattern: 'Destination/goal particle に / へ',
      description: 'に marks goal/destination; へ marks direction. Both used with movement verbs',
      example: 'がっこうに いきます。',
      exampleEn: 'I go to school.',
    },
    {
      pattern: 'Location of action particle で',
      description: 'で marks where an action takes place',
      example: 'としょかんで べんきょうします。',
      exampleEn: 'I study at the library.',
    },
    {
      pattern: 'Time particle に',
      description: 'に marks specific points in time (clock time, days)',
      example: 'じゅうじに ねます。',
      exampleEn: 'I go to bed at 10:00.',
    },
    {
      pattern: '~が あります (existence/possession)',
      description: 'Thing が あります = there is / I have (for inanimate things, events, classes)',
      example: 'きょう じゅぎょうが あります。',
      exampleEn: 'I have a class today.',
    },
    {
      pattern: 'Frequency adverbs + verb polarity',
      description: 'いつも/たいてい/よく/ときどき + positive verb; あまり/ぜんぜん + NEGATIVE verb only',
      example: 'あまり テレビを みません。',
      exampleEn: 'I don\'t watch TV very often.',
    },
    {
      pattern: 'に vs で distinction',
      description: '"Doing = で, Being = に." Action at a place uses で; existence/arrival uses に',
    },
    {
      pattern: 'SOV sentence order',
      description: 'Japanese follows Subject-Object-Verb order: [Who は] [When に] [Where で] [What を] [Verb]',
      example: 'わたしは まいにち としょかんで にほんごを べんきょうします。',
      exampleEn: 'I study Japanese at the library every day.',
    },
    {
      pattern: 'Minutes: ~ふん / ~ぷん',
      description: 'Sound change rule for minutes: 1,3,6,8,10 use ぷん; others use ふん',
    },
  ],
  kanji: [],
};

// ─── Chapter 4: Japanese Cities ──────────────────────────────────────────────

const chapter4: ChapterContent = {
  chapter: 4,
  titleEn: 'Japanese Cities',
  titleJp: 'にほんの まち',
  vocabulary: [
    // Places / Buildings
    { word: 'アパート', meaning: 'apartment', category: 'noun' },
    { word: 'えき', kanji: '駅', meaning: 'station', category: 'noun' },
    { word: 'カフェ', meaning: 'coffee shop, cafe', category: 'noun' },
    { word: 'きっさてん', kanji: '喫茶店', meaning: 'coffee shop (traditional)', category: 'noun' },
    { word: 'ぎんこう', kanji: '銀行', meaning: 'bank', category: 'noun' },
    { word: 'こうえん', kanji: '公園', meaning: 'park', category: 'noun' },
    { word: 'こうばん', kanji: '交番', meaning: 'police box', category: 'noun' },
    { word: 'コンビニ', meaning: 'convenience store', category: 'noun' },
    { word: 'スーパー', meaning: 'supermarket', category: 'noun' },
    { word: 'たてもの', kanji: '建物', meaning: 'building, structure', category: 'noun' },
    { word: 'デパート', meaning: 'department store', category: 'noun' },
    { word: 'ビル', meaning: 'building (multi-story)', category: 'noun' },
    { word: 'びょういん', kanji: '病院', meaning: 'hospital', category: 'noun' },
    { word: 'ほんや', kanji: '本屋', meaning: 'bookstore', category: 'noun' },
    { word: 'まち', kanji: '町', meaning: 'town', category: 'noun' },
    { word: 'ゆうびんきょく', kanji: '郵便局', meaning: 'post office', category: 'noun' },
    { word: 'りょう', kanji: '寮', meaning: 'dormitory', category: 'noun' },
    { word: 'レストラン', meaning: 'restaurant', category: 'noun' },
    { word: 'このへん', kanji: 'この辺', meaning: 'this area, around here', category: 'noun' },

    // School supplies
    { word: 'えんぴつ', kanji: '鉛筆', meaning: 'pencil', category: 'noun' },
    { word: 'かばん', kanji: '鞄', meaning: 'bag, luggage', category: 'noun' },
    { word: 'きょうかしょ', kanji: '教科書', meaning: 'textbook', category: 'noun' },
    { word: 'けしゴム', kanji: '消しゴム', meaning: 'eraser', category: 'noun' },
    { word: 'じしょ', kanji: '辞書', meaning: 'dictionary', category: 'noun' },
    { word: 'テスト', meaning: 'test', category: 'noun' },
    { word: 'ノート', meaning: 'notebook', category: 'noun' },
    { word: 'ペン', meaning: 'pen', category: 'noun' },
    { word: 'ボールペン', meaning: 'ballpoint pen', category: 'noun' },

    // る-verb
    { word: 'います', meaning: 'to exist, to be (animate beings)', category: 'ru-verb' },

    // Demonstrative words
    { word: 'これ', meaning: 'this (object near speaker)', category: 'demonstrative' },
    { word: 'それ', meaning: 'that (object near listener)', category: 'demonstrative' },
    { word: 'あれ', meaning: 'that over there (far from both)', category: 'demonstrative' },
    { word: 'どれ', meaning: 'which one', category: 'demonstrative' },
    { word: 'ここ', meaning: 'here, this place', category: 'demonstrative' },
    { word: 'そこ', meaning: 'there, that place', category: 'demonstrative' },
    { word: 'あそこ', meaning: 'over there, that place (far)', category: 'demonstrative' },

    // い-adjectives
    { word: 'あおい', kanji: '青い', meaning: 'blue', category: 'i-adj' },
    { word: 'あかい', kanji: '赤い', meaning: 'red', category: 'i-adj' },
    { word: 'あたらしい', kanji: '新しい', meaning: 'new', category: 'i-adj' },
    { word: 'いい', meaning: 'good', category: 'i-adj' },
    { word: 'おおきい', kanji: '大きい', meaning: 'big', category: 'i-adj' },
    { word: 'きいろい', kanji: '黄色い', meaning: 'yellow', category: 'i-adj' },
    { word: 'くろい', kanji: '黒い', meaning: 'black', category: 'i-adj' },
    { word: 'しろい', kanji: '白い', meaning: 'white', category: 'i-adj' },
    { word: 'たかい', kanji: '高い', meaning: 'tall, high, expensive', category: 'i-adj' },
    { word: 'ちいさい', kanji: '小さい', meaning: 'small', category: 'i-adj' },
    { word: 'ちゃいろい', kanji: '茶色い', meaning: 'brown', category: 'i-adj' },
    { word: 'ふるい', kanji: '古い', meaning: 'old (things, not people)', category: 'i-adj' },

    // な-adjectives
    { word: 'きれい(な)', meaning: 'clean, pretty, neat', category: 'na-adj' },
    { word: 'ゆうめい(な)', kanji: '有名(な)', meaning: 'famous', category: 'na-adj' },
    { word: 'りっぱ(な)', kanji: '立派(な)', meaning: 'fine, splendid, nice', category: 'na-adj' },

    // Question words
    { word: 'だれ', meaning: 'who', category: 'question-word' },
    { word: 'どれ', meaning: 'which one', category: 'question-word' },
    { word: 'どんな', meaning: 'what kind of', category: 'question-word' },

    // Adverbs
    { word: 'どうも', meaning: 'very (used in set phrases)', category: 'adverb' },
    { word: 'とても', meaning: 'very (+ affirmative form)', category: 'adverb' },

    // Suffix
    { word: '〜や', kanji: '〜屋', meaning: '~ store (e.g., ほんや = bookstore)', category: 'suffix' },

    // Expressions
    { word: 'どうも ありがとう', meaning: 'Thank you very much', category: 'expression' },
    { word: 'どうも すみません', meaning: 'I\'m very sorry', category: 'expression' },
  ],
  grammar: [
    {
      pattern: 'これ / それ / あれ / どれ (Demonstrative pronouns)',
      description: 'これ=this (near me), それ=that (near you), あれ=that (far from both), どれ=which one',
      example: 'これは なんですか。',
      exampleEn: 'What is this?',
    },
    {
      pattern: 'ここ / そこ / あそこ (Demonstrative locations)',
      description: 'ここ=here, そこ=there (near you), あそこ=over there (far from both)',
    },
    {
      pattern: '~は ~に あります / います',
      description: 'X は [place] に あります (inanimate) / います (animate): "X is at [place]"',
      example: 'ぎんこうは えきの ちかくに あります。',
      exampleEn: 'The bank is near the station.',
    },
    {
      pattern: '[place] に ~が あります / います',
      description: 'Describe what exists at a location: "At [place], there is ~"',
      example: 'このへんに コンビニが ありますか。',
      exampleEn: 'Is there a convenience store around here?',
    },
    {
      pattern: 'あります vs います',
      description: 'あります for inanimate things (objects, events); います for animate beings (people, animals)',
    },
    {
      pattern: 'い-adjective + noun & polite forms',
      description: 'い-adj directly modifies noun: おおきい たてもの. Present: おおきいです. Negative: おおきくないです',
      example: 'あたらしい たてものです。',
      exampleEn: 'It is a new building.',
    },
    {
      pattern: 'な-adjective + noun & polite forms',
      description: 'な-adj + な + noun: きれいな まち. Present: きれいです. Negative: きれいじゃないです',
      example: 'きれいな まちですね。',
      exampleEn: 'It\'s a pretty town, isn\'t it?',
    },
    {
      pattern: 'Sentence-final particles ね and よ',
      description: 'ね = seeking agreement ("right?", "isn\'t it?"); よ = asserting new info ("you know", "I tell you")',
      example: 'いい てんきですね。',
      exampleEn: 'Nice weather, isn\'t it?',
    },
  ],
  kanji: [
    {
      kanji: '大',
      onyomi: ['ダイ', 'タイ'],
      kunyomi: ['おお(きい)'],
      meaning: 'big, large',
      strokes: 3,
    },
    {
      kanji: '学',
      onyomi: ['ガク'],
      kunyomi: ['まな(ぶ)'],
      meaning: 'study, learning',
      strokes: 8,
    },
    {
      kanji: '校',
      onyomi: ['コウ'],
      kunyomi: [],
      meaning: 'school',
      strokes: 10,
    },
    {
      kanji: '先',
      onyomi: ['セン'],
      kunyomi: ['さき'],
      meaning: 'previous, ahead',
      strokes: 6,
    },
    {
      kanji: '生',
      onyomi: ['セイ', 'ショウ'],
      kunyomi: ['い(きる)', 'う(まれる)', 'なま'],
      meaning: 'life, birth, student',
      strokes: 5,
    },
  ],
};

// ─── Export All Chapters ─────────────────────────────────────────────────────

export const NAKAMA1_CHAPTERS: ChapterContent[] = [
  chapter1,
  chapter2,
  chapter3,
  chapter4,
];

// ─── Convenience Accessors ───────────────────────────────────────────────────

/** Get all vocabulary across all chapters */
export function getAllVocabulary(): VocabEntry[] {
  return NAKAMA1_CHAPTERS.flatMap(ch => ch.vocabulary);
}

/** Get vocabulary for a specific chapter */
export function getChapterVocabulary(chapter: number): VocabEntry[] {
  return NAKAMA1_CHAPTERS.find(ch => ch.chapter === chapter)?.vocabulary ?? [];
}

/** Get all grammar patterns across all chapters */
export function getAllGrammar(): GrammarPattern[] {
  return NAKAMA1_CHAPTERS.flatMap(ch => ch.grammar);
}

/** Get all kanji across all chapters */
export function getAllKanji(): KanjiEntry[] {
  return NAKAMA1_CHAPTERS.flatMap(ch => ch.kanji);
}

/** Get vocabulary filtered by category */
export function getVocabularyByCategory(category: VocabEntry['category']): VocabEntry[] {
  return getAllVocabulary().filter(v => v.category === category);
}

/** Total counts for display */
export const NAKAMA1_STATS = {
  totalChapters: NAKAMA1_CHAPTERS.length,
  totalVocabulary: NAKAMA1_CHAPTERS.reduce((sum, ch) => sum + ch.vocabulary.length, 0),
  totalGrammar: NAKAMA1_CHAPTERS.reduce((sum, ch) => sum + ch.grammar.length, 0),
  totalKanji: NAKAMA1_CHAPTERS.reduce((sum, ch) => sum + ch.kanji.length, 0),
} as const;
