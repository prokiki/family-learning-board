import { getProvider } from "@/lib/ai-providers";
export function getAISettings() {
  const provider = getProvider(process.env.AI_PROVIDER || "openai");
  if (!provider) throw new Error("AI provider not configured");
  return {
    apiKey: process.env.AI_API_KEY || (provider.id === "openai" ? process.env.OPENAI_API_KEY : "") || "",
    model: process.env.AI_MODEL || provider.models[0].id,
    baseURL: provider.baseURL,
    soulDesc: process.env.AI_SOUL || "",
  };
}
