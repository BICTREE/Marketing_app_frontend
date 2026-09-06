import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, PhoneCall, CheckCircle, Plus, Activity, MapPin, MessageSquare, Clock, ChevronRight } from 'lucide-react';
import useAuth from '@/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/dashboard/KPICard';
import { ChartCard, EmptyChart } from '@/components/dashboard/ChartWidget';
import { RecentActivityWidget } from '@/components/dashboard/RecentActivityWidget';
import { formatClientPlace, occasionLabel, FOLLOWUP_DATE_CHIPS, addDaysLocal } from '@/lib/jewelleryOccasions';
import { pipelinePurpose, followupDueLabel } from '@/lib/clientTimeline';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';

const StaffDashboard = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [timeFrame, setTimeFrame] = React.useState('all'); // 'today', 'week', 'month', 'all'
  const [completeTask, setCompleteTask] = React.useState(null);
  const [outcome, setOutcome] = React.useState('');
  const [scheduleNext, setScheduleNext] = React.useState(true);
  const [nextDate, setNextDate] = React.useState('');
  const [nextNote, setNextNote] = React.useState('');
  const [nextType, setNextType] = React.useState('call');
  
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
    queryKey: ['staff-followups-today'],
    queryFn: () => api.get('/leads/followups/', { params: { time_frame: 'today', completed: false } }).then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: hasPermission('followups:view')
  });

  const { data: overdueFollowupsData } = useQuery({
    queryKey: ['staff-followups-overdue'],
    queryFn: () => api.get('/leads/followups/', { params: { time_frame: 'overdue', completed: false } }).then(res => {
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

  const { data: todayVisitsData } = useQuery({
    queryKey: ['staff-visits-today'],
    queryFn: () => api.get('/field-visits/field-visits/', { params: { time_range: 'today' } }).then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: hasPermission('followups:view') || hasPermission('field_visits:view')
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

  const pendingVisits = Array.isArray(visitsData) ? visitsData.filter(v => v.status === 'pending' || v.status === 'scheduled' || v.status === 'active').length : 0;
  const hasCheckedIn = Array.isArray(attendanceData) && attendanceData.length > 0;
  const checkInTime = hasCheckedIn ? attendanceData[0].check_in_time : null;

  const pipelineTasks = React.useMemo(() => {
    const open = (item) => item && !item.completed && item.status !== 'cancelled' && item.status !== 'completed';
    const followups = [...(Array.isArray(followupsData) ? followupsData : []), ...(Array.isArray(overdueFollowupsData) ? overdueFollowupsData : [])]
      .filter(open);
    const seen = new Set();
    const tasks = [];
    followups.forEach((fu) => {
      const key = `fu-${fu.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      tasks.push({ ...fu, kind: fu.followup_type === 'visit' ? 'visit' : 'followup' });
    });
    (Array.isArray(todayVisitsData) ? todayVisitsData : [])
      .filter((visit) => visit.status !== 'completed' && visit.status !== 'cancelled')
      .forEach((visit) => {
        const already = tasks.some((t) => t.lead === visit.lead && t.followup_type === 'visit');
        if (already) return;
        tasks.push({
          ...visit,
          kind: 'visit',
          followup_type: 'visit',
          note: visit.notes || visit.note || 'Field visit scheduled for this client.',
          assigned_to_name: visit.staff_name || visit.assigned_to_name,
          scheduled_date: visit.scheduled_date || visit.created_at,
        });
      });
    tasks.sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0));
    return tasks;
  }, [followupsData, overdueFollowupsData, todayVisitsData]);

  const completeMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/leads/followups/${id}/done/`, {
      outcome: data.outcome,
      next_followup_date: data.scheduleNext ? data.nextDate : null,
      next_followup_note: data.nextNote,
      next_followup_type: data.nextType,
      status_reason: data.reason || '',
    }),
    onSuccess: () => {
      toast.success('Follow-up marked completed');
      setCompleteTask(null);
      setOutcome('');
      setNextNote('');
      queryClient.invalidateQueries({ queryKey: ['staff-followups-today'] });
      queryClient.invalidateQueries({ queryKey: ['staff-followups-overdue'] });
      queryClient.invalidateQueries({ queryKey: ['followups'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Could not complete follow-up'),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Welcome back, {user?.full_name?.split(' ')[0] || 'Staff'}!
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Here is what's happening with your schedule today.</p>
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
          <ChartCard title="Today's outbound pipeline">
            <div className="space-y-3">
              {pipelineTasks.length > 0 ? (
                pipelineTasks.map((task) => {
                  const purpose = pipelinePurpose(task);
                  const isVisit = task.kind === 'visit' || task.followup_type === 'visit';
                  const place = formatClientPlace({
                    house_name: task.lead_house_name,
                    street: task.lead_street,
                    village: task.lead_village,
                    district: task.lead_district,
                  }) || task.lead_address || '';
                  const due = task.due_in || followupDueLabel(task.scheduled_date);
                  const timeLabel = (() => {
                    try {
                      const d = new Date(task.scheduled_date);
                      return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch {
                      return '';
                    }
                  })();
                  const openLead = () => {
                    if (task.lead) navigate(`/staff/leads/${task.lead}`);
                  };
                  return (
                    <div
                      key={`${task.kind}-${task.id}`}
                      className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-all hover:shadow-sm cursor-pointer"
                      onClick={openLead}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            {task.followup_type === 'call' ? <PhoneCall size={14} /> : isVisit ? <MapPin size={14} /> : <MessageSquare size={14} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{task.lead_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {task.lead_phone || 'No phone'}
                              {task.lead_mobile2 ? ` · 2nd ${task.lead_mobile2}` : ''}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${isVisit ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {purpose}
                              </span>
                              {task.priority ? (
                                <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  {task.priority}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {task.lead_phone && !isVisit ? (
                          <Button size="sm" className="h-8 shrink-0 bg-[#0F6E56] hover:bg-[#084d3c] text-white" asChild onClick={(e) => e.stopPropagation()}>
                            <a href={`tel:${task.lead_phone}`}><PhoneCall size={12} className="mr-1" /> Call</a>
                          </Button>
                        ) : (
                          <ChevronRight size={16} className="text-primary shrink-0 mt-2" />
                        )}
                      </div>
                      {place ? <p className="text-[11px] text-muted-foreground mt-2">Place: {place}</p> : null}
                      {(task.lead_occasion_label || task.lead_occasion) ? (
                        <p className="text-[11px] text-muted-foreground">
                          Occasion: {task.lead_occasion_label || occasionLabel(task.lead_occasion)}
                          {task.lead_bride_age ? ` · bride age ${task.lead_bride_age}` : ''}
                        </p>
                      ) : null}
                      {task.assigned_to_name ? (
                        <p className="text-[11px] text-muted-foreground">Assigned to {task.assigned_to_name}</p>
                      ) : null}
                      <p className="text-[11px] font-semibold text-foreground mt-1 flex items-center gap-1">
                        <Clock size={10} />
                        {timeLabel || 'Time not set'}
                        {due ? ` · duration ${due}` : ''}
                      </p>
                      <p className="text-[12px] text-slate-600 mt-1 line-clamp-2">{task.note || 'No notes added for this follow-up.'}</p>
                      {isVisit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 h-8 w-full text-xs"
                          onClick={(e) => { e.stopPropagation(); openLead(); }}
                        >
                          <MapPin size={12} className="mr-1" /> Open client details
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2 h-8 w-full text-xs bg-[#0F6E56] hover:bg-[#084d3c] text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompleteTask(task);
                            setOutcome('');
                            setScheduleNext(true);
                            setNextType('call');
                            setNextNote('');
                            setNextDate(addDaysLocal(1, { withTime: true }));
                          }}
                        >
                          <CheckCircle size={12} className="mr-1" /> Mark {purpose.toLowerCase()} completed
                        </Button>
                      )}
                    </div>
                  );
                })
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

      <Dialog open={!!completeTask} onOpenChange={(open) => !open && setCompleteTask(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Complete {completeTask ? pipelinePurpose(completeTask).toLowerCase() : 'follow-up'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {completeTask?.lead_name} · {completeTask?.due_in || followupDueLabel(completeTask?.scheduled_date)}
            </p>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="What happened on this call / visit?"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={scheduleNext} onChange={(e) => setScheduleNext(e.target.checked)} />
              Schedule next follow-up
            </label>
            {scheduleNext && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {FOLLOWUP_DATE_CHIPS.map((chip) => (
                    <Button key={chip.label} type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setNextDate(addDaysLocal(chip.days, { withTime: true }))}>
                      {chip.label}
                    </Button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
                <select className="w-full rounded-md border border-input px-3 py-2 text-sm" value={nextType} onChange={(e) => setNextType(e.target.value)}>
                  <option value="call">Phone call</option>
                  <option value="visit">Field visit</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
                <input
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="Next follow-up note"
                  value={nextNote}
                  onChange={(e) => setNextNote(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTask(null)}>Cancel</Button>
            <Button
              className="bg-[#0F6E56] hover:bg-[#084d3c] text-white"
              disabled={completeMutation.isPending || !outcome.trim()}
              onClick={() => completeMutation.mutate({
                id: completeTask.id,
                data: {
                  outcome,
                  scheduleNext,
                  nextDate,
                  nextNote,
                  nextType,
                  reason: scheduleNext ? '' : 'closed',
                },
              })}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffDashboard;
