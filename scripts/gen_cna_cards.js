// Generates CNA_Skills flashcards JSON for bulk import
// Run: node scripts/gen_cna_cards.js > scripts/cna_cards.json

const TOPIC = 'CNA _ Test'

const skills = [
  {
    num: 1, name: 'WASHING HANDS', supplies: 'None',
    criticals: [
      'Arms angled DOWNWARD — hands LOWER than elbows when wetting & rinsing',
      'Scrub 20+ seconds (palms, between fingers, backs, under nails)',
      'Use 2nd paper towel to turn OFF faucet — clean hands never touch it',
    ],
    back: `1. Turn faucet ON with bare hand. Water running.
2. Arms DOWNWARD — hands LOWER than elbows. Wet hands AND wrists fully.
3. Apply soap. Form visible lather.
4. ⭐ Scrub AT LEAST 20 SECONDS: palms together, between fingers, backs of hands, scratch nails on opposite palm.
5. Scratch nails of each hand on the opposite palm.
6. ⭐ Rinse hands DOWNWARD (hands lower than elbows) — dirty water flows off fingertips, away from body.
7. ⭐ Dry with paper towel (palms, backs, between fingers, wrists). Hold used towel — do NOT touch wastebasket yet.
8. Use a SECOND paper towel to grip faucet and turn water OFF.
9. Drop BOTH paper towels into wastebasket. Done.`,
  },
  {
    num: 2, name: 'REMOVING (DOFFING) GLOVES', supplies: 'None',
    criticals: [
      'Pinch OUTSIDE of palm of first glove — only touch dirty outer surface',
      'Slide 2 bare fingers UNDER cuff of second glove — bare skin never touches outside',
      'Peel second glove inside-out over first glove forming a pouch',
    ],
    back: `1. ⭐ Dominant hand pinches OUTSIDE palm of other glove. Pull it off — touching only dirty outer surface.
2. ⭐ Hold removed glove in palm of still-gloved hand (make a fist around it). With bare hand, slide 2 fingers (index + middle) UNDER cuff of remaining glove at wrist.
3. ⭐ Push fingers down and outward — peel glove INSIDE OUT off hand. It wraps around first glove like a pouch.
4. End result: one inside-out bundle, bare skin only touched clean inner surfaces.
5. Drop bundle into trash. Nothing touches sides of can.
6. Immediately wash hands.`,
  },
  {
    num: 3, name: 'ABDOMINAL THRUST (HEIMLICH — CONSCIOUS)', supplies: 'None',
    criticals: [
      'Fist: thumb-side against belly, ABOVE navel, BELOW breastbone',
      'Wrap other hand around fist — pull INWARD and UP (J-shape motion)',
      'Repeat until object pops out OR person loses consciousness',
    ],
    back: `1. Approach. Ask loudly: "ARE YOU CHOKING? CAN YOU BREATHE?"
2. If no verbal response — proceed immediately.
3. Move BEHIND person. Arms wrap under armpits around waist.
4. ⭐ Make a FIST. Place flat thumb-side on belly: ABOVE navel, BELOW breastbone (center bullseye zone).
5. ⭐ Other hand WRAPS AROUND fist. Pull TOWARD you and UP — sharp J-shape motion. Person should jolt.
6. Watch mouth. If nothing exits — RESET and repeat.
7. Continue until object exits OR person collapses (then call for help/CPR).
8. Sit person down. Report incident. Document.`,
  },
  {
    num: 4, name: 'HANDLING SOILED EQUIPMENT', supplies: 'Gloves',
    criticals: [
      'Hold soiled equipment OUT AND AWAY from body — never touching clothes',
      'Clean with COLD WATER first (hot can set biological material)',
      'Wash hands BEFORE and AFTER the skill',
    ],
    back: `1. Wash and dry hands — full technique.
2. Don gloves — both hands snug at wrist.
3. ⭐ Pick up soiled equipment (bedpan, urinal, etc.). Hold OUT AND AWAY from body — arms extended, not touching scrubs.
4. Carry to utility sink. Clean with COLD WATER first, then disinfectant. Scrub all surfaces.
5. Carry clean equipment to correct labeled storage. Place in designated spot.
6. Peel off gloves using doffing technique. Trash.
7. Wash and dry hands again — full technique.`,
  },
  {
    num: 5, name: 'HANDLING SOILED WASTE', supplies: 'Gloves, waste container, fresh bag liner',
    criticals: [
      'Grab ONLY OUTSIDE surface of waste bag — never reach inside',
      'Tie bag closed by twisting top and double-knotting (like a balloon)',
      'Replace bag liner before leaving',
    ],
    back: `1. Wash hands — full technique.
2. Don gloves.
3. Drop soiled items one-by-one directly into waste container.
4. Disinfect any contaminated surfaces; let sit appropriate contact time before wiping.
5. Peel off gloves using doffing technique. Drop into waste container.
6. ⭐ Grab ONLY OUTSIDE of waste bag. Pinch gathered top — tie CLOSED (twist + double-knot like a balloon).
7. Pull fresh liner from storage. Snap into empty container.
8. Wash and dry hands — full technique.
9. Carry tied bag to designated disposal area.`,
  },
  {
    num: 6, name: 'HANDLING SOILED BED LINENS', supplies: 'Gloves, linen bag',
    criticals: [
      'ROLL linen away from you — soiled surface folds INSIDE (like a sleeping bag)',
      'Drop rolled bundle directly into linen bag — no floor contact',
      'Grab ONLY EXTERIOR of linen bag to close and tie',
    ],
    back: `1. Wash hands — full technique.
2. Don gloves.
3. ⭐ Grip edge of soiled linen and ROLL it — soiled surface INSIDE, rolling away from you. Keep away from clothing.
4. Carry rolled bundle and drop directly into linen bag. No floor contact.
5. Peel off gloves. Drop in waste container.
6. ⭐ Grab ONLY EXTERIOR of linen bag. Close and TIE SHUT (pinch and knot). Replace liner inside bag holder.
7. Wash and dry hands — full technique.
8. Carry tied bag to laundry area.`,
  },
  {
    num: 7, name: 'MOVING RESIDENT UP IN BED', supplies: 'None',
    criticals: [
      'Staggered stance: feet 12 inches apart, front foot toward head of bed',
      'One arm under SHOULDERS, one under HIPS',
      'Shift weight from BACK to FRONT foot on "three" (leg momentum, not arm strength)',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands.
3. Face-to-face. Explain procedure slowly.
4. Privacy (curtain/door).
5. Lock wheels. Raise side rails. FLATTEN bed completely (head + knee sections). Work height appropriate.
6. Remove pillow. Fan-fold linens to foot of bed (resident covered for privacy).
7. Ask resident to BEND KNEES — feet flat on mattress, knees up.
8. ⭐ Stand at SIDE of bed. Feet 12 INCHES APART in staggered stance — front foot pointing toward head of bed. Back straight. Bend at hips and knees (squat, not hunch).
9. ⭐ Slide one arm under SHOULDERS, other arm under HIPS.
10. ⭐ Count aloud "1, 2, 3" — tell resident to push feet into mattress and lift hips. On THREE: shift weight BACK FOOT to FRONT FOOT — use leg momentum to move resident up. No arm lifting.
11. Replace pillow. Check alignment — resident centered.
12. Lower bed to LOWEST position. Remove privacy. Side rails per order.
13. Call light within reach.
14. Wash hands.
15. Report changes to nurse. Document.`,
  },
  {
    num: 8, name: 'MOVING RESIDENT UP IN BED — TWO-PERSON ASSIST', supplies: 'Lift sheet, coworker',
    criticals: [
      'One person on EACH SIDE of bed, facing each other',
      'Both grip rolled lift sheet: palms DOWN, one hand at SHOULDER, one at HIP level',
      'Both count together and shift weight simultaneously on "three"',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain slowly.
3. Privacy.
4. ⭐ CALL COWORKER — one person on each SIDE of bed, facing each other.
5. Lock wheels. Raise to comfortable working HEIGHT (waist level). Flatten head + knee sections.
6. Remove pillow. Fan-fold linens to foot (resident covered).
7. Confirm or place LIFT SHEET under resident's shoulders and hips.
8. Both of you roll long sides of lift sheet INWARD toward resident — snug against body.
9. ⭐ Both reach across: grasp rolled edge with BOTH HANDS palms FACING DOWN. One hand at SHOULDER level, one at HIP level.
10. Ask resident to bend knees and feet flat if able.
11. ⭐ Both in staggered stance (feet 12 inches apart, front toward head of bed). Back straight, bend at hips/knees.
12. Count aloud together: "1, 2, 3" — BOTH shift weight front simultaneously, LIFTING lift sheet. Resident glides up on sheet.
13. Replace pillow. Check alignment.
14. Lower bed to LOWEST. Side rails per order.
15. Call light within reach.
16. Wash hands. Report. Document.`,
  },
  {
    num: 9, name: 'TURNING RESIDENT — AWAY & TOWARDS YOU', supplies: 'Pillows',
    criticals: [
      'Turning AWAY: one hand under SHOULDER, one under HIP — roll like a log away from you',
      'Turning TOWARD: place hands on FAR SHOULDER and FAR HIP — roll like a log toward you',
      'Feet 12 inches apart, knees slightly bent throughout',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain slowly. Privacy.
3. Lock wheels. Raise BOTH side rails. Raise bed to working height. Lower head section FLAT.
4. Fan-fold linens to foot (keeping resident covered for privacy).
5. Stand at side. Feet 12 INCHES APART, knees SLIGHTLY BENT.

— TURNING AWAY FROM YOU —
1. Cross resident's nearest arm OVER CHEST. Cross nearest leg OVER far leg (foot rests on bed).
2. ⭐ Slide one hand under NEAREST SHOULDER, other under NEAREST HIP. Back straight, bend at hips/knees. Roll resident AWAY — like rolling a log away from you.

— TURNING TOWARD YOU —
1. Go to FAR side of bed. Cross FAR ARM over CHEST. Move near arm out of the way. Cross FAR LEG over near leg.
2. ⭐ Place one hand on FAR SHOULDER, other on FAR HIP. Back straight, bend at hips/knees. Roll resident TOWARD YOU — controlled log roll.

— ENDING STEPS —
1. Return resident to BACK (supine). Straighten clothing. Smooth linens. Check tubes.
2. Lower bed to LOWEST. Side rails per order. Remove privacy.
3. Call light within reach.
4. Wash hands. Report changes. Document.`,
  },
  {
    num: 10, name: 'TURNING RESIDENT USING A TURN SHEET', supplies: 'Pillows, turn sheet, coworker',
    criticals: [
      'Move resident to OPPOSITE side first — gives room to roll into',
      'Cross arms over chest + cross away-leg over near leg before rolling',
      'Both grip rolled sheet at SHOULDER and HIP level — flip like a large fish with a net',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain slowly. Privacy.
3. Lock wheels. Raise BOTH side rails. Raise bed to working height. Flatten head section.
4. Fan-fold top linens. Place pillow at HEAD of bed.
5. ⭐ Gently shift resident to OPPOSITE SIDE of bed from turning direction (creates room to roll).
6. ⭐ Cross resident's arms over CHEST. Cross away-leg over near leg.
7. Roll edges of TURN SHEET inward on the side NOT being turned toward.
8. Both you and coworker grip rolled sheet — one at SHOULDER, one at HIP.
9. Alert resident and coworker: "Turning on three."
10. ⭐ On THREE — both backs straight, bending at hips/knees — use sheet as lever to ROLL resident to their side. Controlled, smooth, one direction.
11. Pillow under HEAD AND NECK (ear to shoulder).
12. Check spine alignment from foot of bed — straight line? Comfortable?
13. Straighten clothing, linens, recheck tubes.
14. Lower bed to LOWEST. Adjust siderails. Call light within reach.
15. Wash hands. Report. Document.`,
  },
  {
    num: 11, name: 'LATERAL POSITION — TURNING RESIDENT TOWARDS YOU', supplies: 'Pillows',
    criticals: [
      'Move resident to FAR side of bed first — gives rolling space toward you',
      'One hand on FAR SHOULDER, one on FAR HIP — roll toward you in one smooth motion',
      'Pillow BEHIND back (prevents rolling backward) + pillow BETWEEN knees',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise BOTH side rails. Raise bed. Flatten head section.
4. Fan-fold linens. Place pillow at HEAD of bed.
5. Stand at side you want resident to roll TOWARD. Feet 12 inches apart, knees slightly bent.
6. ⭐ Move resident to FAR side of bed — away from you (gives room to roll toward you).
7. Cross FAR ARM over chest. Tuck near arm safely. Cross FAR LEG over near leg.
8. ⭐ One hand on FAR SHOULDER, other on FAR HIP. Back straight. Bend at hips/knees. Roll resident SMOOTHLY TOWARD YOU in one controlled motion — on their side facing you.
9. ⭐ Slide pillow BEHIND resident's BACK (fills gap, prevents backward roll). Place pillow BETWEEN KNEES. Prop upper arm if needed.
10. Pillow under HEAD AND NECK (ear to shoulder).
11. Check spine alignment — neutral straight line? Top hip relaxed? Comfortable?
12. Adjust clothing, linens, tubing.
13. Lower bed to LOWEST. Side rails per order. Remove privacy.
14. Call light within reach. Wash hands. Report. Document.`,
  },
  {
    num: 12, name: 'LATERAL POSITION — TURNING RESIDENT AWAY FROM YOU', supplies: 'Pillows',
    criticals: [
      'Move resident to NEAR side first — gives rolling space away from you',
      'One hand under NEAR SHOULDER, one under NEAR HIP — roll away like a log',
      'Pillow BEHIND back + pillow BETWEEN knees after positioning',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise BOTH side rails. Raise bed. Flatten head section.
4. Fan-fold linens. Place pillow at HEAD of bed.
5. Stand at side. Feet 12 inches apart, knees slightly bent.
6. ⭐ Move resident to NEAR side of bed — closest to you (gives room to roll away).
7. Cross NEAREST ARM over chest. Cross NEAREST LEG over far leg.
8. ⭐ One hand UNDER NEAREST SHOULDER, other UNDER NEAREST HIP. Back straight, bend at hips/knees. Roll resident AWAY from you — smooth log roll to far side.
9. ⭐ Pillow BEHIND resident's BACK. Pillow BETWEEN KNEES. Support upper arm if needed.
10. Adjust pillow under HEAD AND NECK.
11. Check spine alignment — neutral? Top hip relaxed? Comfortable?
12. Adjust clothing, linens, tubing.
13. Lower bed. Side rails per order. Remove privacy.
14. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 13, name: 'PASSIVE RANGE OF MOTION (PROM)', supplies: 'None',
    criticals: [
      'Support limb on BOTH SIDES of the joint being moved at all times',
      'Move GENTLY, SLOWLY, SMOOTHLY — stop at FIRST RESISTANCE or ANY sign of pain',
      'Each movement performed AT LEAST 3 TIMES',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain each movement BEFORE doing it.
3. Privacy. Lock wheels. Raise side rails. Adjust to working height.
4. Resident lies FLAT SUPINE — head/spine/hips/legs aligned.
5. ⭐ Before every movement: support limb on BOTH SIDES of joint. Move GENTLY, SLOWLY, SMOOTHLY. Stop at RESISTANCE or any pain. Perform each move ≥3 TIMES.

SHOULDER (support elbow + wrist):
• Flexion: raise arm forward and up to 90°
• Extension: lower back to side
• Abduction: sweep arm out sideways to 90°
• Adduction: bring arm back to center

ELBOW (support wrist + elbow):
• Flexion: bend elbow — forearm to shoulder
• Extension: straighten back out flat
• Pronation: rotate palm DOWN
• Supination: rotate palm UP

WRIST (hold wrist steady, guide hand):
• Flexion: push fingers DOWNWARD
• Dorsiflexion: push fingers BACK toward forearm
• Radial: tilt toward thumb side
• Ulnar: tilt toward pinky side

THUMB: Abduction/Adduction/Opposition (touch each fingertip)/Flexion/Extension

FINGERS: Flexion (fist)/Extension (open)/Abduction (spread)/Adduction (close)

HIP (support knee + ankle):
• Abduction: slide leg OUT sideways
• Adduction: slide back across center
• Internal rotation: roll leg inward (toes toward other leg)
• External rotation: roll leg outward

KNEES (support under knee + ankle):
• Flexion: bend knee — heel toward buttocks
• Extension: straighten leg flat

ANKLES (cup heel + top of foot):
• Dorsiflexion: push top of foot UP toward shin ("toes to nose")
• Plantar flexion: push sole DOWN (ballet toe)
• Supination: sole rotates inward
• Pronation: sole rotates outward

TOES: Flexion/Extension/Abduction/Adduction

Ending:
• Comfortable position. Bed to LOWEST. Side rails per order.
• Call light. Wash hands.
• ⭐ Report any DECREASED range of motion or PAIN. Document noting stiffness/pain.`,
  },
  {
    num: 14, name: 'TRANSFERRING RESIDENT WITH MECHANICAL LIFT', supplies: 'Mechanical lift, sling, robe/slippers if used, chair/wheelchair',
    criticals: [
      'Lock WHEELCHAIR brakes — both sides click firmly before positioning',
      'Sling edge at BACK, bottom at BACK OF KNEES — spread fully like a hammock',
      'Raise ONLY 2 inches above mattress — pause before moving; LEAVE SLING IN CHAIR after transfer',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain slowly.
3. Privacy. Scan area — clear path, no furniture in way.
4. Lock all bed wheels. Raise BOTH side rails.
5. ⭐ Roll WHEELCHAIR to bedside. Press BOTH BRAKE LEVERS DOWN — wheels must not spin.
6. ⭐ Help resident turn toward you. Go to FAR side. Slide SLING under resident — edge at BACK, bottom at BACK OF KNEES. Roll resident back. Spread sling fully — hammock shape under them.
7. Roll lift to bedside. Widen base to WIDEST "V" position. Push base UNDER bed. Overhead bar directly above resident's torso.
8. ⭐ Attach sling loops/straps to overhead bar — one set per side. Check ALL connections. Fold resident's arms over chest.
9. Pump/electric control to RAISE resident. Stop 2 INCHES above mattress. PAUSE — let resident gain balance. Speak calmly.
10. Coworker stands on other side — guides and supports as lift rolls. Move until resident is DIRECTLY OVER wheelchair seat.
11. Slowly LOWER into chair. Coworker pushes DOWN on KNEES to guide proper seated position.
12. Unhook straps. LEAVE SLING IN PLACE — do not remove.
13. Hips fully back in chair seat. Remove privacy. Side rails per order.
14. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 15, name: 'ASSISTING RESIDENT TO AMBULATE', supplies: 'Nonskid shoes, gait belt',
    criticals: [
      'Gait belt over CLOTHING, snug — flat hand fits under, but NOT a fist',
      'Stand on WEAKER SIDE, slightly behind — hand on BACK of gait belt at all times',
      'Sit resident at edge of bed 1-2 minutes before standing — watch for dizziness',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain slowly.
3. Privacy. Lower bed to LOWEST. Lock wheels. Raise head. Help resident sit at edge — BOTH FEET FLAT on floor. PAUSE 1-2 minutes — watch for dizziness.
4. Apply NONSKID SHOES — both feet. Fasten completely.
5. Stand DIRECTLY IN FRONT. Feet shoulder-width apart.
6. ⭐ Wrap GAIT BELT around waist OVER clothing. Snug — flat hand fits, not fist. No pinched skin. Grasp BOTH SIDES with underhand grip (thumbs up).
7. Block resident's knees with your knees if needed. Bend your knees. Back straight.
8. Tell resident: "Lean forward, push hands into mattress. Stand on three." 1-2-3 — belt UP, shift weight, resident pushes. Rise TOGETHER.
9. ⭐ Pivot to stand BESIDE resident — NOT in front. Walk SLIGHTLY BEHIND and to the SIDE. Hand on BACK of gait belt at all times. Stand on WEAKER SIDE.
10. Watch feet, posture, breathing. "Eyes forward, not down."
11. Walk full ordered distance. Guide back. Lower safely. Remove belt. Check alignment.
12. Bed to lowest. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 16, name: 'ASSISTING TO AMBULATE — CANE', supplies: 'Gait belt, nonskid shoes, cane',
    criticals: [
      'Cane in STRONGER/UNAFFECTED hand',
      'Stand on WEAK SIDE, slightly behind — hand on BACK of gait belt',
      'Pattern: CANE FORWARD → WEAK STEP → STRONG STEP (repeat)',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lower bed to LOWEST. Lock wheels. Help sit at edge — feet flat.
4. Apply NONSKID SHOES. Fasten.
5. Stand directly in front. Gait belt over clothing, snug, underhand grip.
6. Help to standing (block knees if needed, count "1-2-3").
7. ⭐ Place CANE in resident's STRONGER/UNAFFECTED HAND. Handle facing up.
8. ⭐ Move to WEAK SIDE — slightly BEHIND. Grasp BACK of gait belt.
9. ⭐ Instruct cane walking pattern:
   • CANE FORWARD ~6 inches (tripod plant ahead)
   • WEAK LEG steps EVEN WITH cane tip
   • STRONG LEG steps PAST cane
   • REPEAT: CANE → WEAK → STRONG
10. Walk on weak side. Eyes forward. Call out obstacles.
11. Encourage rest if tired. Resident sets pace.
12. Return to bed/chair. Lower safely. Remove belt. Check alignment.
13. Bed to lowest. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 17, name: 'ASSISTING TO AMBULATE — WALKER', supplies: 'Gait belt, nonskid shoes, walker',
    criticals: [
      'Walker placed DIRECTLY IN FRONT — resident grasps both handles',
      'Stand on WEAK SIDE, slightly behind — hand on BACK of gait belt',
      'Pattern: WALKER FORWARD → WEAK STEP → STRONG STEP (ALL 4 feet on floor before stepping)',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lower bed to LOWEST. Lock wheels. Help sit at edge — feet flat.
4. Apply NONSKID SHOES. Fasten.
5. Stand directly in front. Gait belt over clothing, snug, underhand grip.
6. Help to standing (block knees if needed, count "1-2-3").
7. ⭐ Place WALKER directly IN FRONT of resident — grasp BOTH HANDLES.
8. ⭐ Move to WEAK SIDE — slightly BEHIND. Grasp BACK of gait belt.
9. ⭐ Instruct walker walking pattern:
   • LIFT/ROLL walker FORWARD ~6 inches
   • ALL FOUR FEET firmly on floor before stepping (no rocking/tipping)
   • WEAK LEG steps FORWARD into walker space
   • STRONG LEG steps EVEN WITH or past weak leg
   • REPEAT: WALKER FORWARD → WEAK → STRONG
10. Walk on weak side. Eyes forward. Watch for obstacles.
11. Encourage rest if tired. Resident sets pace.
12. Return. Lower safely. Remove belt. Check alignment.
13. Bed to lowest. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 18, name: 'TRANSFERRING BED TO CHAIR/WHEELCHAIR', supplies: 'Chair/wheelchair, gait belt, nonskid footwear, robe or blanket',
    criticals: [
      'Wheelchair on STRONG SIDE at foot of bed, diagonal to bed, ARM nearly touching — BOTH brakes locked',
      'Gait belt snug over clothing — flat hand fits under, block knees on "three"',
      'Guide until BACKS OF LEGS touch wheelchair seat edge before lowering',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy. Clear path.
3. Lock bed wheels. Raise head of bed fully — resident sitting upright. Lower bed to LOWEST — feet flat.
4. Help swing legs to edge — sit upright. BOTH FEET FLAT on floor. PAUSE 1-2 min — watch for dizziness.
5. ⭐ Position wheelchair at FOOT of bed, angled diagonally facing head of bed, on resident's STRONG SIDE. Arm nearly touching bed side. Press BOTH BRAKE LEVERS — wheels locked.
6. Flip up or remove footrest on side nearest bed.
7. ⭐ CONFIRM both wheelchair wheels locked — try pushing.
8. Apply NONSKID SHOES — both feet. Fasten.
9. Stand DIRECTLY IN FRONT. Feet shoulder-width.
10. ⭐ Wrap GAIT BELT over clothing. Snug — flat hand fits. Check no pinched skin. Underhand grip, thumbs up.
11. Tell resident: "Push off bed with hands and lean forward." Press your knees against theirs. Back straight, bend at hips/knees. "1-2-3" — gait belt UP, resident pushes — RISE TOGETHER.
12. Guide small shuffling steps — resident rotates back toward wheelchair until BACKS OF LEGS touch seat front edge.
13. Resident grasps BOTH ARMRESTS. Slowly LOWER into chair — bend your knees, gait belt guides descent.
14. Slide hips fully AGAINST SEAT BACK. Flip footrests. Place feet on rests. Check alignment. Remove belt.
15. Remove privacy. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 19, name: 'TRANSFERRING WHEELCHAIR TO TOILET', supplies: 'Toilet, gait belt, gloves',
    criticals: [
      'STRONG SIDE nearest toilet — resident pivots on strong side',
      'Block resident\'s knees with yours — feet outside theirs — prevent buckling',
      'Pivot on STRONG SIDE until backs of legs touch toilet edge, then lower',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy — close bathroom door.
3. ⭐ Roll wheelchair next to toilet — STRONG SIDE nearest toilet (pivot on that side). Lock wheelchair. Swing/remove footrests. BOTH FEET FLAT on floor.
4. Gait belt around waist over clothing. Snug. Adjust clothing for toileting.
5. ⭐ Stand FACING resident. Feet 12 inches apart, placed OUTSIDE and alongside resident's feet. Bend knees — your knees/shins against FRONT of resident's knees (blocking buckling). Grasp gait belt underhand, thumbs up. Back straight.
6. "1-2-3" — resident leans forward, pushes off armrests. You pull belt UPWARD and slightly toward you. Rise to standing.
7. ⭐ PIVOT on STRONG SIDE toward toilet — small shuffling steps. Guide until BACKS OF LEGS touch FRONT EDGE of toilet. Centered in front of bowl.
8. Resident grasps GRAB BARS on both sides. Adjust clothing. Slowly LOWER onto seat — bend YOUR knees, gait belt guides descent.
9. Call light within arm's reach. CLOSE bathroom door.
10. Stay NEARBY. Re-enter when signaled.
11. Gloves on. While standing: perineal care — FRONT TO BACK. Pat dry.
12. Remove gloves. Adjust clothing.
13. REVERSE procedure — gait belt, "1-2-3", pivot on strong side, lower into wheelchair.
14. Remove privacy. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 20, name: 'MEASURING HEIGHT AND WEIGHT (AMBULATORY)', supplies: 'Scale',
    criticals: [
      'Balance bar must FLOAT LEVEL at zero before resident steps on',
      'Read weight: large slider first (dip then back 1 notch), then small slider until bar floats — must be within 1 LB',
      'Read height at horizontal arm — must be accurate within ¼ INCH; help resident step off BEFORE recording',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Check resident's nonskid shoes — on and fastened. Walk to scale.
4. ⭐ Check balance bar — must FLOAT LEVEL. If off, slide BOTH indicators to ZERO — bar should level.
5. Help resident step ONTO scale platform, facing AWAY from readout.
6. ⭐ Move LARGE slider right (in increments) until bar dips DOWN, then back ONE notch. Move SMALL slider right (small increments) until bar FLOATS LEVEL — hovering in middle. READ both numbers and ADD TOGETHER = weight. Must be within 1 LB.
7. Resident stands STRAIGHT AND TALL — chin level, eyes forward.
8. Pull UP measuring rod from back of scale. Slowly LOWER horizontal arm until it rests FLAT on TOP of head.
9. ⭐ Read measurement where arm meets rod. Must be within ¼ INCH.
10. ⭐ BEFORE recording: help resident STEP OFF SCALE SAFELY. Hold arm. Rod doesn't swing down on them.
11. Wash hands. Call light. WRITE DOWN height AND weight.
12. Report changes to nurse.`,
  },
  {
    num: 21, name: 'TUB BATH', supplies: 'Towels, bath blanket, washcloths, soap, shampoo, lotion, clean clothing, gloves, tub chair, bath thermometer, safety straps',
    criticals: [
      'Fill tub HALF FULL, 104-105°F — resident tests temperature themselves',
      'Safety straps ALL fastened on tub chair — tug each to confirm secure',
      'Clean CLEANEST TO DIRTIEST: Eyes → Face/Neck/Ears → Arms/Armpits → Chest/Abdomen → Legs/Feet → Back/Buttocks → Perineal Care',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Prepare tub room FIRST — clean tub, dry floor, air temperature OK.
4. Offer toilet. Assist if needed.
5. Walk/wheel resident and supplies to tub room.
6. ⭐ Fill tub HALF FULL with WARM water. Thermometer: 104–105°F. Guide resident's hand to water — THEY test it. Add cleanser if used. Gloves on.
7. Help undress. Drape TOWEL over groin and TOWEL over shoulders (covered and warm).
8. ⭐ Help resident into TUB CHAIR. FASTEN ALL SAFETY STRAPS — click or velcro each. TUG each to confirm secure.
9. Use lift mechanism per facility — lower chair into tub. Stay right next to resident.
10. Allow self-washing where able. Keep privacy towels. STAY IN ROOM.
11. Wash face first — eyes, face, neck.
12. Whirlpool 5 min if present and desired.
13. Shampoo hair if needed.
14. ⭐ Washcloth MITT. Wash CLEANEST to DIRTIEST order:
    EYES (no soap, inner→outer, fresh section per eye) → FACE/NECK/EARS → ARMS/ARMPITS (shoulder→wrist) → CHEST/ABDOMEN → LEGS/FEET (between toes) → BACK/BUTTOCKS → PERINEAL CARE (change gloves)
15. Drain. Raise chair out of tub per facility procedure.
16. Drape towels/bath blanket — resident fully covered. Remove gloves.
17. Pat DRY every surface — folds, between toes, under breasts, armpits.
18. Apply deodorant, lotion, powder per preference. Back massage if in care plan.
19. Help into clean clothing. Return resident and supplies to room.
20. Call light. Wash hands. Report. Document.
21. Return to tub room. Gloves. Linens in hamper. Disinfect ALL tub and chair surfaces completely.`,
  },
  {
    num: 22, name: 'SHOWER', supplies: 'Towels, washcloths, soap, shampoo, clean clothing, gloves, shower chair if needed, bath thermometer',
    criticals: [
      'Temperature 105°F — resident tests spray before positioned under it',
      'Monitor temperature THROUGHOUT shower',
      'Clean CLEANEST TO DIRTIEST (same order as tub bath)',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Prepare shower room FIRST — clean floor/walls, air temp, chair if needed.
4. Offer toilet. Assist if needed.
5. Walk/wheel resident and supplies. Help undress.
6. ⭐ Turn ON water. Thermometer under stream — stabilize at 105°F. Hold resident's hand near spray — THEY test before positioning under it. Monitor temp throughout.
7. Position resident. Cover genitalia with towel. Rinse body down completely. Gloves on.
8. Let resident self-wash where able. Soap/washcloth within reach. STAY in room.
9. Help wash face. Shampoo hair if needed.
10. ⭐ Washcloth MITT. Wash CLEANEST to DIRTIEST:
    EYES (no soap, inner→outer, fresh section per eye) → FACE/NECK/EARS → ARMS/ARMPITS → CHEST/ABDOMEN → LEGS/FEET (between toes) → BACK/BUTTOCKS → PERINEAL CARE
11. Turn OFF water. Immediately wrap with towels. Remove gloves.
12. Pat ALL surfaces dry — folds, between toes, armpits, under breasts.
13. Back massage if indicated. Help dress. Remove gloves.
14. Return resident and supplies to room.
15. Call light. Wash hands. Report. Document.
16. Return to shower room. Gloves on. Linens in hamper. Disinfect shower and chair completely.`,
  },
  {
    num: 23, name: 'PARTIAL BATH', supplies: 'Washbasin, towels, washcloths, soap, clean clothing, gloves, bath thermometer',
    criticals: [
      'Basin 2/3 full, ≤105°F — resident tests with hand',
      'Uncover ONLY body part being washed; towel UNDER it',
      'Partial bath covers: FACE, ARMPITS, HANDS, and PERI CARE',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. ⭐ Fill WASHBASIN 2/3 FULL. Thermometer — ≤105°F. Carry to overbed table. Guide resident's fingers to water — THEY test. Adjust if needed.
4. Lock wheels. Adjust bed. Gloves on.
5. ⭐ Fold back linens ONLY to uncover body part being washed. Place TOWEL UNDER that part as a mat.
6. Wash, rinse, dry one part at a time. Partial bath = FACE, ARMPITS, HANDS, PERI CARE.
7. ⭐ EYES: no soap, fresh cloth section, inner→outer corner, one stroke per eye. Rinse, pat dry.
8. FACE: center outward strokes — forehead, cheeks, nose, mouth last. Ears and neck. Rinse. Pat dry.
9. ARMPITS and HANDS (far arm first). Rinse. Pat dry.
10. DUMP and REFILL basin after armpits — same temp check.
11. Reapply gloves. PERI CARE per procedure.
12. Remove gloves. Wash hands.
13. Help into clean gown. Grooming. Remove bath blanket, restore bedding.
14. Soiled items in proper containers.
15. Change gloves. Wash hands. Bed to LOWEST. Side rails per order. Remove privacy.
16. Call light. Empty/rinse/dry basin. Return to storage. Discard gloves. Wash hands. Report. Document. Note skin changes.`,
  },
  {
    num: 24, name: 'COMPLETE BED BATH', supplies: 'Washbasin, bath blanket, towels, washcloths, soap, clean clothing, gloves, bath thermometer, lotion, orangewood stick',
    criticals: [
      'Basin ≤105°F — wrist test + resident tests; change water when cool/soapy/dirty',
      'Bath blanket covers resident ENTIRELY — expose and re-cover ONE body part at a time',
      'Order: HEAD DOWN, front first — Eyes/Face/Neck → Arms/Hands → Chest → Abdomen → Legs/Feet → Back → Perineal',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy. Warm room, no drafts.
3. ⭐ Fill basin 2/3 FULL. Thermometer — ≤105°F. Wrist test + RESIDENT tests. Change water when cool/soapy/dirty.
4. Lock wheels. Raise side rails. Adjust bed. Gloves on.
5. ⭐ Drape BATH BLANKET over entire resident. Resident holds it. Pull top linens OUT from under — fan-fold to foot. Remove clothing under blanket. Bath blanket = only covering.
6. Uncover ONE body part at a time. Towel under each part. Re-cover before moving on.
7. Wash HEAD DOWN, front first. Use FRESH cloth section every stroke.

EYES/FACE/EARS/NECK: No soap for eyes; inner→outer per eye. Face: center outward. Rinse, dry.
ARMS/ARMPITS: Far arm first, shoulder→wrist, wash armpit. Rinse, dry, re-cover. Repeat near arm.
HANDS: Far hand — soap palm/back/each finger. Orangewood stick under nails. Rinse, dry (fully between fingers). Lotion on elbow + hand. Repeat near hand.
CHEST: Towel horizontally over chest. Blanket to waist. Wash under towel — including under breasts (check folds for irritation). Rinse, dry.
ABDOMEN: Towel over chest. Blanket just above pubic area. Wash abdomen. Rinse, dry. Cover, remove towel.
LEGS/FEET: Far leg only — blanket away. Towel lengthwise. Thigh→knee→ankle→foot. Between toes completely dry. Lotion on heels (NOT between toes). Re-cover. Near leg.
BACK: Roll resident toward far rail. Blanket away from back. Towel along spine. Long downward strokes neck→buttocks. Rinse, dry, lotion if ordered.
PERINEAL: Towel under buttocks. Roll to back. If resident CAN self-care — set up basin/cloth/towel, call light, privacy. If CANNOT — change gloves, fresh basin, perform peri care (Skills 25/26).

8. Change gloves and wash hands.
9. Deodorant. Fresh towel over pillow. Comb hair. Clean clothing. Comfortable alignment.
10. ⭐ Remove bath blanket, replace with regular blanket in one smooth motion.
11. Bed to LOWEST. Side rails per order. Remove privacy.
12. Call light. Empty/rinse/dry basin. Remove gloves. Wash hands. Report. Document skin issues.`,
  },
  {
    num: 25, name: 'MALE PERINEAL CARE', supplies: 'Gloves, washbasin, washcloths, towels, bath blanket, bed protector, plastic bag',
    criticals: [
      'If uncircumcised: RETRACT foreskin to clean; REPLACE to normal position after — critical for circulation',
      'Wash in SPIRAL CIRCLES from TIP toward BASE — new cloth section each circle',
      'Front-to-back for perineum/anal area — one stroke per section, used cloth goes into bag (NEVER back in basin)',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy. Warm room.
3. ⭐ Fill basin 2/3 FULL. ≤105°F. Wrist test + resident tests.
4. Lock wheels. Raise side rails. Adjust bed. Gloves on.
5. ⭐ Bath blanket over resident. Pull regular linens out from under. Fold blanket UP from bottom — expose GENITALIA ONLY. Resident bends KNEES, feet flat on mattress.
6. Bed protector under hips/buttocks if needed.
7. ⭐ Dip cloth, apply soap, form MITT. New section per EVERY stroke. Used sections into plastic bag — NEVER back in basin or on bed.
8. Check all surfaces — redness, open areas, rashes, swelling?
9. If uncircumcised: gently RETRACT foreskin toward base to expose glans.
10. Hold shaft gently steady.
11. ⭐ Wash SPIRAL CIRCLES starting at TIP (meatus) working toward BASE — new cloth section per circle.
12. Rinse same way (tip to base). Pat DRY same direction.
13. ⭐ If uncircumcised: gently REPLACE FORESKIN to normal position covering glans — CRITICAL, prevents circulation cutoff.
14. Fresh section — wash SCROTUM (all folds) and GROIN (inner thigh areas). Rinse. Pat dry.
15. Cover with bath blanket. Roll resident to side — back facing you.
16. If feces: toilet tissue to remove. Drop in bag. Change gloves + wash hands.
17. ⭐ PERINEUM first, then ANAL area — FRONT TO BACK, one stroke per section.
18. RINSE front to back. Into bag. Pat dry.
19. Peri cream if ordered (change gloves first; nurse applies if for skin breakdown).
20. Apply incontinent brief if used. Remove bed protector.
21. Change gloves + wash hands. Comfortable position. Adjust clothing/linens.
22. Bed to LOWEST. Side rails per order. Remove privacy.
23. Call light. Empty/rinse/dry basin. Remove gloves. Wash hands. Report. Document.`,
  },
  {
    num: 26, name: 'FEMALE PERINEAL CARE', supplies: 'Gloves, washbasin, washcloths, towels, bath blanket, bed protector, plastic bag',
    criticals: [
      'Separate labia with non-dominant hand throughout entire washing process',
      'ALWAYS FRONT-TO-BACK — NEVER reverse direction (prevents spreading bacteria to urethra)',
      'One stroke per cloth section — used cloth directly into plastic bag, NEVER back in basin',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy. Warm room.
3. ⭐ Fill basin 2/3 FULL. ≤105°F. Wrist + resident test.
4. Lock wheels. Raise side rails. Adjust bed. Gloves on.
5. ⭐ Bath blanket over resident. Pull regular linens out. Fold blanket UP from bottom — expose GENITALIA ONLY. Assist resident to BEND KNEES and SEPARATE LEGS.
6. Bed protector under hips if needed.
7. ⭐ Dip cloth, apply soap, form MITT. New section per EVERY stroke. Into plastic bag — NEVER back in basin.
8. Check all surfaces — drainage, bleeding, redness, swelling, unusual odor?
9. ⭐ Non-dominant hand GENTLY SEPARATES LABIA — hold apart throughout.
10. ⭐ ONE SMOOTH DOWNWARD STROKE — from ABOVE URETHRA, OVER urethra, through perineum toward anus. Refold cloth each stroke.
11. Wash LABIA — downward strokes alternating left/right.
12. ⭐ FRONT TO BACK only — each stroke fresh cloth section. NEVER vagina ← anus direction. Into bag.
13. RINSE same areas — clean wet cloth, same front-to-back direction.
14. Pat dry FRONT TO BACK.
15. If incontinent: wash MONS and lower abdomen.
16. Roll resident to side — back toward you. Only expose buttocks.
17. If feces: toilet tissue, change gloves, wash hands.
18. ⭐ PERINEUM first then ANAL area — FRONT TO BACK. One stroke per section. Into bag.
19. Rinse. Pat dry.
20. Peri cream if ordered (change gloves; nurse if treating skin breakdown).
21. Brief if used. Remove bed protector.
22. Change gloves + wash hands. Comfortable position. Adjust clothing/linens.
23. Bed to LOWEST. Side rails per order. Remove privacy.
24. Call light. Empty/rinse/dry basin. Remove gloves. Wash hands. Report. Document.`,
  },
  {
    num: 27, name: 'PROVIDING CATHETER CARE', supplies: 'Gloves, washbasin, washcloths, towels, bed protector',
    criticals: [
      'Hold catheter NEAR meatus — keep it still, do NOT pull or tug',
      'Clean AT LEAST 4 INCHES of catheter starting AT meatus, stroking AWAY (one direction only)',
      'RINSE then DRY same 4+ inches, same outward direction — never stroke back toward meatus',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. ⭐ Fill basin with warm water. Wrist test — ≤105°F. Resident check.
4. Lock wheels. Raise side rails. Adjust bed. Lower head flat.
5. Fold covers back. Drape BATH BLANKET.
6. Gloves on. Resident bends knees, pushes up hips — slide BED PROTECTOR under buttocks.
7. Fold bath blanket just enough to access catheter. Towel/pad UNDER catheter tubing (clean working surface).
8. Dip cloth, apply SOAP. Find MEATUS (opening where catheter enters body).
9. Wash skin AROUND meatus with small strokes, new section per stroke.
10. ⭐ One hand HOLDS catheter near meatus — STEADY, firm but not bending. Do NOT pull or tug.
11. ⭐ Other hand cleans AT LEAST 4 INCHES of catheter — starting AT meatus, stroke OUTWARD/AWAY in one direction only. New cloth section per stroke. NEVER stroke back toward meatus.
12. RINSE skin around meatus with clean cloth. Pat dry.
13. ⭐ RINSE AT LEAST 4 INCHES of catheter — starting at meatus, moving away. New section per stroke.
14. ⭐ DRY AT LEAST 4 INCHES of catheter — starting at meatus, moving away. No tugging.
15. Remove towel/pad. Change gloves + wash hands. Replace top sheet, remove bath blanket.
16. Bed to LOWEST. Side rails per order. Remove privacy.
17. Call light. Carry basin to bathroom — empty, clean, store.
18. Remove gloves. Wash hands. Report. Document.`,
  },
  {
    num: 28, name: 'EMPTYING URINARY DRAINAGE BAG', supplies: 'Graduate, alcohol wipes, paper towels, gloves',
    criticals: [
      'Drain spout tip must NOT touch sides of graduate while emptying',
      'After draining: wipe drain spout with ALCOHOL WIPE (all surfaces), then slide back into holder',
      'Read graduate with EYES LEVEL to measurement line — note color, clarity, odor',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain briefly.
3. Privacy. Gloves on.
4. Lay PAPER TOWEL flat on floor beneath drainage bag. Set GRADUATE on it directly under drain spout.
5. ⭐ Find drain spout at bottom of bag. Open CLAMP — urine flows DOWN into graduate. Tip of spout must NOT touch sides of graduate — hover above opening.
6. ⭐ When bag is empty and flow stops: CLOSE CLAMP. Open ALCOHOL WIPE — wipe DRAIN SPOUT thoroughly (tip, sides, every surface). Slide spout back into its sleeve/holder on bag.
7. ⭐ Carry graduate LEVEL to bathroom. Set on flat surface. CROUCH — eyes at MEASUREMENT LINE. Read at BOTTOM of liquid curve (meniscus). Note: COLOR, CLARITY, ODOR.
8. Empty graduate into toilet. Flush. Rinse graduate with clean water. Dry. Return to storage. Discard paper towels.
9. Remove gloves. Wash hands.
10. Write AMOUNT and CHARACTERISTICS (color, clarity, odor).`,
  },
  {
    num: 29, name: 'MEASURING AND RECORDING URINARY/FLUID OUTPUT', supplies: 'Graduate, gloves',
    criticals: [
      'Crouch so eyes are LEVEL with measurement marks — read at bottom curve (meniscus)',
      'Must be accurate within 25 mL',
      'Wash hands BEFORE walking to documentation area',
    ],
    back: `1. Knock. Wait. Wash hands.
2. ⭐ Gloves ON before touching bedpan or urinal.
3. Carry to bathroom. POUR contents carefully into graduate — tip gently, avoid splashing.
4. ⭐ Set graduate on FLAT SURFACE. CROUCH — eyes LEVEL with measurement markings. Read at BOTTOM of liquid curve (meniscus). Write down amount. Convert to mL if in oz. Must be within 25 mL accuracy.
5. Empty graduate into toilet. No splashing.
6. RINSE graduate with clean water. Pour rinse into toilet.
7. RINSE bedpan or urinal. Pour rinse into toilet. FLUSH.
8. Place graduate and bedpan/urinal in proper cleaning area or wash and return.
9. Remove gloves.
10. ⭐ Wash hands BEFORE walking to documentation area.
11. On I&O sheet — write TIME and AMOUNT in OUTPUT column.
12. Report changes to nurse.`,
  },
  {
    num: 30, name: 'MEASURING & RECORDING BLOOD PRESSURE (ONE-STEP)', supplies: 'Sphygmomanometer, stethoscope, alcohol wipes',
    criticals: [
      'Arrow/center marker over BRACHIAL ARTERY, bottom edge 1–1½ inches ABOVE inner elbow bend',
      'First distinct TAPPING SOUND = SYSTOLIC (top number)',
      'Sound DISAPPEARS = DIASTOLIC (bottom number); must be accurate within 4 BPM',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Wipe stethoscope EARPIECES and DIAPHRAGM with alcohol wipe.
4. Roll sleeve — entire upper arm bare, no clothing bunched under cuff.
5. Arm resting PALM UP at heart level.
6. Deflate cuff completely — open valve (counterclockwise), squeeze all air out.
7. ⭐ Wrap cuff around UPPER ARM — center marker/arrow over BRACHIAL ARTERY (inner arm, thumb side). Bottom edge 1–1½ INCHES ABOVE inner elbow bend. Snug but one finger fits under.
8. ⭐ Find BRACHIAL PULSE: 2–3 fingertips on inner elbow crease (thumb side). Feel regular tapping.
9. Stethoscope earpieces IN (angled forward toward nose). DIAPHRAGM over brachial pulse.
10. Close valve (clockwise). Pump bulb to 160–180 mmHg (or up to 200 if you hear immediate beats when deflating).
11. Open valve very slightly — needle falls SLOWLY, 2–3 mmHg/sec.
12. ⭐ Listen: first DISTINCT TAPPING SOUND out of silence = SYSTOLIC pressure. Memorize number.
13. Continue listening. Tapping softens then DISAPPEARS = DIASTOLIC pressure. Memorize number.
14. ⭐ Open valve fully — needle to ZERO. Remove cuff.
15. Call light. Wipe stethoscope. Wash hands. Store equipment.
16. ⭐ Record as FRACTION: SYSTOLIC/DIASTOLIC (e.g., 122/78). Note arm used (RA or LA). Within 4 BPM.
17. Report changes to nurse.`,
  },
  {
    num: 31, name: 'DRESSING A RESIDENT', supplies: 'Resident\'s chosen clothing, nonskid shoes',
    criticals: [
      'Let RESIDENT CHOOSE what to wear',
      'TOP: neck opening first, then WEAKER ARM in sleeve, then stronger — smooth back of shirt last',
      'PANTS: WEAKER LEG through opening first; SOCKS: toe opening first, unroll up — heel pocket OVER heel',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. ⭐ Ask resident what they want to wear — let THEM choose.
4. Lock wheels. Raise side rails. Adjust bed. Raise head — resident sitting UP.
5. ⭐ Bath blanket over resident. Pull top linens to foot. Remove clothing from STRONGER SIDE FIRST, then weaker side.
6. ⭐ PULLOVER TOP: scrunch top, guide NECK OPENING over head first. Reach into WEAK SIDE sleeve, grasp weak hand, pull through. Then strong arm. Lean forward — smooth back down.
   FRONT-FASTENING TOP: WEAK arm first into sleeve. Bring shirt around back. STRONG arm in. Fasten front.
7. ⭐ PANTS: WEAK LEG through opening FIRST. Then strong leg. Slide up as far as possible. Resident pushes hips UP — pull pants over buttocks and up to waist (or roll side to side). Fasten.
8. ⭐ SOCKS (start with WEAK FOOT): roll sock inside-out down to toe. Stretch toe opening. Resident's toes in. Unroll up foot and over heel — HEEL POCKET exactly over heel. No twists or ridges.
9. SHOES (WEAK foot first): open fully, guide toe in, ease heel in. Fasten completely.
10. Check — right-side-out, flat, buttons/zippers closed, waistband proper. Remove bath blanket.
11. Bed to LOWEST. Side rails per order. Remove privacy.
12. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 32, name: 'UNDRESSING A RESIDENT', supplies: 'Bath blanket, clean gown if needed',
    criticals: [
      'Bath blanket on FIRST — work under it throughout for privacy',
      'FRONT-FASTENING: remove STRONG side first, then weak',
      'PANTS: resident lifts hips — slide pants down and off; if unable, roll side to side',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise side rails. Adjust bed.
4. ⭐ Drape BATH BLANKET over resident — shoulders to feet. Reach under, fan-fold TOP LINENS to foot. Bath blanket = only covering.
5. Reach under blanket to assist. Let resident do as much as possible.
6. Reach under and undo all BUTTONS, ZIPPERS, SNAPS, VELCRO.
7. ⭐ FRONT-FASTENING TOP: slide off STRONG SIDE first (down strong arm and off). Then bring garment over toward WEAK SIDE and off.
   PULLOVER: raise head of bed slightly. Pull shirt up to chest. STRONG ARM off first. Over back to neck. WEAK ARM off. Pull over HEAD.
8. ⭐ PANTS: unfasten waistband. RESIDENT LIFTS HIPS by pressing hands/feet into mattress. Slide pants AND undergarment DOWN past hips, down legs, off feet. If CANNOT lift — ROLL to one side, pull down on that side, roll to other side, pull down, slide off.
9. Help into clean gown if needed. Remove bath blanket, replace with regular blanket.
10. Bed to LOWEST. Side rails per order. Remove privacy.
11. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 33, name: 'APPLYING ELASTIC SUPPORT STOCKINGS', supplies: 'Elastic support stockings',
    criticals: [
      'Gather stocking DOWN to heel area (inside-out) before putting on',
      'HEEL POCKET must align exactly over resident\'s heel',
      'Check completed stocking: ANY wrinkle, fold, or twist = problem (cuts circulation) — smooth completely',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise side rails. Adjust bed.
4. Resident lies SUPINE flat. Remove socks/shoes. Fold blanket away from ONE LEG ONLY.
5. ⭐ Gather stocking — push hands toward toe end, scrunching it inside-out down to HEEL AREA. Like scrunching a tube sock to just the foot section.
6. ⭐ Stretch toe opening. Slide resident's TOES in, then full foot. HEEL POCKET directly over resident's HEEL.
7. ⭐ Unroll stocking UP the leg — smooth as you go. Calf, over knee, up thigh.
8. ⭐ INSPECT entire stocking — run hands over it. ANY wrinkle, fold, or twist = circulation problem. Fix completely. Heel pocket over heel? Toe opening positioned per manufacturer?
9. Cover leg. Repeat steps 4–8 for OTHER LEG.
10. Bed to LOWEST. Side rails per order.
11. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 34, name: 'CHANGING INCONTINENT BRIEFS', supplies: 'Gloves, clean incontinent brief, bed protector, peri care supplies',
    criticals: [
      'Roll soiled brief INWARD ON ITSELF — soiled surface folded inside — before disposing',
      'Complete PERINEAL CARE before applying clean brief',
      'Fasten tabs snug but not tight — two fingers should fit under waistband',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise side rails. Adjust bed. Gloves on.
4. Fold back sheet/blanket to expose brief. Pull apart side TABS (both sides).
5. Grab FRONT PANEL — roll DOWNWARD from waistband toward groin then between legs.
6. ⭐ Before fully removing: cover perineal area with TOWEL. Keep resident covered.
7. Roll resident so BACK IS TOWARD YOU (onto side, away from you).
8. ⭐ Grab soiled brief — ROLL INWARD ON ITSELF (soiled surface folds inside). Dispose per policy.
9. While resident on side: complete PERINEAL CARE (Skills 25 or 26).
10. Change gloves + wash hands.
11. Unfold CLEAN BRIEF. Hold by BACK PANEL. Slide back panel under resident's buttocks — back half positioned behind them.
12. Roll resident BACK onto back — they lie on back half of brief. Pull FRONT PANEL up between legs over groin. Smooth flat.
13. ⭐ FASTEN TABS both sides — snug but not tight (two fingers under waistband).
14. Restore clothing and linens. Remove gloves.
15. Bed to LOWEST. Side rails per order. Call light. Wash hands. Report. Document.`,
  },
  {
    num: 35, name: 'ASSISTING INDEPENDENT RESIDENT WITH BEDPAN', supplies: 'Bedpan, bed protector, gloves, toilet paper',
    criticals: [
      'Resident lifts hips on "three" — slide BED PROTECTOR then BEDPAN into position',
      'Standard pan: wider end under BUTTOCKS; Fracture pan: handle toward FOOT, flat lip under buttocks',
      'Leave room and close door for privacy — resident calls when done',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise side rails. Bed to WAIST HEIGHT. Lower head of bed FLAT.
4. Gloves on. Bath blanket over resident. Pull top linens down. Remove undergarments under blanket.
5. "Lift hips on three — push feet and hands into mattress. 1-2-3." Resident rises.
6. ⭐ Slide BED PROTECTOR under buttocks. Then slide BEDPAN into position:
   • STANDARD: wider end under BUTTOCKS
   • FRACTURE PAN: handle toward FOOT, flat elevated lip under buttocks
7. Discard gloves. Wash hands.
8. ⭐ RAISE head of bed to comfortable semi-sitting position. Pillows if needed. Leave side rails up. Bed to LOWEST.
9. Bath blanket covering. Toilet paper within reach. Call light in resident's DOMINANT HAND. "I'll step out — press when done." CLOSE DOOR.
10. When called: return. Wash hands. CLEAN GLOVES.
11. Raise bed. Lower head to FLAT. Keep resident covered.
12. ⭐ "Lift hips — 1-2-3." Resident rises. Slide bedpan STRAIGHT OUT keeping LEVEL. Cover immediately.
13. Peri care if needed — FRONT TO BACK. Change gloves. Help with undergarments. Restore linens.
14. Remove bed protector. Discard supplies. Linens in hamper. Change gloves. Wash hands.
15. Bed to LOWEST. Side rails per order. Remove privacy. Call light.
16. Carry covered bedpan to bathroom. Note COLOR, ODOR, CONSISTENCY. Empty slowly along toilet bowl edge.
17. Turn on faucet with paper towel. Rinse bedpan with COLD WATER. Empty. Flush. Store.
18. Remove gloves. Wash hands. Report. Document.`,
  },
  {
    num: 36, name: 'ASSISTING DEPENDENT RESIDENT WITH BEDPAN', supplies: 'Bedpan, bed protector, gloves, toilet paper',
    criticals: [
      'Roll resident TOWARD you, position bedpan against buttocks, push far edge INTO mattress — roll resident BACK onto bedpan',
      'Removing: hold bedpan FLAT, roll resident BACK ONTO SIDE toward you — they roll OFF bedpan',
      'Note COLOR, ODOR, CONSISTENCY before emptying',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise side rails. Bed to WAIST HEIGHT. Lower head FLAT.
4. Gloves on. Bath blanket over resident. Pull top linens down. Remove undergarments under blanket.
5. ⭐ Roll resident TOWARD YOU — onto side, facing you. Back exposed. Bed protector if needed.
6. ⭐ Position bedpan AGAINST their BUTTOCKS. Push FAR EDGE OF BEDPAN DOWN INTO MATTRESS. Roll resident BACK onto back — they roll ONTO bedpan, now directly under buttocks.
7. Discard gloves. Wash hands.
8. Raise head to semi-sitting. Pillows if needed. Side rails up. Bed to LOWEST. Bath blanket covering. Toilet paper + call light within reach. CLOSE DOOR.
9. When signaled: return. Wash hands. CLEAN GLOVES. Raise bed. Lower head FLAT.
10. ⭐ CANNOT raise hips: hold BEDPAN FLAT with one hand. Roll resident TOWARD YOU — they roll OFF bedpan. Slide bedpan out. COVER immediately.
11. Peri care — FRONT TO BACK. Change gloves. Help with undergarments. Restore linens.
12. Remove bed protector. Discard supplies. Linens in hamper. Change gloves. Wash hands.
13. Bed to LOWEST. Side rails per order. Remove privacy. Call light.
14. Carry covered bedpan to bathroom. Note COLOR, ODOR, CONSISTENCY. Empty slowly, no splashing.
15. Faucet with paper towel. Rinse with COLD WATER. Empty. Flush. Store.
16. Remove gloves. Wash hands. Report. Document.`,
  },
  {
    num: 37, name: 'ASSISTING MALE RESIDENT WITH URINAL', supplies: 'Urinal, bed protector, gloves',
    criticals: [
      'If unable to self-position: guide PENIS INTO urinal opening while gloved — replace covers over urinal',
      'Raise head of bed slightly for urination — then lower to LOWEST',
      'Note COLOR, ODOR, QUALITY before emptying; rinse with COLD WATER',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise side rails. Adjust bed. Gloves on.
4. Slide BED PROTECTOR under resident's buttocks and hips.
5. ⭐ Hold urinal by handle. If resident CAN self-help — hand it to him. If CANNOT: gloved, reach under bath blanket, position urinal BETWEEN legs, guide PENIS into urinal opening. Replace covers.
6. Remove gloves. Wash hands.
7. ⭐ RAISE HEAD OF BED slightly — helps with urination. Then bed to LOWEST. Disposable wipes within reach.
8. Call light in resident's hand. "Signal when done." CLOSE DOOR.
9. When signaled: return. Wash hands. CLEAN GLOVES. Take covered urinal or have resident hand it to you. Cover it.
10. Discard wipes. Remove bed protector.
11. ⭐ Take covered urinal to bathroom. Note COLOR, ODOR, QUALITY (clear vs cloudy, sediment). Pour carefully into toilet along inner bowl edge.
12. Faucet with paper towel. Rinse urinal with COLD WATER. Swirl, empty, flush. Store per policy.
13. Remove gloves. Wash hands.
14. Bed to LOWEST. Side rails per order. Remove privacy. Call light. Report. Document.`,
  },
  {
    num: 38, name: 'ASSISTING DEPENDENT RESIDENT WITH DINING', supplies: 'Meal tray, clothing protector, hand wipes, chair',
    criticals: [
      'Confirm resident\'s name + tray matches diet card BEFORE serving',
      'Bite-sized pieces; tell resident WHAT each bite is; WAIT for full chew and swallow before next bite',
      'Keep resident sitting UPRIGHT for AT LEAST 30 MINUTES after eating — prevents aspiration',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. ⭐ Check DIET CARD. Ask resident to SAY THEIR NAME (or check wristband/photo). Confirm tray matches diet card — right tray for right resident.
4. Raise head of bed to FULL 90 DEGREES (like sitting in a chair, spine vertical).
5. Lock wheels. Adjust bed height so your EYES = resident's EYES when you sit beside them.
6. Swing overbed table across. Set tray in resident's visual field.
7. If can't self-clean hands: wipe both hands for them.
8. Clothing protector across chest if desired — tuck into collar.
9. Pull chair to BEDSIDE. Sit at EYE LEVEL. Sit on STRONG SIDE.
10. Point to each item. Let resident CHOOSE order.
11. ⭐ Check food temperature (back of hand to container). Cut into BITE-SIZED PIECES (pea-sized for swallowing difficulty). For each bite: TELL them what it is, wait for mouth to open, guide utensil in, WAIT for full CHEW and SWALLOW before next bite. Watch throat — look for swallow. STOP if coughing, gagging, or food returning — ALERT NURSE.
12. Offer beverage THROUGHOUT (not just end). Touch rim to LOWER LIP first. Small sips. Slow pour.
13. Talk to resident. Watch their face, not just the food. Wipe mouth/chin during meal.
14. After meal: wipe mouth, chin, hands. Remove clothing protector.
15. ⭐ CHECK TRAY before removing — dentures? Eyeglasses? Personal items? Remove those first.
16. ⭐ UPRIGHT for AT LEAST 30 MINUTES after eating. Do NOT lower head of bed immediately.
17. After 30 min: bed to LOWEST. Remove privacy. Tray to collection area.
18. Call light. Wash hands. Report swallowing difficulties. Document.`,
  },
  {
    num: 39, name: 'MEASURING FLUID INTAKE', supplies: 'I&O form, pen',
    criticals: [
      'Record EVERY fluid taken by mouth throughout shift — including liquid-at-room-temp foods (Jell-O, ice cream)',
      'Convert all to MILLILITERS (1 oz ≈ 30 mL)',
      'Total must be accurate within 15 mL',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. ⭐ Throughout shift — record EVERY fluid taken by mouth: water, juice, milk, broth, coffee, tea, soda, AND liquid-at-room-temp foods (ice cream, Jell-O). Note TIME + WHAT + AMOUNT each occurrence.
4. ⭐ End of shift: convert all amounts to MILLILITERS (1 oz ≈ 30 mL).
5. ⭐ ADD UP all individual amounts for entire shift. Must be accurate within 15 mL.
6. Call light. Wash hands.
7. Record total FLUID INTAKE in INPUT column of I&O sheet.
8. Report to nurse.`,
  },
  {
    num: 40, name: 'MAKING AN UNOCCUPIED BED', supplies: 'Fitted or flat bottom sheet, top sheet, draw sheet, blanket, pillowcases, gloves, bed protector if needed',
    criticals: [
      'Roll soiled sheet with SOILED SIDE INWARD — never touch scrubs with it',
      'Bottom sheet pulled TAUT with no wrinkles; hospital corners at foot',
      'Pillowcase: inside-out over your arm, grab pillow end, pull case over pillow',
    ],
    back: `1. Wash hands. Gather ALL clean linens — carry to bedside. Set on CLEAN surface (chair/overbed table, NOT floor).
2. Lock ALL 4 bed wheels. FLATTEN bed. Raise to comfortable WORKING HEIGHT. Gloves on.
3. ⭐ Loosen all corners of soiled sheet. ROLL soiled sheet toward center — SOILED SIDE INWARD (burrito roll, head to foot). Hold AWAY from body. Carry to HAMPER. Pillowcases: peel inside-out, drop in hamper.
4. ⭐ Remove gloves. WASH HANDS.
5. Open CLEAN BOTTOM SHEET. If fitted: stretch corners over mattress starting with head corner nearest you. If flat: center it, tuck using HOSPITAL CORNERS (45° fold then tuck remainder). Sheet pulled TAUT — no wrinkles. Draw sheet across middle third, tuck both sides.
6. TOP SHEET over entire bed — center so equal hang each side. TUCK under foot mattress. HOSPITAL CORNERS at both bottom corners. BLANKET over top sheet. Fold TOP SHEET over blanket 6 inches (neat cuff). FAN-FOLD both down toward foot for easy entry.
7. ⭐ PILLOWCASE: grasp closed end, flip INSIDE OUT over your hand/arm. Grab one NARROW END of pillow with covered hand. Pull case DOWN over pillow — flips right-side-out. OPEN END FACES AWAY FROM DOOR.
8. Lower bed to LOWEST position.
9. Carry soiled linen hamper to laundry area. Wash hands. Document.`,
  },
  {
    num: 41, name: 'MAKING AN OCCUPIED BED', supplies: 'Clean linens, bath blanket, gloves, pillowcases',
    criticals: [
      'Roll soiled sheet TOWARD resident\'s body (snug against back) — clean sheet behind it on your side',
      'Resident rolls OVER the divide onto clean side — soiled sheets now on far side',
      'NEVER shake soiled linen; NEVER put on floor or furniture',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Stack clean linens on clean surface. Lock wheels. Raise side rails. Bed to working HEIGHT. Lower head FLAT. Gloves on.
4. Pull TOP SHEET loose at foot on your working side.
5. Open BATH BLANKET — DRAPE OVER resident (additional layer). Resident holds it. Reach under — pull TOP SHEET AND BLANKET together, pull OUT and DOWN to foot. Bath blanket = only covering.
6. Help resident ROLL toward RAISED FAR SIDE RAIL — back toward you, close to far edge.
7. On working side: loosen BOTTOM SHEET and bed protector from under mattress.
8. ⭐ Roll soiled bottom sheet/protector TOWARD RESIDENT — push snug against back like a log against a wall.
9. Open CLEAN BOTTOM SHEET — fold-line along length. Tuck head end under mattress. Smooth toward resident. Roll excess and PUSH UNDER soiled linen — creating clean/soiled divide. Smooth flat on your side. Tuck foot end. Hospital corners. Draw sheet + bed protector same way.
10. ⭐ Raise your NEAR SIDE RAIL. Walk to OTHER SIDE. Lower far side rail. Help resident ROLL BACK over the divide toward you — they're now on the clean half. Soiled linen bundle is on far half.
11. ⭐ Grab soiled bundle — UNROLL it, SOILED SIDE INWARD throughout. Check for belongings. HAMPER — no shaking, no floor, no furniture.
12. Change gloves + wash hands.
13. ⭐ Pull clean sheet through — straight and tight. Tuck head end. Smooth flat, no wrinkles. Tuck foot end. Hospital corners. Pull draw sheet and protector through, smooth, tuck.
14. Help resident roll to CENTER of bed. Pillow under head. Raise NEAR SIDE RAIL.
15. Open TOP SHEET over resident. Resident holds it. Reach under, slide BATH BLANKET out toward foot — HAMPER.
16. BLANKET over top sheet. Tuck both at foot. Hospital corners. LOOSEN over feet. Fold top sheet OVER blanket 6 inches at top.
17. Remove PILLOWS. Peel pillowcases inside-out. Hamper.
18. ⭐ Remove gloves. WASH HANDS. Fresh pillowcase per instructions (inside-out over arm, grab narrow pillow end, pull over). Open end AWAY FROM DOOR.
19. Check comfort. Adjust position if needed.
20. Bed to LOWEST. Side rails per order. Remove privacy.
21. Call light. Carry hamper. Wash hands. Report. Document.`,
  },
  {
    num: 42, name: 'MEASURING & RECORDING ORAL TEMPERATURE (DIGITAL)', supplies: 'Digital thermometer, disposable probe sheath, gloves',
    criticals: [
      'Seat sheath on probe until it clicks; press power — wait for READY signal',
      'Place probe in SUBLINGUAL POCKET (under tongue, one side of frenulum) — lips closed, NOT teeth',
      'Read display IMMEDIATELY when it beeps; document method as "Oral" or "O"',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy. Gloves on.
3. ⭐ Pull out DISPOSABLE SHEATH. Slide PROBE END into sheath — feel/hear click as it seats. Press POWER BUTTON. Wait for READY signal (beep + symbol on display).
4. Ask resident to OPEN MOUTH. Locate SUBLINGUAL POCKET (under tongue, one side of frenulum — the cord under tongue).
5. ⭐ Insert probe gently into sublingual pocket. Ask resident to CLOSE LIPS around it (NOT teeth).
6. Hold still. Watch screen. Listen for BEEP or watch for light blink — reading done.
7. ⭐ Slide thermometer OUT. READ DISPLAY IMMEDIATELY — memorize temperature before anything else.
8. Use TISSUE to grasp sheath — peel OFF and WRAP in tissue. Drop in trash. Return thermometer to protective case.
9. Remove gloves. Wash hands.
10. Write TEMPERATURE, DATE, TIME, METHOD — write "Oral" or "O." on documentation form.
11. Call light. Report changes.`,
  },
  {
    num: 43, name: 'COUNTING AND RECORDING RADIAL PULSE', supplies: 'Watch with second hand',
    criticals: [
      'Use INDEX + MIDDLE fingers on THUMB SIDE of inner wrist — NEVER use your thumb',
      'Count for ONE FULL MINUTE — must be accurate within 4 BPM',
      'REPORT IMMEDIATELY if pulse is BELOW 60 or ABOVE 100 BPM',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. ⭐ Resident's arm resting at side or across lap — PALM FACING UP.
4. ⭐ Place INDEX FINGER + MIDDLE FINGER together on THUMB SIDE of inner wrist (just below base of thumb). Press gently — feel rhythmic tapping = radial artery. DO NOT use THUMB (it has its own pulse).
5. ⭐ Glance at watch — note second hand. Count each beat for ONE FULL MINUTE without stopping. Note final count. Must be within 4 BPM.
6. Also note: RHYTHM (regular or skips?) and STRENGTH (strong/full or weak/thready?).
7. Call light. Wash hands.
8. Write PULSE RATE, DATE, TIME, METHOD — write "Radial" or "R."
9. ⭐ REPORT IMMEDIATELY if pulse is BELOW 60 or ABOVE 100 BPM.`,
  },
  {
    num: 44, name: 'COUNTING AND RECORDING RESPIRATIONS', supplies: 'Watch with second hand',
    criticals: [
      'DO NOT TELL resident you\'re counting breathing — they\'ll change their rate',
      'After pulse count, keep fingers on wrist but watch chest rise/fall — each rise+fall = 1 breath',
      'Must be accurate within 2 breaths; REPORT IMMEDIATELY if irregular',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Comfortable position for resident.
4. ⭐ DO NOT tell resident you're counting breathing — people immediately change their rate when aware.
5. ⭐ After finishing RADIAL PULSE COUNT — KEEP FINGERS ON WRIST (looks like still counting pulse). Actually now watching CHEST AND ABDOMEN. Each RISE + FALL = ONE BREATH.
6. ⭐ Glance at watch. Count every rise-and-fall for ONE FULL MINUTE. Must be within 2 breaths.
7. Also note: REGULAR or IRREGULAR? SHALLOW or DEEP? Any NOISE (wheezing, gurgling, rattling)? LABORED?
8. ⭐ Call light. Wash hands.
9. Write RESPIRATORY RATE. Also note pattern and character (regular, shallow, wheezing, etc.).
10. ⭐ REPORT IMMEDIATELY if breathing is IRREGULAR or if you hear wheezing.`,
  },
  {
    num: 45, name: 'GIVING A BACKRUB', supplies: 'Lotion, basin of warm water, towels, bath blanket',
    criticals: [
      'Warm lotion BOTTLE in basin of warm water for 5 minutes before starting',
      'Continuous OVAL/FIGURE-8 strokes from BUTTOCKS up SPINE sides to SHOULDERS and back — hands never leave skin — 3-5 minutes',
      'Circular fingertip pressure over bony prominences; if skin is WHITE, RED, or PURPLE — do NOT massage, notify nurse',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. ⭐ LOTION BOTTLE in BASIN OF WARM WATER — soak 5 MINUTES. Cold lotion causes muscle tension.
4. Lock wheels. Raise side rails. Bed to working HEIGHT. Lower head FLAT.
5. Help resident onto SIDE or STOMACH. Bath blanket/towel over them. Fold linens DOWN to TOP OF BUTTOCKS — entire back exposed neck to tailbone.
6. ⭐ Pour lotion into YOUR PALMS (silver-dollar sized). Rub palms together until warm.
7. ⭐ LONG STROKES: both palms flat, one each side of UPPER BUTTOCKS. Fingers toward head. Push UPWARD — simultaneously up EACH SIDE OF SPINE to SHOULDERS. At shoulders: CIRCLE OUTWARD. Move DOWN outer edges/flanks. At BUTTOCKS: CIRCLE. Move back UP. CONTINUOUS — hands never leave skin. Repeat 3-5 MINUTES (oval/racetrack pattern).
8. ⭐ KNEADING: loose claw (first 2 fingers + thumb). Walk up each side of spine from tailbone to shoulders — gentle downward pressure. Circle at shoulders and buttocks.
9. ⭐ BONY AREAS (spine, shoulder blades, hip bones): fingertips, small CIRCULAR MOTIONS with light pressure. LOOK at each area — WHITE, RED, or PURPLE skin = DO NOT MASSAGE — notify nurse after.
10. "Almost done" — several more long smooth upward strokes to conclude.
11. Blot extra lotion dry with towel (pat, don't rub).
12. Remove blanket/towel. Help dress. Comfortable position.
13. Bed to LOWEST. Side rails per order. Remove privacy. Call light.
14. Return lotion to storage. Wash hands. Report skin findings. Document.`,
  },
  {
    num: 46, name: 'PROVIDING ORAL CARE', supplies: 'Gloves, toothbrush, toothpaste, water cup, emesis basin, clothing protector, lip moisturizer',
    criticals: [
      'Head of bed fully UPRIGHT — 90 degrees (full sitting position) before starting',
      'Brush order: inner uppers → outer uppers → chewing uppers → inner lowers → outer lowers → chewing lowers → TONGUE (back to tip)',
      'Report: abnormal odor, lip cracking, sores, bleeding gums, tongue/mouth discoloration',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. ⭐ Lock wheels. Raise side rails. Adjust bed. Raise HEAD COMPLETELY — resident at FULL UPRIGHT 90-DEGREE SITTING POSITION (spine vertical). Gloves on.
4. Drape CLOTHING PROTECTOR/TOWEL across chest — like a bib, tuck into collar.
5. WET toothbrush bristles under running water. Shake off excess. PEA-SIZED toothpaste.
6. ⭐ Tell resident to OPEN MOUTH. Brush in order:
   • INNER UPPER (tongue-side of upper teeth, along gumline — short back-and-forth)
   • OUTER UPPER (lip-side, along gumline)
   • CHEWING UPPER (flat tops, back-and-forth)
   • INNER LOWER
   • OUTER LOWER
   • CHEWING LOWER
   • TONGUE: toothbrush flat, BACK OF TONGUE to TIP — 2-3 strokes
7. Pour water into cup. Hold to lips: "Take a sip and rinse." Hold EMESIS BASIN curved side under chin. Spit. WIPE mouth with washcloth. Remove clothing protector.
8. Lip MOISTURIZER on gloved fingertip — sweep across upper then lower lip.
9. Soiled items in proper containers. Bed to LOWEST. Side rails per order. Remove privacy.
10. Call light. Rinse toothbrush (bristles on gloved palm under water). Stand in holder BRISTLES UP. Empty/rinse/dry emesis basin. Return supplies.
11. Remove gloves. Wash hands.
12. ⭐ Report to nurse: mouth ODOR, lip CRACKING at corners, SORES in mouth, BLEEDING gums, DISCOLORATION.
13. Document.`,
  },
  {
    num: 47, name: 'PROVIDING ORAL CARE (UNRESPONSIVE RESIDENT)', supplies: 'Gloves, sponge swabs, cleaning solution, water, towel, emesis basin, lip moisturizer, tongue depressor',
    criticals: [
      'Turn HEAD TOWARD YOU — gravity prevents fluid pooling in throat; EMESIS BASIN at cheek',
      'Sponge swab must be SQUEEZED NEARLY DRY before use — DAMP not wet (prevents aspiration)',
      'SPEAK TO RESIDENT throughout — hearing may still be functioning',
    ],
    back: `1. Knock. Wait. Enter.
2. ⭐ Identify yourself and resident BY NAME — then SAY IT OUT LOUD to them. "Hi [name], I'm [your name]. I'm going to clean your mouth now." SPEAK throughout the entire procedure (hearing may still function).
3. Wash hands. Explain procedure out loud. Privacy.
4. Lock wheels. Raise side rails. Adjust bed. Gloves on.
5. ⭐ TURN RESIDENT'S HEAD TOWARD YOU (rotate on pillow, facing your direction). Gravity keeps fluids from pooling in throat. Place FOLDED TOWEL under CHEEK AND CHIN. Place EMESIS BASIN on towel next to cheek — catchment for drainage.
6. TONGUE DEPRESSOR: gently insert flat end between upper and lower teeth on one side. Use to hold mouth open throughout.
7. ⭐ SPONGE SWAB: dip in CLEANING SOLUTION. SQUEEZE FIRMLY between fingers over container — remove as much excess as possible. Swab must be DAMP, NOT WET. Too much liquid = aspiration risk.
8. ⭐ With squeezed damp swab: WIPE TEETH → GUMS → TONGUE → INNER CHEEKS. Change swab FREQUENTLY (every 1-2 surfaces). Continue until all areas visibly clean.
9. ⭐ FRESH CLEAN SWAB: dip in PLAIN WATER. SQUEEZE FIRMLY again. Rinse same areas — TEETH → GUMS → TONGUE → INNER CHEEKS.
10. Remove towel from cheek. Remove basin. Pat lips/face DRY if wet.
11. LIP MOISTURIZER on gloved fingertip — sweep upper then lower lip.
12. Soiled items in proper containers. Bed to LOWEST. Side rails per order. Remove privacy. Call light.
13. Empty/rinse/dry emesis basin. Return to storage. Remove gloves. Wash hands.
14. ⭐ Report: ODOR, CRACKING, SORES, BLEEDING, DISCOLORATION. Document.`,
  },
  {
    num: 48, name: 'CLEANING AND STORING DENTURES', supplies: 'Gloves, denture brush, denture cleanser or toothpaste, denture cup with lid, labeled storage, towel',
    criticals: [
      'TOWEL in bottom of SINK + partially fill with water — cushions dentures if dropped',
      'COOL/MODERATE water only — hot water WARPS and DISTORTS the plastic',
      'Clean THE GROOVE (curved trough touching gum) — must be thoroughly scrubbed',
    ],
    back: `1. Wash hands. Gloves on.
2. ⭐ Go to sink. Lay FOLDED TOWEL flat in BOTTOM OF SINK. PARTIALLY FILL sink with a few inches of water. Towel + water = cushion if dentures drop.
3. ⭐ Ask resident for dentures (or remove if unable). Hold over water-filled sink. Run MODERATE/COOL water — NOT hot. RINSE all surfaces before cleaning.
4. Apply DENTURE CLEANSER or toothpaste to DENTURE BRUSH (softer than regular).
5. ⭐ Hold denture in one hand over sink. Brush all surfaces:
   • OUTER SURFACES (toward cheeks/lips) — short circular strokes
   • INNER SURFACES (toward tongue)
   • CHEWING SURFACES (flat biting tops)
   • THE GROOVE (curved trough on UNDERSIDE that contacts GUM) — must be thoroughly cleaned
6. RINSE entire denture under MODERATE/COOL running water — rotate under stream, all surfaces. No hot water.
7. RINSE inside of DENTURE CUP AND LID under clean water. Dry with paper towel.
8. ⭐ Fill denture cup with cleaning SOLUTION or MODERATE/COOL WATER — enough to COMPLETELY SUBMERGE both pieces. Place upper + lower dentures FULLY COVERED. LID on and pressed closed. Confirm label = RESIDENT'S NAME. Return to correct storage location.
   If resident wants to WEAR dentures — rinse and hand back. Do not store.
9. Rinse denture brush. Dry. Return equipment. DRAIN sink. TOWEL to laundry hamper.
10. Remove gloves. Wash hands.
11. Document. ⭐ Report CHIPS, CRACKS, DISCOLORATION, or changes in denture appearance to nurse.`,
  },
  {
    num: 49, name: 'SHAVING A RESIDENT (ELECTRIC RAZOR)', supplies: 'Electric razor, shaving brush, towel, aftershave (if desired), gloves, mirror',
    criticals: [
      'CHECK before starting: water nearby? Oxygen in use? Pacemaker? If ANY YES — do NOT use electric razor',
      'Pull skin TAUT with non-dominant hand before each stroke',
      'Clean razor head after: open/remove head, brush out whiskers, RECAP until clicks',
    ],
    back: `1. Knock. Wait. Enter. Identify self + resident.
2. Wash hands. Face-to-face. Explain. Privacy.
3. Lock wheels. Raise side rails. Adjust bed. Raise head — resident sitting upright.
4. Drape TOWEL across chest horizontally — catches whiskers and debris.
5. Gloves on.
6. Use small brush to SWEEP whiskers from razor head. Tap head on gloved palm.
7. ⭐ BEFORE turning on: CHECK — water nearby? OXYGEN (mask or cannula)? PACEMAKER in care plan? If ANY YES — do NOT use electric razor (spark/shock risk). Use alternative method.
8. ⭐ Press POWER BUTTON — razor hums. Pull skin TAUT with NON-DOMINANT HAND — stretch flat where about to shave.
9. ⭐ FOIL SHAVER: BACK-AND-FORTH strokes in DIRECTION of beard growth.
   THREE-HEAD SHAVER: SLOW, WIDE CIRCULAR MOTIONS.
   For both: CHIN (flat against), UNDERSIDE OF CHIN (tip razor slightly, ear to ear), cheeks → jawline → upper lip → chin → neck.
10. Hold MIRROR so resident can see reflection. Check for missed spots.
11. If desired: pour AFTERSHAVE into cupped palm. Rub palms together. Pat gently onto freshly shaved areas.
12. Remove towel — shake INTO TRASH (not into room air). Towel to proper container.
13. Run hand over face/neck and bed surface — remove any loose hairs.
14. Bed to LOWEST. Side rails per order. Remove privacy. Call light.
15. ⭐ Clean razor: open/remove SHAVING HEAD. Shake out debris into trash. Brush inside completely clean. REPLACE/RECAP head (click closed). Return to case.
16. Remove gloves. Wash hands. Report skin nicks, irritation, rashes. Document.`,
  },
]

// Build flashcard JSON
const cards = skills.map(skill => {
  const front = [
    `SKILL ${skill.num} — ${skill.name}`,
    `─────────────────────────────────`,
    `SUPPLIES: ${skill.supplies}`,
    `─────────────────────────────────`,
    ...skill.criticals.map(c => `⭐ ${c}`),
    `─────────────────────────────────`,
    `Q: Walk me through the full procedure.`,
  ].join('\n')

  return {
    front,
    back: skill.back,
    topic: 'CNA _ Test',
  }
})

console.log(JSON.stringify(cards, null, 2))
