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
       className="fixed bottom-24 right-5 z-50 w-14 h-14 active:scale-95 transition-all animate-fade-in cursor-pointer flex items-center justify-center p-0 border-none bg-transparent outline-none focus:outline-none"
       style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
     >
       <img
         src={`/ask-bible-icon.png?v=${Date.now()}`}
         alt="Pergunte à Bíblia"
         className="w-full h-full object-contain pointer-events-none"
       />
     </button>
   );
 };
 
 export default AskBibleFloat;