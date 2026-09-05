import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { AuditLogItem } from '../types';
import { Search, Clock } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<AuditLogItem[]>('/audit');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    return (
      l.event_type.toLowerCase().includes(search.toLowerCase()) ||
      l.actor_name.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] tracking-tight">
            Institutional Audit & Compliance Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log of all allocation decisions, manual overrides, system rules updates, and AI queries.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-7 top-7" />
        <input
          type="text"
          placeholder="Search by event type, actor name, or details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2582a1]"
        />
      </div>

      {/* Audit Log Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No audit logs match your search.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors text-xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                      log.event_type.includes('ALLOCATION')
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : log.event_type.includes('OVERRIDE')
                        ? 'bg-[#fff8eb] text-[#b37d10] border border-[#fde6b3]'
                        : log.event_type.includes('ABSENCE')
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {log.event_type}
                  </span>
                  <span className="font-semibold text-slate-700">by {log.actor_name}</span>
                </div>
                <span className="text-slate-400 text-[11px] flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </span>
              </div>

              {/* Details JSON / Preview */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 overflow-x-auto">
                <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
