import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Index from "./pages/Index";
import About from "./pages/About";
import Academics from "./pages/Academics";
import Admissions from "./pages/Admissions";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import RegisterParentPage from "./pages/RegisterParentPage";
import ResetPasswordRequestPage from "./pages/ResetPasswordRequestPage";
import UpdatePasswordPage from "./pages/UpdatePasswordPage";

// Lazy-loaded so the private admin app and parent portal (and their
// Supabase/table dependencies) never ship in the public marketing site's bundle.
const AdminApp = lazy(() => import("./admin/AdminApp"));
const ParentPortalApp = lazy(() => import("./portal/ParentPortalApp"));

const queryClient = new QueryClient();

const PublicSite = () => (
  <div className="min-h-screen flex flex-col bg-background text-foreground">
    <Navbar />
    <div className="flex-1">
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/about" element={<About />} />
        <Route path="/academics" element={<Academics />} />
        <Route path="/admissions" element={<Admissions />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
    <Footer />
  </div>
);

const PrivateAppFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">
    Loading…
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* One shared theme for the whole app — public site, auth pages, admin
          dashboard, and family dashboard all honor the same light/dark
          preference (same localStorage key), rather than the public site
          being the only themed area. Defaults to light for a first-time
          visitor regardless of which route they land on first. */}
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterParentPage />} />
              <Route path="/reset-password" element={<ResetPasswordRequestPage />} />
              <Route path="/update-password" element={<UpdatePasswordPage />} />
              <Route
                path="/admin/*"
                element={
                  <Suspense fallback={<PrivateAppFallback />}>
                    <AdminApp />
                  </Suspense>
                }
              />
              <Route
                path="/portal/*"
                element={
                  <Suspense fallback={<PrivateAppFallback />}>
                    <ParentPortalApp />
                  </Suspense>
                }
              />
              <Route path="/*" element={<PublicSite />} />
            </Routes>
          </BrowserRouter>
        </MotionConfig>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
