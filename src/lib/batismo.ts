import { supabase } from "@/integrations/supabase/client";
import { BRAZIL_TIME_ZONE } from "@/lib/date";

// ============================================================
// Plataforma de Batismo — Ministério Atalaias de Betel
// Tipos e helpers compartilhados (aluno + admin).
// As tabelas batismo_* ainda não estão no types.ts gerado, por
// isso o acesso usa o cast `as never` (padrão já usado no repo).
// ============================================================

export interface BatismoConfig {
  id: number;
  media_minima: number;
  questoes_por_exercicio: number;
  questoes_prova_final: number;
  tempo_exercicio_min: number;
  tempo_prova_final_min: number;
  intervalo_liberacao_horas: number;
  inscricoes_abertas: boolean;
}

export interface BatismoReferencia {
  referencia: string;
  texto: string;
}

export interface BatismoLicao {
  id: string;
  ordem: number;
  titulo: string;
  objetivo: string;
  conteudo: string;
  versiculo_chave: string;
  versiculo_referencia: string;
  referencias: BatismoReferencia[];
  frase_para_guardar: string;
  ativo: boolean;
}

export type BatismoStatus =
  | "inscrito"
  | "em_andamento"
  | "aprovado"
  | "reprovado"
  | "conversa_realizada"
  | "certificado_gerado";

export interface BatismoInscricao {
  id: string;
  user_id: string;
  nome: string;
  data_nascimento: string;
  whatsapp: string | null;
  whatsapp_responsavel: string | null;
  nome_responsavel: string | null;
  status: BatismoStatus;
  iniciado_em: string;
  recuperacao_autorizada: boolean;
  conversa_em: string | null;
  data_batismo: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatismoQuestaoSorteada {
  codigo: string;
  enunciado: string;
  alternativas: string[];
}

export type BatismoTentativaTipo = "exercicio" | "prova_final" | "recuperacao";

export interface BatismoTentativa {
  id: string;
  inscricao_id: string;
  tipo: BatismoTentativaTipo;
  licao_id: string | null;
  questoes_sorteadas: BatismoQuestaoSorteada[];
  iniciada_em: string;
  prazo_em: string;
  enviada_em: string | null;
  status: "em_andamento" | "enviada";
  nota: number | null;
  acertos: number | null;
  total: number;
  termos_aceitos_em: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface BatismoCertificado {
  id: string;
  inscricao_id: string;
  codigo: string;
  emitido_em: string;
  pdf_path: string | null;
  valido: boolean;
}

export interface BatismoQuestaoBanco {
  id: string;
  codigo: string;
  licao_id: string | null;
  tipo: "exercicio" | "prova_final";
  enunciado: string;
  alternativas: string[];
  resposta_correta: string;
  ativo: boolean;
}

export const CURSO_NOME = "Curso de Preparação para o Batismo";
export const MINISTERIO_NOME = "Ministério Atalaias de Betel";

export const STATUS_LABELS: Record<BatismoStatus, string> = {
  inscrito: "Inscrito",
  em_andamento: "Em andamento",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  conversa_realizada: "Conversa realizada",
  certificado_gerado: "Certificado gerado",
};

/** Acesso às tabelas batismo_* (ainda fora do types.ts gerado). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const batismoDb = () => supabase as any;

// ------------------------------------------------------------
// Datas e cronograma (fuso America/Fortaleza)
// ------------------------------------------------------------

/** Data/hora em que a lição `ordem` libera para quem começou em `iniciadoEm`. */
export function dataLiberacaoLicao(iniciadoEm: Date, ordem: number, intervaloHoras: number): Date {
  return new Date(iniciadoEm.getTime() + (ordem - 1) * intervaloHoras * 60 * 60 * 1000);
}

export function formatarDataBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatarDataHoraBR(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Idade (anos completos) a partir de uma data ISO yyyy-mm-dd. */
export function calcularIdade(dataNascimento: string): number {
  const nascimento = new Date(`${dataNascimento}T12:00:00`);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade -= 1;
  return idade;
}

export function ehMenorDeIdade(dataNascimento: string): boolean {
  return calcularIdade(dataNascimento) < 18;
}

/** Média final: média das notas dos exercícios + nota da prova. */
export function calcularMedia(notasExercicios: number[], notaProva: number | null): number | null {
  if (notaProva === null || notasExercicios.length === 0) return null;
  const todas = [...notasExercicios, notaProva];
  return todas.reduce((acc, n) => acc + n, 0) / todas.length;
}

/** Nota da prova que vale para a média: recuperação enviada substitui a prova final. */
export function notaProvaValida(tentativas: BatismoTentativa[]): number | null {
  const recuperacao = tentativas
    .filter((t) => t.tipo === "recuperacao" && t.status === "enviada" && t.nota !== null)
    .sort((a, b) => (b.enviada_em || "").localeCompare(a.enviada_em || ""))[0];
  if (recuperacao) return Number(recuperacao.nota);
  const prova = tentativas
    .filter((t) => t.tipo === "prova_final" && t.status === "enviada" && t.nota !== null)
    .sort((a, b) => (b.enviada_em || "").localeCompare(a.enviada_em || ""))[0];
  return prova ? Number(prova.nota) : null;
}

/** Tentativa enviada (travada) de exercício de uma lição, se existir. */
export function exercicioDaLicao(
  tentativas: BatismoTentativa[],
  licaoId: string,
): BatismoTentativa | undefined {
  return tentativas.find(
    (t) => t.tipo === "exercicio" && t.licao_id === licaoId && t.status === "enviada",
  );
}

export type EstadoLicao = "concluida" | "liberada" | "aguardando_data" | "aguardando_anterior";

/** Estado de cada lição para o aluno, considerando ritmo e ordem. */
export function estadoDaLicao(
  licao: BatismoLicao,
  licoes: BatismoLicao[],
  tentativas: BatismoTentativa[],
  iniciadoEm: Date,
  intervaloHoras: number,
  agora: Date = new Date(),
): EstadoLicao {
  if (exercicioDaLicao(tentativas, licao.id)) return "concluida";
  const anterior = licoes.find((l) => l.ordem === licao.ordem - 1);
  if (anterior && !exercicioDaLicao(tentativas, anterior.id)) return "aguardando_anterior";
  const liberacao = dataLiberacaoLicao(iniciadoEm, licao.ordem, intervaloHoras);
  if (agora < liberacao) return "aguardando_data";
  return "liberada";
}

/** Avisa os administradores sobre um evento do batismo (push só para admin/super_admin). */
export async function notificarAdminsBatismo(
  evento: "nova_inscricao" | "aprovado" | "recuperacao_pendente",
  inscricaoId: string,
): Promise<void> {
  try {
    await supabase.functions.invoke("batismo-notify", {
      body: { mode: "admin_event", event: evento, inscricao_id: inscricaoId },
    });
  } catch (err) {
    // Aviso é acessório: nunca bloqueia o fluxo do aluno.
    console.error("[batismo] Falha ao notificar admins:", err);
  }
}
