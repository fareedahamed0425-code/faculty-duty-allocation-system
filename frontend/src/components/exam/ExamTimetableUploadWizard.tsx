import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import { FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface ExamTimetableUploadWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ExamTimetableUploadWizard: React.FC<ExamTimetableUploadWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<any>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewData(null);
      setStep('upload');
      setErrorMessage(null);
      setCompletionResult(null);
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

  const handleDownloadTemplate = async () => {
    try {
      const res = await apiClient.get('/exam-duties/template/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'exam_timetable_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download exam template:', err);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setErrorMessage('Please select an Exam Timetable CSV or Excel file.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/exam-duties/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(res.data);
      setStep('preview');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to parse exam timetable file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || (!previewData.all_valid_entries && !previewData.preview_entries)) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const entriesToImport = previewData.all_valid_entries || previewData.preview_entries;
      const res = await apiClient.post('/exam-duties/import/confirm', {
        entries: entriesToImport,
      });
      setCompletionResult(res.data);
      setStep('complete');
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to dispatch exam duties.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Institutional Exam Timetable Batch Pipeline"
      subtitle="Upload full exam schedules, auto-balance invigilator allocations, and dispatch unified notifications."
      maxWidth="4xl"
    >
      {step === 'upload' && (
        <div className="space-y-5">
          {/* Drag & Drop Area */}
          <div className="border-2 border-dashed border-slate-300 hover:border-[#0e3b4b] rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-sky-50/30 transition-all cursor-pointer">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              id="exam-tt-file-input"
            />
            <label htmlFor="exam-tt-file-input" className="cursor-pointer block">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {file ? file.name : 'Click to select Exam Timetable (CSV or Excel)'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supported columns: Exam Name, Course Code, Subject Name, Section, Date, Time Slot, Venue, Invigilators Count
              </p>
            </label>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
            <div className="flex items-center space-x-2 text-amber-950 font-medium">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Need the institutional examination schedule template with prefilled sessions?</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              Download Sample CSV
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAnalyze}
              disabled={isUploading || !file}
              className="px-5 py-2 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <span>{isUploading ? 'Validating Exam Schedule...' : 'Analyze & Validate'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div className="space-y-5">
          {/* Diagnostics Bar */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Total Exam Sessions</span>
              <p className="text-xl font-bold text-slate-900">{previewData.total_rows}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-xs text-emerald-700 font-medium">Valid Exam Slots</span>
              <p className="text-xl font-bold text-emerald-800">{previewData.valid_rows_count}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-xs text-amber-700 font-medium">Auto-Balance Engine</span>
              <p className="text-xl font-bold text-amber-800">Dynamic 0-Conflict</p>
            </div>
          </div>

          {previewData.errors.length > 0 && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs max-h-28 overflow-y-auto">
              <p className="font-bold text-rose-900 mb-1">Rows Excluded Due to Formatting Issues:</p>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                {previewData.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Course & Semester Multi-Tier Segregation Breakdown */}
          {(previewData.course_breakdown || previewData.semester_breakdown) && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-700 mr-1 text-[11px]">Segregated Courses:</span>
                {Object.entries(previewData.course_breakdown || {}).map(([c, cnt]: [string, any]) => (
                  <span key={c} className="px-2 py-0.5 rounded-md bg-[#0e3b4b] text-white font-bold text-[10px]">
                    {c}: {cnt} Exam(s)
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-700 mr-1 text-[11px]">Semesters / Years:</span>
                {Object.entries(previewData.semester_breakdown || {}).map(([s, cnt]: [string, any]) => (
                  <span key={s} className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-900 font-semibold text-[10px] border border-sky-200">
                    {s}: {cnt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Exam Schedule Preview Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Exam, Course & Semester</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Session Timing</th>
                  <th className="p-2.5">Assigned Venue</th>
                  <th className="p-2.5">Invigilation Strategy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(previewData.preview_entries || []).map((e: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-extrabold text-[10px]">
                          {e.department_code || 'CSE'}
                        </span>
                        <span className="font-bold text-slate-900 block">{e.course_name} ({e.course_code})</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {e.exam_name} • Sem {e.semester || 1} (Year {e.academic_year || 1}) • {e.class_section}
                      </span>
                    </td>
                    <td className="p-2.5 font-medium text-slate-800">{e.date}</td>
                    <td className="p-2.5">
                      <span className="font-bold text-slate-800 block">{e.exam_start_time} - {e.exam_end_time}</span>
                      <span className="text-[10px] text-amber-800 font-medium">Report: {e.reporting_time}</span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-700">{e.venue}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-bold text-[10px]">
                        {e.faculty_assigned === 'DYNAMIC' ? `⚡ Dynamic (${e.invigilators_count} Staff)` : e.faculty_assigned}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-900 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-sky-700 shrink-0" />
            <span>
              During confirmation, the Dynamic Allocation Engine evaluates live absences, exam overlaps, neutrality balancing, and timetable collisions to allocate faculty members and immediately push alerts.
            </span>
          </div>

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
              className="px-5 py-2 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Allocating & Dispatching...' : `⚡ Commit & Dynamically Dispatch (${previewData.valid_rows_count} Exams)`}
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && completionResult && (
        <div className="text-center py-6 space-y-4">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Exam Timetable Processed & Dispatched!</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
              {completionResult.message}
            </p>
          </div>
          <div className="flex justify-center pt-2">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              Done & Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
