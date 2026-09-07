import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute, AdminRoute, RoleRoute } from './components/auth/ProtectedRoute';

// Pages
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { HODDashboard } from './pages/HODDashboard';
import { DeanDashboard } from './pages/DeanDashboard';
import { FacultyPortal } from './pages/FacultyPortal';
import { FacultyManagement } from './pages/FacultyManagement';
import { TimetablePage } from './pages/TimetablePage';
import { AbsencesPage } from './pages/AbsencesPage';
import { SubstitutionsPage } from './pages/SubstitutionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SystemRulesPage } from './pages/SystemRulesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { UserManagement } from './pages/UserManagement';
import { AcademicCalendarPage } from './pages/AcademicCalendarPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';

/**
 * Intelligently redirects users from '/' to their role's default landing page.
 */
const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-[#2582a1] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-300">The Apollo University Portal Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const roleName = user.role?.name || '';
  if (roleName === 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  } else if (roleName === 'DEAN') {
    return <Navigate to="/dean-dashboard" replace />;
  } else if (roleName === 'HOD' || roleName === 'PC') {
    return <Navigate to="/hod-dashboard" replace />;
  } else {
    return <Navigate to="/faculty-portal" replace />;
  }
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root Smart Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Authenticated Application Layout */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* 1. Admin Control Center (Strictly Locked to ADMIN) */}
            <Route
              path="/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route path="/admin" element={<Navigate to="/dashboard" replace />} />

            {/* 2. User & Role Management (Strictly Locked to ADMIN) */}
            <Route
              path="/users"
              element={
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              }
            />
            <Route path="/admin/users" element={<Navigate to="/users" replace />} />

            {/* 3. System Rules & Limits (Strictly Locked to ADMIN) */}
            <Route
              path="/rules"
              element={
                <AdminRoute>
                  <SystemRulesPage />
                </AdminRoute>
              }
            />
            <Route path="/admin/rules" element={<Navigate to="/rules" replace />} />
            <Route path="/system-rules" element={<Navigate to="/rules" replace />} />

            {/* 4. Leadership & Governance Dashboards */}
            <Route
              path="/hod-dashboard"
              element={
                <RoleRoute allowedRoles={['PC', 'DEAN', 'HOD']}>
                  <HODDashboard />
                </RoleRoute>
              }
            />
            <Route path="/dept" element={<Navigate to="/hod-dashboard" replace />} />

            <Route
              path="/dean-dashboard"
              element={
                <RoleRoute allowedRoles={['DEAN']}>
                  <DeanDashboard />
                </RoleRoute>
              }
            />
            <Route path="/dean" element={<Navigate to="/dean-dashboard" replace />} />

            {/* 5. Faculty & Operational Pages */}
            <Route path="/faculty-portal" element={<FacultyPortal />} />
            <Route path="/portal" element={<Navigate to="/faculty-portal" replace />} />

            <Route path="/substitutions" element={<SubstitutionsPage />} />
            <Route path="/duties" element={<Navigate to="/substitutions" replace />} />

            <Route path="/timetables" element={<TimetablePage />} />

            <Route
              path="/absences"
              element={
                <RoleRoute allowedRoles={['ADMIN', 'DEAN', 'PC', 'INTERNAL_MEMBERS']}>
                  <AbsencesPage />
                </RoleRoute>
              }
            />
            <Route path="/leaves" element={<Navigate to="/absences" replace />} />

            <Route
              path="/faculty"
              element={
                <RoleRoute allowedRoles={['ADMIN', 'DEAN', 'PC', 'INTERNAL_MEMBERS']}>
                  <FacultyManagement />
                </RoleRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <RoleRoute allowedRoles={['ADMIN', 'DEAN', 'PC', 'INTERNAL_MEMBERS']}>
                  <ReportsPage />
                </RoleRoute>
              }
            />
            <Route path="/analytics" element={<Navigate to="/reports" replace />} />

            <Route
              path="/audit"
              element={
                <RoleRoute allowedRoles={['ADMIN', 'DEAN', 'PC', 'INTERNAL_MEMBERS']}>
                  <AuditLogsPage />
                </RoleRoute>
              }
            />
            <Route path="/audit-logs" element={<Navigate to="/audit" replace />} />

            <Route path="/academic-calendar" element={<AcademicCalendarPage />} />
            <Route path="/calendar" element={<Navigate to="/academic-calendar" replace />} />

            <Route path="/ai-assistant" element={<AIAssistantPage />} />
            <Route path="/ai" element={<Navigate to="/ai-assistant" replace />} />

            {/* 6. Locked / Access Denied page */}
            <Route path="/access-denied" element={<AccessDeniedPage />} />
            <Route path="/unauthorized" element={<Navigate to="/access-denied" replace />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
