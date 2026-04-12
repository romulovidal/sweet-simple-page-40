import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LGPDTermsDialogProps {
  children: React.ReactNode;
}

const LGPDTermsDialog = ({ children }: LGPDTermsDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">Política de Privacidade e Termos de Uso</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 text-sm text-[hsl(var(--dark-muted))] leading-relaxed">
            <section>
              <h3 className="font-bold text-foreground mb-1">1. Introdução</h3>
              <p>
                A Bíblia do Atalaia está comprometida com a proteção dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
              </p>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">2. Dados Coletados</h3>
              <p>Coletamos apenas os dados necessários para o funcionamento do aplicativo:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li><strong>Dados de cadastro:</strong> nome, e-mail e foto de perfil (quando fornecidos via Google ou formulário).</li>
                <li><strong>Dados de uso:</strong> progresso de leitura, versículos salvos, sequência de leitura e planos iniciados.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">3. Finalidade do Tratamento</h3>
              <p>Seus dados são utilizados exclusivamente para:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Personalizar sua experiência no aplicativo.</li>
                <li>Salvar e sincronizar seu progresso de leitura entre dispositivos.</li>
                <li>Melhorar o funcionamento e os recursos do aplicativo.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">4. Compartilhamento de Dados</h3>
              <p>
                Não compartilhamos, vendemos ou transferimos seus dados pessoais a terceiros, exceto quando exigido por lei ou ordem judicial.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">5. Armazenamento e Segurança</h3>
              <p>
                Seus dados são armazenados em servidores seguros com criptografia e protegidos por políticas de acesso restrito. Apenas você tem acesso aos seus dados pessoais de leitura.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">6. Seus Direitos (LGPD)</h3>
              <p>Você tem o direito de:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Acessar seus dados pessoais a qualquer momento.</li>
                <li>Corrigir dados incompletos ou desatualizados.</li>
                <li>Solicitar a exclusão dos seus dados pessoais.</li>
                <li>Revogar seu consentimento a qualquer momento.</li>
                <li>Solicitar a portabilidade dos seus dados.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">7. Exclusão de Conta</h3>
              <p>
                Você pode solicitar a exclusão completa da sua conta e todos os dados associados a qualquer momento através das configurações do perfil ou entrando em contato conosco.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">8. Contato</h3>
              <p>
                Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento dos seus dados, entre em contato pelo e-mail: <strong className="text-foreground">contato@vidalweb.com.br</strong>
              </p>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">9. Atualizações</h3>
              <p>
                Esta política pode ser atualizada periodicamente. Recomendamos a leitura regular para se manter informado sobre como protegemos seus dados.
              </p>
            </section>

            <p className="text-xs pt-2 border-t border-[hsl(var(--dark-card-hover))]">
              Última atualização: Abril de 2026
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LGPDTermsDialog;
