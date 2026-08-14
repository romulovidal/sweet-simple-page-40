import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Encapsulates raw PCM (16-bit, 24kHz, mono) into a WAV container.
 */
function createWavHeader(dataLength: number): Uint8Array {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  /* RIFF identifier */
  view.setUint32(0, 0x52494646, false); // "RIFF"
  /* file length */
  view.setUint32(4, 36 + dataLength, true);
  /* RIFF type */
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  /* format chunk identifier */
  view.setUint32(12, 0x666d7420, false); // "fmt "
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM = 1) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * numChannels * bitsPerSample/8) */
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  /* block align (numChannels * bitsPerSample/8) */
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  /* bits per sample */
  view.setUint16(34, bitsPerSample, true);
  
  /* data chunk identifier */
  view.setUint32(36, 0x64617461, false); // "data"
  /* data chunk length */
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
}

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

    // Endpoint for Gemini 1.5/3.1 Multimodal TTS (Preview)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:synthesizeSpeech?key=${apiKey}`;

    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            speechConfig: {
              voiceConfig: {
                // Using Gemini's auto-selection for a natural PT-BR narration
                // 'Pessoa' was a placeholder, we let it default or use generic natural specs if available.
              }
            }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.audioData) {
            throw new Error("No audioData returned from Gemini");
          }

          // Gemini synthesizeSpeech returns raw PCM bytes encoded in Base64.
          // Format is typically 16-bit PCM, 24kHz, Mono.
          const binaryString = atob(data.audioData);
          const pcmData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pcmData[i] = binaryString.charCodeAt(i);
          }

          // Encapsulate PCM in a WAV container so the browser/frontend can play it.
          const wavHeader = createWavHeader(pcmData.length);
          const wavFile = new Uint8Array(wavHeader.length + pcmData.length);
          wavFile.set(wavHeader, 0);
          wavFile.set(pcmData, wavHeader.length);

          return new Response(wavFile, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "audio/wav",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }

        const status = response.status;
        const errBody = await response.text();
        lastError = new Error(`Status ${status}: ${errBody}`);

        if (status === 429 || status >= 500) {
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 500));
            continue;
          }
        }
        break;
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
