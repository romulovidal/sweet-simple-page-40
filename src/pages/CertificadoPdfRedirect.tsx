import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PageHead from "@/components/PageHead";
import { batismoDb } from "@/lib/batismo";
import { Loader2 } from "lucide-react";

/**
 * Link curto no domínio próprio para o PDF do certificado:
 * /certificado/AB-2026-0001 → gera a URL assinada do bucket e redireciona.
 * O path no bucket segue a convenção `${codigo}.pdf`.
 */
const CertificadoPdfRedirect = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const abrir = async () => {
      const limpo = (codigo || "").trim().toUpperCase();
      if (!limpo) {
        setErro(true);
        return;
      }
      try {
        const { data, error } = await batismoDb()
          .storage.from("certificados")
          .createSignedUrl(`${limpo}.pdf`, 60 * 5);
        if (error || !data?.signedUrl) throw error || new Error("sem url");
        window.location.replace(data.signedUrl);
      } catch {
        setErro(true);
      }
    };
    void abrir();
  }, [codigo]);

  return (
    <div className="pb-24 min-h-screen">
      <PageHead
        title="Certificado — Bíblia do Atalaia"
        description="Certificado do Curso de Preparação para o Batismo do Ministério Atalaias de Betel."
        path={`/certificado/${codigo || ""}`}
      />
      <main className="px-5 pt-24 max-w-md mx-auto text-center">
        {erro ? (
          <>
            <p className="text-lg font-semibold">Certificado não encontrado</p>
            <p className="text-sm text-muted-foreground mt-2">
              Confira o código e tente novamente, ou valide o certificado pelo QR Code.
            </p>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Abrindo o certificado…
          </p>
        )}
      </main>
    </div>
  );
};

export default CertificadoPdfRedirect;
