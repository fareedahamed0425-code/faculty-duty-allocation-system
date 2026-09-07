import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileDrawer } from './MobileDrawer';
import { AIAssistantDrawer } from '../ai/AIAssistantDrawer';

export const DashboardLayout: React.FC = () => {
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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans antialiased text-slate-900 selection:bg-[#2582a1] selection:text-white">
      {/* Top Navigation */}
      <Navbar
        onOpenAI={() => setIsAIDrawerOpen(true)}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Layout Container */}
      <div className="flex-1 flex w-full max-w-[1600px] mx-auto min-w-0">
        {/* Left Sidebar (Desktop only) with collapsible support */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        {/* Content Area with mobile safe-padding and strictly bounded width */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-8 overflow-y-auto min-w-0">
          <div className="w-full min-w-0 max-w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (iOS / Android) */}
      <MobileBottomNav
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        onOpenAI={() => setIsAIDrawerOpen(true)}
      />

      {/* Mobile Slide-over Menu Drawer */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
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
