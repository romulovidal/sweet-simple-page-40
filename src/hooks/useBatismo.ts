import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  batismoDb,
  type BatismoCertificado,
  type BatismoConfig,
  type BatismoInscricao,
  type BatismoLicao,
  type BatismoTentativa,
} from "@/lib/batismo";

/** Configurações do curso (linha única editável no admin). */
export function useBatismoConfig() {
  const [config, setConfig] = useState<BatismoConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await batismoDb()
        .from("batismo_configuracoes")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (!cancelled) {
        setConfig((data as BatismoConfig) || null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading };
}

/** Lições ativas do curso, em ordem. */
export function useBatismoLicoes() {
  const [licoes, setLicoes] = useState<BatismoLicao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await batismoDb()
        .from("batismo_licoes")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (!cancelled) {
        setLicoes((data as BatismoLicao[]) || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { licoes, loading };
}

/** Inscrição, tentativas e certificado do usuário logado. */
export function useMinhaInscricao() {
  const { user, loading: authLoading } = useAuth();
  const [inscricao, setInscricao] = useState<BatismoInscricao | null>(null);
  const [tentativas, setTentativas] = useState<BatismoTentativa[]>([]);
  const [certificado, setCertificado] = useState<BatismoCertificado | null>(null);
  const [loading, setLoading] = useState(true);

  const recarregar = useCallback(async () => {
    if (!user) {
      setInscricao(null);
      setTentativas([]);
      setCertificado(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = batismoDb();
    const { data: insc } = await db
      .from("batismo_inscricoes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!insc) {
      setInscricao(null);
      setTentativas([]);
      setCertificado(null);
      setLoading(false);
      return;
    }

    setInscricao(insc as BatismoInscricao);
    const [tentRes, certRes] = await Promise.all([
      db
        .from("batismo_tentativas")
        .select("*")
        .eq("inscricao_id", insc.id)
        .order("iniciada_em", { ascending: true }),
      db.from("batismo_certificados").select("*").eq("inscricao_id", insc.id).maybeSingle(),
    ]);
    setTentativas((tentRes.data as BatismoTentativa[]) || []);
    setCertificado((certRes.data as BatismoCertificado) || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void recarregar();
  }, [authLoading, recarregar]);

  return { inscricao, tentativas, certificado, loading, recarregar };
}
