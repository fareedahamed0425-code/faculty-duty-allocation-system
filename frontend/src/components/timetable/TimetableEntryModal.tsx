import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import { TimetableEntry, TimetablePeriod, Faculty } from '../../types';
import { Save, Trash2, AlertTriangle, User, BookOpen, MapPin, Clock } from 'lucide-react';

interface SubjectItem {
  id: number;
  code: string;
  name: string;
}

interface TimetableEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: TimetableEntry | null; // null if creating new entry
  defaultDay?: number;
  defaultPeriod?: TimetablePeriod | null;
  classSectionId: number;
  classNameStr?: string;
  periods: TimetablePeriod[];
  facultyList: Faculty[];
  onSuccess: () => void;
}

const DAYS = [
  { index: 0, name: 'Monday' },
  { index: 1, name: 'Tuesday' },
  { index: 2, name: 'Wednesday' },
  { index: 3, name: 'Thursday' },
  { index: 4, name: 'Friday' },
  { index: 5, name: 'Saturday' },
];

export const TimetableEntryModal: React.FC<TimetableEntryModalProps> = ({
  isOpen,
  onClose,
  entry,
  defaultDay = 0,
  defaultPeriod = null,
  classSectionId,
  classNameStr,
  periods,
  facultyList,
  onSuccess,
}) => {
  const [facultyId, setFacultyId] = useState<number>(entry ? entry.faculty_id : (facultyList[0]?.id || 0));
  const [subjectId, setSubjectId] = useState<number>(entry ? entry.subject_id : 0);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState<number>(entry ? entry.day_of_week : defaultDay);
  const [startTime, setStartTime] = useState<string>(
    entry ? entry.start_time : (defaultPeriod ? defaultPeriod.start_time : '09:00')
  );
  const [endTime, setEndTime] = useState<string>(
    entry ? entry.end_time : (defaultPeriod ? defaultPeriod.end_time : '10:00')
  );
  const [roomNumber, setRoomNumber] = useState<string>(entry ? entry.room_number : 'Room-101');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch subjects
      apiClient.get<SubjectItem[]>('/timetables/subjects')
        .then((res) => {
          setSubjects(res.data);
          if (!entry && res.data.length > 0) {
            setSubjectId(res.data[0].id);
          }
        })
        .catch((err) => console.error('Failed to load subjects:', err));

      if (entry) {
        setFacultyId(entry.faculty_id);
        setSubjectId(entry.subject_id);
        setDayOfWeek(entry.day_of_week);
        setStartTime(entry.start_time);
        setEndTime(entry.end_time);
        setRoomNumber(entry.room_number);
      } else {
        setDayOfWeek(defaultDay);
        if (defaultPeriod) {
          setStartTime(defaultPeriod.start_time);
          setEndTime(defaultPeriod.end_time);
        }
      }
      setErrorMessage(null);
    }
  }, [isOpen, entry, defaultDay, defaultPeriod]);

  if (!isOpen) return null;

  const handlePeriodSelect = (period: TimetablePeriod) => {
    setStartTime(period.start_time);
    setEndTime(period.end_time);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!facultyId) throw new Error('Please select a faculty member.');
      if (!subjectId) throw new Error('Please select a subject.');
      if (!classSectionId) throw new Error('Invalid class section.');

      if (entry) {
        // Update
        await apiClient.put(`/timetables/entries/${entry.id}`, {
          faculty_id: facultyId,
          subject_id: subjectId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          room_number: roomNumber,
        });
      } else {
        // Create
        await apiClient.post('/timetables/entries', {
          faculty_id: facultyId,
          class_section_id: classSectionId,
          subject_id: subjectId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          room_number: roomNumber,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.message || 'Failed to save timetable entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!window.confirm('Are you sure you want to remove this class lecture from the timetable? This will also update the assigned faculty schedule immediately.')) return;

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await apiClient.delete(`/timetables/entries/${entry.id}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to delete timetable entry.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={entry ? `Edit Class Slot — ${classNameStr || 'Timetable'}` : `Add Class Slot — ${classNameStr || 'Timetable'}`}
    >
      <form onSubmit={handleSave} className="space-y-4 text-xs text-slate-800">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Day of Week */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Day of Week</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 p-2 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            >
              {DAYS.map((d) => (
                <option key={d.index} value={d.index}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Period Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Period Timing Slot</label>
            <select
              value={`${startTime}-${endTime}`}
              onChange={(e) => {
                const [st, et] = e.target.value.split('-');
                if (st && et) {
                  setStartTime(st);
                  setEndTime(et);
                }
              }}
              className="w-full rounded-xl border border-slate-200 p-2 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            >
              {periods.map((p) => (
                <option key={p.id} value={`${p.start_time}-${p.end_time}`}>
                  {p.name} ({p.start_time} - {p.end_time}) {p.is_break ? '[Break]' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-500 mb-1">Start Time (24h)</label>
            <input
              type="text"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="09:00"
              className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-500 mb-1">End Time (24h)</label>
            <input
              type="text"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="10:00"
              className="w-full rounded-xl border border-slate-200 p-2 font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Faculty Assignment */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            <span className="flex items-center space-x-1">
              <User className="w-3.5 h-3.5 text-brand-600" />
              <span>Assigned Faculty Member</span>
            </span>
          </label>
          <select
            value={facultyId}
            onChange={(e) => setFacultyId(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 p-2 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
          >
            {facultyList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.faculty_id}) — {f.department_code || f.designation}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Changing the faculty member automatically syncs their personal schedule and availability for substitutions.
          </p>
        </div>

        {/* Subject */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            <span className="flex items-center space-x-1">
              <BookOpen className="w-3.5 h-3.5 text-brand-600" />
              <span>Subject / Course</span>
            </span>
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 p-2 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Room Number */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            <span className="flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-brand-600" />
              <span>Classroom / Lab Venue</span>
            </span>
          </label>
          <input
            type="text"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="Room-101 / Lab-3"
            className="w-full rounded-xl border border-slate-200 p-2 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {entry ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting...' : 'Remove Slot'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : entry ? 'Update Cell' : 'Add to Timetable'}</span>
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
