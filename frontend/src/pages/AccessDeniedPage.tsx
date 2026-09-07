import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Lock, ArrowLeft, LogOut } from 'lucide-react';

export const AccessDeniedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const roleName = user?.role?.name || 'FACULTY';

  const getHomeRoute = () => {
    switch (roleName) {
      case 'ADMIN':
        return '/dashboard';
      case 'DEAN':
        return '/dean-dashboard';
      case 'PC':
      case 'HOD':
        return '/hod-dashboard';
      case 'FACULTY':
      case 'ADDITIONAL_MEMBERS':
      case 'INTERNAL_MEMBERS':
      default:
        return '/faculty-portal';
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-2xl shadow-slate-200/50 text-center relative overflow-hidden">
        {/* Top Warning Accent */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600" />

        {/* Lock Shield Icon */}
        <div className="mx-auto w-20 h-20 rounded-3xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-600 shadow-inner mb-6 relative">
          <ShieldAlert className="w-10 h-10" />
          <div className="absolute -bottom-1 -right-1 p-1.5 bg-[#0e3b4b] text-[#fdb931] rounded-full border-2 border-white shadow-xs">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Header Text */}
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 inline-block mb-3">
          Restricted Area • Locked
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0e3b4b] tracking-tight">
          Admin Credentials Required
        </h1>

        <p className="text-sm text-slate-600 mt-3 leading-relaxed">
          The requested administration control URL is strictly restricted. Only institutional administrators with verified credentials can access this section.
        </p>

        {/* Current User Role Notice */}
        {user && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5">
            <div className="flex justify-between items-center text-slate-500">
              <span>Signed In As:</span>
              <strong className="text-slate-800 font-mono truncate max-w-[200px]">{user.email}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Current Role:</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px] uppercase">
                {roleName}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(getHomeRoute())}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white font-bold text-xs shadow-md shadow-[#2582a1]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Authorized Portal</span>
          </button>

          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
