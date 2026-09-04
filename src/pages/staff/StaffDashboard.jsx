import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, PhoneCall, CheckCircle, Plus, Activity, MapPin, MessageSquare, Clock, Calendar } from 'lucide-react';
import useAuth from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { KPICard } from '@/components/dashboard/KPICard';
import { BinduMark } from '@/components/BinduLogo';
import { ChartCard, EmptyChart } from '@/components/dashboard/ChartWidget';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';

const StaffDashboard = () => {
  const { user, hasPermission } = useAuth();
  const [timeFrame, setTimeFrame] = React.useState('all'); // 'today', 'week', 'month', 'all'
  
  // Use React Query to fetch personal stats
  const { data: leadsData } = useQuery({
    queryKey: ['staff-leads'],
    queryFn: () => api.get('/leads/leads/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: hasPermission('leads:view')
  });

  const { data: callsData } = useQuery({
    queryKey: ['staff-calls'],
    queryFn: () => api.get('/calls/call-logs/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: hasPermission('calls:view')
  });

  const { data: attendanceData } = useQuery({
    queryKey: ['staff-attendance-today'],
    queryFn: () => api.get('/attendance/attendance/?user=' + user?.id + '&date=' + new Date().toISOString().split('T')[0]).then(res => res.data.results || res.data),
    enabled: hasPermission('attendance:view')
  });

  const { data: followupsData } = useQuery({
    queryKey: ['staff-followups'],
    queryFn: () => api.get('/leads/followups/', { params: { time_frame: 'today', status: 'pending' } }).then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: hasPermission('followups:view')
  });

  const { data: visitsData } = useQuery({
    queryKey: ['staff-visits'],
    queryFn: () => api.get('/field-visits/field-visits/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: hasPermission('field_visits:view')
  });

  const { data: salesData } = useQuery({
    queryKey: ['staff-sales'],
    queryFn: () => api.get('/sales/sales/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: hasPermission('sales:view')
  });

  // Filtering logic for stats
  const filteredLeads = React.useMemo(() => {
    if (!leadsData) return [];
    if (timeFrame === 'all') return leadsData;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const last7Days = today - (7 * 24 * 60 * 60 * 1000);
    const last30Days = today - (30 * 24 * 60 * 60 * 1000);
    
    return leadsData.filter(l => {
      const date = new Date(l.created_at).getTime();
      if (timeFrame === 'today') return date >= today;
      if (timeFrame === 'week') return date >= last7Days;
      if (timeFrame === 'month') return date >= last30Days;
      return true;
    });
  }, [leadsData, timeFrame]);

  const filteredSales = React.useMemo(() => {
    if (!salesData) return [];
    if (timeFrame === 'all') return salesData;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const last7Days = today - (7 * 24 * 60 * 60 * 1000);
    const last30Days = today - (30 * 24 * 60 * 60 * 1000);
    
    return salesData.filter(s => {
      const date = new Date(s.created_at).getTime();
      if (timeFrame === 'today') return date >= today;
      if (timeFrame === 'week') return date >= last7Days;
      if (timeFrame === 'month') return date >= last30Days;
      return true;
    });
  }, [salesData, timeFrame]);

  const totalGoldWeight = filteredSales.reduce((acc, s) => acc + parseFloat(s.weight_grams || 0), 0);
  const advanceBookingsCount = filteredSales.filter(s => s.sale_type === 'advance').length;
  const totalLeads = filteredLeads.length;
  const conversions = filteredLeads.filter(l => l.stage === 'converted').length;
  
  const callsToday = Array.isArray(callsData) ? callsData.filter(c => {
    const date = new Date(c.created_at).toDateString();
    return date === new Date().toDateString();
  }).length : 0;

  const pendingVisits = Array.isArray(visitsData) ? visitsData.filter(v => v.status === 'pending' || v.status === 'scheduled').length : 0;
  const hasCheckedIn = Array.isArray(attendanceData) && attendanceData.length > 0;
  const checkInTime = hasCheckedIn ? attendanceData[0].check_in_time : null;

  const todayFollowups = Array.isArray(followupsData) ? followupsData.slice(0, 5) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <BinduMark size={40} />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Welcome back, {user?.full_name?.split(' ')[0] || 'Staff'}!
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Here is what's happening with your schedule today.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={timeFrame} 
            onChange={(e) => setTimeFrame(e.target.value)}
            className="h-10 px-3 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          {hasPermission('leads:create') && (
            <Button asChild className="bg-[#C9972A] hover:bg-[#7A5500] shadow-sm whitespace-nowrap">
              <Link to="/staff/leads?add=true"><Plus size={16} className="mr-2" /> Add Lead</Link>
            </Button>
          )}
          {hasPermission('sales:view') && hasPermission('sales:create') && (
            <Button asChild variant="outline" className="border-[#0F6E56] text-[#0F6E56] hover:bg-[#0F6E56]/10 shadow-sm whitespace-nowrap">
              <Link to="/staff/sales?add=true"><Plus size={16} className="mr-2" /> Record Sale</Link>
            </Button>
          )}
        </div>
      </div>
      
      <div className="kpi-grid">
        {/* Card 1: Attendance (Always visible) */}
        <KPICard 
          title="Attendance" 
          value={hasCheckedIn ? 'Checked In' : 'Not Checked In'} 
          sub={hasCheckedIn ? (() => {
            try {
              const d = new Date(checkInTime);
              return isNaN(d.getTime()) ? 'Checked In' : `At ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            } catch(e) { return 'Checked In'; }
          })() : 'Action required'} 
          icon={Activity} 
          color={hasCheckedIn ? "#0F6E56" : "#EF4444"} 
          gradient={hasCheckedIn ? "linear-gradient(135deg,#0F6E56,#22C55E)" : "linear-gradient(135deg,#EF4444,#F87171)"} 
        />

        {/* Card 2: My Leads */}
        {hasPermission('leads:view') && (
          <KPICard 
            title="My Leads" 
            value={totalLeads || 0} 
            sub={timeFrame === 'all' ? "Total assigned" : `Added ${timeFrame}`} 
            icon={Users} 
            color="#6366F1" 
            gradient="linear-gradient(135deg,#6366F1,#818CF8)" 
          />
        )}
        
        {/* Card 3: Pending Visits */}
        {hasPermission('field_visits:view') && (
          <KPICard 
            title="Pending Visits" 
            value={pendingVisits || 0} 
            sub="Field visits scheduled" 
            icon={MapPin} 
            color="#1A5490" 
            gradient="linear-gradient(135deg,#1A5490,#3B82F6)" 
          />
        )}

        {/* Card 4: My Gold Sales */}
        {hasPermission('sales:view') && (
          <KPICard 
            title="My Gold Sales" 
            value={totalGoldWeight || 0} 
            suffix=" g"
            decimals={2}
            sub={timeFrame === 'all' ? `Total: ${filteredSales?.length || 0} sales` : `${filteredSales?.length || 0} sales ${timeFrame}`} 
            icon={Activity} 
            color="#C9972A" 
            gradient="linear-gradient(135deg,#C9972A,#F0C84A)" 
          />
        )}

        {/* Card 5: Calls Today */}
        {hasPermission('calls:view') && (
          <KPICard 
            title="Calls Today" 
            value={callsToday || 0} 
            sub="Logs recorded today" 
            icon={PhoneCall} 
            color="#0F6E56" 
            gradient="linear-gradient(135deg,#0F6E56,#10B981)" 
          />
        )}
      </div>

      <div className="chart-row-2 mt-4 lg:mt-6">
        {hasPermission('followups:view') && (
          <ChartCard title="Today's Scheduled Tasks">
            <div className="space-y-4">
              {todayFollowups.length > 0 ? (
                todayFollowups.map(followup => (
                  <div key={followup.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-all hover:shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {followup.followup_type === 'call' ? <PhoneCall size={14} /> : followup.followup_type === 'visit' ? <MapPin size={14} /> : <MessageSquare size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{followup.lead_name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock size={10} /> 
                          {(() => {
                            try {
                              const d = new Date(followup.scheduled_date);
                              return isNaN(d.getTime()) ? 'No date' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            } catch (e) {
                              return 'Invalid date';
                            }
                          })()}
                          • {followup.priority?.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 sm:gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-[#0F6E56]" asChild>
                         <a href={`tel:${followup.lead_phone}`}><PhoneCall size={14} /></a>
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" asChild>
                         <Link to="/staff/followups"><Activity size={14} /></Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                  <CheckCircle size={40} className="mb-2" />
                  <p className="text-sm font-medium">No tasks for today!</p>
                </div>
              )}
              <Button variant="link" className="w-full text-xs text-muted-foreground" asChild>
                 <Link to="/staff/followups">View all follow-ups</Link>
              </Button>
            </div>
          </ChartCard>
        )}
        
        {hasPermission('leads:view') && (
          <RecentActivityWidget activities={Array.isArray(filteredLeads) ? filteredLeads.slice(0, 8).map(l => ({
            name: l.name || 'Anonymous',
            stage: l.stage || 'new',
            date: l.created_at ? new Date(l.created_at).toLocaleDateString() : 'N/A'
          })) : []} />
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
