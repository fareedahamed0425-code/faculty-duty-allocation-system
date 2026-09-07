import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Ensures user is authenticated.
 * If not, redirects to /login and saves current URL to return to after sign-in.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-[#2582a1] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Verifying Institutional Credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Strictly locks administrative URLs so that only authenticated users
 * with verified ADMIN role can access. Non-admins are redirected to /access-denied.
 */
export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-[#2582a1] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.role?.name !== 'ADMIN') {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

/**
 * Route guard that verifies whether user belongs to one of allowed roles.
 */
export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-[#2582a1] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-300">Verifying Role Credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const roleName = user.role?.name || '';
  const isAllowed = allowedRoles.includes(roleName) || roleName === 'ADMIN';

  if (!isAllowed) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};
