import { NextRequest } from "next/server";
import { z } from "zod";
import { formatAgentError, runPlannerAgentStream } from "@/lib/agent/orchestrator";
import { ClientChatMessage, SaturdayPlan, StreamEvent, UserPreferences } from "@/types/planner";

export const maxDuration = 60;

const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      timestamp: z.string().optional(),
    }),
  ),
  preferences: z.any().optional(),
  currentPlan: z.any().optional(),
});

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const openrouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey && !openrouterApiKey && !groqApiKey) {
    return Response.json(
      {
        error:
          "Server missing LLM key. Add GEMINI_API_KEY, OPENROUTER_API_KEY, or GROQ_API_KEY to .env.local or Vercel environment variables.",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Stream closed by client
        }
      };

      try {
        await runPlannerAgentStream({
          apiKey,
          openrouterApiKey,
          groqApiKey,
          messages: parsed.data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp || new Date().toISOString(),
          })) as ClientChatMessage[],
          preferences: parsed.data.preferences as UserPreferences | undefined,
          currentPlan: parsed.data.currentPlan as SaturdayPlan | undefined,
          emit: send,
        });
      } catch (err) {
        send({
          type: "error",
          message: formatAgentError(err),
        });
        send({ type: "done" });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
