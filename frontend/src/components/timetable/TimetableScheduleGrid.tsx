import React from 'react';
import { TimetableEntry, TimetablePeriod } from '../../types';
import { Clock, MapPin, User, Edit3, Plus, Edit2, Coffee } from 'lucide-react';

interface TimetableScheduleGridProps {
  entries: TimetableEntry[];
  periods: TimetablePeriod[];
  viewMode: 'faculty' | 'class';
  isAdmin?: boolean;
  onEditEntry?: (entry: TimetableEntry) => void;
  onAddEntry?: (dayOfWeek: number, period: TimetablePeriod) => void;
  onEditPeriod?: (period: TimetablePeriod) => void;
}

const DAYS = [
  { index: 0, name: 'Monday', short: 'MON' },
  { index: 1, name: 'Tuesday', short: 'TUE' },
  { index: 2, name: 'Wednesday', short: 'WED' },
  { index: 3, name: 'Thursday', short: 'THU' },
  { index: 4, name: 'Friday', short: 'FRI' },
  { index: 5, name: 'Saturday', short: 'SAT' },
];

export const TimetableScheduleGrid: React.FC<TimetableScheduleGridProps> = ({
  entries = [],
  periods = [],
  viewMode,
  isAdmin = false,
  onEditEntry,
  onAddEntry,
  onEditPeriod,
}) => {
  const sortedPeriods = [...(periods || [])].sort((a, b) => a.period_number - b.period_number);

  const getEntryForSlot = (dayIdx: number, start: string, end: string) => {
    return (entries || []).find(
      (e) => e && e.day_of_week === dayIdx && (e.start_time === start || (e.start_time <= start && e.end_time >= end))
    );
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full text-left border-collapse min-w-[860px]">
        {/* Horizontal Header: Period Timings across the top */}
        <thead>
          <tr className="bg-slate-50/90 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
            <th className="p-3 text-xs font-bold uppercase tracking-wider text-slate-500 w-32 border-r border-slate-200 sticky left-0 bg-slate-50 z-20">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Day \ Period</span>
              </div>
            </th>
            {sortedPeriods.map((period) => (
              <th
                key={period.id}
                className={`p-2.5 text-center border-r border-slate-200 min-w-[140px] group/col ${
                  period.is_break ? 'bg-amber-50/60 text-amber-800' : 'text-slate-700'
                }`}
              >
                <div className="flex items-center justify-center space-x-1">
                  <span className="text-xs font-bold text-slate-900">{period.name}</span>
                  {isAdmin && onEditPeriod && (
                    <button
                      onClick={() => onEditPeriod(period)}
                      className="opacity-0 group-hover/col:opacity-100 transition-opacity p-0.5 hover:bg-slate-200/80 rounded text-slate-400 hover:text-brand-600 cursor-pointer"
                      title={`Edit timing for ${period.name}`}
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div
                  onClick={() => isAdmin && onEditPeriod && onEditPeriod(period)}
                  className={`text-[11px] font-semibold text-slate-500 mt-0.5 ${
                    isAdmin ? 'cursor-pointer hover:text-brand-600 hover:underline' : ''
                  }`}
                  title={isAdmin ? 'Click to edit period timing' : undefined}
                >
                  {period.start_time} – {period.end_time}
                </div>

                {period.is_break && (
                  <span className="inline-flex items-center text-[9px] font-bold text-amber-700 uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-100/80 mt-0.5">
                    Break
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        {/* Vertical Rows: Days down the left */}
        <tbody className="divide-y divide-slate-100">
          {DAYS.map((day) => (
            <tr key={day.index} className="hover:bg-slate-50/40 transition-colors group">
              {/* Day Column (Sticky Left) */}
              <td className="p-3 bg-slate-50/80 border-r border-slate-200 sticky left-0 z-10 align-middle shadow-2xs">
                <div className="font-bold text-xs text-slate-800 tracking-wide">{day.name}</div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  {day.short}
                </span>
              </td>

              {/* Period Columns for this Day */}
              {sortedPeriods.map((period) => {
                if (period.is_break) {
                  return (
                    <td
                      key={period.id}
                      className="p-2 border-r border-slate-100 bg-amber-50/20 text-center align-middle"
                    >
                      <div className="flex flex-col items-center justify-center py-2.5 text-amber-600/70 space-y-0.5">
                        <Coffee className="w-3 h-3 opacity-60" />
                        <span className="text-[9px] font-bold tracking-wider uppercase">Interval</span>
                      </div>
                    </td>
                  );
                }

                const entry = getEntryForSlot(day.index, period.start_time, period.end_time);

                return (
                  <td key={period.id} className="p-1.5 border-r border-slate-100 align-top">
                    {entry ? (
                      <div
                        onClick={() => isAdmin && onEditEntry && onEditEntry(entry)}
                        className={`p-2 rounded-xl border text-xs transition-all relative ${
                          isAdmin ? 'cursor-pointer hover:border-brand-400 hover:shadow-subtle' : ''
                        } ${
                          viewMode === 'faculty'
                            ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-950 hover:bg-emerald-50'
                            : 'bg-brand-50/80 border-brand-200/80 text-brand-950 hover:bg-brand-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900 line-clamp-1">{entry.subject_code}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                              viewMode === 'faculty'
                                ? 'bg-white text-emerald-800 border-emerald-300'
                                : 'bg-white text-brand-800 border-brand-300'
                            }`}
                          >
                            {entry.class_name || 'Class'}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 line-clamp-1 font-medium" title={entry.subject_name}>
                          {entry.subject_name || entry.subject_code}
                        </p>

                        <div className="mt-1.5 pt-1 border-t border-slate-200/70 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="flex items-center space-x-1" title={entry.faculty_name}>
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="line-clamp-1 font-medium">{entry.faculty_name || 'Faculty'}</span>
                          </span>
                          <span className="flex items-center space-x-0.5 font-medium text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{entry.room_number || 'Room'}</span>
                          </span>
                        </div>

                        {isAdmin && (
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Edit2 className="w-2.5 h-2.5 text-slate-400 hover:text-brand-600" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => isAdmin && onAddEntry && onAddEntry(day.index, period)}
                        className={`h-18 flex flex-col items-center justify-center text-[10px] text-slate-300 font-medium border border-dashed border-slate-200/80 rounded-xl transition-all ${
                          isAdmin
                            ? 'cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-600'
                            : ''
                        }`}
                      >
                        {isAdmin ? (
                          <div className="flex items-center space-x-1 opacity-0 hover:opacity-100 transition-opacity">
                            <Plus className="w-3 h-3" />
                            <span className="font-bold">Add</span>
                          </div>
                        ) : (
                          <span>Free</span>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
