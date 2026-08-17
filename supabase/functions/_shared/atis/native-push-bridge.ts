export type NativePushBridgeInput = {
  type: string;
  title: string;
  body: string;
  url?: string | null;
  eventKey: string;
};

export async function enqueueNativePushForAtis(supabase: any, input: NativePushBridgeInput) {
  try {
    const { data, error } = await supabase.rpc("atis_enqueue_native_push_event", {
      _push_type: input.type,
      _title: input.title,
      _body: input.body,
      _url: input.url ?? null,
      _event_key: input.eventKey,
    });
    if (error) {
      console.error("[atis-native-push] enqueue failed", error.message);
      return { ok: false, error: error.message, created: 0, skipped: 0 };
    }
    return {
      ok: true,
      created: Number(data?.created ?? 0),
      skipped: Number(data?.skipped ?? 0),
      eventKey: data?.event_key ?? input.eventKey,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATIS_NATIVE_PUSH_BRIDGE_ERROR";
    console.error("[atis-native-push] enqueue threw", message);
    return { ok: false, error: message, created: 0, skipped: 0 };
  }
}
