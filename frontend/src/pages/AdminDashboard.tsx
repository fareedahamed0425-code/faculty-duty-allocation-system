import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { DashboardStats, SubstitutionRequirement, Faculty } from '../types';
import { StatCard } from '../components/common/StatCard';
import { Modal } from '../components/common/Modal';
import { AllocationReasoningModal } from '../components/allocation/AllocationReasoningModal';
import {
  Users,
  UserX,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Play,
  Sparkles
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenAI: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onOpenAI }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDuties, setRecentDuties] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quick Absence Modal State
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | ''>('');
  const [absenceDate, setAbsenceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [absenceReason, setAbsenceReason] = useState<string>('');
  const [autoAllocate, setAutoAllocate] = useState<boolean>(true);
  const [isSubmittingAbsence, setIsSubmittingAbsence] = useState(false);
  const [absenceSuccessMsg, setAbsenceSuccessMsg] = useState<string | null>(null);

  // Reasoning Modal
  const [selectedDutyId, setSelectedDutyId] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, dutiesRes, facRes] = await Promise.all([
        apiClient.get<DashboardStats>('/reports/dashboard'),
        apiClient.get<any[]>('/substitutions/duties'),
        apiClient.get<Faculty[]>('/faculty'),
      ]);
      setStats(statsRes.data);
      setRecentDuties(dutiesRes.data.slice(0, 6));
      setFacultyList(facRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
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
        reason: absenceReason || 'Reported via Dashboard',
        auto_allocate: autoAllocate,
      });
      const data = res.data;
      setAbsenceSuccessMsg(
        `Absence recorded! Discovered ${data.affected_classes_count} affected class(es). ${
          autoAllocate ? `Auto-allocated ${data.allocation_results?.filter((r: any) => r.status === 'ALLOCATED').length} substitute(s).` : ''
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
            Real-time timetable monitoring, automatic absence compensation, and workload fairness.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAbsenceModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Absence</span>
          </button>
          <button
            onClick={handleBatchAutoAllocate}
            className="px-4 py-2.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Auto-Allocation</span>
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
                onClick={() => onNavigate('substitutions')}
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
          onClick={() => onNavigate('faculty')}
        />
        <StatCard
          title="Today's Absences"
          value={stats ? stats.today_absences_count : '--'}
          subtitle={`${stats?.today_affected_classes_count || 0} affected classes`}
          icon={UserX}
          variant="rose"
          onClick={() => onNavigate('absences')}
        />
        <StatCard
          title="Allocated Substitutions"
          value={stats ? stats.today_allocated_count : '--'}
          subtitle="100% compliant with Rules 1–7"
          icon={CheckCircle2}
          variant="emerald"
          onClick={() => onNavigate('substitutions')}
        />
        <StatCard
          title="Unallocated Classes"
          value={stats ? stats.today_unallocated_count : '--'}
          subtitle="Requires attention"
          icon={AlertCircle}
          variant={stats?.today_unallocated_count ? 'rose' : 'slate'}
          onClick={() => onNavigate('substitutions')}
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
              onClick={() => onNavigate('substitutions')}
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
              Absent Faculty Member
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Absence Date
            </label>
            <input
              type="date"
              value={absenceDate}
              onChange={(e) => setAbsenceDate(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
              required
            />
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

      {/* Allocation Reasoning Modal */}
      <AllocationReasoningModal
        dutyId={selectedDutyId}
        isOpen={selectedDutyId !== null}
        onClose={() => setSelectedDutyId(null)}
      />
    </div>
  );
};
