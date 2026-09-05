import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import { CheckCircle2, XCircle, AlertTriangle, Shield, User, Clock, Calendar } from 'lucide-react';
import { CandidateEvaluation } from '../../types';

interface AllocationReasoningModalProps {
  dutyId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AllocationReasoningModal: React.FC<AllocationReasoningModalProps> = ({
  dutyId,
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'reason' | 'rejected'>('reason');

  useEffect(() => {
    if (isOpen && dutyId) {
      setIsLoading(true);
      apiClient
        .get(`/substitutions/duties/${dutyId}/reasoning`)
        .then((res) => setData(res.data))
        .catch((err) => console.error('Failed to load reasoning:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, dutyId]);

  if (!isOpen) return null;

  const duty = data?.duty;
  const rejectedList: CandidateEvaluation[] = data?.rejected_candidates || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Deterministic Allocation Audit & Reasoning"
      subtitle={duty ? `${duty.class_name} • ${duty.subject_name} • ${duty.date} (${duty.period_start}-${duty.period_end})` : 'Loading...'}
      maxWidth="3xl"
    >
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          Loading verified institutional audit records...
        </div>
      ) : !data ? (
        <div className="py-8 text-center text-slate-400 text-sm">
          Could not load allocation details.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chosen Substitute Summary Banner */}
          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {duty.assigned_faculty_name?.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-base">{duty.assigned_faculty_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                      {duty.assigned_faculty_code}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white text-slate-700 font-medium border border-emerald-200">
                      {duty.allocation_method}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 font-medium">
                    Substituting for <strong className="text-slate-900">{duty.original_faculty_name}</strong>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block">Weekly Substitutions</span>
                <span className="text-lg font-extrabold text-emerald-900">{duty.weekly_count_at_assignment} / 4</span>
              </div>
            </div>

            {/* Checkpoint Validation Badges */}
            <div className="mt-4 pt-3 border-t border-emerald-200/60 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center space-x-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Free during period (Rule 1)</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{duty.daily_classes_at_assignment} regular classes today (Rule 2)</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Under weekly 4-duty limit (Rule 3)</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Not exempt / active (Rule 4)</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Not absent / on leave (Rule 5)</span>
              </div>
              <div className="flex items-center space-x-1.5 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No double-booking (Rule 6)</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 space-x-4 text-sm font-medium">
            <button
              onClick={() => setActiveTab('reason')}
              className={`pb-2 transition-all ${
                activeTab === 'reason'
                  ? 'border-b-2 border-brand-600 text-brand-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Factual Selection Explanation
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`pb-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'rejected'
                  ? 'border-b-2 border-brand-600 text-brand-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Disqualified Candidates</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                {rejectedList.length}
              </span>
            </button>
          </div>

          {/* Tab 1: Factual Explanation Text */}
          {activeTab === 'reason' && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Engine Rationale</h4>
              <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                {duty.allocation_reason || 'Allocated via deterministic scheduling engine based on availability and lowest weekly count.'}
              </pre>
              {duty.is_manual_override && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                  <strong>Manual Override Notice:</strong> This duty was manually assigned by{' '}
                  <strong>{duty.overridden_by || 'Admin'}</strong>. Reason: <em>"{duty.override_reason}"</em>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Disqualified Candidates and Explicit Violation Reasons */}
          {activeTab === 'rejected' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {rejectedList.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No candidates were evaluated.</p>
              ) : (
                rejectedList.map((cand) => (
                  <div
                    key={cand.faculty_id}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-start justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-800">{cand.faculty_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {cand.faculty_code}
                        </span>
                        <span className="text-[10px] text-slate-400">{cand.department_name}</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {cand.rejection_reasons.map((r, idx) => (
                          <div key={idx} className="flex items-center space-x-1.5 text-[11px] text-rose-700 font-medium">
                            <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400 shrink-0">
                      <div>Classes today: <strong className="text-slate-700">{cand.daily_regular_classes}</strong></div>
                      <div>Duties this week: <strong className="text-slate-700">{cand.weekly_substitutions}/4</strong></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
