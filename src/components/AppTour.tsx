import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAppTour } from "@/hooks/useAppTour";

const STEPS = [
  {
    title: "📖 Bem-vindo à Bíblia do Atalaia",
    description:
      "Vamos te mostrar tudo que o app pode fazer em menos de 1 minuto. Você pode pular a qualquer momento.",
    route: "/",
  },
  {
    selector: '[data-tour="nav-home"]',
    title: "🏠 Início",
    description:
      "Versículo do dia, devocionais, atalhos para continuar sua leitura e acessar suas funcionalidades favoritas.",
    route: "/",
  },
  {
    selector: '[data-tour="nav-bible"]',
    title: "📖 Bíblia",
    description:
      "Leia em 6 traduções (ACF, ARA, ARC, KJA, NTLH, NVI), com áudio, modo offline e tudo que você precisa para um estudo profundo.",
    route: "/",
  },
  {
    selector: '[data-tour="nav-plans"]',
    title: "📅 Planos de Leitura",
    description:
      "Planos temáticos para te guiar através das Escrituras: Salmos, Vida de Jesus, Provérbios diários e muito mais.",
    route: "/",
  },
  {
    selector: '[data-tour="nav-discover"]',
    title: "🧭 Descubra",
    description:
      "Conteúdos da igreja, devocionais especiais, horários de cultos e busca inteligente de versículos por tema.",
    route: "/",
  },
  {
    selector: '[data-tour="nav-profile"]',
    title: "👤 Você",
    description:
      "Seu perfil, versículos salvos, histórico de leitura, sequência (streak), metas e configurações.",
    route: "/",
  },
  {
    title: "✨ Recursos de IA",
    description:
      "Dentro de cada capítulo da Bíblia você encontra ferramentas de IA poderosas:\n\n🧠 **ExegettAI** — exegese acadêmica completa\n📖 **Resumo do Capítulo** — entenda o contexto rápido\n❤️ **Devocional** — reflexão para o dia\n🔗 **Conexões Bíblicas** — referências cruzadas\n🌐 **Significado Original** — palavras em hebraico/grego\n⏳ **Linha do Tempo** — contexto histórico\n💬 **Pergunte à Bíblia** — chat livre com a IA",
    route: "/",
  },
  {
    title: "🔥 Sequência & Metas",
    description:
      "Mantenha uma sequência diária de leitura (streak), defina metas anuais de capítulos e acompanhe seu progresso para criar o hábito.",
    route: "/",
  },
  {
    title: "📝 Anotações & Salvos",
    description:
      "Anote insights em qualquer capítulo, salve versículos favoritos e acesse tudo a qualquer momento — também funciona offline.",
    route: "/",
  },
  {
    title: "🙏 Pedidos de Oração",
    description:
      "Compartilhe pedidos de oração com a comunidade e ore pelos pedidos de outros irmãos. Fortaleça sua vida em comunhão.",
    route: "/",
  },
  {
    title: "🔔 Notificações & Instalação",
    description:
      "Ative o versículo do dia às 8h, lembretes de cultos e instale o app na tela inicial do seu celular para acesso rápido.",
    route: "/",
  },
  {
    title: "🎉 Tudo pronto!",
    description:
      "Que a Palavra alimente seu dia. Você pode refazer este tour a qualquer momento em **Você → Configurações → Refazer tour**.",
    route: "/",
  },
];

const AppTour = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldStart, finishTour } = useAppTour();
  const [driverInstance, setDriverInstance] = useState<Driver | null>(null);
  const [externalTrigger, setExternalTrigger] = useState(0);

  useEffect(() => {
    const handler = () => setExternalTrigger((n) => n + 1);
    window.addEventListener("app-tour:restart", handler);
    return () => window.removeEventListener("app-tour:restart", handler);
  }, []);

  const startTour = useCallback(() => {
    // Ensure we are at root so nav targets exist
    if (location.pathname !== "/") {
      navigate("/");
    }

    setTimeout(() => {
      const d = driver({
        showProgress: true,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Próximo →",
        prevBtnText: "← Voltar",
        doneBtnText: "Concluir",
        allowClose: true,
        overlayOpacity: 0.78,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: "atalaias-tour-popover",
        steps: STEPS.map((step) => ({
          element: step.selector,
          popover: {
            title: step.title,
            description: step.description.replace(/\n/g, "<br>"),
            side: step.selector ? "top" : undefined,
            align: "center",
          },
        })),
        onDestroyStarted: () => {
          const isLastStep = !d.hasNextStep();
          if (isLastStep) {
            finishTour(true);
          } else {
            const confirmed = window.confirm(
              "Tem certeza que deseja sair do tour? Você pode refazê-lo depois em Você → Configurações."
            );
            if (confirmed) {
              finishTour(true);
              d.destroy();
            }
            return;
          }
          d.destroy();
        },
      });

      d.drive();
      setDriverInstance(d);
    }, 250);
  }, [location.pathname, navigate, finishTour]);

  useEffect(() => {
    if (shouldStart) startTour();
  }, [shouldStart, startTour]);

  useEffect(() => {
    if (externalTrigger > 0) startTour();
  }, [externalTrigger, startTour]);

  useEffect(() => {
    return () => {
      driverInstance?.destroy();
    };
  }, [driverInstance]);

  return null;
};

export default AppTour;
