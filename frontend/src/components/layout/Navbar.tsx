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
  PanelLeftOpen,
  MapPin,
  Clock,
  ClipboardList,
  Check,
  Building,
  UserCheck,
  AlertCircle
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
  const [acknowledgedDuties, setAcknowledgedDuties] = useState<Record<number, boolean>>({});

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
          title: '📋 Exam Duty Allotted',
          message: 'Mid-Term Examination 2026. Reporting: 08:30 AM | Venue: Exam Hall B-204',
          notification_type: 'EXAM_DUTY_ALLOCATED',
          is_read: false,
          metadata_json: {
            duty_id: 1,
            exam_name: 'Mid-Term Examination 2026',
            course_name: 'CS301 - Operating Systems',
            reporting_time: '08:30 AM',
            exam_start_time: '09:00 AM',
            exam_end_time: '12:00 PM',
            venue: 'Exam Hall B-204',
            role_type: 'Room Invigilator'
          },
          created_at: new Date().toISOString(),
        }
      ]);
      setUnreadCount(1);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 12000);
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

  const markSingleAsRead = async (id: number) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch {
      // ignore
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleAcknowledgeExamDuty = async (dutyId: number, notifId: number) => {
    try {
      await apiClient.patch(`/exam-duties/${dutyId}/acknowledge`);
      setAcknowledgedDuties(prev => ({ ...prev, [dutyId]: true }));
      markSingleAsRead(notifId);
    } catch (err) {
      console.error('Failed to acknowledge exam duty:', err);
    }
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
      case 'PC':
        return 'bg-amber-100 text-amber-900 border-amber-200';
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

            {/* Notification Bell & Rich Shade */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-[#fdb931] text-[#0e3b4b] text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center border border-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Rich Notification Shade / Drawer */}
              {showNotifDropdown && (
                <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:right-0 sm:absolute sm:mt-2 w-auto sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 pb-2.5 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-[#0e3b4b]">Duty Notification Shade</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fdb931] text-[#0e3b4b] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-[#2582a1] hover:text-[#165369] font-semibold cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No notifications yet. You're all caught up!
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const meta = n.metadata_json || {};
                        const isExam = n.notification_type === 'EXAM_DUTY_ALLOCATED';
                        const isSub = n.notification_type === 'SUBSTITUTION_ASSIGNED';
                        const dutyId = meta.duty_id;
                        const isAcknowledged = dutyId ? acknowledgedDuties[dutyId] : false;

                        if (isExam) {
                          return (
                            <div
                              key={n.id}
                              onClick={() => !n.is_read && markSingleAsRead(n.id)}
                              className={`p-3.5 rounded-xl border transition-all ${
                                !n.is_read 
                                  ? 'bg-[#fffdf5] border-[#fde6b3] shadow-xs' 
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#fdb931] text-[#0e3b4b] font-bold uppercase tracking-wider">
                                    Exam Duty
                                  </span>
                                  {meta.role_type && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                                      {meta.role_type}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <p className="font-bold text-slate-900 text-xs mt-2">
                                {meta.exam_name || n.title}
                              </p>
                              {meta.course_name && (
                                <p className="text-[11px] text-slate-600 font-medium">{meta.course_name}</p>
                              )}

                              {/* Rich Metrics: Reporting Time & Venue */}
                              <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <div className="flex items-center space-x-1.5 text-amber-900 font-semibold">
                                  <Clock className="w-3.5 h-3.5 text-[#b37d10] shrink-0" />
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Reporting</span>
                                    <span>{meta.reporting_time || '08:30 AM'}</span>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1.5 text-slate-800 font-semibold">
                                  <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <div>
                                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Venue / Hall</span>
                                    <span className="truncate block max-w-[120px]">{meta.venue || 'Exam Hall B-204'}</span>
                                  </div>
                                </div>
                              </div>

                              {meta.exam_start_time && (
                                <p className="text-[10px] text-slate-500 mt-1.5">
                                  Exam Timing: <strong>{meta.exam_start_time} - {meta.exam_end_time}</strong>
                                </p>
                              )}

                              {/* Interactive Acknowledge Action Button */}
                              {dutyId && (
                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-end">
                                  {isAcknowledged ? (
                                    <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                      <Check className="w-3 h-3" />
                                      <span>Duty Acknowledged</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAcknowledgeExamDuty(dutyId, n.id);
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-[#0e3b4b] hover:bg-[#165369] text-white text-[11px] font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Acknowledge Duty</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Default / Substitution / General Card
                        return (
                          <div
                            key={n.id}
                            onClick={() => !n.is_read && markSingleAsRead(n.id)}
                            className={`p-3 rounded-xl border text-xs transition-colors ${
                              !n.is_read ? 'bg-[#f0f9fb] border-[#bee3ee]' : 'bg-white border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start space-x-2.5">
                              <CheckCircle2 className="w-4 h-4 text-[#2582a1] shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-semibold text-slate-900">{n.title}</p>
                                <p className="text-slate-600 mt-0.5 text-[11px]">{n.message}</p>
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
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
