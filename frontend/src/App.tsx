import { lazy, Suspense } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { GameTooltipProvider as TooltipProvider } from '@/components/ui/game';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from './lib/queryClient';
import { BrowserRouter, Routes, Route } from 'react-router';
import { navItems } from './nav-items';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth';
import OnboardingGuard from '@/components/auth/OnboardingGuard';
import ErrorBoundary from '@/components/ErrorBoundary';
import GallopingLoader from '@/components/ui/GallopingLoader';
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
// Equoria-6p398.11 (Finding 9): the landing page for the recovery-address
// confirmation link. Public for the same reason /verify-email is — the link is
// opened from the mailbox of the NEW address, routinely in another browser.
const ConfirmEmailChangePage = lazy(() => import('./pages/ConfirmEmailChangePage'));
const HorseDetailPage = lazy(() => import('./pages/HorseDetailPage'));
const HorseEquipPage = lazy(() => import('./pages/horses/HorseEquipPage'));
const FoalDetailPage = lazy(() => import('./pages/FoalDetailPage'));

// Equoria-bvddn.29: ends a dead session (clear cache + /login) on a 401 after a failed refresh.
const queryClient = createAppQueryClient();

const App = () => (
  <ErrorBoundary fallback={<p className="text-[var(--text-primary)] p-8">Something went wrong.</p>}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          {/* RewardToast trigger layer — meaningful-progress toasts queued
              globally (Equoria-vcar, Spec 11.3.10). */}
          <RewardToastProvider>
            <BrowserRouter>
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
                  {/* Equoria-bvddn.36: requires auth (no DashboardLayout nav shell) —
                      a logged-out visitor must not be able to walk the wizard and
                      only fail with a 401 on submit. OnboardingGuard still does the
                      post-registration redirect into this route for an already
                      signed-in player. */}
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <OnboardingPage />
                      </ProtectedRoute>
                    }
                  />
                  {/* Public routes — no nav shell */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />

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
  </ErrorBoundary>
);

export default App;
