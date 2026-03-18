/**
 * jpConversationBank — Nakama 1 Conversational Patterns, Ch. 1–6 (JAPN 1110)
 *
 * Flashcard direction: word    = English description (FRONT / shown to user)
 *                      meaning = Japanese pattern in hiragana/katakana (BACK / recalled)
 *
 * Each card captures one key pattern or exchange from the chapter's conversation section.
 * Source: Nakama 1: Introductory Japanese (Hatasa, Hatasa, Makino), 3rd ed.
 */
import type { VocabBankItem, VocabCategory } from '../components/jpquiz/types'

let _seq = 0
function id(): string { return `vb_conv_${(++_seq).toString(36)}` }
function conv(
  word: string, meaning: string, category: VocabCategory = 'expression',
  extras: Partial<Omit<VocabBankItem, 'id' | 'word' | 'meaning' | 'category'>> = {}
): VocabBankItem {
  return { id: id(), word, meaning, category, source: 'nakama1', ...extras }
}
// conv(ENGLISH_FRONT, JAPANESE_BACK, category)

// ─── CH. 1: Self-Introduction & Classroom ────────────────────────────────────
const CH1_PATTERNS: VocabBankItem[] = [
  conv(
    'Self-intro: "How do you do. I am ~. Pleased to meet you."',
    'はじめまして。～です。どうぞよろしく。',
  ),
  conv(
    'Response to intro: "Likewise. Pleased to meet you."',
    'こちらこそ。どうぞよろしく。',
  ),
  conv(
    'Greeting: Good morning (formal — to teacher/superior)',
    'おはようございます。',
  ),
  conv(
    'Greeting: Good morning (casual — to friends only)',
    'おはよう。',
    'expression',
    { notes: '⚠️ こんにちは / こんばんは are NOT used between family members' },
  ),
  conv(
    'Greeting: Good afternoon / Hello',
    'こんにちは。',
  ),
  conv(
    'Greeting: Good evening',
    'こんばんは。',
  ),
  conv(
    'Goodbye to teacher/superior: "Excuse me (I am leaving)."',
    'せんせい、しつれいします。',
  ),
  conv(
    'Goodbye to friends: "See you later."',
    'じゃあ、また。',
  ),
  conv(
    'Goodbye for long absence',
    'さようなら。',
  ),
  conv(
    'Thanking (formal): "Thank you." / "You\'re welcome."',
    'ありがとうございます。／ どういたしまして。',
  ),
  conv(
    'Thanking (casual): "Thanks." / "You\'re welcome."',
    'ありがとう。／ どういたしまして。',
  ),
  conv(
    'Getting attention politely: "Um, excuse me."',
    'あのう、すみません。',
  ),
  conv(
    "Apologizing: \"I'm sorry.\" / \"No, it's okay.\"",
    'すみません。／ いいえ、だいじょうぶです。',
  ),
  conv(
    'Confirming information: "It\'s ~, right?" / "That\'s right."',
    '～ですね？ ／ そうです。',
  ),
  conv(
    "Student: \"I don't understand. Please speak slowly.\"",
    'わかりません。ゆっくりいってください。',
  ),
  conv(
    'Asking the Japanese word: "What is this in Japanese?" / "It is called ~."',
    'これは にほんごで なんといいますか。 ／ ～といいます。',
  ),
]

// ─── CH. 2: Identity & Introductions ─────────────────────────────────────────
const CH2_PATTERNS: VocabBankItem[] = [
  conv(
    '"Are you Suzuki?" / "Yes, that\'s right." (X は Y です pattern)',
    'すずきさんですか。 ／ はい、そうです。',
  ),
  conv(
    '"Are you Yamada?" / "No, I\'m not. I\'m Tanaka." (negative copula)',
    'やまださんですか。 ／ いいえ、そうじゃありません。たなかです。',
  ),
  conv(
    '"What year are you?" / "I\'m a freshman."',
    'なんねんせいですか。 ／ いちねんせいです。',
  ),
  conv(
    '"What is your major?" / "It\'s history." (question word なに)',
    'せんこうは なんですか。 ／ れきしです。',
  ),
  conv(
    '"What university do you go to?" / "It\'s ~ University." (question word どこ)',
    'だいがくは どこですか。 ／ ～だいがくです。',
  ),
  conv(
    '"Where are you from?" / "I came from America."',
    'どこから きましたか。 ／ アメリカから きました。',
  ),
  conv(
    '"What time is it now?" / "It\'s 2 p.m." (telling time)',
    'いま なんじですか。 ／ ごご にじです。',
  ),
  conv(
    '"What is ~\'s major?" / "It\'s engineering." (の possession/affiliation)',
    '～さんの せんこうは なんですか。 ／ こうがくです。',
  ),
  conv(
    '"I\'m a junior. What about you?" / "I\'m also a junior." (も similarity)',
    'わたしは さんねんせいです。～さんは？ ／ わたしも さんねんせいです。',
  ),
  conv(
    'Introducing a third person: "This is ~. ~ came from ~."',
    'こちらは ～さんです。～さんは ～から きました。',
  ),
]

// ─── CH. 3: Daily Routines ────────────────────────────────────────────────────
const CH3_PATTERNS: VocabBankItem[] = [
  conv(
    '"Do you often study at the library?" / "Yes, I often study." (frequency + で)',
    'よく としょかんで べんきょうしますか。 ／ はい、よく べんきょうします。',
  ),
  conv(
    '"Do you watch TV every day?" / "No, I don\'t watch it much." (あまり + negative)',
    'まいにち テレビを みますか。 ／ いいえ、あまり みません。',
    'expression',
    { notes: '⚠️ あまり must pair with negative verb form' },
  ),
  conv(
    '"You don\'t drink coffee at all?" / "Right, I don\'t drink it at all." (ぜんぜん + negative)',
    'ぜんぜん コーヒーを のみませんか。 ／ ええ、ぜんぜん のみません。',
    'expression',
    { notes: '⚠️ ぜんぜん must pair with negative verb form' },
  ),
  conv(
    '"Do you have class today?" / "Yes, I have class at 3." (が あります existence)',
    'きょう じゅぎょうが ありますか。 ／ はい、さんじに じゅぎょうが あります。',
  ),
  conv(
    '"What time do you wake up?" / "I wake up at 7 every morning." (time particle に)',
    'なんじに おきますか。 ／ まいあさ しちじに おきます。',
  ),
  conv(
    '"About what time do you go to bed?" / "Around 11." (〜ごろ approximation)',
    'なんじごろ ねますか。 ／ じゅういちじごろ ねます。',
  ),
  conv(
    '"From what time to what time do you study?" / "From 6 to 10." (から〜まで)',
    'なんじから なんじまで べんきょうしますか。 ／ ろくじから じゅうじまで。',
  ),
  conv(
    '"What did you do yesterday?" / "I watched a movie." (past tense 〜ました)',
    'きのう なにを しましたか。 ／ えいがを みました。',
  ),
  conv(
    '"Did you study yesterday?" / "No, I didn\'t. I watched TV." (past negative 〜ませんでした)',
    'きのう べんきょうしましたか。 ／ いいえ、べんきょうしませんでした。テレビを みました。',
  ),
  conv(
    '"Do you always eat breakfast?" / "Yes, I always do." (いつも frequency)',
    'いつも あさごはんを たべますか。 ／ はい、いつも たべます。',
  ),
]

// ─── CH. 4: Location & Description ───────────────────────────────────────────
const CH4_PATTERNS: VocabBankItem[] = [
  conv(
    '"What is this?" / "That is a dictionary." (これ/それ demonstratives)',
    'これは なんですか。 ／ それは じしょです。',
  ),
  conv(
    '"What is that over there?" / "That is a hospital." (あれ far demonstrative)',
    'あれは なんですか。 ／ あれは びょういんです。',
  ),
  conv(
    '"Which one is ~\'s bag?" / "That one." (どれ question)',
    'どれが ～さんの かばんですか。 ／ あれです。',
  ),
  conv(
    '"Where is the bank?" / "It is near the station." (〜に あります existence)',
    'ぎんこうは どこに ありますか。 ／ えきの ちかくに あります。',
  ),
  conv(
    '"Where is the restroom?" / "Over there." (あそこ location)',
    'トイレは どこですか。 ／ あそこです。',
  ),
  conv(
    '"Where is the teacher?" / "In the classroom." (います for animate beings)',
    'せんせいは どこに いますか。 ／ きょうしつに います。',
  ),
  conv(
    '"Is there a convenience store around here?" / "Yes, there is one over there."',
    'このへんに コンビニが ありますか。 ／ はい、あそこに あります。',
  ),
  conv(
    '"Is that bag big?" / "Yes, it\'s very big." (い-adj polite form)',
    'そのかばんは おおきいですか。 ／ はい、とても おおきいです。',
  ),
  conv(
    '"Is that bag big?" / "No, not very big." (い-adj negative: 〜くない)',
    'そのかばんは おおきいですか。 ／ いいえ、あまり おおきくないです。',
    'expression',
    { notes: '⚠️ い-adj negative: drop い → add くない. いい→よくない (NEVER いくない)' },
  ),
  conv(
    '"Is this dictionary good?" / "No, it\'s not good." (irregular いい→よくない)',
    'このじしょは いいですか。 ／ いいえ、よくないです。',
    'expression',
    { notes: '⚠️ いい irregular: Neg→よくない  Past→よかった  NEVER いくない/いかった' },
  ),
  conv(
    '"Is this area quiet?" / "No, it\'s lively." (な-adj description)',
    'このへんは しずかですか。 ／ いいえ、にぎやかです。',
  ),
  conv(
    '"This restaurant is delicious (telling you)." — よ asserts new info for listener',
    'このレストランは おいしいですよ。 ／ そうですか。',
    'expression',
    { notes: 'よ = asserting new info for listener. ね = seeking shared agreement.' },
  ),
  conv(
    '"It\'s cold today, isn\'t it (we both feel it)." — ね seeks shared agreement',
    'きょうは さむいですね。 ／ そうですね。',
  ),
]

// ─── CH. 5: Rooms, Locations & Distance ──────────────────────────────────────
const CH5_PATTERNS: VocabBankItem[] = [
  conv(
    '"Is this book yours?" / "Yes, it\'s mine." (の as pronoun substitute)',
    'この ほんは ～さんのですか。 ／ はい、わたしのです。',
  ),
  conv(
    '"Where is the book?" / "It is on top of the desk." (location noun + に あります)',
    'ほんは どこに ありますか。 ／ つくえの うえに あります。',
  ),
  conv(
    '"Where is the cat?" / "Under the sofa." (location noun + に います)',
    'ねこは どこに いますか。 ／ ソファの したに います。',
  ),
  conv(
    '"What is to the right of the door?" / "There is a window." (location + なにが)',
    'ドアの みぎに なにが ありますか。 ／ まどが あります。',
  ),
  conv(
    '"What is in the room?" / "There is a bed, desk, and bookshelf." (listing with と)',
    'へやに なにが ありますか。 ／ ベッドと つくえと ほんだなが あります。',
  ),
  conv(
    '"What is that building?" / "That is the student union." (あの/あれ far reference)',
    'あの たてものは なんですか。 ／ あれは がくせいかいかんです。',
  ),
  conv(
    '"Which bag is ~\'s?" / "That black bag." (どの + noun)',
    'どの かばんが ～さんのですか。 ／ その くろいかばんです。',
  ),
  conv(
    '"How long does it take from home to school?" / "About 10 minutes by bus." (から〜まで〜ぐらい)',
    'うちから がっこうまで どのくらい かかりますか。 ／ バスで じゅっぷんぐらい かかります。',
  ),
  conv(
    '"Which is better, big or small?" / "The big one." (の as pronoun for adj+noun)',
    'おおきいのと ちいさいのと どちらが いいですか。 ／ おおきいのが いいです。',
  ),
  conv(
    '"Who is there?" / "Yamada is there." (が marks answer to question word)',
    'だれが いますか。 ／ やまださんが います。',
  ),
  conv(
    '"There is no convenience store, but there is a supermarket." (は for contrast)',
    'コンビニは ありませんが、スーパーは あります。',
    'expression',
    { notes: 'は used contrastively: コンビニ は (no) / スーパー は (yes)' },
  ),
]

// ─── CH. 6: Past, Invitations & て-Form ──────────────────────────────────────
const CH6_PATTERNS: VocabBankItem[] = [
  conv(
    '"How was your weekend?" / "It was very fun." (past い-adj: 〜かったです)',
    'しゅうまつは どうでしたか。 ／ とても たのしかったです。',
  ),
  conv(
    '"How was the movie?" / "It was interesting." (past い-adj)',
    'えいがは どうでしたか。 ／ おもしろかったです。',
  ),
  conv(
    '"How was the party?" / "It was very lively." (past な-adj: 〜でした)',
    'パーティは どうでしたか。 ／ とても にぎやかでした。',
  ),
  conv(
    '"How was the test?" / "It was difficult." / "That must have been tough."',
    'テストは どうでしたか。 ／ むずかしかったです。 ／ たいへんでしたね。',
  ),
  conv(
    '"Was that restaurant good?" / "Yes, it was very good." (irregular いい→よかった)',
    'そのレストランは よかったですか。 ／ はい、とても よかったです。',
    'expression',
    { notes: '⚠️ いい past: よかったです  Neg past: よくなかったです  NEVER いかった/いくなかった' },
  ),
  conv(
    '"Was the movie interesting?" / "No, it wasn\'t very interesting." (い-adj past negative)',
    'えいがは おもしろかったですか。 ／ いいえ、あまり おもしろくなかったです。',
    'expression',
    { notes: 'い-adj past neg: drop い → くなかったです' },
  ),
  conv(
    '"Was the concert lively?" / "No, it wasn\'t lively." (な-adj past negative)',
    'コンサートは にぎやかでしたか。 ／ いいえ、にぎやかじゃありませんでした。',
    'expression',
    { notes: 'な-adj past neg: じゃありませんでした' },
  ),
  conv(
    '"Are you busy today?" / "No, I\'m not busy." (setup for invitation)',
    'きょう いそがしいですか。 ／ いいえ、いそがしくないですよ。',
  ),
  conv(
    'Invitation: "Won\'t you watch a movie with me?" / "Yes, sounds great!" (〜ませんか accept)',
    'いっしょに えいがを みませんか。 ／ ええ、いいですよ。',
  ),
  conv(
    'Invitation (decline): "Won\'t you...?" / "Sorry, I\'m afraid I\'m unavailable."',
    'いっしょに えいがを みませんか。 ／ すみません、ちょっと つごうが わるくて。',
    'expression',
    { notes: 'Polite declines trail off: ちょっと つごうが わるくて… / ちょっと ようじが あって…' },
  ),
  conv(
    '"Definitely next time." (polite follow-up after declining)',
    'こんど ぜひ。',
  ),
  conv(
    'Setting a time: "How about 3 p.m.?" / "Sounds good. 3 p.m. then."',
    'ごごさんじは どうですか。 ／ いいですね。じゃあ、ごごさんじに。',
  ),
  conv(
    '"What did you do yesterday?" / "I shopped, watched a movie, and went home." (て-form sequence)',
    'きのう なにを しましたか。 ／ かいものを して、えいがを みて、うちに かえりました。',
    'expression',
    { notes: 'て-form links sequential actions: 〜して、〜して、Verb (final)' },
  ),
  conv(
    '"What did you do yesterday morning?" / "I woke up, showered, and ate breakfast." (て-form)',
    'きのうの あさ なにを しましたか。 ／ おきて、シャワーを あびて、あさごはんを たべました。',
  ),
  conv(
    'Request using て-form: "Please wait a moment."',
    'ちょっと まってください。',
  ),
  conv(
    '"Who did you go with?" / "I went with a friend." (と particle = with person)',
    'だれと いきましたか。 ／ ともだちと いきました。',
  ),
  conv(
    '"Did you go alone?" / "No, I went with a friend."',
    'ひとりで いきましたか。 ／ いいえ、ともだちと いきました。',
  ),
  conv(
    'そうですか (new info) vs そうですね (shared info) — know the difference',
    'そうですか = "Oh I see / Really?" (new info) ｜ そうですね = "That\'s right / Indeed" (shared)',
    'grammar',
    { notes: 'そうですか: you just learned this. そうですね: confirming shared knowledge/feeling.' },
  ),
  conv(
    'Expressing sympathy: "That must have been tough." / "Yes, but it was fun."',
    'たいへんでしたね。 ／ そうですね。でも、たのしかったです。',
  ),
  conv(
    '"That\'s great / I\'m glad." — よかった = past of いい, used to express relief/happiness',
    'よかったですね。',
  ),
  conv(
    '"That\'s a shame (present)." / "That was a shame (past)."',
    'ざんねんですね。 ／ ざんねんでしたね。',
  ),
]

// ─── Full export ──────────────────────────────────────────────────────────────
export const DEFAULT_CONVERSATION_BANK: VocabBankItem[] = [
  ...CH1_PATTERNS,
  ...CH2_PATTERNS,
  ...CH3_PATTERNS,
  ...CH4_PATTERNS,
  ...CH5_PATTERNS,
  ...CH6_PATTERNS,
]
