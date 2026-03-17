import type { LLMProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";

let cachedProvider: LLMProvider | null = null;

export function getProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.LLM_PROVIDER || "anthropic";

  switch (providerName) {
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
      cachedProvider = new AnthropicProvider(
        apiKey,
        process.env.ANTHROPIC_MODEL
      );
      break;
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not set");
      cachedProvider = new OpenAIProvider(apiKey, process.env.OPENAI_MODEL);
      break;
    }
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${providerName}`);
  }

  return cachedProvider;
}
