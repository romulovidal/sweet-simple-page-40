import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAppTour } from "@/hooks/useAppTour";

type Step = {
  selector?: string;
  title: string;
  description: string;
  side?: "top" | "bottom" | "left" | "right" | "over";
  /** Roda antes do passo abrir. Pode navegar, mexer no localStorage, simular clique etc. */
  before?: () => void | Promise<void>;
  /** Quanto esperar (ms) após o `before` antes de medir o elemento. */
  waitMs?: number;
  /** Mostra o checkbox "Não mostrar novamente". */
  showDontShow?: boolean;
};

const DONT_SHOW_KEY = "tour_dont_show_again";

// Helpers para o passo de demonstração da Bíblia
const goToBibleJohn316 = () => {
  try {
    // Garante NVI selecionada
    localStorage.setItem("bible_version", "nvi");
  } catch {}
  // Navega para João 3:16 via URL params (BiblePage já lê book/chapter/verse)
  const url = "/biblia?book=jo&chapter=3&verse=16";
  if (window.location.pathname + window.location.search !== url) {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
};

const simulateSelectVerse16 = () => {
  // Clica programaticamente no versículo 16 para abrir a action bar
  const el = document.getElementById("verse-16");
  if (el && !el.classList.contains("ring-primary/40")) {
    (el as HTMLElement).click();
  }
};

const deselectVerse16 = () => {
  const el = document.getElementById("verse-16");
  if (el && el.className.includes("ring-")) {
    (el as HTMLElement).click();
  }
};

const STEPS: Step[] = [
  {
    title: "📖 Bem-vindo à Bíblia do Atalaia",
    description:
      "Em ~2 minutos vamos te mostrar TUDO: as 5 abas, leitura com áudio, IA, planos, comunidade e configurações. Você pode pular a qualquer momento.",
    showDontShow: true,
    before: () => {
      if (window.location.pathname !== "/") {
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    },
    waitMs: 200,
  },

  // ===== HOME =====
  {
    selector: '[data-tour="home-streak"]',
    title: "🔥 Sua sequência",
    description:
      "Aqui aparece sua ofensiva de leitura — quantos dias seguidos você tem lido a Bíblia. Quanto mais dias, mais alto sobe!",
  },
  {
    selector: '[data-tour="home-search"]',
    title: "🔎 Busca rápida",
    description:
      "Atalho para a página de Descubra: pesquise versículos, temas ou referências como “João 3:16”.",
  },
  {
    selector: '[data-tour="home-verse-of-day"]',
    title: "✨ Versículo do dia",
    description:
      "Todo dia um versículo novo, com botão para gerar Devocional com IA, salvar, compartilhar e criar uma imagem bonita.",
  },
  {
    selector: '[data-tour="home-continue"]',
    title: "📖 Continuar lendo",
    description:
      "Atalho que te leva exatamente onde parou na Bíblia, sem precisar procurar livro e capítulo.",
  },

  // ===== NAV =====
  {
    selector: '[data-tour="nav-home"]',
    title: "🏠 Aba Início",
    description:
      "Sua tela inicial: versículo do dia, devocionais, posts da igreja e atalhos para continuar a leitura.",
  },
  {
    selector: '[data-tour="nav-bible"]',
    title: "📖 Aba Bíblia",
    description:
      "Vamos abrir agora! Leia em 6 traduções (ARA, ARC, ACF, NVI, NTLH, KJA), com áudio, modo offline e ferramentas de estudo com IA.",
  },

  // ===== BIBLE: João 3:16 demo =====
  {
    selector: '[data-tour="bible-version"]',
    title: "🌐 Trocar versão",
    description:
      "Estamos abrindo João 3:16 na NVI. Toque aqui para alternar entre ARA, ARC, ACF, NVI, NTLH e KJA — pode comparar lado a lado também.",
    before: goToBibleJohn316,
    waitMs: 700,
  },
  {
    selector: '[data-tour="bible-fontsize"]',
    title: "🔠 Tamanho da fonte",
    description:
      "Ajuste o tamanho do texto para uma leitura confortável — fica salvo entre sessões.",
  },
  {
    selector: '[data-tour="bible-presentation"]',
    title: "🖥️ Modo apresentação",
    description:
      "Perfeito para projetar versículos no culto: tela cheia, fonte gigante, controle por toque ou teclado.",
  },
  {
    selector: "#verse-16",
    title: "👆 Toque em qualquer versículo",
    description:
      "Estamos no versículo mais conhecido da Bíblia. Vamos selecioná-lo agora para ver tudo que você pode fazer com ele.",
    side: "top",
  },
  {
    selector: '[data-tour="bible-action-bar"]',
    title: "🎨 Barra de ações do versículo",
    description:
      "Selecionei João 3:16 para você. Aparecem: cor de destaque, compartilhar, salvar, gerar imagem, comparar versões e botões de IA.",
    before: simulateSelectVerse16,
    waitMs: 400,
  },
  {
    selector: '[data-tour="bible-action-color"]',
    title: "🎨 Marca-texto colorido",
    description:
      "Destaque o versículo em 5 cores (amarelo, verde, azul, rosa, roxo). Os destaques são salvos automaticamente.",
  },
  {
    selector: '[data-tour="bible-action-share"]',
    title: "🔗 Compartilhar",
    description:
      "Envie o versículo para WhatsApp, Telegram, X, e-mail ou copie o link direto.",
  },
  {
    selector: '[data-tour="bible-action-save"]',
    title: "🔖 Salvar",
    description:
      "Guarde o versículo em “Você → Versículos salvos” para reler quando quiser, mesmo offline.",
  },
  {
    selector: '[data-tour="bible-action-image"]',
    title: "🖼️ Gerar imagem",
    description:
      "Cria uma imagem bonita do versículo, pronta para postar nas redes ou colocar como wallpaper.",
  },
  {
    selector: '[data-tour="bible-action-compare"]',
    title: "🔁 Comparar versões",
    description:
      "Veja o mesmo versículo em todas as 6 traduções lado a lado para estudar diferenças.",
  },
  {
    selector: '[data-tour="bible-action-connections"]',
    title: "🔗 Conexões Bíblicas (IA)",
    description:
      "Este botão verde mostra outras passagens da Bíblia conectadas ao versículo selecionado — referências cruzadas, paralelos no AT/NT e textos que se complementam, gerados por IA.",
  },
  {
    selector: '[data-tour="bible-action-wordmeaning"]',
    title: "🔤 Significado Original (IA)",
    description:
      "Este botão azul-ciano traz o sentido das palavras-chave em hebraico (AT) ou grego (NT): transliteração, significado original e nuances que se perdem na tradução.",
  },
  {
    selector: '[data-tour="bible-action-timeline"]',
    title: "⏳ Linha do Tempo (IA)",
    description:
      "Este botão laranja monta uma linha do tempo histórica do trecho: contexto, datas aproximadas, personagens e o que aconteceu antes/depois — perfeito para entender o pano de fundo.",
  },
  {
    selector: '[data-tour="bible-chapter-summary"]',
    title: "✨ Resumo do Capítulo (IA)",
    description:
      "Este botão azul no topo do capítulo gera um resumo completo com IA: contexto, temas principais e aplicação prática.",
    before: deselectVerse16,
    waitMs: 300,
    side: "bottom",
  },
  {
    selector: '[data-tour="exegetai-fab"]',
    title: "🔮 ExegetAI (botão flutuante)",
    description:
      "Este botão dourado flutuante no canto inferior direito abre o **ExegetAI**: exegese profunda do trecho aberto — análise teológica, contexto histórico e linguístico gerados por IA.",
    side: "left",
  },
  {
    selector: '[data-tour="ask-bible"]',
    title: "🙋 Pergunte à Bíblia",
    description:
      "Aqui na aba **Descubra** fica o **Pergunte à Bíblia**: chat com IA para tirar dúvidas teológicas com base nas Escrituras.",
    before: () => {
      window.history.pushState({}, "", "/descubra");
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    waitMs: 500,
    side: "bottom",
  },

  // ===== PLANS =====
  {
    selector: '[data-tour="nav-plans"]',
    title: "📅 Aba Planos",
    description:
      "Planos temáticos te guiam pelas Escrituras (Provérbios em 31 dias, Bíblia em 1 ano, etc.). Progresso salvo automaticamente.",
    before: () => {
      window.history.pushState({}, "", "/planos");
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    waitMs: 400,
  },

  // ===== DISCOVER =====
  {
    selector: '[data-tour="nav-discover"]',
    title: "🧭 Aba Descubra",
    description:
      "Vamos abrir agora! Busque por temas, devocionais especiais, posts da igreja e horários de cultos.",
    before: () => {
      window.history.pushState({}, "", "/descubra");
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    waitMs: 400,
  },
  {
    selector: '[data-tour="discover-search"]',
    title: "🔎 Busca inteligente",
    description:
      "Digite uma palavra (“paz”, “fé”), um tema ou uma referência (“Salmo 23”) e ela acha em segundos em qualquer versão.",
  },
  {
    selector: '[data-tour="discover-prompts"]',
    title: "💡 Sugestões rápidas",
    description:
      "Atalhos com temas populares: Ansiedade, Esperança, Amor, Perdão... Toque para ver versículos sobre cada tema.",
  },

  // ===== PROFILE =====
  {
    selector: '[data-tour="nav-profile"]',
    title: "👤 Aba Você",
    description:
      "Vamos abrir agora! Aqui ficam suas estatísticas, salvos, histórico, metas e configurações.",
    before: () => {
      window.history.pushState({}, "", "/perfil");
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    waitMs: 400,
  },
  {
    selector: '[data-tour="profile-stats"]',
    title: "📊 Suas estatísticas",
    description:
      "Sequência, última leitura, versículos salvos e planos em andamento — tudo num lugar.",
  },
  {
    selector: '[data-tour="profile-goals"]',
    title: "🎯 Metas de leitura",
    description:
      "Defina quantos capítulos quer ler no ano e acompanhe o progresso visualmente.",
  },
  {
    selector: '[data-tour="profile-menu"]',
    title: "⚙️ Tudo seu num menu",
    description:
      "Versículos salvos, versículos do dia já vistos, histórico de leitura e Configurações (notificações push, refazer este tour, sair, LGPD).",
  },

  // ===== END =====
  {
    title: "🙏 Comunidade & notificações",
    description:
      "Pedidos de oração públicos, versículo do dia por push, lembretes de culto e opção de instalar o app na tela inicial.",
    before: () => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    waitMs: 300,
  },
  {
    title: "🎉 Tudo pronto!",
    description:
      "Você viu tudo que o app oferece. Pode refazer este tour quando quiser em **Você → Configurações → Refazer tour do app**. Boa leitura! 📖",
    showDontShow: true,
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
  const dontShowRef = useRef(true);

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

  /** Injeta o checkbox "Não mostrar novamente" no popover atual. */
  const injectDontShowCheckbox = useCallback(() => {
    const tryInject = (attempt = 0) => {
      // Procura primeiro o container principal do popover (sempre existe)
      const popover =
        document.querySelector(".driver-popover-description") ||
        document.querySelector(".driver-popover");
      if (!popover) {
        if (attempt < 10) window.setTimeout(() => tryInject(attempt + 1), 60);
        return;
      }
      if (popover.querySelector(".tour-dont-show-wrapper")) return;

      // Persiste o valor padrão imediatamente (caso o usuário só clique em "Próximo")
      try {
        localStorage.setItem(DONT_SHOW_KEY, dontShowRef.current ? "1" : "0");
      } catch {}

      const wrapper = document.createElement("label");
      wrapper.className = "tour-dont-show-wrapper";
      wrapper.style.cssText =
        "display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid hsl(var(--border));font-size:13px;color:hsl(var(--muted-foreground));cursor:pointer;user-select:none;";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = dontShowRef.current;
      input.style.cssText = "width:16px;height:16px;accent-color:hsl(var(--primary));cursor:pointer;flex-shrink:0;";
      input.addEventListener("change", (e) => {
        e.stopPropagation();
        dontShowRef.current = input.checked;
        try {
          localStorage.setItem(DONT_SHOW_KEY, input.checked ? "1" : "0");
        } catch {}
      });
      // Evita que clique no label feche o popover
      wrapper.addEventListener("click", (e) => e.stopPropagation());
      const text = document.createElement("span");
      text.textContent = "Não mostrar novamente";
      wrapper.appendChild(input);
      wrapper.appendChild(text);
      popover.appendChild(wrapper);
    };
    window.setTimeout(() => tryInject(), 80);
  }, []);

  const completeTour = useCallback(
    (dontShowAgain: boolean) => {
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
    // Lê preferência salva (default true se nunca foi setado)
    try {
      const saved = localStorage.getItem(DONT_SHOW_KEY);
      dontShowRef.current = saved === null ? true : saved === "1";
    } catch {
      dontShowRef.current = true;
    }

    if (location.pathname !== "/") {
      navigate("/", { replace: false, state: { reset: Date.now() } });
    }

    timerRef.current = window.setTimeout(() => {
      const driverSteps = STEPS.map((step, idx) => ({
        ...(step.selector ? { element: step.selector } : {}),
        popover: {
          title: step.title,
          description: step.description,
          ...(step.selector ? { side: (step.side ?? "top") } : {}),
          align: "center" as const,
          onPopoverRender: () => {
            if (step.showDontShow) injectDontShowCheckbox();
          },
        },
        onHighlightStarted: async () => {
          if (step.before) {
            try {
              await step.before();
            } catch {}
          }
          if (step.waitMs) {
            await new Promise((r) => setTimeout(r, step.waitMs));
          }
        },
      }));

      const instance = driver({
        showProgress: true,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Próximo →",
        prevBtnText: "← Voltar",
        doneBtnText: "Concluir ✓",
        allowClose: true,
        overlayColor: "#000",
        overlayOpacity: 0.45,
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "atalaias-tour-popover",
        steps: driverSteps,
        onDestroyed: () => {
          driverRef.current = null;
          if (finishingRef.current) {
            hasStartedRef.current = false;
            return;
          }
          // Tour foi até o fim
          const isLastStep = instance.getActiveIndex() >= STEPS.length - 1;
          if (isLastStep) {
            finishTour(dontShowRef.current);
          }
          hasStartedRef.current = false;
          // Limpa params da Bíblia se sobrou
          if (window.location.search.includes("book=jo")) {
            window.history.replaceState({}, "", window.location.pathname);
          }
        },
        onCloseClick: () => {
          const confirmed = window.confirm(
            "Tem certeza que deseja sair do tour? Você pode refazê-lo em Você → Configurações."
          );
          if (confirmed) {
            completeTour(dontShowRef.current);
          }
        },
      });

      driverRef.current = instance;
      instance.drive();
    }, location.pathname === "/" ? 200 : 500);
  }, [completeTour, finishTour, injectDontShowCheckbox, location.pathname, navigate]);

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
