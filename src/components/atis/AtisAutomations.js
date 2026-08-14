import { useEffect, useState } from "react";
import { atisDb } from "./atisDb";
import { atisTargetDb } from "./atisTargetDb";
import { toast } from "sonner";
import { AtisTargetSelector } from "./AtisTargetSelector";
import { isProtectedAutomation } from "@/utils/atis-protection";
import { Plus, Trash2, Loader2, Search, Bell, BellOff, Settings2, History, Info, Play, Save, X, AlertTriangle, Clock, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
const WEEKDAYS = [
    { value: 0, label: "Dom" },
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
    { value: 6, label: "Sáb" },
];
const DEFAULT_TIMEZONE = "America/Fortaleza";
const AtisAutomations = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [targets, setTargets] = useState([]);
    const [originalTargets, setOriginalTargets] = useState([]);
    const [loadingTargets, setLoadingTargets] = useState(false);
    const load = async () => {
        setLoading(true);
        try {
            const { data, error } = await atisDb.from("atis_notification_configs").select("*").order("name");
            if (error)
                throw error;
            setItems(data || []);
        }
        catch (e) {
            toast.error("Erro ao carregar: " + e.message);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    const toggleEnabled = async (id, current) => {
        try {
            const { error } = await atisDb.from("atis_notification_configs")
                .update({ enabled: !current })
                .eq("id", id);
            if (error)
                throw error;
            load();
        }
        catch (e) {
            toast.error(e.message);
        }
    };
    const handleDelete = async (automation) => {
        if (isProtectedAutomation(automation.source_key)) {
            toast.error("Esta é uma automação de sistema e não pode ser excluída.");
            return;
        }
        if (!confirm(`Excluir automação "${automation.name}"?`))
            return;
        try {
            const { error } = await atisDb.from("atis_notification_configs").delete().eq("id", automation.id);
            if (error)
                throw error;
            toast.success("Automação excluída");
            load();
        }
        catch (e) {
            toast.error(e.message);
        }
    };
    const openEdit = async (item) => {
        setIsNew(false);
        setEditing(item);
        setForm({ ...item });
        // Carregar targets
        setLoadingTargets(true);
        setTargets([]);
        setOriginalTargets([]);
        try {
            const res = await atisTargetDb.getByConfig(item.id);
            // Tentar resolver nomes amigáveis para exibir na UI
            const enriched = await Promise.all(res.map(async (t) => {
                let displayName = t.target_id;
                let secondaryInfo = "";
                try {
                    if (t.target_type === 'profile') {
                        const { data } = await atisDb.from("profiles").select("display_name, whatsapp").eq("id", t.target_id).maybeSingle();
                        if (data) {
                            displayName = data.display_name;
                            secondaryInfo = data.whatsapp;
                        }
                    }
                    else if (t.target_type === 'contact') {
                        const { data } = await atisDb.from("atis_contacts").select("name, phone").eq("id", t.target_id).maybeSingle();
                        if (data) {
                            displayName = data.name;
                            secondaryInfo = data.phone;
                        }
                    }
                    else if (t.target_type === 'group') {
                        const { data } = await atisDb.from("atis_groups").select("name, wa_group_id").eq("wa_group_id", t.target_id).maybeSingle();
                        if (data) {
                            displayName = data.name;
                            secondaryInfo = data.wa_group_id;
                        }
                    }
                    else if (t.target_type === 'all_authenticated') {
                        displayName = "Todos os autenticados";
                    }
                }
                catch (e) {
                    console.warn("Failed to resolve target name", t);
                }
                return { ...t, display_name: displayName, secondary_info: secondaryInfo };
            }));
            setTargets(enriched);
            setOriginalTargets(enriched.map(t => ({ ...t })));
        }
        catch (e) {
            toast.error("Erro ao carregar destinatários: " + e.message);
        }
        finally {
            setLoadingTargets(false);
        }
    };
    const openNew = () => {
        setIsNew(true);
        setEditing(null);
        setTargets([]);
        setOriginalTargets([]);
        setForm({
            name: "",
            notification_type: "custom",
            enabled: true,
            automation_mode: "automatic",
            send_times: ["08:00"],
            days_of_week: [0, 1, 2, 3, 4, 5, 6],
            timezone: DEFAULT_TIMEZONE,
            use_ai: false,
            retry_enabled: true,
            retry_max: 3,
            metadata: {}
        });
    };
    const save = async () => {
        if (!form.name)
            return toast.error("Nome é obrigatório");
        setSaving(true);
        try {
            if (isNew) {
                // Gerar source_key baseado em slug do nome para personalizadas
                const slug = form.name?.toLowerCase().trim()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
                    .replace(/[^a-z0-9]+/g, "_");
                const source_key = `custom:${slug}_${Date.now()}`;
                const { data: newConfig, error } = await atisDb.from("atis_notification_configs").insert({
                    ...form,
                    source_key
                }).select("id").single();
                if (error)
                    throw error;
                // Salvar targets para nova automação
                if (targets.length > 0) {
                    await atisTargetDb.insert(targets.map(t => ({
                        config_id: newConfig.id,
                        target_type: t.target_type,
                        target_id: t.target_id,
                        active: t.active,
                        metadata: t.metadata || {}
                    })));
                }
                toast.success("Automação criada");
            }
            else {
                if (!editing)
                    return;
                // Update parcial da config
                const changes = {};
                const keys = Object.keys(form);
                for (const key of keys) {
                    if (isProtectedAutomation(editing.source_key) && (key === "source_key" || key === "notification_type")) {
                        continue;
                    }
                    if (JSON.stringify(form[key]) !== JSON.stringify(editing[key])) {
                        if (key === "metadata") {
                            changes[key] = {
                                ...(editing.metadata || {}),
                                ...(form.metadata || {})
                            };
                        }
                        else {
                            changes[key] = form[key];
                        }
                    }
                }
                if (Object.keys(changes).length > 0) {
                    const { error } = await atisDb.from("atis_notification_configs")
                        .update(changes)
                        .eq("id", editing.id);
                    if (error)
                        throw error;
                }
                // Salvar alterações nos targets (Diff explícito)
                const toAdd = targets.filter(t => !t.id);
                const toRemove = originalTargets
                    .filter(ot => !targets.some(t => t.id === ot.id))
                    .map(ot => ot.id);
                const toUpdate = targets.filter(t => {
                    if (!t.id)
                        return false;
                    const orig = originalTargets.find(ot => ot.id === t.id);
                    return orig && (orig.active !== t.active || JSON.stringify(orig.metadata) !== JSON.stringify(t.metadata));
                });
                if (toAdd.length > 0) {
                    await atisTargetDb.insert(toAdd.map(t => ({
                        config_id: editing.id,
                        target_type: t.target_type,
                        target_id: t.target_id,
                        active: t.active,
                        metadata: t.metadata || {}
                    })));
                }
                if (toRemove.length > 0) {
                    await atisTargetDb.delete(toRemove);
                }
                for (const t of toUpdate) {
                    await atisTargetDb.update(t.id, {
                        active: t.active,
                        metadata: t.metadata
                    });
                }
                toast.success("Configurações salvas");
            }
            setEditing(null);
            setIsNew(false);
            load();
        }
        catch (e) {
            toast.error(e.message);
        }
        finally {
            setSaving(false);
        }
    };
    const isSystem = (item) => isProtectedAutomation(item?.source_key);
    const isSentinelTime = (item, time) => {
        if (!isSystem(item) || !item)
            return false;
        // system:welcome e system:broadcasts usam 00:00 como sentinela (ignorado pelo runner de cron)
        if ((item.source_key === "system:welcome" || item.source_key === "system:broadcasts") && time === "00:00") {
            return true;
        }
        return false;
    };
    const filtered = items.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.notification_type.includes(q));
    return (<div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar automação..." className="w-full h-11 rounded-xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] pl-9 pr-4 text-sm outline-none focus:border-primary"/>
        </div>
        <Button onClick={openNew} className="h-11 rounded-xl gap-2 font-semibold">
          <Plus className="w-4 h-4"/> Criar
        </Button>
      </div>

      {loading ? (<Loader2 className="w-6 h-6 animate-spin mx-auto my-8 text-primary"/>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(i => (<div key={i.id} className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-4 space-y-3 transition-all hover:border-primary/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${i.enabled ? 'bg-green-500' : 'bg-[hsl(var(--dark-muted))]'}`}/>
                    <h3 className="font-bold text-sm truncate">{i.name}</h3>
                    {isSystem(i) ? (<Badge variant="secondary" className="h-5 text-[9px] px-1.5 uppercase tracking-tighter bg-primary/10 text-primary border-primary/20">Sistema</Badge>) : (<Badge variant="outline" className="h-5 text-[9px] px-1.5 uppercase tracking-tighter text-[hsl(var(--dark-muted))]">Personalizada</Badge>)}
                  </div>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] uppercase font-semibold tracking-wider">
                    {i.notification_type.replace('-', ' ')} • {i.automation_mode}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleEnabled(i.id, i.enabled)} className={`p-2 rounded-xl transition-colors ${i.enabled ? 'text-primary bg-primary/10' : 'text-[hsl(var(--dark-muted))] bg-[hsl(var(--dark-bg))]'}`}>
                    {i.enabled ? <Bell className="w-4 h-4"/> : <BellOff className="w-4 h-4"/>}
                  </button>
                  {!isSystem(i) && (<button onClick={() => handleDelete(i)} className="p-2 rounded-xl text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                      <Trash2 className="w-4 h-4"/>
                    </button>)}
                </div>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-[hsl(var(--dark-muted))] py-1 border-y border-[hsl(var(--dark-card-hover))]/50">
                <div className="flex items-center gap-1.5">
                  <Play className="w-3 h-3"/>
                  <span>{i.send_times.join(', ')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <History className="w-3 h-3"/>
                  <span>{i.days_of_week.length === 7 ? 'Diário' : `${i.days_of_week.length} dias`}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => openEdit(i)} className="flex-1 h-9 rounded-lg bg-[hsl(var(--dark-bg))] text-xs font-semibold gap-1.5 border-[hsl(var(--dark-card-hover))]">
                  <Settings2 className="w-3.5 h-3.5"/> Configurar
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]">
                  <Info className="w-3.5 h-3.5"/>
                </Button>
              </div>
            </div>))}
        </div>)}

      <Dialog open={!!editing || isNew} onOpenChange={(open) => !open && (setEditing(null), setIsNew(false))}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-text))] border-[hsl(var(--dark-card-hover))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isNew ? <Plus className="w-5 h-5 text-primary"/> : <Settings2 className="w-5 h-5 text-primary"/>}
              {isNew ? "Nova Automação" : "Configurar Automação"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isNew
            ? "Crie uma nova regra de disparo personalizado para o motor ATIS."
            : isSystem(editing)
                ? `Configurando automação de sistema: ${editing?.source_key}`
                : "Edite as configurações da automação personalizada."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da automação</Label>
                <Input id="name" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo técnico (slug)</Label>
                <Input id="type" disabled={!isNew && isSystem(editing)} value={form.notification_type || ""} onChange={e => setForm({ ...form, notification_type: e.target.value })} className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))] disabled:opacity-50"/>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))]">
              <div className="space-y-0.5">
                <Label>Status da automação</Label>
                <p className="text-[10px] text-[hsl(var(--dark-muted))]">Define se o motor deve processar este registro.</p>
              </div>
              <Switch checked={form.enabled || false} onCheckedChange={checked => setForm({ ...form, enabled: checked })}/>
            </div>

            <div className="space-y-4">
              <Label>Horários de disparo (America/Fortaleza)</Label>
              <div className="flex flex-wrap gap-2">
                {(form.send_times || []).map((time, idx) => (<div key={idx} className="flex items-center gap-1 bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] rounded-lg px-2 py-1">
                    {isSentinelTime(editing, time) ? (<div className="flex items-center gap-1.5 px-1">
                        <Clock className="w-3 h-3 text-primary"/>
                        <span className="text-xs font-mono">{time}</span>
                        <Badge variant="outline" className="h-4 text-[8px] px-1 text-primary border-primary/20">Sentinela</Badge>
                      </div>) : (<>
                        <input type="time" value={time} onChange={e => {
                    const newTimes = [...(form.send_times || [])];
                    newTimes[idx] = e.target.value;
                    setForm({ ...form, send_times: newTimes });
                }} className="bg-transparent border-none text-xs font-mono outline-none focus:ring-0"/>
                        <button onClick={() => {
                    const newTimes = (form.send_times || []).filter((_, i) => i !== idx);
                    setForm({ ...form, send_times: newTimes });
                }} className="p-1 hover:text-red-500">
                          <X className="w-3 h-3"/>
                        </button>
                      </>)}
                  </div>))}
                <Button variant="outline" size="sm" onClick={() => setForm({ ...form, send_times: [...(form.send_times || []), "08:00"] })} className="h-8 border-dashed border-[hsl(var(--dark-card-hover))]">
                  <Plus className="w-3 h-3 mr-1"/> Adicionar
                </Button>
              </div>
              <p className="text-[10px] text-[hsl(var(--dark-muted))] italic">O formato salvo é time[] (HH:mm:ss).</p>
            </div>

            <div className="space-y-3">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => (<Button key={day.value} variant={form.days_of_week?.includes(day.value) ? "default" : "outline"} size="sm" onClick={() => {
                const current = form.days_of_week || [];
                const next = current.includes(day.value)
                    ? current.filter(d => d !== day.value)
                    : [...current, day.value].sort();
                setForm({ ...form, days_of_week: next });
            }} className="h-9 w-10 text-[10px] font-bold uppercase rounded-lg border-[hsl(var(--dark-card-hover))]">
                    {day.label}
                  </Button>))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-[hsl(var(--dark-card-hover))]">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-primary"/>
                <h4 className="text-sm font-bold">Destinatários / Targets</h4>
              </div>
              
              {loadingTargets ? (<div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary"/>
                </div>) : (<AtisTargetSelector configId={isNew ? "temp" : editing?.id || ""} targets={targets} onChange={setTargets} disabled={saving}/>)}
            </div>

            <div className="space-y-4 pt-4 border-t border-[hsl(var(--dark-card-hover))]">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Conteúdo via Inteligência Artificial</Label>
                  <p className="text-[10px] text-[hsl(var(--dark-muted))]">Atis usará o Gemini para gerar mensagens contextualizadas.</p>
                </div>
                <Switch checked={form.use_ai || false} onCheckedChange={checked => setForm({ ...form, use_ai: checked })}/>
              </div>

              {form.use_ai ? (<div className="space-y-2">
                  <Label htmlFor="prompt">Prompt da IA</Label>
                  <Textarea id="prompt" value={form.ai_prompt || ""} onChange={e => setForm({ ...form, ai_prompt: e.target.value })} placeholder="Instruções para a IA gerar a mensagem..." rows={4} className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"/>
                </div>) : (<div className="space-y-2">
                  <Label htmlFor="template">Template da mensagem</Label>
                  <Textarea id="template" value={form.message_template || ""} onChange={e => setForm({ ...form, message_template: e.target.value })} placeholder="Olá {nome}, esta é uma mensagem automática..." rows={4} className="bg-[hsl(var(--dark-bg))] border-[hsl(var(--dark-card-hover))]"/>
                </div>)}
            </div>

            {!isNew && isSystem(editing) && (<div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-[10px] leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-primary shrink-0"/>
                <div>
                  <strong className="text-primary block mb-0.5 uppercase tracking-wide">Automação de Sistema</strong>
                  <p className="text-[hsl(var(--dark-muted))]">
                    Você está editando uma automação protegida. Campos como <code className="bg-primary/10 px-1 rounded">source_key</code> e <code className="bg-primary/10 px-1 rounded">notification_type</code> não podem ser alterados para manter a compatibilidade com o backend.
                  </p>
                </div>
              </div>)}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => (setEditing(null), setIsNew(false))} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
};
export default AtisAutomations;
