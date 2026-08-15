import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Edit2, Trash2, Download, Save } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface AdminUsersProps {
  users: UserProfile[];
  fetchData: () => void;
}

const AdminUsers = ({ users, fetchData }: AdminUsersProps) => {
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState("");

  const exportUsersCSV = () => {
    const headers = ["Nome", "Data de Cadastro"];
    const rows = users.map(u => [u.display_name || "Sem nome", new Date(u.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[hsl(var(--dark-muted))]">{users.length} usuário{users.length !== 1 ? "s" : ""}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={exportUsersCSV}
          className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))] hover:text-[hsl(var(--dark-text))]"
        >
          <Download className="w-3 h-3 mr-1" /> CSV
        </Button>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
            <div className="flex items-center gap-3">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{u.display_name || "Sem nome"}</p>
                <p className="text-[10px] text-[hsl(var(--dark-muted))]">
                  Cadastro: {new Date(u.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })}
                </p>
              </div>
            </div>
            {editingUser?.id === u.id ? (
              <div className="mt-3 pt-3 border-t border-[hsl(var(--dark-card))] space-y-2">
                <Input value={editUserName} onChange={(e) => setEditUserName(e.target.value)}
                  placeholder="Nome do usuário" className="bg-[hsl(var(--dark-bg))] border-none text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={async () => {
                    const { error } = await supabase.from("profiles").update({ display_name: editUserName }).eq("id", u.id);
                    if (error) { 
                      console.error("[ADMIN USERS] Profile update error:", error);
                      const isPermError = error.code === '42501' || error.message?.includes('42501');
                      toast.error(`Erro ao salvar: ${error.message}${isPermError ? ' (Sem permissão de escrita)' : ''}`); 
                      return; 
                    }

                    toast.success("Nome atualizado!"); setEditingUser(null); fetchData();
                  }}><Save className="w-3 h-3 mr-1" /> Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingUser(null)} className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))] hover:text-[hsl(var(--dark-text))]">Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-card))]">
                <button onClick={() => { setEditingUser(u); setEditUserName(u.display_name || ""); }}
                  className="text-xs text-primary font-medium flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
                <button onClick={async () => {
                  if (!window.confirm("Excluir este usuário e todos os dados dele?")) return;
                  const results = await Promise.all([
                    supabase.from("user_plan_progress").delete().eq("user_id", u.user_id),
                    supabase.from("user_saved_verses").delete().eq("user_id", u.user_id),
                    supabase.from("user_streaks").delete().eq("user_id", u.user_id),
                    supabase.from("profiles").delete().eq("id", u.id)
                  ]);
                  const error = results.find(r => r.error)?.error;
                  if (error) {
                    console.error("[ADMIN USERS] Delete error:", error);
                    const isPermError = error.code === '42501' || error.message?.includes('42501');
                    toast.error(`Erro ao excluir: ${error.message}${isPermError ? ' (Sem permissão de escrita)' : ''}`);
                    return;
                  }
                  toast.success("Usuário removido"); fetchData();
                }} className="text-xs text-destructive font-medium flex items-center gap-1 ml-auto">

                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-10">Nenhum usuário cadastrado</p>}
      </div>
    </>
  );
};

export default AdminUsers;
export type { UserProfile };