import { useState } from "react";
import AdminCultoSelections from "@/components/admin/AdminCultoSelections";
import AdminCultoOrganization from "@/components/admin/AdminCultoOrganization";
import { ArrowLeft, CalendarRange, Music2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import PageHead from "@/components/PageHead";

const AdminCultoSelectionsPage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useIsAdmin();
  const [tab, setTab] = useState<"organization" | "songs">("organization");

  if (loading) return null;
  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))] pb-20">
      <PageHead title="Gestão de Cultos — Admin" description="Organização ministerial e seleção de hinos dos cultos" path="/admin/cultos" />

      <header className="sticky top-0 z-30 bg-[hsl(var(--dark-bg))]/90 backdrop-blur border-b border-[hsl(var(--dark-card-hover))]">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/harpa")} className="p-1 -ml-1 hover:bg-[hsl(var(--dark-card-hover))] rounded-full transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm font-bold">Gestão de Cultos</p>
            <p className="text-[10px] text-[hsl(var(--dark-muted))]">Organização do culto + louvor</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-5">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[hsl(var(--dark-card))] mb-5 sticky top-[68px] z-20 shadow-sm">
          <button
            onClick={() => setTab("organization")}
            className={`h-10 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition ${tab === "organization" ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-muted))]"}`}
          >
            <CalendarRange className="w-4 h-4" /> Organização
          </button>
          <button
            onClick={() => setTab("songs")}
            className={`h-10 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition ${tab === "songs" ? "bg-primary text-primary-foreground" : "text-[hsl(var(--dark-muted))]"}`}
          >
            <Music2 className="w-4 h-4" /> Hinos e cânticos
          </button>
        </div>

        {tab === "organization" ? <AdminCultoOrganization /> : <AdminCultoSelections />}
      </main>
    </div>
  );
};

export default AdminCultoSelectionsPage;
