import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import { SubstitutionDuty, Faculty } from '../../types';
import { AlertTriangle, UserCheck, ShieldAlert } from 'lucide-react';

interface ManualOverrideModalProps {
  duty: SubstitutionDuty | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  duty,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | ''>('');
  const [reason, setReason] = useState<string>('');
  const [forceIgnore, setForceIgnore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      apiClient.get<Faculty[]>('/faculty').then((res) => {
        setFacultyList(res.data);
      });
      setSelectedFacultyId('');
      setReason('');
      setForceIgnore(false);
      setErrorMessage(null);
      setViolations([]);
    }
  }, [isOpen]);

  if (!isOpen || !duty) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      setErrorMessage('Please select a replacement faculty member.');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Please provide an administrative reason for the override.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setViolations([]);

    try {
      await apiClient.post(`/substitutions/duties/${duty.id}/override`, {
        assigned_faculty_id: Number(selectedFacultyId),
        reason: reason.trim(),
        force_ignore_rules: forceIgnore,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.response?.data?.detail?.violations) {
        setViolations(err.response.data.detail.violations);
        setErrorMessage('The selected candidate violates institutional constraints. Review the violations below.');
      } else {
        setErrorMessage(err.response?.data?.detail || 'Failed to apply manual override.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Admin Manual Substitution Override"
      subtitle={`Reassign Duty #${duty.id}: ${duty.class_name} • ${duty.subject_name} (${duty.period_start}-${duty.period_end})`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Assignment Snapshot */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Currently Assigned:</span>
            <span className="font-bold text-slate-800">{duty.assigned_faculty_name} ({duty.assigned_faculty_code})</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-slate-500">Original Absent Faculty:</span>
            <span className="font-medium text-slate-700">{duty.original_faculty_name}</span>
          </div>
        </div>

        {/* New Faculty Dropdown */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Select New Substitute Faculty
          </label>
          <select
            value={selectedFacultyId}
            onChange={(e) => {
              setSelectedFacultyId(Number(e.target.value) || '');
              setViolations([]);
              setErrorMessage(null);
            }}
            className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-hidden font-medium"
            required
          >
            <option value="">-- Choose Faculty Member --</option>
            {facultyList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.faculty_id}) - {f.department_name} [{f.weekly_substitution_count}/4 duties]
              </option>
            ))}
          </select>
        </div>

        {/* Administrative Reason Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Administrative Override Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Special subject expertise required for accreditation review..."
            className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            required
          />
        </div>

        {/* Violations Warning Banner */}
        {violations.length > 0 && (
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs">
            <div className="flex items-center space-x-2 text-rose-800 font-bold mb-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Institutional Rule Violations Detected:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-rose-700">
              {violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
            <div className="mt-3 pt-2 border-t border-rose-200">
              <label className="flex items-center space-x-2 text-rose-900 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceIgnore}
                  onChange={(e) => setForceIgnore(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>I understand and explicitly authorize bypassing these rules with full audit logging.</span>
              </label>
            </div>
          </div>
        )}

        {errorMessage && violations.length === 0 && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs border border-rose-200">
            {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            {isSubmitting ? 'Validating & Overriding...' : 'Confirm Override'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
