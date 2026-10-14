import "server-only";

/**
 * ESTIMATED provider costs in USD, used only for internal cost tracking
 * (usage_events). They are not shown to users. Replace with numbers from your
 * invoices; every value can be overridden with an env var.
 */
const n = (raw: string | undefined, fallback: number) => (raw && Number.isFinite(Number(raw)) ? Number(raw) : fallback);

export const unitCosts = {
  // Claude, per million tokens (Anthropic list prices).
  llm: {
    "claude-opus-5-5": { in: 4, out: 20 },
    "claude-sonnet-5-5": { in: 2, out: 10 },
    "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  } as Record<string, { in: number; out: number }>,
  imagePerImage: { "fal-ai/flux/dev": n(process.env.COST_FLUX_DEV, 0.025), "fal-ai/flux/schnell": n(process.env.COST_FLUX_SCHNELL, 0.003) } as Record<string, number>,
  videoPerSecond: {
    "fal-ai/kling-video/v3/pro/text-to-video": n(process.env.COST_KLING_PER_S, 0.1),
    "fal-ai/kling-video/v3/pro/image-to-video": n(process.env.COST_KLING_PER_S, 0.1),
    "fal-ai/bytedance/seedance/v1/pro/text-to-video": n(process.env.COST_SEEDANCE_PER_S, 0.06),
  } as Record<string, number>,
  ttsPerChar: { sarvam: n(process.env.COST_SARVAM_TTS_PER_CHAR, 0.00002), elevenlabs: n(process.env.COST_ELEVENLABS_TTS_PER_CHAR, 0.0002) } as Record<string, number>,
  sttPerMinute: { sarvam: n(process.env.COST_SARVAM_STT_PER_MIN, 0.005), elevenlabs: n(process.env.COST_ELEVENLABS_STT_PER_MIN, 0.007) } as Record<string, number>,
};

export function llmCost(model: string, inputTokens: number, outputTokens: number) {
  const p = unitCosts.llm[model] ?? unitCosts.llm["claude-opus-5-5"];
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
}
