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
       className="fixed bottom-24 right-5 z-50 w-14 h-14 rounded-xl overflow-hidden shadow-2xl active:scale-95 transition-all animate-fade-in bg-black"
       aria-label="Pergunte à Bíblia"
     >
       <img 
         src="/ask-bible-icon.png" 
         alt="Pergunte à Bíblia" 
         className="w-full h-full object-contain"
       />
     </button>
   );
 };
 
 export default AskBibleFloat;