import type { LLMProvider, LLMParseResult } from "./types.js";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";

  constructor(_apiKey: string, _model?: string) {
    throw new Error(
      "OpenAI provider not yet implemented. Set LLM_PROVIDER=anthropic."
    );
  }

  async parse(
    _utterance: string,
    _systemPrompt: string
  ): Promise<LLMParseResult> {
    throw new Error("Not implemented");
  }
}
