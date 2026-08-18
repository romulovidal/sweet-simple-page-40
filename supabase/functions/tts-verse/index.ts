import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type GeminiAudioContent = {
  type?: string;
  data?: string;
  mime_type?: string;
  sample_rate?: number;
  channels?: number;
};

function createWavHeader(
  dataLength: number,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  view.setUint32(0, 0x52494646, false); // RIFF
  view.setUint32(4, 36 + dataLength, true);
  view.setUint32(8, 0x57415645, false); // WAVE
  view.setUint32(12, 0x666d7420, false); // fmt 
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false); // data
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function audioFromInteraction(body: any): GeminiAudioContent | null {
  // Some SDK-shaped responses expose the convenience property. Raw REST
  // responses expose generated content under model_output steps.
  const direct = body?.output_audio;
  if (direct?.data) return direct as GeminiAudioContent;

  const steps = Array.isArray(body?.steps) ? body.steps : [];
  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex--) {
    const content = Array.isArray(steps[stepIndex]?.content) ? steps[stepIndex].content : [];
    for (let contentIndex = content.length - 1; contentIndex >= 0; contentIndex--) {
      const item = content[contentIndex];
      if (item?.type === "audio" && typeof item?.data === "string" && item.data) {
        return item as GeminiAudioContent;
      }
    }
  }
  return null;
}

function numberFromMimeParameter(mimeType: string, name: string) {
  const match = mimeType.match(new RegExp(`(?:^|;)\\s*${name}=(\\d+)`, "i"));
  const value = Number(match?.[1]);
  return Number.isFinite(value) ? value : null;
}

function responseFromAudio(audio: GeminiAudioContent) {
  if (!audio.data) throw new Error("GEMINI_TTS_AUDIO_EMPTY");

  const bytes = decodeBase64(audio.data);
  if (!bytes.length) throw new Error("GEMINI_TTS_AUDIO_EMPTY");

  const mimeType = String(audio.mime_type ?? "").toLowerCase().trim();
  const mimeBase = mimeType.split(";", 1)[0]?.trim() ?? "";
  const rawPcm = !mimeBase || ["audio/l16", "audio/pcm", "audio/raw"].includes(mimeBase);

  if (!rawPcm) {
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": mimeType.startsWith("audio/") ? mimeType : "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const declaredRate = Number(audio.sample_rate);
  const mimeRate = numberFromMimeParameter(mimeType, "rate");
  const sampleRate = Number.isFinite(declaredRate) && declaredRate > 0
    ? Math.max(8000, declaredRate)
    : Math.max(8000, mimeRate ?? 24000);

  const declaredChannels = Number(audio.channels);
  const mimeChannels = numberFromMimeParameter(mimeType, "channels");
  const channels = Number.isFinite(declaredChannels) && declaredChannels > 0
    ? Math.max(1, Math.min(2, declaredChannels))
    : Math.max(1, Math.min(2, mimeChannels ?? 1));

  const wavHeader = createWavHeader(bytes.length, sampleRate, channels, 16);
  const wavFile = new Uint8Array(wavHeader.length + bytes.length);
  wavFile.set(wavHeader, 0);
  wavFile.set(bytes, wavHeader.length);

  return new Response(wavFile, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "audio/wav",
      "Cache-Control": "private, no-store",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    const trimmed = text.trim().slice(0, 4000);
    if (!trimmed) {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/interactions";
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            model: "gemini-3.1-flash-tts-preview",
            input: `Leia em português brasileiro, com tom acolhedor e ritmo natural:\n\n${trimmed}`,
            response_format: { type: "audio" },
            generation_config: {
              speech_config: [{ voice: "Kore" }],
            },
            store: false,
          }),
        });

        if (response.ok) {
          const body = await response.json().catch(() => null);
          const audio = audioFromInteraction(body);
          if (!audio) throw new Error("GEMINI_TTS_AUDIO_MISSING");
          return responseFromAudio(audio);
        }

        const providerBody = (await response.text().catch(() => "")).slice(0, 800);
        console.error("[tts-verse] Gemini TTS provider error", response.status, providerBody);
        lastError = new Error(`GEMINI_TTS_HTTP_${response.status}`);

        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          continue;
        }
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("GEMINI_TTS_UNKNOWN_ERROR");
        if (attempt < 3) continue;
      }
    }

    console.error("[tts-verse] Gemini TTS failed", lastError?.message ?? "unknown");
    return new Response(JSON.stringify({ error: "TTS_PROVIDER_UNAVAILABLE" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[tts-verse] request failed", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "TTS_REQUEST_FAILED" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
