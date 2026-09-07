import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { AcademicHoliday, CheckDateResult } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const AcademicCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<AcademicHoliday[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quick Date Checker
  const [checkDate, setCheckDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateResult, setDateResult] = useState<CheckDateResult | null>(null);

  // Add Holiday Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [holidayName, setHolidayName] = useState<string>('');
  const [holidayDate, setHolidayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [holidayType, setHolidayType] = useState<string>('NATIONAL_HOLIDAY');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isAdmin = user?.role?.name === 'ADMIN';

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<AcademicHoliday[]>(`/academic-calendar/holidays?academic_year=${selectedYear}`);
      setHolidays(res.data);
    } catch (err) {
      console.error('Failed to load academic holidays:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const evaluateDate = async (dStr: string) => {
    try {
      const res = await apiClient.get<CheckDateResult>(`/academic-calendar/check-date?target_date=${dStr}`);
      setDateResult(res.data);
    } catch (err) {
      console.error('Date evaluation failed:', err);
    }
  };

  useEffect(() => {
    fetchHolidays();
    evaluateDate(checkDate);
  }, [selectedYear]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/academic-calendar/holidays', {
        name: holidayName,
        date: holidayDate,
        holiday_type: holidayType,
        academic_year: selectedYear,
        description: description || undefined,
        is_recurring: true
      });
      setIsModalOpen(false);
      setHolidayName('');
      setDescription('');
      fetchHolidays();
      evaluateDate(checkDate);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this holiday from the academic calendar?')) return;
    try {
      await apiClient.delete(`/academic-calendar/holidays/${id}`);
      fetchHolidays();
    } catch (err) {
      console.error('Failed to delete holiday:', err);
    }
  };

  const filteredHolidays = holidays.filter((h) => {
    if (filterType === 'ALL') return true;
    return h.holiday_type === filterType;
  });

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'SECOND_SATURDAY':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'NATIONAL_HOLIDAY':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'FESTIVAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'SEMESTER_BREAK':
        return 'bg-[#dcf1f6] text-[#165369] border-[#bee3ee]';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0e3b4b] text-white p-6 sm:p-8 rounded-2xl shadow-md border border-[#165369]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#fdb931] text-[#0e3b4b] text-xs font-bold mb-3">
              <CalendarDays className="w-3.5 h-3.5 text-[#0e3b4b]" />
              <span>Institutional Academic Calendar • {selectedYear}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Yearly Academic Calendar & Holidays
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Track institutional holidays, national celebrations, and monthly 2nd Saturdays. Duty allocations automatically respect non-working institutional dates.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Institutional Holiday</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Status Inspector Widget */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-[#f0f9fb] text-[#2582a1]">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Interactive Date Status Inspector</h3>
            <p className="text-xs text-slate-500">Inspect working day vs holiday/2nd Saturday status for any specific date</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={checkDate}
            onChange={(e) => {
              setCheckDate(e.target.value);
              evaluateDate(e.target.value);
            }}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-[#0e3b4b] bg-white focus:ring-2 focus:ring-[#2582a1]"
          />

          {dateResult && (
            <div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center space-x-2 ${
              dateResult.is_working_day 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              <span>
                {dateResult.is_second_saturday 
                  ? '⚠️ Second Saturday (Non-Working Day)' 
                  : dateResult.is_sunday
                  ? '⚠️ Sunday (Weekly Off)'
                  : dateResult.holiday_name
                  ? `🎉 ${dateResult.holiday_name}`
                  : '✓ Regular Academic Working Day'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'ALL', label: 'All Calendar Events' },
            { key: 'SECOND_SATURDAY', label: '2nd Saturdays (12)' },
            { key: 'NATIONAL_HOLIDAY', label: 'National Holidays' },
            { key: 'FESTIVAL', label: 'Festival Holidays' },
            { key: 'SEMESTER_BREAK', label: 'Semester Recesses' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === tab.key
                  ? 'bg-[#0e3b4b] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Showing {filteredHolidays.length} calendar event(s)
        </span>
      </div>

      {/* Calendar Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-[#f0f9fb] border-b border-[#bee3ee] text-[#0e3b4b] font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Date & Day</th>
                <th className="p-4">Holiday / Event Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Description</th>
                {isAdmin && <th className="p-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHolidays.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No academic calendar events matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredHolidays.map((h) => {
                  const d = new Date(h.date);
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                  return (
                    <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-slate-900 block">{h.date}</span>
                        <span className="text-[11px] text-slate-500 font-medium">{dayName}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-900 text-xs">{h.name}</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getBadgeStyle(h.holiday_type)}`}>
                          {h.holiday_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">
                        {h.description || 'Academic non-working schedule'}
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteHoliday(h.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete holiday"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Holiday Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Institutional Holiday"
        subtitle="New holiday will be immediately visible across all portals and allocation dates."
      >
        <form onSubmit={handleAddHoliday} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Holiday / Event Name</label>
            <input
              type="text"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              placeholder="e.g. Founder's Day, Convocation Recess"
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#2582a1] text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Holiday Date</label>
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#2582a1] text-xs"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Category</label>
              <select
                value={holidayType}
                onChange={(e) => setHolidayType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#2582a1] text-xs bg-white"
              >
                <option value="NATIONAL_HOLIDAY">National Holiday</option>
                <option value="FESTIVAL">Festival Holiday</option>
                <option value="SECOND_SATURDAY">Second Saturday</option>
                <option value="SEMESTER_BREAK">Semester Break</option>
                <option value="INSTITUTIONAL">Institutional Event</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. University closed for celebrations..."
              rows={2}
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#2582a1] text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Save Holiday'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
