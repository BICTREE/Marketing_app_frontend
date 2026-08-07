import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, PhoneCall, DollarSign, Megaphone, TrendingUp, TrendingDown,
  Trophy, Medal, Award, RefreshCw, Building2, Target, ArrowUpRight,
  ArrowDownRight, Zap, Activity, Clock, ChevronRight, Star,
  Camera, ThumbsUp, Globe, MessageCircle, UserPlus, MapPin, GitBranch,
  Calendar, Filter, Mail, Send, ToggleLeft, ToggleRight, ShieldAlert
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { normalizeGrams } from '@/lib/utils';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard, ChartTooltip, EmptyChart } from '@/components/dashboard/ChartWidget';
import { StageBadge } from '@/components/dashboard/StageBadge';
import { RevenueTrendWidget } from '@/components/dashboard/RevenueTrendWidget';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';
import { StaffLeaderboardWidget } from '@/components/dashboard/StaffLeaderboardWidget';
import { LeadsSourceWidget, SOURCE_META } from '@/components/dashboard/LeadsSourceWidget';

// Constants removed as they are now imported from components/dashboard/


const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#8B5CF6', '#F59E0B', '#EF4444'];

// SOURCE_META is now imported from LeadsSourceWidget


// Today's Leads Panel (Pipeline Snapshot)
const TodayLeadsPanel = ({ leads, dateRange }) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  const week7 = new Date(today);    week7.setDate(today.getDate()-7);

  const todayLeads = leads.filter(l => new Date(l.created_at) >= today);
  const yesterdayLeads = leads.filter(l => { const d=new Date(l.created_at); return d>=yesterday && d<today; });
  const week7Leads = leads.filter(l => new Date(l.created_at) >= week7);
  const convertedLeads = leads.filter(l => l.stage === 'converted');

  const delta = todayLeads.length - yesterdayLeads.length;
  
  // Dynamic Title based on filter
  const title = dateRange === 'all' ? 'Pipeline Snapshot' : 
                dateRange === 'today' ? 'Today\'s Activity' : 
                dateRange === 'week' ? 'Weekly Overview' : 'Monthly Performance';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
      {/* Left: Pipeline snapshot */}
      <div className="lg:col-span-7 chart-card" style={{ background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', color:'#fff', border:'none' }}>
        <div className="chart-card-header" style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h3 className="chart-title" style={{color:'#fff'}}>{title}</h3>
            <p className="chart-sub" style={{color:'rgba(255,255,255,0.5)'}}>
              {dateRange === 'all' ? 'Real-time lead & conversion tracking' : `Insights for the selected period`}
            </p>
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', gap:4 }}>
            <Clock size={11} /> Updated: {new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
                {dateRange === 'today' ? 'Current Leads' : 'New Leads In Period'}
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-black text-[#C9972A]">{leads.length}</span>
                {dateRange === 'all' && (
                  <div className="flex flex-col">
                    <div className={`flex items-center gap-1 text-xs font-bold ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {delta >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                      {delta >= 0 ? '+' : ''}{delta} vs yesterday
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-l border-white/10 pl-6">
              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Conversion Summary</p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-black text-emerald-400">{convertedLeads.length}</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white/80">Converted</span>
                  <span className="text-[10px] text-white/40">
                    {leads.length > 0 ? Math.round((convertedLeads.length/leads.length)*100) : 0}% Success
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: dateRange === 'all' ? '7 Day Flow' : 'Growth', val: week7Leads.length, icon: Calendar, color:'#3B82F6' },
              { label:'Target Reach', val: `${Math.min(100, Math.round((leads.length/50)*100))}%`, icon: Users, color:'#C9972A' },
              { label:'Est. Gold Weight', val: `${(convertedLeads.length * 15).toLocaleString('en-IN')}g`, icon: Zap, color:'#F59E0B' },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                <p className="text-lg font-bold" style={{ color: item.color }}>{item.val}</p>
                <p className="text-[9px] uppercase font-bold text-white/30 tracking-tight">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Source breakdown */}
      <div className="lg:col-span-5">
        <LeadsSourceWidget leads={leads} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [timeRange, setTimeRange]   = useState('daily');
  const [dateRange, setDateRange]   = useState('month'); 
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { data: leadsResponse, isLoading: loadingLeads,    refetch: refetchLeads }    = useQuery({ 
    queryKey: ['admin-leads', selectedBranch, selectedSource, selectedSegment, selectedStaff, selectedCampaign, dateRange, customStartDate, customEndDate], 
    queryFn: () => api.get('/leads/leads/', { 
      params: { 
        branch: selectedBranch !== 'all' ? selectedBranch : undefined, 
        source: selectedSource !== 'all' ? selectedSource : undefined, 
        segment: selectedSegment !== 'all' ? selectedSegment : undefined, 
        assigned_to: selectedStaff !== 'all' ? selectedStaff : undefined, 
        campaign: selectedCampaign !== 'all' ? selectedCampaign : undefined, 
        time_range: dateRange !== 'all' ? dateRange : undefined,
        start_date: dateRange === 'custom' ? customStartDate : undefined,
        end_date: dateRange === 'custom' ? customEndDate : undefined,
        page_size: 1000 
      } 
    }).then(r => r.data) 
  });

  const { data: salesResponse, isLoading: loadingSales,    refetch: refetchSales }    = useQuery({ 
    queryKey: ['admin-sales', selectedBranch, selectedStaff, dateRange, customStartDate, customEndDate], 
    queryFn: () => api.get('/sales/sales/', { 
      params: { 
        branch: selectedBranch !== 'all' ? selectedBranch : undefined, 
        staff: selectedStaff !== 'all' ? selectedStaff : undefined, 
        time_range: dateRange !== 'all' ? dateRange : undefined,
        start_date: dateRange === 'custom' ? customStartDate : undefined,
        end_date: dateRange === 'custom' ? customEndDate : undefined,
        page_size: 1000 
      } 
    }).then(r => r.data) 
  });
  const { data: campaignsData, isLoading: loadingCampaigns,refetch: refetchCampaigns }= useQuery({ queryKey: ['admin-campaigns'], queryFn: () => api.get('/campaigns/campaigns/').then(r => r.data.results || r.data) });
  const { data: teamData,      isLoading: loadingTeam,     refetch: refetchTeam }     = useQuery({ queryKey: ['admin-team'],      queryFn: () => api.get('/accounts/users/').then(r => r.data.results || r.data) });
  const { data: branchesData }                                                        = useQuery({ queryKey: ['branches'],         queryFn: () => api.get('/branches/').then(r => r.data.results || r.data) });
  const { data: segmentsData }                                                        = useQuery({ queryKey: ['segments'],         queryFn: () => api.get('/branches/segments/').then(r => r.data.results || r.data) });

  // System Setting for Daily Staff Email Notifications
  const { data: emailSettingData, refetch: refetchEmailSetting } = useQuery({
    queryKey: ['systemSettingDailyEmails'],
    queryFn: async () => {
      const res = await api.get('/accounts/system-settings/toggle-daily-emails/');
      return res.data;
    },
  });

  const [isTogglingEmail, setIsTogglingEmail] = useState(false);
  const [isTriggeringDigest, setIsTriggeringDigest] = useState(false);

  const handleToggleGlobalEmail = async () => {
    setIsTogglingEmail(true);
    try {
      const current = emailSettingData?.enabled ?? true;
      const res = await api.post('/accounts/system-settings/toggle-daily-emails/', { enabled: !current });
      toast.success(res.data?.message || 'Email notification setting updated!');
      refetchEmailSetting();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update email setting.');
    } finally {
      setIsTogglingEmail(false);
    }
  };

  const handleTriggerDigestNow = async () => {
    setIsTriggeringDigest(true);
    try {
      const res = await api.post('/accounts/trigger-daily-emails/', { force: true });
      toast.success(`Digest trigger completed! ${res.data?.result?.sent || 0} emails sent.`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to trigger morning emails.');
    } finally {
      setIsTriggeringDigest(false);
    }
  };

  const leadsData = leadsResponse?.results || [];
  const salesData = salesResponse?.results || [];
  const totalLeadsCountFromServer = leadsResponse?.count || 0;
  const totalSalesCountFromServer = salesResponse?.count || 0;

  const isLoading = loadingLeads || loadingSales || loadingCampaigns || loadingTeam;

  const handleRefresh = () => {
    refetchLeads(); refetchSales(); refetchCampaigns(); refetchTeam();
    setLastRefresh(new Date());
  };

  // Helper to check if date is within range
  const isWithinDateRange = (dateStr) => {
    if (dateRange === 'all') return true;
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (dateRange === 'today') {
      return date >= today;
    } else if (dateRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return date >= weekAgo;
    } else if (dateRange === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      return date >= monthAgo;
    } else if (dateRange === 'custom') {
      const start = customStartDate ? new Date(customStartDate) : null;
      const end = customEndDate ? new Date(customEndDate) : null;
      if (start) start.setHours(0,0,0,0);
      if (end) end.setHours(23,59,59,999);
      
      if (start && end) return date >= start && date <= end;
      if (start) return date >= start;
      if (end) return date <= end;
    }
    return true;
  };

  // Filtered
  const filteredLeads = React.useMemo(() => {
    let list = leadsData || [];
    if (selectedBranch !== 'all') list = list.filter(l => l.branch === parseInt(selectedBranch));
    if (selectedSource !== 'all') list = list.filter(l => l.source === selectedSource);
    if (selectedSegment !== 'all') list = list.filter(l => l.segment === parseInt(selectedSegment));
    if (selectedStaff !== 'all') list = list.filter(l => l.assigned_to === parseInt(selectedStaff));
    if (selectedCampaign !== 'all') list = list.filter(l => l.campaign === parseInt(selectedCampaign));
    return list.filter(l => isWithinDateRange(l.created_at));
  }, [leadsData, selectedBranch, dateRange, customStartDate, customEndDate, selectedSource, selectedSegment, selectedStaff, selectedCampaign]);

  const filteredSales = React.useMemo(() => {
    let list = salesData || [];
    if (selectedBranch !== 'all') list = list.filter(s => s.branch === parseInt(selectedBranch));
    if (selectedStaff !== 'all') list = list.filter(s => s.staff === parseInt(selectedStaff));
    // Filter sales by campaign if they were linked via leads (this might require backend change if not directly linked, 
    // but usually in this CRM sales are linked to staff/branch)
    return list.filter(s => isWithinDateRange(s.created_at));
  }, [salesData, selectedBranch, dateRange, customStartDate, customEndDate, selectedStaff]);

  // KPIs
  const totalLeads    = leadsResponse?.count || filteredLeads.length;
  const totalSalesCount = salesResponse?.count || filteredSales.length;
  const advanceBookingsCount = filteredSales.filter(s => s.sale_type === 'advance').length;
  const totalGoldWeight = normalizeGrams(salesResponse?.total_weight || filteredSales.reduce((a, s) => a + parseFloat(s.weight_grams || s.amount || 0), 0));
  const activeCampaigns = (campaignsData || []).filter(c => c.status === 'active').length;
  const staffCount    = (teamData || []).length;
  const convRate      = totalLeads > 0 ? ((totalSalesCount / totalLeads) * 100) : 0;

  // Sales Trend
  const salesTrendData = React.useMemo(() => {
    if (!filteredSales.length) return [];
    const byDate = {};
    filteredSales.forEach(s => {
      const d = new Date(s.created_at);
      let key;
      if (timeRange === 'daily')  key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      else if (timeRange === 'weekly') key = `Wk ${Math.ceil((d.getDate() + d.getDay()) / 7)}`;
      else key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!byDate[key]) byDate[key] = { date: key, weight: 0, count: 0 };
      byDate[key].weight += parseFloat(s.weight_grams || s.amount || 0);
      byDate[key].count++;
    });
    // Normalize weights AFTER summing
    const all = Object.values(byDate).map(v => ({...v, weight: normalizeGrams(v.weight)}));
    return timeRange === 'daily' ? all.slice(-7) : timeRange === 'weekly' ? all.slice(-4) : all.slice(-6);
  }, [filteredSales, timeRange]);

  // Branch Performance
  const branchPerformanceData = React.useMemo(() => {
    if (!filteredSales.length) return [];
    const bd = {};
    filteredSales.forEach(s => {
      const b = s.branch_name || 'Unknown';
      if (!bd[b]) bd[b] = { branch: b, weight: 0, sales: 0 };
      bd[b].weight += parseFloat(s.weight_grams || s.amount || 0);
      bd[b].sales++;
    });
    return Object.values(bd)
      .map(v => ({...v, weight: normalizeGrams(v.weight)}))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }, [filteredSales]);

  // Lead Stage Pie
  const leadStageData = React.useMemo(() => {
    if (!filteredLeads.length) return [];
    const counts = {};
    filteredLeads.forEach(l => { const s = l.stage || 'unknown'; counts[s] = (counts[s] || 0) + 1; });
    const labels = { new:'New', contacted:'Contacted', interested:'Interested', scheduled:'Visit Scheduled', converted:'Converted', lost:'Lost' };
    return Object.entries(counts).map(([stage, count]) => ({ name: labels[stage] || stage, value: count, stage }));
  }, [filteredLeads]);

  // Segment Pie
  const segmentData = React.useMemo(() => {
    if (!filteredLeads.length) return [];
    const counts = {};
    filteredLeads.forEach(l => { const s = l.segment_name || 'Unassigned'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  // Funnel (horizontal bar)
  const funnelData = React.useMemo(() => {
    const stages = ['new','contacted','interested','scheduled','converted'];
    const labels = { new:'New Leads', contacted:'Contacted', interested:'Interested', scheduled:'Visit Scheduled', converted:'Converted' };
    return stages.map(st => ({ name: labels[st], value: filteredLeads.filter(l => l.stage === st).length })).filter(f => f.value > 0);
  }, [filteredLeads]);

  // Staff Leaderboard
  const leaderboard = React.useMemo(() => {
    if (!teamData?.length) return [];
    return teamData
      .filter(u => u.role !== 'owner')
      .map(u => ({
        name: u.full_name || u.username || 'Unknown',
        leads: filteredLeads.filter(l => l.assigned_to === u.id).length,
        sales: filteredSales.filter(s => s.staff === u.id).length,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);
  }, [teamData, filteredLeads, filteredSales]);

  // Recent Activity
  const recentActivity = React.useMemo(() =>
    [...filteredLeads]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)
      .map(l => ({ name: l.name, stage: l.stage, date: new Date(l.created_at).toLocaleDateString('en-IN') })),
    [filteredLeads]);

  // Campaign ROI
  const campaignROI = React.useMemo(() =>
    (campaignsData || []).slice(0, 5).map(c => ({ name: c.name?.substring(0, 12) + '…', roi: c.roi || 0, leads: c.leads_count || 0 })),
    [campaignsData]);

  // Loading skeleton
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
          <h1 className="dash-title">Admin Dashboard</h1>
          <p className="dash-subtitle">
            <Clock size={13} className="inline mr-1" />
            Last updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="dash-header-actions">
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="branch-select"
              title="Filter by Date"
            >
              <option value="all">📅 All Time</option>
              <option value="today">🕒 Today</option>
              <option value="week">📅 Last 7 Days</option>
              <option value="month">📊 Last 30 Days</option>
              <option value="custom">⚙️ Custom Range</option>
            </select>

            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="branch-select"
            >
              <option value="all">🏢 All Branches</option>
              {(branchesData || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            <button 
              className={`refresh-btn ${showAdvancedFilters ? 'bg-[#C9972A] text-white' : ''}`} 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              title="Advanced Filters"
            >
              <Filter size={15} />
            </button>

            <button className="refresh-btn" onClick={handleRefresh} title="Refresh">
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Advanced Filters Panel ─────────────────────────────────── */}
      {showAdvancedFilters && (
        <div className="bg-white border rounded-xl p-4 mb-6 shadow-sm animate-in slide-in-from-top duration-200">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Lead Source</label>
              <select
                value={selectedSource}
                onChange={e => setSelectedSource(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="all">All Sources</option>
                {Object.entries(SOURCE_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Customer Segment</label>
              <select
                value={selectedSegment}
                onChange={e => setSelectedSegment(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="all">All Segments</option>
                {(segmentsData || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Assigned Staff</label>
              <select
                value={selectedStaff}
                onChange={e => setSelectedStaff(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="all">All Staff</option>
                {(teamData || []).map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Campaign</label>
              <select
                value={selectedCampaign}
                onChange={e => setSelectedCampaign(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="all">All Campaigns</option>
                {(campaignsData || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm bg-gray-50"
                  />
                </div>
              </>
            )}
            
            <div className="flex items-end">
              <button 
                onClick={() => {
                  setSelectedSource('all');
                  setSelectedSegment('all');
                  setSelectedStaff('all');
                  setSelectedCampaign('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setDateRange('all');
                  setSelectedBranch('all');
                }}
                className="text-xs text-red-500 font-medium hover:underline p-2"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Gmail / Staff Morning Email Notification Settings ────────────── */}
      <Card className="mb-6 border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/40 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${emailSettingData?.enabled ?? true ? 'bg-amber-100 text-[#C9972A] border border-amber-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
              <Mail size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-gray-900 text-sm">Staff Daily Morning Email Digest Settings</h4>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${emailSettingData?.enabled ?? true ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                  {emailSettingData?.enabled ?? true ? '● ACTIVE (09:00 AM Daily)' : '○ DISABLED BY ADMIN'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Master switch for 09:00 AM work plan & birthday emails sent via Gmail to active staff members.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              disabled={isTogglingEmail}
              onClick={handleToggleGlobalEmail}
              className={`h-9 px-3 text-xs font-bold rounded-lg transition-all ${emailSettingData?.enabled ?? true ? 'border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'}`}
            >
              {isTogglingEmail ? (
                <RefreshCw size={12} className="animate-spin mr-1" />
              ) : emailSettingData?.enabled ?? true ? (
                <>Turn Off Daily Staff Emails</>
              ) : (
                <>Turn On Daily Staff Emails</>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleTriggerDigestNow}
              disabled={isTriggeringDigest}
              className="h-9 px-3 text-[#C9972A] hover:bg-amber-50 text-xs font-bold rounded-lg"
            >
              <Send size={13} className={`mr-1 ${isTriggeringDigest ? 'animate-spin' : ''}`} />
              {isTriggeringDigest ? 'Sending...' : 'Send Test Digest Now'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <KPICard 
          title={dateRange === 'all' ? "Total Leads" : "Leads Generated"}      
          value={totalLeads}      
          sub={
            dateRange === 'all' ? "All-time pipeline" : 
            dateRange === 'today' ? "Received today" :
            dateRange === 'week' ? "Last 7 days" :
            dateRange === 'month' ? "Last 30 days" : "Selected period"
          }    
          icon={Users}       
          color="#C9972A" 
          gradient="linear-gradient(135deg,#C9972A,#F0C84A)" 
        />
        <KPICard 
          title={dateRange === 'all' ? "Total Gold Sold" : "Gold Weight Volume"}   
          value={totalGoldWeight} 
          sub={dateRange === 'all' ? "Total closed sales" : "Sales in selected period"} 
          icon={Zap} 
          color="#0F6E56" 
          gradient="linear-gradient(135deg,#0F6E56,#22C55E)" 
          suffix=" g" 
          decimals={2} 
        />
        <KPICard 
          title="Conversion Rate"   
          value={convRate}        
          sub={dateRange === 'all' ? "All-time efficiency" : "Period conversion %"} 
          icon={Target} 
          color="#F59E0B" 
          gradient="linear-gradient(135deg,#F59E0B,#FCD34D)" 
          suffix="%" 
          decimals={1} 
        />
        <KPICard title="Advance Bookings"  value={advanceBookingsCount} sub="Future fulfillments" icon={Calendar}   color="#8B5CF6" gradient="linear-gradient(135deg,#8B5CF6,#A78BFA)" />
        <KPICard title="Active Campaigns"  value={activeCampaigns} sub="Currently running"     icon={Megaphone}   color="#1A5490" gradient="linear-gradient(135deg,#1A5490,#3B82F6)" />
      </div>

      {/* ── Today's Leads + Source Breakdown ────────────────────── */}
      <TodayLeadsPanel leads={filteredLeads} dateRange={dateRange} />

      {/* ── Sales Trend + Branch Performance ───────────────────────── */}
      <div className="chart-row-2">
        <RevenueTrendWidget 
          data={salesTrendData} 
          timeRange={timeRange} 
          onTimeRangeChange={setTimeRange} 
        />

        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-title">Branch Performance</h3>
              <p className="chart-sub">Weight (grams) by branch</p>
            </div>
          </div>
          <div className="chart-body">
            {branchPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260} minWidth={0}>
                <BarChart data={branchPerformanceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="branch" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="weight" fill="#0F6E56" name="Gold Weight (g)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No branch data available" />}
          </div>
        </div>
      </div>

      {/* ── Lead Stages + Conversion Funnel ────────────────────────── */}
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

        <div className="chart-card">
          <div className="chart-card-header">
            <div><h3 className="chart-title">Segment Performance</h3><p className="chart-sub">Leads by customer segment</p></div>
          </div>
          <div className="chart-body">
            {segmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={230} minWidth={0}>
                <PieChart>
                  <Pie data={segmentData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3}>
                    {segmentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No segment data available" />}
          </div>
        </div>
      </div>

      {/* ── Campaign ROI + Leaderboard + Activity ──────────────────── */}
      <div className="chart-row-3">
        {/* Campaign ROI */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div><h3 className="chart-title">Campaign ROI</h3><p className="chart-sub">Return on investment %</p></div>
          </div>
          <div className="chart-body">
            {campaignROI.length > 0 ? (
              <ResponsiveContainer width="100%" height={230} minWidth={0}>
                <BarChart data={campaignROI}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="roi" fill="#C9972A" name="ROI %" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No campaign data available" />}
          </div>
        </div>

        <StaffLeaderboardWidget data={leaderboard} />
        <RecentActivityWidget activities={recentActivity} />
      </div>

    </div>
  );
};

export default AdminDashboard;
