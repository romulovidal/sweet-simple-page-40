import { Link } from "react-router-dom";
import PageHead from "@/components/PageHead";
import { Shield, ArrowLeft } from "lucide-react";

const PrivacyPage = () => {
  return (
    <div className="pb-20 min-h-screen max-w-3xl mx-auto">
      <PageHead
        title="Política de Privacidade — A Bíblia do Atalaia"
        description="Como a Bíblia do Atalaia trata seus dados pessoais conforme a LGPD (Lei 13.709/2018)."
        path="/privacidade"
      />
      <header className="px-5 pt-10 pb-6 flex items-center gap-3">
        <Link to="/" className="text-primary text-sm font-semibold flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Início
        </Link>
      </header>

      <div className="px-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Política de Privacidade</h1>
            <p className="text-xs text-[hsl(var(--dark-muted))]">Última atualização: Julho de 2026</p>
          </div>
        </div>

        <div className="space-y-5 text-sm text-[hsl(var(--dark-muted))] leading-relaxed">
          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">1. Introdução</h2>
            <p>
              A <strong>Bíblia do Atalaia</strong> (o "App") está comprometida com a proteção
              dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados
              (Lei nº 13.709/2018 — LGPD). Esta política descreve como coletamos, usamos e
              protegemos suas informações.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">2. Dados coletados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Cadastro:</strong> nome, e-mail e foto de perfil (via Google ou formulário).</li>
              <li><strong>Uso:</strong> progresso de leitura, versículos salvos, sequência, planos iniciados, favoritos da harpa.</li>
              <li><strong>Dispositivo:</strong> token de notificação push (opcional), tipo de aparelho para análises anônimas.</li>
              <li><strong>Conteúdo enviado:</strong> pedidos de oração, anotações pessoais (privados por padrão).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">3. Finalidades</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Personalizar sua experiência.</li>
              <li>Sincronizar seu progresso entre dispositivos.</li>
              <li>Enviar o versículo do dia e lembretes de culto (com sua permissão).</li>
              <li>Melhorar o app com métricas agregadas e anônimas.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">4. Inteligência artificial</h2>
            <p>
              Recursos como "Pergunte à Bíblia", devocionais e resumos de capítulo utilizam
              modelos de IA (Google Gemini, xAI ou Groq). Suas perguntas são
              enviadas ao provedor para gerar a resposta e <strong>não são usadas para
              treinar modelos</strong>. Respostas de IA podem conter imprecisões; sempre
              confirme com a Escritura. Você pode reportar respostas inadequadas pelo botão
              disponível em cada resposta.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">5. Compartilhamento</h2>
            <p>
              Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para
              fins comerciais. Utilizamos provedores de infraestrutura (Supabase
              para banco de dados, Google Gemini para IA, Google FCM para notificações), que
              atuam apenas como operadores dos dados.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">6. Armazenamento e segurança</h2>
            <p>
              Dados armazenados com criptografia em trânsito (HTTPS) e em repouso, com Row
              Level Security (RLS) garantindo que apenas você acesse seus próprios dados.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">7. Seus direitos (LGPD)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Acessar, corrigir e portar seus dados.</li>
              <li>Revogar consentimento a qualquer momento.</li>
              <li><strong>Excluir sua conta</strong> e todos os dados associados diretamente no app
                (Perfil → Configurações → Excluir conta) ou solicitando por e-mail.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">8. Exclusão de conta</h2>
            <p>
              Para excluir sua conta e todos os dados sem instalar o app, envie um e-mail
              com o assunto "Excluir minha conta" para{" "}
              <strong className="text-dark-text">contato@vidalweb.com.br</strong> a partir do
              e-mail cadastrado. A exclusão é concluída em até 7 dias úteis e remove: perfil,
              versículos salvos, notas, pedidos de oração, progresso e assinatura de push.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">9. Contato do encarregado (DPO)</h2>
            <p>
              E-mail: <strong className="text-dark-text">contato@vidalweb.com.br</strong>
            </p>
          </section>

          <p className="pt-4 border-t border-[hsl(var(--dark-card-hover))] text-xs">
            Ver também: <Link to="/termos" className="text-primary font-semibold">Termos de Uso</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;