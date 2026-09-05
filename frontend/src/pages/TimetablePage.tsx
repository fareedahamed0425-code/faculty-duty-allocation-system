import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { TimetableEntry, TimetableVersion, Faculty, Department } from '../types';
import { TimetableScheduleGrid } from '../components/timetable/TimetableScheduleGrid';
import { TimetableImportWizard } from '../components/timetable/TimetableImportWizard';
import { Calendar, Upload, Layers, Users, BookOpen, Filter } from 'lucide-react';

export const TimetablePage: React.FC = () => {
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'faculty' | 'class'>('faculty');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
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

  const activeVersion = versions.find((v) => v.is_active);

  const handleActivateVersion = async (versionId: number) => {
    try {
      await apiClient.post(`/timetables/versions/${versionId}/activate`);
      fetchTimetables();
    } catch (err) {
      console.error('Failed to activate version:', err);
    }
  };

  // Filter entries based on dropdown selection
  const displayedEntries = entries.filter((e) => {
    if (selectedFacultyId && e.faculty_id.toString() !== selectedFacultyId) return false;
    if (selectedClassId && e.class_section_id.toString() !== selectedClassId) return false;
    return true;
  });

  // Extract unique class sections from entries
  const classSections = Array.from(
    new Set(entries.map((e) => JSON.stringify({ id: e.class_section_id, name: e.class_name })))
  ).map((str) => JSON.parse(str));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-subtle">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Master Timetable & Version Explorer</h1>
            {activeVersion && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold border border-brand-200">
                Active: {activeVersion.name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visual weekly schedules, version historical records, and automated CSV/Excel import pipeline.
          </p>
        </div>

        <button
          onClick={() => setIsImportOpen(true)}
          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
        >
          <Upload className="w-4 h-4" />
          <span>Import Timetable File</span>
        </button>
      </div>

      {/* Version Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="font-bold text-slate-700">Timetable Versions:</span>
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => handleActivateVersion(v.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all border ${
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

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-subtle flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => {
              setViewMode('faculty');
              setSelectedClassId('');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
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
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
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
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="">All Faculty Members</option>
            {facultyList.map((f) => (
              <option key={f.id} value={f.id.toString()}>
                {f.name} ({f.faculty_id}) - {f.department_name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="">All Class Sections</option>
            {classSections.map((c: any) => (
              <option key={c.id} value={c.id.toString()}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {(selectedFacultyId || selectedClassId) && (
          <button
            onClick={() => {
              setSelectedFacultyId('');
              setSelectedClassId('');
            }}
            className="text-xs text-rose-600 hover:text-rose-800 font-bold"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Visual Schedule Grid */}
      <TimetableScheduleGrid entries={displayedEntries} viewMode={viewMode} />

      {/* Import Wizard Modal */}
      <TimetableImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchTimetables}
      />
    </div>
  );
};
