import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
  Search,
  Filter,
  Users,
  ShieldCheck,
  RefreshCw,
  Edit2,
  Check,
  X,
  ArrowRight,
  Info
} from 'lucide-react';

interface FacultyUploadWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PreviewItem {
  temp_id: number;
  faculty_id: string;
  name: string;
  email: string;
  phone: string;
  department_id: number;
  department_code: string;
  department_name: string;
  designation: string;
  role_id: number | null;
  role_name: string;
  is_exempt: boolean;
  is_substitution_eligible: boolean;
  max_weekly_substitutions: number;
  subject_expertise: string[];
  status_tag: 'NEW' | 'UPDATE';
  status_detail: string;
  matched_user_id: number | null;
  matched_user_email: string | null;
}

export const FacultyUploadWizard: React.FC<FacultyUploadWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTag, setFilterTag] = useState<'ALL' | 'NEW' | 'UPDATE'>('ALL');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [commitSummary, setCommitSummary] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setIsScanning(false);
      setIsCommitting(false);
      setStep('upload');
      setErrorMessage(null);
      setPreviewData(null);
      setItems([]);
      setSearchQuery('');
      setFilterTag('ALL');
      setEditingId(null);
      setCommitSummary(null);
    }
  }, [isOpen]);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setErrorMessage(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await apiClient.get('/faculty/template/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'faculty_roster_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download template:', err);
      alert('Unable to download template at this time.');
    }
  };

  const handleScanFile = async () => {
    if (!file) {
      setErrorMessage('Please select an Excel or CSV file first.');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/faculty/upload-ai/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(res.data);
      setItems(res.data.preview_items || []);
      setStep('preview');
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to scan and parse faculty file.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpdateItemField = (tempId: number, field: keyof PreviewItem, val: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.temp_id === tempId) {
          const updated = { ...item, [field]: val };
          if (field === 'is_exempt' && val === true) {
            updated.is_substitution_eligible = false;
            updated.max_weekly_substitutions = 0;
          } else if (field === 'is_exempt' && val === false) {
            updated.is_substitution_eligible = true;
            updated.max_weekly_substitutions = 4;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleCommit = async () => {
    if (items.length === 0) {
      setErrorMessage('No faculty items to import.');
      return;
    }

    setIsCommitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post('/faculty/upload-ai/commit', {
        faculty_entries: items,
      });
      setCommitSummary(res.data);
      setStep('success');
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to commit faculty import.');
    } finally {
      setIsCommitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.faculty_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.designation.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag = filterTag === 'ALL' || item.status_tag === filterTag;
    return matchesSearch && matchesTag;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Faculty List & AI Auto-Sync"
      maxWidth="4xl"
    >

      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-6 text-xs">
            <div
              className={`flex items-center space-x-2 font-bold ${
                step === 'upload' ? 'text-[#2582a1]' : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                  step === 'upload'
                    ? 'bg-[#2582a1] text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                1
              </div>
              <span>Upload Document</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

            <div
              className={`flex items-center space-x-2 font-bold ${
                step === 'preview' ? 'text-[#2582a1]' : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                  step === 'preview'
                    ? 'bg-[#2582a1] text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                2
              </div>
              <span>AI Review & Verify ({items.length})</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />

            <div
              className={`flex items-center space-x-2 font-bold ${
                step === 'success' ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                  step === 'success'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                3
              </div>
              <span>Complete</span>
            </div>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="text-xs font-semibold text-[#2582a1] hover:text-[#1c6b86] flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#f0f9fb] border border-[#bee3ee] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sample CSV Template</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-5">
            {/* Auto-sync Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#f0f9fb] to-[#e4f4f8] border border-[#bee3ee] text-[#0e3b4b] text-xs flex items-start space-x-3 shadow-2xs">
              <Sparkles className="w-5 h-5 text-[#2582a1] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Intelligent Roster Extraction & Instant Sync</p>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Upload your institution's faculty roster (Excel <code className="bg-white/80 px-1 py-0.5 rounded text-[#2582a1] font-mono">.xlsx</code>, <code className="bg-white/80 px-1 py-0.5 rounded text-[#2582a1] font-mono">.csv</code>, or list document).
                  Our AI scans the document to extract names, emails, departments, roles, and subject specializations.
                  <strong> When a faculty member registers or logs in with their credentials, their account will instantly auto-sync with their pre-loaded profile!</strong>
                </p>
              </div>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                file
                  ? 'border-[#2582a1] bg-[#f0f9fb]/50'
                  : 'border-slate-300 hover:border-[#2582a1] bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                id="faculty-file-upload"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="faculty-file-upload"
                className="cursor-pointer flex flex-col items-center justify-center space-y-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#2582a1]">
                  {file ? (
                    <FileSpreadsheet className="w-7 h-7 text-[#2582a1]" />
                  ) : (
                    <UploadCloud className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {file ? file.name : 'Click to upload or drag & drop faculty list'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV spreadsheets
                  </p>
                </div>
                {file && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#2582a1]/10 text-[#2582a1]">
                    {(file.size / 1024).toFixed(1)} KB • Ready to Analyze
                  </span>
                )}
              </label>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!file || isScanning}
                onClick={handleScanFile}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-all flex items-center space-x-2 cursor-pointer ${
                  !file || isScanning
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-[#2582a1] hover:bg-[#1c6b86]'
                }`}
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI Scanning Roster...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Scan & Preview with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & VERIFY */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* Stats Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Detected</span>
                <span className="text-lg font-black text-slate-800">{items.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">New Faculty</span>
                <span className="text-lg font-black text-emerald-800">
                  {items.filter((i) => i.status_tag === 'NEW').length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-600 block">To Update</span>
                <span className="text-lg font-black text-amber-800">
                  {items.filter((i) => i.status_tag === 'UPDATE').length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#f0f9fb] border border-[#bee3ee]">
                <span className="text-[10px] uppercase font-bold text-[#2582a1] block">User Accounts Linked</span>
                <span className="text-lg font-black text-[#0e3b4b]">
                  {items.filter((i) => i.matched_user_id !== null).length}
                </span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by name, email, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-white rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#2582a1]"
                />
              </div>

              <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setFilterTag('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    filterTag === 'ALL'
                      ? 'bg-[#2582a1] text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTag('NEW')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    filterTag === 'NEW'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  New ({items.filter((i) => i.status_tag === 'NEW').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTag('UPDATE')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    filterTag === 'UPDATE'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  Updates ({items.filter((i) => i.status_tag === 'UPDATE').length})
                </button>
              </div>
            </div>

            {/* Table of Preview Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f0f9fb] border-b border-[#bee3ee] text-[#0e3b4b] font-bold sticky top-0 uppercase tracking-wider text-[10px] z-10">
                  <tr>
                    <th className="p-3">Status</th>
                    <th className="p-3">Faculty Member</th>
                    <th className="p-3">Department & Designation</th>
                    <th className="p-3 text-center">Exempt</th>
                    <th className="p-3 text-center">Eligible</th>
                    <th className="p-3">Specialization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredItems.map((item) => (
                    <tr key={item.temp_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 align-middle">
                        <div className="flex flex-col space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold w-fit ${
                              item.status_tag === 'NEW'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.status_tag}
                          </span>
                          {item.matched_user_id && (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              User Linked
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'name', e.target.value)}
                          className="font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-[#2582a1] focus:outline-hidden w-full text-xs"
                        />
                        <input
                          type="text"
                          value={item.email}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'email', e.target.value)}
                          className="text-[11px] text-slate-500 font-mono border-b border-transparent hover:border-slate-300 focus:border-[#2582a1] focus:outline-hidden w-full"
                        />
                      </td>

                      <td className="p-3">
                        <span className="font-semibold text-slate-800 block text-xs">
                          {item.department_name} ({item.department_code})
                        </span>
                        <input
                          type="text"
                          value={item.designation}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'designation', e.target.value)}
                          className="text-[11px] text-slate-500 border-b border-transparent hover:border-slate-300 focus:border-[#2582a1] focus:outline-hidden w-full"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.is_exempt}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'is_exempt', e.target.checked)}
                          className="rounded text-[#2582a1] focus:ring-[#2582a1] cursor-pointer"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.is_substitution_eligible}
                          onChange={(e) => handleUpdateItemField(item.temp_id, 'is_substitution_eligible', e.target.checked)}
                          className="rounded text-[#2582a1] focus:ring-[#2582a1] cursor-pointer"
                        />
                      </td>

                      <td className="p-3">
                        <span className="text-[11px] text-slate-600 line-clamp-2">
                          {item.subject_expertise && item.subject_expertise.length > 0
                            ? item.subject_expertise.join(', ')
                            : 'General Teaching'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Back to Upload
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCommitting || items.length === 0}
                  onClick={handleCommit}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-all flex items-center space-x-2 cursor-pointer ${
                    isCommitting || items.length === 0
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-[#2582a1] hover:bg-[#1c6b86]'
                  }`}
                >
                  {isCommitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Committing to Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Import {items.length} Faculty</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS */}
        {step === 'success' && commitSummary && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Faculty Import Completed!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {commitSummary.message || 'All faculty profiles have been safely synchronized into the database.'}
              </p>
            </div>

            <div className="flex justify-center gap-4 py-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 w-32 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Profiles Added</span>
                <span className="text-xl font-black text-emerald-600">{commitSummary.created_count || 0}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 w-32 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Profiles Updated</span>
                <span className="text-xl font-black text-amber-600">{commitSummary.updated_count || 0}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 w-32 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Auto-Linked</span>
                <span className="text-xl font-black text-[#2582a1]">{commitSummary.linked_count || 0}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#f0f9fb] border border-[#bee3ee] text-left text-xs text-[#0e3b4b] flex items-start space-x-2.5 max-w-lg mx-auto">
              <Info className="w-4 h-4 text-[#2582a1] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                When faculty members register or login in the portal using their institutional email or name, the system will seamlessly match and connect them to their respective profiles and substitution records.
              </p>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Close & Return to Directory
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
