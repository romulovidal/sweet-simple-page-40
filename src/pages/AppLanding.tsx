import { ArrowRight, BookOpen, Heart, Users, Sparkles, Bell, HandHeart, Cross, Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const APP_URL = "https://biblia.atalaias.online/";

const features = [
  { icon: BookOpen, title: "Bíblia Completa", desc: "Acesso a múltiplas versões (ACF, ARA, ARC, KJA, NTLH, NVI) com leitura offline." },
  { icon: Sparkles, title: "Inteligência Espiritual", desc: "Pergunte à Bíblia, receba devocionais, resumos de capítulos e exegese com inteligência espiritual." },
  { icon: HandHeart, title: "Pedidos de Oração", desc: "Compartilhe e interceda pela comunidade — públicos ou privados." },
  { icon: Bell, title: "Versículo do Dia", desc: "Notificações diárias com a Palavra para edificar seu caminhar." },
  { icon: Users, title: "Horários de Culto", desc: "Acompanhe os cultos do Ministério Atalaias de Betel e receba lembretes." },
  { icon: Heart, title: "Planos de Leitura", desc: "Trilhe a Bíblia em 1 ano, descubra temas e cresça espiritualmente." },
];

const AppLanding = () => {
  return (
    <div className="min-h-screen bg-[#0a0612] text-white overflow-hidden relative">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-indigo-600/15 blur-[120px]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10">
        {/* Hero */}
        <section className="relative px-6 pt-24 pb-32">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 mb-10 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
              <Cross className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium tracking-[0.2em] uppercase text-amber-200/90">
                Ministério Atalaias de Betel
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] mb-8 tracking-tight">
              <span className="block">A Palavra de Deus</span>
              <span className="block bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400 bg-clip-text text-transparent">
                na palma da sua mão
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
              Um aplicativo criado para aproximar você da Palavra — leitura, oração, comunidade e
              ferramentas de inteligência espiritual em um só lugar.
            </p>

            <a href={APP_URL} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="group rounded-full px-10 py-7 text-base font-semibold gap-2 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 shadow-[0_0_60px_rgba(251,191,36,0.4)] hover:shadow-[0_0_80px_rgba(251,191,36,0.6)] transition-all hover:scale-105"
              >
                Acessar o App
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>
            <p className="mt-5 text-sm text-white/40 flex items-center justify-center gap-1.5">
              <Smartphone className="w-4 h-4" /> Funciona como app — instale na tela inicial
            </p>
          </div>
        </section>

        {/* Propósito */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border border-white/10 p-10 md:p-14 text-center shadow-2xl">
              <div className="absolute -top-px left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
              <span className="text-xs font-medium tracking-[0.25em] uppercase text-amber-400">
                Nosso propósito
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mt-4 mb-8 tracking-tight">
                Levar a Palavra de Deus <span className="text-amber-300">a todos</span>
              </h2>
              <p className="text-lg text-white/70 leading-relaxed mb-5">
                O <strong className="text-white">Ministério Atalaias de Betel</strong> nasceu com um chamado claro:
                ser uma sentinela da Palavra, anunciando o evangelho de Jesus Cristo a todas as pessoas, em
                todo lugar e em todo tempo.
              </p>
              <p className="text-lg text-white/70 leading-relaxed">
                Este app foi criado para ser uma extensão desse chamado — uma ferramenta acessível, gratuita e
                moderna para que cada irmão e irmã possa{" "}
                <strong className="text-white">ler, meditar, orar e crescer</strong> na fé, estando próximo
                da nossa comunidade onde quer que esteja.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-medium tracking-[0.25em] uppercase text-amber-400">
                O que você encontra
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mt-4 tracking-tight">
                Tudo para caminhar com Deus
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="group relative rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] backdrop-blur-xl border border-white/10 p-7 hover:border-amber-400/30 hover:from-amber-500/10 hover:to-white/[0.02] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-20px_rgba(251,191,36,0.3)]"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-amber-300" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Versículo */}
        <section className="py-28 px-6 relative">
          <div className="max-w-3xl mx-auto text-center relative">
            <div className="absolute -inset-x-20 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
            <div className="relative">
              <Cross className="w-10 h-10 text-amber-400 mx-auto mb-8 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
              <p className="text-2xl md:text-4xl font-light italic leading-relaxed text-white/90">
                "Ide por todo o mundo e pregai o evangelho a toda criatura."
              </p>
              <span className="block mt-8 text-sm font-medium tracking-[0.3em] uppercase text-amber-400">
                Marcos 16:15
              </span>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-24 px-6">
          <div className="max-w-2xl mx-auto text-center relative">
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-amber-500/10 to-transparent blur-3xl rounded-full" />
            <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Comece agora<br />
              <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
                sua jornada
              </span>
            </h2>
            <p className="text-lg text-white/60 mb-12 leading-relaxed">
              Abra o app, instale na tela inicial e tenha a Palavra sempre por perto.
            </p>
            <a href={APP_URL} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="group rounded-full px-12 py-7 text-base font-semibold gap-2 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 shadow-[0_0_60px_rgba(251,191,36,0.4)] hover:shadow-[0_0_80px_rgba(251,191,36,0.6)] transition-all hover:scale-105"
              >
                <Download className="w-5 h-5" /> Acessar o App
              </Button>
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 px-6 border-t border-white/5 text-center text-sm text-white/40">
          <p>&copy; {new Date().getFullYear()} Ministério Atalaias de Betel. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
};

export default AppLanding;
