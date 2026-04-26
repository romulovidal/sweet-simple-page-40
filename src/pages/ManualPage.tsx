import { 
  BookOpen, Sparkles, Image as ImageIcon, Heart, Bell, Settings, 
  Share2, Search, Smartphone, ShieldCheck, ChevronRight, Bookmark, 
  LayoutDashboard, Users, Flame, BookMarked, MessageSquare, 
  Monitor, Download, Shield, Clock, Languages, AlignCenter, 
  BrainCircuit, Compass
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { motion } from "framer-motion";

const ManualPage = () => {
  const navigate = useNavigate();

  const manualSections = [
    {
      title: "Página Inicial (Hoje)",
      icon: LayoutDashboard,
      color: "text-blue-400",
      image: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=800&q=80",
      items: [
        { label: "Versículo do Dia", description: "Um versículo selecionado diariamente para sua meditação.", icon: BookMarked },
        { label: "Reflexão IA", description: "Um devocional gerado por Inteligência Espiritual baseado no versículo do dia.", icon: Sparkles },
        { label: "Ofensiva (Streak)", description: "Acompanhe quantos dias seguidos você está meditando na Palavra.", icon: Flame },
        { label: "Progresso de Leitura", description: "Retome sua última leitura bíblica com apenas um toque.", icon: Clock },
      ]
    },
    {
      title: "Leitura Bíblica",
      icon: BookOpen,
      color: "text-emerald-400",
      image: "https://images.unsplash.com/photo-1507434965515-61970f2bd7c6?auto=format&fit=crop&w=800&q=80",
      items: [
        { label: "Seleção de Versão", description: "Escolha entre ARA, ARC, NVI, NTLH e outras versões consagradas.", icon: Languages },
        { label: "Letras Vermelhas", description: "Destaque automático das falas de Jesus para facilitar o estudo.", icon: AlignCenter },
        { label: "Ações no Versículo", description: "Toque em um versículo para: Destacar, Salvar, Comparar Versões ou Criar Imagem.", icon: Bookmark },
        { label: "Modo Apresentação", description: "Ideal para projetar versículos em cultos ou reuniões.", icon: Monitor },
      ]
    },
    {
      title: "Inteligência Espiritual (ExegettAI)",
      icon: Sparkles,
      color: "text-amber-400",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80",
      items: [
        { label: "Exegese Bíblica", description: "Análise profunda do contexto original e aplicação prática.", icon: BrainCircuit },
        { label: "Resumo de Capítulo", description: "A IA sintetiza os pontos principais de qualquer capítulo bíblico.", icon: LayoutDashboard },
        { label: "Conexões Bíblicas", description: "Descubra como um texto se conecta com outras partes das Escrituras.", icon: Compass },
        { label: "Linha do Tempo", description: "Veja onde os eventos do texto se encaixam na história bíblica.", icon: Clock },
      ]
    },
    {
      title: "Gerador de Imagens",
      icon: ImageIcon,
      color: "text-pink-400",
      image: "https://images.unsplash.com/photo-1499209974431-9dac3adaf471?auto=format&fit=crop&w=800&q=80",
      items: [
        { label: "Fundos Personalizados", description: "Escolha entre dezenas de imagens temáticas ou gradientes modernos.", icon: ImageIcon },
        { label: "Ajuste de Estilo", description: "Mude a fonte, o tamanho e a cor do texto para combinar com sua arte.", icon: Settings },
        { label: "Marca d'Água", description: "Imagens geradas com a assinatura oficial 'A Bíblia do Atalaia'.", icon: ShieldCheck },
        { label: "Compartilhamento", description: "Envie sua criação diretamente para o WhatsApp, Instagram ou Facebook.", icon: Share2 },
      ]
    },
    {
      title: "Comunidade",
      icon: Users,
      color: "text-purple-400",
      image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80",
      items: [
        { label: "Mural de Orações", description: "Compartilhe seus pedidos ou interceda pelos irmãos clicando em 'Orei'.", icon: Heart },
        { label: "Escala de Cultos", description: "Fique por dentro dos dias e horários de todas as reuniões da igreja.", icon: Clock },
        { label: "Avisos e Destaques", description: "Receba comunicações importantes diretamente da liderança no seu feed.", icon: Bell },
      ]
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="pb-24 min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))]">
      {/* Hero Header */}
      <div className="relative h-64 overflow-hidden flex items-end">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1200&q=80" 
            className="w-full h-full object-cover opacity-30 scale-110"
            alt="Bíblia Manual"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--dark-bg))] via-[hsl(var(--dark-bg))/0.8] to-transparent" />
        </div>
        
        <div className="px-5 pb-8 relative z-10 w-full max-w-4xl mx-auto">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md mb-6 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-black tracking-tight">Manual Completo</h1>
          <p className="text-primary font-bold text-sm uppercase tracking-widest mt-1">Guia de Funcionalidades</p>
        </div>
      </div>

      <div className="px-5 max-w-4xl mx-auto -mt-6 relative z-20">
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-8"
        >
          {manualSections.map((section, sIdx) => (
            <motion.section 
              key={section.title} 
              variants={item}
              className="space-y-4"
            >
              <div className="bg-[hsl(var(--dark-card))] border border-white/5 rounded-[2rem] overflow-hidden shadow-xl">
                <div className="relative h-40">
                  <img src={section.image} className="w-full h-full object-cover opacity-50" alt={section.title} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--dark-card))] to-transparent" />
                  <div className="absolute bottom-4 left-6 flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 ${section.color}`}>
                      <section.icon className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">{section.title}</h2>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((sub, iIdx) => (
                  <div 
                    key={sub.label} 
                    className="bg-[hsl(var(--dark-card))] border border-white/5 rounded-2xl p-5 hover:bg-[hsl(var(--dark-card-hover))] transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <sub.icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-sm">{sub.label}</h3>
                        <p className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed">
                          {sub.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </motion.section>
          ))}

          {/* Call to action */}
          <motion.div 
            variants={item}
            className="pt-10 pb-6 text-center space-y-6"
          >
            <div className="bg-primary/10 border border-primary/20 rounded-3xl p-8 space-y-4">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                <ShieldCheck className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold">Pronto para começar?</h3>
              <p className="text-sm text-[hsl(var(--dark-muted))] max-w-xs mx-auto">
                A Bíblia do Atalaia foi desenvolvida para ser sua ferramenta definitiva de estudo e comunhão.
              </p>
              <Button 
                onClick={() => navigate("/")}
                className="rounded-full px-10 py-6 h-auto text-base font-bold shadow-xl hover:scale-105 transition-transform"
              >
                Abrir Aplicativo
              </Button>
            </div>

            <p className="text-[10px] font-bold text-[hsl(var(--dark-muted))] uppercase tracking-[0.2em]">
              Versão 1.5.0 • Para a glória de Deus
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default ManualPage;