import { ArrowRight, BookOpen, Heart, Users, Sparkles, Bell, HandHeart, Cross, Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const APP_URL = "https://biblia.atalaias.online/";

const features = [
  { icon: BookOpen, title: "Bíblia Completa", desc: "Acesso a múltiplas versões (ACF, ARA, ARC, KJA, NTLH, NVI) com leitura offline." },
  { icon: Sparkles, title: "Inteligência com a Palavra", desc: "Pergunte à Bíblia, receba devocionais, resumos de capítulos e exegese com IA." },
  { icon: HandHeart, title: "Pedidos de Oração", desc: "Compartilhe e interceda pela comunidade — públicos ou privados." },
  { icon: Bell, title: "Versículo do Dia", desc: "Notificações diárias com a Palavra para edificar seu caminhar." },
  { icon: Users, title: "Horários de Culto", desc: "Acompanhe os cultos do Ministério Atalaias de Betel e receba lembretes." },
  { icon: Heart, title: "Planos de Leitura", desc: "Trilhe a Bíblia em 1 ano, descubra temas e cresça espiritualmente." },
];

const AppLanding = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Cross className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium tracking-wider uppercase text-primary">Ministério Atalaias de Betel</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            A Palavra de Deus<br />
            <span className="text-primary">na palma da sua mão</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Um aplicativo criado para aproximar você da Palavra — com leitura, oração, comunidade e ferramentas de inteligência espiritual em um só lugar.
          </p>
          <a href={APP_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="rounded-full px-8 py-6 text-base font-semibold gap-2">
              Acessar o App <ArrowRight className="w-5 h-5" />
            </Button>
          </a>
          <p className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <Smartphone className="w-4 h-4" /> Funciona como app — instale na tela inicial
          </p>
        </div>
      </section>

      {/* Propósito */}
      <section className="py-20 px-6 bg-card/50">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-xs font-medium tracking-widest uppercase text-primary">Nosso propósito</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-6">Levar a Palavra de Deus a todos</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-4">
            O <strong className="text-foreground">Ministério Atalaias de Betel</strong> nasceu com um chamado claro: ser
            uma sentinela da Palavra, anunciando o evangelho de Jesus Cristo a todas as pessoas, em todo lugar e em todo tempo.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Este app foi criado para ser uma extensão desse chamado — uma ferramenta acessível, gratuita e moderna para
            que cada irmão e irmã possa <strong className="text-foreground">ler, meditar, orar e crescer</strong> na fé,
            estando próximo da nossa comunidade onde quer que esteja.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-medium tracking-widest uppercase text-primary">O que você encontra</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3">Tudo que você precisa para caminhar com Deus</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="p-6 hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Versículo */}
      <section className="py-20 px-6 bg-card/50 border-y border-border">
        <div className="max-w-3xl mx-auto text-center">
          <Cross className="w-8 h-8 text-primary mx-auto mb-6 opacity-60" />
          <p className="text-2xl md:text-3xl font-light italic leading-relaxed text-foreground">
            "Ide por todo o mundo e pregai o evangelho a toda criatura."
          </p>
          <span className="block mt-6 text-sm font-medium tracking-widest uppercase text-primary">
            Marcos 16:15
          </span>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Comece agora sua jornada
          </h2>
          <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
            Abra o app, instale na tela inicial e tenha a Palavra sempre por perto.
          </p>
          <a href={APP_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="rounded-full px-10 py-6 text-base font-semibold gap-2">
              <Download className="w-5 h-5" /> Acessar o App
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Ministério Atalaias de Betel. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default AppLanding;
