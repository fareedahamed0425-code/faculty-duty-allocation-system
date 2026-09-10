import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { DashboardStats, SubstitutionRequirement, Faculty, CheckDateResult, User } from '../types';
import { StatCard } from '../components/common/StatCard';
import { Modal } from '../components/common/Modal';
import { AllocationReasoningModal } from '../components/allocation/AllocationReasoningModal';
import { ExamTimetableUploadWizard } from '../components/exam/ExamTimetableUploadWizard';
import {
  Users,
  UserX,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Play,
  Sparkles,
  FileText,
  Calendar,
  Clock,
  MapPin,
  CalendarDays,
  ShieldCheck,
  Building2,
  Mail,
  UserPlus,
  Upload,
  FileSpreadsheet
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate?: (tab: string) => void;
  onOpenAI?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onOpenAI }) => {
  const navigate = useNavigate();
  const handleNav = (target: string) => {
    if (onNavigate) {
      onNavigate(target);
    } else {
      navigate(target.startsWith('/') ? target : `/${target}`);
    }
  };
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDuties, setRecentDuties] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quick Absence / Advance Leave Modal State
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | ''>('');
  const [absenceDate, setAbsenceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [absenceEndDate, setAbsenceEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [leaveType, setLeaveType] = useState<string>('CASUAL');
  const [absenceReason, setAbsenceReason] = useState<string>('');
  const [autoAllocate, setAutoAllocate] = useState<boolean>(true);
  const [isSubmittingAbsence, setIsSubmittingAbsence] = useState(false);
  const [absenceSuccessMsg, setAbsenceSuccessMsg] = useState<string | null>(null);

  // Exam Duty Modal State
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isBatchExamModalOpen, setIsBatchExamModalOpen] = useState(false);
  const [examAllocationMode, setExamAllocationMode] = useState<'dynamic' | 'manual'>('dynamic');
  const [examFacultyId, setExamFacultyId] = useState<number | ''>('');
  const [requiredInvigilators, setRequiredInvigilators] = useState<number>(1);
  const [examDeptId, setExamDeptId] = useState<number | ''>('');
  const [strictTimetableCheck, setStrictTimetableCheck] = useState<boolean>(true);
  const [examName, setExamName] = useState('Mid-Term Examination 2026');
  const [courseName, setCourseName] = useState('CS301 - Operating Systems');
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportingTime, setReportingTime] = useState('08:30 AM');
  const [examStartTime, setExamStartTime] = useState('09:00 AM');
  const [examEndTime, setExamEndTime] = useState('12:00 PM');
  const [examVenue, setExamVenue] = useState('Exam Hall B-204');
  const [examRole, setExamRole] = useState('Room Invigilator');
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);
  const [examSuccessMsg, setExamSuccessMsg] = useState<string | null>(null);
  const [dynamicResult, setDynamicResult] = useState<any | null>(null);

  // Calendar Check for selected date
  const [dateCheck, setDateCheck] = useState<CheckDateResult | null>(null);

  // Reasoning Modal
  const [selectedDutyId, setSelectedDutyId] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, dutiesRes, facRes, usersRes] = await Promise.all([
        apiClient.get<DashboardStats>('/reports/dashboard'),
        apiClient.get<any[]>('/substitutions/duties'),
        apiClient.get<Faculty[]>('/faculty'),
        apiClient.get<User[]>('/auth/users'),
      ]);
      setStats(statsRes.data);
      setRecentDuties(dutiesRes.data.slice(0, 6));
      setFacultyList(facRes.data);
      setUserList(usersRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkSelectedDate = async (dateStr: string) => {
    try {
      const res = await apiClient.get<CheckDateResult>(`/academic-calendar/check-date?target_date=${dateStr}`);
      setDateCheck(res.data);
    } catch {
      setDateCheck(null);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    checkSelectedDate(absenceDate);
  }, []);

  const handleRecordAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyId) return;

    setIsSubmittingAbsence(true);
    setAbsenceSuccessMsg(null);

    try {
      const res = await apiClient.post('/absences', {
        faculty_id: Number(selectedFacultyId),
        date: absenceDate,
        end_date: absenceEndDate >= absenceDate ? absenceEndDate : undefined,
        leave_type: leaveType,
        reason: absenceReason || 'Reported via Dashboard',
        auto_allocate: autoAllocate,
      });
      const data = res.data;
      setAbsenceSuccessMsg(
        `Absence recorded from ${data.from_date || data.date} to ${data.to_date || data.date}! Discovered ${data.affected_classes_count} affected class(es). ${
          autoAllocate ? `Auto-allocated ${data.allocation_results?.filter((r: any) => r.status === 'ALLOCATED').length || 0} substitute(s).` : ''
        }`
      );
      setTimeout(() => {
        setIsAbsenceModalOpen(false);
        setAbsenceSuccessMsg(null);
        setSelectedFacultyId('');
        setAbsenceReason('');
        fetchDashboardData();
      }, 1500);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record absence.');
    } finally {
      setIsSubmittingAbsence(false);
    }
  };

  const handleAllocateExamDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examFacultyId) return;

    setIsSubmittingExam(true);
    setExamSuccessMsg(null);

    try {
      await apiClient.post('/exam-duties', {
        assigned_faculty_id: Number(examFacultyId),
        exam_name: examName,
        course_name: courseName,
        date: examDate,
        reporting_time: reportingTime,
        exam_start_time: examStartTime,
        exam_end_time: examEndTime,
        venue: examVenue,
        role_type: examRole,
        target_roles: ["FACULTY", "DEAN", "PC"]
      });
      setExamSuccessMsg('Exam duty allotted! Notification sent directly to faculty shade.');
      setTimeout(() => {
        setIsExamModalOpen(false);
        setExamSuccessMsg(null);
        fetchDashboardData();
      }, 1500);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to allocate exam duty.');
    } finally {
      setIsSubmittingExam(false);
    }
  };

  const handleBatchAutoAllocate = async () => {
    try {
      await apiClient.post('/substitutions/requirements/batch-allocate', { requirement_ids: [] });
      fetchDashboardData();
    } catch (err) {
      console.error('Batch allocate failed:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] tracking-tight">
              Institutional Operations Center
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              Live Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time timetable monitoring, advance absence allocation, academic calendar sync, and exam duty orchestration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleNav('users')}
            className="px-3.5 py-2.5 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#fdb931]" />
            <span>Manage Users & Roles</span>
          </button>
          <button
            onClick={() => handleNav('academic-calendar')}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <CalendarDays className="w-4 h-4 text-[#2582a1]" />
            <span>Academic Calendar</span>
          </button>
          <button
            onClick={() => setIsExamModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-[#fdb931] hover:bg-[#e5a523] text-[#0e3b4b] text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#0e3b4b]" />
            <span>Allocate Exam Duty</span>
          </button>
          <button
            onClick={() => setIsBatchExamModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Upload Exam Timetable</span>
          </button>
          <button
            onClick={() => setIsAbsenceModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Absence / Leave</span>
          </button>
          <button
            onClick={handleBatchAutoAllocate}
            className="px-3.5 py-2.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Auto-Allocate</span>
          </button>
        </div>
      </div>

      {/* System Alerts */}
      {stats?.system_alerts && stats.system_alerts.length > 0 && (
        <div className="space-y-2">
          {stats.system_alerts.map((alert, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                alert.type === 'ERROR'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-bold mr-1">{alert.title}:</span>
                  <span>{alert.message}</span>
                </div>
              </div>
              <button
                onClick={() => handleNav('substitutions')}
                className="font-bold underline hover:no-underline text-xs cursor-pointer"
              >
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Faculty"
          value={stats ? `${stats.active_faculty} / ${stats.total_faculty}` : '--'}
          subtitle="Monitored in timetable"
          icon={Users}
          variant="blue"
          onClick={() => handleNav('faculty')}
        />
        <StatCard
          title="Today's Absences"
          value={stats ? stats.today_absences_count : '--'}
          subtitle={`${stats?.today_affected_classes_count || 0} affected classes`}
          icon={UserX}
          variant="rose"
          onClick={() => handleNav('absences')}
        />
        <StatCard
          title="Allocated Substitutions"
          value={stats ? stats.today_allocated_count : '--'}
          subtitle="100% compliant with Rules 1–7"
          icon={CheckCircle2}
          variant="emerald"
          onClick={() => handleNav('substitutions')}
        />
        <StatCard
          title="Unallocated Classes"
          value={stats ? stats.today_unallocated_count : '--'}
          subtitle="Requires attention"
          icon={AlertCircle}
          variant={stats?.today_unallocated_count ? 'rose' : 'slate'}
          onClick={() => handleNav('substitutions')}
        />
      </div>

      {/* Grid: Duty Distribution Card & Recent Activity Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Substitution Distribution Chart (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#0e3b4b]">Weekly Workload Distribution</h3>
                <p className="text-xs text-slate-500">Current substitution counts (0–4 duties)</p>
              </div>
              <span className="text-[10px] font-bold text-[#2582a1] bg-[#f0f9fb] px-2.5 py-1 rounded-full border border-[#bee3ee]">
                Rule 7 Priority
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {[
                { label: '0 substitutions (Priority)', count: stats?.duty_distribution['0'] || 0, color: 'bg-emerald-500', barBg: 'bg-emerald-100' },
                { label: '1 substitution', count: stats?.duty_distribution['1'] || 0, color: 'bg-teal-500', barBg: 'bg-teal-100' },
                { label: '2 substitutions', count: stats?.duty_distribution['2'] || 0, color: 'bg-[#2582a1]', barBg: 'bg-[#bee3ee]' },
                { label: '3 substitutions (Approaching)', count: stats?.duty_distribution['3'] || 0, color: 'bg-[#fdb931]', barBg: 'bg-[#fde6b3]' },
                { label: '4 substitutions (At Limit)', count: stats?.duty_distribution['4+'] || 0, color: 'bg-rose-500', barBg: 'bg-rose-100' },
              ].map((item, idx) => {
                const total = stats?.active_faculty || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-bold text-slate-900">{item.count} faculty ({pct}%)</span>
                    </div>
                    <div className={`h-2 rounded-full ${item.barBg} overflow-hidden`}>
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 p-3 bg-[#f0f9fb] rounded-xl border border-[#bee3ee] text-[11px] text-slate-700">
            💡 <strong>Deterministic Fairness:</strong> The engine prioritizes faculty with 0 duties before assigning faculty with 1 or 2 duties.
          </div>
        </div>

        {/* Live Substitution Activity (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0e3b4b]">Live Substitution Activity</h3>
              <p className="text-xs text-slate-500">Recent automatic and manual duty allocations</p>
            </div>
            <button
              onClick={() => handleNav('substitutions')}
              className="text-xs font-bold text-[#2582a1] hover:text-[#165369] cursor-pointer"
            >
              View All Duties →
            </button>
          </div>

          {recentDuties.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No substitution duties allocated yet this week.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Class & Subject</th>
                    <th className="pb-3">Time Period</th>
                    <th className="pb-3">Original Faculty</th>
                    <th className="pb-3">Substitute</th>
                    <th className="pb-3 text-right">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentDuties.map((duty) => (
                    <tr key={duty.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3">
                        <span className="font-bold text-slate-900 block">{duty.class_name}</span>
                        <span className="text-slate-500 text-[11px]">{duty.subject_name}</span>
                      </td>
                      <td className="py-3">
                        <span className="font-medium text-slate-700">{duty.period_start} - {duty.period_end}</span>
                        <span className="text-slate-400 text-[10px] block">{duty.date}</span>
                      </td>
                      <td className="py-3 text-slate-600">{duty.original_faculty_name}</td>
                      <td className="py-3">
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {duty.assigned_faculty_name}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Weekly: {duty.weekly_count_at_assignment}/4
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setSelectedDutyId(duty.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#f0f9fb] hover:text-[#2582a1] text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Why Selected
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Institutional User Registry & Role Governance Overview */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-[#0e3b4b]">Institutional User Registry & Role Governance</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0f9fb] text-[#2582a1] border border-[#bee3ee]">
                {userList.length} Active Accounts
              </span>
            </div>
            <p className="text-xs text-slate-500">Live directory of institutional leadership, coordinators, and teaching faculty</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleNav('users')}
              className="px-3.5 py-1.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Manage All Roles & Permissions →</span>
            </button>
          </div>
        </div>

        {userList.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No registered users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="pb-3">User & Email</th>
                  <th className="pb-3">Department & Designation</th>
                  <th className="pb-3">Current Role</th>
                  <th className="pb-3">Faculty Code</th>
                  <th className="pb-3">Rule 4 Duty Status</th>
                  <th className="pb-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userList.slice(0, 7).map((u) => {
                  const roleName = u.role?.name || 'FACULTY';
                  const roleBadgeClass =
                    roleName === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : roleName === 'DEAN'
                      ? 'bg-amber-100 text-amber-900 border-amber-200'
                      : roleName === 'HOD'
                      ? 'bg-cyan-100 text-cyan-900 border-cyan-200'
                      : roleName === 'PC'
                      ? 'bg-blue-100 text-blue-900 border-blue-200'
                      : roleName === 'COMMITTEE_MEMBER'
                      ? 'bg-indigo-100 text-indigo-900 border-indigo-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#0e3b4b] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                            {u.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{u.full_name}</span>
                            <span className="text-slate-400 text-[11px] font-mono flex items-center">
                              <Mail className="w-2.5 h-2.5 mr-1" />
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="font-semibold text-slate-800 block">
                          {u.department_name || 'General Administration'}
                        </span>
                        <span className="text-slate-500 text-[11px]">{u.designation || 'Academic Staff'}</span>
                      </td>
                      <td className="py-3">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${roleBadgeClass}`}>
                          {roleName}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[11px] text-slate-600">
                        {u.faculty_code || 'N/A'}
                      </td>
                      <td className="py-3">
                        {u.is_exempt ? (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            🛡️ Exempt
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            ✓ Substitution Eligible
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleNav('users')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#f0f9fb] hover:text-[#2582a1] text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Absence Modal */}
      <Modal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        title="Record Faculty Absence"
        subtitle="The engine will automatically detect all affected classes and assign substitutes."
        maxWidth="md"
      >
        <form onSubmit={handleRecordAbsence} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Faculty Member
            </label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(Number(e.target.value) || '')}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
              required
            >
              <option value="">-- Select Faculty --</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.faculty_id}) - {f.department_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                From Date (Start)
              </label>
              <input
                type="date"
                value={absenceDate}
                onChange={(e) => {
                  setAbsenceDate(e.target.value);
                  checkSelectedDate(e.target.value);
                }}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                To Date (Upto When)
              </label>
              <input
                type="date"
                value={absenceEndDate}
                min={absenceDate}
                onChange={(e) => setAbsenceEndDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Academic Calendar Badge & Warning */}
          {dateCheck && (
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              dateCheck.is_holiday 
                ? 'bg-amber-50 border-amber-200 text-amber-900' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <span className="font-bold block">
                    {dateCheck.day_name}, {dateCheck.date}
                  </span>
                  <span className="text-[11px]">
                    {dateCheck.is_second_saturday 
                      ? '⚠️ Institutional Non-Working Day (Second Saturday)'
                      : dateCheck.is_sunday
                      ? '⚠️ Weekly Off (Sunday)'
                      : dateCheck.holiday_name
                      ? `🎉 Holiday: ${dateCheck.holiday_name}`
                      : '✓ Regular Academic Working Day'}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                dateCheck.is_working_day ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {dateCheck.is_working_day ? 'Working Day' : 'Holiday / Off'}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Leave Type
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
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
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Reason (Optional)
            </label>
            <input
              type="text"
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              placeholder="e.g. Attending Conference, Medical Leave"
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
            />
          </div>

          <div className="p-3 bg-[#f0f9fb] rounded-xl border border-[#bee3ee] text-xs">
            <label className="flex items-center space-x-2 font-bold text-[#0e3b4b] cursor-pointer">
              <input
                type="checkbox"
                checked={autoAllocate}
                onChange={(e) => setAutoAllocate(e.target.checked)}
                className="rounded text-[#2582a1] focus:ring-[#2582a1]"
              />
              <span>Automatically solve and allocate substitute faculty immediately</span>
            </label>
          </div>

          {absenceSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
              {absenceSuccessMsg}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAbsenceModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAbsence}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {isSubmittingAbsence ? 'Processing Engine...' : 'Record & Process'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Allocate Exam Duty Modal */}
      <Modal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        title="Dynamic Exam Duty & Invigilation Center"
        subtitle="Dynamically balance exam invigilation across faculty or perform specific manual assignments with unified notifications."
        maxWidth="2xl"
      >
        <form onSubmit={handleAllocateExamDuty} className="space-y-4">
          {/* Mode Selector Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setExamAllocationMode('dynamic')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                examAllocationMode === 'dynamic'
                  ? 'bg-white text-[#0e3b4b] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚡ Dynamic Smart Allocation (Auto-Balance)
            </button>
            <button
              type="button"
              onClick={() => setExamAllocationMode('manual')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                examAllocationMode === 'manual'
                  ? 'bg-white text-[#0e3b4b] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              👤 Manual Faculty Assignment
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Examination Title
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g. Mid-Term Examination 2026"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Course / Subject Name
              </label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g. CS301 - Operating Systems"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Exam Date
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 text-amber-800">
                Reporting Time
              </label>
              <input
                type="text"
                value={reportingTime}
                onChange={(e) => setReportingTime(e.target.value)}
                placeholder="e.g. 08:30 AM"
                className="w-full text-xs rounded-xl border border-amber-300 p-2.5 bg-amber-50/50 text-amber-950 font-bold focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Exam Duration
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={examStartTime}
                  onChange={(e) => setExamStartTime(e.target.value)}
                  placeholder="09:00 AM"
                  className="w-1/2 text-xs rounded-xl border border-slate-300 p-2 bg-white text-center focus:ring-2 focus:ring-[#2582a1]"
                  required
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="text"
                  value={examEndTime}
                  onChange={(e) => setExamEndTime(e.target.value)}
                  placeholder="12:00 PM"
                  className="w-1/2 text-xs rounded-xl border border-slate-300 p-2 bg-white text-center focus:ring-2 focus:ring-[#2582a1]"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Venue / Hall / Room
              </label>
              <input
                type="text"
                value={examVenue}
                onChange={(e) => setExamVenue(e.target.value)}
                placeholder="e.g. Exam Hall B-204, Block-3"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Invigilator Role Type
              </label>
              <select
                value={examRole}
                onChange={(e) => setExamRole(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
              >
                <option value="Room Invigilator">Room Invigilator</option>
                <option value="Chief Superintendent">Chief Superintendent</option>
                <option value="Hall Supervisor">Hall Supervisor</option>
                <option value="Flying Squad Member">Flying Squad Member</option>
                <option value="Reliever Invigilator">Reliever Invigilator</option>
              </select>
            </div>
          </div>

          {examAllocationMode === 'dynamic' ? (
            <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-sky-900 uppercase tracking-wider mb-1">
                    Invigilators Required Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={requiredInvigilators}
                    onChange={(e) => setRequiredInvigilators(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-xs rounded-xl border border-sky-300 p-2.5 bg-white text-sky-950 font-bold focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-sky-900 uppercase tracking-wider mb-1">
                    Department Filter (Optional)
                  </label>
                  <select
                    value={examDeptId}
                    onChange={(e) => setExamDeptId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full text-xs rounded-xl border border-sky-300 p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-sky-500 font-medium"
                  >
                    <option value="">All Departments</option>
                    <option value="1">Computer Science & Engineering</option>
                    <option value="2">Electronics & Communication</option>
                    <option value="3">Mechanical Engineering</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="strict-tt-check"
                  checked={strictTimetableCheck}
                  onChange={(e) => setStrictTimetableCheck(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="strict-tt-check" className="text-xs text-sky-900 font-semibold cursor-pointer">
                  Auto-exclude faculty with regular timetable classes during exam slot
                </label>
              </div>

              <p className="text-[11px] text-sky-700 italic">
                * Dynamic engine evaluates: Absence/Leave records, Exam overlaps, Timetable collisions, and prioritizes faculty with the lowest cumulative duty count for fair balancing.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Assign Faculty Member (Faculty / Dean / PC / Member)
              </label>
              <select
                value={examFacultyId}
                onChange={(e) => setExamFacultyId(Number(e.target.value) || '')}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
                required={examAllocationMode === 'manual'}
              >
                <option value="">-- Choose Faculty Invigilator --</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.faculty_id}) - {f.designation} [{f.department_name}]
                  </option>
                ))}
              </select>
            </div>
          )}

          {examSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
              {examSuccessMsg}
            </div>
          )}

          {dynamicResult && dynamicResult.evaluations && dynamicResult.evaluations.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto space-y-1 text-xs">
              <span className="font-bold text-slate-800 block mb-1">Candidate Evaluation Breakdown:</span>
              {dynamicResult.evaluations.map((ev: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0 text-[11px]">
                  <span className="font-semibold text-slate-800">{ev.faculty_name} ({ev.faculty_code}):</span>
                  <span className={
                    ev.status === 'SELECTED' ? 'text-emerald-700 font-bold' :
                    ev.status === 'AVAILABLE' ? 'text-blue-600' : 'text-rose-600'
                  }>
                    {ev.status === 'SELECTED' ? '✓ Allocated' : ev.reason}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsExamModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmittingExam}
              className="px-5 py-2 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {isSubmittingExam
                ? 'Processing Allocation...'
                : examAllocationMode === 'dynamic'
                ? `⚡ Dynamically Allocate (${requiredInvigilators} Invigilators)`
                : 'Confirm & Dispatch Duty'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Allocation Reasoning Modal */}
      <AllocationReasoningModal
        dutyId={selectedDutyId}
        isOpen={selectedDutyId !== null}
        onClose={() => setSelectedDutyId(null)}
      />

      {/* Batch Exam Timetable Import Modal */}
      <ExamTimetableUploadWizard
        isOpen={isBatchExamModalOpen}
        onClose={() => setIsBatchExamModalOpen(false)}
        onSuccess={() => fetchDashboardData()}
      />
    </div>
  );
};

