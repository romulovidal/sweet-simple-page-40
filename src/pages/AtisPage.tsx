import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AtisLayout from "@/components/atis/AtisLayout";

const AtisPage = () => {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
  }, []);

  useEffect(() => {
    if (checked && !session) {
      navigate("/admin");
    }
  }, [checked, session, navigate]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--dark-bg))]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 bg-[hsl(var(--dark-bg))]">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold text-[hsl(var(--dark-text))]">Acesso negado</h2>
          <p className="text-sm text-[hsl(var(--dark-muted))] mt-1">Painel Atis é restrito a administradores.</p>
          <button onClick={() => navigate("/admin")} className="mt-4 text-primary text-sm font-semibold">Ir para Admin</button>
        </div>
      </div>
    );
  }

  return <AtisLayout />;
};

export default AtisPage;