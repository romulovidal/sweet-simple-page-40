import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHead from "@/components/PageHead";
import { batismoDb } from "@/lib/batismo";
import { BadgeCheck, BadgeX, Loader2, Search } from "lucide-react";

interface ResultadoValidacao {
  valido: boolean;
  codigo?: string;
  nome?: string;
  curso?: string;
  ministerio?: string;
  /** Já formatada pela RPC (DD/MM/YYYY). */
  data_conclusao?: string;
}

/**
 * Página PÚBLICA de validação de certificado (destino do QR Code).
 * Consulta por código via RPC — expõe apenas nome/curso/data/validade.
 */
const ValidarCertificadoPage = () => {
  const [searchParams] = useSearchParams();
  const [codigo, setCodigo] = useState(searchParams.get("codigo") || "");
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [buscando, setBuscando] = useState(false);

  const validar = async (cod: string) => {
    const limpo = cod.trim().toUpperCase();
    if (!limpo) return;
    setBuscando(true);
    setResultado(null);
    try {
      const { data, error } = await batismoDb().rpc("validar_certificado", {
        p_codigo: limpo,
      });
      if (error) throw error;
      setResultado(data as ResultadoValidacao);
    } catch {
      setResultado({ valido: false });
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    const cod = searchParams.get("codigo");
    if (cod) void validar(cod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="pb-24 min-h-screen">
      <PageHead
        title="Validar certificado — Bíblia do Atalaia"
        description="Confirme a autenticidade de um certificado do Curso de Preparação para o Batismo do Ministério Atalaias de Betel."
        path="/validar-certificado"
      />

      <header className="px-5 pt-12 pb-4 max-w-2xl mx-auto text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400/90 font-semibold">
          Ministério Atalaias de Betel
        </p>
        <h1 className="text-2xl font-bold mt-2">Validar certificado</h1>
        <p className="text-sm text-[hsl(var(--dark-muted))] mt-2">
          Informe o código impresso no certificado (ex.: AB-2026-0001) para confirmar a
          autenticidade.
        </p>
      </header>

      <div className="px-5 max-w-2xl mx-auto space-y-4">
        <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-5 space-y-3">
          <Label htmlFor="validar-codigo">Código do certificado</Label>
          <div className="flex gap-2">
            <Input
              id="validar-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="AB-2026-0001"
              className="bg-[hsl(var(--dark-bg))] border-none flex-1"
            />
            <Button onClick={() => void validar(codigo)} disabled={buscando} className="h-10">
              {buscando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-1.5" />
              )}
              Validar
            </Button>
          </div>
        </div>

        {resultado &&
          (resultado.valido ? (
            <div className="rounded-2xl bg-green-500/10 border border-green-500/25 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-6 h-6 text-green-400" />
                <p className="text-base font-bold">Certificado válido</p>
              </div>
              <dl className="text-sm space-y-1.5 pt-1">
                <div className="flex justify-between gap-3">
                  <dt className="text-[hsl(var(--dark-muted))]">Nome</dt>
                  <dd className="font-semibold text-right">{resultado.nome}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[hsl(var(--dark-muted))]">Curso</dt>
                  <dd className="font-semibold text-right">{resultado.curso}</dd>
                </div>
                {resultado.ministerio && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[hsl(var(--dark-muted))]">Ministério</dt>
                    <dd className="font-semibold text-right">{resultado.ministerio}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-[hsl(var(--dark-muted))]">Código</dt>
                  <dd className="font-semibold text-right">{resultado.codigo}</dd>
                </div>
                {resultado.data_conclusao && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[hsl(var(--dark-muted))]">Emitido em</dt>
                    <dd className="font-semibold text-right">{resultado.data_conclusao}</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/25 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <BadgeX className="w-6 h-6 text-destructive" />
                <p className="text-base font-bold">Certificado não encontrado</p>
              </div>
              <p className="text-sm text-[hsl(var(--dark-muted))]">
                Não localizamos um certificado com esse código. Confira se digitou corretamente
                (formato AB-AAAA-NNNN).
              </p>
            </div>
          ))}
      </div>
    </div>
  );
};

export default ValidarCertificadoPage;
