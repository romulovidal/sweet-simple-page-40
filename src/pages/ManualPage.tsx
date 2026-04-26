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
        { label: "Reflexão Inteligente", description: "Um devocional gerado por Inteligência Espiritual baseado no versículo do dia.", icon: Sparkles },
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
        { label: "Resumo de Capítulo", description: "A Inteligência Espiritual sintetiza os pontos principais de qualquer capítulo bíblico.", icon: LayoutDashboard },
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
    <div className="min-h-screen bg-[#0a0612] text-white overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      {/* Hero Header */}
      <div className="relative h-[450px] flex items-center justify-center text-center px-5">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1600&q=80" 
            className="w-full h-full object-cover opacity-20"
            alt="Bíblia Manual"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0612]/80 to-[#0a0612]" />
        </div>
        
        <div className="relative z-10 max-w-3xl space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(251,191,36,0.1)]"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold tracking-[0.2em] uppercase text-amber-200/90">
              Guia Oficial do Usuário
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1]"
          >
            Manual <br />
            <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-amber-400 bg-clip-text text-transparent">
              Completo
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-white/60 max-w-xl mx-auto leading-relaxed"
          >
            Aprenda a utilizar todas as ferramentas de inteligência espiritual e comunhão da Bíblia do Atalaia.
          </motion.p>
        </div>
      </div>

      <div className="px-5 max-w-5xl mx-auto relative z-20 pb-20">
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
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all hover:border-amber-400/20">
                <div className="relative h-48">
                  <img src={section.image} className="w-full h-full object-cover opacity-50" alt={section.title} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0612] via-[#0a0612]/40 to-transparent" />
                  <div className="absolute bottom-6 left-8 flex items-center gap-4">
                    <div className={`p-2.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 ${section.color}`}>
                      <section.icon className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">{section.title}</h2>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((sub, iIdx) => (
                  <div 
                    key={sub.label} 
                    className="bg-white/5 border border-white/5 rounded-3xl p-6 hover:bg-white/[0.08] hover:border-white/10 transition-all group"
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
            <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[3rem] p-12 space-y-6 relative overflow-hidden shadow-2xl">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 blur-[100px] rounded-full" />
              
              <div className="w-20 h-20 bg-gradient-to-r from-amber-400 to-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/20 rotate-3">
                <ShieldCheck className="w-10 h-10 text-amber-950" />
              </div>
              <h3 className="text-xl font-bold">Pronto para começar?</h3>
              <p className="text-sm text-[hsl(var(--dark-muted))] max-w-xs mx-auto">
                A Bíblia do Atalaia foi desenvolvida para ser sua ferramenta definitiva de estudo e comunhão.
              </p>
              <div className="pt-4">
                <Button 
                  onClick={() => navigate("/")}
                  className="rounded-full px-12 py-8 h-auto text-lg font-bold bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-amber-950 shadow-[0_0_60px_rgba(251,191,36,0.3)] hover:scale-105 transition-all"
                >
                  Acessar o Aplicativo agora
                </Button>
              </div>
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