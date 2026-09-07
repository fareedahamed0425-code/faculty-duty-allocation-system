import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
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
  Building2,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const roleName = user?.role?.name || '';
  const isAdmin = roleName === 'ADMIN';
  const isFaculty = roleName === 'FACULTY' || roleName === 'ADDITIONAL_MEMBERS';
  const isDean = roleName === 'DEAN';
  const isPC = roleName === 'PC';
  const isLeadership = ['DEAN', 'PC', 'INTERNAL_MEMBERS'].includes(roleName);

  const navItems = [
    { 
      id: 'dashboard', 
      path: '/dashboard',
      label: 'Admin Control Center', 
      shortLabel: 'Admin',
      icon: LayoutDashboard, 
      visible: isAdmin,
      badge: 'Admin'
    },
    { 
      id: 'users', 
      path: '/users',
      label: 'User & Role Management', 
      shortLabel: 'Users',
      icon: Users, 
      visible: isAdmin,
      badge: 'Roles'
    },
    { 
      id: 'hod-dashboard', 
      path: '/hod-dashboard',
      label: 'Department Overview', 
      shortLabel: 'Dept',
      icon: Building2, 
      visible: isPC || isDean || isAdmin,
      badge: isPC ? 'PC' : undefined
    },
    { 
      id: 'dean-dashboard', 
      path: '/dean-dashboard',
      label: 'Academic Governance', 
      shortLabel: 'Dean',
      icon: GraduationCap, 
      visible: isDean || isAdmin,
      badge: 'Dean'
    },
    { 
      id: 'faculty-portal', 
      path: '/faculty-portal',
      label: 'My Faculty Portal', 
      shortLabel: 'My Portal',
      icon: UserCheck, 
      visible: true, 
      badge: isFaculty ? 'Personal' : undefined 
    },
    { 
      id: 'substitutions', 
      path: '/substitutions',
      label: 'Substitution Duties', 
      shortLabel: 'Duties',
      icon: Repeat, 
      visible: true 
    },
    { 
      id: 'timetables', 
      path: '/timetables',
      label: 'Timetable Explorer', 
      shortLabel: 'Timetable',
      icon: Calendar, 
      visible: true 
    },
    { 
      id: 'absences', 
      path: '/absences',
      label: 'Absences & Leaves', 
      shortLabel: 'Absences',
      icon: UserX, 
      visible: isAdmin || isLeadership 
    },
    { 
      id: 'faculty', 
      path: '/faculty',
      label: 'Faculty Directory', 
      shortLabel: 'Faculty',
      icon: Users, 
      visible: isAdmin || isLeadership 
    },
    { 
      id: 'reports', 
      path: '/reports',
      label: 'Workload & Analytics', 
      shortLabel: 'Analytics',
      icon: BarChart3, 
      visible: isAdmin || isLeadership 
    },
    { 
      id: 'rules', 
      path: '/rules',
      label: 'System Rules & Limits', 
      shortLabel: 'Rules',
      icon: Sliders, 
      visible: isAdmin 
    },
    { 
      id: 'audit', 
      path: '/audit',
      label: 'Audit Trail & Compliance', 
      shortLabel: 'Audit',
      icon: ShieldCheck, 
      visible: isAdmin || isLeadership 
    },
    { 
      id: 'academic-calendar', 
      path: '/academic-calendar',
      label: 'Academic Calendar', 
      shortLabel: 'Calendar',
      icon: Calendar, 
      visible: true,
      badge: '2026'
    },
    { 
      id: 'ai-assistant', 
      path: '/ai-assistant',
      label: 'Apollo AI Advisor', 
      shortLabel: 'AI Advisor',
      icon: Bot, 
      visible: true, 
      badge: 'AI' 
    },
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200 shrink-0 flex flex-col justify-between hidden md:flex transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      aria-label="Sidebar Navigation"
    >
      <div className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(100vh-160px)]">
        {/* Sidebar Header with Collapse Toggle */}
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          {!isCollapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Workspace ({roleName || 'Faculty'})
            </span>
          )}
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ${
              isCollapsed ? 'mx-auto' : ''
            }`}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/dashboard' && (location.pathname === '/admin' || location.pathname === '/'));
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                title={item.label}
                className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer group relative ${
                  isCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-[#f0f9fb] text-[#2582a1] shadow-xs border border-[#bee3ee] font-bold'
                    : 'text-slate-600 hover:text-[#0e3b4b] hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#2582a1]' : 'text-slate-400 group-hover:text-[#0e3b4b]'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {/* Badge (Expanded mode) */}
                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-[#2582a1] text-white'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Floating Tooltip Hover Label for Collapsed Mode */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-[#0e3b4b] text-white text-xs font-medium rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                    {item.label}
                    {item.badge && <span className="ml-1.5 text-[9px] text-[#fdb931]">({item.badge})</span>}
                  </div>
                )}
              </button>
            );
          })}
      </div>

      {/* Institutional Policy Footer Card */}
      <div className="p-3 border-t border-slate-100">
        {!isCollapsed ? (
          <div className="p-3.5 rounded-xl bg-[#f0f9fb] border border-[#bee3ee]">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#0e3b4b] mb-1">
              <span className="truncate font-bold">The Apollo Policy Rules</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              • Max Weekly Duties: <strong className="text-[#0e3b4b]">4 duties</strong><br />
              • Max Daily Classes: <strong className="text-[#0e3b4b]">2 classes</strong><br />
              • Fairness Score: <strong className="text-emerald-700 font-bold">100%</strong>
            </p>
          </div>
        ) : (
          <div
            className="flex justify-center p-2 rounded-xl bg-[#f0f9fb] border border-[#bee3ee] text-[#2582a1] group relative cursor-pointer"
            title="The Apollo Policy Rules: Max 4 Duties/Wk • Max 2 Daily • 100% Fairness"
          >
            <div className="w-5 h-5 flex items-center justify-center font-bold text-xs">§</div>
            <div className="absolute left-full ml-2 bottom-0 p-3 bg-[#0e3b4b] text-white text-xs font-medium rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
              <p className="font-bold text-[#fdb931] mb-1">The Apollo Policy Rules</p>
              <p className="text-[11px] text-slate-200 leading-tight">• Max 4 duties/week</p>
              <p className="text-[11px] text-slate-200 leading-tight">• Max 2 daily classes</p>
              <p className="text-[11px] text-emerald-300 leading-tight">• 100% Fairness compliance</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
