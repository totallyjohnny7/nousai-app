import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { join, parse } from 'path';
import sharp from 'sharp';

const ACTIONS_DIR = join(import.meta.dirname, 'imgs', 'actions');
const OUTPUT_DIR = join(import.meta.dirname, 'profile-output');
const IMAGES_DIR = join(OUTPUT_DIR, 'Images');

mkdirSync(IMAGES_DIR, { recursive: true });

// Convert all SVGs to 144x144 PNGs (Stream Deck @2x)
const svgFiles = readdirSync(ACTIONS_DIR).filter(f => f.endsWith('.svg'));
const imageMap = {}; // actionId → relative png path

console.log(`Converting ${svgFiles.length} SVGs to PNG...`);

for (const svgFile of svgFiles) {
  const actionId = parse(svgFile).name;
  const svgPath = join(ACTIONS_DIR, svgFile);
  const pngName = `${actionId}.png`;
  const pngPath = join(IMAGES_DIR, pngName);

  const svgBuffer = readFileSync(svgPath);
  await sharp(svgBuffer)
    .resize(144, 144)
    .png()
    .toFile(pngPath);

  imageMap[actionId] = `Images/${pngName}`;
}

console.log(`Converted ${Object.keys(imageMap).length} icons`);

// Create page navigation arrow PNGs
const leftArrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="16" fill="#333"/>
  <path d="M 90 30 L 54 72 L 90 114" stroke="white" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="72" y="134" text-anchor="middle" font-family="Arial" font-size="14" fill="#999">PREV</text>
</svg>`;

const rightArrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <rect width="144" height="144" rx="16" fill="#333"/>
  <path d="M 54 30 L 90 72 L 54 114" stroke="white" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="72" y="134" text-anchor="middle" font-family="Arial" font-size="14" fill="#999">NEXT</text>
</svg>`;

await sharp(Buffer.from(leftArrowSvg)).resize(144, 144).png().toFile(join(IMAGES_DIR, 'nav_prev_page.png'));
await sharp(Buffer.from(rightArrowSvg)).resize(144, 144).png().toFile(join(IMAGES_DIR, 'nav_next_page.png'));

imageMap['nav_prev_page'] = 'Images/nav_prev_page.png';
imageMap['nav_next_page'] = 'Images/nav_next_page.png';

console.log('Created page navigation arrows');

// ─── Action builders ──────────────────────────────────────────────────────────

function makeState(label, imageId) {
  return {
    FontFamily: '',
    FontSize: 10,
    FontStyle: '',
    FontUnderline: false,
    Image: imageMap[imageId] || '',
    OutlineThickness: 2,
    ShowTitle: false,
    Title: label,
  };
}

function makeHotkeyAction(label, imageId) {
  return {
    ActionID: crypto.randomUUID(),
    LinkedTitle: true,
    Name: 'Hotkey',
    Plugin: { Name: 'Activate a Key Command', UUID: 'com.elgato.streamdeck.system', Version: '1.0' },
    Resources: null,
    Settings: { openInBrowser: false, path: '' },
    State: 0,
    States: [makeState(label, imageId)],
    UUID: 'com.elgato.streamdeck.system.hotkey',
  };
}

function makePageNavAction(direction, imageId) {
  const uuid = direction === 'next'
    ? 'com.elgato.streamdeck.page.next'
    : 'com.elgato.streamdeck.page.previous';
  return {
    ActionID: crypto.randomUUID(),
    LinkedTitle: true,
    Name: direction === 'next' ? 'Next Page' : 'Previous Page',
    Plugin: { Name: 'Pages', UUID: 'com.elgato.streamdeck.page', Version: '1.0' },
    Resources: null,
    Settings: {},
    State: 0,
    States: [{
      Image: imageMap[imageId] || '',
      ShowTitle: false,
    }],
    UUID: uuid,
  };
}

// ─── Page 1: Study Mode ───────────────────────────────────────────────────────
// Most-used during study sessions. Flashcard controls + grading front-and-center.

const page1Actions = {};

const p1 = [
  // Row 0 — core study controls
  ['0,0', 'fc_flip',        'Flip Card'],
  ['0,1', 'fc_next',        'Next'],
  ['0,2', 'fc_prev',        'Prev'],
  ['0,3', 'fc_rsvp',        'RSVP'],
  ['0,4', 'fc_cram',        'Cram'],
  // Row 1 — supplementary study tools
  ['1,0', 'fc_type_recall', 'Type'],
  ['1,1', 'fc_zen',         'Zen'],
  ['1,2', 'relay_send',     'Relay'],
  ['1,3', 'screen_lasso',   'Lasso'],
  ['1,4', 'notes_speak',    'TTS'],
  // Row 2 — FSRS grading buttons
  ['2,0', 'fc_conf1',       'Again'],
  ['2,1', 'fc_conf2',       'Hard'],
  ['2,2', 'fc_conf3',       'Good'],
  ['2,3', 'fc_conf4',       'Easy'],
];

for (const [pos, actionId, label] of p1) {
  page1Actions[pos] = makeHotkeyAction(label, actionId);
}
page1Actions['2,4'] = makePageNavAction('next', 'nav_next_page');

// ─── Page 2: Tools ────────────────────────────────────────────────────────────
// Drawing, annotation, notes formatting.

const page2Actions = {};

const p2 = [
  // Row 0 — drawing tools
  ['0,0', 'draw_pen',       'Pen'],
  ['0,1', 'draw_highlight', 'Highlight'],
  ['0,2', 'draw_erase',     'Erase'],
  ['0,3', 'draw_color',     'Color'],
  ['0,4', 'draw_clear',     'Clear'],
  // Row 1 — drawing utils + notes formatting
  ['1,0', 'draw_undo',      'Undo'],
  ['1,1', 'draw_redo',      'Redo'],
  ['1,2', 'draw_save',      'Save'],
  ['1,3', 'notes_bold',     'Bold'],
  ['1,4', 'notes_italic',   'Italic'],
  // Row 2 — persistent grading strip
  ['2,1', 'fc_conf1',       'Again'],
  ['2,2', 'fc_conf2',       'Hard'],
  ['2,3', 'fc_conf3',       'Good'],
];

for (const [pos, actionId, label] of p2) {
  page2Actions[pos] = makeHotkeyAction(label, actionId);
}
page2Actions['2,0'] = makePageNavAction('previous', 'nav_prev_page');
page2Actions['2,4'] = makePageNavAction('next', 'nav_next_page');

// ─── Page 3: Navigation + Omni Protocol ──────────────────────────────────────
// App navigation shortcuts and Omni Protocol phase triggers.

const page3Actions = {};

const p3 = [
  // Row 0 — Omni Protocol phases
  ['0,0', 'omni_start',   'OMNI'],
  ['0,1', 'focus_lock',   'Focus'],
  ['0,2', 'interleave',   'Mix'],
  ['0,3', 'phase_encode', 'Encode'],
  ['0,4', 'phase_test',   'Test'],
  // Row 1 — in-app navigation
  ['1,0', 'nav_home',     'Home'],
  ['1,1', 'nav_cards',    'Cards'],
  ['1,2', 'nav_quiz',     'Quiz'],
  ['1,3', 'nav_learn',    'Learn'],
  ['1,4', 'nav_settings', 'Settings'],
  // Row 2 — additional nav
  ['2,1', 'nav_timer',    'Timer'],
  ['2,2', 'nav_calendar', 'Calendar'],
  ['2,3', 'nav_notes',    'Library'],
  ['2,4', 'notes_save',   'Save'],
];

for (const [pos, actionId, label] of p3) {
  page3Actions[pos] = makeHotkeyAction(label, actionId);
}
page3Actions['2,0'] = makePageNavAction('previous', 'nav_prev_page');

// ─── Write pages ─────────────────────────────────────────────────────────────

function writePage(uuid, actions, pageName) {
  const pageDir = join(OUTPUT_DIR, 'Profiles', uuid.toUpperCase());
  const pageImagesDir = join(pageDir, 'Images');
  mkdirSync(pageImagesDir, { recursive: true });

  // Copy referenced images into the per-page Images folder
  for (const action of Object.values(actions)) {
    const states = action.States || [];
    for (const state of states) {
      if (state.Image && state.Image.startsWith('Images/')) {
        const srcFile = join(OUTPUT_DIR, state.Image);
        const destFile = join(pageDir, state.Image);
        try { copyFileSync(srcFile, destFile); } catch (_) {}
      }
    }
  }

  const manifest = {
    Controllers: [{ Actions: actions }],
    Title: pageName,
  };

  writeFileSync(join(pageDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  Page written: "${pageName}" (${uuid})`);
}

const page1UUID = crypto.randomUUID();
const page2UUID = crypto.randomUUID();
const page3UUID = crypto.randomUUID();

console.log('\nBuilding 3-page profile...');
writePage(page1UUID, page1Actions, 'NousAI Study');
writePage(page2UUID, page2Actions, 'NousAI Tools');
writePage(page3UUID, page3Actions, 'NousAI Nav');

// ─── Root profile manifest ────────────────────────────────────────────────────

const profileManifest = {
  Device: { Model: '20GBA9901', UUID: '@(1)[4057/128/A00SA5222KD7HD]' },
  Name: 'NousAI Omni',
  Pages: {
    Current: page1UUID,
    Default: page1UUID,
    Pages: [page1UUID, page2UUID, page3UUID],
  },
  Version: '3.0',
};

writeFileSync(join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(profileManifest, null, 2));

console.log('\nProfile built successfully!');
console.log(`Output directory: ${OUTPUT_DIR}`);
console.log('\nTo install, copy the profile-output folder to:');
console.log(`  %APPDATA%\\Elgato\\StreamDeck\\ProfilesV3\\<NEW-UUID>.sdProfile`);
console.log('\nOr rename profile-output to NousAI-Omni.sdProfile and double-click to import.');
