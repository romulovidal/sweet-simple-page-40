import AdminCultoSelections from "@/components/admin/AdminCultoSelections";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import PageHead from "@/components/PageHead";

const AdminCultoSelectionsPage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useIsAdmin();

  if (loading) return null;
  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] pb-20">
      <PageHead title="Gestão de Cultos — Admin" description="Gerenciar seleções de hinos para o culto" path="/admin/cultos" />
      
      <header className="sticky top-0 z-30 bg-[hsl(var(--dark-bg))]/90 backdrop-blur border-b border-[hsl(var(--dark-card-hover))]">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/harpa")} className="p-1 -ml-1 hover:bg-[hsl(var(--dark-card-hover))] rounded-full transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm font-bold">Gestão de Cultos</p>
            <p className="text-[10px] text-[hsl(var(--dark-muted))]">Painel Administrativo</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-6">
        <AdminCultoSelections />
      </main>
    </div>
  );
};

export default AdminCultoSelectionsPage;
