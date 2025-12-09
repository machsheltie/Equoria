import TrainingDashboard from '@/components/training/TrainingDashboard';
import { useAuth } from '@/contexts/AuthContext';

const TrainingPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-sm text-slate-600">Checking authentication…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
          Please log in to access the training center.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <TrainingDashboard userId={user?.id ? String(user.id) : undefined} />
    </div>
  );
};

export default TrainingPage;
