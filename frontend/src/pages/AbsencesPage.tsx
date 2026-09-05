import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Absence, Faculty } from '../types';
import { Modal } from '../components/common/Modal';
import { Plus, CheckCircle2, Trash2 } from 'lucide-react';

export const AbsencesPage: React.FC = () => {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | ''>('');
  const [absenceDate, setAbsenceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isFullDay, setIsFullDay] = useState<boolean>(true);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('13:00');
  const [reason, setReason] = useState<string>('');
  const [autoAllocate, setAutoAllocate] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successResult, setSuccessResult] = useState<any>(null);

  const fetchAbsences = async () => {
    try {
      const [absRes, facRes] = await Promise.all([
        apiClient.get<Absence[]>('/absences'),
        apiClient.get<Faculty[]>('/faculty'),
      ]);
      setAbsences(absRes.data);
      setFacultyList(facRes.data);
    } catch (err) {
      console.error('Failed to load absences:', err);
    }
  };

  useEffect(() => {
    fetchAbsences();
  }, []);

  const handleRecordAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyId) return;

    setIsSubmitting(true);
    setSuccessResult(null);

    try {
      const res = await apiClient.post('/absences', {
        faculty_id: Number(selectedFacultyId),
        date: absenceDate,
        is_full_day: isFullDay,
        start_time: isFullDay ? '00:00' : startTime,
        end_time: isFullDay ? '23:59' : endTime,
        reason: reason || 'Personal Leave',
        auto_allocate: autoAllocate,
      });
      setSuccessResult(res.data);
      fetchAbsences();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to record absence.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAbsence = async (absenceId: number) => {
    if (!window.confirm('Are you sure you want to cancel this absence? All associated substitution duties will be reverted.')) {
      return;
    }
    try {
      await apiClient.post(`/absences/${absenceId}/cancel`);
      fetchAbsences();
    } catch (err) {
      console.error('Failed to cancel absence:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] tracking-tight">
            Faculty Absence & Leave Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record planned or emergency faculty absences with instant automatic affected-class detection.
          </p>
        </div>
        <button
          onClick={() => {
            setIsModalOpen(true);
            setSuccessResult(null);
            setSelectedFacultyId('');
            setReason('');
          }}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Log Faculty Absence</span>
        </button>
      </div>

      {/* Absence Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead>
              <tr className="bg-[#f0f9fb] border-b border-[#bee3ee] text-[#0e3b4b] font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Faculty Member</th>
                <th className="p-4">Absence Date & Time</th>
                <th className="p-4">Reason</th>
                <th className="p-4 text-center">Affected Classes</th>
                <th className="p-4 text-center">Allocation Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {absences.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No faculty absences currently recorded.
                  </td>
                </tr>
              ) : (
                absences.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{a.faculty_name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{a.faculty_code} • {a.department_name}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-slate-800 block">{a.date}</span>
                      <span className="text-[11px] text-slate-500">{a.is_full_day ? 'Full Day' : `${a.start_time} - ${a.end_time}`}</span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {a.reason || 'Not specified'}
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs">
                        {a.affected_classes_count} classes
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {a.status === 'CANCELLED' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
                          Cancelled
                        </span>
                      ) : a.unallocated_count > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {a.unallocated_count} Unallocated
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          All Covered ({a.allocated_count})
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {a.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleCancelAbsence(a.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Cancel Absence"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Absence Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Faculty Absence & Run Engine"
        subtitle="The scheduling engine will automatically discover timetable conflicts and assign substitutes."
        maxWidth="lg"
      >
        {!successResult ? (
          <form onSubmit={handleRecordAbsence} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Absent Faculty
              </label>
              <select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(Number(e.target.value) || '')}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-medium focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              >
                <option value="">-- Choose Faculty Member --</option>
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
              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFullDay}
                    onChange={(e) => setIsFullDay(e.target.checked)}
                    className="rounded text-[#2582a1] focus:ring-[#2582a1]"
                  />
                  <span>Full Day Absence</span>
                </label>
              </div>
            </div>

            {!isFullDay && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Absence Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Attending Conference, Medical Emergency"
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
                <span>Automatically allocate eligible substitutes for uncovered classes</span>
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Resolving Classes...' : 'Confirm Absence'}
              </button>
            </div>
          </form>
        ) : (
          /* Result Summary */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <div className="flex items-center space-x-2 font-bold text-emerald-900 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Absence Successfully Processed</span>
              </div>
              <p className="text-emerald-800">
                Discovered <strong>{successResult.affected_classes_count} affected class(es)</strong> in the master timetable.
              </p>
            </div>

            {successResult.allocation_results?.length > 0 && (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Engine Allocations:</p>
                {successResult.allocation_results.map((res: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900 block">{res.class_name} ({res.period})</span>
                      <span className="text-[11px] text-slate-500">{res.subject_name}</span>
                    </div>
                    <div>
                      {res.status === 'ALLOCATED' ? (
                        <span className="font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px]">
                          → {res.selected_faculty?.name} (Weekly: {res.selected_faculty?.weekly_substitutions}/4)
                        </span>
                      ) : (
                        <span className="font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[11px]">
                          Unallocated
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
