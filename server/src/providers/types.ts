export interface LLMParseResult {
  intent: string;
  slots: Record<string, string | undefined>;
  confidence: number;
}

export interface LLMProvider {
  readonly name: string;
  parse(utterance: string, systemPrompt: string): Promise<LLMParseResult>;
}
