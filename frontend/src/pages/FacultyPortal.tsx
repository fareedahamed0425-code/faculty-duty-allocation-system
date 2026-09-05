import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { SubstitutionDuty, TimetableEntry, NotificationItem } from '../types';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bell,
  BookOpen,
  Sparkles,
  TrendingUp,
  Award
} from 'lucide-react';

export const FacultyPortal: React.FC = () => {
  const { user } = useAuth();
  const [duties, setDuties] = useState<SubstitutionDuty[]>([]);
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const today = new Date();
  const todayWeekday = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0=Mon..6=Sun
  const todayDateStr = today.toISOString().split('T')[0];

  const fetchFacultyData = async () => {
    setIsLoading(true);
    try {
      const [dutiesRes, scheduleRes, notifRes] = await Promise.all([
        apiClient.get<SubstitutionDuty[]>('/substitutions/duties'),
        apiClient.get<TimetableEntry[]>(`/timetables/active/entries?faculty_id=${user?.faculty_id || ''}`),
        apiClient.get<NotificationItem[]>('/notifications'),
      ]);
      setDuties(dutiesRes.data);
      setSchedule(scheduleRes.data);
      setNotifications(notifRes.data);
    } catch (err) {
      console.error('Failed to load faculty portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyData();
  }, [user]);

  // Today's regular classes
  const todayRegularClasses = schedule.filter((s) => s.day_of_week === todayWeekday);

  // Today's substitutions assigned to me
  const todaySubstitutions = duties.filter(
    (d) => d.date === todayDateStr && (d.assigned_faculty_id === user?.faculty_id || !user?.faculty_id)
  );

  // My substitutions this week count
  const myWeeklySubstitutionsCount = duties.filter(
    (d) => d.assigned_faculty_id === user?.faculty_id
  ).length;

  const maxLimit = 4;
  const progressPct = Math.min((myWeeklySubstitutionsCount / maxLimit) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-[#0e3b4b] text-white p-6 sm:p-8 rounded-2xl shadow-md border border-[#165369]">
        <div>
          <span className="text-xs px-3 py-1 rounded-full bg-[#2582a1] text-white font-bold">
            {user?.department_name || 'Department of Computer Science & Engineering'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-3 tracking-tight">
            Good day, {user?.full_name || 'Professor'}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Welcome to The Apollo University faculty workspace. View your daily teaching schedule, active substitution commitments, and weekly workload balance.
          </p>
        </div>
      </div>

      {/* Primary Status Cards: Weekly Duty Progress & Today's Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Weekly Substitution Gauge Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-subtle sm:col-span-1">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Substitutions This Week</span>
            <Award className="w-5 h-5 text-brand-600" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold text-slate-900">{myWeeklySubstitutionsCount}</span>
            <span className="text-lg font-bold text-slate-400">/ {maxLimit} max duties</span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-1.5">
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  myWeeklySubstitutionsCount >= 4
                    ? 'bg-rose-500'
                    : myWeeklySubstitutionsCount === 3
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>{maxLimit - myWeeklySubstitutionsCount} remaining slots</span>
              <span>Mon – Sun cycle</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100">
            {myWeeklySubstitutionsCount >= 4
              ? '🚫 You have reached the maximum weekly limit. No additional duties will be automatically allocated.'
              : '✓ You are in good standing within institutional fairness constraints.'}
          </p>
        </div>

        {/* Today's Regular Classes Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-subtle sm:col-span-1">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Regular Classes</span>
            <BookOpen className="w-5 h-5 text-brand-600" />
          </div>
          <p className="text-4xl font-extrabold text-slate-900">{todayRegularClasses.length}</p>
          <p className="text-xs text-slate-500 mt-1">Scheduled in master timetable</p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Rule 2 Status: <strong>{todayRegularClasses.length >= 3 ? '3+ Classes (Duty Ineligible Today)' : 'Eligible for Substitutions'}</strong>
          </div>
        </div>

        {/* Today's Assigned Substitutions Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-subtle sm:col-span-1">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Substitutions</span>
            <Clock className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-4xl font-extrabold text-emerald-700">{todaySubstitutions.length}</p>
          <p className="text-xs text-slate-500 mt-1">Covering for absent colleagues</p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-medium">
            {todaySubstitutions.length > 0 ? 'Upcoming duty scheduled today' : 'No substitution classes scheduled today'}
          </div>
        </div>
      </div>

      {/* Combined Today's Timeline (Regular Classes + Substitutions) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-subtle">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Today's Integrated Teaching Timeline</h3>

        {todayRegularClasses.length === 0 && todaySubstitutions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No regular classes or substitution duties scheduled for today.
          </div>
        ) : (
          <div className="space-y-3">
            {todayRegularClasses.map((reg) => (
              <div
                key={`reg-${reg.id}`}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-2.5 h-10 rounded-full bg-brand-500" />
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">{reg.class_name} • {reg.subject_code}</span>
                    <span className="text-slate-500 text-[11px]">{reg.subject_name} • {reg.room_number}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800 text-sm block">{reg.start_time} - {reg.end_time}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 font-semibold">
                    Regular Class
                  </span>
                </div>
              </div>
            ))}

            {todaySubstitutions.map((sub) => (
              <div
                key={`sub-${sub.id}`}
                className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center justify-between text-xs hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-2.5 h-10 rounded-full bg-emerald-600" />
                  <div>
                    <span className="font-bold text-emerald-900 text-sm block">{sub.class_name} • {sub.subject_name}</span>
                    <span className="text-emerald-800 text-[11px]">
                      Substituting for <strong>{sub.original_faculty_name}</strong>
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-900 text-sm block">{sub.period_start} - {sub.period_end}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-extrabold">
                    Substitution Duty
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifications & Announcements Feed */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-subtle">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
          <Bell className="w-4 h-4 text-slate-400" />
          <span>My Duty Notifications</span>
        </h3>

        {notifications.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No notifications yet.</p>
        ) : (
          <div className="space-y-2.5">
            {notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-slate-900 block">{n.title}</span>
                  <p className="text-slate-600 mt-0.5">{n.message}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {new Date(n.created_at).toLocaleDateString()} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
