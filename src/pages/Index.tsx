import { Book, Heart, Users, ArrowRight, Cross, MessageCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBible from "@/assets/hero-bible.jpg";

const WHATSAPP_NUMBER = "5585996181278";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá! Gostaria de saber mais sobre a pregação da Palavra.`;

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero — Full Width with Overlay */}
      <section className="relative min-h-screen flex items-end pb-20 overflow-hidden">
        <img
          src={heroBible}
          alt="Bíblia aberta com raios de luz"
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--hero-bg))] via-[hsl(var(--hero-bg))]/70 to-[hsl(var(--hero-bg))]/30" />

        {/* Top Nav */}
        <nav className="absolute top-0 left-0 right-0 z-20 px-6 py-5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cross className="w-5 h-5 text-accent" />
              <span className="font-heading font-bold text-[hsl(var(--hero-foreground))]">Pregação da Palavra</span>
            </div>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)] text-white rounded-full gap-2">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </Button>
            </a>
          </div>
        </nav>

        <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
          <div className="max-w-2xl animate-fade-up">
            <span className="text-accent text-sm font-medium tracking-widest uppercase mb-4 block">
              Pregação da Palavra
            </span>
            <h1 className="text-5xl md:text-7xl font-bold text-[hsl(var(--hero-foreground))] leading-[1.1] mb-6">
              Ele já falou.<br />
              <span className="text-accent">Você já ouviu?</span>
            </h1>
            <p className="text-lg text-[hsl(var(--hero-muted))] mb-10 max-w-md leading-relaxed">
              A resposta que você procura não está longe. Está numa página, num versículo, numa decisão de fé.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full px-8 py-6 text-base font-semibold">
                  Fale conosco <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </div>
          </div>
          <a href="#pilares" className="absolute bottom-0 right-6 text-[hsl(var(--hero-muted))] animate-bounce hidden md:block">
            <ChevronDown className="w-8 h-8" />
          </a>
        </div>
      </section>

      {/* Pilares — Zigzag */}
      <section id="pilares" className="py-24 px-6">
        <div className="max-w-5xl mx-auto space-y-20">
          <div className="text-center mb-4">
            <span className="text-accent text-sm font-medium tracking-widest uppercase">Nosso alicerce</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3">Não é religião. É relacionamento.</h2>
          </div>

          {[
            {
              icon: Book,
              title: "Escrituras que respiram",
              desc: "Cada versículo carrega uma promessa viva. Mergulhamos na Bíblia não para decorar — mas para deixar Deus reescrever o que parecia definitivo na sua vida.",
            },
            {
              icon: Heart,
              title: "Graça que não escolhe rosto",
              desc: "O amor de Cristo não tem pré-requisito. Aqui ninguém precisa fingir que está bem. Venha como você é — a transformação é por conta Dele.",
            },
            {
              icon: Users,
              title: "Juntos no vale e no topo",
              desc: "Sozinho você aguenta. Juntos, a gente vence. Uma comunidade que não te abandona na segunda-feira depois do culto de domingo.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className={`flex flex-col md:flex-row items-center gap-10 ${i % 2 !== 0 ? "md:flex-row-reverse" : ""}`}
            >
              <div className="flex-shrink-0 w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
                <item.icon className="w-12 h-12 text-primary" />
              </div>
              <div className={`text-center ${i % 2 !== 0 ? "md:text-right" : "md:text-left"}`}>
                <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed max-w-md">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Versículo — Full Width Band */}
      <section className="relative py-28 px-6 bg-secondary overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Cross className="w-96 h-96 text-secondary-foreground" />
          </div>
        </div>
        <div className="relative max-w-3xl mx-auto text-center text-secondary-foreground">
          <p className="text-2xl md:text-4xl font-heading font-light italic leading-relaxed">
            "Porque a palavra de Deus é viva, e eficaz, e mais penetrante do que qualquer espada de dois gumes."
          </p>
          <span className="block mt-8 text-accent text-sm font-medium tracking-widest uppercase">
            Hebreus 4:12
          </span>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6 bg-[hsl(var(--hero-bg))]">
        <div className="max-w-xl mx-auto text-center">
          <Cross className="w-8 h-8 text-accent mx-auto mb-6" />
          <h2 className="text-3xl md:text-5xl font-bold text-[hsl(var(--hero-foreground))] mb-6">
            O próximo passo é seu
          </h2>
          <p className="text-[hsl(var(--hero-muted))] text-lg mb-10 leading-relaxed">
            Deus já fez a parte Dele. Agora é a sua vez de responder. Uma conversa pode mudar tudo.
          </p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-[hsl(142,70%,40%)] hover:bg-[hsl(142,70%,35%)] text-white text-base px-10 py-6 rounded-full font-semibold gap-2"
            >
              <MessageCircle className="w-5 h-5" /> Fale no WhatsApp
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-muted text-muted-foreground text-center text-sm">
        <p>&copy; {new Date().getFullYear()} — Pregação da Palavra. Todos os direitos reservados.</p>
      </footer>

      {/* Floating WhatsApp */}
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
