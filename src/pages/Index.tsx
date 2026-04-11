import { Book, Heart, Users, ArrowRight, Cross } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBible from "@/assets/hero-bible.jpg";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <img
          src={heroBible}
          alt="Bíblia aberta com raios de luz"
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-hero/80" />
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto animate-fade-up">
          <Cross className="w-10 h-10 text-accent mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold text-hero-foreground leading-tight mb-6">
            A Palavra que transforma vidas
          </h1>
          <p className="text-lg md:text-xl text-hero-muted mb-8 max-w-xl mx-auto">
            Venha conhecer o poder da pregação bíblica. Uma jornada de fé, esperança e amor através das Escrituras Sagradas.
          </p>
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 py-6 rounded-full">
            Comece sua jornada <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Versículo */}
      <section className="py-20 px-6 bg-secondary text-secondary-foreground">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-heading font-light italic leading-relaxed">
            "Porque a palavra de Deus é viva, e eficaz, e mais penetrante do que qualquer espada de dois gumes."
          </p>
          <span className="block mt-6 text-accent text-sm font-medium tracking-widest uppercase">
            Hebreus 4:12
          </span>
        </div>
      </section>

      {/* Pilares */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Pilares da nossa fé
          </h2>
          <div className="grid md:grid-cols-3 gap-10">
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
                className="text-center p-8 rounded-2xl bg-card border border-border hover:shadow-lg transition-shadow"
              >
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
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
      <section className="py-20 px-6 bg-hero text-hero-foreground">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Venha fazer parte
          </h2>
          <p className="text-hero-muted text-lg mb-8">
            Junte-se a nós e experimente a transformação que só a Palavra de Deus pode proporcionar.
          </p>
          <Button
            size="lg"
            className="bg-accent text-foreground hover:bg-accent/90 text-base px-8 py-6 rounded-full font-semibold"
          >
            Participar agora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-muted text-muted-foreground text-center text-sm">
        <p>&copy; {new Date().getFullYear()} — Pregação da Palavra. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default Index;
