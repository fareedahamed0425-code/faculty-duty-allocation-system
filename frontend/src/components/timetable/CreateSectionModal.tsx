import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import { SectionHierarchyItem } from '../../types';
import { Plus, AlertTriangle, Building, GraduationCap, Users } from 'lucide-react';

interface CreateSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultYear?: number;
  defaultCourseCode?: string;
  onSuccess: (newSection: SectionHierarchyItem) => void;
}

const CANONICAL_COURSES = [
  { code: 'CSE', name: 'Computer Science' },
  { code: 'AIDS', name: 'Artificial Intelligence & Data Science' },
  { code: 'AIML', name: 'Artificial Intelligence & Machine Learning' },
  { code: 'CS', name: 'Cyber Security' },
  { code: 'CC', name: 'Cloud Computing' },
  { code: 'AIHC', name: 'Artificial Intelligence in Health Care' },
];

const ACADEMIC_YEARS = [
  { level: 1, label: '1st Year (I)' },
  { level: 2, label: '2nd Year (II)' },
  { level: 3, label: '3rd Year (III)' },
  { level: 4, label: '4th Year (IV)' },
];

export const CreateSectionModal: React.FC<CreateSectionModalProps> = ({
  isOpen,
  onClose,
  defaultYear = 1,
  defaultCourseCode = 'CSE',
  onSuccess,
}) => {
  const [yearLevel, setYearLevel] = useState<number>(defaultYear);
  const [courseCode, setCourseCode] = useState<string>(defaultCourseCode);
  const [sectionName, setSectionName] = useState<string>('');
  const [capacity, setCapacity] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setYearLevel(defaultYear >= 1 && defaultYear <= 4 ? defaultYear : 1);
      const validCourse = CANONICAL_COURSES.some((c) => c.code === defaultCourseCode) ? defaultCourseCode : 'CSE';
      setCourseCode(validCourse);
      setSectionName('');
      setCapacity(60);
      setErrorMessage(null);
    }
  }, [isOpen, defaultYear, defaultCourseCode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sectionName ? String(sectionName).trim() : '';
    if (!cleanName) {
      setErrorMessage('Section name is required (e.g. CSE-A, AIML-1).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post<SectionHierarchyItem>('/timetables/sections', {
        name: cleanName,
        course_code: courseCode,
        year_level: yearLevel,
        semester: yearLevel * 2 - 1,
        capacity: Number(capacity) || 60,
        academic_year: '2026',
      });

      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to create class section.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Class Section">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Academic Year */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            <span className="flex items-center space-x-1">
              <GraduationCap className="w-3.5 h-3.5 text-brand-600" />
              <span>Academic Year</span>
            </span>
          </label>
          <select
            value={yearLevel}
            onChange={(e) => setYearLevel(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
          >
            {ACADEMIC_YEARS.map((y) => (
              <option key={y.level} value={y.level}>
                {y.label}
              </option>
            ))}
          </select>
        </div>

        {/* Course */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            <span className="flex items-center space-x-1">
              <Building className="w-3.5 h-3.5 text-brand-600" />
              <span>Course / Department</span>
            </span>
          </label>
          <select
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-2.5 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-hidden"
          >
            {CANONICAL_COURSES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Section Name */}
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            <span className="flex items-center space-x-1">
              <Users className="w-3.5 h-3.5 text-brand-600" />
              <span>Section Name / Cohort</span>
            </span>
          </label>
          <input
            type="text"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="e.g. CSE-A, AIML-1, AIDS-B"
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden font-medium"
            autoFocus
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Enter the unique identifier for this class cohort.
          </p>
        </div>

        {/* Capacity */}
        <div>
          <label className="block font-medium text-slate-600 mb-1">Student Capacity</label>
          <input
            type="number"
            min={1}
            max={200}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-brand-500 focus:outline-hidden font-medium"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
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
            <Plus className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Creating...' : 'Create Section'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
