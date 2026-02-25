import { lazy, Suspense } from 'react';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { navItems } from './nav-items';
import { AuthProvider } from './contexts/AuthContext';
import { StarField } from '@/components/layout/StarField';
import { ProtectedRoute } from '@/components/auth';
import { initSentry, SentryErrorBoundary } from '@/lib/sentry';

// Auth pages — lazy loaded
const StableView = lazy(() => import('./pages/StableView'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const HorseDetailPage = lazy(() => import('./pages/HorseDetailPage'));

// Initialise Sentry once at module load (no-op if VITE_SENTRY_DSN not set)
initSentry();

const queryClient = new QueryClient();

/** Loading spinner shown while a lazy route chunk is being fetched */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--celestial-primary)] border-r-transparent" />
    </div>
  );
}

const App = () => (
  <SentryErrorBoundary fallback={<p className="text-white p-8">Something went wrong.</p>}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <div className="fixed inset-0 z-[-1]">
            <StarField density="medium" speed="slow" />
          </div>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stable"
                  element={
                    <ProtectedRoute>
                      <StableView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/horses/:id"
                  element={
                    <ProtectedRoute>
                      <HorseDetailPage />
                    </ProtectedRoute>
                  }
                />
                {navItems.map(({ to, Page }) => (
                  <Route
                    key={to}
                    path={to}
                    element={
                      <ProtectedRoute>
                        <Page />
                      </ProtectedRoute>
                    }
                  />
                ))}
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </SentryErrorBoundary>
);

export default App;
