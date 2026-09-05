import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  LayoutDashboard,
  Users,
  Calendar,
  UserX,
  Repeat,
  BarChart3,
  Sliders,
  ShieldCheck,
  Bot,
  UserCheck,
  LogOut,
  Sparkles,
  Building2,
  GraduationCap
} from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAI: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onOpenAI,
}) => {
  const { user, logout } = useAuth();
  const roleName = user?.role?.name || '';
  const isAdmin = roleName === 'ADMIN';
  const isFaculty = roleName === 'FACULTY';
  const isHOD = roleName === 'HOD';
  const isDean = roleName === 'DEAN';
  const isLeadership = ['DEAN', 'HOD', 'PC', 'COMMITTEE_MEMBER'].includes(roleName);

  if (!isOpen) return null;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Admin Control Center',
      icon: LayoutDashboard,
      visible: isAdmin,
      badge: 'Admin',
    },
    {
      id: 'users',
      label: 'User & Role Management',
      icon: Users,
      visible: isAdmin,
      badge: 'Roles',
    },
    {
      id: 'hod-dashboard',
      label: 'Department Overview',
      icon: Building2,
      visible: isHOD,
      badge: 'HOD',
    },
    {
      id: 'dean-dashboard',
      label: 'Academic Governance',
      icon: GraduationCap,
      visible: isDean,
      badge: 'Dean',
    },
    {
      id: 'faculty-portal',
      label: 'My Faculty Portal',
      icon: UserCheck,
      visible: true,
      badge: isFaculty ? 'Personal' : undefined,
    },
    {
      id: 'substitutions',
      label: 'Substitution Duties',
      icon: Repeat,
      visible: true,
    },
    {
      id: 'timetables',
      label: 'Timetable Explorer',
      icon: Calendar,
      visible: true,
    },
    {
      id: 'absences',
      label: 'Absences & Leaves',
      icon: UserX,
      visible: isAdmin || isLeadership,
    },
    {
      id: 'faculty',
      label: 'Faculty Directory',
      icon: Users,
      visible: isAdmin || isLeadership,
    },
    {
      id: 'reports',
      label: 'Workload & Analytics',
      icon: BarChart3,
      visible: isAdmin || isLeadership,
    },
    {
      id: 'rules',
      label: 'System Rules & Limits',
      icon: Sliders,
      visible: isAdmin,
    },
    {
      id: 'audit',
      label: 'Audit Trail & Compliance',
      icon: ShieldCheck,
      visible: isAdmin || isLeadership,
    },
    {
      id: 'ai-assistant',
      label: 'AI Assistant',
      icon: Bot,
      visible: true,
      badge: 'AI',
    },
  ];

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="fixed inset-y-0 left-0 max-w-[85vw] w-80 bg-white shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
        {/* Top Header */}
        <div>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#f0f9fb]">
            <div className="flex items-center space-x-2.5">
              <img
                src="/apollo_logo.svg"
                alt="The Apollo University"
                className="h-8 w-auto object-contain"
              />
              <div>
                <h3 className="text-sm font-bold text-[#0e3b4b] leading-tight">The Apollo University</h3>
                <p className="text-[10px] text-[#2582a1] font-semibold">Scheduler 2026</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="p-4 bg-[#0e3b4b] text-white">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#2582a1] text-white font-bold text-sm flex items-center justify-center shadow-md border-2 border-[#fdb931]">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{user?.full_name || 'User'}</p>
                <p className="text-[11px] text-slate-300 font-mono truncate">{user?.email}</p>
                <div className="mt-1 flex items-center space-x-1.5">
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#fdb931] text-[#0e3b4b] font-extrabold uppercase">
                    {roleName}
                  </span>
                  {user?.department_name && (
                    <span className="text-[9px] text-slate-300 truncate">
                      • {user.department_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navigation Menu
            </div>
            {navItems.filter((i) => i.visible).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#f0f9fb] text-[#2582a1] font-bold shadow-xs border border-[#bee3ee]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#2582a1]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        isActive ? 'bg-[#2582a1] text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-2">
          <button
            onClick={() => {
              onClose();
              onOpenAI();
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#2582a1] text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#fdb931]" />
            <span>Launch AI Assistant</span>
          </button>

          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full py-2 px-3 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
