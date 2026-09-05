import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Bell, 
  Sparkles, 
  LogOut, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Menu,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { NotificationItem } from '../../types';

interface NavbarProps {
  onOpenAI: () => void;
  onOpenMenu: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAI,
  onOpenMenu,
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get<NotificationItem[]>('/notifications');
      setNotifications(res.data);
      setUnreadCount(res.data.filter(n => !n.is_read).length);
    } catch {
      setNotifications([
        {
          id: 1,
          user_id: user?.id || 1,
          title: 'Timetable Active',
          message: 'Academic Year 2026 Semester 2 Timetable has been synchronized.',
          notification_type: 'SYSTEM',
          is_read: false,
          metadata_json: {},
          created_at: new Date().toISOString(),
        }
      ]);
      setUnreadCount(1);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const markAllAsRead = async () => {
    try {
      await apiClient.patch('/notifications/read-all');
    } catch {
      // ignore
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const getRoleBadgeStyle = (roleName?: string) => {
    switch (roleName) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'HOD':
        return 'bg-[#dcf1f6] text-[#165369] border-[#bee3ee]';
      case 'DEAN':
        return 'bg-[#fff8eb] text-[#b37d10] border-[#fde6b3]';
      case 'FACULTY':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Left: Mobile Menu Trigger + Desktop Sidebar Toggle + Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Mobile Drawer Trigger */}
            <button
              onClick={onOpenMenu}
              aria-label="Open Navigation Menu"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors md:hidden focus:outline-hidden focus:ring-2 focus:ring-[#2582a1] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Sidebar Collapse Toggle */}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden md:flex p-2 rounded-lg text-slate-500 hover:text-[#0e3b4b] hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5" />
                ) : (
                  <PanelLeftClose className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Apollo Logo & Brand Header */}
            <div className="flex items-center space-x-2.5">
              <img
                src="/apollo_logo.svg"
                alt="The Apollo University"
                className="h-9 sm:h-10 w-auto object-contain shrink-0"
              />
              <div className="border-l border-slate-200 pl-2.5">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="font-bold text-[#0e3b4b] tracking-tight text-sm sm:text-base lg:text-lg whitespace-nowrap">
                    The Apollo University
                  </span>
                  <span className="hidden xs:inline-block text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-[#f0f9fb] text-[#2582a1] font-bold border border-[#bee3ee] uppercase tracking-wider">
                    2026
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium hidden md:block truncate">
                  Faculty Substitution & Duty Allocation System
                </p>
              </div>
            </div>
          </div>

          {/* Right actions: AI button, Date, Notifications, User */}
          <div className="flex items-center space-x-1.5 sm:space-x-3">
            {/* AI Assistant Launch Button */}
            <button
              onClick={onOpenAI}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#fdb931]" />
              <span className="hidden sm:inline">AI Advisor</span>
            </button>

            {/* Date Display (Desktop) */}
            <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>{todayStr}</span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-[#fdb931] text-[#0e3b4b] text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center border border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Responsive Notification Dropdown */}
              {showNotifDropdown && (
                <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:right-0 sm:absolute sm:mt-2 w-auto sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                    <span className="font-semibold text-sm text-[#0e3b4b]">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-[#2582a1] hover:text-[#165369] font-semibold cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No notifications yet. You're all caught up!
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 text-xs hover:bg-slate-50 transition-colors ${
                            !n.is_read ? 'bg-[#f0f9fb]' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-2.5">
                            <CheckCircle2 className="w-4 h-4 text-[#2582a1] shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-semibold text-slate-800">{n.title}</p>
                              <p className="text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                              <span className="text-[10px] text-slate-400 mt-1 block">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar / Name / Role & Logout */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
              <div 
                onClick={onOpenMenu}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0e3b4b] text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-xs cursor-pointer md:cursor-default"
                title={`${user?.full_name} (${user?.role?.name})`}
              >
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-[#0e3b4b] leading-tight max-w-[120px] truncate">
                  {user?.full_name || 'User'}
                </p>
                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${getRoleBadgeStyle(user?.role?.name)}`}>
                  {user?.role?.name || 'FACULTY'}
                </span>
              </div>
              <button
                onClick={logout}
                title="Sign Out"
                className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-rose-600 rounded-xl hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden lg:inline font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
