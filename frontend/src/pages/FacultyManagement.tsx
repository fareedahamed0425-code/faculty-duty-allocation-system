import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Faculty, Department } from '../types';
import { Modal } from '../components/common/Modal';
import {
  Search,
  Plus,
  Edit2
} from 'lucide-react';

export const FacultyManagement: React.FC = () => {
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [eligibilityFilter, setEligibilityFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit / Add Modal State
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<any>({
    name: '',
    email: '',
    phone: '',
    department_id: '',
    designation: 'Assistant Professor',
    is_substitution_eligible: true,
    is_exempt: false,
    max_weekly_substitutions: 4,
    subject_expertise: '',
  });

  const fetchFaculty = async () => {
    setIsLoading(true);
    try {
      const [facRes, deptRes] = await Promise.all([
        apiClient.get<Faculty[]>('/faculty'),
        apiClient.get<Department[]>('/faculty/departments'),
      ]);
      setFacultyList(facRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Failed to load faculty:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const handleOpenAdd = () => {
    setSelectedFaculty(null);
    setFormData({
      faculty_id: `FAC-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      email: '',
      phone: '+91 98765 43210',
      department_id: departments[0]?.id || 1,
      designation: 'Assistant Professor',
      is_substitution_eligible: true,
      is_exempt: false,
      max_weekly_substitutions: 4,
      subject_expertise: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (f: Faculty) => {
    setSelectedFaculty(f);
    setFormData({
      name: f.name,
      email: f.email,
      phone: f.phone || '',
      department_id: f.department_id,
      designation: f.designation,
      is_substitution_eligible: f.is_substitution_eligible,
      is_exempt: f.is_exempt,
      max_weekly_substitutions: f.max_weekly_substitutions,
      subject_expertise: f.subject_expertise.join(', '),
      status: f.status,
    });
    setIsModalOpen(true);
  };

  const handleToggleExemption = async (f: Faculty) => {
    try {
      await apiClient.patch(`/faculty/${f.id}`, { is_exempt: !f.is_exempt });
      fetchFaculty();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleToggleEligibility = async (f: Faculty) => {
    try {
      await apiClient.patch(`/faculty/${f.id}`, { is_substitution_eligible: !f.is_substitution_eligible });
      fetchFaculty();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const expList = formData.subject_expertise
      ? formData.subject_expertise.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const payload = {
      ...formData,
      department_id: Number(formData.department_id),
      max_weekly_substitutions: Number(formData.max_weekly_substitutions),
      subject_expertise: expList,
    };

    try {
      if (selectedFaculty) {
        await apiClient.patch(`/faculty/${selectedFaculty.id}`, payload);
      } else {
        await apiClient.post('/faculty', payload);
      }
      setIsModalOpen(false);
      fetchFaculty();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Operation failed.');
    }
  };

  const filteredFaculty = facultyList.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.faculty_id.toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !deptFilter || f.department_id.toString() === deptFilter;
    const matchesElig =
      !eligibilityFilter ||
      (eligibilityFilter === 'exempt' && f.is_exempt) ||
      (eligibilityFilter === 'eligible' && f.is_substitution_eligible && !f.is_exempt) ||
      (eligibilityFilter === 'ineligible' && !f.is_substitution_eligible);

    return matchesSearch && matchesDept && matchesElig;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] tracking-tight">
            Faculty Directory & Workload State
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage institutional teaching faculty, configurable exemption status, and substitution eligibility.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Faculty</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2582a1]"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="text-xs rounded-xl border border-slate-300 px-3 py-2.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#2582a1]"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id.toString()}>
              {d.name} ({d.code})
            </option>
          ))}
        </select>
        <select
          value={eligibilityFilter}
          onChange={(e) => setEligibilityFilter(e.target.value)}
          className="text-xs rounded-xl border border-slate-300 px-3 py-2.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#2582a1]"
        >
          <option value="">All Eligibility Types</option>
          <option value="eligible">Eligible for Substitution</option>
          <option value="exempt">Exempt Faculty (Dean/HOD/PC)</option>
          <option value="ineligible">Disabled / Ineligible</option>
        </select>
      </div>

      {/* Faculty Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead>
              <tr className="bg-[#f0f9fb] border-b border-[#bee3ee] text-[#0e3b4b] font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Faculty Member</th>
                <th className="p-4">Department & Designation</th>
                <th className="p-4 text-center">Weekly Substitution Load</th>
                <th className="p-4 text-center">Rule 4 Eligibility</th>
                <th className="p-4 text-center">Exempt Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFaculty.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-[#0e3b4b] text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {f.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block truncate">{f.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono truncate">{f.faculty_id} • {f.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-slate-800 block">{f.department_name}</span>
                    <span className="text-[11px] text-slate-500">{f.designation}</span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full font-bold text-xs bg-slate-50 border border-slate-200 text-slate-800">
                      <span>{f.weekly_substitution_count} / {f.max_weekly_substitutions}</span>
                      {f.weekly_substitution_count >= f.max_weekly_substitutions && (
                        <span className="w-2 h-2 rounded-full bg-rose-500" title="At Weekly Limit" />
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleEligibility(f)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border cursor-pointer ${
                        f.is_substitution_eligible
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {f.is_substitution_eligible ? 'Eligible' : 'Ineligible'}
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggleExemption(f)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border cursor-pointer ${
                        f.is_exempt
                          ? 'bg-[#fff8eb] text-[#b37d10] border-[#fde6b3] hover:bg-[#fde6b3]'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {f.is_exempt ? 'Exempt (Dean/HOD)' : 'Standard'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(f)}
                      className="p-2 rounded-xl text-slate-400 hover:text-[#2582a1] hover:bg-[#f0f9fb] transition-colors cursor-pointer"
                      title="Edit Faculty"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Faculty Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedFaculty ? `Edit Faculty: ${selectedFaculty.name}` : 'Add New Faculty Member'}
        subtitle="Configure department, subject expertise, and non-negotiable scheduling properties."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: Number(e.target.value) })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Designation
              </label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Subject Expertise (Comma-separated codes e.g. CS101, CS103)
            </label>
            <input
              type="text"
              value={formData.subject_expertise}
              onChange={(e) => setFormData({ ...formData, subject_expertise: e.target.value })}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
              placeholder="CS101, CS102, CS103"
            />
          </div>

          {/* Rule 4 Exemption & Eligibility Checkboxes */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <label className="flex items-center space-x-2 font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_substitution_eligible}
                onChange={(e) => setFormData({ ...formData, is_substitution_eligible: e.target.checked })}
                className="rounded text-[#2582a1] focus:ring-[#2582a1]"
              />
              <span>Eligible for automatic substitution duties</span>
            </label>
            <label className="flex items-center space-x-2 font-bold text-[#b37d10] cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_exempt}
                onChange={(e) => setFormData({ ...formData, is_exempt: e.target.checked })}
                className="rounded text-[#b37d10] focus:ring-[#b37d10]"
              />
              <span>Mark as Exempt Faculty (Dean, Principal, Committee Member)</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Save Faculty
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
