import { lazy, Suspense } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { navItems } from './nav-items';
import { AuthProvider } from './contexts/AuthContext';
import { StarfieldBackground } from '@/components/layout/StarfieldBackground';
import { ProtectedRoute } from '@/components/auth';
import OnboardingGuard from '@/components/auth/OnboardingGuard';
import OnboardingSpotlight from '@/components/onboarding/OnboardingSpotlight';
import { initSentry, SentryErrorBoundary } from '@/lib/sentry';
import GallopingLoader from '@/components/ui/GallopingLoader';
import { CelestialThemeProvider } from '@/components/theme/CelestialThemeProvider';
import { WhileYouWereGone } from '@/components/hub/WhileYouWereGone';
import DashboardLayout from '@/components/layout/DashboardLayout';

// Auth pages — lazy loaded
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const HorseDetailPage = lazy(() => import('./pages/HorseDetailPage'));

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
          <Sonner />
          <StarfieldBackground />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {/* Applies body.celestial class — reads ?theme= URL param + localStorage */}
            <CelestialThemeProvider />
            {/* Return overlay — shown after 4+ hour absence (authenticated users only) */}
            <WhileYouWereGone />
            {/* Redirects new users to /onboarding when completedOnboarding === false */}
            <OnboardingGuard />
            {/* Guided 10-step spotlight tour — active when completedOnboarding === false && onboardingStep >= 1 */}
            <OnboardingSpotlight />
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
                  {navItems.map(({ to, Page }) => (
                    <Route key={to} path={to} element={<Page />} />
                  ))}
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </SentryErrorBoundary>
);

export default App;
