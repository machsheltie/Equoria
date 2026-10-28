import { lazy, Suspense } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { GameTooltipProvider as TooltipProvider } from '@/components/ui/game';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppQueryClient } from './lib/queryClient';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { navItems } from './nav-items';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth';
import OnboardingGuard from '@/components/auth/OnboardingGuard';
import EmailVerificationGuard from '@/components/auth/EmailVerificationGuard';
import ErrorBoundary from '@/components/ErrorBoundary';
import AppCrashFallback from '@/components/AppCrashFallback';
import GallopingLoader from '@/components/ui/GallopingLoader';
import { RewardToastProvider } from '@/components/feedback';
import { CelestialThemeProvider } from '@/components/theme/CelestialThemeProvider';
import { DisplayPreferencesApplier } from '@/components/DisplayPreferencesApplier';
import DashboardLayout from '@/components/layout/DashboardLayout';
// Eager, not lazy: a Suspense fallback here would tell /steward apart from an
// unknown address (STAFF-CR-17).
import StewardGate from '@/components/staff/StewardGate';
import NotFoundPage from './pages/NotFoundPage';
// One horse page for life (Equoria-jaeot): old /foals/:id links land on /horses/:id.
import FoalLinkRedirect from './pages/FoalLinkRedirect';

// Overlay components — lazy loaded (never visible on initial render)
// WhileYouWereGone: shown only after 4+ hour authenticated absence
const WhileYouWereGone = lazy(() =>
  import('@/components/hub/WhileYouWereGone').then((m) => ({ default: m.WhileYouWereGone }))
);
// OnboardingSpotlight: shown only when completedOnboarding === false && onboardingStep >= 1
const OnboardingSpotlight = lazy(() => import('@/components/onboarding/OnboardingSpotlight'));
// One-time welcome note after the signup wizard (Equoria-kd2dd)
const WelcomeDialog = lazy(() => import('@/components/onboarding/WelcomeDialog'));

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
// Allocate Stats is its own page (owner ruling q223, 2026-10-28; Equoria-a0fim).
const AllocateStatsPage = lazy(() => import('./pages/horses/AllocateStatsPage'));
// Equoria-puj1e.1: the staff-only Steward's Office. Deliberately absent from
// navItems. Loaded only after StewardGate has confirmed a steward.
const StewardsOfficePage = lazy(() => import('./pages/StewardsOfficePage'));

// Equoria-bvddn.29: ends a dead session (clear cache + /login) on a 401 after a failed refresh.
const queryClient = createAppQueryClient();

const App = () => (
  <ErrorBoundary
    fallback={({ reset, error }) => <AppCrashFallback onRetry={reset} error={error} />}
  >
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
              {/* Settings Display switches -> document root attributes (Equoria-apfwp) */}
              <DisplayPreferencesApplier />
              {/* Return overlay — shown after 4+ hour absence (authenticated users only).
                  fallback={null} is deliberate (doctrine section 5 exemption): until this lazy
                  chunk loads there is no overlay to stand in for — the player is not waiting
                  on it, and it announces its own loading state once mounted. */}
              <Suspense fallback={null}>
                <WhileYouWereGone />
              </Suspense>
              {/* OnboardingGuard (wraps Routes below) redirects new users to /onboarding when completedOnboarding === false */}
              {/* Guided 10-step spotlight tour — active when completedOnboarding === false && onboardingStep >= 1.
                  fallback={null} is deliberate (doctrine section 5 exemption): the tour is an
                  optional overlay with nothing to show before its chunk loads. */}
              <Suspense fallback={null}>
                <OnboardingSpotlight />
              </Suspense>
              {/* One-time welcome note (Equoria-kd2dd): shown once, to a player who has just
                  finished the signup wizard. The guided tour waits until it is dismissed.
                  fallback={null} is deliberate (doctrine section 5 exemption): until this lazy
                  chunk loads there is nothing to stand in for — the note announces itself. */}
              <Suspense fallback={null}>
                <WelcomeDialog />
              </Suspense>
              {/* EmailVerificationGuard (Equoria-voasj): no play until the email is confirmed. */}
              <EmailVerificationGuard>
                <OnboardingGuard>
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

                      {/* The Steward's Office (STAFF-CR-17): StewardGate decides before
                      any login redirect or nav shell, so for anyone who is not
                      staff /steward renders exactly like the catch-all below. */}
                      <Route
                        path="/steward"
                        element={
                          <StewardGate>
                            <ProtectedRoute>
                              <DashboardLayout />
                            </ProtectedRoute>
                          </StewardGate>
                        }
                      >
                        <Route index element={<StewardsOfficePage />} />
                      </Route>

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
                        <Route path="/horses/:id/allocate-stats" element={<AllocateStatsPage />} />
                        <Route path="/foals/:id" element={<FoalLinkRedirect />} />
                        {/* Equoria-vb1n0: the Hall of Fame moved; old links land on it. */}
                        <Route
                          path="/my-stable"
                          element={<Navigate to="/hall-of-fame" replace />}
                        />
                        {navItems.map(({ to, Page }) => (
                          <Route key={to} path={to} element={<Page />} />
                        ))}
                      </Route>

                      {/* Any other address: the one not-found behaviour. */}
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </OnboardingGuard>
              </EmailVerificationGuard>
            </BrowserRouter>
          </RewardToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
