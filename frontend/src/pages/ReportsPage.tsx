import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { WorkloadItem } from '../types';
import { Download } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [deptStats, setDeptStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const [wRes, dRes] = await Promise.all([
        apiClient.get<WorkloadItem[]>('/reports/workload'),
        apiClient.get<any[]>('/reports/departments'),
      ]);
      setWorkload(wRes.data);
      setDeptStats(dRes.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportCSV = () => {
    if (!workload.length) return;
    const headers = ['Faculty ID', 'Name', 'Department', 'Designation', 'Regular Classes/Wk', 'Substitutions This Wk', 'Max Limit', 'Utilization (%)', 'Status'];
    const rows = workload.map((w) => [
      w.faculty_code,
      `"${w.name}"`,
      `"${w.department}"`,
      `"${w.designation}"`,
      w.regular_classes_per_week,
      w.substitutions_this_week,
      w.max_weekly_limit,
      w.utilization_rate,
      w.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `workload_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] tracking-tight">
            Institutional Workload & Fairness Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit weekly substitution distribution, faculty utilization rates, and departmental balance.
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="px-4 py-2.5 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Department Workload Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {deptStats.map((d) => (
          <div key={d.department_id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{d.department_code}</span>
            <h3 className="text-sm font-bold text-[#0e3b4b] mt-0.5 line-clamp-1">{d.department_name}</h3>
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500">{d.faculty_count} Active Faculty</span>
              <span className="font-bold text-[#2582a1] bg-[#f0f9fb] px-2.5 py-0.5 rounded-full border border-[#bee3ee]">
                {d.substitutions_this_week} duties
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Faculty Workload Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f0f9fb] border-b border-[#bee3ee] flex justify-between items-center text-xs">
          <span className="font-bold text-[#0e3b4b]">Faculty Workload & Limit Status (Week: Mon–Sun)</span>
          <span className="text-slate-500 font-medium">Max limit = 4 substitutions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Faculty Member</th>
                <th className="p-4">Department</th>
                <th className="p-4 text-center">Regular Classes / Wk</th>
                <th className="p-4 text-center">Substitutions This Wk</th>
                <th className="p-4 text-center">Utilization</th>
                <th className="p-4 text-center">Limit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workload.map((w) => (
                <tr key={w.faculty_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4">
                    <span className="font-bold text-slate-900 block">{w.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{w.faculty_code} • {w.designation}</span>
                  </td>
                  <td className="p-4 text-slate-700 font-medium">{w.department}</td>
                  <td className="p-4 text-center font-bold text-slate-800">{w.regular_classes_per_week} classes</td>
                  <td className="p-4 text-center">
                    <span className="font-extrabold text-slate-900 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                      {w.substitutions_this_week} / {w.max_weekly_limit}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="w-24 mx-auto">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-semibold">
                        <span>{w.utilization_rate}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            w.status === 'AT_LIMIT'
                              ? 'bg-rose-500'
                              : w.status === 'NEAR_LIMIT'
                              ? 'bg-[#fdb931]'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(w.utilization_rate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {w.status === 'AT_LIMIT' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        At Limit (4/4)
                      </span>
                    ) : w.status === 'NEAR_LIMIT' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fff8eb] text-[#b37d10] border border-[#fde6b3]">
                        Near Limit (3/4)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Safe
                      </span>
                    )}
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
