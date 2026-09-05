import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { SystemRuleItem } from '../types';
import { CheckCircle2, Save } from 'lucide-react';

export const SystemRulesPage: React.FC = () => {
  const [rules, setRules] = useState<SystemRuleItem[]>([]);
  const [editingValues, setEditingValues] = useState<Record<number, string>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<SystemRuleItem[]>('/system-rules');
      setRules(res.data);
      const valMap: Record<number, string> = {};
      res.data.forEach((r) => {
        valMap[r.id] = r.rule_value;
      });
      setEditingValues(valMap);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSaveRule = async (ruleId: number) => {
    try {
      await apiClient.patch(`/system-rules/${ruleId}`, {
        rule_value: editingValues[ruleId],
      });
      setSavedMsg('Rule updated successfully!');
      setTimeout(() => setSavedMsg(null), 3000);
      fetchRules();
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] tracking-tight">
            System Scheduling Rules & Hard Constraints
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure non-negotiable institutional limits for weekly substitutions, daily regular class thresholds, and fairness.
          </p>
        </div>
        {savedMsg && (
          <div className="flex items-center space-x-1.5 text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{savedMsg}</span>
          </div>
        )}
      </div>

      {/* Rules List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100">
        {rules.map((rule) => (
          <div key={rule.id} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-sm">{rule.rule_name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {rule.rule_key}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{rule.description}</p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <input
                type="text"
                value={editingValues[rule.id] || ''}
                onChange={(e) =>
                  setEditingValues({ ...editingValues, [rule.id]: e.target.value })
                }
                className="text-xs font-bold font-mono rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#2582a1] w-36 text-center"
              />
              <button
                onClick={() => handleSaveRule(rule.id)}
                className="px-3.5 py-2 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reference Card */}
      <div className="bg-[#f0f9fb] p-6 rounded-2xl border border-[#bee3ee] text-xs text-slate-700 space-y-2.5">
        <h4 className="font-bold text-[#0e3b4b] uppercase tracking-wider text-[11px]">
          The Apollo University Core Non-Negotiable Rules Matrix:
        </h4>
        <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
          <li><strong>Rule 1:</strong> Free during exact period (no regular class conflict).</li>
          <li><strong>Rule 2:</strong> Daily regular class count &lt; 3 (faculty with 3+ regular classes on that day are excluded).</li>
          <li><strong>Rule 3:</strong> Weekly substitutions &lt; 4 (system strictly never automatically allocates a 5th duty).</li>
          <li><strong>Rule 4:</strong> Non-exempt and active faculty only.</li>
          <li><strong>Rule 5:</strong> Not on leave or absent during that date/time.</li>
          <li><strong>Rule 6:</strong> Zero double-booking with existing regular classes or other substitutions.</li>
          <li><strong>Rule 7:</strong> Candidate ranking prioritizing lowest weekly substitution count.</li>
        </ul>
      </div>
    </div>
  );
};
