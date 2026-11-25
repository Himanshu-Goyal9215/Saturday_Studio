import {
  ClientChatMessage,
  StreamEvent,
  ToolTraceItem,
} from "@/types/planner";
import {
  AgentSessionState,
  executePlannerTool,
  PLANNER_TOOL_DECLARATIONS,
  TOOL_LABELS,
} from "./tools";

interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MAX_TOOL_TURNS = 10;

export async function runGroqPlannerFallback(params: {
  groqApiKey: string;
  geminiApiKey?: string;
  systemPrompt: string;
  messages: ClientChatMessage[];
  state: AgentSessionState;
  emit: (event: StreamEvent) => void;
}): Promise<void> {
  const { groqApiKey, geminiApiKey, systemPrompt, messages, state, emit } = params;

  emit({
    type: "model_info",
    model: `groq/${GROQ_MODEL}`,
    fallbackFrom: "gemini",
  });

  const groqMessages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  ];

  const tools = PLANNER_TOOL_DECLARATIONS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    emit({
      type: "thought_delta",
      delta:
        turn === 0
          ? "Reasoning with Groq tool-calling planner...\n"
          : `Synthesizing tool results (step ${turn + 1})...\n`,
    });

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        tools,
        tool_choice: "auto",
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("Groq returned an empty response.");

    const toolCalls = msg.tool_calls || [];
    groqMessages.push({
      role: "assistant",
      content: msg.content ?? null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });

    if (toolCalls.length === 0) {
      if (msg.content) {
        emit({ type: "text_delta", delta: msg.content });
      }
      emit({ type: "done" });
      return;
    }

    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        args = {};
      }

      const traceStart: ToolTraceItem = {
        id: tc.id,
        name: tc.function.name,
        label: TOOL_LABELS[tc.function.name] || tc.function.name,
        status: "running",
        args,
      };
      emit({ type: "tool_start", tool: traceStart });

      const t0 = Date.now();
      let outcome;
      try {
        outcome = await executePlannerTool({
          name: tc.function.name,
          args,
          state,
          apiKey: geminiApiKey || "",
        });
      } catch (toolErr) {
        outcome = {
          status: "error" as const,
          sourceBadge: "Tool Exception",
          summary:
            toolErr instanceof Error ? toolErr.message : "Tool failed unexpectedly",
          result: {
            error:
              toolErr instanceof Error ? toolErr.message : "Unexpected tool error",
          },
        };
      }

      emit({
        type: "tool_result",
        tool: {
          ...traceStart,
          status: outcome.status,
          resultSummary: outcome.summary,
          rawResult: outcome.result,
          durationMs: Date.now() - t0,
          sourceBadge: outcome.sourceBadge,
        },
      });

      if (outcome.preferencesUpdated) {
        emit({
          type: "preferences_updated",
          preferences: outcome.preferencesUpdated,
        });
      }
      if (outcome.planUpdated) {
        emit({ type: "plan_updated", plan: outcome.planUpdated });
      }

      groqMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(outcome.result),
      });
    }
  }

  emit({
    type: "text_delta",
    delta:
      "I reached the maximum tool steps for this turn. Want me to adjust any part of your plan?",
  });
  emit({ type: "done" });
}
