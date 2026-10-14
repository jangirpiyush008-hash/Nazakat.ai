/**
 * Languages companions chat (and speak) in. To add a regional language later:
 * add a row here (Sarvam supports bn/ta/te/mr/gu/kn/ml/od/pa for voice), widen
 * the profiles.chat_language check constraint and complete_onboarding() in a
 * migration, and update the language line in server/ai/prompt.ts.
 */
export const chatLanguages = [
  { id: "hinglish", label: "Hinglish", native: "Hinglish", voice: "hi-IN", prompt: "Hinglish (Hindi in Latin letters mixed with English, the way young urban Indians text)" },
  { id: "english", label: "English", native: "English", voice: "en-IN", prompt: "English" },
  { id: "hindi", label: "Hindi", native: "हिन्दी", voice: "hi-IN", prompt: "Hindi in Devanagari script" },
] as const;

export type ChatLanguage = (typeof chatLanguages)[number]["id"];
export const chatLanguageIds = chatLanguages.map((l) => l.id) as [ChatLanguage, ...ChatLanguage[]];
export const languageById = (id: string) => chatLanguages.find((l) => l.id === id) ?? chatLanguages[0];
