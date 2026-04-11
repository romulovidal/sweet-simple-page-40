import { Book, Heart, Users, ArrowRight, Cross, MessageCircle, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBible from "@/assets/hero-bible.jpg";

const WHATSAPP_NUMBER = "5585996181278";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Gostaria de saber mais sobre a pregação da Palavra.`;

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cross className="w-6 h-6 text-primary" />
            <span className="font-heading font-bold text-lg">Pregação da Palavra</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#inicio" className="hover:text-foreground transition-colors">Início</a>
            <a href="#pilares" className="hover:text-foreground transition-colors">Pilares</a>
            <a href="#versiculo" className="hover:text-foreground transition-colors">Versículos</a>
            <a href="#contato" className="hover:text-foreground transition-colors">Contato</a>
          </div>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)] text-white rounded-full gap-2">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </Button>
          </a>
        </div>
      </nav>

      {/* Hero — Split Screen */}
      <section id="inicio" className="relative min-h-screen flex flex-col md:flex-row">
        <div className="flex-1 flex items-center justify-center px-8 py-32 md:py-0 bg-[hsl(var(--hero-bg))]">
          <div className="max-w-lg animate-fade-up">
            <span className="inline-flex items-center gap-2 text-accent text-sm font-medium tracking-widest uppercase mb-6">
              <Cross className="w-4 h-4" /> Ministério da Palavra
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[hsl(var(--hero-foreground))] leading-tight mb-6">
              A Palavra que <span className="text-accent">transforma</span> vidas
            </h1>
            <p className="text-lg text-[hsl(var(--hero-muted))] mb-8 leading-relaxed">
              Venha conhecer o poder da pregação bíblica. Uma jornada de fé, esperança e amor através das Escrituras Sagradas.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-8 py-6 text-base">
                  Comece sua jornada <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
              <Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-base border-[hsl(var(--hero-muted))]/30 text-[hsl(var(--hero-foreground))] hover:bg-white/5">
                <Play className="mr-2 w-5 h-5" /> Ouça uma pregação
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 relative min-h-[40vh] md:min-h-0">
          <img
            src={heroBible}
            alt="Bíblia aberta com raios de luz"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--hero-bg))] via-[hsl(var(--hero-bg))]/50 to-transparent md:block hidden" />
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6 bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "500+", label: "Pregações" },
            { value: "10k+", label: "Vidas tocadas" },
            { value: "50+", label: "Comunidades" },
            { value: "15", label: "Anos de missão" },
          ].map((stat, i) => (
            <div key={i}>
              <p className="text-3xl md:text-4xl font-bold">{stat.value}</p>
              <p className="text-primary-foreground/70 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Versículo */}
      <section id="versiculo" className="py-24 px-6 bg-secondary text-secondary-foreground">
        <div className="max-w-2xl mx-auto text-center">
          <Star className="w-8 h-8 text-accent mx-auto mb-6" />
          <p className="text-2xl md:text-3xl font-heading font-light italic leading-relaxed">
            "Porque a palavra de Deus é viva, e eficaz, e mais penetrante do que qualquer espada de dois gumes."
          </p>
          <span className="block mt-6 text-accent text-sm font-medium tracking-widest uppercase">
            Hebreus 4:12
          </span>
        </div>
      </section>

      {/* Pilares */}
      <section id="pilares" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-accent text-sm font-medium tracking-widest uppercase">Nossa base</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3">
              Pilares da nossa fé
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Book,
                title: "Estudo Bíblico",
                desc: "Mergulhe nas Escrituras e descubra a sabedoria eterna que guia nossos passos.",
              },
              {
                icon: Heart,
                title: "Amor ao Próximo",
                desc: "Pratique o amor incondicional que Jesus nos ensinou através do seu exemplo.",
              },
              {
                icon: Users,
                title: "Comunidade",
                desc: "Caminhe junto com irmãos na fé, fortalecendo uns aos outros em comunhão.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-5 transition-colors">
                  <item.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="py-24 px-6 bg-[hsl(var(--hero-bg))] text-[hsl(var(--hero-foreground))]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Venha fazer parte
          </h2>
          <p className="text-[hsl(var(--hero-muted))] text-lg mb-8">
            Junte-se a nós e experimente a transformação que só a Palavra de Deus pode proporcionar.
          </p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)] text-white text-base px-8 py-6 rounded-full font-semibold gap-2"
            >
              <MessageCircle className="w-5 h-5" /> Fale conosco no WhatsApp
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-muted text-muted-foreground text-center text-sm">
        <p>&copy; {new Date().getFullYear()} — Pregação da Palavra. Todos os direitos reservados.</p>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-110"
        aria-label="Fale conosco no WhatsApp"
      >
        <MessageCircle className="w-7 h-7" />
      </a>
    </div>
  );
};

export default Index;
