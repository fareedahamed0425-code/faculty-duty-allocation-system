import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, ShieldAlert, ArrowRight } from 'lucide-react';

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
  const [versionName, setVersionName] = useState<string>('2026 Semester 2 (Imported)');
  const [academicYear, setAcademicYear] = useState<string>('2026');
  const [semester, setSemester] = useState<number>(2);
  const [activateNow, setActivateNow] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

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
      setStep('preview');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to parse timetable file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !previewData.preview_entries) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await apiClient.post('/timetables/import/confirm', {
        version_name: versionName,
        academic_year: academicYear,
        semester: semester,
        activate_immediately: activateNow,
        entries: previewData.preview_entries,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to commit timetable version.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Institutional Timetable Import Pipeline"
      subtitle="Parse, validate, diagnose conflicts, and create a versioned timetable."
      maxWidth="3xl"
    >
      {step === 'upload' && (
        <div className="space-y-5">
          {/* Drag & Drop Area */}
          <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-brand-50/20 transition-all cursor-pointer">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              id="tt-file-input"
            />
            <label htmlFor="tt-file-input" className="cursor-pointer block">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {file ? file.name : 'Click to select CSV or Excel timetable'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Required columns: faculty_code, class_name, subject_code, day, start_time, end_time
              </p>
            </label>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleAnalyze}
              disabled={isUploading || !file}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <span>{isUploading ? 'Validating File...' : 'Analyze & Validate'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div className="space-y-5">
          {/* Validation Diagnostics Bar */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Total Rows</span>
              <p className="text-xl font-bold text-slate-900">{previewData.total_rows}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-xs text-emerald-700 font-medium">Valid Entries</span>
              <p className="text-xl font-bold text-emerald-800">{previewData.valid_rows_count}</p>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-xs text-rose-700 font-medium">Errors</span>
              <p className="text-xl font-bold text-rose-800">{previewData.error_count}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-xs text-amber-700 font-medium">Conflicts</span>
              <p className="text-xl font-bold text-amber-800">{previewData.conflict_count}</p>
            </div>
          </div>

          {/* Errors or Conflicts Notice */}
          {previewData.errors.length > 0 && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs max-h-32 overflow-y-auto">
              <p className="font-bold text-rose-900 mb-1">Validation Errors (These rows will be excluded):</p>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                {previewData.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {previewData.conflicts.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs max-h-32 overflow-y-auto">
              <p className="font-bold text-amber-900 mb-1">Overlapping Timetable Conflicts Detected:</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                {previewData.conflicts.map((c: any, i: number) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Version Configuration Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Version Name
              </label>
              <input
                type="text"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Academic Year
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activateNow}
                  onChange={(e) => setActivateNow(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Activate Immediately</span>
              </label>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              Back to Upload
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={isSubmitting || previewData.valid_rows_count === 0}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              {isSubmitting ? 'Creating Version...' : `Commit Version (${previewData.valid_rows_count} entries)`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
