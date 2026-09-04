import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Users, DollarSign, Target, CheckCircle, TrendingUp, TrendingDown,
  Trophy, Medal, Award, RefreshCw, Activity, Clock,
  Camera, ThumbsUp, Globe, MessageCircle, UserPlus, MapPin, GitBranch, Zap, Calendar, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { normalizeGrams } from '@/lib/utils';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { Link } from 'react-router-dom';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard, ChartTooltip, EmptyChart } from '@/components/dashboard/ChartWidget';
import { StageBadge } from '@/components/dashboard/StageBadge';
import { RevenueTrendWidget } from '@/components/dashboard/RevenueTrendWidget';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';
import { StaffLeaderboardWidget } from '@/components/dashboard/StaffLeaderboardWidget';
import { LeadsSourceWidget, SOURCE_META } from '@/components/dashboard/LeadsSourceWidget';
import useAuth from '@/hooks/useAuth';
const safeFormat = (dateStr, formatStr, fallback = '—') => {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch (e) {
    return fallback;
  }
};


const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#8B5CF6', '#F59E0B', '#EF4444'];

// SOURCE_META is now imported from LeadsSourceWidget


// Today's Leads Panel
const TodayLeadsPanel = ({ leads }) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  const week7 = new Date(today);    week7.setDate(today.getDate()-7);

  const todayLeads = leads.filter(l => new Date(l.created_at) >= today);
  const yesterdayLeads = leads.filter(l => { const d=new Date(l.created_at); return d>=yesterday && d<today; });
  const week7Leads = leads.filter(l => new Date(l.created_at) >= week7);

  const sourceCounts = {};
  leads.forEach(l => { const s=l.source||'other'; sourceCounts[s]=(sourceCounts[s]||0)+1; });
  const sourceRows = Object.entries(sourceCounts)
    .sort((a,b)=>b[1]-a[1])
    .map(([src,cnt]) => ({ src, cnt, pct: Math.round((cnt/leads.length)*100) }));

  const delta = todayLeads.length - yesterdayLeads.length;
  const topSource = sourceRows[0];
  const socialCount = (sourceCounts['instagram']||0)+(sourceCounts['facebook']||0);
  const socialPct = leads.length ? Math.round((socialCount/leads.length)*100) : 0;
  const offlineCount = (sourceCounts['walkin']||0)+(sourceCounts['referral']||0);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'24px' }}>
      <div className="chart-card" style={{ background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', color:'#fff', border:'none' }}>
        <div className="chart-card-header" style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 className="chart-title" style={{color:'#fff'}}>Today's Branch Leads</h3>
            <p className="chart-sub" style={{color:'rgba(255,255,255,0.5)'}}>Live pipeline snapshot</p>
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', gap:4 }}>
            <Clock size={11} /> {new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}
          </div>
        </div>
        <div style={{ padding:'20px 20px 8px' }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:12, marginBottom:20 }}>
            <span style={{ fontSize:56, fontWeight:900, color:'#C9972A', lineHeight:1 }}>{todayLeads.length}</span>
            <div style={{ paddingBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700,
                color: delta>=0 ? '#4ade80' : '#f87171' }}>
                {delta>=0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
                {delta>=0?'+':''}{delta} vs yesterday
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>Yesterday: {yesterdayLeads.length}</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[
              { label:'Last 7 Days',  val: week7Leads.length,  color:'#C9972A' },
              { label:'Total Active', val: leads.length,        color:'#3B82F6' },
              { label:'Converted',    val: leads.filter(l=>l.stage==='converted').length, color:'#10B981' },
            ].map(item => (
              <div key={item.label} style={{ background:'rgba(255,255,255,0.05)', borderRadius:12, padding:'10px 12px' }}>
                <p style={{ fontSize:20, fontWeight:800, color:item.color }}>{item.val}</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ margin:'12px 20px 20px', background:'rgba(201,151,42,0.15)', borderRadius:12, padding:'10px 14px',
          borderLeft:'3px solid #C9972A', fontSize:11, color:'rgba(255,255,255,0.75)', lineHeight:1.5 }}>
          <strong style={{color:'#C9972A'}}>Key Insight:</strong>{' '}
          {topSource ? `${SOURCE_META[topSource.src]?.label||topSource.src} is the top source for your branch (${topSource.pct}%). ` : ''}
          {socialPct > 30 ? `Social media brings ${socialPct}% of branch leads. ` : ''}
          {offlineCount > 0 ? `${offlineCount} walk-ins & referrals this period.` : ''}
        </div>
      </div>

      {/* Right: Source breakdown */}
      <LeadsSourceWidget leads={leads} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const ManagerDashboard = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('daily');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: leadsData, isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['manager-leads'],
    queryFn: () => api.get('/leads/leads/').then(res => res.data.results || res.data)
  });

  const { data: salesData, isLoading: loadingSales, refetch: refetchSales } = useQuery({
    queryKey: ['manager-sales'],
    queryFn: () => api.get('/sales/sales/').then(res => res.data.results || res.data)
  });

  const { data: staffData, isLoading: loadingStaff, refetch: refetchStaff } = useQuery({
    queryKey: ['manager-staff'],
    queryFn: () => api.get(`/accounts/staff/?branch_id=${user?.branch || ''}`).then(res => res.data.results || res.data)
  });

  const { data: attendanceData, isLoading: loadingAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['manager-attendance-today'],
    queryFn: () => api.get('/attendance/attendance/?date=' + new Date().toISOString().split('T')[0]).then(res => res.data.results || res.data)
  });

  const isLoading = loadingLeads || loadingSales || loadingStaff || loadingAttendance;

  const handleRefresh = () => {
    refetchLeads(); refetchSales(); refetchStaff(); refetchAttendance();
    setLastRefresh(new Date());
  };

  const branchLeads = leadsData || [];
  const branchSales = salesData || [];
  const activeStaff = staffData || [];

  const totalLeads = branchLeads.length;
  const totalSalesCount = branchSales.length;
  const advanceBookingsCount = branchSales.filter(s => s.sale_type === 'advance').length;
  const totalGoldWeight = normalizeGrams(branchSales.reduce((acc, curr) => acc + parseFloat(curr.weight_grams || curr.amount || 0), 0));
  const staffCount = activeStaff.length;
  const convRate = totalLeads > 0 ? ((totalSalesCount / totalLeads) * 100) : 0;
  
  const presentCount = Array.isArray(attendanceData) ? attendanceData.filter(a => a.status === 'present' || a.status === 'late').length : 0;
  const pendingAttendance = Array.isArray(attendanceData) ? attendanceData.filter(a => a.status === 'pending').length : 0;

  // Staff Performance Data
  const staffPerformanceData = React.useMemo(() => {
    if (!branchLeads.length || !activeStaff.length) return [];
    
    const performance = {};
    activeStaff.forEach(staff => {
      const staffLeads = branchLeads.filter(lead => lead.assigned_to === staff.id);
      performance[staff.full_name] = {
        name: staff.full_name || staff.username,
        leads: staffLeads.length,
        converted: staffLeads.filter(lead => lead.stage === 'converted').length,
        contacted: staffLeads.filter(lead => lead.stage === 'contacted').length
      };
    });
    
    return Object.values(performance).sort((a, b) => b.leads - a.leads);
  }, [branchLeads, activeStaff]);

  // Lead Stage Pie
  const leadStageData = React.useMemo(() => {
    if (!branchLeads.length) return [];
    const counts = {};
    branchLeads.forEach(l => { const s = l.stage || 'unknown'; counts[s] = (counts[s] || 0) + 1; });
    const labels = { new:'New', contacted:'Contacted', interested:'Interested', scheduled:'Visit Scheduled', converted:'Converted', lost:'Lost' };
    return Object.entries(counts).map(([stage, count]) => ({ name: labels[stage] || stage, value: count, stage }));
  }, [branchLeads]);

  // Funnel (horizontal bar)
  const funnelData = React.useMemo(() => {
    const stages = ['new','contacted','interested','scheduled','converted'];
    const labels = { new:'New Leads', contacted:'Contacted', interested:'Interested', scheduled:'Visit Scheduled', converted:'Converted' };
    return stages.map(st => ({ name: labels[st], value: branchLeads.filter(l => l.stage === st).length })).filter(f => f.value > 0);
  }, [branchLeads]);

  // Sales Trend
  const salesTrendData = React.useMemo(() => {
    if (!branchSales.length) return [];
    const byDate = {};
    branchSales.forEach(s => {
      const d = new Date(s.created_at);
      let key;
      if (timeRange === 'daily')  key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      else if (timeRange === 'weekly') key = `Wk ${Math.ceil((d.getDate() + d.getDay()) / 7)}`;
      else key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!byDate[key]) byDate[key] = { date: key, weight: 0, count: 0 };
      byDate[key].weight += parseFloat(s.weight_grams || 0);
      byDate[key].count++;
    });
    const all = Object.values(byDate);
    return timeRange === 'daily' ? all.slice(-7) : timeRange === 'weekly' ? all.slice(-4) : all.slice(-6);
  }, [branchSales, timeRange]);

  // Staff Leaderboard
  const leaderboard = React.useMemo(() => {
    if (!activeStaff?.length) return [];
    return activeStaff
      .filter(u => u.role !== 'owner' && u.role !== 'manager')
      .map(u => ({
        name: u.full_name || u.username || 'Unknown',
        leads: branchLeads.filter(l => l.assigned_to === u.id).length,
        sales: branchSales.filter(s => s.staff === u.id).length,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);
  }, [activeStaff, branchLeads, branchSales]);

  // Recent Activity
  const recentActivity = React.useMemo(() =>
    [...branchLeads]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)
      .map(l => ({ name: l.name, stage: l.stage, date: new Date(l.created_at).toLocaleDateString('en-IN') })),
    [branchLeads]);

  if (isLoading) return (
    <div className="dash-wrap">
      <div className="skeleton-grid">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton-kpi" />)}
      </div>
      <div className="skeleton-charts">
        <div className="skeleton-chart tall" />
        <div className="skeleton-chart tall" />
      </div>
    </div>
  );

  return (
    <div className="dash-wrap">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">
            Manager Dashboard <span style={{ fontSize: '1rem', fontWeight: 500, color: '#9CA3AF' }}>({user?.branch_name})</span>
          </h1>
          <p className="dash-subtitle">
            <Clock size={13} className="inline mr-1" />
            Last updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="dash-header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button asChild className="bg-[#0F6E56] hover:bg-[#0A4A3A] text-white shadow-sm h-9" size="sm">
            <Link to="/sales?add=true"><Plus size={16} className="mr-1" /> Record Sale</Link>
          </Button>
          <button className="refresh-btn" onClick={handleRefresh} title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <KPICard title="Branch Leads"      value={totalLeads}      sub="Total assigned leads"  icon={Users}       color="#C9972A" gradient="linear-gradient(135deg,#C9972A,#F0C84A)" />
        <KPICard title="Branch Gold Sold"   value={totalGoldWeight} sub={`${totalSalesCount} closed (${advanceBookingsCount} advance)`} icon={Zap} color="#0F6E56" gradient="linear-gradient(135deg,#0F6E56,#22C55E)" suffix=" g" decimals={2} />
        <KPICard title="Advance Bookings"  value={advanceBookingsCount} sub="Future fulfillments" icon={Calendar}   color="#8B5CF6" gradient="linear-gradient(135deg,#8B5CF6,#A78BFA)" />
        <KPICard title="Staff Present"     value={presentCount}    sub={`${pendingAttendance} pending approval`} icon={Activity} color="#1A5490" gradient="linear-gradient(135deg,#1A5490,#3B82F6)" />
        <KPICard title="Conversion Rate"   value={convRate}        sub="Leads to sales"        icon={Target}      color="#F59E0B" gradient="linear-gradient(135deg,#F59E0B,#FCD34D)" suffix="%" decimals={1} />
      </div>

      {/* ── Today's Leads + Source Breakdown ────────────────────── */}
      <div className="chart-row-2">
        <TodayLeadsPanel leads={branchLeads} />
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-title">Team Attendance</h3>
              <p className="chart-sub">Today's presence overview</p>
            </div>
            <Link to="/attendance" className="text-xs text-primary hover:underline font-medium">View All</Link>
          </div>
          <div className="chart-body">
            <div className="space-y-3">
              {attendanceData?.length > 0 ? (
                attendanceData.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/5 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {record.user_name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{record.user_name}</p>
                        <p className="text-[10px] text-muted-foreground">{safeFormat(record.check_in_time, 'hh:mm a', 'No check-in')}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      record.status === 'present' ? 'bg-green-100 text-green-700' : 
                      record.status === 'late' ? 'bg-amber-100 text-amber-700' : 
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {record.status?.toUpperCase()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
                   <Clock size={32} className="mb-2" />
                   <p className="text-xs">No attendance recorded yet today.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sales Trend + Staff Performance ───────────────────────── */}
      <div className="chart-row-2">
        <RevenueTrendWidget 
          data={salesTrendData} 
          timeRange={timeRange} 
          onTimeRangeChange={setTimeRange} 
        />

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-title">Staff Performance</h3>
              <p className="chart-sub">Leads handling by team</p>
            </div>
          </div>
          <div className="chart-body">
            {staffPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260} minWidth={0}>
                <BarChart data={staffPerformanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="leads" fill="#C9972A" name="Total Leads" radius={[0,4,4,0]} />
                  <Bar dataKey="converted" fill="#0F6E56" name="Converted" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No staff data available" />}
          </div>
        </div>
      </div>

      {/* ── Lead Stages + Funnel + Leaderboard ────────────────────────── */}
      <div className="chart-row-3">
        <div className="chart-card">
          <div className="chart-card-header">
            <div><h3 className="chart-title">Lead Stages</h3><p className="chart-sub">Pipeline distribution</p></div>
          </div>
          <div className="chart-body">
            {leadStageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230} minWidth={0}>
                <PieChart>
                  <Pie data={leadStageData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3}>
                    {leadStageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No lead data available" />}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <div><h3 className="chart-title">Conversion Funnel</h3><p className="chart-sub">Leads through each stage</p></div>
          </div>
          <div className="chart-body">
            {funnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230} minWidth={0}>
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Leads" radius={[0,4,4,0]}>
                    {funnelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No conversion data available" />}
          </div>
        </div>

        <StaffLeaderboardWidget data={leaderboard} />
      </div>
      
      {/* ── Recent Activity ─────────────────────────────────────── */}
      <div className="chart-row-2">
         <RecentActivityWidget activities={recentActivity} />
      </div>
    </div>
  );
};

export default ManagerDashboard;
