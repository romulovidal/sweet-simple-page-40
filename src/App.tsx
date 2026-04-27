 import AskBibleFloat from "@/components/AskBibleFloat";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
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
import HomePage from "@/pages/HomePage";
import BiblePage from "@/pages/BiblePage";
import PlansPage from "@/pages/PlansPage";
import DiscoverPage from "@/pages/DiscoverPage";
import ProfilePage from "@/pages/ProfilePage";
import AdminPage from "@/pages/AdminPage";
import AppLanding from "@/pages/AppLanding";
import ManualPage from "@/pages/ManualPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isLanding = location.pathname === "/app" || location.pathname === "/manual";
  const resetKey = (location.state as any)?.reset || 0;

  useManifestSwap();

  return (
    <div className={isAdmin || isLanding ? "min-h-screen" : "max-w-6xl mx-auto relative min-h-screen lg:px-8"}>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname + resetKey}>
          <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
          <Route path="/biblia" element={<PageTransition><BiblePage /></PageTransition>} />
          <Route path="/planos" element={<PageTransition><PlansPage /></PageTransition>} />
          <Route path="/descubra" element={<PageTransition><DiscoverPage /></PageTransition>} />
          <Route path="/perfil" element={<PageTransition><ProfilePage /></PageTransition>} />
          <Route path="/manual" element={<PageTransition><ManualPage /></PageTransition>} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/app" element={<AppLanding />} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </AnimatePresence>
      {!isAdmin && !isLanding && <ThemeToggleFloat />}
      {isAdmin ? <AdminInstallPrompt /> : !isLanding && <InstallPrompt />}
      <UpdatePrompt />
      {!isAdmin && !isLanding && <PushPermissionPrompt />}
       {!isAdmin && !isLanding && <AskBibleFloat />}
       {!isAdmin && !isLanding && <BottomNav />}
      {!isAdmin && !isLanding && <AppTour />}
      <PushNotificationViewer />
      {!isAdmin && !isLanding && <Onboarding />}
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
