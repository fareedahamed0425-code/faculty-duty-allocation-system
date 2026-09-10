import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api/client';
import {
  TimetableEntry,
  TimetableVersion,
  TimetablePeriod,
  Faculty,
  YearHierarchyItem,
  SectionHierarchyItem,
} from '../types';
import { TimetableScheduleGrid } from '../components/timetable/TimetableScheduleGrid';
import { TimetableImportWizard } from '../components/timetable/TimetableImportWizard';
import { ExamTimetableUploadWizard } from '../components/exam/ExamTimetableUploadWizard';
import { PeriodTimingsModal } from '../components/timetable/PeriodTimingsModal';
import { TimetableEntryModal } from '../components/timetable/TimetableEntryModal';
import { CreateSectionModal } from '../components/timetable/CreateSectionModal';
import {
  Calendar,
  Upload,
  Layers,
  FileSpreadsheet,
  Clock,
  Plus,
  GraduationCap,
  FolderTree,
  AlertCircle,
  Building,
  Users,
  ChevronDown,
} from 'lucide-react';

const CANONICAL_COURSES = [
  { code: 'CSE', name: 'Computer Science' },
  { code: 'AIDS', name: 'Artificial Intelligence & Data Science' },
  { code: 'AIML', name: 'Artificial Intelligence & Machine Learning' },
  { code: 'CS', name: 'Cyber Security' },
  { code: 'CC', name: 'Cloud Computing' },
  { code: 'AIHC', name: 'Artificial Intelligence in Health Care' },
];

const ACADEMIC_YEARS = [
  { label: 'All Years', val: 'ALL', level: 0 },
  { label: '1st Year (I)', val: '1', level: 1 },
  { label: '2nd Year (II)', val: '2', level: 2 },
  { label: '3rd Year (III)', val: '3', level: 3 },
  { label: '4th Year (IV)', val: '4', level: 4 },
];

export const TimetablePage: React.FC = () => {
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [hierarchy, setHierarchy] = useState<YearHierarchyItem[]>([]);

  // Progressive Selection State
  const [selectedYear, setSelectedYear] = useState<string>('ALL'); // 'ALL' | '1' | '2' | '3' | '4'
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL'); // 'ALL' | 'CSE' | 'AIDS' | ...
  const [selectedSectionId, setSelectedSectionId] = useState<string>(''); // string ID of selected Section
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'class' | 'faculty' | 'hierarchy'>('class');

  // Modals State
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isExamImportOpen, setIsExamImportOpen] = useState<boolean>(false);
  const [isPeriodsModalOpen, setIsPeriodsModalOpen] = useState<boolean>(false);
  const [focusPeriodId, setFocusPeriodId] = useState<number | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [isCreateSectionOpen, setIsCreateSectionOpen] = useState<boolean>(false);
  const [selectedEntryToEdit, setSelectedEntryToEdit] = useState<TimetableEntry | null>(null);
  const [defaultSlotForNewEntry, setDefaultSlotForNewEntry] = useState<{ day: number; period: TimetablePeriod | null }>({
    day: 0,
    period: null,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [vRes, pRes, eRes, fRes, hRes] = await Promise.all([
        apiClient.get<TimetableVersion[]>('/timetables/versions'),
        apiClient.get<TimetablePeriod[]>('/timetables/periods'),
        apiClient.get<TimetableEntry[]>('/timetables/active/entries'),
        apiClient.get<Faculty[]>('/faculty'),
        apiClient.get<YearHierarchyItem[]>('/timetables/hierarchy'),
      ]);
      setVersions(vRes?.data || []);
      setPeriods(pRes?.data || []);
      setEntries(eRes?.data || []);
      setFacultyList(fRes?.data || []);
      setHierarchy(hRes?.data || []);
    } catch (err) {
      console.error('Failed to load timetables and hierarchy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleActivateVersion = async (versionId: number) => {
    try {
      await apiClient.post(`/timetables/versions/${versionId}/activate`);
      fetchAllData();
    } catch (err) {
      console.error('Failed to activate version:', err);
    }
  };

  // Get real sections filtered by selected Year and Course
  const availableSections: SectionHierarchyItem[] = useMemo(() => {
    const list: SectionHierarchyItem[] = [];
    (hierarchy || []).forEach((y) => {
      if (selectedYear !== 'ALL' && String(y.year_level) !== selectedYear) return;
      (y.courses || []).forEach((c) => {
        if (selectedCourse !== 'ALL' && c.code !== selectedCourse) return;
        (c.sections || []).forEach((s) => {
          list.push(s);
        });
      });
    });
    return list;
  }, [hierarchy, selectedYear, selectedCourse]);

  // Selected Section Object
  const currentSection = useMemo(() => {
    if (!selectedSectionId) return null;
    return availableSections.find((s) => String(s.id) === selectedSectionId) || null;
  }, [availableSections, selectedSectionId]);

  // Active timetable version
  const activeVersion = (versions || []).find((v) => v.is_active) || versions[0];

  // Displayed entries based on active view mode
  const displayedEntries = useMemo(() => {
    if (viewMode === 'faculty') {
      if (!selectedFacultyId) return entries;
      return (entries || []).filter((e) => e && e.faculty_id === Number(selectedFacultyId));
    }
    if (currentSection) {
      return (entries || []).filter((e) => e && e.class_section_id === currentSection.id);
    }
    if (availableSections.length > 0) {
      const allowedIds = new Set(availableSections.map((s) => s.id));
      return (entries || []).filter((e) => e && allowedIds.has(e.class_section_id));
    }
    return [];
  }, [entries, viewMode, selectedFacultyId, currentSection, availableSections]);

  const handleOpenAddEntry = (day: number, period: TimetablePeriod) => {
    setSelectedEntryToEdit(null);
    setDefaultSlotForNewEntry({ day, period });
    setIsEntryModalOpen(true);
  };

  const handleOpenEditEntry = (entry: TimetableEntry) => {
    setSelectedEntryToEdit(entry);
    setIsEntryModalOpen(true);
  };

  const handleOpenEditPeriod = (period: TimetablePeriod) => {
    setFocusPeriodId(period?.id || null);
    setIsPeriodsModalOpen(true);
  };

  const handleSectionCreated = (newSection: SectionHierarchyItem) => {
    fetchAllData();
    if (newSection) {
      setSelectedYear(String(newSection.year_level || 1));
      setSelectedCourse(newSection.department_code || 'CSE');
      setSelectedSectionId(String(newSection.id));
      setViewMode('class');
    }
  };

  return (
    <div className="space-y-5 text-slate-800 animate-in fade-in duration-150">
      {/* 1. Header & Management Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-brand-600" />
            <h1 className="text-lg font-bold text-slate-900">Admin Timetable Explorer</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Progressive management of Class & Faculty schedules across 6 Canonical Courses with Universal Timings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFocusPeriodId(null);
              setIsPeriodsModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center space-x-1.5 border border-slate-200 cursor-pointer shadow-2xs"
            title="Edit centralized period start/end timings across the institution"
          >
            <Clock className="w-3.5 h-3.5 text-brand-600" />
            <span>Period Timings</span>
          </button>
          <button
            onClick={() => setIsExamImportOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Upload Exam Timetable</span>
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Timetable</span>
          </button>
        </div>
      </div>

      {/* 2. Timetable Version Selector Bar */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-slate-500 font-bold">
            <Layers className="w-3.5 h-3.5 text-brand-600" />
            <span>Semester Version:</span>
          </div>
          {(versions || []).map((v) => (
            <button
              key={v.id}
              onClick={() => handleActivateVersion(v.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                v.is_active
                  ? 'bg-brand-50 text-brand-800 border-brand-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{v.name}</span>
              {v.is_active && <span className="ml-1 text-emerald-600 font-bold">✓ Active</span>}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-slate-400 font-medium">
          {activeVersion ? `${activeVersion.total_entries} Active Lecture Slots` : 'No active version'}
        </div>
      </div>

      {/* 3. Compact Progressive Selection Filter Box */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        {/* Top View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => {
                setViewMode('class');
                setSelectedFacultyId('');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'class' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Class Timetable
            </button>
            <button
              onClick={() => {
                setViewMode('faculty');
                setSelectedSectionId('');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'faculty' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faculty Schedule
            </button>
            <button
              onClick={() => {
                setViewMode('hierarchy');
                setSelectedSectionId('');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'hierarchy' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Years & Courses Overview
            </button>
          </div>

          {/* Quick Create Section Button */}
          <button
            onClick={() => setIsCreateSectionOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-brand-600" />
            <span>+ Create Section</span>
          </button>
        </div>

        {/* Faculty View Mode Selector */}
        {viewMode === 'faculty' && (
          <div className="flex items-center space-x-3 pt-1">
            <span className="text-xs font-bold text-slate-600">Faculty Member:</span>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              className="text-xs rounded-xl border border-slate-200 p-2 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-hidden min-w-[280px]"
            >
              <option value="">All Faculty Schedules ({(facultyList || []).length})</option>
              {(facultyList || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.faculty_id}) — {f.department_code || f.designation}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Progressive 3-Column Hierarchy Filter (Year -> Course -> Class/Section) */}
        {viewMode !== 'faculty' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
            {/* 1. Academic Year Dropdown */}
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                <span className="flex items-center space-x-1">
                  <GraduationCap className="w-3.5 h-3.5 text-brand-600" />
                  <span>Academic Year</span>
                </span>
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedSectionId('');
                }}
                className="w-full rounded-xl border border-slate-200 p-2 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y.val} value={y.val}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Canonical Course Dropdown */}
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                <span className="flex items-center space-x-1">
                  <Building className="w-3.5 h-3.5 text-brand-600" />
                  <span>Course</span>
                </span>
              </label>
              <select
                value={selectedCourse}
                onChange={(e) => {
                  setSelectedCourse(e.target.value);
                  setSelectedSectionId('');
                }}
                className="w-full rounded-xl border border-slate-200 p-2 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
              >
                <option value="ALL">All Courses</option>
                {CANONICAL_COURSES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Class / Section Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-600">
                  <span className="flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-brand-600" />
                    <span>Class / Section</span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreateSectionOpen(true)}
                  className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                >
                  + Create
                </button>
              </div>

              {availableSections.length > 0 ? (
                <select
                  value={selectedSectionId}
                  onChange={(e) => {
                    setSelectedSectionId(e.target.value);
                    setViewMode('class');
                  }}
                  className="w-full rounded-xl border border-slate-200 p-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
                >
                  <option value="">All Filtered Sections ({availableSections.length})</option>
                  {availableSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name} ({sec.total_entries} slots) — {sec.department_code}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2 rounded-xl border border-dashed border-amber-200 bg-amber-50 text-amber-800 text-[11px] flex items-center justify-between">
                  <span>No sections yet</span>
                  <button
                    type="button"
                    onClick={() => setIsCreateSectionOpen(true)}
                    className="font-bold text-amber-900 underline hover:text-amber-700 cursor-pointer"
                  >
                    Create
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Hierarchy Overview Mode */}
      {viewMode === 'hierarchy' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FolderTree className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Institutional Timetable Hierarchy Map</h2>
            </div>
            <button
              onClick={() => setIsCreateSectionOpen(true)}
              className="px-3 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-bold transition-colors cursor-pointer"
            >
              + Create Section
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(hierarchy || []).map((yearItem) => (
              <div
                key={yearItem.year_level}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="font-bold text-xs text-slate-900">{yearItem.roman_label}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Academic Year {yearItem.year_level}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {(yearItem.courses || []).map((course) => (
                    <div
                      key={course.code}
                      className="p-2 rounded-lg bg-white border border-slate-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-xs text-brand-900">{course.code}</span>
                        <span className="text-[10px] text-slate-500 line-clamp-1">— {course.name}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {(course.sections || []).length > 0 ? (
                          course.sections.map((sec) => (
                            <button
                              key={sec.id}
                              onClick={() => {
                                setSelectedYear(String(yearItem.year_level));
                                setSelectedCourse(course.code);
                                setSelectedSectionId(String(sec.id));
                                setViewMode('class');
                              }}
                              className="px-2 py-0.5 rounded bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-800 text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              {sec.name} ({sec.total_entries})
                            </button>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No sections</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Class or Faculty Timetable View */}
      {viewMode !== 'hierarchy' && (
        <div className="space-y-3">
          {/* Compact Context Header */}
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <GraduationCap className="w-4 h-4 text-brand-400" />
                <h3 className="font-bold text-xs">
                  {viewMode === 'faculty'
                    ? selectedFacultyId
                      ? `${(facultyList || []).find((f) => String(f.id) === selectedFacultyId)?.name || 'Faculty'} Schedule`
                      : 'All Faculty Schedules Overview'
                    : currentSection
                    ? `${currentSection.name} Timetable`
                    : 'Class / Section Timetable'}
                </h3>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
                {viewMode === 'class' && (
                  <>
                    <span>
                      {selectedYear === 'ALL'
                        ? 'All Years'
                        : ACADEMIC_YEARS.find((y) => y.val === selectedYear)?.label}
                    </span>
                    <span>•</span>
                    <span>{selectedCourse === 'ALL' ? 'All Courses' : selectedCourse}</span>
                    <span>•</span>
                    <span>{currentSection ? currentSection.name : 'All Displayed'}</span>
                  </>
                )}
                <span>•</span>
                <span>Version: {activeVersion ? activeVersion.name : 'None'}</span>
              </div>
            </div>

            {viewMode === 'class' && currentSection && (
              <button
                onClick={() => handleOpenAddEntry(0, (periods && periods[0]) || null)}
                className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer self-start sm:self-auto shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Class Slot</span>
              </button>
            )}
          </div>

          {/* Timetable Schedule Grid (Horizontal Period Header, Vertical Days) */}
          <TimetableScheduleGrid
            entries={displayedEntries}
            periods={periods}
            viewMode={viewMode}
            isAdmin={true}
            onEditEntry={handleOpenEditEntry}
            onAddEntry={handleOpenAddEntry}
            onEditPeriod={handleOpenEditPeriod}
          />

          {/* Clean Empty State */}
          {displayedEntries.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 space-y-2.5">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-xs text-slate-700">
                {currentSection
                  ? `No Timetable Slots for ${currentSection.name} Yet`
                  : 'No Timetable Slots Configured'}
              </h4>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                {currentSection
                  ? 'Click "Add Class Slot" above or import a schedule to start populating this class timetable.'
                  : availableSections.length === 0
                  ? 'No sections exist for the selected year and course. Click "+ Create Section" above to add a section.'
                  : 'Select a specific section or click "Import Timetable" to populate active lecture schedules.'}
              </p>
              {availableSections.length === 0 && (
                <button
                  onClick={() => setIsCreateSectionOpen(true)}
                  className="mt-2 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Create Section</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. Modals */}
      <CreateSectionModal
        isOpen={isCreateSectionOpen}
        onClose={() => setIsCreateSectionOpen(false)}
        defaultYear={selectedYear !== 'ALL' ? Number(selectedYear) : 1}
        defaultCourseCode={selectedCourse !== 'ALL' ? selectedCourse : 'CSE'}
        onSuccess={handleSectionCreated}
      />

      <PeriodTimingsModal
        isOpen={isPeriodsModalOpen}
        onClose={() => setIsPeriodsModalOpen(false)}
        periods={periods}
        focusPeriodId={focusPeriodId}
        onSuccess={fetchAllData}
      />

      <TimetableEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        entry={selectedEntryToEdit}
        defaultDay={defaultSlotForNewEntry.day}
        defaultPeriod={defaultSlotForNewEntry.period}
        classSectionId={currentSection?.id || (availableSections[0]?.id || 1)}
        classNameStr={currentSection?.name || 'Class'}
        periods={periods}
        facultyList={facultyList}
        onSuccess={fetchAllData}
      />

      <TimetableImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchAllData}
      />

      <ExamTimetableUploadWizard
        isOpen={isExamImportOpen}
        onClose={() => setIsExamImportOpen(false)}
        onSuccess={fetchAllData}
      />
    </div>
  );
};
