import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ContactRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Tab = "contacts" | "individuals" | "groups";

type Contact = {
  id: string;
  user_id: string;
  name: string;
  phone_e164: string;
  whatsapp_opt_in: boolean;
  tags: string[];
  notes?: string | null;
  birth_date?: string | null;
  blocked: boolean;
  blocked_reason?: string | null;
};

type Individual = {
  id: string;
  name: string;
  phone_e164: string;
  tags: string[];
  notes?: string | null;
  birth_date?: string | null;
  allow_messages: boolean;
  blocked: boolean;
  is_active: boolean;
};

type Group = {
  id: string;
  provider_group_id: string;
  name: string;
  description?: string | null;
  participant_count: number;
  allow_manual_send: boolean;
  allow_automations: boolean;
  provider_exists: boolean;
  synced_at?: string | null;
};

type AvailableGroup = {
  provider_group_id: string;
  name: string;
  participant_count?: number | null;
  already_registered: boolean;
};

type Member = {
  provider_member_id: string;
  phone_e164?: string | null;
  display_name?: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
};

async function functionErrorMessage(error: any) {
  const fallback = error?.message || "Não foi possível concluir a operação.";
  const response = error?.context;
  if (!(response instanceof Response)) return fallback;
  try {
    const body = await response.clone().json();
    return body?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

async function invokeAtis<T = any>(functionName: string, body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou. Entre novamente.");
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as T;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const local = digits.slice(4);
    return `+55 (${ddd}) ${local.slice(0, local.length - 4)}-${local.slice(-4)}`;
  }
  return value;
}

const AtisRecipients = () => {
  const [tab, setTab] = useState<Tab>("contacts");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editor, setEditor] = useState<Individual | null | "new">(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [showAvailableGroups, setShowAvailableGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const clearMessages = () => { setError(null); setNotice(null); };

  const loadAll = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const [c, i, g] = await Promise.all([
        invokeAtis<{ contacts: Contact[] }>("atis-recipients", { action: "contacts_list" }),
        invokeAtis<{ individuals: Individual[] }>("atis-recipients", { action: "individuals_list" }),
        invokeAtis<{ groups: Group[] }>("atis-recipients", { action: "groups_list" }),
      ]);
      setContacts(c.contacts ?? []);
      setIndividuals(i.individuals ?? []);
      setGroups(g.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar destinatários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const run = async (key: string, task: () => Promise<void>) => {
    clearMessages();
    setBusy(key);
    try { await task(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível concluir a operação."); }
    finally { setBusy(null); }
  };

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? contacts.filter((row) => `${row.name} ${row.phone_e164}`.toLowerCase().includes(q)) : contacts;
  }, [contacts, search]);
  const filteredIndividuals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? individuals.filter((row) => `${row.name} ${row.phone_e164}`.toLowerCase().includes(q)) : individuals;
  }, [individuals, search]);
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? groups.filter((row) => row.name.toLowerCase().includes(q)) : groups;
  }, [groups, search]);

  const syncAppContacts = () => run("sync-app", async () => {
    const result = await invokeAtis<any>("atis-sync", { action: "app_contacts" });
    const found = Number(result?.app_contacts?.found ?? 0);
    await loadAll();
    setNotice(`${found} cadastro(s) com WhatsApp conferidos. A agenda do celular não foi consultada.`);
  });

  const toggleContactBlock = (contact: Contact) => run(`contact-${contact.id}`, async () => {
    await invokeAtis("atis-recipients", { action: "contact_update_meta", data: { id: contact.id, blocked: !contact.blocked, blocked_reason: !contact.blocked ? "Bloqueado manualmente no ATIS" : null } });
    await loadAll();
  });

  const openNewIndividual = () => {
    setEditor("new"); setName(""); setPhone(""); setTags(""); setNotes(""); setBirthDate(""); clearMessages();
  };
  const openEditIndividual = (person: Individual) => {
    setEditor(person); setName(person.name); setPhone(person.phone_e164); setTags((person.tags ?? []).join(", ")); setNotes(person.notes ?? ""); setBirthDate(person.birth_date ?? ""); clearMessages();
  };
  const saveIndividual = () => run("save-individual", async () => {
    const data = { name, phone, tags: tags.split(",").map((v) => v.trim()).filter(Boolean), notes: notes || null, birth_date: birthDate || null };
    if (editor === "new") await invokeAtis("atis-recipients", { action: "individual_create", data });
    else if (editor) await invokeAtis("atis-recipients", { action: "individual_update", data: { id: editor.id, ...data } });
    setEditor(null);
    await loadAll();
    setNotice(editor === "new" ? "Individual cadastrado." : "Individual atualizado.");
  });
  const toggleIndividual = (person: Individual, field: "blocked" | "allow_messages") => run(`individual-${person.id}`, async () => {
    await invokeAtis("atis-recipients", { action: "individual_update", data: { id: person.id, [field]: !person[field] } });
    await loadAll();
  });
  const archiveIndividual = (person: Individual) => {
    if (!window.confirm(`Arquivar ${person.name}?`)) return;
    void run(`archive-${person.id}`, async () => {
      await invokeAtis("atis-recipients", { action: "individual_archive", data: { id: person.id } });
      await loadAll();
    });
  };

  const discoverGroups = () => run("groups-available", async () => {
    const result = await invokeAtis<{ groups: AvailableGroup[] }>("atis-recipients", { action: "groups_available" });
    setAvailableGroups(result.groups ?? []);
    setShowAvailableGroups(true);
  });
  const registerGroup = (group: AvailableGroup) => run(`register-${group.provider_group_id}`, async () => {
    await invokeAtis("atis-recipients", { action: "group_register", data: { provider_group_id: group.provider_group_id } });
    setAvailableGroups((rows) => rows.map((row) => row.provider_group_id === group.provider_group_id ? { ...row, already_registered: true } : row));
    await loadAll();
    setNotice(`${group.name} foi cadastrado no ATIS.`);
  });
  const toggleGroup = (group: Group, field: "allow_manual_send" | "allow_automations") => run(`group-${group.id}-${field}`, async () => {
    await invokeAtis("atis-recipients", { action: "group_update", data: { id: group.id, [field]: !group[field] } });
    await loadAll();
  });
  const refreshGroup = (group: Group) => run(`refresh-${group.id}`, async () => {
    await invokeAtis("atis-recipients", { action: "group_refresh", data: { id: group.id } });
    await loadAll();
    setNotice(`${group.name} atualizado.`);
  });
  const loadMembers = (group: Group) => run(`members-${group.id}`, async () => {
    const result = await invokeAtis<{ members: Member[] }>("atis-recipients", { action: "group_members", data: { id: group.id } });
    setMembers(result.members ?? []);
    setSelectedGroup(group);
  });
  const unregisterGroup = (group: Group) => {
    if (!window.confirm(`Remover ${group.name} do ATIS? O grupo continuará existindo normalmente no WhatsApp.`)) return;
    void run(`unregister-${group.id}`, async () => {
      await invokeAtis("atis-recipients", { action: "group_unregister", data: { id: group.id } });
      await loadAll();
    });
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 sm:p-5 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary">Destinatários ATIS</p>
            <h2 className="text-lg font-bold text-[hsl(var(--dark-text))] mt-1">Controle quem pode receber mensagens</h2>
            <p className="text-xs text-[hsl(var(--dark-muted))] mt-1">Contatos vêm somente do cadastro do app. Individuais são manuais. Grupos só entram quando você escolher.</p>
          </div>
          <button onClick={() => void loadAll()} disabled={busy !== null} className="h-10 px-4 rounded-xl bg-[hsl(var(--dark-bg))] text-xs font-semibold text-[hsl(var(--dark-text))] flex items-center justify-center gap-2 disabled:opacity-40">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl p-4 border border-destructive/20 bg-destructive/10 flex gap-3 text-destructive"><AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">{error}</p></div>}
      {notice && <div className="rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/10 flex gap-3 text-emerald-400"><CheckCircle2 className="w-5 h-5 shrink-0" /><p className="text-sm">{notice}</p></div>}

      <div className="grid grid-cols-3 gap-2">
        {([
          ["contacts", "Contatos", contacts.length, ContactRound],
          ["individuals", "Individuais", individuals.length, UserRound],
          ["groups", "Grupos", groups.length, UsersRound],
        ] as const).map(([key, label, count, Icon]) => (
          <button key={key} onClick={() => { setTab(key); setSearch(""); }} className={`rounded-2xl p-3 border text-left transition-colors ${tab === key ? "bg-primary/15 border-primary/30" : "bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]/50"}`}>
            <div className="flex items-center justify-between gap-2"><Icon className={`w-4 h-4 ${tab === key ? "text-primary" : "text-[hsl(var(--dark-muted))]"}`} /><span className="text-base font-bold text-[hsl(var(--dark-text))]">{count}</span></div>
            <p className="text-[11px] font-semibold text-[hsl(var(--dark-text))] mt-2">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--dark-muted))]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "groups" ? "Buscar grupo..." : "Buscar nome ou telefone..."} className="w-full h-11 pl-10 pr-3 rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] text-sm text-[hsl(var(--dark-text))] outline-none focus:border-primary/50" />
        </div>
        {tab === "contacts" && <button onClick={syncAppContacts} disabled={busy !== null} className="h-11 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40">{busy === "sync-app" ? "..." : "Cadastro"}</button>}
        {tab === "individuals" && <button onClick={openNewIndividual} className="h-11 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" /> Novo</button>}
        {tab === "groups" && <button onClick={discoverGroups} disabled={busy !== null} className="h-11 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 disabled:opacity-40"><Plus className="w-4 h-4" /> Grupo</button>}
      </div>

      {tab === "contacts" && (
        <div className="space-y-2">
          {filteredContacts.length === 0 ? <Empty text="Nenhum usuário do app com WhatsApp cadastrado." /> : filteredContacts.map((contact) => (
            <div key={contact.id} className="rounded-2xl p-4 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl grid place-items-center bg-primary/15 text-primary shrink-0"><ContactRound className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-[hsl(var(--dark-text))] truncate">{contact.name}</p><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">Cadastro do app</span></div>
                <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-0.5">{formatPhone(contact.phone_e164)}</p>
                <p className={`text-[10px] mt-1 ${contact.whatsapp_opt_in ? "text-emerald-400" : "text-amber-400"}`}>{contact.whatsapp_opt_in ? "Opt-in ativo" : "Sem opt-in para automações"}{contact.blocked ? " • Bloqueado no ATIS" : ""}</p>
              </div>
              <button onClick={() => toggleContactBlock(contact)} disabled={busy !== null} title={contact.blocked ? "Desbloquear no ATIS" : "Bloquear no ATIS"} className={`w-9 h-9 rounded-xl grid place-items-center ${contact.blocked ? "bg-destructive/15 text-destructive" : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"}`}><Ban className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {tab === "individuals" && (
        <div className="space-y-2">
          {filteredIndividuals.length === 0 ? <Empty text="Nenhum individual cadastrado. Use + Novo para adicionar um número externo." /> : filteredIndividuals.map((person) => (
            <div key={person.id} className="rounded-2xl p-4 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl grid place-items-center bg-primary/15 text-primary shrink-0"><Smartphone className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-bold text-[hsl(var(--dark-text))] truncate">{person.name}</p><p className="text-[11px] text-[hsl(var(--dark-muted))]">{formatPhone(person.phone_e164)}</p><p className={`text-[10px] mt-1 ${person.blocked || !person.allow_messages ? "text-amber-400" : "text-emerald-400"}`}>{person.blocked ? "Bloqueado" : person.allow_messages ? "Envios permitidos" : "Envios desativados"}</p></div>
                <button onClick={() => openEditIndividual(person)} className="w-9 h-9 rounded-xl grid place-items-center bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"><Pencil className="w-4 h-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => toggleIndividual(person, "allow_messages")} disabled={busy !== null} className="h-8 px-3 rounded-lg bg-[hsl(var(--dark-bg))] text-[10px] font-semibold text-[hsl(var(--dark-text))]">{person.allow_messages ? "Desativar envios" : "Permitir envios"}</button>
                <button onClick={() => toggleIndividual(person, "blocked")} disabled={busy !== null} className="h-8 px-3 rounded-lg bg-[hsl(var(--dark-bg))] text-[10px] font-semibold text-[hsl(var(--dark-text))]">{person.blocked ? "Desbloquear" : "Bloquear"}</button>
                <button onClick={() => archiveIndividual(person)} disabled={busy !== null} className="h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-[10px] font-semibold"><Trash2 className="w-3 h-3 inline mr-1" />Arquivar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "groups" && (
        <div className="space-y-2">
          {filteredGroups.length === 0 ? <Empty text="Nenhum grupo cadastrado no ATIS. Toque em + Grupo para escolher entre os grupos do WhatsApp conectado." /> : filteredGroups.map((group) => (
            <div key={group.id} className="rounded-2xl p-4 bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))]/50">
              <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl grid place-items-center bg-primary/15 text-primary shrink-0"><UsersRound className="w-5 h-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[hsl(var(--dark-text))] truncate">{group.name}</p><p className="text-[11px] text-[hsl(var(--dark-muted))]">{group.participant_count ?? 0} participantes</p><p className={`text-[10px] mt-1 ${group.provider_exists ? "text-emerald-400" : "text-destructive"}`}>{group.provider_exists ? "Disponível no WhatsApp" : "Não localizado no WhatsApp"}</p></div></div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={() => toggleGroup(group, "allow_manual_send")} disabled={busy !== null} className={`h-9 rounded-xl text-[10px] font-bold border ${group.allow_manual_send ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] border-[hsl(var(--dark-card-hover))]"}`}>Envio manual {group.allow_manual_send ? "ON" : "OFF"}</button>
                <button onClick={() => toggleGroup(group, "allow_automations")} disabled={busy !== null} className={`h-9 rounded-xl text-[10px] font-bold border ${group.allow_automations ? "bg-primary/10 text-primary border-primary/20" : "bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] border-[hsl(var(--dark-card-hover))]"}`}>Automações {group.allow_automations ? "ON" : "OFF"}</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2"><button onClick={() => loadMembers(group)} disabled={busy !== null} className="h-8 px-3 rounded-lg bg-[hsl(var(--dark-bg))] text-[10px] font-semibold text-[hsl(var(--dark-text))]">Participantes</button><button onClick={() => refreshGroup(group)} disabled={busy !== null} className="h-8 px-3 rounded-lg bg-[hsl(var(--dark-bg))] text-[10px] font-semibold text-[hsl(var(--dark-text))]">Atualizar grupo</button><button onClick={() => unregisterGroup(group)} disabled={busy !== null} className="h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-[10px] font-semibold">Remover do ATIS</button></div>
            </div>
          ))}
        </div>
      )}

      {editor && (
        <Overlay onClose={() => setEditor(null)} title={editor === "new" ? "Novo individual" : "Editar individual"}>
          <div className="space-y-3"><Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Ex.: Pastor José" /></Field><Field label="WhatsApp"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" placeholder="(85) 99999-9999" inputMode="tel" /></Field><Field label="Tags"><input value={tags} onChange={(e) => setTags(e.target.value)} className="field" placeholder="visitante, liderança" /></Field><Field label="Aniversário"><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="field" /></Field><Field label="Observações"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="field min-h-20 py-2" /></Field><button onClick={saveIndividual} disabled={busy !== null || !name.trim() || !phone.trim()} className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40">{busy === "save-individual" ? "Salvando..." : "Salvar"}</button></div>
        </Overlay>
      )}

      {showAvailableGroups && (
        <Overlay onClose={() => setShowAvailableGroups(false)} title="Adicionar grupo">
          <p className="text-xs text-[hsl(var(--dark-muted))] mb-3">Esta lista é consultada somente agora. Apenas os grupos que você adicionar serão gravados no ATIS.</p>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">{availableGroups.length === 0 ? <Empty text="Nenhum grupo disponível." /> : availableGroups.map((group) => <div key={group.provider_group_id} className="p-3 rounded-xl bg-[hsl(var(--dark-bg))] flex items-center gap-3"><UsersRound className="w-4 h-4 text-primary shrink-0" /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[hsl(var(--dark-text))] truncate">{group.name}</p><p className="text-[10px] text-[hsl(var(--dark-muted))]">{group.participant_count ?? "?"} participantes</p></div><button onClick={() => registerGroup(group)} disabled={group.already_registered || busy !== null} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold disabled:opacity-40">{group.already_registered ? "Cadastrado" : "Adicionar"}</button></div>)}</div>
        </Overlay>
      )}

      {selectedGroup && (
        <Overlay onClose={() => { setSelectedGroup(null); setMembers([]); }} title={`Participantes — ${selectedGroup.name}`}>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">{members.length === 0 ? <Empty text="Nenhum participante retornado." /> : members.map((member) => <div key={member.provider_member_id} className="p-3 rounded-xl bg-[hsl(var(--dark-bg))] flex items-center gap-3"><UserRound className="w-4 h-4 text-[hsl(var(--dark-muted))]" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[hsl(var(--dark-text))] truncate">{member.display_name || member.phone_e164 || member.provider_member_id}</p>{member.phone_e164 && <p className="text-[10px] text-[hsl(var(--dark-muted))]">{formatPhone(member.phone_e164)}</p>}</div>{(member.is_admin || member.is_super_admin) && <ShieldCheck className="w-4 h-4 text-primary" />}</div>)}</div>
        </Overlay>
      )}

      <style>{`.field{width:100%;height:44px;border-radius:12px;background:hsl(var(--dark-bg));border:1px solid hsl(var(--dark-card-hover));padding-left:12px;padding-right:12px;font-size:13px;color:hsl(var(--dark-text));outline:none}.field:focus{border-color:hsl(var(--primary)/.55)}`}</style>
    </div>
  );
};

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl p-8 bg-[hsl(var(--dark-card))] border border-dashed border-[hsl(var(--dark-card-hover))] text-center"><p className="text-xs text-[hsl(var(--dark-muted))]">{text}</p></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-wider text-[hsl(var(--dark-muted))]">{label}</span><div className="mt-1">{children}</div></label>;
}
function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm px-4 py-8 overflow-y-auto"><div className="w-full max-w-lg mx-auto rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] shadow-2xl"><div className="p-4 border-b border-[hsl(var(--dark-card-hover))] flex items-center gap-3"><h3 className="text-sm font-bold text-[hsl(var(--dark-text))] flex-1">{title}</h3><button onClick={onClose} className="w-9 h-9 rounded-xl grid place-items-center bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"><X className="w-4 h-4" /></button></div><div className="p-4">{children}</div></div></div>;
}

export default AtisRecipients;