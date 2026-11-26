import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHead from "@/components/PageHead";
import CronogramaCurso from "@/components/batismo/CronogramaCurso";
import { useBatismoConfig, useBatismoLicoes, useMinhaInscricao } from "@/hooks/useBatismo";
import { batismoDb, ehMenorDeIdade, notificarAdminsBatismo } from "@/lib/batismo";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

/**
 * Inscrição para o Batismo. Exige login no app (quem não tem conta
 * cria na hora, nesta mesma tela). Campos: nome, data de nascimento
 * e WhatsApp (menor sem WhatsApp próprio informa o do responsável).
 */
const BatismoInscricaoPage = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { config } = useBatismoConfig();
  const { licoes } = useBatismoLicoes();
  const { inscricao, loading: loadingInscricao } = useMinhaInscricao();

  // Auth (login / criar conta)
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [aguardandoEmail, setAguardandoEmail] = useState(false);

  // Formulário de inscrição
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [whatsappResponsavel, setWhatsappResponsavel] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (profile?.display_name && !nome) setNome(profile.display_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!loadingInscricao && inscricao) navigate("/batismo/curso", { replace: true });
  }, [inscricao, loadingInscricao, navigate]);

  const menor = useMemo(
    () => (dataNascimento ? ehMenorDeIdade(dataNascimento) : false),
    [dataNascimento],
  );
  const precisaResponsavel = menor && whatsapp.trim().length === 0;

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      toast.error("Informe e-mail e senha");
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/batismo/inscricao` },
        });
        if (error) throw error;
        if (!data.session) {
          setAguardandoEmail(true);
          toast.success("Conta criada! Confirme seu e-mail para continuar a inscrição.");
        } else {
          toast.success("Conta criada! Agora complete sua inscrição.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Login feito! Complete sua inscrição.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao acessar sua conta");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleInscricao = async () => {
    if (!user) return;
    if (nome.trim().length < 3) {
      toast.error("Informe seu nome completo");
      return;
    }
    if (!dataNascimento) {
      toast.error("Informe sua data de nascimento");
      return;
    }
    if (precisaResponsavel && whatsappResponsavel.trim().length < 8) {
      toast.error("Informe o WhatsApp do responsável");
      return;
    }
    if (!precisaResponsavel && whatsapp.trim().length < 8) {
      toast.error("Informe seu WhatsApp");
      return;
    }

    setEnviando(true);
    try {
      const { data, error } = await batismoDb()
        .from("batismo_inscricoes")
        .insert({
          user_id: user.id,
          nome: nome.trim(),
          data_nascimento: dataNascimento,
          whatsapp: whatsapp.trim() || null,
          whatsapp_responsavel: whatsappResponsavel.trim() || null,
          nome_responsavel: nomeResponsavel.trim() || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      toast.success("Inscrição feita! Bem-vindo(a) ao curso.");
      if (data?.id) void notificarAdminsBatismo("nova_inscricao", data.id);
      navigate("/batismo/curso");
    } catch (err: any) {
      if (String(err?.message || "").includes("WHATSAPP_RESPONSAVEL_OBRIGATORIO")) {
        toast.error("Menor de idade sem WhatsApp próprio precisa do WhatsApp do responsável");
      } else {
        toast.error(err?.message || "Erro ao fazer a inscrição");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pb-24 min-h-screen">
      <PageHead
        title="Inscrição para Batismo — Bíblia do Atalaia"
        description="Faça sua inscrição no Curso de Preparação para o Batismo do Ministério Atalaias de Betel."
        path="/batismo/inscricao"
      />

      <header className="px-5 pt-12 pb-4 max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={() => navigate("/batismo")}
          aria-label="Voltar"
          className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold leading-tight">Inscrição para Batismo</h1>
          <p className="text-xs text-[hsl(var(--dark-muted))]">
            Curso de Preparação para o Batismo
          </p>
        </div>
      </header>

      <div className="px-5 max-w-2xl mx-auto space-y-5">
        {authLoading || loadingInscricao ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !user ? (
          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold">
                {authMode === "signup" ? "Crie sua conta" : "Entre na sua conta"}
              </h2>
              <p className="text-sm text-[hsl(var(--dark-muted))] mt-1">
                Para se inscrever e acompanhar o curso, você precisa de uma conta no app.
              </p>
            </div>

            {aguardandoEmail ? (
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-sm leading-relaxed">
                Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu e-mail,
                confirme a conta e volte aqui para concluir a inscrição.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="batismo-email">E-mail</Label>
                  <Input
                    id="batismo-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-[hsl(var(--dark-bg))] border-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batismo-senha">Senha</Label>
                  <Input
                    id="batismo-senha"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="bg-[hsl(var(--dark-bg))] border-none"
                  />
                </div>
                <Button onClick={handleAuth} disabled={authBusy} className="w-full h-11">
                  {authBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {authMode === "signup" ? "Criar conta e continuar" : "Entrar e continuar"}
                </Button>
                <button
                  onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                  className="w-full text-center text-sm text-primary font-medium"
                >
                  {authMode === "login"
                    ? "Não tem conta? Cadastre-se"
                    : "Já tem conta? Faça login"}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-bold">Seus dados</h2>

              <div className="space-y-2">
                <Label htmlFor="batismo-nome">Nome completo</Label>
                <Input
                  id="batismo-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="bg-[hsl(var(--dark-bg))] border-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batismo-nascimento">Data de nascimento</Label>
                <Input
                  id="batismo-nascimento"
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="bg-[hsl(var(--dark-bg))] border-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="batismo-whatsapp">
                  Seu WhatsApp {menor ? "(se tiver)" : ""}
                </Label>
                <Input
                  id="batismo-whatsapp"
                  type="tel"
                  inputMode="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(85) 99999-9999"
                  className="bg-[hsl(var(--dark-bg))] border-none"
                />
              </div>

              {menor && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
                  <p className="text-sm leading-relaxed">
                    Você é menor de idade.{" "}
                    {precisaResponsavel
                      ? "Como não informou um WhatsApp próprio, informe o WhatsApp do seu responsável:"
                      : "Se preferir, informe também os dados do seu responsável:"}
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="batismo-resp-nome">Nome do responsável</Label>
                    <Input
                      id="batismo-resp-nome"
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      placeholder="Nome do responsável"
                      className="bg-[hsl(var(--dark-bg))] border-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batismo-resp-whatsapp">WhatsApp do responsável</Label>
                    <Input
                      id="batismo-resp-whatsapp"
                      type="tel"
                      inputMode="tel"
                      value={whatsappResponsavel}
                      onChange={(e) => setWhatsappResponsavel(e.target.value)}
                      placeholder="(85) 99999-9999"
                      className="bg-[hsl(var(--dark-bg))] border-none"
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleInscricao} disabled={enviando} className="w-full h-12 text-base">
                {enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmar inscrição
              </Button>
            </div>

            {config && (
              <CronogramaCurso
                licoes={licoes}
                iniciadoEm={new Date()}
                intervaloHoras={config.intervalo_liberacao_horas}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BatismoInscricaoPage;
