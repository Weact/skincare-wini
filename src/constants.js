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
]

export const TIME_OF_DAY = [
  { key: 'morning',   label: 'Morning',   icon: '🌅' },
  { key: 'noon',      label: 'Noon',      icon: '🌞' },
  { key: 'afternoon', label: 'Afternoon', icon: '🌤️' },
  { key: 'evening',   label: 'Evening',   icon: '🌆' },
  { key: 'night',     label: 'Night',     icon: '🌙' },
]
