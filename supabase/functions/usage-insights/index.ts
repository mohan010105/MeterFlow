// Edge function: summarize usage stats with Lovable AI.
// The frontend computes the stats (it has RLS-scoped access) and posts them
// here for a plain-English summary + anomalies.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InsightsPayload {
  total: number;
  last24h: number;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  topApis: { name: string; count: number }[];
  perDay: { date: string; count: number; errors: number }[];
  envSplit: { test: number; live: number };
  topEndpoints: { endpoint: string; count: number }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI gateway not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stats = (await req.json()) as InsightsPayload;

    if (!stats || typeof stats.total !== "number") {
      return new Response(JSON.stringify({ error: "Invalid stats payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (stats.total === 0) {
      return new Response(
        JSON.stringify({
          summary:
            "No usage data has been recorded yet. Start sending requests to /api/track to see insights here.",
          anomalies: [],
          recommendations: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are a senior SRE assistant analyzing API usage data for a developer dashboard.
Be concise, specific, and quantitative. Use plain English. Cite numbers from the data.
Never invent data. If something is unclear or missing, say so.`;

    const userPrompt = `Analyze this API usage data and respond using the report_insights tool:

Total requests: ${stats.total}
Last 24h: ${stats.last24h}
Success: ${stats.successCount}, Errors: ${stats.errorCount}
Average latency (recent): ${stats.avgLatencyMs}ms
Environment split — test: ${stats.envSplit.test}, live: ${stats.envSplit.live}

Top APIs by volume:
${stats.topApis.map((a) => `- ${a.name}: ${a.count}`).join("\n") || "(none)"}

Top endpoints by volume:
${stats.topEndpoints.map((e) => `- ${e.endpoint}: ${e.count}`).join("\n") || "(none)"}

Daily volume (last 7 days):
${stats.perDay.map((d) => `- ${d.date}: ${d.count} requests, ${d.errors} errors`).join("\n") || "(none)"}

Look for: error spikes, latency outliers, traffic shifts between environments, dead/dominant endpoints, and notable trends.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_insights",
                description:
                  "Return a structured summary of the usage data with anomalies and recommendations.",
                parameters: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "string",
                      description:
                        "2-4 sentence plain-English summary of overall usage health and trends.",
                    },
                    anomalies: {
                      type: "array",
                      description:
                        "Notable anomalies (error spikes, latency outliers, unusual drops). Empty array if none.",
                      items: {
                        type: "object",
                        properties: {
                          severity: {
                            type: "string",
                            enum: ["low", "medium", "high"],
                          },
                          title: { type: "string" },
                          detail: { type: "string" },
                        },
                        required: ["severity", "title", "detail"],
                        additionalProperties: false,
                      },
                    },
                    recommendations: {
                      type: "array",
                      description:
                        "Actionable suggestions (max 3). Empty array if everything looks healthy.",
                      items: { type: "string" },
                    },
                  },
                  required: ["summary", "anomalies", "recommendations"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "report_insights" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error:
              "Rate limit reached on AI insights. Please try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "AI insights credits exhausted. Add funds in workspace settings.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const t = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway request failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await aiResponse.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI did not return structured insights" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const insights = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(insights), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("usage-insights error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
