/**
 * jpSentenceBank — Nakama 1 Sentence Builder Patterns, Ch. 1–6 (JAPN 1110)
 *
 * Each entry is stored as a VocabBankItem so it flows into the existing
 * SentenceBuilderGame pool (which filters bank items that have example+exampleEn).
 *
 * IMPORTANT: every `example` string uses SPACES between individual grammatical
 * tokens so the tokenizer produces one tile per unit (pronoun, particle, verb…).
 *
 * `notes` encodes per-token role labels as "breakdown:ROLE1,ROLE2,..."
 * Labels used:
 *   PRN  = pronoun (わたし, あなた, ぼく)
 *   N    = noun
 *   V    = verb (dict / masu / past / te-form)
 *   COP  = copula (です / でした / じゃありません)
 *   ADJ  = adjective (い- or な- any form)
 *   ADV  = adverb (いつも, よく, あまり…)
 *   TOP  = topic particle は
 *   OBJ  = object particle を
 *   SUBJ = subject particle が
 *   LOC  = location / direction particle (に / で / へ)
 *   PTCL = other particle (の, と, も, から, まで, ごろ)
 *   DEM  = demonstrative (これ/それ/あれ/この/その/あの/ここ/そこ/あそこ)
 *   QW   = question word (なに, どこ, いつ, なんじ, なん)
 *   TIME = time expression (きのう, まいにち, しちじ, しゅうまつ…)
 *   NEG  = negative ending (ません / じゃありません)
 */
import type { VocabBankItem } from '../components/jpquiz/types'

let _seq = 0
function id(): string { return `vb_sent_${(++_seq).toString(36)}` }

/**
 * s(exampleJP, exampleEN, breakdownLabels)
 * breakdownLabels: one label per space-separated token in exampleJP (excluding 。)
 */
function s(ex: string, exEn: string, bd: string[]): VocabBankItem {
  return {
    id: id(),
    word: exEn,
    meaning: ex.replace(/。$/, '').replace(/。$/, ''),
    category: 'grammar',
    example: ex,
    exampleEn: exEn,
    notes: 'breakdown:' + bd.join(','),
    source: 'nakama1',
  }
}

// ── CH.1 · Identity, Classroom Expressions ───────────────────────────────────
const CH1: VocabBankItem[] = [
  s('わたし は やまだ です。',
    'I am Yamada.',
    ['PRN','TOP','N','COP']),

  s('これ は えんぴつ です か。',
    'Is this a pencil?',
    ['DEM','TOP','N','COP','PTCL']),

  s('ゆっくり いって ください。',
    'Please speak slowly.',
    ['ADV','V','V']),

  s('もういちど いって ください。',
    'Please say it again.',
    ['ADV','V','V']),

  s('おおきい こえ で いって ください。',
    'Please speak louder.',
    ['ADJ','N','LOC','V','V']),

  s('これ は にほんご で なん と いいます か。',
    'What is this called in Japanese?',
    ['DEM','TOP','N','LOC','QW','PTCL','V','PTCL']),

  s('わたし の なまえ は スミス です。',
    'My name is Smith.',
    ['PRN','PTCL','N','TOP','N','COP']),

  s('きいて ください。',
    'Please listen.',
    ['V','V']),

  s('みて ください。',
    'Please look.',
    ['V','V']),

  s('かいて ください。',
    'Please write.',
    ['V','V']),
]

// ── CH.2 · Identity, Major, Time ──────────────────────────────────────────────
const CH2: VocabBankItem[] = [
  s('わたし は だいがくせい です。',
    'I am a college student.',
    ['PRN','TOP','N','COP']),

  s('ぼく は いちねんせい です。',
    'I am a freshman.',
    ['PRN','TOP','N','COP']),

  s('わたし の せんこう は れきし です。',
    'My major is history.',
    ['PRN','PTCL','N','TOP','N','COP']),

  s('せんこう は なん です か。',
    'What is your major?',
    ['N','TOP','QW','COP','PTCL']),

  s('いま なんじ です か。',
    'What time is it now?',
    ['TIME','QW','COP','PTCL']),

  s('ごぜん じゅうじ はん です。',
    'It is 10:30 a.m.',
    ['TIME','TIME','TIME','COP']),

  s('わたし も がくせい です。',
    'I am also a student.',
    ['PRN','PTCL','N','COP']),

  s('あなた は にほんじん です か。',
    'Are you Japanese?',
    ['PRN','TOP','N','COP','PTCL']),

  s('たなかさん は さんねんせい です。',
    'Tanaka-san is a junior (3rd year).',
    ['N','TOP','N','COP']),

  s('わたし の なまえ は なん です か。',
    'What is your name?',
    ['PRN','PTCL','N','TOP','QW','COP','PTCL']),

  s('これ は わたし の ほん です。',
    'This is my book.',
    ['DEM','TOP','PRN','PTCL','N','COP']),

  s('あちら は すずきせんせい です。',
    'That person over there is Professor Suzuki.',
    ['DEM','TOP','N','COP']),

  s('わたし は アメリカじん です。',
    'I am American.',
    ['PRN','TOP','N','COP']),

  s('せんせい の せんこう は なん です か。',
    'What is the professor\'s major?',
    ['N','PTCL','N','TOP','QW','COP','PTCL']),

  s('いま なんじ から なんじ まで です か。',
    'From what time to what time is it?',
    ['TIME','QW','PTCL','QW','PTCL','COP','PTCL']),

  s('ごご よじ です。',
    'It is 4 p.m.',
    ['TIME','TIME','COP']),

  s('あなた の せんこう は なん です か。',
    'What is your major?',
    ['PRN','PTCL','N','TOP','QW','COP','PTCL']),
]

// ── CH.3 · Daily Activities, Frequency, Days ─────────────────────────────────
const CH3: VocabBankItem[] = [
  s('わたし は まいあさ しちじ に おきます。',
    'I wake up at 7 every morning.',
    ['PRN','TOP','ADV','TIME','LOC','V']),

  s('きのう としょかん で べんきょう しました。',
    'I studied at the library yesterday.',
    ['TIME','N','LOC','N','V']),

  s('あさごはん を たべます か。',
    'Do you eat breakfast?',
    ['N','OBJ','V','PTCL']),

  s('わたし は テレビ を あまり みません。',
    'I don\'t watch TV very often.',
    ['PRN','TOP','N','OBJ','ADV','V']),

  s('まいにち コーヒー を のみます。',
    'I drink coffee every day.',
    ['ADV','N','OBJ','V']),

  s('がっこう に いきます。',
    'I go to school.',
    ['N','LOC','V']),

  s('うち に かえります。',
    'I go home.',
    ['N','LOC','V']),

  s('きょう しゅくだい が あります。',
    'I have homework today.',
    ['TIME','N','SUBJ','V']),

  s('なんじ に ねます か。',
    'What time do you go to bed?',
    ['QW','LOC','V','PTCL']),

  s('えいが を みました。',
    'I watched a movie.',
    ['N','OBJ','V']),

  s('ともだち と えいが を みました。',
    'I watched a movie with a friend.',
    ['N','PTCL','N','OBJ','V']),

  s('ときどき こうえん で あるきます。',
    'I sometimes walk in the park.',
    ['ADV','N','LOC','V']),

  s('いつも にじ ごろ ひるごはん を たべます。',
    'I always eat lunch at around 2 o\'clock.',
    ['ADV','TIME','PTCL','N','OBJ','V']),

  s('まいばん おふろ に はいります。',
    'I take a bath every night.',
    ['ADV','N','LOC','V']),

  s('あした がっこう に きます か。',
    'Are you coming to school tomorrow?',
    ['TIME','N','LOC','V','PTCL']),

  s('しゅうまつ に なに を します か。',
    'What do you do on weekends?',
    ['TIME','LOC','QW','OBJ','V','PTCL']),

  s('よく テレビ を みます か。',
    'Do you often watch TV?',
    ['ADV','N','OBJ','V','PTCL']),

  s('ぜんぜん べんきょう しません。',
    'I don\'t study at all.',
    ['ADV','N','V']),

  s('まいあさ シャワー を あびます。',
    'I take a shower every morning.',
    ['ADV','N','OBJ','V']),

  s('わたし は にほんご を べんきょう します。',
    'I study Japanese.',
    ['PRN','TOP','N','OBJ','V']),

  s('がくせい は としょかん で ほん を よみます。',
    'The student reads a book at the library.',
    ['N','TOP','N','LOC','N','OBJ','V']),

  s('うち で テレビ を みます。',
    'I watch TV at home.',
    ['N','LOC','N','OBJ','V']),

  s('ぜんぜん コーヒー を のみません。',
    'I don\'t drink coffee at all.',
    ['ADV','N','OBJ','V']),

  s('いつ べんきょう しますか。',
    'When do you study?',
    ['QW','N','V','PTCL']),

  s('ともだち と よく えいが を みます。',
    'I often watch movies with friends.',
    ['N','PTCL','ADV','N','OBJ','V']),

  s('あさごはん を たべて がっこう に いきます。',
    'I eat breakfast and go to school.',
    ['N','OBJ','V','N','LOC','V']),

  s('まいにち なんじ に おきます か。',
    'What time do you wake up every day?',
    ['ADV','QW','LOC','V','PTCL']),

  s('きのう なに を しました か。',
    'What did you do yesterday?',
    ['TIME','QW','OBJ','V','PTCL']),

  s('げつようび に クラス が あります。',
    'I have class on Monday.',
    ['TIME','LOC','N','SUBJ','V']),

  s('まいしゅう もくようび に じゅぎょう が あります。',
    'I have class every Thursday.',
    ['ADV','TIME','LOC','N','SUBJ','V']),

  s('ごはん を たべて テレビ を みます。',
    'I eat a meal and watch TV.',
    ['N','OBJ','V','N','OBJ','V']),

  s('ほん を よんで ねます。',
    'I read a book and go to sleep.',
    ['N','OBJ','V','V']),
]

// ── CH.4 · Location, Adjectives, Demonstratives ──────────────────────────────
const CH4: VocabBankItem[] = [
  s('ぎんこう は えき の となり に あります。',
    'The bank is next to the station.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('この かばん は あたらしい です。',
    'This bag is new.',
    ['DEM','N','TOP','ADJ','COP']),

  s('あの レストラン は きれい です。',
    'That restaurant is pretty.',
    ['DEM','N','TOP','ADJ','COP']),

  s('コンビニ は どこ に あります か。',
    'Where is the convenience store?',
    ['N','TOP','QW','LOC','V','PTCL']),

  s('この まち は にぎやか です。',
    'This town is lively.',
    ['DEM','N','TOP','ADJ','COP']),

  s('その じしょ は おおきい です か。',
    'Is that dictionary big?',
    ['DEM','N','TOP','ADJ','COP','PTCL']),

  s('これ は なん です か。',
    'What is this?',
    ['DEM','TOP','QW','COP','PTCL']),

  s('あれ は びょういん です。',
    'That (over there) is a hospital.',
    ['DEM','TOP','N','COP']),

  s('デパート は えき の ちかく に あります。',
    'The department store is near the station.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('ゆうびんきょく は どこ に あります か。',
    'Where is the post office?',
    ['N','TOP','QW','LOC','V','PTCL']),

  s('えんぴつ は ちいさい です。',
    'The pencil is small.',
    ['N','TOP','ADJ','COP']),

  s('この レストラン は ゆうめい です か。',
    'Is this restaurant famous?',
    ['DEM','N','TOP','ADJ','COP','PTCL']),

  s('この ノート は あたらしい です か。',
    'Is this notebook new?',
    ['DEM','N','TOP','ADJ','COP','PTCL']),

  s('あかい かばん は たかい です。',
    'The red bag is expensive.',
    ['ADJ','N','TOP','ADJ','COP']),

  s('この しろい ノート は わたし の です。',
    'This white notebook is mine.',
    ['DEM','ADJ','N','TOP','PRN','PTCL','COP']),

  s('ここ は どこ です か。',
    'Where is this place?',
    ['DEM','TOP','QW','COP','PTCL']),

  s('そこ は こうえん です。',
    'That place (near you) is a park.',
    ['DEM','TOP','N','COP']),

  s('あそこ に ぎんこう が あります。',
    'There is a bank over there.',
    ['DEM','LOC','N','SUBJ','V']),

  s('この ビル は りっぱ です。',
    'This building is impressive.',
    ['DEM','N','TOP','ADJ','COP']),

  s('スーパー は りょう の ちかく に あります。',
    'The supermarket is near the dormitory.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('その えんぴつ は だれ の です か。',
    'Whose pencil is that?',
    ['DEM','N','TOP','QW','PTCL','COP','PTCL']),

  s('ほんや は えき の まえ に あります。',
    'The bookstore is in front of the station.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('この かばん は ふるい です か。',
    'Is this bag old?',
    ['DEM','N','TOP','ADJ','COP','PTCL']),

  s('あの たてもの は おおきい です。',
    'That building over there is big.',
    ['DEM','N','TOP','ADJ','COP']),
]

// ── CH.5 · Existence, Room Objects, Location Nouns ────────────────────────────
const CH5: VocabBankItem[] = [
  s('ねこ は ソファ の した に います。',
    'The cat is under the sofa.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('ほん は つくえ の うえ に あります。',
    'The book is on the desk.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('いぬ は まど の まえ に います。',
    'The dog is in front of the window.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('でんわ は テーブル の よこ に あります。',
    'The phone is beside the table.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('わたし の へや に ベッド が あります。',
    'There is a bed in my room.',
    ['PRN','PTCL','N','LOC','N','SUBJ','V']),

  s('きょうしつ に がくせい が います。',
    'There are students in the classroom.',
    ['N','LOC','N','SUBJ','V']),

  s('バス で がっこう に いきます。',
    'I go to school by bus.',
    ['N','LOC','N','LOC','V']),

  s('うち から がっこう まで じゅうごふん かかります。',
    'It takes 15 minutes from home to school.',
    ['N','PTCL','N','PTCL','TIME','V']),

  s('ほんだな は ドア の ひだり に あります。',
    'The bookshelf is to the left of the door.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('その コンピュータ は つくえ の うえ に あります。',
    'That computer is on the desk.',
    ['DEM','N','TOP','N','PTCL','N','LOC','V']),

  s('いす は テーブル の よこ に あります。',
    'The chair is beside the table.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('じてんしゃ は たてもの の そと に あります。',
    'The bicycle is outside the building.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('ねこ と いぬ が います。',
    'There is a cat and a dog.',
    ['N','PTCL','N','SUBJ','V']),

  s('へや の なか に とけい が あります。',
    'There is a clock inside the room.',
    ['N','PTCL','N','LOC','N','SUBJ','V']),

  s('かわ の ちかく に こうえん が あります。',
    'There is a park near the river.',
    ['N','PTCL','N','LOC','N','SUBJ','V']),

  s('ちいさい いぬ が います。',
    'There is a small dog.',
    ['ADJ','N','SUBJ','V']),

  s('えき の まえ に コンビニ が あります。',
    'There is a convenience store in front of the station.',
    ['N','PTCL','N','LOC','N','SUBJ','V']),

  s('この ほんだな の うえ に なに が あります か。',
    'What is on top of this bookshelf?',
    ['DEM','N','PTCL','N','LOC','QW','SUBJ','V','PTCL']),

  s('えき から うち まで バス で いきます。',
    'I go from the station to home by bus.',
    ['N','PTCL','N','PTCL','N','LOC','V']),

  s('ともだち が うち に きました。',
    'A friend came to my home.',
    ['N','SUBJ','N','LOC','V']),

  s('がくしょく は たいいくかん の となり に あります。',
    'The school cafeteria is next to the gym.',
    ['N','TOP','N','PTCL','N','LOC','V']),

  s('ソファ の うえ に ねこ が います。',
    'There is a cat on top of the sofa.',
    ['N','PTCL','N','LOC','N','SUBJ','V']),

  s('つくえ の した に かばん が あります。',
    'There is a bag under the desk.',
    ['N','PTCL','N','LOC','N','SUBJ','V']),

  s('へや の みぎ に ドア が あります。',
    'There is a door to the right of the room.',
    ['N','PTCL','N','LOC','N','SUBJ','V']),
]

// ── CH.6 · Invitations, Past Tense, て-form Chaining ─────────────────────────
const CH6: VocabBankItem[] = [
  s('いっしょ に テニス を しません か。',
    'Won\'t you play tennis with me?',
    ['ADV','PTCL','N','OBJ','V','PTCL']),

  s('しゅうまつ に かいもの を しました。',
    'I went shopping on the weekend.',
    ['TIME','LOC','N','OBJ','V']),

  s('パーティ は たのしかった です。',
    'The party was fun.',
    ['N','TOP','ADJ','COP']),

  s('せんしゅう いそがしかった です。',
    'I was busy last week.',
    ['TIME','ADJ','COP']),

  s('ともだち に メール を かきます。',
    'I write emails to friends.',
    ['N','LOC','N','OBJ','V']),

  s('こうえん で さんぽ を します。',
    'I take a walk in the park.',
    ['N','LOC','N','OBJ','V']),

  s('かいもの を して えいが を みました。',
    'I went shopping and watched a movie.',
    ['N','OBJ','V','N','OBJ','V']),

  s('おんがく を きいて べんきょう します。',
    'I listen to music and study.',
    ['N','OBJ','V','N','V']),

  s('りょうり を して ともだち を よびました。',
    'I cooked and invited a friend.',
    ['N','OBJ','V','N','OBJ','V']),

  s('ともだち と コンサート に いきました。',
    'I went to a concert with a friend.',
    ['N','PTCL','N','LOC','V']),

  s('プール で およぎます。',
    'I swim in the pool.',
    ['N','LOC','V']),

  s('しんぶん を よみます。',
    'I read a newspaper.',
    ['N','OBJ','V']),

  s('ともだち に てがみ を かきました。',
    'I wrote a letter to a friend.',
    ['N','LOC','N','OBJ','V']),

  s('こんど いっしょ に えいが を みましょう。',
    'Let\'s watch a movie together next time.',
    ['TIME','ADV','PTCL','N','OBJ','V']),

  s('しゅうまつ は なに を しました か。',
    'What did you do on the weekend?',
    ['TIME','TOP','QW','OBJ','V','PTCL']),

  s('ともだち は げんき です か。',
    'Is your friend well?',
    ['N','TOP','ADJ','COP','PTCL']),

  s('おんがく は たのしい です。',
    'Music is fun.',
    ['N','TOP','ADJ','COP']),

  s('この ほん は おもしろい です。',
    'This book is interesting.',
    ['DEM','N','TOP','ADJ','COP']),

  s('あの えいが は かなしかった です。',
    'That movie was sad.',
    ['DEM','N','TOP','ADJ','COP']),

  s('まち は しずか です。',
    'The town is quiet.',
    ['N','TOP','ADJ','COP']),

  s('きょう ひま です か。',
    'Are you free today?',
    ['TIME','ADJ','COP','PTCL']),

  s('じゅぎょう は たのしい です か。',
    'Is class fun?',
    ['N','TOP','ADJ','COP','PTCL']),

  s('ともだち と さんぽ を しました。',
    'I took a walk with a friend.',
    ['N','PTCL','N','OBJ','V']),

  s('まいにち うんどう を します。',
    'I exercise every day.',
    ['ADV','N','OBJ','V']),

  s('コーヒー を のんで べんきょう しました。',
    'I drank coffee and studied.',
    ['N','OBJ','V','N','V']),

  s('ざっし を よみます か。',
    'Do you read magazines?',
    ['N','OBJ','V','PTCL']),

  s('まいあさ コーヒー を のみます か。',
    'Do you drink coffee every morning?',
    ['ADV','N','OBJ','V','PTCL']),

  s('あした ともだち と こうえん に いきます。',
    'I will go to the park with a friend tomorrow.',
    ['TIME','N','PTCL','N','LOC','V']),

  s('でんわ を かけます。',
    'I make a phone call.',
    ['N','OBJ','V']),

  s('いっしょ に こうえん で あそびません か。',
    'Won\'t you play in the park with me?',
    ['ADV','PTCL','N','LOC','V','PTCL']),

  s('まち は にぎやか でした。',
    'The town was lively.',
    ['N','TOP','ADJ','COP']),

  s('コンサート は どう でした か。',
    'How was the concert?',
    ['N','TOP','QW','COP','PTCL']),

  s('せんしゅう パーティ に いきました。',
    'I went to a party last week.',
    ['TIME','N','LOC','V']),

  s('じゅぎょう の まえ に ごはん を たべます。',
    'I eat before class.',
    ['N','PTCL','N','LOC','N','OBJ','V']),

  s('せんせい は えいご を はなします。',
    'The teacher speaks English.',
    ['N','TOP','N','OBJ','V']),

  s('わたし は にほん から きました。',
    'I came from Japan.',
    ['PRN','TOP','N','PTCL','V']),

  s('アルバイト は たいへん でした か。',
    'Was the part-time job tough?',
    ['N','TOP','ADJ','COP','PTCL']),

  s('ともだち と ジョギング を しました。',
    'I went jogging with a friend.',
    ['N','PTCL','N','OBJ','V']),

  s('しごと の あと で コーヒー を のみます。',
    'I drink coffee after work.',
    ['N','PTCL','N','LOC','N','OBJ','V']),

  s('こんど いっしょ に プール に いきましょう。',
    'Let\'s go to the pool together next time.',
    ['TIME','ADV','PTCL','N','LOC','V']),

  s('りょうり を して せんたく を しました。',
    'I cooked and did laundry.',
    ['N','OBJ','V','N','OBJ','V']),

  s('やすみのひ に ピクニック を します。',
    'I go on a picnic on holidays.',
    ['TIME','LOC','N','OBJ','V']),
]

// ── Full export ───────────────────────────────────────────────────────────────
export const JP_SENTENCES: VocabBankItem[] = [
  ...CH1,
  ...CH2,
  ...CH3,
  ...CH4,
  ...CH5,
  ...CH6,
]
