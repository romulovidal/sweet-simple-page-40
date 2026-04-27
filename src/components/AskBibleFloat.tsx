 import { MessageSquareQuote } from "lucide-react";
 import { useLocation } from "react-router-dom";
 import { useAppFeatures } from "@/hooks/useAppFeatures";
 
 const AskBibleFloat = () => {
   const location = useLocation();
   const { features } = useAppFeatures();
 
   // Só mostrar se estiver na Home e a feature estiver ativa
   if (location.pathname !== "/" || !features.ask_bible) return null;
 
   return (
     <button
       onClick={() => window.dispatchEvent(new CustomEvent("open-ask-bible"))}
       className="fixed bottom-24 right-5 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95 transition-all animate-fade-in flex items-center justify-center border-none"
       aria-label="Pergunte à Bíblia"
     >
       <MessageSquareQuote className="w-6 h-6" />
     </button>
   );
 };
 
 export default AskBibleFloat;