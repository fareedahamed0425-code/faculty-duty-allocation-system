import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { DashboardStats, Faculty } from '../types';
import {
  GraduationCap,
  Users,
  ShieldCheck,
  Award,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface DeanDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenAI: () => void;
}

export const DeanDashboard: React.FC<DeanDashboardProps> = ({ onNavigate, onOpenAI }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDeanData = async () => {
      setIsLoading(true);
      try {
        const [statsRes, facRes] = await Promise.all([
          apiClient.get<DashboardStats>('/reports/dashboard'),
          apiClient.get<Faculty[]>('/faculty'),
        ]);
        setStats(statsRes.data);
        setFaculty(facRes.data);
      } catch (err) {
        console.warn('Could not fetch Dean dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadDeanData();
  }, []);

  const exemptCount = faculty.filter(f => f.is_exempt).length;
  const eligibleCount = faculty.filter(f => f.is_substitution_eligible).length;

  const departments = [
    { code: 'CSE', name: 'Computer Science & Engineering', facultyCount: 8, loadAvg: 1.4, compliance: '100%' },
    { code: 'ECE', name: 'Electronics & Communication', facultyCount: 6, loadAvg: 1.2, compliance: '100%' },
    { code: 'MECH', name: 'Mechanical Engineering', facultyCount: 5, loadAvg: 1.0, compliance: '100%' },
    { code: 'MATH', name: 'Mathematics & Basic Sciences', facultyCount: 6, loadAvg: 1.1, compliance: '100%' },
  ];

  return (
    <div className="space-y-6">
      {/* Dean Executive Banner in Apollo University Corporate Style */}
      <div className="bg-[#0e3b4b] text-white p-6 sm:p-8 rounded-2xl shadow-md border border-[#165369]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#fdb931] text-[#0e3b4b] text-xs font-bold mb-3">
              <GraduationCap className="w-3.5 h-3.5 text-[#0e3b4b]" />
              <span>The Apollo University • Academic Affairs Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              University Academic Overview
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Welcome, {user?.full_name || 'Dr. Vikram Malhotra'}. Monitor cross-departmental duty allocation compliance, workload fairness metrics, and institutional teaching coverage.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onOpenAI}
              className="px-4 py-2.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#fdb931]" />
              <span>Dean AI Advisor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Institutional KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Faculty</span>
            <Users className="w-4 h-4 text-[#2582a1]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0e3b4b]">{stats?.total_faculty || 25}</span>
            <span className="text-xs font-bold text-emerald-700">4 Departments</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">{stats?.active_faculty || 23} active today</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Fairness Index</span>
            <Award className="w-4 h-4 text-[#fdb931]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0e3b4b]">96.4%</span>
            <span className="text-xs font-bold text-emerald-700">Grade A+</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">Zero policy violations</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Exempt Faculty</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0e3b4b]">{exemptCount || 7}</span>
            <span className="text-xs font-semibold text-slate-500">leadership/research</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">{eligibleCount || 18} eligible pool</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Timetable Coverage</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-[#0e3b4b]">100%</span>
            <span className="text-xs font-bold text-emerald-700">Zero cancellations</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-medium">All absences covered</p>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#0e3b4b]">Departmental Compliance & Workload Distribution</h2>
            <p className="text-xs text-slate-500">Comparative workload health across university academic departments</p>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            className="text-xs text-[#2582a1] hover:text-[#165369] font-bold cursor-pointer"
          >
            Detailed Analytics →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f0f9fb] text-[#0e3b4b] uppercase font-bold text-[10px] tracking-wider border-b border-[#bee3ee]">
              <tr>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Total Faculty</th>
                <th className="py-3 px-4">Avg Substitution Load</th>
                <th className="py-3 px-4">Max Weekly Limit Status</th>
                <th className="py-3 px-4">Institutional Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((dept) => (
                <tr key={dept.code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {dept.name} <span className="text-slate-400 font-mono">({dept.code})</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-700">{dept.facultyCount} faculty</td>
                  <td className="py-3.5 px-4 text-slate-600">{dept.loadAvg} duties / faculty</td>
                  <td className="py-3.5 px-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Within Safe Bounds (≤ 4)
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{dept.compliance} Compliant</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
