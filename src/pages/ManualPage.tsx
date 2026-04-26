import { BookOpen, Sparkles, Image as ImageIcon, Heart, Bell, Settings, Share2, Search, Smartphone, ShieldCheck, ChevronRight, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const ManualPage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: "leitura",
      title: "Leitura e Estudo",
      icon: BookOpen,
      color: "text-blue-400",
      content: "A Bíblia do Atalaia oferece uma experiência de leitura fluida. Você pode escolher entre diversas versões (ARC, NVI, etc.), ajustar o tamanho da fonte para seu conforto e navegar facilmente por livros e capítulos.",
      features: [
        "Troca de versões bíblicas em tempo real",
        "Controle de tamanho de fonte",
        "Marcação de versículos com cores",
        "Destaque de falas de Jesus (Letras Vermelhas)"
      ]
    },
    {
      id: "exegetai",
      title: "ExegettAI (IA Bíblica)",
      icon: Sparkles,
      color: "text-amber-400",
      content: "Nossa Inteligência Artificial exclusiva ajuda você a aprofundar seu estudo. O ExegettAI analisa o contexto histórico, cultural e linguístico de qualquer trecho da Bíblia.",
      features: [
        "Exegese detalhada de versículos",
        "Resumos inteligentes de capítulos",
        "Conexões entre o Antigo e Novo Testamento",
        "Significado de palavras difíceis"
      ]
    },
    {
      id: "imagens",
      title: "Gerador de Imagens",
      icon: ImageIcon,
      color: "text-pink-400",
      content: "Transforme qualquer versículo em uma imagem inspiradora para compartilhar. Personalize o fundo com fotos do Unsplash ou gradientes modernos.",
      features: [
        "Dezenas de fundos temáticos",
        "Personalização de fontes e cores",
        "Marca d'água oficial 'A Bíblia do Atalaia'",
        "Compartilhamento direto para redes sociais"
      ]
    },
    {
      id: "comunidade",
      title: "Comunidade e Interação",
      icon: Heart,
      color: "text-red-400",
      content: "Fique por dentro de tudo o que acontece na nossa comunidade. Acesse o mural de orações e a escala de cultos diretamente na aba Comunidade.",
      features: [
        "Pedidos de oração públicos ou privados",
        "Reação 'Orei' em pedidos de irmãos",
        "Escala de cultos sempre atualizada",
        "Avisos e destaques da liderança"
      ]
    },
    {
      id: "offline",
      title: "Uso Offline e PWA",
      icon: Smartphone,
      color: "text-green-400",
      content: "O app foi construído para funcionar mesmo sem internet. Você pode instalar a Bíblia do Atalaia no seu celular como um aplicativo real (PWA).",
      features: [
        "Leitura da Bíblia sem internet",
        "Sincronização automática quando online",
        "Instalação na tela de início",
        "Economia de dados móveis"
      ]
    }
  ];

  return (
    <div className="pb-20 min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))]">
      {/* Header */}
      <header className="px-5 pt-12 pb-6 border-b border-white/5 sticky top-0 bg-[hsl(var(--dark-bg))]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Manual do Usuário</h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">A Bíblia do Atalaia</p>
          </div>
        </div>
      </header>

      <div className="px-5 py-8 max-w-2xl mx-auto space-y-12">
        {/* Intro */}
        <section className="text-center space-y-4">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Bem-vindo ao Atalaia</h2>
          <p className="text-sm text-[hsl(var(--dark-muted))] leading-relaxed">
            Este manual foi criado para ajudar você a explorar todas as ferramentas de estudo e comunhão disponíveis em nossa plataforma.
          </p>
        </section>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div 
              key={section.id} 
              className="bg-[hsl(var(--dark-card))] rounded-3xl p-6 border border-white/5 space-y-4 transition-all hover:border-primary/20"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-current/10 ${section.color}`}>
                  <section.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">{section.title}</h3>
              </div>
              
              <p className="text-sm text-[hsl(var(--dark-muted))] leading-relaxed">
                {section.content}
              </p>

              <div className="grid grid-cols-1 gap-2 pt-2">
                {section.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--dark-text))]/80">
                    <ChevronRight className="w-3 h-3 text-primary" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Tips */}
        <section className="bg-primary/5 rounded-3xl p-6 border border-primary/10">
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Dicas Rápidas
          </h3>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center text-xs font-bold text-primary">1</div>
              <p className="text-xs leading-relaxed text-[hsl(var(--dark-muted))]">
                <span className="font-bold text-[hsl(var(--dark-text))]">Notificações:</span> Ative o push para receber o versículo do dia automaticamente todas as manhãs.
              </p>
            </li>
            <li className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center text-xs font-bold text-primary">2</div>
              <p className="text-xs leading-relaxed text-[hsl(var(--dark-muted))]">
                <span className="font-bold text-[hsl(var(--dark-text))]">Busca Inteligente:</span> Use a aba "Descubra" para pesquisar por temas como "ansiedade", "cura" ou "amor".
              </p>
            </li>
            <li className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center text-xs font-bold text-primary">3</div>
              <p className="text-xs leading-relaxed text-[hsl(var(--dark-muted))]">
                <span className="font-bold text-[hsl(var(--dark-text))]">Destaques:</span> Clique em um versículo na leitura para abrir o menu de ações e destacá-lo com cores.
              </p>
            </li>
          </ul>
        </section>

        {/* CTA */}
        <div className="pt-8 pb-4 text-center">
          <Button 
            onClick={() => navigate("/")}
            className="rounded-full px-8 py-6 h-auto text-base font-bold shadow-xl shadow-primary/20"
          >
            Começar a Ler Agora
          </Button>
          <p className="mt-4 text-[10px] text-[hsl(var(--dark-muted))] font-medium">
            Versão 1.2.0 • Desenvolvido para a glória de Deus
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManualPage;