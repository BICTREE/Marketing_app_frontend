import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { 
  LayoutDashboard, Users, MapPin, Phone, DollarSign, 
  Megaphone, Bell, Settings, LogOut, FileText, 
  CalendarCheck, Menu, X, Gem, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import AdminAIAssistant from '../components/AdminAIAssistant';
import NotificationBell from '../components/NotificationBell';

const DashboardLayout = () => {
  const { user, logout, isOwner, isManager, isStaff, dashboardPath, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: dashboardPath, permission: 'dashboard:view' },
    { label: 'Leads', icon: Users, path: '/leads', permission: 'leads:view' },
    { label: 'Follow-ups', icon: CalendarCheck, path: '/followups', permission: 'leads:view' },
    { label: 'Calls', icon: Phone, path: '/calls', permission: 'calls:view' },
    { label: 'Sales', icon: DollarSign, path: '/sales', permission: 'sales:view' },
    { label: 'Campaigns', icon: Megaphone, path: '/campaigns', permission: 'campaigns:view' },
    { label: 'Team', icon: Users, path: '/team', permission: 'staff:view' },
    { label: 'Branches', icon: MapPin, path: '/branches', permission: 'branches:view' },
    { label: 'Reports', icon: FileText, path: '/reports', permission: 'reports:view' },
    { label: 'Attendance', icon: CalendarCheck, path: '/attendance', permission: 'attendance:view' },
    { label: 'Field Visits', icon: MapPin, path: '/field-visits', permission: 'field_visits:view' },
  ].filter(item => hasPermission(item.permission));

  return (
    <div className="min-h-screen bg-[#FAF6EE] flex flex-col md:flex-row font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-card border-b border-border p-4 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#C9972A]/15 text-[#8B6914] flex items-center justify-center">
            <Gem size={16} />
          </div>
          <span className="font-bold text-foreground">Bindu Jewellery</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell className="p-1" />
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-foreground p-1">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out flex flex-col h-full md:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 border-b border-border hidden md:flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C9972A]/15 text-[#8B6914] flex items-center justify-center shadow-sm">
            <Gem size={20} />
          </div>
          <div>
            <h1 className="font-bold text-foreground leading-tight tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              Bindu Jewellery
            </h1>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {user?.role} Portal
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            // Check active state (handle index '/' vs other routes)
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && item.path !== dashboardPath && location.pathname.startsWith(item.path));
              
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon size={18} className={isActive ? "text-primary" : "opacity-70"} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border mt-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User size={18} className="text-muted-foreground" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive border-border"
          >
            <LogOut size={16} className="mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-[calc(100vh-65px)] md:h-screen overflow-hidden">
        {/* Top Header */}
        <header className="hidden md:flex h-16 items-center justify-end px-8 bg-card border-b border-border/50 shrink-0">
          <div className="flex items-center gap-4">
            <NotificationBell />
            <Link to="/profile" className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
              <Settings size={20} />
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 min-w-0">
          <div className="max-w-7xl mx-auto w-full min-w-0">
            <Outlet />
          </div>
        </div>
      </main>
      <AdminAIAssistant />
    </div>
  );
};

export default DashboardLayout;
