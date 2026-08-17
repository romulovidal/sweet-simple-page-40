export function assistantFailureReply(reason: string) {
  if (reason === "ai_provider_unavailable" || reason === "ai_empty_response") {
    return "⚠️ Não consegui concluir sua resposta com o recurso de IA agora. Para não inventar conteúdo, interrompi essa resposta. Os recursos diretos do app — Bíblia, Harpa, cultos e cânticos — continuam disponíveis por aqui.";
  }
  if (reason === "source_unavailable") {
    return "⚠️ Não consegui acessar a fonte do app necessária para responder com segurança. Por isso, não vou completar a resposta com informação inventada. Você pode consultar outro recurso do ATIS normalmente.";
  }
  return null;
}
