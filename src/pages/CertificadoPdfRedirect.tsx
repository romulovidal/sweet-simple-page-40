import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHead from "@/components/PageHead";
import { Button } from "@/components/ui/button";
import { batismoDb } from "@/lib/batismo";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

/**
 * Visualizador do certificado no domínio próprio:
 * /certificado/AB-2026-0001 → renderiza o PDF (paisagem) dentro do app,
 * com opção de baixar. O path no bucket segue a convenção `${codigo}.pdf`.
 */
const CertificadoPdfRedirect = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const limpo = (codigo || "").trim().toUpperCase();

  // Busca a URL assinada do PDF
  useEffect(() => {
    const buscar = async () => {
      if (!limpo) {
        setErro(true);
        return;
      }
      try {
        const { data, error } = await batismoDb()
          .storage.from("certificados")
          .createSignedUrl(`${limpo}.pdf`, 60 * 10);
        if (error || !data?.signedUrl) throw error || new Error("sem url");
        setUrl(data.signedUrl);
      } catch {
        setErro(true);
      }
    };
    void buscar();
  }, [limpo]);

  // Renderiza a página do PDF no canvas (ajustada à largura, nítida no aparelho)
  useEffect(() => {
    if (!url) return;
    let cancelado = false;
    const renderizar = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const pdf = await pdfjs.getDocument({ url }).promise;
        const pagina = await pdf.getPage(1);
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || cancelado) return;
        const larguraBase = pagina.getViewport({ scale: 1 }).width;
        const escala = (container.clientWidth / larguraBase) * Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pagina.getViewport({ scale: escala });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await pagina.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        if (!cancelado) setErro(true);
      }
    };
    void renderizar();
    const aoRedimensionar = () => void renderizar();
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      cancelado = true;
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [url]);

  const baixar = async () => {
    if (!url) return;
    setBaixando(true);
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `${limpo}.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageHead
        title="Certificado — Bíblia do Atalaia"
        description="Certificado do Curso de Preparação para o Batismo do Ministério Atalaias de Betel."
        path={`/certificado/${limpo}`}
      />
      <header className="px-4 py-3 flex items-center gap-3 border-b border-border/40">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">Certificado de Batismo</p>
          <p className="text-xs text-muted-foreground">{limpo}</p>
        </div>
        <Button onClick={() => void baixar()} disabled={!url || baixando} size="sm">
          {baixando ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Baixar
        </Button>
      </header>

      <main ref={containerRef} className="flex-1 w-full max-w-5xl mx-auto px-2 py-4">
        {erro ? (
          <div className="text-center pt-24 px-5">
            <p className="text-lg font-semibold">Certificado não encontrado</p>
            <p className="text-sm text-muted-foreground mt-2">
              Confira o código e tente novamente, ou valide o certificado pelo QR Code.
            </p>
          </div>
        ) : !url ? (
          <p className="flex items-center justify-center gap-2 text-muted-foreground pt-24">
            <Loader2 className="w-5 h-5 animate-spin" /> Abrindo o certificado…
          </p>
        ) : (
          <canvas ref={canvasRef} className="w-full h-auto rounded-lg shadow-lg bg-white" />
        )}
      </main>
    </div>
  );
};

export default CertificadoPdfRedirect;
