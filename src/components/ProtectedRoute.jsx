import React from 'react';
import { Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

/**
 * ProtectedRoute — ensures user is authenticated before rendering children.
 * Optionally enforces role-based access via allowedRoles prop.
 *
 * Props:
 *   children    — content to render when authorized
 *   permission  — optional string capability (e.g. 'leads:view')
 *   requireAll  — optional array of permissions, all required
 *   requireAny  — optional array of permissions, at least one required
 */
const ProtectedRoute = ({ children, permission, requireAll, requireAny, allowedRoles }) => {
  const { isAuthenticated, user, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  // Show loading spinner while rehydrating or checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not logged in → redirect to login, preserve intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleLower = (user?.role || '').toLowerCase();
  const isOwner = roleLower === 'owner' || roleLower === 'admin';

  // Role check (if specified)
  if (allowedRoles && allowedRoles.length > 0) {
    const allowedLower = allowedRoles.map(r => r.toLowerCase());
    if (!allowedLower.includes(roleLower) && !isOwner) {
      return <AccessDenied />;
    }
  }

  // Permission check (if specified)
  if (!isOwner) {
    if (permission && !hasPermission(permission)) {
      return <AccessDenied />;
    }

    if (requireAll && requireAll.length > 0) {
      const hasAll = requireAll.every(p => hasPermission(p));
      if (!hasAll) return <AccessDenied />;
    }

    if (requireAny && requireAny.length > 0) {
      const hasAny = requireAny.some(p => hasPermission(p));
      if (!hasAny) return <AccessDenied />;
    }
  }

  return children;
};

const AccessDenied = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLoginRedirect = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 p-6 text-center">
      <div className="text-6xl">🔒</div>
      <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
      <p className="text-muted-foreground text-center max-w-sm">
        You don't have permission to view this page. Contact your administrator.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
        <button
          onClick={handleLoginRedirect}
          className="bg-[#C9972A] hover:bg-[#7A5500] text-white font-semibold px-6 py-2.5 rounded-lg shadow transition-colors cursor-pointer"
        >
          Go to Login Page
        </button>
        <Link
          to="/"
          className="px-5 py-2.5 text-sm font-medium text-foreground hover:text-primary border border-border rounded-lg hover:bg-accent transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
};

export default ProtectedRoute;
