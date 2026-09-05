import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { MobileDrawer } from './components/layout/MobileDrawer';
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
import { AIAssistantDrawer } from './components/ai/AIAssistantDrawer';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Persistent sidebar collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('apollo_sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('apollo_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {
      // ignore
    }
  }, [isSidebarCollapsed]);

  const roleName = user?.role?.name || '';

  // Auto-route user to their dedicated role-specific landing page upon login/role change
  useEffect(() => {
    if (user) {
      if (roleName === 'FACULTY') {
        setActiveTab('faculty-portal');
      } else if (roleName === 'HOD') {
        setActiveTab('hod-dashboard');
      } else if (roleName === 'DEAN') {
        setActiveTab('dean-dashboard');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [roleName, user?.id]);

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

  // Not logged in -> Show Login Page
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-900 selection:bg-[#2582a1] selection:text-white">
      {/* Top Navigation */}
      <Navbar
        onOpenAI={() => setIsAIDrawerOpen(true)}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Layout Container */}
      <div className="flex-1 flex w-full max-w-[1600px] mx-auto min-w-0">
        {/* Left Sidebar (Desktop only) with collapsible support */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        {/* Content Area with mobile safe-padding and strictly bounded width */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-8 overflow-y-auto min-w-0">
          <div className="w-full min-w-0 max-w-full">
            {activeTab === 'dashboard' && (
              <AdminDashboard
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenAI={() => setIsAIDrawerOpen(true)}
              />
            )}
            {activeTab === 'hod-dashboard' && (
              <HODDashboard
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenAI={() => setIsAIDrawerOpen(true)}
              />
            )}
            {activeTab === 'dean-dashboard' && (
              <DeanDashboard
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenAI={() => setIsAIDrawerOpen(true)}
              />
            )}
            {activeTab === 'faculty-portal' && <FacultyPortal />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'faculty' && <FacultyManagement />}
            {activeTab === 'timetables' && <TimetablePage />}
            {activeTab === 'absences' && <AbsencesPage />}
            {activeTab === 'substitutions' && <SubstitutionsPage />}
            {activeTab === 'reports' && <ReportsPage />}
            {activeTab === 'rules' && <SystemRulesPage />}
            {activeTab === 'audit' && <AuditLogsPage />}
            {activeTab === 'ai-assistant' && <AIAssistantPage />}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (iOS / Android) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        onOpenAI={() => setIsAIDrawerOpen(true)}
      />

      {/* Mobile Slide-over Menu Drawer */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAI={() => setIsAIDrawerOpen(true)}
      />

      {/* AI Assistant Slide-Out Panel */}
      <AIAssistantDrawer
        isOpen={isAIDrawerOpen}
        onClose={() => setIsAIDrawerOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
