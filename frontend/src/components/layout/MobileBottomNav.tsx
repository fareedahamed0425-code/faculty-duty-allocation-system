import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Repeat,
  Bot,
  UserCheck,
  Users,
  Building2,
  GraduationCap,
  Menu
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMenu: () => void;
  onOpenAI: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMenu,
  onOpenAI,
}) => {
  const { user } = useAuth();
  const roleName = user?.role?.name || '';
  const isFaculty = roleName === 'FACULTY';
  const isHOD = roleName === 'HOD';
  const isDean = roleName === 'DEAN';

  // Primary mobile dashboard tab icon/id
  const mainDashTab = isHOD
    ? { id: 'hod-dashboard', label: 'Dept', icon: Building2 }
    : isDean
    ? { id: 'dean-dashboard', label: 'Dean', icon: GraduationCap }
    : { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard };

  // Customized bottom tabs for role
  const tabs = isFaculty
    ? [
        { id: 'faculty-portal', label: 'My Portal', icon: UserCheck },
        { id: 'timetables', label: 'Timetable', icon: Calendar },
        { id: 'substitutions', label: 'Duties', icon: Repeat },
        { id: 'ai', label: 'AI Advisor', icon: Bot, isAction: true },
        { id: 'menu', label: 'Menu', icon: Menu, isAction: true },
      ]
    : [
        mainDashTab,
        { id: 'substitutions', label: 'Duties', icon: Repeat },
        { id: 'timetables', label: 'Timetable', icon: Calendar },
        { id: 'faculty', label: 'Faculty', icon: Users },
        { id: 'menu', label: 'Menu', icon: Menu, isAction: true },
      ];

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-5 gap-1 items-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          const handleClick = () => {
            if (tab.id === 'menu') {
              onOpenMenu();
            } else if (tab.id === 'ai') {
              onOpenAI();
            } else {
              setActiveTab(tab.id);
            }
          };

          return (
            <button
              key={tab.id}
              onClick={handleClick}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all select-none active:scale-95 ${
                isActive && !tab.isAction
                  ? 'text-brand-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div
                className={`w-9 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  isActive && !tab.isAction
                    ? 'bg-brand-50 text-brand-600'
                    : tab.id === 'ai'
                    ? 'bg-emerald-50 text-emerald-600'
                    : ''
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
