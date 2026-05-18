import { lazy, Suspense } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { GameTooltipProvider as TooltipProvider } from '@/components/ui/game';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { navItems } from './nav-items';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth';
import OnboardingGuard from '@/components/auth/OnboardingGuard';
import { initSentry, SentryErrorBoundary } from '@/lib/sentry';
import GallopingLoader from '@/components/ui/GallopingLoader';
import StarfieldBackground from '@/components/ui/StarfieldBackground';
import { RewardToastProvider } from '@/components/feedback';
import { CelestialThemeProvider } from '@/components/theme/CelestialThemeProvider';
import DashboardLayout from '@/components/layout/DashboardLayout';

// Overlay components — lazy loaded (never visible on initial render)
// WhileYouWereGone: shown only after 4+ hour authenticated absence
const WhileYouWereGone = lazy(() =>
  import('@/components/hub/WhileYouWereGone').then((m) => ({ default: m.WhileYouWereGone }))
);
// OnboardingSpotlight: shown only when completedOnboarding === false && onboardingStep >= 1
const OnboardingSpotlight = lazy(() => import('@/components/onboarding/OnboardingSpotlight'));

// Auth pages — lazy loaded
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const HorseDetailPage = lazy(() => import('./pages/HorseDetailPage'));
const HorseEquipPage = lazy(() => import('./pages/horses/HorseEquipPage'));
const FoalDetailPage = lazy(() => import('./pages/FoalDetailPage'));

// Initialise Sentry once at module load (no-op if VITE_SENTRY_DSN not set)
initSentry();

const queryClient = new QueryClient();

const App = () => (
  <SentryErrorBoundary
    fallback={<p className="text-[var(--text-primary)] p-8">Something went wrong.</p>}
  >
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          {/* Global Celestial-Night atmospheric layer — behind every route,
              including public auth/onboarding pages (Equoria-9x4w, Spec 11.3.1). */}
          <StarfieldBackground />
          <Sonner />
          {/* RewardToast trigger layer — meaningful-progress toasts queued
              globally (Equoria-vcar, Spec 11.3.10). */}
          <RewardToastProvider>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              {/* Applies body.celestial class — reads ?theme= URL param + localStorage */}
              <CelestialThemeProvider />
              {/* Return overlay — shown after 4+ hour absence (authenticated users only) */}
              <Suspense fallback={null}>
                <WhileYouWereGone />
              </Suspense>
              {/* Redirects new users to /onboarding when completedOnboarding === false */}
              <OnboardingGuard />
              {/* Guided 10-step spotlight tour — active when completedOnboarding === false && onboardingStep >= 1 */}
              <Suspense fallback={null}>
                <OnboardingSpotlight />
              </Suspense>
              <Suspense fallback={<GallopingLoader />}>
                <Routes>
                  {/* Public routes — no nav shell */}
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  {/* Authenticated routes — DashboardLayout provides persistent nav */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <DashboardLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/horses/:id" element={<HorseDetailPage />} />
                    <Route path="/horses/:id/equip" element={<HorseEquipPage />} />
                    <Route path="/foals/:id" element={<FoalDetailPage />} />
                    {navItems.map(({ to, Page }) => (
                      <Route key={to} path={to} element={<Page />} />
                    ))}
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </RewardToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </SentryErrorBoundary>
);

export default App;
