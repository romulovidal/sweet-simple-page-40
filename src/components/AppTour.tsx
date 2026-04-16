import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAppTour } from "@/hooks/useAppTour";

const STEPS = [
  {
    title: "📖 Bem-vindo à Bíblia do Atalaia",
    description:
      "Vamos te mostrar tudo que o app pode fazer em menos de 1 minuto. Você pode pular a qualquer momento.",
  },
  {
    selector: '[data-tour="nav-home"]',
    title: "🏠 Início",
    description:
      "Versículo do dia, devocionais, atalhos para continuar sua leitura e acessar suas funcionalidades favoritas.",
  },
  {
    selector: '[data-tour="nav-bible"]',
    title: "📖 Bíblia",
    description:
      "Leia em 6 traduções, com áudio, modo offline, compartilhamento, comparação de versões e ferramentas de estudo.",
  },
  {
    selector: '[data-tour="nav-plans"]',
    title: "📅 Planos de Leitura",
    description:
      "Planos temáticos para te guiar através das Escrituras com progresso salvo automaticamente.",
  },
  {
    selector: '[data-tour="nav-discover"]',
    title: "🧭 Descubra",
    description:
      "Conteúdos da igreja, devocionais especiais, horários de cultos e buscas por temas bíblicos.",
  },
  {
    selector: '[data-tour="nav-profile"]',
    title: "👤 Você",
    description:
      "Seu perfil, versículos salvos, histórico, streak, metas de leitura e configurações.",
  },
  {
    title: "✨ Recursos de IA",
    description:
      "Dentro da Bíblia você encontra: ExegettAI, Resumo do Capítulo, Devocional, Conexões Bíblicas, Significado Original, Linha do Tempo e Pergunte à Bíblia.",
  },
  {
    title: "🔥 Progresso espiritual",
    description:
      "Acompanhe sua sequência diária, metas anuais, anotações pessoais e versículos favoritos.",
  },
  {
    title: "🙏 Comunidade & notificações",
    description:
      "Pedidos de oração, versículo do dia, lembretes e opção para instalar o app na tela inicial.",
  },
  {
    title: "🎉 Tudo pronto!",
    description:
      "Você pode refazer este tour quando quiser em Você → Configurações → Refazer tour do app.",
  },
];

const AppTour = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldStart, finishTour } = useAppTour();
  const driverRef = useRef<Driver | null>(null);
  const timerRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const finishingRef = useRef(false);

  const cleanupTour = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (driverRef.current) {
      finishingRef.current = true;
      driverRef.current.destroy();
      driverRef.current = null;
    }

    hasStartedRef.current = false;
  }, []);

  const completeTour = useCallback(
    (dontShowAgain = true) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      finishTour(dontShowAgain);
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
      hasStartedRef.current = false;
    },
    [finishTour]
  );

  const startTour = useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    finishingRef.current = false;

    if (location.pathname !== "/") {
      navigate("/", { replace: false, state: { reset: Date.now() } });
    }

    timerRef.current = window.setTimeout(() => {
      const instance = driver({
        showProgress: true,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Próximo →",
        prevBtnText: "← Voltar",
        doneBtnText: "Concluir ✓",
        allowClose: true,
        overlayOpacity: 0.7,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: "atalaias-tour-popover",
        steps: STEPS.map((step) => ({
          ...(step.selector ? { element: step.selector } : {}),
          popover: {
            title: step.title,
            description: step.description,
            ...(step.selector ? { side: "top" as const } : {}),
            align: "center" as const,
          },
        })),
        onDestroyed: () => {
          driverRef.current = null;
          if (finishingRef.current) return;
          const isLastStep = instance.getActiveIndex() >= STEPS.length - 1;
          if (isLastStep) {
            finishTour(true);
          }
          hasStartedRef.current = false;
        },
        onCloseClick: () => {
          const confirmed = window.confirm(
            "Tem certeza que deseja sair do tour? Você pode refazê-lo depois em Você → Configurações."
          );
          if (confirmed) {
            completeTour(true);
          }
        },
      });

      driverRef.current = instance;
      instance.drive();
    }, location.pathname === "/" ? 150 : 450);
  }, [completeTour, finishTour, location.pathname, navigate]);

  useEffect(() => {
    if (shouldStart) {
      startTour();
    }
  }, [shouldStart, startTour]);

  useEffect(() => {
    const handler = () => {
      cleanupTour();
      finishTour(false);
      window.setTimeout(() => {
        startTour();
      }, 50);
    };

    window.addEventListener("app-tour:restart", handler);
    return () => window.removeEventListener("app-tour:restart", handler);
  }, [cleanupTour, finishTour, startTour]);

  useEffect(() => {
    return () => {
      cleanupTour();
    };
  }, [cleanupTour]);

  return null;
};

export default AppTour;
