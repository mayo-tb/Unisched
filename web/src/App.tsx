import { AuthProvider, useAuth } from './store/AuthContext';
import { ViewProvider, useView } from './store/ViewContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './layouts/DashboardLayout';
import { LoginOverlay } from './components/LoginOverlay';
import { Dashboard } from './pages/Dashboard';
import { Timetable } from './pages/Timetable';
import { Resources } from './pages/Resources';
import { Settings } from './pages/Settings';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const { currentView } = useView();

  if (!isAuthenticated) {
    return <LoginOverlay />;
  }

  return (
    <AppLayout>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'timetable' && <Timetable />}
      {currentView === 'resources' && <Resources />}
      {currentView === 'settings' && <Settings />}
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ViewProvider>
          <AppContent />
        </ViewProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
