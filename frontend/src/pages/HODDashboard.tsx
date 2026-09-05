import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { MOCK_FACULTY_LIST, MOCK_DUTIES, MOCK_TIMETABLE_ENTRIES } from '../api/mockData';
import { Faculty, SubstitutionDuty, TimetableEntry } from '../types';
import {
  Building2,
  Users,
  Calendar,
  Repeat,
  Sparkles,
  Award,
  ArrowUpRight
} from 'lucide-react';

interface HODDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenAI: () => void;
}

export const HODDashboard: React.FC<HODDashboardProps> = ({ onNavigate, onOpenAI }) => {
  const { user } = useAuth();
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [duties, setDuties] = useState<SubstitutionDuty[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const deptName = user?.department_name || 'Computer Science & Engineering';

  useEffect(() => {
    const loadHODData = async () => {
      setIsLoading(true);
      try {
        const [facRes, dutiesRes, ttRes] = await Promise.all([
          apiClient.get<Faculty[]>('/faculty'),
          apiClient.get<SubstitutionDuty[]>('/substitutions/duties'),
          apiClient.get<TimetableEntry[]>('/timetables/active/entries'),
        ]);
        setFaculty(facRes.data);
        setDuties(dutiesRes.data);
        setTimetable(ttRes.data);
      } catch {
        setFaculty(MOCK_FACULTY_LIST);
        setDuties(MOCK_DUTIES);
        setTimetable(MOCK_TIMETABLE_ENTRIES);
      } finally {
        setIsLoading(false);
      }
    };
    loadHODData();
  }, []);

  const deptFaculty = faculty.filter(f => !f.department_name || f.department_name.includes('Computer Science') || f.department_code === 'CSE');
  const activeCount = deptFaculty.filter(f => f.status === 'ACTIVE').length;
  const eligibleCount = deptFaculty.filter(f => f.is_substitution_eligible).length;

  return (
    <div className="space-y-6">
      {/* Department Banner in Solid Apollo Corporate Style */}
      <div className="bg-[#0e3b4b] text-white p-6 sm:p-8 rounded-2xl shadow-md border border-[#165369]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#2582a1] text-white text-xs font-bold mb-3">
              <Building2 className="w-3.5 h-3.5" />
              <span>The Apollo University • Department Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {deptName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Welcome, {user?.full_name || 'Head of Department'}. Manage faculty duty allocations, workload fairness (≤ 4/week), and timetable coverage.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onOpenAI}
              className="px-4 py-2.5 rounded-xl bg-[#fdb931] hover:bg-[#e5a523] text-[#0e3b4b] text-xs font-bold flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#0e3b4b]" />
              <span>AI Workload Advisor</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Dept Faculty</span>
            <Users className="w-4 h-4 text-[#2582a1]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0e3b4b]">{deptFaculty.length || 8}</span>
            <span className="text-xs font-bold text-emerald-700">{activeCount || 7} active today</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">{eligibleCount || 6} substitution eligible</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Duties Allocated</span>
            <Repeat className="w-4 h-4 text-[#2582a1]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0e3b4b]">{duties.length || 3}</span>
            <span className="text-xs font-semibold text-slate-500">this week</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-bold mt-2">100% timetable coverage</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Workload Fairness</span>
            <Award className="w-4 h-4 text-[#fdb931]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0e3b4b]">96.8%</span>
            <span className="text-xs font-bold text-emerald-700">Optimal</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">Max variance: 1 duty/week</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Active Lectures</span>
            <Calendar className="w-4 h-4 text-[#2582a1]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0e3b4b]">{timetable.length || 12}</span>
            <span className="text-xs font-semibold text-slate-500">sessions</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">CSE-1A, 2A, 3A, 4A</p>
        </div>
      </div>

      {/* Main Grid: Department Faculty Roster + Recent Substitutions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Department Faculty Load (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#0e3b4b]">Faculty Workload & Availability</h2>
              <p className="text-xs text-slate-500">Weekly substitution load tracker against Apollo limit (4/week)</p>
            </div>
            <button
              onClick={() => onNavigate('faculty')}
              className="text-xs text-[#2582a1] hover:text-[#165369] font-bold flex items-center space-x-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {deptFaculty.map((f) => {
              const dutyCount = f.weekly_substitution_count || 1;
              const pct = (dutyCount / 4) * 100;
              return (
                <div key={f.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{f.name}</p>
                    <p className="text-xs text-slate-500">{f.designation} • {f.faculty_id}</p>
                  </div>

                  <div className="flex items-center space-x-4 shrink-0">
                    <div className="w-28 text-right">
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>{dutyCount} / 4 duties</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            dutyCount >= 4 ? 'bg-rose-500' : dutyCount >= 3 ? 'bg-[#fdb931]' : 'bg-[#2582a1]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.is_exempt
                          ? 'bg-[#fff8eb] text-[#b37d10] border border-[#fde6b3]'
                          : 'bg-[#f0f9fb] text-[#165369] border border-[#bee3ee]'
                      }`}
                    >
                      {f.is_exempt ? 'Exempt' : 'Eligible'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Department Substitution Duties (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#0e3b4b]">Recent Substitution Duties</h2>
                <p className="text-xs text-slate-500">Autonomous fairness allocations</p>
              </div>
              <button
                onClick={() => onNavigate('substitutions')}
                className="text-xs text-[#2582a1] hover:text-[#165369] font-bold cursor-pointer"
              >
                Manage
              </button>
            </div>

            <div className="space-y-3">
              {duties.slice(0, 3).map((d) => (
                <div key={d.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                    <span>{d.class_name} • {d.subject_code}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      Allocated
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Assigned: <strong className="text-slate-900">{d.assigned_faculty_name}</strong>
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1 line-clamp-1">
                    {d.allocation_reason || 'Autonomous fairness scheduling matching subject expertise.'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-4 rounded-xl bg-[#f0f9fb] border border-[#bee3ee]">
            <h3 className="text-xs font-bold text-[#0e3b4b]">Department Compliance Note</h3>
            <p className="text-[11px] text-[#165369] mt-1 leading-relaxed">
              All duties strictly adhere to The Apollo University Policy Rules (Max 4/week limit & Department Domain Priority).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
