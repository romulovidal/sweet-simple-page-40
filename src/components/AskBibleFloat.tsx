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
       className="fixed bottom-24 right-5 z-50 w-14 h-14 rounded-2xl overflow-hidden shadow-lg active:scale-95 transition-all animate-fade-in border-none p-0 flex items-center justify-center bg-black"
       aria-label="Pergunte à Bíblia"
     >
       <img 
         src="/ask-bible-icon.png" 
         alt="Pergunte à Bíblia" 
         className="w-[102%] h-[102%] object-cover scale-110"
       />
     </button>
   );
 };
 
 export default AskBibleFloat;