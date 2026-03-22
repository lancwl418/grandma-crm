import OpenAI from "openai";
import type { LLMProvider, LLMParseResult } from "./types.js";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async parse(
    utterance: string,
    systemPrompt: string
  ): Promise<LLMParseResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 200,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: utterance },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`LLM returned non-JSON: ${text.slice(0, 200)}`);
    }

    return JSON.parse(jsonMatch[0]) as LLMParseResult;
  }
}
