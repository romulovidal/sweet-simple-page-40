import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  batismoDb,
  calcularMedia,
  formatarDataBR,
  notaProvaValida,
  STATUS_LABELS,
  type BatismoCertificado,
  type BatismoConfig,
  type BatismoInscricao,
  type BatismoLicao,
  type BatismoQuestaoBanco as BatismoQuestao,
  type BatismoTentativa,
} from "@/lib/batismo";
import { gerarCertificadoPdf, subirCertificadoPdf } from "@/lib/batismoCertificado";
import { toast } from "sonner";
import {
  Award,
  Bell,
  BookOpen,
  CalendarHeart,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Loader2,
  MessagesSquare,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react";

type SubAba = "alunos" | "licoes" | "questoes" | "config" | "certificados";

const SUB_ABAS: { id: SubAba; label: string; icon: typeof Users }[] = [
  { id: "alunos", label: "Alunos", icon: Users },
  { id: "licoes", label: "Lições", icon: BookOpen },
  { id: "questoes", label: "Questões", icon: ClipboardList },
  { id: "config", label: "Configurações", icon: Settings2 },
  { id: "certificados", label: "Certificados", icon: Award },
];

function idadeDe(dataNascimento: string): number {
  const hoje = new Date();
  const nasc = new Date(`${dataNascimento}T12:00:00`);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade -= 1;
  return idade;
}

const AdminBatismo = () => {
  const [subAba, setSubAba] = useState<SubAba>("alunos");
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BatismoConfig | null>(null);
  const [licoes, setLicoes] = useState<BatismoLicao[]>([]);
  const [questoes, setQuestoes] = useState<BatismoQuestao[]>([]);
  const [inscricoes, setInscricoes] = useState<BatismoInscricao[]>([]);
  const [tentativas, setTentativas] = useState<BatismoTentativa[]>([]);
  const [certificados, setCertificados] = useState<BatismoCertificado[]>([]);
  const [enviandoPush, setEnviandoPush] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const db = batismoDb();
    const [c, l, q, i, t, cert] = await Promise.all([
      db.from("batismo_configuracoes").select("*").eq("id", 1).single(),
      db.from("batismo_licoes").select("*").order("ordem", { ascending: true }),
      db.from("batismo_questoes").select("*").order("codigo", { ascending: true }),
      db.from("batismo_inscricoes").select("*").order("created_at", { ascending: false }),
      db.from("batismo_tentativas").select("*").order("created_at", { ascending: true }),
      db.from("batismo_certificados").select("*").order("emitido_em", { ascending: false }),
    ]);
    if (c.data) setConfig(c.data as BatismoConfig);
    setLicoes((l.data as BatismoLicao[]) || []);
    setQuestoes((q.data as BatismoQuestao[]) || []);
    setInscricoes((i.data as BatismoInscricao[]) || []);
    setTentativas((t.data as BatismoTentativa[]) || []);
    setCertificados((cert.data as BatismoCertificado[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const enviarPushInscricoes = async () => {
    setEnviandoPush(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          title: "Inscrições para Batismo abertas",
          body: "O Curso de Preparação para o Batismo está com inscrições abertas. Toque para se inscrever!",
          url: "/batismo/inscricao",
          ttl: 60 * 60 * 24,
          urgency: "high",
          type: "batismo",
        },
      });
      if (error) throw error;
      toast.success(`Push enviado para ${data?.sent ?? 0} dispositivos!`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar o push");
    } finally {
      setEnviandoPush(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Push de abertura de inscrições */}
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-3">
        <Bell className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Inscrições para Batismo abertas</p>
          <p className="text-[11px] text-[hsl(var(--dark-muted))]">
            Push para todos, com link direto para a inscrição.
          </p>
        </div>
        <Button size="sm" onClick={() => void enviarPushInscricoes()} disabled={enviandoPush}>
          {enviandoPush && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
          Enviar push
        </Button>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {SUB_ABAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubAba(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              subAba === id
                ? "bg-primary text-primary-foreground"
                : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : subAba === "alunos" ? (
        <AlunosTab
          inscricoes={inscricoes}
          tentativas={tentativas}
          licoes={licoes}
          certificados={certificados}
          recarregar={carregar}
        />
      ) : subAba === "licoes" ? (
        <LicoesTab licoes={licoes} recarregar={carregar} />
      ) : subAba === "questoes" ? (
        <QuestoesTab questoes={questoes} licoes={licoes} recarregar={carregar} />
      ) : subAba === "config" ? (
        config && <ConfigTab config={config} recarregar={carregar} />
      ) : (
        <CertificadosTab
          certificados={certificados}
          inscricoes={inscricoes}
          recarregar={carregar}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// ALUNOS
// ----------------------------------------------------------------------
interface AlunosTabProps {
  inscricoes: BatismoInscricao[];
  tentativas: BatismoTentativa[];
  licoes: BatismoLicao[];
  certificados: BatismoCertificado[];
  recarregar: () => Promise<void>;
}

const AlunosTab = ({ inscricoes, tentativas, licoes, certificados, recarregar }: AlunosTabProps) => {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [acaoEm, setAcaoEm] = useState<string | null>(null);
  const [dataBatismo, setDataBatismo] = useState<Record<string, string>>({});

  const tentativasDo = (inscricaoId: string) =>
    tentativas.filter((t) => t.inscricao_id === inscricaoId);

  const executar = async (id: string, fn: () => Promise<void>) => {
    setAcaoEm(id);
    try {
      await fn();
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao executar a ação");
    } finally {
      setAcaoEm(null);
    }
  };

  const liberarRecuperacao = (insc: BatismoInscricao) =>
    executar(insc.id, async () => {
      const { error } = await batismoDb()
        .from("batismo_inscricoes")
        .update({ recuperacao_autorizada: true })
        .eq("id", insc.id);
      if (error) throw error;
      toast.success("Recuperação liberada para " + insc.nome.split(" ")[0]);
    });

  const marcarConversa = (insc: BatismoInscricao) =>
    executar(insc.id, async () => {
      const { error } = await batismoDb()
        .from("batismo_inscricoes")
        .update({ status: "conversa_realizada", conversa_em: new Date().toISOString() })
        .eq("id", insc.id);
      if (error) throw error;
      toast.success("Conversa marcada como realizada");
    });

  const salvarDataBatismo = (insc: BatismoInscricao) =>
    executar(insc.id, async () => {
      const data = dataBatismo[insc.id] || insc.data_batismo;
      if (!data) throw new Error("Escolha a data do batismo");
      const { error } = await batismoDb()
        .from("batismo_inscricoes")
        .update({ data_batismo: data })
        .eq("id", insc.id);
      if (error) throw error;
      toast.success("Data do batismo salva — o aluno já vê no app");
    });

  const gerarCertificado = (insc: BatismoInscricao) =>
    executar(insc.id, async () => {
      const db = batismoDb();
      let cert = certificados.find((c) => c.inscricao_id === insc.id);
      if (!cert) {
        const { data, error } = await db.rpc("batismo_criar_certificado", {
          p_inscricao_id: insc.id,
        });
        if (error) throw error;
        // A RPC devolve só id/codigo/pdf_path: busca a linha completa
        const { data: linha, error: linhaError } = await db
          .from("batismo_certificados")
          .select("*")
          .eq("id", data.id)
          .single();
        if (linhaError) throw linhaError;
        cert = linha as BatismoCertificado;
      }
      const pdf = await gerarCertificadoPdf({
        nome: insc.nome,
        codigo: cert.codigo,
        dataEmissao: new Date(cert.emitido_em),
      });
      const path = await subirCertificadoPdf(cert.codigo, pdf);
      const { error: updError } = await db
        .from("batismo_certificados")
        .update({ pdf_path: path })
        .eq("id", cert.id);
      if (updError) throw updError;
      const { error: statusError } = await db
        .from("batismo_inscricoes")
        .update({ status: "certificado_gerado" })
        .eq("id", insc.id);
      if (statusError) throw statusError;
      toast.success("Certificado gerado! O aluno já pode baixar no app.");
    });

  if (inscricoes.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-8">
        Nenhuma inscrição ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {inscricoes.map((insc) => {
        const minhas = tentativasDo(insc.id);
        const mediaAluno = calcularMedia(
          minhas
            .filter((t) => t.tipo === "exercicio" && t.status === "enviada" && t.nota !== null)
            .map((t) => Number(t.nota)),
          notaProvaValida(minhas),
        );
        const aberto = expandido === insc.id;
        const cert = certificados.find((c) => c.inscricao_id === insc.id);
        const ocupado = acaoEm === insc.id;
        return (
          <div key={insc.id} className="bg-[hsl(var(--dark-card))] rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandido(aberto ? null : insc.id)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{insc.nome}</p>
                <p className="text-[11px] text-[hsl(var(--dark-muted))]">
                  {STATUS_LABELS[insc.status]}
                  {mediaAluno !== null &&
                    ` · média ${mediaAluno.toFixed(1).replace(".", ",")}`}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-[hsl(var(--dark-muted))] transition-transform ${aberto ? "rotate-180" : ""}`}
              />
            </button>

            {aberto && (
              <div className="px-4 pb-4 space-y-3">
                <div className="text-xs space-y-1 text-[hsl(var(--dark-muted))]">
                  <p>
                    Nascimento: {formatarDataBR(new Date(`${insc.data_nascimento}T12:00:00`))} (
                    {idadeDe(insc.data_nascimento)} anos)
                  </p>
                  <p>
                    WhatsApp:{" "}
                    {insc.whatsapp ? (
                      <a
                        href={`https://wa.me/55${insc.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium"
                      >
                        {insc.whatsapp}
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                  {insc.whatsapp_responsavel && (
                    <p>
                      Responsável{insc.nome_responsavel ? ` (${insc.nome_responsavel})` : ""}:{" "}
                      <a
                        href={`https://wa.me/55${insc.whatsapp_responsavel.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-medium"
                      >
                        {insc.whatsapp_responsavel}
                      </a>
                    </p>
                  )}
                  <p>Inscrição: {formatarDataBR(new Date(insc.iniciado_em))}</p>
                  {insc.data_batismo && (
                    <p>Batismo: {formatarDataBR(new Date(`${insc.data_batismo}T12:00:00`))}</p>
                  )}
                </div>

                {/* Notas */}
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {licoes.map((l) => {
                    const t = minhas.find(
                      (x) => x.tipo === "exercicio" && x.licao_id === l.id && x.status === "enviada",
                    );
                    return (
                      <div
                        key={l.id}
                        className="rounded-lg bg-[hsl(var(--dark-bg))] px-2.5 py-1.5 flex justify-between"
                      >
                        <span className="text-[hsl(var(--dark-muted))]">Lição {l.ordem}</span>
                        <span className="font-semibold">
                          {t?.nota !== null && t?.nota !== undefined
                            ? Number(t.nota).toFixed(1).replace(".", ",")
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                  {minhas
                    .filter((x) => x.tipo !== "exercicio" && x.status === "enviada")
                    .map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg bg-primary/10 px-2.5 py-1.5 flex justify-between col-span-2"
                      >
                        <span className="text-[hsl(var(--dark-muted))]">
                          {t.tipo === "recuperacao" ? "Recuperação" : "Prova final"}
                        </span>
                        <span className="font-semibold">
                          {t.nota !== null ? Number(t.nota).toFixed(1).replace(".", ",") : "—"}
                        </span>
                      </div>
                    ))}
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2">
                  {insc.status === "reprovado" && !insc.recuperacao_autorizada && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={ocupado}
                      onClick={() => void liberarRecuperacao(insc)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      Liberar recuperação
                    </Button>
                  )}
                  {insc.status === "reprovado" && insc.recuperacao_autorizada && (
                    <span className="text-xs text-amber-500 font-medium py-1.5">
                      Recuperação liberada — aguardando o aluno
                    </span>
                  )}
                  {insc.status === "aprovado" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={ocupado}
                      onClick={() => void marcarConversa(insc)}
                    >
                      <MessagesSquare className="w-3.5 h-3.5 mr-1.5" />
                      Marcar conversa feita
                    </Button>
                  )}
                  {(insc.status === "conversa_realizada" || insc.status === "certificado_gerado") && (
                    <Button
                      size="sm"
                      disabled={ocupado}
                      onClick={() => void gerarCertificado(insc)}
                    >
                      {ocupado ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Award className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {cert?.pdf_path ? "Regerar certificado" : "Gerar certificado"}
                    </Button>
                  )}
                </div>

                {(insc.status === "conversa_realizada" || insc.status === "certificado_gerado") && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Data do batismo</Label>
                      <Input
                        type="date"
                        value={dataBatismo[insc.id] ?? insc.data_batismo ?? ""}
                        onChange={(e) =>
                          setDataBatismo((prev) => ({ ...prev, [insc.id]: e.target.value }))
                        }
                        className="bg-[hsl(var(--dark-bg))] border-none h-9"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={ocupado}
                      onClick={() => void salvarDataBatismo(insc)}
                    >
                      <CalendarHeart className="w-3.5 h-3.5 mr-1.5" />
                      Salvar data
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ----------------------------------------------------------------------
// LIÇÕES
// ----------------------------------------------------------------------
const LicoesTab = ({
  licoes,
  recarregar,
}: {
  licoes: BatismoLicao[];
  recarregar: () => Promise<void>;
}) => {
  const [editando, setEditando] = useState<BatismoLicao | null>(null);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    ordem: 1,
    titulo: "",
    objetivo: "",
    conteudo: "",
    versiculo_chave: "",
    versiculo_referencia: "",
    referencias: [] as { referencia: string; texto: string }[],
    frase_para_guardar: "",
    ativo: true,
  });

  const abrirEdicao = (l: BatismoLicao) => {
    setForm({
      ordem: l.ordem,
      titulo: l.titulo,
      objetivo: l.objetivo,
      conteudo: l.conteudo,
      versiculo_chave: l.versiculo_chave,
      versiculo_referencia: l.versiculo_referencia,
      referencias: l.referencias || [],
      frase_para_guardar: l.frase_para_guardar,
      ativo: l.ativo,
    });
    setEditando(l);
    setCriando(false);
  };

  const abrirNova = () => {
    setForm({
      ordem: licoes.length + 1,
      titulo: "",
      objetivo: "",
      conteudo: "",
      versiculo_chave: "",
      versiculo_referencia: "",
      referencias: [],
      frase_para_guardar: "",
      ativo: true,
    });
    setEditando(null);
    setCriando(true);
  };

  const fechar = () => {
    setEditando(null);
    setCriando(false);
  };

  const salvar = async () => {
    if (!form.titulo.trim()) {
      toast.error("Informe o título da lição");
      return;
    }
    setSalvando(true);
    try {
      const db = batismoDb();
      const payload = { ...form, titulo: form.titulo.trim() };
      const { error } = editando
        ? await db.from("batismo_licoes").update(payload).eq("id", editando.id)
        : await db.from("batismo_licoes").insert(payload);
      if (error) throw error;
      toast.success(editando ? "Lição atualizada" : "Lição criada");
      fechar();
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar a lição");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (l: BatismoLicao) => {
    if (!window.confirm(`Excluir a lição "${l.titulo}"?`)) return;
    try {
      const { error } = await batismoDb().from("batismo_licoes").delete().eq("id", l.id);
      if (error) throw error;
      toast.success("Lição excluída");
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  if (editando || criando) {
    return (
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {editando ? `Editar Lição ${editando.ordem}` : "Nova lição"}
          </span>
          <button onClick={fechar} aria-label="Fechar">
            <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          </button>
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Ordem</Label>
            <Input
              type="number"
              min={1}
              value={form.ordem}
              onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
              className="bg-[hsl(var(--dark-bg))] border-none"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className="bg-[hsl(var(--dark-bg))] border-none"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Objetivo</Label>
          <Textarea
            value={form.objetivo}
            onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
            className="bg-[hsl(var(--dark-bg))] border-none min-h-[60px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Conteúdo (markdown)</Label>
          <Textarea
            value={form.conteudo}
            onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
            className="bg-[hsl(var(--dark-bg))] border-none min-h-[180px] font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Versículo-chave (texto NVI)</Label>
          <Textarea
            value={form.versiculo_chave}
            onChange={(e) => setForm({ ...form, versiculo_chave: e.target.value })}
            className="bg-[hsl(var(--dark-bg))] border-none min-h-[60px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Referência do versículo (ex.: Romanos 10:9-10)</Label>
          <Input
            value={form.versiculo_referencia}
            onChange={(e) => setForm({ ...form, versiculo_referencia: e.target.value })}
            className="bg-[hsl(var(--dark-bg))] border-none"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Referências de apoio</Label>
          {form.referencias.map((ref, idx) => (
            <div key={idx} className="rounded-lg bg-[hsl(var(--dark-bg))] p-2 space-y-2">
              <Input
                value={ref.referencia}
                placeholder="Referência (ex.: João 3:16)"
                onChange={(e) => {
                  const refs = [...form.referencias];
                  refs[idx] = { ...refs[idx], referencia: e.target.value };
                  setForm({ ...form, referencias: refs });
                }}
                className="bg-[hsl(var(--dark-card))] border-none"
              />
              <Textarea
                value={ref.texto}
                placeholder="Texto do versículo"
                onChange={(e) => {
                  const refs = [...form.referencias];
                  refs[idx] = { ...refs[idx], texto: e.target.value };
                  setForm({ ...form, referencias: refs });
                }}
                className="bg-[hsl(var(--dark-card))] border-none min-h-[50px]"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setForm({
                    ...form,
                    referencias: form.referencias.filter((_, i) => i !== idx),
                  })
                }
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setForm({ ...form, referencias: [...form.referencias, { referencia: "", texto: "" }] })
            }
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar referência
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Frase para guardar</Label>
          <Input
            value={form.frase_para_guardar}
            onChange={(e) => setForm({ ...form, frase_para_guardar: e.target.value })}
            className="bg-[hsl(var(--dark-bg))] border-none"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Lição ativa</Label>
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => setForm({ ...form, ativo: v })}
          />
        </div>
        <Button onClick={() => void salvar()} disabled={salvando} className="w-full">
          {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          Salvar lição
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {licoes.map((l) => (
        <div
          key={l.id}
          className="bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              Lição {l.ordem} — {l.titulo}
            </p>
            <p className="text-[11px] text-[hsl(var(--dark-muted))]">
              {l.versiculo_referencia} {l.ativo ? "" : "· inativa"}
            </p>
          </div>
          <button
            onClick={() => abrirEdicao(l)}
            aria-label="Editar"
            className="w-8 h-8 rounded-lg grid place-items-center bg-[hsl(var(--dark-bg))]"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => void excluir(l)}
            aria-label="Excluir"
            className="w-8 h-8 rounded-lg grid place-items-center bg-[hsl(var(--dark-bg))] text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <Button variant="secondary" onClick={abrirNova} className="w-full">
        <Plus className="w-4 h-4 mr-2" /> Nova lição
      </Button>
    </div>
  );
};

// ----------------------------------------------------------------------
// QUESTÕES
// ----------------------------------------------------------------------
const QuestoesTab = ({
  questoes,
  licoes,
  recarregar,
}: {
  questoes: BatismoQuestao[];
  licoes: BatismoLicao[];
  recarregar: () => Promise<void>;
}) => {
  const [filtro, setFiltro] = useState<string>("todas");
  const [editando, setEditando] = useState<BatismoQuestao | null>(null);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    codigo: "",
    tipo: "exercicio" as "exercicio" | "prova_final",
    licao_id: "",
    enunciado: "",
    alternativas: ["", "", "", ""],
    resposta_correta: "",
    ativo: true,
  });

  const filtradas = useMemo(() => {
    if (filtro === "todas") return questoes;
    if (filtro === "prova_final") return questoes.filter((q) => q.tipo === "prova_final");
    return questoes.filter((q) => q.licao_id === filtro);
  }, [questoes, filtro]);

  const abrirEdicao = (q: BatismoQuestao) => {
    setForm({
      codigo: q.codigo,
      tipo: q.tipo,
      licao_id: q.licao_id || "",
      enunciado: q.enunciado,
      alternativas: [...q.alternativas, "", "", "", ""].slice(0, 4),
      resposta_correta: q.resposta_correta,
      ativo: q.ativo,
    });
    setEditando(q);
    setCriando(false);
  };

  const abrirNova = () => {
    setForm({
      codigo: "",
      tipo: "exercicio",
      licao_id: licoes[0]?.id || "",
      enunciado: "",
      alternativas: ["", "", "", ""],
      resposta_correta: "",
      ativo: true,
    });
    setEditando(null);
    setCriando(true);
  };

  const fechar = () => {
    setEditando(null);
    setCriando(false);
  };

  const salvar = async () => {
    const alternativas = form.alternativas.map((a) => a.trim()).filter(Boolean);
    if (!form.codigo.trim() || !form.enunciado.trim() || alternativas.length < 2) {
      toast.error("Preencha código, enunciado e ao menos 2 alternativas");
      return;
    }
    if (!alternativas.includes(form.resposta_correta.trim())) {
      toast.error("A resposta correta precisa ser uma das alternativas (texto exato)");
      return;
    }
    if (form.tipo === "exercicio" && !form.licao_id) {
      toast.error("Escolha a lição da questão");
      return;
    }
    setSalvando(true);
    try {
      const db = batismoDb();
      const payload = {
        codigo: form.codigo.trim().toUpperCase(),
        tipo: form.tipo,
        licao_id: form.tipo === "exercicio" ? form.licao_id : null,
        enunciado: form.enunciado.trim(),
        alternativas,
        resposta_correta: form.resposta_correta.trim(),
        ativo: form.ativo,
      };
      const { error } = editando
        ? await db.from("batismo_questoes").update(payload).eq("id", editando.id)
        : await db.from("batismo_questoes").insert(payload);
      if (error) throw error;
      toast.success(editando ? "Questão atualizada" : "Questão criada");
      fechar();
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar a questão");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (q: BatismoQuestao) => {
    if (!window.confirm(`Excluir a questão ${q.codigo}?`)) return;
    try {
      const { error } = await batismoDb().from("batismo_questoes").delete().eq("id", q.id);
      if (error) throw error;
      toast.success("Questão excluída");
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  if (editando || criando) {
    return (
      <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            {editando ? `Editar questão ${editando.codigo}` : "Nova questão"}
          </span>
          <button onClick={fechar} aria-label="Fechar">
            <X className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Código (ex.: L1-13, PF-31)</Label>
            <Input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              className="bg-[hsl(var(--dark-bg))] border-none"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm({ ...form, tipo: v as "exercicio" | "prova_final" })}
            >
              <SelectTrigger className="bg-[hsl(var(--dark-bg))] border-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exercicio">Exercício de lição</SelectItem>
                <SelectItem value="prova_final">Prova final</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.tipo === "exercicio" && (
          <div className="space-y-1">
            <Label className="text-xs">Lição</Label>
            <Select
              value={form.licao_id}
              onValueChange={(v) => setForm({ ...form, licao_id: v })}
            >
              <SelectTrigger className="bg-[hsl(var(--dark-bg))] border-none">
                <SelectValue placeholder="Escolha a lição" />
              </SelectTrigger>
              <SelectContent>
                {licoes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    Lição {l.ordem} — {l.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Enunciado</Label>
          <Textarea
            value={form.enunciado}
            onChange={(e) => setForm({ ...form, enunciado: e.target.value })}
            className="bg-[hsl(var(--dark-bg))] border-none min-h-[70px]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Alternativas (marque a correta)</Label>
          {form.alternativas.map((alt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Marcar alternativa ${idx + 1} como correta`}
                onClick={() => alt.trim() && setForm({ ...form, resposta_correta: alt })}
                className={`w-7 h-7 shrink-0 rounded-full grid place-items-center ${
                  form.resposta_correta === alt && alt.trim()
                    ? "bg-green-500 text-white"
                    : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"
                }`}
              >
                <Check className="w-4 h-4" />
              </button>
              <Input
                value={alt}
                placeholder={`Alternativa ${idx + 1}`}
                onChange={(e) => {
                  const alts = [...form.alternativas];
                  const antiga = alts[idx];
                  alts[idx] = e.target.value;
                  setForm({
                    ...form,
                    alternativas: alts,
                    resposta_correta:
                      form.resposta_correta === antiga ? e.target.value : form.resposta_correta,
                  });
                }}
                className="bg-[hsl(var(--dark-bg))] border-none"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Questão ativa</Label>
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => setForm({ ...form, ativo: v })}
          />
        </div>
        <Button onClick={() => void salvar()} disabled={salvando} className="w-full">
          {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          Salvar questão
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Select value={filtro} onValueChange={setFiltro}>
        <SelectTrigger className="bg-[hsl(var(--dark-card))] border-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as questões ({questoes.length})</SelectItem>
          {licoes.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              Lição {l.ordem} ({questoes.filter((q) => q.licao_id === l.id).length})
            </SelectItem>
          ))}
          <SelectItem value="prova_final">
            Prova final ({questoes.filter((q) => q.tipo === "prova_final").length})
          </SelectItem>
        </SelectContent>
      </Select>

      {filtradas.map((q) => (
        <div
          key={q.id}
          className="bg-[hsl(var(--dark-card))] rounded-xl p-3 flex items-start gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary">{q.codigo}</p>
            <p className="text-sm leading-snug line-clamp-2">{q.enunciado}</p>
            <p className="text-[11px] text-green-400 mt-0.5 truncate">✓ {q.resposta_correta}</p>
            {!q.ativo && <p className="text-[11px] text-amber-500">inativa</p>}
          </div>
          <button
            onClick={() => abrirEdicao(q)}
            aria-label="Editar"
            className="w-8 h-8 shrink-0 rounded-lg grid place-items-center bg-[hsl(var(--dark-bg))]"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => void excluir(q)}
            aria-label="Excluir"
            className="w-8 h-8 shrink-0 rounded-lg grid place-items-center bg-[hsl(var(--dark-bg))] text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <Button variant="secondary" onClick={abrirNova} className="w-full">
        <Plus className="w-4 h-4 mr-2" /> Nova questão
      </Button>
    </div>
  );
};

// ----------------------------------------------------------------------
// CONFIGURAÇÕES
// ----------------------------------------------------------------------
const ConfigTab = ({
  config,
  recarregar,
}: {
  config: BatismoConfig;
  recarregar: () => Promise<void>;
}) => {
  const [form, setForm] = useState({
    media_minima: String(config.media_minima),
    questoes_por_exercicio: String(config.questoes_por_exercicio),
    tempo_exercicio_min: String(config.tempo_exercicio_min),
    questoes_prova_final: String(config.questoes_prova_final),
    tempo_prova_final_min: String(config.tempo_prova_final_min),
    intervalo_liberacao_horas: String(config.intervalo_liberacao_horas),
    inscricoes_abertas: config.inscricoes_abertas,
  });
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      const { error } = await batismoDb()
        .from("batismo_configuracoes")
        .update({
          media_minima: Number(form.media_minima.replace(",", ".")),
          questoes_por_exercicio: Number(form.questoes_por_exercicio),
          tempo_exercicio_min: Number(form.tempo_exercicio_min),
          questoes_prova_final: Number(form.questoes_prova_final),
          tempo_prova_final_min: Number(form.tempo_prova_final_min),
          intervalo_liberacao_horas: Number(form.intervalo_liberacao_horas),
          inscricoes_abertas: form.inscricoes_abertas,
        })
        .eq("id", 1);
      if (error) throw error;
      toast.success("Configurações salvas");
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const campos: { key: keyof typeof form; label: string; ajuda: string }[] = [
    { key: "media_minima", label: "Média mínima para aprovar", ajuda: "Ex.: 6,0" },
    { key: "questoes_por_exercicio", label: "Questões por exercício", ajuda: "Sorteadas do banco da lição" },
    { key: "tempo_exercicio_min", label: "Tempo do exercício (min)", ajuda: "Ex.: 40" },
    { key: "questoes_prova_final", label: "Questões da prova final", ajuda: "Sorteadas do banco PF" },
    { key: "tempo_prova_final_min", label: "Tempo da prova final (min)", ajuda: "Ex.: 60" },
    { key: "intervalo_liberacao_horas", label: "Intervalo entre lições (horas)", ajuda: "24 = 1 lição por dia" },
  ];

  return (
    <div className="bg-[hsl(var(--dark-card))] rounded-xl p-4 space-y-3">
      {campos.map(({ key, label, ajuda }) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs">{label}</Label>
          <Input
            inputMode="decimal"
            value={String(form[key])}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="bg-[hsl(var(--dark-bg))] border-none"
          />
          <p className="text-[10px] text-[hsl(var(--dark-muted))]">{ajuda}</p>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <div>
          <Label className="text-xs">Inscrições abertas</Label>
          <p className="text-[10px] text-[hsl(var(--dark-muted))]">
            Controla o card na Home e a tela de inscrição
          </p>
        </div>
        <Switch
          checked={form.inscricoes_abertas}
          onCheckedChange={(v) => setForm({ ...form, inscricoes_abertas: v })}
        />
      </div>
      <Button onClick={() => void salvar()} disabled={salvando} className="w-full">
        {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        <Save className="w-4 h-4 mr-2" />
        Salvar configurações
      </Button>
    </div>
  );
};

// ----------------------------------------------------------------------
// CERTIFICADOS
// ----------------------------------------------------------------------
const CertificadosTab = ({
  certificados,
  inscricoes,
  recarregar,
}: {
  certificados: BatismoCertificado[];
  inscricoes: BatismoInscricao[];
  recarregar: () => Promise<void>;
}) => {
  const [baixando, setBaixando] = useState<string | null>(null);

  const baixar = async (cert: BatismoCertificado) => {
    if (!cert.pdf_path) return;
    setBaixando(cert.id);
    try {
      const { data, error } = await batismoDb()
        .storage.from("certificados")
        .createSignedUrl(cert.pdf_path, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível gerar o link de download");
    } finally {
      setBaixando(null);
    }
  };

  const regerar = async (cert: BatismoCertificado) => {
    const insc = inscricoes.find((i) => i.id === cert.inscricao_id);
    if (!insc) return;
    setBaixando(cert.id);
    try {
      const pdf = await gerarCertificadoPdf({
        nome: insc.nome,
        codigo: cert.codigo,
        dataEmissao: new Date(cert.emitido_em),
      });
      const path = await subirCertificadoPdf(cert.codigo, pdf);
      const { error } = await batismoDb()
        .from("batismo_certificados")
        .update({ pdf_path: path })
        .eq("id", cert.id);
      if (error) throw error;
      toast.success("Certificado regerado");
      await recarregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao regerar o certificado");
    } finally {
      setBaixando(null);
    }
  };

  if (certificados.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-8">
        Nenhum certificado gerado ainda. Gere pela aba Alunos, após a conversa.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {certificados.map((cert) => {
        const insc = inscricoes.find((i) => i.id === cert.inscricao_id);
        return (
          <div
            key={cert.id}
            className="bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-3"
          >
            <Award className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{insc?.nome || "Aluno"}</p>
              <p className="text-[11px] text-[hsl(var(--dark-muted))]">
                {cert.codigo} · emitido em {formatarDataBR(new Date(cert.emitido_em))}
                {!cert.pdf_path && " · PDF pendente"}
              </p>
            </div>
            {cert.pdf_path ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={baixando === cert.id}
                onClick={() => void baixar(cert)}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                PDF
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={baixando === cert.id}
                onClick={() => void regerar(cert)}
              >
                {baixando === cert.id && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Gerar PDF
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AdminBatismo;
