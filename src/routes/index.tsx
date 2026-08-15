import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const RootRoute = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-mono text-sm leading-relaxed">
      <div className="max-w-2xl w-full space-y-4">
        <h2 className="text-primary font-bold text-lg mb-6">Como adicionar um Super Admin no Supabase:</h2>
        
        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <p className="text-zinc-400 mb-2"># 1. Obtenha o UUID do usuário na tabela auth.users</p>
          <p className="text-zinc-400 mb-4"># 2. Execute o comando abaixo no SQL Editor do Supabase:</p>
          
          <code className="block bg-black p-3 rounded border border-zinc-700 text-green-400 select-all">
            INSERT INTO public.user_roles (user_id, role) <br/>
            VALUES ('COLOQUE-O-UUID-AQUI', 'super_admin') <br/>
            ON CONFLICT (user_id, role) DO NOTHING;
          </code>
        </div>

        <p className="text-zinc-500 text-xs mt-8">
          Nota: O sistema redirecionará para o início em alguns instantes.
        </p>
      </div>
    </div>
  );
};

export default RootRoute;
