type ToolName =
  | "task.create"
  | "crm.updateClient"
  | "crm.searchClient"
  | "crm.openClient";

interface RunToolRequest {
  tool: ToolName;
  userId: string;
  traceId?: string;
  input: Record<string, unknown>;
}

interface RunToolResponse {
  ok: boolean;
  output?: unknown;
  error?: string;
}

interface SearchClientOutput {
  matches: Array<{ id: string; name: string }>;
}

const AI_TOOL_ENDPOINT = import.meta.env.VITE_AI_TOOL_ENDPOINT || "/api/runTool";
const AI_TOOL_USER_ID = import.meta.env.VITE_AI_TOOL_USER_ID || "demo-user";

export async function runTool(
  tool: ToolName,
  input: Record<string, unknown>,
  traceId?: string
): Promise<RunToolResponse> {
  const payload: RunToolRequest = {
    tool,
    input,
    userId: AI_TOOL_USER_ID,
    traceId,
  };

  try {
    const response = await fetch(AI_TOOL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as RunToolResponse;
    if (!response.ok) {
      return { ok: false, error: data.error || "tool request failed" };
    }
    return data;
  } catch {
    return { ok: false, error: "tool request failed" };
  }
}

export async function searchClientOnServer(query: string): Promise<{
  ok: boolean;
  matches: Array<{ id: string; name: string }>;
  error?: string;
}> {
  const result = await runTool("crm.searchClient", { query });
  if (!result.ok) {
    return { ok: false, matches: [], error: result.error };
  }
  const output = result.output as SearchClientOutput | undefined;
  return { ok: true, matches: output?.matches || [] };
}
