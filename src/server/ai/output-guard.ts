import "server-only";

/**
 * Last-line check on companion replies, mainly for providers that follow
 * system instructions less reliably. Catches explicit sexual content and any
 * sexual/romantic content near minor-coded terms. Not a full classifier.
 */
const minor = /\b(child|children|kid|kids|minor|underage|teen|teens|teenage|teenager|schoolgirl|schoolboy|loli|preteen|little girl|little boy|1[0-7] ?(?:yo|years? old))\b/i;
const romanticOrSexual = /\b(kiss|kissing|sexy|sex|sexual|naked|nude|touch(?:ing)?|bed|seduc\w*|aroused|horny|lust\w*)\b/i;
const explicit = /\b(penis|vagina|pussy|dick|cock|clit\w*|nipple\w*|orgasm\w*|cum|cumming|blowjob|handjob|intercourse|masturbat\w*|genital\w*|thrust\w*|erect\w*)\b/i;

export const SAFE_REPLACEMENT = "Let's keep it sweet, not explicit. Tell me about your day instead? 🙂";

export function unsafeReply(text: string) {
  return explicit.test(text) || (minor.test(text) && romanticOrSexual.test(text));
}
