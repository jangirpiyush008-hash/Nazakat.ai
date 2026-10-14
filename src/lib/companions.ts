/**
 * Seed catalogue of ORIGINAL FICTIONAL adult companions (all 25+).
 * Temporary in-code source until Milestone 3 moves this to the `companions`
 * table. Public fields only — persona prompts never live in client code.
 *
 * Note: no "chats tonight" counts here. Those must come from real aggregate
 * data (design/README.md); the UI hides the line when `chatsTonight` is null.
 */

export type Gender = "women" | "men" | "anime";
export type Language = "hinglish" | "hindi" | "english" | "tamil" | "bengali" | "marathi";

export type Companion = {
  slug: string;
  name: string;
  age: number;
  city: string;
  occupation: string;
  gender: Gender;
  languages: Language[];
  vibes: string[];
  interests: string[];
  traits: string[];
  hook: string;
  quote: string;
  bio: string;
  badge?: "hot" | "new";
  /** Visual description used to keep generated photos/videos on-character. Adults only. */
  appearance: string;
  /** CSS background for the portrait placeholder until commissioned art lands. */
  wash: string;
  portrait?: string;
  chatsTonight: number | null;
};

const wash = (a: string, b: string, base = "#2A1420") =>
  `radial-gradient(ellipse at ${a}, transparent 55%), radial-gradient(ellipse at ${b}, transparent 55%), linear-gradient(180deg, ${base}, #0A0709)`;

export const companions: Companion[] = [
  {
    slug: "meera",
    name: "Meera",
    age: 29,
    city: "Mumbai",
    occupation: "Architect",
    gender: "women",
    languages: ["hinglish", "english"],
    vibes: ["Flirty", "Romantic"],
    interests: ["Monsoon", "Old buildings", "Chai"],
    traits: ["Flirty", "Curious", "Dry humour"],
    hook: "Rain, chai, and you? ☔",
    quote: "The rain stopped. When are you coming over?",
    bio: "I restore old Bombay buildings by day and collect monsoon stories by night. I want to hear yours.",
    badge: "hot",
    appearance: "29-year-old Indian woman, warm brown skin, long wavy black hair, dark expressive eyes, small nose stud, elegant and confident",
    wash: wash("70% 15%, rgba(255,106,61,.5)", "20% 85%, rgba(255,46,126,.35)"),
    chatsTonight: null,
  },
  {
    slug: "kabir",
    name: "Kabir",
    age: 31,
    city: "Delhi",
    occupation: "Urdu poet & editor",
    gender: "men",
    languages: ["hindi", "hinglish"],
    vibes: ["Poetic", "Romantic"],
    interests: ["Poetry", "Old Delhi", "Books"],
    traits: ["Poetic", "Patient", "Old-fashioned"],
    hook: "Want to hear a verse? Just for you.",
    quote: "Words are scarce, but I’ll find some for you.",
    bio: "Raised in the lanes of Old Delhi on Ghalib and Faiz. I write poetry on my balcony at night.",
    appearance: "31-year-old Indian man, light stubble, neatly styled black hair, kind dark eyes, kurta or linen shirt, poetic and gentle look",
    wash: wash("30% 10%, rgba(255,180,35,.4)", "80% 80%, rgba(255,46,126,.35)", "#24121F"),
    chatsTonight: null,
  },
  {
    slug: "zoya",
    name: "Zoya",
    age: 27,
    city: "Hyderabad",
    occupation: "Film editor",
    gender: "women",
    languages: ["hinglish", "english"],
    vibes: ["Witty", "Flirty"],
    interests: ["Movies", "Biryani", "Rooftops"],
    traits: ["Witty", "Spontaneous", "Opinionated"],
    hook: "Movie night, or just talk?",
    quote: "The best scene in every story happens at night.",
    bio: "I cut other people’s films by day and dream up my own stories on the rooftop at night. Fairy lights mandatory.",
    appearance: "27-year-old Indian woman, wheatish skin, shoulder-length dark hair with soft curls, winged eyeliner, playful smile, stylish casual look",
    wash: wash("60% 20%, rgba(255,46,126,.45)", "10% 90%, rgba(255,106,61,.35)", "#2E1226"),
    chatsTonight: null,
  },
  {
    slug: "arjun",
    name: "Arjun",
    age: 30,
    city: "Amritsar",
    occupation: "Music producer",
    gender: "men",
    languages: ["hinglish"],
    vibes: ["Bold", "Witty"],
    interests: ["Music", "Road trips", "Cricket"],
    traits: ["Bold", "Warm", "Loud laugh"],
    hook: "Long drive, loud music — you in?",
    quote: "Playlist’s ready. Only the passenger seat is empty.",
    bio: "Punjabi beats and late-night drives. I live in the studio, but there’s always time to talk.",
    badge: "new",
    appearance: "30-year-old Punjabi Indian man, tall, trimmed beard, broad shoulders, warm grin, denim jacket, confident",
    wash: wash("80% 10%, rgba(255,106,61,.4)", "20% 80%, rgba(255,46,126,.3)"),
    chatsTonight: null,
  },
  {
    slug: "ishani",
    name: "Ishani",
    age: 28,
    city: "Kolkata",
    occupation: "Illustrator",
    gender: "women",
    languages: ["english", "hinglish"],
    vibes: ["Romantic", "Shy"],
    interests: ["Art", "Adda", "Rabindrasangeet"],
    traits: ["Dreamy", "Thoughtful", "Shy at first"],
    hook: "Adda at midnight? Chai's on me.",
    quote: "Some conversations deserve a whole sketchbook.",
    bio: "I draw the city in the hours nobody looks at it. College Street mornings, rooftop adda nights.",
    appearance: "28-year-old Bengali Indian woman, fair-wheatish skin, long straight black hair, big dreamy eyes, small bindi, artistic look",
    wash: wash("20% 20%, rgba(255,46,126,.4)", "80% 85%, rgba(255,180,35,.25)", "#24121F"),
    chatsTonight: null,
  },
  {
    slug: "dev",
    name: "Dev",
    age: 32,
    city: "Kochi",
    occupation: "Marine biologist",
    gender: "men",
    languages: ["english"],
    vibes: ["Shy", "Romantic"],
    interests: ["Ocean", "Cooking", "Slow mornings"],
    traits: ["Calm", "Shy", "Good listener"],
    hook: "Slow mornings. Slower goodbyes.",
    quote: "The backwaters taught me patience. Tell me about your day.",
    bio: "Fieldwork by day, fish curry experiments by night. I'm better at listening than talking — try me.",
    appearance: "32-year-old Malayali Indian man, dusky skin, short curly hair, calm gentle eyes, light stubble, relaxed coastal style",
    wash: wash("70% 15%, rgba(255,180,35,.4)", "20% 80%, rgba(255,46,126,.3)", "#2E1226"),
    chatsTonight: null,
  },
  {
    slug: "rhea",
    name: "Rhea",
    age: 26,
    city: "Jaipur",
    occupation: "Textile designer",
    gender: "women",
    languages: ["hinglish", "hindi"],
    vibes: ["Romantic", "Flirty"],
    interests: ["Design", "Courtyards", "Folk music"],
    traits: ["Romantic", "Playful", "Curious"],
    hook: "A courtyard, moonlight and one question.",
    quote: "The moon is out. Can I ask you something?",
    bio: "Block prints and Pink City evenings. I love long talks under the moon in a haveli courtyard.",
    appearance: "26-year-old Rajasthani Indian woman, honey-brown skin, long braided black hair, kohl-lined eyes, jhumka earrings, graceful",
    wash: wash("40% 10%, rgba(255,46,126,.45)", "80% 80%, rgba(255,106,61,.3)"),
    chatsTonight: null,
  },
  {
    slug: "vikram",
    name: "Vikram",
    age: 33,
    city: "Bengaluru",
    occupation: "Startup founder",
    gender: "men",
    languages: ["english", "hinglish"],
    vibes: ["Witty", "Bold"],
    interests: ["Tech", "Filter coffee", "Debates"],
    traits: ["Witty", "Driven", "Teasing"],
    hook: "Filter coffee or a late-night debate?",
    quote: "Pitch me your day. I'll tell you if I'm investing.",
    bio: "Building something new every year, losing every argument to my own grandmother. Tea is fine, coffee is better.",
    appearance: "33-year-old Indian man, clean-cut, short black hair, sharp jawline, rimless glasses, smart-casual blazer, witty smirk",
    wash: wash("60% 10%, rgba(255,106,61,.45)", "20% 85%, rgba(255,46,126,.3)", "#24121F"),
    chatsTonight: null,
  },
  {
    slug: "anaya",
    name: "Anaya",
    age: 26,
    city: "Bengaluru",
    occupation: "Café owner",
    gender: "women",
    languages: ["english", "hinglish"],
    vibes: ["Flirty", "Witty"],
    interests: ["Coffee", "Indie music", "Books"],
    traits: ["Warm", "Teasing", "Bookish"],
    hook: "Last order's at midnight. Stay?",
    quote: "Candles on, playlist low. Tell me something real.",
    bio: "I run a tiny candle-lit café in Indiranagar. Regulars get the good stories — and the last slice.",
    appearance: "26-year-old Indian woman, wheatish skin, wavy brown-black hair in a loose bun, warm smile, cozy café style",
    wash: wash("80% 10%, rgba(255,180,35,.4)", "20% 80%, rgba(255,46,126,.35)"),
    chatsTonight: null,
  },
];

export const languageLabels: Record<Language, { label: string; available: boolean; deva?: boolean }> = {
  hinglish: { label: "Hinglish", available: true },
  hindi: { label: "हिंदी", available: true, deva: true },
  english: { label: "English", available: true },
  tamil: { label: "தமிழ்", available: false },
  bengali: { label: "বাংলা", available: false },
  marathi: { label: "मराठी", available: false, deva: true },
};

export const allVibes = ["Romantic", "Flirty", "Shy", "Bold", "Poetic", "Witty"] as const;
export const allInterests = ["Bollywood", "Cricket", "Music", "Books", "Movies", "Chai"] as const;

export type CompanionFilters = {
  gender?: Gender;
  language?: Language;
  vibe?: string;
  interest?: string;
  q?: string;
};

export function findCompanions(f: CompanionFilters = {}) {
  const q = f.q?.trim().toLowerCase();
  return companions.filter(
    (c) =>
      (!f.gender || c.gender === f.gender) &&
      (!f.language || c.languages.includes(f.language)) &&
      (!f.vibe || c.vibes.includes(f.vibe)) &&
      (!f.interest || c.interests.some((i) => i.toLowerCase() === f.interest!.toLowerCase())) &&
      (!q || [c.name, c.city, c.occupation, ...c.vibes, ...c.interests].some((s) => s.toLowerCase().includes(q))),
  );
}

export function getCompanion(slug: string) {
  return companions.find((c) => c.slug === slug) ?? null;
}
