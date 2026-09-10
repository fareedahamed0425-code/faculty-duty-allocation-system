import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import { 
  FileSpreadsheet, 
  ArrowRight, 
  Layers, 
  GraduationCap, 
  BookOpen, 
  Users, 
  MapPin, 
  CheckCircle2, 
  Sparkles, 
  Filter,
  Calendar,
  AlertTriangle,
  XCircle
} from 'lucide-react';

interface TimetableImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TimetableImportWizard: React.FC<TimetableImportWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [versionName, setVersionName] = useState<string>('2026-27 Semester V Timetable');
  const [academicYear, setAcademicYear] = useState<string>('2026-27');
  const [semester, setSemester] = useState<number>(5);
  const [activateNow, setActivateNow] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewData(null);
      setStep('upload');
      setErrorMessage(null);
      setSelectedClass('ALL');
      setIsUploading(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setErrorMessage('Please select a CSV or Excel file.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/timetables/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(res.data);
      setSelectedClass('ALL');
      if (res.data.filename) {
        const cleanName = res.data.filename.replace(/\.[^/.]+$/, '').replace(/[\(\)]/g, '');
        setVersionName(`${cleanName} Version`);
      }
      setStep('preview');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to parse timetable file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await apiClient.get('/timetables/template/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'timetable_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download template:', err);
    }
  };

  const handleConfirmImport = async () => {
    const entriesToImport = previewData?.all_valid_entries || previewData?.preview_entries;
    if (!previewData || !entriesToImport || entriesToImport.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await apiClient.post('/timetables/import/confirm', {
        version_name: versionName,
        academic_year: academicYear,
        semester: semester,
        activate_immediately: activateNow,
        entries: entriesToImport,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to commit timetable version.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extract classes summary & available class list
  const classesList = useMemo(() => {
    if (!previewData) return [];
    if (previewData.classes_summary && previewData.classes_summary.length > 0) {
      return previewData.classes_summary;
    }
    const entries = previewData.all_valid_entries || previewData.preview_entries || [];
    const groups: { [key: string]: any } = {};
    for (const e of entries) {
      const c = e.class_name || 'General';
      if (!groups[c]) {
        groups[c] = {
          class_name: c,
          total_periods: 0,
          room_number: e.room_number || 'Room-101',
          subjects: new Set(),
          faculty: new Set()
        };
      }
      groups[c].total_periods++;
      if (e.subject_code) groups[c].subjects.add(e.subject_code);
      if (e.faculty_name) groups[c].faculty.add(e.faculty_name);
    }
    return Object.values(groups).map((g: any) => ({
      ...g,
      subjects_count: g.subjects.size,
      subjects: Array.from(g.subjects),
      faculty_count: g.faculty.size,
      faculty: Array.from(g.faculty)
    }));
  }, [previewData]);

  // Filter entries according to active class tab
  const filteredEntries = useMemo(() => {
    if (!previewData) return [];
    const all = previewData.all_valid_entries || previewData.preview_entries || [];
    if (selectedClass === 'ALL') return all;
    return all.filter((e: any) => e.class_name === selectedClass);
  }, [previewData, selectedClass]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Multi-Class Timetable Ingestion Engine"
      subtitle="AI & institutional matrix scanner with automatic multi-sheet class segregation & auto-provisioning."
      maxWidth="4xl"
    >
      {step === 'upload' && (
        <div className="space-y-5">
          {/* Drag & Drop Area */}
          <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl p-8 text-center bg-gradient-to-b from-indigo-50/40 to-slate-50/60 hover:from-indigo-50/80 transition-all cursor-pointer group shadow-inner">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              id="tt-file-input"
            />
            <label htmlFor="tt-file-input" className="cursor-pointer block">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <p className="text-base font-bold text-slate-800">
                {file ? file.name : 'Upload Multi-Sheet Institutional Timetable (.xlsx, .xls, .csv)'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                Upload your master Excel file containing multiple sheets (one sheet per class / section).
                Our institutional AI engine automatically segregates each sheet into its respective class section, resolves periods, and enrolls teachers.
              </p>
              {file && (
                <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> File Selected ({(file.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </label>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs">
            <div className="flex items-center space-x-2 text-blue-900">
              <FileSpreadsheet className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Need the standard multi-column spreadsheet format?</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-blue-700 hover:bg-blue-100 font-semibold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              Download Sample CSV
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAnalyze}
              disabled={isUploading || !file}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isUploading ? 'Scanning & Segregating Sheets...' : 'Analyze & Segregate Classes'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div className="space-y-5">
          {/* Diagnostic Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/80">
              <span className="text-xs text-indigo-700 font-semibold flex items-center justify-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Segregated Classes
              </span>
              <p className="text-xl font-black text-indigo-950 mt-0.5">{classesList.length}</p>
            </div>
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
              <span className="text-xs text-emerald-700 font-semibold flex items-center justify-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Total Valid Periods
              </span>
              <p className="text-xl font-black text-emerald-950 mt-0.5">{previewData.valid_rows_count}</p>
            </div>
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
              <span className="text-xs text-amber-700 font-semibold flex items-center justify-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Warnings / New Entities
              </span>
              <p className="text-xl font-black text-amber-950 mt-0.5">{previewData.warning_count || 0}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 font-semibold flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sheets Scanned
              </span>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {previewData.sheets_scanned?.length || 1}
              </p>
            </div>
          </div>

          {/* AI Scanner Banner */}
          {previewData.sheets_scanned && (
            <div className="p-3.5 bg-gradient-to-r from-sky-50 to-indigo-50/60 rounded-2xl border border-sky-200/90 text-xs text-sky-950 flex items-start space-x-3 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 font-black shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-950 text-sm">
                    Multi-Class Segregation Successful
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-bold text-[10px]">
                    {previewData.sheets_scanned.length} Sheets Detected
                  </span>
                </div>
                <p className="text-slate-600 mt-0.5">
                  Extracted sheets: <strong>{previewData.sheets_scanned.join(', ')}</strong>. Every sheet has been segregated into its distinct class section with teachers, rooms, and time periods automatically structured.
                </p>
              </div>
            </div>
          )}

          {/* Segregated Class Cards Grid */}
          {classesList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  Segregated Class Sections ({classesList.length}):
                </span>
                <span className="text-slate-500 text-[11px]">Click a class card or tab below to inspect its timetable</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {classesList.map((cls: any, i: number) => {
                  const isSelected = selectedClass === cls.class_name;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedClass(isSelected ? 'ALL' : cls.class_name)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300' 
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`font-black text-sm block ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {cls.class_name}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {cls.total_periods} periods
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 text-[11px] mt-1.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{cls.room_number || 'Room-101'}</span>
                      </div>
                      <div className={`mt-2 text-[10px] flex items-center justify-between ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                        <span>{cls.subjects_count || cls.subjects?.length || 0} Subjects</span>
                        <span>{cls.faculty_count || cls.faculty?.length || 0} Faculty</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Class Filter Tabs & Schedule Preview Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedClass('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                    selectedClass === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  All Classes ({previewData.valid_rows_count})
                </button>
                {classesList.map((cls: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedClass(cls.class_name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                      selectedClass === cls.class_name
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cls.class_name} ({cls.total_periods})
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                Showing {filteredEntries.length} periods
              </span>
            </div>

            {/* Timetable Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto shadow-inner bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 backdrop-blur text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-2.5">Class / Section</th>
                    <th className="p-2.5">Day</th>
                    <th className="p-2.5">Time Slot</th>
                    <th className="p-2.5">Subject</th>
                    <th className="p-2.5">Faculty In-Charge</th>
                    <th className="p-2.5">Room</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.map((e: any, idx: number) => (
                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-2.5 font-bold text-slate-900">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md border border-slate-200">
                          {e.class_name}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-700 font-medium">
                        {days[e.day_of_week] || 'Monday'}
                      </td>
                      <td className="p-2.5 font-mono font-semibold text-indigo-950">
                        {e.start_time} - {e.end_time}
                      </td>
                      <td className="p-2.5">
                        <span className="font-bold text-slate-800 block">{e.subject_code}</span>
                        <span className="text-[10px] text-slate-500">{e.subject_name}</span>
                      </td>
                      <td className="p-2.5 text-slate-700 font-medium">
                        {e.faculty_name}
                      </td>
                      <td className="p-2.5 text-slate-500">
                        {e.room_number || 'Room-101'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Version Configuration Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Timetable Version Name
              </label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-medium shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Academic Year
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-medium shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activateNow}
                  onChange={(e) => setActivateNow(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>Activate Immediately for Substitutions & Duties</span>
              </label>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Back to Upload
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={isSubmitting || previewData.valid_rows_count === 0}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Saving to Database...' : `Save & Commit ${classesList.length} Classes (${previewData.valid_rows_count} Periods)`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
