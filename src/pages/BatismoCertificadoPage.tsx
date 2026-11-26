import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHead from "@/components/PageHead";
import { useMinhaInscricao } from "@/hooks/useBatismo";
import { batismoDb, formatarDataBR } from "@/lib/batismo";
import { toast } from "sonner";
import { ArrowLeft, Award, Download, Loader2 } from "lucide-react";

/** Página do certificado do aluno: baixa o PDF via URL assinada. */
const BatismoCertificadoPage = () => {
  const navigate = useNavigate();
  const { inscricao, certificado, loading } = useMinhaInscricao();
  const [baixando, setBaixando] = useState(false);

  const baixar = async () => {
    if (!certificado?.pdf_path) return;
    setBaixando(true);
    try {
      const { data, error } = await batismoDb()
        .storage.from("certificados")
        .createSignedUrl(certificado.pdf_path, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível gerar o link de download. Tente novamente.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="pb-24 min-h-screen">
      <PageHead
        title="Meu certificado — Bíblia do Atalaia"
        description="Certificado do Curso de Preparação para o Batismo do Ministério Atalaias de Betel."
        path="/batismo/certificado"
      />

      <header className="px-5 pt-12 pb-4 max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={() => navigate("/batismo/curso")}
          aria-label="Voltar"
          className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold leading-tight">Meu certificado</h1>
      </header>

      <div className="px-5 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !certificado ? (
          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-6 text-center space-y-3">
            <Award className="w-8 h-8 mx-auto text-[hsl(var(--dark-muted))]" />
            <p className="text-base font-semibold">Certificado ainda não disponível</p>
            <p className="text-sm text-[hsl(var(--dark-muted))]">
              {inscricao?.status === "aprovado" || inscricao?.status === "conversa_realizada"
                ? "Você já foi aprovado(a)! A liderança vai gerar seu certificado em breve."
                : "Conclua o curso com média suficiente para receber o certificado."}
            </p>
            <Button onClick={() => navigate("/batismo/curso")} variant="secondary">
              Voltar ao curso
            </Button>
          </div>
        ) : (
          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-6 text-center space-y-3 border border-amber-600/25 dark:border-amber-400/20">
            <Award className="w-10 h-10 mx-auto text-amber-500" />
            <p className="text-lg font-bold">Parabéns, {inscricao?.nome.split(" ")[0]}!</p>
            <p className="text-sm text-[hsl(var(--dark-muted))] leading-relaxed">
              Seu certificado do Curso de Preparação para o Batismo está pronto.
            </p>
            <div className="text-sm space-y-1">
              <p>
                Código: <strong>{certificado.codigo}</strong>
              </p>
              <p className="text-[hsl(var(--dark-muted))]">
                Emitido em {formatarDataBR(new Date(certificado.emitido_em))}
              </p>
            </div>
            <Button onClick={() => void baixar()} disabled={baixando} className="w-full h-12 text-base">
              {baixando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Baixar certificado (PDF)
            </Button>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">
              O QR Code do certificado permite confirmar a autenticidade dele.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatismoCertificadoPage;
