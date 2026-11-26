export async function GET() {
  return Response.json({
    ok: true,
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY?.trim() ||
        process.env.OPENROUTER_API_KEY?.trim() ||
        process.env.GROQ_API_KEY?.trim(),
    ),
    timestamp: new Date().toISOString(),
  });
}
