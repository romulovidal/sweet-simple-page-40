from pathlib import Path

PATH = Path("supabase/functions/atis-webhook/index.ts")
text = PATH.read_text()


def once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, got {count}")
    text = text.replace(old, new, 1)

once(
    '  resolvePendingPrayer,\n  setConversationMode,',
    '  resolvePendingPrayer,\n  sanitizeAtisLinks,\n  setConversationMode,',
    'sanitize import',
)

once(
    '''  let sent: any = null;\n  let usedButtons = false;\n  if (withButtons && profile.enable_buttons && route) {\n    try {\n      sent = await provider.sendButtons(instanceName, target, text, assistantButtons(route));''',
    '''  const safeText = sanitizeAtisLinks(text);\n  let sent: any = null;\n  let usedButtons = false;\n  if (withButtons && profile.enable_buttons && route) {\n    try {\n      sent = await provider.sendButtons(instanceName, target, safeText, assistantButtons(route));''',
    'sanitize before provider',
)

once(
    '  if (!sent) sent = await provider.sendText(instanceName, target, text);\n\n  let audioSent = false;\n  if (profile.enable_audio && text.length <= 1800) {',
    '  if (!sent) sent = await provider.sendText(instanceName, target, safeText);\n\n  let audioSent = false;\n  if (profile.enable_audio && safeText.length <= 1800) {',
    'safe text send/audio length',
)

once(
    '        const cleanText = text.replace(/https?:\\/\\/\\S+/g, "").replace(/[\\*_`>#]/g, " ").replace(/\\s+/g, " ").trim().slice(0, 1200);',
    '        const cleanText = safeText.replace(/https?:\\/\\/\\S+/g, "").replace(/[\\*_`>#]/g, " ").replace(/\\s+/g, " ").trim().slice(0, 1200);',
    'safe text TTS',
)

PATH.write_text(text)
print("ATIS v35e webhook egress link guard applied")
