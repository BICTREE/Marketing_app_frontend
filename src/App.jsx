import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import useAuth from './hooks/useAuth';
import useAuthStore from './store/authStore';
import { useEffect } from 'react';
import api from './api/axios';


// Auth
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));

// Dashboards
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ManagerDashboard = lazy(() => import('./pages/manager/ManagerDashboard'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));

// App Pages
const Leads = lazy(() => import('./pages/Leads'));
const CustomerProfile = lazy(() => import('./pages/leads/CustomerProfile'));
const Sales = lazy(() => import('./pages/Sales'));
const Calls = lazy(() => import('./pages/Calls'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignIntegrations = lazy(() => import('./pages/campaigns/Integrations'));
const IntegrationsCallback = lazy(() => import('./pages/campaigns/IntegrationsCallback'));
const MetaCallback = lazy(() => import('./pages/campaigns/MetaCallback'));
const Team = lazy(() => import('./pages/Team'));
const Branches = lazy(() => import('./pages/Branches'));
const Attendance = lazy(() => import('./pages/Attendance'));
const FieldVisits = lazy(() => import('./pages/FieldVisits.jsx'));
const Customers = lazy(() => import('./pages/Customers'));

// New Feature Pages
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const Followups = lazy(() => import('./pages/Followups'));

// Staff Pages
const StaffLayout = lazy(() => import('./layouts/StaffLayout'));
const StaffAttendance = lazy(() => import('./pages/staff/StaffAttendance'));
const StaffFieldVisits = lazy(() => import('./pages/staff/StaffFieldVisits'));

const RootRedirect = () => {
  const { dashboardPath } = useAuth();
  return <Navigate to={dashboardPath} replace />;
};

const AppRoutes = () => {
  const { initializeAuth, setUser } = useAuthStore();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Re-fetch profile to get latest permissions/data from backend
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      api.get('/accounts/me/')
        .then(res => {
          setUser(res.data);
        })
        .catch(err => console.warn('Profile refresh skipped:', err?.response?.status));
    }
  }, [isAuthenticated, user?.id]);

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground">Loading application...</div>}>
      <Routes>
        {/* Public Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Root Redirect based on Role */}
        <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />

        {/* OAuth Callbacks (Public to avoid session-loss redirects) */}
        <Route path="/campaigns/integrations/callback" element={<IntegrationsCallback />} />
        <Route path="/campaigns/integrations/meta/callback" element={<MetaCallback />} />

        {/* Protected Dashboard Routes (Admin/Manager) */}
        <Route element={<ProtectedRoute permission="dashboard:view" allowedRoles={['owner', 'manager', 'sub_manager']}><DashboardLayout /></ProtectedRoute>}>
          {/* Role-Specific Dashboard Routes */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/manager/dashboard" element={<ManagerDashboard />} />

          {/* Core Feature Routes */}
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<CustomerProfile />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/settings/integrations" element={<CampaignIntegrations />} />
          <Route path="/campaigns/integrations" element={<Navigate to="/campaigns/settings/integrations" replace />} />
          <Route path="/team" element={<Team />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/field-visits" element={<FieldVisits />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/followups" element={<Followups />} />
        </Route>

        {/* Protected Dashboard Routes (Staff/Field Staff) */}
        <Route element={<ProtectedRoute allowedRoles={['staff', 'telecaller', 'field_staff', 'custom']}><StaffLayout /></ProtectedRoute>}>
          <Route path="/staff/dashboard" element={<StaffDashboard />} />
          <Route path="/staff/leads" element={<Leads />} />
          <Route path="/staff/leads/:id" element={<CustomerProfile />} />
          <Route path="/staff/calls" element={<Calls />} />
          <Route path="/staff/sales" element={<Sales />} />
          <Route path="/staff/attendance" element={<StaffAttendance />} />
          <Route path="/staff/field-visits" element={<StaffFieldVisits />} />
          <Route path="/staff/customers" element={<Customers />} />
          <Route path="/staff/profile" element={<ProfilePage />} />
          <Route path="/staff/notifications" element={<NotificationsPage />} />
          <Route path="/staff/followups" element={<Followups />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
