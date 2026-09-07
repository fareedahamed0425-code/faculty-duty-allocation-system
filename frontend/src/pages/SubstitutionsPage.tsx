import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { SubstitutionDuty, SubstitutionRequirement, CheckDateResult } from '../types';
import { AllocationReasoningModal } from '../components/allocation/AllocationReasoningModal';
import { ManualOverrideModal } from '../components/allocation/ManualOverrideModal';
import {
  HelpCircle,
  Edit3,
  Play,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';

export const SubstitutionsPage: React.FC = () => {
  const [duties, setDuties] = useState<SubstitutionDuty[]>([]);
  const [requirements, setRequirements] = useState<SubstitutionRequirement[]>([]);
  const [activeTab, setActiveTab] = useState<'duties' | 'unallocated'>('duties');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateCheck, setDateCheck] = useState<CheckDateResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [reasoningDutyId, setReasoningDutyId] = useState<number | null>(null);
  const [overrideDuty, setOverrideDuty] = useState<SubstitutionDuty | null>(null);

  const fetchSubstitutions = async (targetD?: string) => {
    setIsLoading(true);
    try {
      const dutiesUrl = targetD ? `/substitutions/duties?target_date=${targetD}` : '/substitutions/duties';
      const reqsUrl = targetD ? `/substitutions/requirements?target_date=${targetD}` : '/substitutions/requirements';

      const [dutiesRes, reqsRes] = await Promise.all([
        apiClient.get<SubstitutionDuty[]>(dutiesUrl),
        apiClient.get<SubstitutionRequirement[]>(reqsUrl),
      ]);
      setDuties(dutiesRes.data);
      setRequirements(reqsRes.data);
    } catch (err) {
      console.error('Failed to load substitutions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkSelectedDateStatus = async (dStr: string) => {
    if (!dStr) {
      setDateCheck(null);
      return;
    }
    try {
      const res = await apiClient.get<CheckDateResult>(`/academic-calendar/check-date?target_date=${dStr}`);
      setDateCheck(res.data);
    } catch {
      setDateCheck(null);
    }
  };

  useEffect(() => {
    fetchSubstitutions(selectedDate);
    checkSelectedDateStatus(selectedDate);
  }, [selectedDate]);

  const handleDateChange = (newD: string) => {
    setSelectedDate(newD);
  };

  const handleShiftDate = (days: number) => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    base.setDate(base.getDate() + days);
    const dStr = base.toISOString().split('T')[0];
    setSelectedDate(dStr);
  };

  const handleAllocateRequirement = async (reqId: number) => {
    try {
      await apiClient.post(`/substitutions/requirements/${reqId}/allocate`);
      fetchSubstitutions(selectedDate);
    } catch (err) {
      console.error('Allocation failed:', err);
    }
  };

  const handleBatchAllocate = async () => {
    try {
      await apiClient.post('/substitutions/requirements/batch-allocate', { requirement_ids: [] });
      fetchSubstitutions(selectedDate);
    } catch (err) {
      console.error('Batch allocation failed:', err);
    }
  };

  const unallocatedList = requirements.filter((r) => r.status === 'UNALLOCATED');

  return (
    <div className="space-y-6">
      {/* Header & Batch Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] tracking-tight">
            Substitution Duties & Advance Allocation Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pre-hand scheduling, audit reasoning inspection, academic calendar checks, and resolution of unallocated classes.
          </p>
        </div>
        <button
          onClick={handleBatchAllocate}
          className="px-4 py-2.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Batch Auto-Allocate All</span>
        </button>
      </div>

      {/* Advance Date Selector & Academic Calendar Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => handleShiftDate(-1)}
              title="Previous Day"
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-1 text-xs bg-white rounded-lg border border-slate-200 font-bold text-[#0e3b4b] focus:ring-2 focus:ring-[#2582a1]"
            />
            <button
              onClick={() => handleShiftDate(1)}
              title="Next Day"
              className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => handleDateChange(new Date().toISOString().split('T')[0])}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[#f0f9fb] text-[#2582a1] hover:bg-[#dcf1f6] border border-[#bee3ee] transition-colors cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={() => handleDateChange('')}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            Show All Dates
          </button>
        </div>

        {/* Academic Holiday / 2nd Saturday Indicator Badge */}
        {dateCheck && (
          <div className={`px-3.5 py-1.5 rounded-xl border text-xs flex items-center space-x-2 ${
            dateCheck.is_holiday 
              ? 'bg-amber-50 border-amber-200 text-amber-900' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="font-bold">{dateCheck.day_name}:</span>
            <span>
              {dateCheck.is_second_saturday 
                ? 'Institutional Non-Working Day (Second Saturday)' 
                : dateCheck.is_sunday
                ? 'Weekly Off (Sunday)'
                : dateCheck.holiday_name
                ? `Holiday: ${dateCheck.holiday_name}`
                : 'Regular Working Day'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-semibold bg-white px-6 pt-3 rounded-2xl border border-slate-200 shadow-xs">
        <button
          onClick={() => setActiveTab('duties')}
          className={`pb-3 transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'duties'
              ? 'border-b-2 border-[#2582a1] text-[#2582a1] font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Active Duties & Advance Allocations</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0f9fb] text-[#2582a1] font-bold border border-[#bee3ee]">
            {duties.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('unallocated')}
          className={`pb-3 transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === 'unallocated'
              ? 'border-b-2 border-[#2582a1] text-[#2582a1] font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Unallocated Queue</span>
          {unallocatedList.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold animate-pulse">
              {unallocatedList.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Scheduled Duties */}
      {activeTab === 'duties' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="bg-[#f0f9fb] border-b border-[#bee3ee] text-[#0e3b4b] font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Class & Subject</th>
                  <th className="p-4">Schedule Period</th>
                  <th className="p-4">Original Faculty</th>
                  <th className="p-4">Assigned Substitute</th>
                  <th className="p-4 text-center">Workload Snapshot</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No active substitution duties recorded.
                    </td>
                  </tr>
                ) : (
                  duties.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">{d.class_name}</span>
                        <span className="text-[11px] text-slate-500">{d.subject_name} ({d.subject_code})</span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-800 block">{d.date}</span>
                        <span className="text-[11px] text-slate-500">{d.period_start} - {d.period_end}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-700 block">{d.original_faculty_name}</span>
                        <span className="text-[10px] text-slate-400">Absent</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            {d.assigned_faculty_name}
                          </span>
                          {d.is_manual_override && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#fff8eb] text-[#b37d10] font-bold border border-[#fde6b3]">
                              Override
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-[11px] text-slate-600">
                          <div>Weekly: <strong className="text-[#0e3b4b]">{d.weekly_count_at_assignment} / 4</strong></div>
                          <div>Daily: <strong className="text-[#0e3b4b]">{d.daily_classes_at_assignment}</strong></div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setReasoningDutyId(d.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#f0f9fb] hover:text-[#2582a1] text-slate-700 text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Why Selected?</span>
                          </button>
                          <button
                            onClick={() => setOverrideDuty(d)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#f0f9fb] hover:bg-[#dcf1f6] text-[#2582a1] text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Override</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Unallocated Queue */}
      {activeTab === 'unallocated' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            Classes here could not find an eligible substitute due to hard institutional rules (Rule 1–6). You can retry automatic matching or perform an administrative manual override.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="bg-[#f0f9fb] border-b border-[#bee3ee] text-[#0e3b4b] font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Class & Subject</th>
                  <th className="p-4">Period</th>
                  <th className="p-4">Original Faculty</th>
                  <th className="p-4">Rejection Rationale</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unallocatedList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Great! All affected classes have been successfully covered.
                    </td>
                  </tr>
                ) : (
                  unallocatedList.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">{req.class_name}</span>
                        <span className="text-[11px] text-slate-500">{req.subject_name}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-800 block">{req.date}</span>
                        <span className="text-[11px] text-slate-500">{req.period_start} - {req.period_end}</span>
                      </td>
                      <td className="p-4 text-slate-700 font-medium">{req.original_faculty_name}</td>
                      <td className="p-4 max-w-md">
                        <p className="text-[11px] text-rose-700 font-medium leading-relaxed bg-rose-50 p-2 rounded-xl border border-rose-200">
                          {req.unallocated_reason || 'No eligible candidate available within timetable and workload constraints.'}
                        </p>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleAllocateRequirement(req.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                        >
                          Retry Allocation
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Allocation Reasoning Modal */}
      <AllocationReasoningModal
        dutyId={reasoningDutyId}
        isOpen={reasoningDutyId !== null}
        onClose={() => setReasoningDutyId(null)}
      />

      {/* Manual Override Modal */}
      <ManualOverrideModal
        duty={overrideDuty}
        isOpen={overrideDuty !== null}
        onClose={() => setOverrideDuty(null)}
        onSuccess={fetchSubstitutions}
      />
    </div>
  );
};
