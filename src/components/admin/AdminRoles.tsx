import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shield, ShieldOff, Loader2, Users, Crown } from "lucide-react";

interface UserWithRole {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "super_admin" | "admin" | "user";
  email?: string;
}

const AdminRoles = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const userRolesMap = new Map<string, string>();
    (rolesRes.data || []).forEach(r => {
      userRolesMap.set(r.user_id, String(r.role));
    });

    const myRole = user?.id ? userRolesMap.get(user.id) : null;
    setCurrentUserRole(myRole || null);

    const usersWithRoles: UserWithRole[] = (profilesRes.data || []).map(p => ({
      id: p.id,
      user_id: p.user_id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: (userRolesMap.get(p.user_id) as any) || "user",
    }));

    // Super Admins first, then Admins
    usersWithRoles.sort((a, b) => {
      const score = (r: string) => r === "super_admin" ? 2 : r === "admin" ? 1 : 0;
      return score(b.role) - score(a.role);
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const promoteToAdmin = async (userId: string) => {
    if (currentUserRole !== "super_admin") {
      toast.error("Apenas Super Admins podem gerenciar permissões");
      return;
    }

    setActionLoading(userId);
    // Use direct insert, RLS/Trigger/Hierarchy will handle if we implement a backend check
    // For now we assume Super Admin has bypass or we'll rely on the upcoming RPC if needed
    const { error } = await supabase.from("user_roles").insert({ 
      user_id: userId, 
      role: "admin" as any 
    });

    if (error) {
      if (error.code === "23505") toast.error("Usuário já possui privilégios");
      else toast.error("Erro ao promover: " + error.message);
    } else {
      toast.success("Usuário promovido a admin!");
      await supabase.from("admin_activity_log").insert({
        user_id: currentUserId,
        action: "role_promoted",
        details: { target_user_id: userId, role: "admin" },
      });
    }
    setActionLoading(null);
    loadData();
  };

  const removeAdmin = async (userId: string) => {
    if (currentUserRole !== "super_admin") {
      toast.error("Apenas Super Admins podem remover privilégios");
      return;
    }

    const targetUser = users.find(u => u.user_id === userId);
    if (targetUser?.role === "super_admin") {
      toast.error("Não é possível remover um Super Admin");
      return;
    }

    if (userId === currentUserId) {
      toast.error("Você não pode remover a si próprio!");
      return;
    }
    
    if (!window.confirm("Remover privilégio administrativo deste usuário?")) return;

    setActionLoading(userId);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin" as any);

    if (error) toast.error("Erro ao remover: " + error.message);
    else {
      toast.success("Privilégio removido");
      await supabase.from("admin_activity_log").insert({
        user_id: currentUserId,
        action: "role_removed",
        details: { target_user_id: userId },
      });
    }
    setActionLoading(null);
    loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const admins = users.filter(u => u.role === "admin" || u.role === "super_admin");
  const regularUsers = users.filter(u => u.role === "user");

  return (
    <div className="space-y-4">
      {/* Admins */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Administradores ({admins.length})</span>
        </div>
        <div className="space-y-2">
          {admins.map(u => (
            <div key={u.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-3">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${u.role === "super_admin" ? "bg-primary/20" : "bg-amber-500/15"}`}>
                  {u.role === "super_admin" ? <Shield className="w-5 h-5 text-primary" /> : <Crown className="w-5 h-5 text-amber-400" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{u.display_name || "Sem nome"}</p>
                  {u.role === "super_admin" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold uppercase tracking-wider">Super</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-[hsl(var(--dark-muted))] truncate max-w-[150px]">{u.user_id}</p>
                  {u.user_id === currentUserId && (
                    <p className="text-[10px] text-primary font-medium">Você</p>
                  )}
                </div>
              </div>
              {currentUserRole === "super_admin" && u.role === "admin" && (
                <Button size="sm" variant="outline" onClick={() => removeAdmin(u.user_id)}
                  disabled={actionLoading === u.user_id}
                  className="text-xs bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))] hover:text-[hsl(var(--dark-text))]">
                  {actionLoading === u.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3 mr-1" />}
                  Remover
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Regular users */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          <span className="text-sm font-semibold">Usuários ({regularUsers.length})</span>
        </div>
        <div className="space-y-2">
          {regularUsers.map(u => (
            <div key={u.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-3">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{u.display_name || "Sem nome"}</p>
                <p className="text-[10px] text-[hsl(var(--dark-muted))] truncate">{u.user_id}</p>
              </div>
              {currentUserRole === "super_admin" && (
                <Button size="sm" variant="outline" onClick={() => promoteToAdmin(u.user_id)}
                  disabled={actionLoading === u.user_id}
                  className="text-xs bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] hover:bg-[hsl(var(--dark-card-hover))] hover:text-[hsl(var(--dark-text))]">
                  {actionLoading === u.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                  Promover
                </Button>
              )}
            </div>
          ))}
          {regularUsers.length === 0 && (
            <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-6">Nenhum usuário comum encontrado</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminRoles;
