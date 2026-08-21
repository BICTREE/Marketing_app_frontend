import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { 
  LayoutDashboard, Users, MapPin, CalendarCheck, LogOut, Gem, User, Bell, PhoneCall
} from 'lucide-react';
import { cn } from '@/lib/utils';

import NotificationBell from '../components/NotificationBell';

const StaffLayout = () => {
  const { user, logout, isField, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Home', icon: LayoutDashboard, path: '/staff/dashboard', permission: 'dashboard:view' },
    { label: 'Leads', icon: Users, path: '/staff/leads', permission: 'leads:view' },
    { label: 'Follow-ups', icon: CalendarCheck, path: '/staff/followups', permission: 'leads:view' },
    { label: 'Calls', icon: PhoneCall, path: '/staff/calls', permission: 'calls:view', roles: ['owner', 'manager', 'sub_manager', 'telecaller'] },
    { label: 'Sales', icon: Gem, path: '/staff/sales', permission: 'sales:view', roles: ['owner', 'manager', 'sub_manager'] },
    { label: 'Visits', icon: MapPin, path: '/staff/field-visits', permission: 'field_visits:view', roles: ['owner', 'manager', 'sub_manager', 'field_staff'] },
    { label: 'Attendance', icon: CalendarCheck, path: '/staff/attendance', permission: 'attendance:view' },
    { label: 'Profile', icon: User, path: '/staff/profile', permission: 'profile:view' },
  ].filter(item => {
    const hasPerm = hasPermission(item.permission);
    const hasRoleAccess = !item.roles || item.roles.includes(user?.role);
    return hasPerm && hasRoleAccess;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-20 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#C9972A]/15 text-[#8B6914] flex items-center justify-center">
            <Gem size={16} />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">Bindu Jewellery</h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
              Staff Portal
            </p>
          </div>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 mx-4">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all font-medium text-sm",
                  isActive 
                    ? "bg-primary/10 text-[#C9972A]" 
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <item.icon size={16} className={isActive ? "fill-current/20" : ""} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-8 p-4">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation for Mobile Workflow */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 flex justify-around items-center pb-safe z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
            
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 min-w-[64px] rounded-lg transition-all",
                isActive 
                  ? "text-[#C9972A]" 
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <item.icon size={20} className={isActive ? "fill-current/20" : ""} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default StaffLayout;
