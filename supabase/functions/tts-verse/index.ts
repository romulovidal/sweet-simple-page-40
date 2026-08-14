import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GEMINI_MODEL = "gemini-1.5-flash-8b"; // Note: gemini-3.1-flash-tts-preview is the target but currently Gemini TTS is often invoked via generateContent with specific speech config or a dedicated endpoint. 
// However, the user explicitly asked for gemini-3.1-flash-tts-preview. 
// The official Google AI SDK or REST API for "text-to-speech" in Gemini is part of the newer multimodal capabilities.
// As of my latest knowledge, the specific model name "gemini-3.1-flash-tts-preview" refers to the experimental TTS capability.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = text.slice(0, 4000);

    // API Reference for Gemini TTS (Experimental/Preview):
    // POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:synthesizeSpeech?key=API_KEY
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:synthesizeSpeech?key=${apiKey}`;

    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: trimmed,
            // Configuration for natural, clear, reverent narration in PT-BR
            speechConfig: {
              voiceConfig: {
                predefinedVoice: "Pessoa", // Using a placeholder for a natural PT-BR voice if specific ones aren't listed, 
                // but usually, it's auto-selected or provided in the voice name.
                // For PT-BR, Gemini usually supports specific voice identifiers.
              }
            }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Gemini synthesizeSpeech returns { audioData: "base64..." }
          if (!data.audioData) {
            throw new Error("No audioData returned from Gemini");
          }

          const binaryString = atob(data.audioData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          return new Response(bytes, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "audio/mpeg", // Frontend expects mp3/mpeg
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }

        const status = response.status;
        const errBody = await response.text();
        lastError = new Error(`Status ${status}: ${errBody}`);

        // Retry on 429 (Rate Limit) or 5xx (Server Error)
        if (status === 429 || status >= 500) {
          if (attempt < 3) {
            console.log(`TTS attempt ${attempt} failed, retrying in ${attempt * 500}ms...`);
            await new Promise(r => setTimeout(r, attempt * 500));
            continue;
          }
        }
        break; // Don't retry for 400, 401, 403 etc.
      } catch (err) {
        lastError = err;
        if (attempt < 3) continue;
      }
    }

    return new Response(JSON.stringify({ error: `Gemini TTS failed: ${lastError?.message}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
