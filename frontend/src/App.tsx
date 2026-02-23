import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { navItems } from './nav-items';
import { AuthProvider } from './contexts/AuthContext';
import StableView from './pages/StableView';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import HorseDetailPage from './pages/HorseDetailPage';
import { StarField } from '@/components/layout/StarField';
import { ProtectedRoute } from '@/components/auth';
import { initSentry, SentryErrorBoundary } from '@/lib/sentry';

// Initialise Sentry once at module load (no-op if VITE_SENTRY_DSN not set)
initSentry();

const queryClient = new QueryClient();

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
              {navItems.map(({ to, page }) => (
                <Route key={to} path={to} element={<ProtectedRoute>{page}</ProtectedRoute>} />
              ))}
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </SentryErrorBoundary>
);

export default App;
