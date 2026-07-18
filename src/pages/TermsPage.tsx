import { Link } from "react-router-dom";
import PageHead from "@/components/PageHead";
import { FileText, ArrowLeft } from "lucide-react";

const TermsPage = () => {
  return (
    <div className="pb-20 min-h-screen max-w-3xl mx-auto">
      <PageHead
        title="Termos de Uso — A Bíblia do Atalaia"
        description="Termos e condições de uso do aplicativo Bíblia do Atalaia."
        path="/termos"
      />
      <header className="px-5 pt-10 pb-6 flex items-center gap-3">
        <Link to="/" className="text-primary text-sm font-semibold flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Início
        </Link>
      </header>

      <div className="px-5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Termos de Uso</h1>
            <p className="text-xs text-[hsl(var(--dark-muted))]">Última atualização: Julho de 2026</p>
          </div>
        </div>

        <div className="space-y-5 text-sm text-[hsl(var(--dark-muted))] leading-relaxed">
          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">1. Aceitação</h2>
            <p>
              Ao usar a <strong>Bíblia do Atalaia</strong>, você concorda com estes Termos e com nossa{" "}
              <Link to="/privacidade" className="text-primary font-semibold">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">2. Finalidade do app</h2>
            <p>
              App gratuito de leitura bíblica, harpa cristã, planos devocionais, estudos e ferramentas
              de estudo com auxílio de IA. Uso pessoal e devocional. Não substitui aconselhamento
              pastoral, teológico, jurídico ou médico.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">3. Conta do usuário</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Você é responsável por manter suas credenciais em sigilo.</li>
              <li>Idade mínima recomendada: 13 anos.</li>
              <li>Você pode excluir sua conta a qualquer momento em Perfil → Configurações.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">4. Conteúdo do usuário</h2>
            <p>
              Anotações e pedidos de oração enviados pelo usuário devem respeitar a lei e a dignidade
              de terceiros. É proibido enviar conteúdo ofensivo, ilegal, spam ou discriminatório.
              Reservamo-nos o direito de remover conteúdo que viole estas regras. Reporte conteúdos
              inadequados pelo e-mail <strong className="text-dark-text">contato@vidalweb.com.br</strong>.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">5. Inteligência artificial</h2>
            <p>
              As respostas geradas por IA são fornecidas "como estão", com filtros de segurança do
              provedor. Podem conter erros ou interpretações imprecisas. Não devem ser tratadas como
              doutrina oficial. Reporte respostas inadequadas pelo botão em cada resposta.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">6. Propriedade intelectual</h2>
            <p>
              O código do app, marca "Bíblia do Atalaia" e design são de propriedade dos autores.
              Textos bíblicos e da Harpa Cristã são de domínio público nas versões utilizadas.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">7. Limitação de responsabilidade</h2>
            <p>
              O app é fornecido "no estado em que se encontra". Não garantimos disponibilidade
              ininterrupta. Não nos responsabilizamos por decisões tomadas com base em respostas
              de IA ou por perda de dados locais em caso de desinstalação sem sincronização.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">8. Alterações</h2>
            <p>
              Estes termos podem ser atualizados. Continuando a usar o app após mudanças, você
              concorda com a nova versão.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">9. Foro</h2>
            <p>
              Fica eleito o foro da comarca de Fortaleza-CE, Brasil, para dirimir controvérsias.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-dark-text mb-1 text-base">10. Contato</h2>
            <p>
              <strong className="text-dark-text">contato@vidalweb.com.br</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;