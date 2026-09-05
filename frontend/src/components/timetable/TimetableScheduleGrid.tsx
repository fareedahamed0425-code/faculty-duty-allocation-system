import React from 'react';
import { TimetableEntry } from '../../types';
import { Clock, MapPin, User, BookOpen } from 'lucide-react';

interface TimetableScheduleGridProps {
  entries: TimetableEntry[];
  viewMode: 'faculty' | 'class';
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_SLOTS = [
  { label: 'Period 1 (09:00 - 10:00)', start: '09:00', end: '10:00' },
  { label: 'Period 2 (10:00 - 11:00)', start: '10:00', end: '11:00' },
  { label: 'Period 3 (11:15 - 12:15)', start: '11:15', end: '12:15' },
  { label: 'Period 4 (12:15 - 13:15)', start: '12:15', end: '13:15' },
  { label: 'Period 5 (14:00 - 15:00)', start: '14:00', end: '15:00' },
  { label: 'Period 6 (15:00 - 16:00)', start: '15:00', end: '16:00' },
];

export const TimetableScheduleGrid: React.FC<TimetableScheduleGridProps> = ({
  entries,
  viewMode,
}) => {
  const getEntryForSlot = (dayIdx: number, start: string, end: string) => {
    return entries.find(
      (e) => e.day_of_week === dayIdx && e.start_time === start
    );
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-subtle">
      <table className="w-full text-left border-collapse min-w-[760px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 w-44">
              Time Period
            </th>
            {DAYS.map((day, idx) => (
              <th key={idx} className="p-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 text-center">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {TIME_SLOTS.map((slot, sIdx) => (
            <tr key={sIdx} className="hover:bg-slate-50/50 transition-colors">
              <td className="p-3 text-xs font-medium text-slate-500 bg-slate-50/50 border-r border-slate-100 align-middle">
                <div className="flex items-center space-x-1 font-semibold text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{slot.start} - {slot.end}</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Period {sIdx + 1}</span>
              </td>
              {DAYS.map((_, dayIdx) => {
                const entry = getEntryForSlot(dayIdx, slot.start, slot.end);
                return (
                  <td key={dayIdx} className="p-2 border-r border-slate-100 align-top">
                    {entry ? (
                      <div className="p-2.5 rounded-xl bg-brand-50/80 border border-brand-200/80 text-xs shadow-2xs hover:shadow-subtle hover:bg-brand-50 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-brand-900">{entry.subject_code}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-white text-brand-700 border border-brand-200">
                            {entry.class_name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-1 font-medium">{entry.subject_name}</p>
                        <div className="mt-2 pt-1.5 border-t border-brand-200/50 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="flex items-center space-x-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="line-clamp-1">{entry.faculty_name}</span>
                          </span>
                          <span className="flex items-center space-x-0.5 font-medium text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{entry.room_number}</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-16 flex items-center justify-center text-[11px] text-slate-300 font-medium border border-dashed border-slate-100 rounded-xl">
                        Free
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
