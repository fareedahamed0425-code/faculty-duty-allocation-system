import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { SubstitutionDuty, TimetableEntry, NotificationItem, ExamDuty, AttendanceStatus } from '../types';
import { Modal } from '../components/common/Modal';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bell,
  BookOpen,
  Sparkles,
  TrendingUp,
  Award,
  UserCheck,
  UserX,
  FileText,
  MapPin,
  Check,
  Plus,
  CalendarDays
} from 'lucide-react';

export const FacultyPortal: React.FC = () => {
  const { user } = useAuth();
  const [duties, setDuties] = useState<SubstitutionDuty[]>([]);
  const [schedule, setSchedule] = useState<TimetableEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [examDuties, setExamDuties] = useState<ExamDuty[]>([]);
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Advance Leave Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [leaveType, setLeaveType] = useState<string>('CASUAL');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState<string | null>(null);

  const today = new Date();
  const todayWeekday = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0=Mon..6=Sun
  const todayDateStr = today.toISOString().split('T')[0];

  const fetchFacultyData = async () => {
    setIsLoading(true);
    try {
      const [dutiesRes, scheduleRes, notifRes, examRes, attRes] = await Promise.all([
        apiClient.get<SubstitutionDuty[]>('/substitutions/duties'),
        apiClient.get<TimetableEntry[]>(`/timetables/active/entries?faculty_id=${user?.faculty_id || ''}`),
        apiClient.get<NotificationItem[]>('/notifications'),
        apiClient.get<ExamDuty[]>('/exam-duties'),
        apiClient.get<AttendanceStatus>('/absences/attendance-status'),
      ]);
      setDuties(dutiesRes.data);
      setSchedule(scheduleRes.data);
      setNotifications(notifRes.data);
      setExamDuties(examRes.data);
      setAttendance(attRes.data);
    } catch (err) {
      console.error('Failed to load faculty portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFacultyData();
  }, [user]);

  const handleToggleAttendance = async (newStatus: 'PRESENT' | 'ABSENT') => {
    try {
      await apiClient.post('/absences/attendance-toggle', {
        status: newStatus,
        reason: newStatus === 'ABSENT' ? 'Marked Absent via Faculty Portal' : undefined
      });
      fetchFacultyData();
    } catch (err) {
      console.error('Failed to toggle attendance:', err);
    }
  };

  const handleApplyAdvanceLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLeave(true);
    setLeaveSuccessMsg(null);

    try {
      const res = await apiClient.post('/absences/advance-leave', {
        from_date: fromDate,
        to_date: toDate,
        leave_type: leaveType,
        reason: leaveReason || 'Personal Leave',
        auto_allocate: true,
      });
      const data = res.data;
      setLeaveSuccessMsg(
        `Leave registered from ${data.from_date} to ${data.to_date}! Identified ${data.affected_classes_count} class(es) for advance duty substitution.`
      );
      setTimeout(() => {
        setIsLeaveModalOpen(false);
        setLeaveSuccessMsg(null);
        setLeaveReason('');
        fetchFacultyData();
      }, 1600);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit leave application.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleAcknowledgeExamDuty = async (dutyId: number) => {
    try {
      await apiClient.patch(`/exam-duties/${dutyId}/acknowledge`);
      setExamDuties(prev => prev.map(d => d.id === dutyId ? { ...d, status: 'ACKNOWLEDGED' } : d));
    } catch (err) {
      console.error('Failed to acknowledge exam duty:', err);
    }
  };

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

  const isPresent = attendance?.status === 'PRESENT';

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Actions */}
      <div className="bg-[#0e3b4b] text-white p-6 sm:p-8 rounded-2xl shadow-md border border-[#165369]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs px-3 py-1 rounded-full bg-[#2582a1] text-white font-bold">
              {user?.department_name || 'Department of Computer Science & Engineering'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-3 tracking-tight">
              Good day, {user?.full_name || 'Professor'}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Welcome to The Apollo University faculty workspace. Manage your daily teaching schedule, attendance, advance leave applications, and exam invigilation duties.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#fdb931] hover:bg-[#e5a523] text-[#0e3b4b] text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-[#0e3b4b]" />
              <span>Apply Advance Leave</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Attendance & Availability Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl ${isPresent ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {isPresent ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Attendance Status</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {attendance?.status || 'PRESENT'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {isPresent 
                ? 'You are active for today’s teaching and substitution duties.' 
                : `Currently on leave (${attendance?.active_leave?.reason || 'Reported Absent'}). All affected classes are compensated.`}
            </p>
          </div>
        </div>

        {/* Quick Toggle Buttons */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => handleToggleAttendance('PRESENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isPresent 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ✓ Mark Present
          </button>
          <button
            onClick={() => handleToggleAttendance('ABSENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !isPresent 
                ? 'bg-rose-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ✕ Mark Absent
          </button>
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

      {/* My Allocated Exam Duties Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#2582a1]" />
              <span>My Exam Duties & Invigilation Schedule</span>
            </h3>
            <p className="text-xs text-slate-500">Scheduled university exam sessions and reporting instructions</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#f0f9fb] text-[#2582a1] border border-[#bee3ee]">
            {examDuties.length} Allotted Duty(s)
          </span>
        </div>

        {examDuties.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
            No upcoming exam invigilation duties allotted to you at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examDuties.map((ed) => {
              const isAck = ed.status === 'ACKNOWLEDGED';
              return (
                <div
                  key={ed.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isAck ? 'bg-white border-slate-200' : 'bg-[#fffdf5] border-[#fde6b3] shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#fdb931] text-[#0e3b4b] uppercase tracking-wider">
                        {ed.role_type}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1.5">{ed.exam_name}</h4>
                      <p className="text-xs text-slate-600 font-medium">{ed.course_code ? `${ed.course_code} • ` : ''}{ed.course_name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAck ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {ed.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Date & Timing</span>
                      <span className="font-semibold text-slate-800">{ed.date}</span>
                      <span className="text-[11px] text-slate-500 block">{ed.exam_start_time} - {ed.exam_end_time}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Venue & Reporting</span>
                      <span className="font-semibold text-rose-700 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{ed.venue}</span>
                      </span>
                      <span className="text-[11px] text-amber-800 font-bold block">Report by: {ed.reporting_time}</span>
                    </div>
                  </div>

                  {ed.instructions && (
                    <p className="text-[11px] text-slate-500 mt-2 italic">Note: {ed.instructions}</p>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Allotted by: {ed.allotted_by}</span>
                    {!isAck ? (
                      <button
                        onClick={() => handleAcknowledgeExamDuty(ed.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Acknowledge Duty</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Acknowledged</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* Notifications Feed */}
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

      {/* Apply Advance Leave Modal */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Apply for Advance Leave"
      >
        {leaveSuccessMsg ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{leaveSuccessMsg}</span>
          </div>
        ) : (
          <form onSubmit={handleApplyAdvanceLeave} className="space-y-4 text-xs">
            <p className="text-slate-500 text-[11px]">
              Submit planned or long leaves in advance. All affected regular classes across your requested date range will be automatically detected and pre-allocated to eligible substitutes.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">From Date (Start)</label>
                <input
                  type="date"
                  value={fromDate}
                  min={todayDateStr}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#2582a1] text-xs"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">To Date (Upto When)</label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#2582a1] text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Leave Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#2582a1] text-xs bg-white"
              >
                <option value="CASUAL">Casual Leave (CL)</option>
                <option value="MEDICAL">Medical Leave (ML)</option>
                <option value="ON_DUTY">On Duty / Academic Deputation (OD)</option>
                <option value="LONG_LEAVE">Long Leave / Sabbatical</option>
                <option value="EMERGENCY">Emergency Leave</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Reason for Leave</label>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Specify purpose (e.g. Attending Conference, Medical Treatment, Personal)..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#2582a1] text-xs"
                required
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingLeave}
                className="px-4 py-2 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingLeave ? <span>Submitting...</span> : <span>Confirm & Apply Leave</span>}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

