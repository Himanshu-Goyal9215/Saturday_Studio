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

interface OpenAICompatMessage {
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

export interface OpenAICompatProviderConfig {
  provider: "openrouter" | "groq";
  apiKey: string;
  baseUrl: string;
  models: string[];
  extraHeaders?: Record<string, string>;
}

export function buildOpenRouterConfig(apiKey: string): OpenAICompatProviderConfig {
  return {
    provider: "openrouter",
    apiKey,
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-haiku",
    ].filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx),
    extraHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Saturday Studio Planner",
    },
  };
}

export function buildGroqConfig(apiKey: string): OpenAICompatProviderConfig {
  return {
    provider: "groq",
    apiKey,
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    models: [
      process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b",
    ].filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx),
  };
}

const MAX_TOOL_TURNS = 10;

export async function runOpenAICompatPlanner(params: {
  configs: OpenAICompatProviderConfig[];
  geminiApiKey?: string;
  openrouterApiKey?: string;
  groqApiKey?: string;
  systemPrompt: string;
  messages: ClientChatMessage[];
  state: AgentSessionState;
  emit: (event: StreamEvent) => void;
}): Promise<void> {
  const {
    configs,
    geminiApiKey,
    openrouterApiKey,
    groqApiKey,
    systemPrompt,
    messages,
    state,
    emit,
  } = params;

  const recentMessages = messages.filter((m) => m.content.trim().length > 0).slice(-6);
  const compatMessages: OpenAICompatMessage[] = [
    { role: "system", content: systemPrompt },
    ...recentMessages.map((m) => ({
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

  // Flatten provider+model pairs so we fail over seamlessly (e.g. OpenRouter -> Groq)
  const endpoints = configs.flatMap((cfg) =>
    cfg.models.map((model) => ({ cfg, model })),
  );
  let endpointIdx = 0;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    let msg:
      | {
          content?: string | null;
          reasoning?: string | null;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        }
      | undefined;

    while (endpointIdx < endpoints.length) {
      const { cfg, model } = endpoints[endpointIdx];
      emit({
        type: "model_info",
        model: `${cfg.provider}/${model}`,
      });

      const res = await fetch(cfg.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
          ...(cfg.extraHeaders || {}),
        },
        body: JSON.stringify({
          model,
          messages: compatMessages,
          tools,
          tool_choice: "auto",
          temperature: 0.4,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (
          (res.status === 402 ||
            res.status === 404 ||
            res.status === 413 ||
            res.status === 429 ||
            res.status === 503) &&
          endpointIdx < endpoints.length - 1
        ) {
          endpointIdx++;
          const next = endpoints[endpointIdx];
          emit({
            type: "thought_delta",
            delta: `Switching to ${next.cfg.provider}/${next.model}...\n`,
          });
          continue;
        }
        throw new Error(`${cfg.provider} API error (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            reasoning?: string | null;
            tool_calls?: Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string };
            }>;
          };
        }>;
      };

      msg = data.choices?.[0]?.message;
      break;
    }

    if (!msg) throw new Error("Fallback LLM returned an empty response.");

    if (msg.reasoning && msg.reasoning.trim()) {
      emit({ type: "thought_delta", delta: `${msg.reasoning.trim()}\n\n` });
    }

    const toolCalls = msg.tool_calls || [];
    compatMessages.push({
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
          openrouterApiKey,
          groqApiKey,
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

      compatMessages.push({
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
