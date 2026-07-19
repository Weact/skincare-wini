export const CATEGORY_EMOJIS = [
  '🧴', '🧼', '💊', '🌿', '💧', '✨', '🌸', '🍃', '🌙', '☀️', '💆', '🛁',
  '👄', '👁️', '✋', '💄', '🫧', '🪷', '💅', '🪒', '🧖‍♀️', '🪞', '🌺', '🌼',
  '🍯', '🥥', '🍋', '🥑', '❄️', '💤', '🧘‍♀️', '💦', '🧊', '🕯️', '🌹', '🌈',
  '🧪', '🔬', '🩺', '💉', '🩹', '🪥', '🦷', '🧽', '🪮', '🚿',
  '🛌', '😴', '🥱', '🧘', '🧘‍♂️', '🔮', '🪄', '⏰', '⏳', '📅',
  '✅', '🌷', '🌻', '🌵', '🍀', '🌱', '🌾', '🪴', '🌳', '🍂',
  '🍁', '🌊', '🌫️', '🌤️', '⛅', '🍊', '🍑', '🍒', '🍇', '🥒',
  '🫐', '🍅', '🥕', '🍌', '🥭', '🍍', '🍉', '🫒', '🍵', '☕',
  '🥛', '🤍', '🖤', '💛',
  '✂️', '💈', '💇', '💇‍♀️', '💇‍♂️', '🧖', '🧖‍♂️', '🕶️', '⛱️', '💋',
  '🎨', '🫙', '🫗', '🧂', '♨️', '👣', '🦶', '🦵', '🫶', '😌',
  '🙏', '🕉️', '☯️', '⭐', '🌟', '💫', '🌞', '❤️', '🧡', '💚',
  '💙', '💜', '💗', '💖', '🍓', '🥝',
]

// 24h picker options — plain selects we render ourselves, since the native
// input[type=time]'s 12h/24h display is locale-controlled and can't be forced
export const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
export const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

// MET (Metabolic Equivalent of Task) values for the calorie estimate:
// kcal ≈ MET × body weight (kg) × duration (h). Rough but standard bands —
// light effort ≈ easy weights/walking, very hard ≈ vigorous running/circuit.
export const WORKOUT_INTENSITIES = [
  { key: 'light',    label: 'Light',     met: 3.5 },
  { key: 'moderate', label: 'Moderate',  met: 5 },
  { key: 'hard',     label: 'Hard',      met: 7 },
  { key: 'veryhard', label: 'Very hard', met: 9 },
]

// Trackers the app offers — used to build the header mode switch and the
// "Trackers" checkboxes in Settings from one shared list. `defaultEnabled`
// controls what a brand-new install starts with (poop is opt-in).
export const TRACKERS = [
  { key: 'skincare', label: 'Skincare', icon: '🧴',  defaultEnabled: true },
  { key: 'workout',  label: 'Workouts', icon: '🏋️', defaultEnabled: true },
  { key: 'poop',     label: 'Poop',     icon: '💩',  defaultEnabled: false },
]

// How a logged poop felt — asked once per entry, right when it's logged
export const POOP_FEELINGS = [
  { key: 'bad',   label: 'Bad',   icon: '😖' },
  { key: 'okay',  label: 'Okay',  icon: '😐' },
  { key: 'good',  label: 'Good',  icon: '🙂' },
  { key: 'great', label: 'Great', icon: '😌' },
]

// Sex positions tracker content — deliberately NOT part of TRACKERS above.
// TRACKERS feeds the friend-sharing system (Settings enable list, header
// switch, AND FriendsPanel's tracker-visibility list / SharedProfileView's
// tabs) — keeping this list separate guarantees this tracker can never be
// exposed to a friend through that shared code path, no matter what. It's
// wired into App.jsx by hand instead, gated by its own `positionsEnabled`
// setting, and its Firestore data relies solely on the blanket owner-only
// rule (no friend-read rule is ever added for it).
export const POSITIONS = [
  { id: 'missionary',      name: 'Missionary',      emoji: '💕', blurb: 'Face to face, one partner on top, close and intimate.' },
  { id: 'doggy',           name: 'Doggy Style',      emoji: '🐾', blurb: 'From behind, on hands and knees.' },
  { id: 'spooning',        name: 'Spooning',         emoji: '🥄', blurb: 'Side by side, one behind the other.' },
  { id: 'cowgirl',         name: 'Cowgirl',          emoji: '🤠', blurb: 'Partner on top, facing forward, sets the pace.' },
  { id: 'reverse-cowgirl', name: 'Reverse Cowgirl',  emoji: '🔄', blurb: 'Partner on top, facing away.' },
  { id: 'lotus',           name: 'Lotus',            emoji: '🪷', blurb: 'Both seated upright, wrapped close together.' },
  { id: 'standing',        name: 'Standing',         emoji: '🧍', blurb: 'Both partners upright, chest to chest.' },
  { id: 'sixty-nine',      name: 'Sixty-Nine',       emoji: '🔁', blurb: 'Simultaneous oral, head to feet.' },
  { id: 'scissoring',      name: 'Scissoring',       emoji: '✂️', blurb: 'Side by side, legs interlocked.' },
  { id: 'butterfly',       name: 'Butterfly',        emoji: '🦋', blurb: 'One partner on the edge of a bed or table, legs raised.' },
  { id: 'eagle',           name: 'Eagle',            emoji: '🦅', blurb: 'Legs spread wide, for a deeper angle.' },
  { id: 'wheelbarrow',     name: 'Wheelbarrow',      emoji: '🛒', blurb: 'Standing partner supports the other’s legs.' },
  { id: 'bridge',          name: 'Bridge',           emoji: '🌉', blurb: 'Arched back, partner kneeling close.' },
  { id: 'amazon',          name: 'Amazon',           emoji: '👑', blurb: 'Partner squats astride, in full control.' },
  { id: 'face-to-face',    name: 'Face to Face',     emoji: '👀', blurb: 'Both seated upright, close embrace.' },
  { id: 'table-top',       name: 'Table Top',        emoji: '🪑', blurb: 'One partner seated on the edge of a table or counter.' },
  { id: 'the-snake',       name: 'The Snake',        emoji: '🐍', blurb: 'Lying flat, bodies pressed close together.' },
  { id: 'piledriver',      name: 'Piledriver',       emoji: '🤸', blurb: 'Legs raised up and back.' },
  { id: 'waterfall',       name: 'Waterfall',        emoji: '💦', blurb: 'Hips elevated, head tilted lower than the body.' },
  { id: 'the-cross',       name: 'The Cross',        emoji: '➕', blurb: 'Legs crossed, entry from the side.' },
  { id: 'ballet-dancer',   name: 'Ballet Dancer',    emoji: '🩰', blurb: 'Standing, one leg lifted and supported.' },
  { id: 'seated-scissor',  name: 'Seated Scissor',   emoji: '🪑', blurb: 'Seated variation of scissoring.' },
  { id: 'ampersand',       name: 'The Ampersand',    emoji: '➿', blurb: 'Spooning with a raised leg, for a deeper angle.' },
  { id: 'full-nelson',     name: 'Full Nelson',      emoji: '🙌', blurb: 'Legs pushed back over the shoulders.' },
  { id: 'the-anvil',       name: 'The Anvil',        emoji: '🔨', blurb: 'Legs pushed forward over the head, a deep angle.' },
  { id: 'magic-mountain',  name: 'Magic Mountain',   emoji: '⛰️', blurb: 'Hips elevated on a pillow or cushion, partner kneeling.' },

  // Standing
  { id: 'wall-press',        name: 'Wall Press',        emoji: '🧱', blurb: 'One partner pressed against a wall, entry from behind or front.' },
  { id: 'leg-lift',          name: 'Leg Lift',          emoji: '🦵', blurb: 'Standing, one leg raised and rested on a surface for a different angle.' },
  { id: 'standing-scissor',  name: 'Standing Scissor',  emoji: '🤸‍♀️', blurb: 'Standing side-on, one leg lifted between the other’s.' },
  { id: 'doorway-lean',      name: 'Doorway Lean',      emoji: '🚪', blurb: 'One partner leaning into a doorway frame for support.' },
  { id: 'the-flamingo',      name: 'The Flamingo',      emoji: '🦩', blurb: 'Standing, one leg wrapped around the other’s waist.' },
  { id: 'standing-spoon',    name: 'Standing Spoon',    emoji: '🥄', blurb: 'Standing, one behind the other, close together.' },
  { id: 'mirror-stand',      name: 'Mirror Stand',      emoji: '🪞', blurb: 'Both facing a mirror, standing, one behind the other.' },
  { id: 'standing-straddle', name: 'Standing Straddle', emoji: '🧍‍♀️', blurb: 'Standing, one leg lifted and wrapped around the other’s hip for a side angle.' },
  { id: 'the-pillar',        name: 'The Pillar',        emoji: '🏛️', blurb: 'Standing, one partner braced against a solid support, other pressed close.' },
  { id: 'standing-split',    name: 'Standing Split',    emoji: '🤸', blurb: 'Standing, one leg raised high against a wall or shoulder.' },

  // Seated
  { id: 'rocking-chair',     name: 'Rocking Chair',     emoji: '🪑', blurb: 'Seated face to face, rocking motion, close embrace.' },
  { id: 'the-armrest',       name: 'The Armrest',       emoji: '🛋️', blurb: 'Seated sideways on a chair’s arm, partner standing close.' },
  { id: 'ottoman-perch',     name: 'Ottoman Perch',     emoji: '🪑', blurb: 'Seated on a low ottoman or stool, partner kneeling.' },
  { id: 'bench-press',       name: 'Bench Press',       emoji: '🪑', blurb: 'Seated on a bench or edge, partner standing between the legs.' },
  { id: 'recliner',          name: 'Recliner',          emoji: '🛋️', blurb: 'Reclined seat, partner leaning over.' },
  { id: 'piano-bench',       name: 'Piano Bench',       emoji: '🎹', blurb: 'Side by side seated, twisting to face each other.' },
  { id: 'the-swivel',        name: 'The Swivel',        emoji: '🔄', blurb: 'Seated on a stool, partner rotates to change the angle mid-position.' },
  { id: 'seated-recline',    name: 'Seated Recline',    emoji: '💺', blurb: 'Reclined back in a chair, partner kneeling between the legs.' },
  { id: 'cross-legged-seat', name: 'Cross-Legged Seat', emoji: '🧘', blurb: 'Both seated cross-legged, close together, facing each other.' },
  { id: 'the-perch',         name: 'The Perch',         emoji: '🦅', blurb: 'Seated on the edge of a high surface, legs dangling, partner standing between them.' },

  // Side-lying
  { id: 'side-saddle',         name: 'Side Saddle',         emoji: '🐴', blurb: 'Side by side, one leg draped over the other’s hip.' },
  { id: 'cross-spoon',         name: 'Cross Spoon',         emoji: '🥄', blurb: 'Side-lying, bodies angled in a cross rather than parallel.' },
  { id: 'the-x-position',      name: 'The X Position',      emoji: '❌', blurb: 'Both lying on their sides, legs crossed over each other.' },
  { id: 'spork',               name: 'Spork',                emoji: '🍴', blurb: 'A hybrid of spooning and face-to-face, half-turned.' },
  { id: 'lazy-wave',           name: 'Lazy Wave',           emoji: '🌊', blurb: 'Both lying on their sides, gentle rocking motion.' },
  { id: 'side-saddle-reverse', name: 'Side Saddle Reverse', emoji: '🔄', blurb: 'Side-lying, one partner facing away.' },
  { id: 'the-sidecar',         name: 'The Sidecar',         emoji: '🏍️', blurb: 'Side-lying, one leg lifted and hooked over the other’s shoulder.' },
  { id: 'the-half-spoon',      name: 'The Half Spoon',      emoji: '🥄', blurb: 'Side-lying, one partner propped up on an elbow, half-turned toward the other.' },

  // Kneeling / rear-entry
  { id: 'low-doggy',        name: 'Low Doggy',        emoji: '🐾', blurb: 'Rear entry, chest lowered close to the surface.' },
  { id: 'the-arch',         name: 'The Arch',         emoji: '🌉', blurb: 'Rear entry, back arched, hands out in front.' },
  { id: 'standing-doggy',   name: 'Standing Doggy',   emoji: '🐕', blurb: 'Rear entry, both standing, one bent forward.' },
  { id: 'the-slide',        name: 'The Slide',        emoji: '🛝', blurb: 'Rear entry, low angle, hips close to the ground.' },
  { id: 'kneeling-embrace', name: 'Kneeling Embrace', emoji: '🙏', blurb: 'Both kneeling, close together, front entry.' },
  { id: 'the-anchor',       name: 'The Anchor',       emoji: '⚓', blurb: 'Rear entry, one leg raised onto a surface for a deeper angle.' },
  { id: 'the-camel',        name: 'The Camel',        emoji: '🐪', blurb: 'Rear entry, upright kneeling, arms reaching back.' },
  { id: 'praying-mantis',   name: 'Praying Mantis',   emoji: '🦗', blurb: 'Rear entry, forearms and knees on the surface.' },
  { id: 'the-frog',         name: 'The Frog',         emoji: '🐸', blurb: 'Rear entry, knees drawn up wide and low to the surface.' },
  { id: 'kneeling-lean',    name: 'Kneeling Lean',    emoji: '🙇', blurb: 'Rear entry, upright kneeling, leaning back into the partner.' },

  // Furniture & elevation-assisted
  { id: 'staircase',      name: 'Staircase',      emoji: '🪜', blurb: 'Using steps for a height difference, standing or kneeling.' },
  { id: 'the-ledge',      name: 'The Ledge',      emoji: '🧱', blurb: 'Perched on any raised edge, partner standing close.' },
  { id: 'sofa-back',      name: 'Sofa Back',      emoji: '🛋️', blurb: 'Kneeling over the back of a sofa, partner standing behind.' },
  { id: 'windowsill',     name: 'Windowsill',     emoji: '🪟', blurb: 'Perched on a low windowsill or ledge, partner standing.' },
  { id: 'footstool',      name: 'Footstool',      emoji: '🪑', blurb: 'Using a low stool for height, kneeling or standing.' },
  { id: 'vanity-stool',   name: 'Vanity Stool',   emoji: '💄', blurb: 'Seated on a low stool in front of a mirror, partner standing behind.' },
  { id: 'ottoman-kneel',  name: 'Ottoman Kneel',  emoji: '🪑', blurb: 'Kneeling over a low ottoman, partner standing behind.' },
  { id: 'bathtub-edge',   name: 'Bathtub Edge',   emoji: '🛁', blurb: 'Seated on the edge of a tub, partner kneeling or standing.' },
  { id: 'balcony-rail',   name: 'Balcony Rail',   emoji: '🌇', blurb: 'Standing at a railing for support, entry from behind.' },
  { id: 'headboard-grip', name: 'Headboard Grip', emoji: '🛏️', blurb: 'Lying down, hands gripping the headboard for leverage.' },

  // Face-to-face / embrace variants
  { id: 'the-cradle',       name: 'The Cradle',       emoji: '🤱', blurb: 'Face to face, one partner’s legs wrapped around the other.' },
  { id: 'legs-up',          name: 'Legs Up',          emoji: '🦵', blurb: 'Face to face, legs raised straight up.' },
  { id: 'half-lotus',       name: 'Half Lotus',       emoji: '🪷', blurb: 'Seated, partially wrapped, face to face.' },
  { id: 'the-anchor-point', name: 'The Anchor Point', emoji: '⚓', blurb: 'Face to face, one leg hooked over the other’s shoulder.' },
  { id: 'cheek-to-cheek',   name: 'Cheek to Cheek',   emoji: '💏', blurb: 'Face to face, heads close together, slow and intimate.' },
  { id: 'the-hammock',      name: 'The Hammock',      emoji: '🏕️', blurb: 'Face to face, hips supported by the partner’s forearms, slightly suspended.' },
  { id: 'slow-rock',        name: 'Slow Rock',        emoji: '🎶', blurb: 'Face to face, lying still, gentle rocking motion only.' },
  { id: 'the-twist',        name: 'The Twist',        emoji: '🌀', blurb: 'Face to face, torso twisted slightly for a different angle.' },

  // Oral-focused
  { id: 'kneeling-oral', name: 'Kneeling Oral', emoji: '🙇‍♀️', blurb: 'One partner kneeling, focused oral attention.' },
  { id: 'standing-oral', name: 'Standing Oral', emoji: '🧍', blurb: 'One partner standing, the other kneeling.' },
  { id: 'seated-oral',   name: 'Seated Oral',   emoji: '💺', blurb: 'One partner seated, the other kneeling or lying between the legs.' },
  { id: 'side-oral',     name: 'Side Oral',     emoji: '💋', blurb: 'Lying on the side, oral attention from behind or beside.' },
  { id: 'lying-oral',    name: 'Lying Oral',    emoji: '🛌', blurb: 'One partner lying flat, the other kneeling over them.' },
  { id: 'the-tease',     name: 'The Tease',     emoji: '😏', blurb: 'Slow, teasing oral position with the receiver propped on pillows.' },

  // Acrobatic / advanced
  { id: 'the-catapult',       name: 'The Catapult',       emoji: '🎡', blurb: 'Hips elevated on a partner’s thighs, legs raised.' },
  { id: 'deep-impact',        name: 'Deep Impact',        emoji: '💥', blurb: 'Legs pushed back for a deep angle, partner kneeling close.' },
  { id: 'the-suspension',     name: 'The Suspension',     emoji: '🪂', blurb: 'Partner lifted and supported entirely off the ground.' },
  { id: 'the-corkscrew',      name: 'The Corkscrew',      emoji: '🌀', blurb: 'Twisted torso position for a different angle, lying down.' },
  { id: 'the-wrap',           name: 'The Wrap',           emoji: '🎁', blurb: 'Legs wrapped fully around the partner’s waist, lifted.' },
  { id: 'the-crescent',       name: 'The Crescent',       emoji: '🌙', blurb: 'Body curved to one side, partner kneeling at an angle.' },
  { id: 'inverted-v',         name: 'Inverted V',         emoji: '📐', blurb: 'Hips raised high, shoulders down, partner standing over.' },
  { id: 'the-counterbalance', name: 'The Counterbalance', emoji: '⚖️', blurb: 'Both leaning back in opposite directions, hands clasped for balance.' },
  { id: 'the-swing',          name: 'The Swing',          emoji: '🎪', blurb: 'Using a sling or hammock-style support for a suspended angle.' },
  { id: 'reverse-bridge',     name: 'Reverse Bridge',     emoji: '🌉', blurb: 'Facing away, arched back, hands on the surface behind.' },

  // Bent-over / table variants
  { id: 'table-edge',         name: 'Table Edge',         emoji: '🍽️', blurb: 'Bent over a table’s edge, partner standing behind.' },
  { id: 'railing-hold',       name: 'Railing Hold',       emoji: '🪝', blurb: 'Bent forward, holding onto a railing or headboard.' },
  { id: 'the-presentation',   name: 'The Presentation',   emoji: '🙆‍♀️', blurb: 'Bent forward, hands on knees, upright stance.' },
  { id: 'forearm-brace',      name: 'Forearm Brace',      emoji: '💪', blurb: 'Bent forward, resting on forearms rather than hands.' },
  { id: 'the-dip',            name: 'The Dip',            emoji: '📉', blurb: 'Bent forward and low, hips dipped down.' },
  { id: 'standing-fold',      name: 'Standing Fold',      emoji: '🙇', blurb: 'Standing, folded forward at the hips, hands reaching the floor.' },
  { id: 'the-hinge',          name: 'The Hinge',          emoji: '🚪', blurb: 'Bent at a sharp angle from the hips, torso nearly horizontal.' },
  { id: 'elbows-down',        name: 'Elbows Down',        emoji: '🧎', blurb: 'Kneeling, chest and elbows lowered to the surface.' },
]

export const TIME_OF_DAY = [
  { key: 'morning',   label: 'Morning',   icon: '🌅' },
  { key: 'noon',      label: 'Noon',      icon: '🌞' },
  { key: 'afternoon', label: 'Afternoon', icon: '🌤️' },
  { key: 'evening',   label: 'Evening',   icon: '🌆' },
  { key: 'night',     label: 'Night',     icon: '🌙' },
]
