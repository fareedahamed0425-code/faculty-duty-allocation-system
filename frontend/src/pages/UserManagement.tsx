import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { User, UserRole, Department } from '../types';
import {
  Users,
  ShieldCheck,
  GraduationCap,
  Building2,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Mail,
  Lock,
  UserPlus
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
        message: `Successfully updated ${res.data.full_name}'s role to ${newRoleName}.`,
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
        message: `User account has been ${!currentStatus ? 'activated' : 'deactivated'}.`,
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

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department_name && u.department_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === 'ALL' || u.role?.name === roleFilter;

    return matchesSearch && matchesRole;
  });

  const adminCount = users.filter((u) => u.role?.name === 'ADMIN').length;
  const deanCount = users.filter((u) => u.role?.name === 'DEAN').length;
  const hodCount = users.filter((u) => u.role?.name === 'HOD').length;
  const facultyCount = users.filter((u) => u.role?.name === 'FACULTY').length;

  const getRoleBadge = (roleName?: string) => {
    switch (roleName) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'DEAN':
        return 'bg-[#fff8eb] text-[#b37d10] border-[#fde6b3]';
      case 'HOD':
        return 'bg-[#dcf1f6] text-[#165369] border-[#bee3ee]';
      case 'FACULTY':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0e3b4b] text-white p-6 sm:p-8 rounded-2xl shadow-md border border-[#165369]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[#bee3ee] text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4 text-[#fdb931]" />
              <span>Administrative Governance</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">User & Role Management</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              View all institutional registered users and configure permissions and access roles across The Apollo University portal.
            </p>
          </div>

          <button
            onClick={fetchUsersAndDepts}
            disabled={isLoading}
            className="self-start md:self-auto px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border border-white/20 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Users</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Users</span>
            <Users className="w-4 h-4 text-[#2582a1]" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] mt-2">{users.length}</p>
          <span className="text-[10px] text-slate-400 font-medium">All registered accounts</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700">Administrators</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-purple-900 mt-2">{adminCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">Full system control</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#b37d10]">Deans & HODs</span>
            <Building2 className="w-4 h-4 text-[#b37d10]" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#0e3b4b] mt-2">{deanCount + hodCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">{deanCount} Dean • {hodCount} HOD</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">Faculty Members</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-900 mt-2">{facultyCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">Substitution eligible</span>
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
          <div className="text-xs font-medium leading-relaxed">{feedback.message}</div>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or department..."
              className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2582a1] focus:border-transparent"
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center">
              <SlidersHorizontal className="w-3 h-3 mr-1" /> Filter:
            </span>
            {['ALL', 'ADMIN', 'DEAN', 'HOD', 'FACULTY'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-[#2582a1] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {r === 'ALL' ? 'All Roles' : r}
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
                <th className="py-3 px-4">Institutional Affiliation</th>
                <th className="py-3 px-4">Current Role</th>
                <th className="py-3 px-4">Assign Role</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-[#2582a1] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading registered university users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No users found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isUpdating = updatingUserId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* User Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-[#0e3b4b] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {u.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{u.full_name}</span>
                              {isSelf && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono flex items-center mt-0.5">
                              <Mail className="w-3 h-3 mr-1 text-slate-400" />
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {u.department_name || 'General Administration'}
                          </p>
                          {u.faculty_code && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Code: {u.faculty_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${getRoleBadge(
                            u.role?.name
                          )}`}
                        >
                          {u.role?.name || 'FACULTY'}
                        </span>
                      </td>

                      {/* Role Selector */}
                      <td className="py-3.5 px-4">
                        <select
                          value={u.role?.name || 'FACULTY'}
                          disabled={isUpdating}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2582a1] transition-all cursor-pointer disabled:opacity-50"
                        >
                          <option value="FACULTY">Faculty (Teaching Member)</option>
                          <option value="HOD">HOD (Department Head)</option>
                          <option value="DEAN">Dean (Academic Affairs)</option>
                          <option value="ADMIN">Admin (System Administrator)</option>
                        </select>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isSelf || isUpdating}
                          onClick={() => handleStatusToggle(u.id, u.is_active)}
                          title={isSelf ? 'Cannot deactivate yourself' : 'Toggle active status'}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Disabled'}
                        </button>
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
          <span className="font-semibold text-[#0e3b4b]">Apollo University Role Governance</span>
        </div>
      </div>
    </div>
  );
};
