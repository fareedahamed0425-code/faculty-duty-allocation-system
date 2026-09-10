import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { TimetableEntry, TimetableVersion, Faculty } from '../types';
import { TimetableScheduleGrid } from '../components/timetable/TimetableScheduleGrid';
import { TimetableImportWizard } from '../components/timetable/TimetableImportWizard';
import { ExamTimetableUploadWizard } from '../components/exam/ExamTimetableUploadWizard';
import { Calendar, Upload, Layers, FileSpreadsheet } from 'lucide-react';

export const TimetablePage: React.FC = () => {
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'faculty' | 'class'>('faculty');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isExamImportOpen, setIsExamImportOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchTimetables = async () => {
    setIsLoading(true);
    try {
      const [vRes, eRes, fRes] = await Promise.all([
        apiClient.get<TimetableVersion[]>('/timetables/versions'),
        apiClient.get<TimetableEntry[]>('/timetables/active/entries'),
        apiClient.get<Faculty[]>('/faculty'),
      ]);
      setVersions(vRes.data);
      setEntries(eRes.data);
      setFacultyList(fRes.data);
    } catch (err) {
      console.error('Failed to load timetables:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetables();
  }, []);

  const handleActivateVersion = async (versionId: number) => {
    try {
      await apiClient.post(`/timetables/versions/${versionId}/activate`);
      fetchTimetables();
    } catch (err) {
      console.error('Failed to activate version:', err);
    }
  };

  const displayedEntries = entries.filter((e) => {
    if (viewMode === 'faculty' && selectedFacultyId) {
      return e.faculty_id === Number(selectedFacultyId);
    }
    if (viewMode === 'class' && selectedClassId) {
      return e.class_section_id === Number(selectedClassId);
    }
    return true;
  });

  const uniqueClasses = Array.from(
    new Map(entries.map((e) => [e.class_section_id, e.class_name])).entries()
  ).map(([id, name]) => ({ id, name }));

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-brand-600" />
            <h1 className="text-xl font-bold text-slate-900">Institutional Timetables & Schedules</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visual weekly schedules, version historical records, and automated CSV/Excel class and exam import pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsExamImportOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Upload Exam Timetable</span>
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Class Timetable</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="font-bold text-slate-700">Timetable Versions:</span>
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => handleActivateVersion(v.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all border cursor-pointer ${
                v.is_active
                  ? 'bg-brand-50 text-brand-700 border-brand-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {v.name} {v.is_active && '✓'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-subtle flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => {
              setViewMode('faculty');
              setSelectedClassId('');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              viewMode === 'faculty' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Faculty View
          </button>
          <button
            onClick={() => {
              setViewMode('class');
              setSelectedFacultyId('');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              viewMode === 'class' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            Class / Section View
          </button>
        </div>

        {viewMode === 'faculty' ? (
          <select
            value={selectedFacultyId}
            onChange={(e) => setSelectedFacultyId(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 p-2 bg-white text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
          >
            <option value="">All Faculty Schedules</option>
            {facultyList.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.faculty_id})
              </option>
            ))}
          </select>
        ) : (
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="text-xs rounded-xl border border-slate-200 p-2 bg-white text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
          >
            <option value="">All Classes / Sections</option>
            {uniqueClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <TimetableScheduleGrid entries={displayedEntries} viewMode={viewMode} />

      <TimetableImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => fetchTimetables()}
      />

      <ExamTimetableUploadWizard
        isOpen={isExamImportOpen}
        onClose={() => setIsExamImportOpen(false)}
        onSuccess={() => fetchTimetables()}
      />
    </div>
  );
};
