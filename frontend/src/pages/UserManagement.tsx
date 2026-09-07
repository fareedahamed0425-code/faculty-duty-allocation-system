import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { User, UserRole, Department } from '../types';
import { Modal } from '../components/common/Modal';
import {
  Users,
  ShieldCheck,
  Building2,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Mail,
  Phone,
  UserPlus,
  Eye,
  Trash2,
  Calendar,
  Lock,
  Award,
  KeyRound,
  GraduationCap,
  Sparkles,
  Briefcase
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // User Details Modal
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<User | null>(null);

  // Add User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('FACULTY');
  const [newDepartmentId, setNewDepartmentId] = useState<number | ''>('');
  const [newDesignation, setNewDesignation] = useState<string>('Assistant Professor');
  const [newPhone, setNewPhone] = useState<string>('+91 98765 00000');
  const [newPassword, setNewPassword] = useState<string>('Apollo@2026');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState<boolean>(false);

  // Delete User Confirmation
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  const fetchUsersAndDepts = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [usersRes, deptsRes] = await Promise.all([
        apiClient.get<User[]>('/users'),
        apiClient.get<Department[]>('/faculty/departments'),
      ]);
      setUsers(usersRes.data);
      setDepartments(deptsRes.data);
      if (deptsRes.data.length > 0 && newDepartmentId === '') {
        setNewDepartmentId(deptsRes.data[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to retrieve user registry from server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndDepts();
  }, []);

  const handleRoleChange = async (targetUserId: number, newRoleName: UserRole) => {
    setUpdatingUserId(targetUserId);
    setFeedback(null);
    try {
      const res = await apiClient.patch<User>(`/users/${targetUserId}/role`, {
        role_name: newRoleName,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? res.data : u))
      );

      setFeedback({
        type: 'success',
        message: `Successfully allocated ${res.data.full_name}'s role to ${newRoleName}. Exemption & eligibility rules synchronized.`,
      });
    } catch (err: any) {
      console.error('Error updating role:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to update user role.',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDepartmentChange = async (targetUserId: number, newDeptId: number) => {
    setUpdatingUserId(targetUserId);
    setFeedback(null);
    const targetUser = users.find((u) => u.id === targetUserId);
    try {
      const res = await apiClient.patch<User>(`/users/${targetUserId}/role`, {
        role_name: targetUser?.role?.name || 'FACULTY',
        department_id: newDeptId,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? res.data : u))
      );

      setFeedback({
        type: 'success',
        message: `Reassigned ${res.data.full_name} to ${res.data.department_name}.`,
      });
    } catch (err: any) {
      console.error('Error updating department:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to update department affiliation.',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusToggle = async (targetUserId: number, currentStatus: boolean) => {
    setUpdatingUserId(targetUserId);
    setFeedback(null);
    try {
      const res = await apiClient.patch<User>(`/users/${targetUserId}/status`, {
        is_active: !currentStatus,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? res.data : u))
      );

      setFeedback({
        type: 'success',
        message: `User account (${res.data.full_name}) has been ${!currentStatus ? 'activated' : 'deactivated'}.`,
      });
    } catch (err: any) {
      console.error('Error toggling status:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to change user account status.',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newFullName) return;

    setIsSubmittingNewUser(true);
    setFeedback(null);
    try {
      const res = await apiClient.post<User>('/users', {
        email: newEmail.trim().toLowerCase(),
        full_name: newFullName.trim(),
        role_name: newRole,
        department_id: newDepartmentId ? Number(newDepartmentId) : undefined,
        designation: newDesignation.trim(),
        phone: newPhone.trim(),
        password: newPassword,
      });

      setUsers((prev) => [...prev, res.data]);
      setFeedback({
        type: 'success',
        message: `Institutional user ${res.data.full_name} (${res.data.email}) created successfully with role ${newRole}!`,
      });

      setIsAddUserModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewRole('FACULTY');
      setNewDesignation('Assistant Professor');
      setNewPhone('+91 98765 00000');
    } catch (err: any) {
      console.error('Error creating user:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to create new user.',
      });
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await apiClient.delete(`/users/${userToDelete.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setFeedback({
        type: 'success',
        message: `User account ${userToDelete.full_name} (${userToDelete.email}) was removed.`,
      });
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to delete user account.',
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Filtered dataset
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department_name && u.department_name.toLowerCase().includes(q)) ||
      (u.designation && u.designation.toLowerCase().includes(q)) ||
      (u.faculty_code && u.faculty_code.toLowerCase().includes(q));

    const matchesRole =
      roleFilter === 'ALL' || u.role?.name === roleFilter;

    const matchesDept =
      deptFilter === 'ALL' || (u.department_name && u.department_name.toLowerCase().includes(deptFilter.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.is_active) ||
      (statusFilter === 'INACTIVE' && !u.is_active);

    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  const adminCount = users.filter((u) => u.role?.name === 'ADMIN').length;
  const deanCount = users.filter((u) => u.role?.name === 'DEAN').length;
  const pcCount = users.filter((u) => u.role?.name === 'PC').length;
  const internalCount = users.filter((u) => u.role?.name === 'INTERNAL_MEMBERS').length;
  const additionalCount = users.filter((u) => u.role?.name === 'ADDITIONAL_MEMBERS').length;
  const facultyCount = users.filter((u) => u.role?.name === 'FACULTY').length;

  const getRoleBadge = (roleName?: string) => {
    switch (roleName) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DEAN':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'PC':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'INTERNAL_MEMBERS':
        return 'bg-indigo-100 text-indigo-900 border-indigo-200';
      case 'ADDITIONAL_MEMBERS':
        return 'bg-teal-100 text-teal-900 border-teal-200';
      case 'FACULTY':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-[#0e3b4b] text-white p-6 sm:p-8 rounded-2xl shadow-sm border border-[#165369]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[#bee3ee] text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-[#fdb931]" />
              <span>Apollo University Governance</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Institutional User & Role Governance</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Manage registered university staff, allocate administrative & teaching roles, assign departments, and audit workload privileges in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="px-4 py-2.5 bg-[#fdb931] hover:bg-[#e5a523] text-[#0e3b4b] rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#0e3b4b]" />
              <span>Add Institutional User</span>
            </button>
            <button
              onClick={fetchUsersAndDepts}
              disabled={isLoading}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border border-white/20 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Users</span>
            <Users className="w-4 h-4 text-[#2582a1]" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] mt-2">{users.length}</p>
          <span className="text-[10px] text-slate-400 font-medium">All registered accounts</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700">Administrators</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-purple-900 mt-2">{adminCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">Full system governance</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#b37d10]">Deans</span>
            <Building2 className="w-4 h-4 text-[#b37d10]" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] mt-2">{deanCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">Academic leadership</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700">Coordinators (PC)</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-blue-900 mt-2">{pcCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">Program coordinators</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700">Internal & Additional</span>
            <Award className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-indigo-900 mt-2">{internalCount + additionalCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">{internalCount} Internal • {additionalCount} Additional</span>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start space-x-3 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <p className="font-bold">{feedback.type === 'success' ? 'Success' : 'Error'}</p>
            <p className="mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Controls & User Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, faculty ID, or designation..."
                className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2582a1] transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Department Filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2582a1]"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2582a1]"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Accounts</option>
                <option value="INACTIVE">Disabled Accounts</option>
              </select>
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Role Filter:</span>
            {['ALL', 'ADMIN', 'FACULTY', 'DEAN', 'PC', 'INTERNAL_MEMBERS', 'ADDITIONAL_MEMBERS'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-[#2582a1] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {r === 'ALL'
                  ? 'All Roles'
                  : r === 'INTERNAL_MEMBERS'
                  ? 'Internal Members'
                  : r === 'ADDITIONAL_MEMBERS'
                  ? 'Additional Members'
                  : r}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Affiliation & Designation</th>
                <th className="py-3 px-4">Current Role</th>
                <th className="py-3 px-4">Allocate Role</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold">No institutional users match the selected filters.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try resetting the search query or role filter.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isUpdating = updatingUserId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-[#0e3b4b] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-slate-900">{u.full_name}</span>
                              {isSelf && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 flex items-center mt-0.5">
                              <Mail className="w-2.5 h-2.5 mr-1 text-slate-400" />
                              {u.email}
                            </span>
                            {u.phone && (
                              <span className="text-[10px] text-slate-400 font-mono flex items-center mt-0.5">
                                <Phone className="w-2.5 h-2.5 mr-1 text-slate-400" />
                                {u.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Affiliation & Designation */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {u.designation || 'Faculty Member'}
                          </p>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="text-[11px] text-slate-500">
                              {u.department_name || 'General Administration'}
                            </span>
                            {u.faculty_code && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                                {u.faculty_code}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Current Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${getRoleBadge(
                            u.role?.name
                          )}`}
                        >
                          {u.role?.name === 'INTERNAL_MEMBERS'
                            ? 'Internal Members'
                            : u.role?.name === 'ADDITIONAL_MEMBERS'
                            ? 'Additional Members'
                            : u.role?.name || 'FACULTY'}
                        </span>
                        {u.is_exempt ? (
                          <span className="block text-[9px] text-amber-700 font-medium mt-0.5">
                            🛡️ Exempt from duties
                          </span>
                        ) : (
                          <span className="block text-[9px] text-emerald-700 font-medium mt-0.5">
                            ✓ Substitution eligible
                          </span>
                        )}
                      </td>

                      {/* Role Selector */}
                      <td className="py-3.5 px-4">
                        <select
                          value={u.role?.name || 'FACULTY'}
                          disabled={isUpdating}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2582a1] transition-all cursor-pointer disabled:opacity-50"
                        >
                          <option value="ADMIN">ADMIN (System Administrator)</option>
                          <option value="FACULTY">FACULTY (Teaching Member)</option>
                          <option value="DEAN">DEAN (Academic Affairs)</option>
                          <option value="PC">PC (Program Coordinator)</option>
                          <option value="INTERNAL_MEMBERS">INTERNAL MEMBERS</option>
                          <option value="ADDITIONAL_MEMBERS">ADDITIONAL MEMBERS</option>
                        </select>
                      </td>

                      {/* Department Selector */}
                      <td className="py-3.5 px-4">
                        <select
                          value={u.department_id || ''}
                          disabled={isUpdating}
                          onChange={(e) => handleDepartmentChange(u.id, Number(e.target.value))}
                          className="bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2582a1] transition-all cursor-pointer disabled:opacity-50"
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.code} - {d.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isSelf || isUpdating}
                          onClick={() => handleStatusToggle(u.id, u.is_active)}
                          title={isSelf ? 'Cannot deactivate yourself' : 'Toggle account active status'}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setSelectedUserForDetail(u)}
                            title="View Full Profile Details"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#f0f9fb] hover:text-[#2582a1] text-slate-600 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => setUserToDelete(u)}
                              title="Delete Account"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50/50">
          <span>Showing {filteredUsers.length} of {users.length} registered institutional users</span>
          <span className="font-semibold text-[#0e3b4b]">The Apollo University Role Governance Engine</span>
        </div>
      </div>

      {/* Modal 1: Add New User */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Add Institutional User & Allocate Role"
        subtitle="Register a faculty, leadership member, or administrator with full institutional credentials."
        maxWidth="md"
      >
        <form onSubmit={handleCreateNewUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Sharma"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                University Email
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. r.sharma@apollouniversity.edu.in"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Institutional Role
              </label>
              <select
                value={newRole}
                onChange={(e) => {
                  const r = e.target.value as UserRole;
                  setNewRole(r);
                  if (r === 'DEAN') setNewDesignation('Dean of Academic Affairs');
                  else if (r === 'ADMIN') setNewDesignation('System Administrator');
                  else if (r === 'PC') setNewDesignation('Program Coordinator');
                  else if (r === 'INTERNAL_MEMBERS') setNewDesignation('Internal Committee Member');
                  else if (r === 'ADDITIONAL_MEMBERS') setNewDesignation('Additional Faculty Member');
                  else setNewDesignation('Assistant Professor');
                }}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-semibold"
              >
                <option value="FACULTY">FACULTY (Teaching Member)</option>
                <option value="ADMIN">ADMIN (System Administrator)</option>
                <option value="DEAN">DEAN (Academic Affairs)</option>
                <option value="PC">PC (Program Coordinator)</option>
                <option value="INTERNAL_MEMBERS">INTERNAL MEMBERS (Committee Member)</option>
                <option value="ADDITIONAL_MEMBERS">ADDITIONAL MEMBERS (Supporting Member)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                value={newDepartmentId}
                onChange={(e) => setNewDepartmentId(Number(e.target.value) || '')}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden font-medium"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Designation
              </label>
              <input
                type="text"
                value={newDesignation}
                onChange={(e) => setNewDesignation(e.target.value)}
                placeholder="e.g. Associate Professor"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+91 98765 00000"
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Temporary Password
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white text-slate-900 font-mono focus:ring-2 focus:ring-[#2582a1] focus:outline-hidden"
              required
            />
          </div>

          <div className="p-3 bg-[#f0f9fb] rounded-xl border border-[#bee3ee] text-xs text-slate-700">
            ℹ️ The user will be automatically assigned appropriate Rule 4 exemption / Rule 7 substitution permissions based on their role.
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddUserModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingNewUser}
              className="px-5 py-2 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmittingNewUser ? 'Creating User...' : 'Create Institutional User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: User Full Profile Details View */}
      {selectedUserForDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedUserForDetail(null)}
          title="Institutional User Profile & Standing"
          subtitle={`Full governance record and workload compliance for ${selectedUserForDetail.full_name}.`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {/* Top Profile Card */}
            <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-14 h-14 rounded-2xl bg-[#0e3b4b] text-white text-xl font-bold flex items-center justify-center shrink-0 shadow-xs">
                {selectedUserForDetail.full_name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-[#0e3b4b]">{selectedUserForDetail.full_name}</h3>
                  <span
                    className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${getRoleBadge(
                      selectedUserForDetail.role?.name
                    )}`}
                  >
                    {selectedUserForDetail.role?.name || 'FACULTY'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  {selectedUserForDetail.designation || 'Academic Staff Member'}
                </p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {selectedUserForDetail.email}
                </p>
              </div>
            </div>

            {/* Grid of Key Properties */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Department
                </span>
                <p className="font-semibold text-slate-900">
                  {selectedUserForDetail.department_name || 'General Administration'}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Faculty Identifier Code
                </span>
                <p className="font-mono font-bold text-slate-900">
                  {selectedUserForDetail.faculty_code || 'N/A'}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Rule 4 Duty Exemption
                </span>
                <p className="font-semibold">
                  {selectedUserForDetail.is_exempt ? (
                    <span className="text-amber-700 font-bold">🛡️ Exempt from substitution duties</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">✓ Standard Duty Eligible</span>
                  )}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Rule 3 Weekly Quota
                </span>
                <p className="font-semibold text-slate-900">
                  {selectedUserForDetail.is_exempt ? '0 (Exempt)' : 'Max 4 Duties / Week'}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Account Status
                </span>
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedUserForDetail.is_active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {selectedUserForDetail.is_active ? 'Active Account' : 'Deactivated'}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Contact Phone
                </span>
                <p className="font-mono text-slate-700">
                  {selectedUserForDetail.phone || '+91 98765 00000'}
                </p>
              </div>
            </div>

            {/* Role Permissions Dossier */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center">
                <KeyRound className="w-3.5 h-3.5 mr-1 text-[#2582a1]" /> Authorized Permissions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedUserForDetail.role?.permissions && selectedUserForDetail.role.permissions.length > 0 ? (
                  selectedUserForDetail.role.permissions.map((p, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                    >
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400">Standard portal permissions</span>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForDetail(null)}
                className="px-5 py-2 rounded-xl bg-[#0e3b4b] hover:bg-[#165369] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 3: Delete Confirmation */}
      {userToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setUserToDelete(null)}
          title="Confirm User Deletion"
          subtitle="Are you sure you want to delete this institutional user?"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-700 leading-relaxed">
              This will remove account access for <strong>{userToDelete.full_name}</strong> ({userToDelete.email}). Their faculty record and timetable history will be safely unlinked.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleDeleteUser}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeletingUser ? 'Deleting...' : 'Confirm & Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
