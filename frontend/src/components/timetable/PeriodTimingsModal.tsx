import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import { TimetablePeriod } from '../../types';
import { Clock, Check, AlertTriangle, Save, Sparkles, GraduationCap } from 'lucide-react';

interface PeriodTimingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  periods: TimetablePeriod[];
  focusPeriodId?: number | null;
  defaultYearLevel?: number;
  onSuccess: () => void;
}

const ACADEMIC_YEAR_TABS = [
  { level: 1, label: '1st Year (I)' },
  { level: 2, label: '2nd Year (II)' },
  { level: 3, label: '3rd Year (III)' },
  { level: 4, label: '4th Year (IV)' },
];

export const PeriodTimingsModal: React.FC<PeriodTimingsModalProps> = ({
  isOpen,
  onClose,
  periods = [],
  focusPeriodId = null,
  defaultYearLevel = 1,
  onSuccess,
}) => {
  const [activeYearLevel, setActiveYearLevel] = useState<number>(defaultYearLevel || 1);
  const [editedPeriods, setEditedPeriods] = useState<{
    [id: number]: { start_time: string; end_time: string; name: string };
  }>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // If a focused period exists, find its year_level
      if (focusPeriodId) {
        const found = (periods || []).find((p) => p.id === focusPeriodId);
        if (found && found.year_level) {
          setActiveYearLevel(found.year_level);
        } else if (defaultYearLevel) {
          setActiveYearLevel(defaultYearLevel);
        }
      } else if (defaultYearLevel) {
        setActiveYearLevel(defaultYearLevel);
      }

      const initial: { [id: number]: { start_time: string; end_time: string; name: string } } = {};
      (periods || []).forEach((p) => {
        if (p && p.id) {
          initial[p.id] = {
            start_time: p.start_time || '',
            end_time: p.end_time || '',
            name: p.name || `Period ${p.period_number}`,
          };
        }
      });
      setEditedPeriods(initial);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, periods, focusPeriodId, defaultYearLevel]);

  if (!isOpen) return null;

  const handleChange = (id: number, field: 'start_time' | 'end_time' | 'name', value: string) => {
    setEditedPeriods((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { start_time: '', end_time: '', name: '' }),
        [field]: value || '',
      },
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Filter periods for the currently selected Academic Year
  const currentYearPeriods = (periods || [])
    .filter((p) => (p.year_level || 1) === activeYearLevel)
    .sort((a, b) => a.period_number - b.period_number);

  const activeYearLabel = ACADEMIC_YEAR_TABS.find((t) => t.level === activeYearLevel)?.label || `Year ${activeYearLevel}`;

  const handleSaveCurrentYear = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (currentYearPeriods.length === 0) {
        throw new Error(`No periods found for ${activeYearLabel}.`);
      }

      // 1. Validate periods for active year
      for (const p of currentYearPeriods) {
        const item = editedPeriods[p.id] || {
          start_time: p.start_time || '',
          end_time: p.end_time || '',
          name: p.name || `Period ${p.period_number}`,
        };
        const st = item?.start_time ? String(item.start_time).trim() : '';
        const et = item?.end_time ? String(item.end_time).trim() : '';

        if (!st || !et) {
          throw new Error(`${item?.name || 'Period'}: Start and End times cannot be empty.`);
        }
        if (st >= et) {
          throw new Error(`${item?.name || 'Period'}: Start time (${st}) must be earlier than End time (${et}).`);
        }
      }

      // 2. Persist each updated period for active year
      for (const p of currentYearPeriods) {
        const item = editedPeriods[p.id];
        if (item) {
          const st = item.start_time ? String(item.start_time).trim() : '';
          const et = item.end_time ? String(item.end_time).trim() : '';
          const nm = item.name ? String(item.name).trim() : p.name;

          if (st !== p.start_time || et !== p.end_time || nm !== p.name) {
            await apiClient.put(`/timetables/periods/${p.id}`, {
              start_time: st,
              end_time: et,
              name: nm,
            });
          }
        }
      }

      setSuccessMessage(`${activeYearLabel} period timings updated successfully!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to update period timings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Academic Year-Wise Period Timings">
      <div className="space-y-4 text-slate-800 text-xs">
        {/* Academic Year Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          {ACADEMIC_YEAR_TABS.map((tab) => (
            <button
              key={tab.level}
              type="button"
              onClick={() => {
                setActiveYearLevel(tab.level);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeYearLevel === tab.level
                  ? 'bg-white text-brand-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <GraduationCap className={`w-3.5 h-3.5 ${activeYearLevel === tab.level ? 'text-brand-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-brand-50/70 p-3 rounded-xl border border-brand-200/80 text-brand-900 flex items-start space-x-2.5">
          <Sparkles className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Configuring period timings for <strong>{activeYearLabel}</strong>. Changes here are isolated to {activeYearLabel} classes and will not disrupt timings for other academic years.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Periods List for active year */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {currentYearPeriods.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No period records found for {activeYearLabel}.</div>
          ) : (
            currentYearPeriods.map((p) => {
              const current = editedPeriods[p.id] || {
                start_time: p?.start_time || '',
                end_time: p?.end_time || '',
                name: p?.name || `Period ${p?.period_number || ''}`,
              };
              const isFocused = focusPeriodId === p.id;

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isFocused
                      ? 'border-brand-400 bg-brand-50/30 ring-1 ring-brand-300'
                      : 'border-slate-200 bg-white shadow-2xs'
                  }`}
                >
                  <div className="w-32 font-bold text-slate-800 flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-[11px] font-bold">
                      {p.period_number}
                    </span>
                    <span>{current.name || p.name}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400 font-medium">Start:</span>
                      <input
                        type="text"
                        value={current.start_time}
                        placeholder="09:00"
                        onChange={(e) => handleChange(p.id, 'start_time', e.target.value)}
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden bg-white text-slate-800"
                      />
                    </div>

                    <span className="text-slate-300 font-bold">—</span>

                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400 font-medium">End:</span>
                      <input
                        type="text"
                        value={current.end_time}
                        placeholder="10:00"
                        onChange={(e) => handleChange(p.id, 'end_time', e.target.value)}
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden bg-white text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="text-[11px] text-slate-400 font-medium">
            Active Year: <span className="font-bold text-slate-600">{activeYearLabel}</span>
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCurrentYear}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving Timings...' : `Save ${activeYearLabel} Timings`}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
