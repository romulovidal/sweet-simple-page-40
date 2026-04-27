 import { MessageCircleQuestion } from "lucide-react";
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
       className="fixed bottom-24 right-5 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 active:scale-95 transition-all animate-fade-in"
       aria-label="Pergunte à Bíblia"
     >
       <MessageCircleQuestion className="w-6 h-6 text-white" />
     </button>
   );
 };
 
 export default AskBibleFloat;