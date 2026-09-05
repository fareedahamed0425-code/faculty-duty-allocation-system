import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your university email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Invalid university credentials. Please try again.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillQuickCredential = (credEmail: string) => {
    setEmail(credEmail);
    setPassword('password123');
    setShowHelpModal(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f8fa] flex flex-col justify-between font-sans select-none">
      {/* Top University Brand Bar */}
      <header className="bg-white border-b border-slate-200 shadow-xs px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/apollo_logo.svg"
              alt="The Apollo University"
              className="h-11 w-auto object-contain"
            />
            <div className="border-l border-slate-300 pl-3">
              <h1 className="text-base sm:text-lg font-bold text-[#0e3b4b] tracking-tight leading-tight">
                The Apollo University
              </h1>
              <p className="text-[11px] text-[#2582a1] font-semibold tracking-wide uppercase">
                Faculty Scheduling & Substitution System
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#2582a1]" />
              <span className="hidden sm:inline">Role Directory</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Login Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-lg shadow-slate-200/50">
          {/* Card Header with Apollo Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-2 rounded-xl bg-[#f0f9fb] border border-[#bee3ee] mb-3">
              <img
                src="/apollo_logo.svg"
                alt="The Apollo University"
                className="h-10 w-auto object-contain"
              />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0e3b4b] tracking-tight">University Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">Access your faculty or administrative workspace</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#0e3b4b] mb-1.5">
                Institutional Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@institution.edu"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2582a1] focus:bg-white focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-[#0e3b4b]">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2582a1] focus:bg-white focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-[#2582a1] focus:ring-[#2582a1] mr-2"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="text-[#2582a1] hover:text-[#165369] font-bold transition-colors cursor-pointer"
              >
                Sample Accounts
              </button>
            </div>

            {/* Primary Sign In Button in Apollo Gold / Teal */}
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full mt-3 py-3 px-4 rounded-xl bg-[#2582a1] hover:bg-[#1c6b86] text-white font-bold text-sm shadow-md shadow-[#2582a1]/20 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting || isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Institutional Compliance Footer Banner */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center space-x-1.5 font-semibold text-[#2582a1]">
              <Sparkles className="w-3.5 h-3.5 text-[#fdb931]" />
              <span>Apollo AI Assistant</span>
            </span>
            <span className="font-medium">Academic Year 2026</span>
          </div>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500">
        © 2026 The Apollo University. Faculty Substitution & Duty Allocation System.
      </footer>

      {/* Role Directory Helper Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0e3b4b]">The Apollo University — Role Directory</h3>
                <p className="text-xs text-slate-500">Click any account below to autofill credentials</p>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {[
                {
                  role: 'ADMIN',
                  title: 'System Administrator',
                  email: 'admin@institution.edu',
                  desc: 'Full administrative controls, rules management, faculty roster, and AI configuration.',
                  badgeColor: 'bg-purple-100 text-purple-700',
                },
                {
                  role: 'HOD',
                  title: 'Head of Department (CSE)',
                  email: 'hod.cse@institution.edu',
                  desc: 'Department timetable, faculty workload, and substitution duty oversight.',
                  badgeColor: 'bg-[#dcf1f6] text-[#165369]',
                },
                {
                  role: 'DEAN',
                  title: 'Dean of Academic Affairs',
                  email: 'dean@institution.edu',
                  desc: 'University-wide compliance, exemption monitoring, and cross-department analytics.',
                  badgeColor: 'bg-[#fff8eb] text-[#b37d10]',
                },
                {
                  role: 'FACULTY',
                  title: 'Prof. Kumar Sanjeev (Faculty)',
                  email: 'kumar@institution.edu',
                  desc: 'Personal timetable schedule, substitution duty alerts, and leave applications.',
                  badgeColor: 'bg-emerald-100 text-emerald-800',
                },
              ].map((acc) => (
                <div
                  key={acc.email}
                  onClick={() => fillQuickCredential(acc.email)}
                  className="p-3.5 rounded-xl bg-slate-50 hover:bg-[#f0f9fb] border border-slate-200 hover:border-[#2582a1] transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${acc.badgeColor} uppercase`}>
                        {acc.role}
                      </span>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-[#2582a1]">
                        {acc.title}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{acc.email}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{acc.desc}</p>
                  </div>
                  <span className="text-xs text-[#2582a1] font-bold opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                    Use →
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 text-center pt-1 border-t border-slate-100">
              Default password for all accounts: <code className="text-[#2582a1] font-mono font-bold">password123</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
