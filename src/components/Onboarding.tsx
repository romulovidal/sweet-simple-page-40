import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BIBLE_VERSIONS, DEFAULT_VERSION_ID } from "@/services/bibleApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Check, ChevronRight, Bell, BookOpen, Sparkles } from "lucide-react";
import { registerPushNotifications, isPushEnabled } from "@/lib/pushNotifications";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const Onboarding = () => {
  const [show, setShow] = useLocalStorage<boolean>("show-onboarding-v1", true);
  const [step, setStep] = useState(1);
  const [selectedVersion, setBibleVersion] = useLocalStorage<string>("bible-version", DEFAULT_VERSION_ID);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    isPushEnabled().then(setPushEnabled);
  }, []);

  if (!show) return null;

  const next = () => setStep(s => s + 1);
  const finish = () => {
    setShow(false);
    // Notify that onboarding is done so tour can start
    window.dispatchEvent(new CustomEvent("onboarding:closed"));
  };

  const handlePushEnable = async () => {
    const ok = await registerPushNotifications();
    setPushEnabled(ok);
    if (ok) {
      toast.success("Notificações ativadas! 🔔");
      next();
    } else {
      toast.error("Não foi possível ativar. Você pode tentar depois no perfil.");
    }
  };

  return (
    <div data-onboarding-active="true" className="fixed inset-0 z-[100] bg-[hsl(var(--dark-bg))] flex flex-col items-center justify-center px-6">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6 max-w-sm"
          >
            <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Bem-vindo à Bíblia Atalaia</h1>
              <p className="text-[hsl(var(--dark-muted))] text-sm">
                Sua jornada de fé com inteligência espiritual e comunidade. Vamos configurar sua experiência em 1 minuto?
              </p>
            </div>
            <Button onClick={next} className="w-full h-12 text-base font-semibold rounded-xl">
              Começar <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="space-y-2 text-center">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold">Escolha sua versão</h2>
              <p className="text-[hsl(var(--dark-muted))] text-sm">
                Qual tradução você prefere ler? Você pode mudar isso a qualquer momento.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {BIBLE_VERSIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setBibleVersion(v.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    selectedVersion === v.id
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-[hsl(var(--dark-card))] bg-[hsl(var(--dark-card))] hover:border-[hsl(var(--dark-card-hover))]"
                  }`}
                >
                  <div className="text-left">
                    <p className="font-bold text-sm">{v.shortName}</p>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))]">{v.name}</p>
                  </div>
                  {selectedVersion === v.id && <Check className="w-5 h-5 text-primary" />}
                </button>
              ))}
            </div>
            <Button onClick={next} className="w-full h-12 text-base font-semibold rounded-xl">
              Continuar
            </Button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6 max-w-sm"
          >
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <Bell className="w-8 h-8 text-amber-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Não perca nada</h2>
              <p className="text-[hsl(var(--dark-muted))] text-sm">
                Receba o versículo do dia às 08:00 e lembretes de oração da comunidade.
              </p>
            </div>
            <div className="space-y-3 pt-4">
              <Button onClick={handlePushEnable} disabled={pushEnabled} className="w-full h-12 text-base font-semibold rounded-xl bg-amber-500 hover:bg-amber-600">
                {pushEnabled ? "Notificações Ativas ✅" : "Ativar Notificações"}
              </Button>
              <button onClick={finish} className="text-[hsl(var(--dark-muted))] text-sm font-medium hover:text-[hsl(var(--dark-text))] transition-colors">
                Pular por enquanto
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-10 flex gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              step === i ? "w-6 bg-primary" : "bg-[hsl(var(--dark-card))]"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Onboarding;