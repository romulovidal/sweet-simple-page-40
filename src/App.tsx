 import AskBibleFloat from "@/components/AskBibleFloat";
 import AskBible from "@/components/AskBible";
 import { useAppFeatures } from "@/hooks/useAppFeatures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import OfflineSyncBootstrap from "@/components/OfflineSyncBootstrap";
import ScrollToTop from "@/components/ScrollToTop";
import ThemeToggleFloat from "@/components/ThemeToggleFloat";
import InstallPrompt from "@/components/InstallPrompt";
import AdminInstallPrompt from "@/components/AdminInstallPrompt";
import UpdatePrompt from "@/components/UpdatePrompt";
import PushPermissionPrompt from "@/components/PushPermissionPrompt";
import PushNotificationViewer from "@/components/PushNotificationViewer";
import PageTransition from "@/components/PageTransition";
import AppTour from "@/components/AppTour";
import Onboarding from "@/components/Onboarding";
import { useManifestSwap } from "@/hooks/useManifestSwap";
import { useDailyOpenTracker } from "@/hooks/useDailyOpenTracker";
import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics";
import HomePage from "@/pages/HomePage";
import BiblePage from "@/pages/BiblePage";
import PlansPage from "@/pages/PlansPage";
import DiscoverPage from "@/pages/DiscoverPage";
import ProfilePage from "@/pages/ProfilePage";
import AdminPage from "@/pages/AdminPage";
import AtisPage from "@/pages/AtisPage";
import AppLanding from "@/pages/AppLanding";
import ManualPage from "@/pages/ManualPage";
import HarpaPage from "@/pages/HarpaPage";
import CanticosPage from "@/pages/CanticosPage";
import VerseShareRedirect from "@/pages/VerseShareRedirect";
import CultoShareRedirect from "@/pages/CultoShareRedirect";
import AdminCultoSelectionsPage from "@/pages/AdminCultoSelectionsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import TermsPage from "@/pages/TermsPage";
import RevistasPage from "@/pages/RevistasPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
   const { features } = useAppFeatures();
  const isAdmin = location.pathname.startsWith("/admin");
  const isAtis = location.pathname.startsWith("/atis");
  const isLanding = location.pathname === "/app" || location.pathname === "/manual";
  const resetKey = (location.state as any)?.reset || 0;
  const isMobile = useIsMobile();
  const showChrome = !isAdmin && !isAtis && !isLanding;
  // Wait for viewport detection so tour data-tour selectors resolve to only ONE nav
  const showSidebar = showChrome && isMobile === false;
  const showBottomNav = showChrome && isMobile !== false;

  useManifestSwap();
  useDailyOpenTracker();

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <div className={isAdmin || isAtis || isLanding ? "min-h-screen" : `min-h-screen ${showSidebar ? "lg:pl-64" : ""}`}>
      {showSidebar && <DesktopSidebar />}
      <div className={isAdmin || isAtis || isLanding ? "" : "max-w-6xl mx-auto relative lg:px-8"}>
        <ScrollToTop />
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname + resetKey}>
            <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
            <Route path="/biblia" element={<PageTransition><BiblePage /></PageTransition>} />
            <Route path="/planos" element={<PageTransition><PlansPage /></PageTransition>} />
            <Route path="/descubra" element={<PageTransition><DiscoverPage /></PageTransition>} />
            <Route path="/perfil" element={<PageTransition><ProfilePage /></PageTransition>} />
            <Route path="/manual" element={<PageTransition><ManualPage /></PageTransition>} />
            <Route path="/harpa" element={<PageTransition><HarpaPage /></PageTransition>} />
            <Route path="/harpa/culto/:cultoId" element={<PageTransition><HarpaPage /></PageTransition>} />
            <Route path="/harpa/:number" element={<PageTransition><HarpaPage /></PageTransition>} />
            <Route path="/canticos" element={<PageTransition><CanticosPage /></PageTransition>} />
            <Route path="/v/:slug" element={<VerseShareRedirect />} />
            <Route path="/c/:slug" element={<CultoShareRedirect />} />
            <Route path="/privacidade" element={<PageTransition><PrivacyPage /></PageTransition>} />
            <Route path="/termos" element={<PageTransition><TermsPage /></PageTransition>} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/atis" element={<AtisPage />} />
            <Route path="/admin/cultos" element={<AdminCultoSelectionsPage />} />
            <Route path="/estudos/revistas" element={<PageTransition><RevistasPage /></PageTransition>} />
            <Route path="/app" element={<AppLanding />} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </div>
      {showChrome && !showSidebar && <ThemeToggleFloat />}
      {isAdmin ? <AdminInstallPrompt /> : !isLanding && !isAtis && <InstallPrompt />}
      <UpdatePrompt />
      {!isAdmin && !isAtis && !isLanding && <PushPermissionPrompt />}
       {!isAdmin && !isAtis && !isLanding && <AskBible enabled={features.ask_bible} showButton={false} />}
       {!isAdmin && !isAtis && !isLanding && <AskBibleFloat />}
       {showBottomNav && <BottomNav />}
      {!isAdmin && !isAtis && !isLanding && <AppTour />}
      <PushNotificationViewer />
      {!isAdmin && !isAtis && !isLanding && <Onboarding />}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineSyncBootstrap />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
