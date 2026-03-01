import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMParseResult } from "./types";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-20250514") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async parse(
    utterance: string,
    systemPrompt: string
  ): Promise<LLMParseResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 200,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: "user", content: utterance }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`LLM returned non-JSON: ${text.slice(0, 200)}`);
    }

    return JSON.parse(jsonMatch[0]) as LLMParseResult;
  }
}
