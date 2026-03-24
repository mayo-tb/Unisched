import { AuthProvider, useAuth } from './store/AuthContext';
import { ViewProvider, useView } from './store/ViewContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './layouts/DashboardLayout';
import { LoginOverlay } from './components/LoginOverlay';
import { Dashboard } from './pages/Dashboard';
import { Timetable } from './pages/Timetable';
import { Resources } from './pages/Resources';
import { Settings } from './pages/Settings';
import { MySchedule } from './pages/MySchedule';
import { Preferences } from './pages/Preferences';
import { Complaints } from './pages/Complaints';
import { Officers } from './pages/Officers';
import { AuditLog } from './pages/AuditLog';

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const { currentView } = useView();

  if (!isAuthenticated) {
    return <LoginOverlay />;
  }

  const isLecturer = user?.role === 'LECTURER';

  return (
    <AppLayout>
      {/* Admin views */}
      {!isLecturer && currentView === 'dashboard' && <Dashboard />}
      {!isLecturer && currentView === 'timetable' && <Timetable />}
      {!isLecturer && currentView === 'resources' && <Resources />}
      {!isLecturer && currentView === 'settings' && <Settings />}
      {!isLecturer && currentView === 'officers' && <Officers />}
      {!isLecturer && currentView === 'audit-log' && <AuditLog />}

      {/* Lecturer views */}
      {isLecturer && currentView === 'my-schedule' && <MySchedule />}
      {isLecturer && currentView === 'preferences' && <Preferences />}

      {/* Shared views */}
      {currentView === 'complaints' && <Complaints />}
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
