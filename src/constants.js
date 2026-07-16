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

export const TIME_OF_DAY = [
  { key: 'morning',   label: 'Morning',   icon: '🌅' },
  { key: 'noon',      label: 'Noon',      icon: '🌞' },
  { key: 'afternoon', label: 'Afternoon', icon: '🌤️' },
  { key: 'evening',   label: 'Evening',   icon: '🌆' },
  { key: 'night',     label: 'Night',     icon: '🌙' },
]
