import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Phone, Calendar, User, Search, Filter, 
  CheckCircle2, Clock, AlertCircle, MoreHorizontal,
  ExternalLink, UserPlus, MessageSquare, Mail, Activity, Sparkles
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import toast from 'react-hot-toast';
import useAuth from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from 'react-router-dom';

const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

const STATUS_ICONS = {
  pending: <Clock size={14} className="text-blue-500" />,
  scheduled: <Calendar size={14} className="text-purple-500" />,
  missed: <AlertCircle size={14} className="text-red-500" />,
  completed: <CheckCircle2 size={14} className="text-green-500" />,
};

const Followups = () => {
  const { isOwner, isManager, user } = useAuth();
  const isAdmin = isOwner || isManager;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isStaffView = window.location.pathname.startsWith('/staff');
  const pathPrefix = isStaffView ? '/staff/leads' : '/leads';
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [assignmentFilter, setAssignmentFilter] = useState('unassigned');
  const [timeFrame, setTimeFrame] = useState('all');
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [followupToComplete, setFollowupToComplete] = useState(null);
  const [staffSearch, setStaffSearch] = useState('');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueFollowup, setIssueFollowup] = useState(null);
  const [issueNote, setIssueNote] = useState('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [completionData, setCompletionData] = useState({
    outcome: '',
    scheduleNext: true,
    nextDate: '',
    nextNote: '',
    nextType: 'call',
    reason: ''
  });

  // Edit / Reschedule state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFollowup, setEditFollowup] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPriority, setEditPriority] = useState('medium');

  // Cancel / Remove state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelFollowup, setCancelFollowup] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const editMutation = useMutation({
    mutationFn: ({ id, scheduled_date, note, priority }) =>
      api.patch(`/leads/followups/${id}/`, { scheduled_date, note, priority }),
    onSuccess: () => {
      toast.success('Follow-up rescheduled! Activity logged to lead profile.');
      setIsEditModalOpen(false);
      queryClient.invalidateQueries(['followups']);
      queryClient.invalidateQueries(['customer']);
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to update follow-up.')
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      api.post(`/leads/followups/${id}/cancel/`, { reason }),
    onSuccess: () => {
      toast.success('Follow-up cancelled! Logged to lead profile.');
      setIsCancelModalOpen(false);
      queryClient.invalidateQueries(['followups']);
      queryClient.invalidateQueries(['customer']);
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to cancel follow-up.')
  });

  const handleReportIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueNote.trim()) {
      toast.error('Please enter an issue note explaining why you cannot complete this task.');
      return;
    }
    setIsSubmittingIssue(true);
    try {
      await api.post(`/leads/followups/${issueFollowup.id}/report-issue/`, { issue_note: issueNote });
      toast.success('Task returned to manager with your issue note.');
      setIsIssueModalOpen(false);
      setIssueNote('');
      queryClient.invalidateQueries(['followups']);
      queryClient.invalidateQueries(['staff-followups']);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to report issue.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const { data: followups, isLoading } = useQuery({
    queryKey: ['followups', statusFilter, timeFrame],
    queryFn: () => api.get('/leads/followups/', { 
      params: { 
        status: statusFilter !== 'all' ? statusFilter : undefined,
        time_frame: timeFrame !== 'all' ? timeFrame : undefined,
        assigned_to__isnull: assignmentFilter === 'unassigned' ? 'true' : assignmentFilter === 'assigned' ? 'false' : undefined
      } 
    }).then(res => res.data.results || res.data)
  });

  const { data: usersData } = useQuery({
    queryKey: ['staff-members'],
    queryFn: () => api.get('/accounts/users/')
      .then(res => res.data.results || res.data),
    enabled: isAdmin
  });

  const ROLE_ORDER = {
    'telecaller': 1,
    'field_staff': 2,
    'staff': 3,
    'custom': 4
  };

  const staffMembers = Array.isArray(usersData) ? usersData
    .filter(u => 
      ['staff', 'telecaller', 'field_staff', 'custom'].includes(u.role) &&
      u.full_name.toLowerCase().includes(staffSearch.toLowerCase())
    )
    .sort((a, b) => (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99))
  : [];

  const assignMutation = useMutation({
    mutationFn: ({ followupId, staffId }) => api.post(`/leads/followups/${followupId}/assign/`, { assigned_to: staffId }),
    onSuccess: () => {
      toast.success('Follow-up assigned successfully');
      setIsAssignModalOpen(false);
      queryClient.invalidateQueries(['followups']);
    },
    onError: () => toast.error('Failed to assign follow-up')
  });

  const markDoneMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/leads/followups/${id}/done/`, {
      outcome: data.outcome,
      next_followup_date: data.scheduleNext ? data.nextDate : null,
      next_followup_note: data.nextNote,
      next_followup_type: data.nextType,
      status_reason: data.reason
    }),
    onSuccess: () => {
      toast.success('Follow-up completed');
      setIsCompleteModalOpen(false);
      setFollowupToComplete(null);
      queryClient.invalidateQueries(['followups']);
    },
    onError: () => toast.error('Failed to complete follow-up')
  });

  const handleAssign = (staffId) => {
    if (selectedFollowup) {
      assignMutation.mutate({ followupId: selectedFollowup.id, staffId });
    }
  };

  const bulkAssignMutation = useMutation({
    mutationFn: (date) => api.post('/leads/followups/bulk-auto-assign/', { date }),
    onSuccess: (res) => {
      toast.success(res.data.detail);
      queryClient.invalidateQueries(['followups']);
    },
    onError: () => toast.error('Failed to perform bulk assignment')
  });

  const filteredFollowups = Array.isArray(followups) ? followups.filter(f => 
    f.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.lead_phone?.includes(searchTerm) ||
    f.note?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Follow-up Assignments
          </h1>
          <p className="text-muted-foreground">Manage and assign customer follow-up tasks to your team.</p>
        </div>
        
        {isAdmin && (
          <Button 
            className="bg-gradient-to-r from-primary to-[#7A5500] hover:shadow-lg transition-all shadow-md group"
            onClick={() => bulkAssignMutation.mutate()}
            disabled={bulkAssignMutation.isPending}
          >
            {bulkAssignMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Activity className="mr-2 h-4 w-4 group-hover:animate-pulse" />
            )}
            Bulk Auto-Assign Tomorrow
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text"
              placeholder="Search leads or notes..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2" size={16} />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
            <SelectTrigger className="w-[180px]">
              <UserPlus className="mr-2" size={16} />
              <SelectValue placeholder="Assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              <SelectItem value="assigned">Assigned Tasks</SelectItem>
              <SelectItem value="unassigned">Unassigned Tasks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          {[
            { id: 'all', label: 'All Time', icon: null },
            { id: 'today', label: 'Today', icon: Clock },
            { id: 'tomorrow', label: 'Tomorrow', icon: Calendar },
            { id: 'upcoming', label: 'Upcoming', icon: ExternalLink },
            { id: 'overdue', label: 'Overdue', icon: AlertCircle },
          ].map((item) => (
            <Button
              key={item.id}
              variant={timeFrame === item.id ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 rounded-full px-4 text-xs font-semibold transition-all ${
                timeFrame === item.id 
                ? 'bg-primary text-primary-foreground shadow-md scale-105' 
                : 'text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setTimeFrame(item.id)}
            >
              {item.icon && <item.icon size={14} className="mr-1.5" />}
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div>
      ) : filteredFollowups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFollowups.map((followup) => (
            <Card key={followup.id} className="overflow-hidden hover:shadow-md transition-shadow border-border/60">
            <div className={`h-1.5 ${
                followup.assigned_to ? 'bg-border' : 'bg-amber-400 animate-pulse'
              }`} />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className={`${PRIORITY_COLORS[followup.priority]} capitalize text-[10px] px-2 py-0`}>
                    {followup.priority}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {STATUS_ICONS[followup.status]}
                    <span className="capitalize">{followup.status}</span>
                  </div>
                </div>
                <CardTitle className="text-lg mt-2 flex items-center justify-between">
                  <span className="truncate">{followup.lead_name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => navigate(`${pathPrefix}/${followup.lead}`)}
                  >
                    <ExternalLink size={14} />
                  </Button>
                </CardTitle>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                   <Phone size={12} /> {followup.lead_phone}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Calendar size={14} className="text-primary" />
                    {format(new Date(followup.scheduled_date), 'PPP')}
                    {isPast(new Date(followup.scheduled_date)) && !followup.completed && (
                      <span className="text-red-500 font-bold ml-auto text-[10px] uppercase">Overdue</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground italic line-clamp-2">
                    "{followup.note || 'No notes provided'}"
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Assigned To</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User size={12} />
                      </div>
                      <span className="text-sm font-medium">{followup.assigned_to_name || 'Unassigned'}</span>
                    </div>
                  </div>

                  {isAdmin && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 border-primary/20 hover:bg-primary/5 text-primary"
                      onClick={() => {
                        setSelectedFollowup(followup);
                        setIsAssignModalOpen(true);
                      }}
                    >
                      <UserPlus size={14} className="mr-1.5" />
                      Assign
                    </Button>
                  )}
                </div>
                
                {!followup.completed && followup.status !== 'returned' && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button 
                      className="flex-1 bg-[#0F6E56] hover:bg-[#084d3c] text-white font-bold text-xs h-8"
                      size="sm"
                      onClick={() => {
                        setFollowupToComplete(followup);
                        setIsCompleteModalOpen(true);
                      }}
                    >
                      <CheckCircle2 size={13} className="mr-1" /> Mark Done
                    </Button>

                    {isAdmin && (
                      <Button 
                        variant="outline"
                        size="sm"
                        className="h-8 border-amber-300 text-amber-900 hover:bg-amber-50 font-bold text-xs"
                        onClick={() => {
                          setEditFollowup(followup);
                          setEditDate(followup.scheduled_date ? followup.scheduled_date.slice(0, 16) : '');
                          setEditNote(followup.note || '');
                          setEditPriority(followup.priority || 'medium');
                          setIsEditModalOpen(true);
                        }}
                      >
                        ✏️ Edit
                      </Button>
                    )}

                    {isAdmin && (
                      <Button 
                        variant="outline"
                        size="sm"
                        className="h-8 border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs"
                        onClick={() => {
                          setCancelFollowup(followup);
                          setCancelReason('');
                          setIsCancelModalOpen(true);
                        }}
                      >
                        🗑️ Cancel
                      </Button>
                    )}

                    <Button 
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs h-8"
                      onClick={() => {
                        setIssueFollowup(followup);
                        setIssueNote('');
                        setIsIssueModalOpen(true);
                      }}
                    >
                      <AlertCircle size={13} className="mr-1" /> Return Issue
                    </Button>
                  </div>
                )}

                {followup.status === 'returned' && (
                  <div className="mt-3 p-2.5 rounded-xl bg-red-50/80 border border-red-200 text-red-900 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-red-700">
                      <AlertCircle size={13} /> Task Returned to Manager:
                    </div>
                    <p className="mt-1 text-gray-700 italic">"{followup.status_reason || 'Staff reported an issue.'}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card rounded-2xl border border-dashed border-border shadow-sm">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
             <Calendar size={32} className="text-muted-foreground opacity-30" />
          </div>
          <h3 className="text-xl font-semibold">No follow-ups found</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            There are no follow-ups matching your current filters. Great job keeping up!
          </p>
        </div>
      )}

      {/* Assignment Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2 bg-gradient-to-b from-primary/5 to-background">
            <DialogTitle className="text-xl font-bold tracking-tight">Assign Follow-up</DialogTitle>
            <DialogDescription className="text-xs">
              Assign this follow-up for <strong className="text-foreground">{selectedFollowup?.lead_name}</strong> to a team member.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-2 space-y-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
              <input 
                type="text"
                placeholder="Search staff by name..."
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
            </div>

            <button
              className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-dashed border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all text-left bg-primary/5 group"
              onClick={() => handleAssign(null)}
              disabled={assignMutation.isPending}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Clock size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-primary">Smart Auto-Assign</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight opacity-70">Best workload balance</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] bg-white border-primary/20 text-primary shadow-sm">AI PICK</Badge>
            </button>
          </div>

          <div className="px-6 pb-6 pt-2">
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
              {Array.isArray(staffMembers) && staffMembers.length > 0 ? (
                staffMembers.map((staff, index) => {
                  const showHeader = index === 0 || staffMembers[index - 1].role !== staff.role;
                  return (
                    <React.Fragment key={staff.id}>
                      {showHeader && (
                        <div className="pt-4 pb-1 sticky top-0 bg-background z-10">
                          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-2">
                            <span className="h-[1px] flex-1 bg-border/50"></span>
                            {staff.role === 'telecaller' ? '📞 Telecallers' : 
                             staff.role === 'field_staff' ? '📍 Field Staff' : 
                             '🏢 Office Staff'}
                            <span className="h-[1px] flex-1 bg-border/50"></span>
                          </span>
                        </div>
                      )}
                      <button
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all text-left group"
                        onClick={() => handleAssign(staff.id)}
                        disabled={assignMutation.isPending}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                            {staff.full_name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{staff.full_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {staff.role === 'telecaller' ? (
                                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">Caller</span>
                              ) : staff.role === 'field_staff' ? (
                                <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase">Field</span>
                              ) : (
                                <span className="text-[9px] font-bold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded uppercase">Staff</span>
                              )}
                              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{staff.email}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center group-hover:border-primary transition-colors">
                          {assignMutation.isPending ? (
                             <Loader2 size={10} className="animate-spin text-primary" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })
              ) : (
                <div className="py-10 text-center space-y-2 opacity-50">
                  <User size={32} className="mx-auto text-muted-foreground" />
                  <p className="text-sm">No staff members found.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 bg-muted/20 border-t border-border flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Complete Follow-up Modal */}
      <Dialog open={isCompleteModalOpen} onOpenChange={setIsCompleteModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Complete Follow-up</DialogTitle>
            <DialogDescription>
              Log the outcome for <strong>{followupToComplete?.lead_name}</strong> and plan the next step.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Interaction Outcome</label>
              <textarea 
                className="w-full p-3 rounded-lg border border-border bg-background text-sm min-h-[80px]"
                placeholder="What happened during this call/visit?"
                value={completionData.outcome}
                onChange={(e) => setCompletionData({...completionData, outcome: e.target.value})}
              />
            </div>

            <div className={`flex items-center justify-between p-3 rounded-xl border border-border/50 transition-colors ${
              completionData.reason === 'not_interested' ? 'bg-red-50 opacity-80' : 'bg-muted/30'
            }`}>
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                <span className="text-sm font-semibold">
                  {completionData.reason === 'not_interested' ? 'Next follow-up disabled' : 'Schedule next follow-up?'}
                </span>
              </div>
              <input 
                type="checkbox" 
                className="w-5 h-5 accent-primary cursor-pointer disabled:cursor-not-allowed"
                checked={completionData.reason === 'not_interested' ? false : completionData.scheduleNext}
                disabled={completionData.reason === 'not_interested'}
                onChange={(e) => setCompletionData({...completionData, scheduleNext: e.target.checked})}
              />
            </div>

            {completionData.scheduleNext ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Next Date</label>
                    <input 
                      type="datetime-local" 
                      className="w-full p-2 rounded-lg border border-border bg-background text-sm"
                      value={completionData.nextDate}
                      onChange={(e) => setCompletionData({...completionData, nextDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Type</label>
                    <Select 
                      value={completionData.nextType} 
                      onValueChange={(v) => setCompletionData({...completionData, nextType: v})}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Phone Call</SelectItem>
                        <SelectItem value="visit">Field Visit</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Next Action Note</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Call to finalize order"
                    className="w-full p-2 rounded-lg border border-border bg-background text-sm"
                    value={completionData.nextNote}
                    onChange={(e) => setCompletionData({...completionData, nextNote: e.target.value})}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-bold uppercase text-muted-foreground">Reason for Closing</label>
                <Select 
                  value={completionData.reason} 
                  onValueChange={(v) => setCompletionData({...completionData, reason: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="converted">Lead Converted (Won)</SelectItem>
                    <SelectItem value="not_interested">Not Interested / Rejected</SelectItem>
                    <SelectItem value="wrong_number">Wrong Number / Invalid</SelectItem>
                    <SelectItem value="no_response">No Response after multiple tries</SelectItem>
                    <SelectItem value="other">Other Reason</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCompleteModalOpen(false)}>Cancel</Button>
            <Button 
              className="bg-[#0F6E56] hover:bg-[#084d3c]"
              onClick={() => markDoneMutation.mutate({ id: followupToComplete.id, data: completionData })}
              disabled={markDoneMutation.isPending || !completionData.outcome || (completionData.scheduleNext && !completionData.nextDate)}
            >
              {markDoneMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle2 className="mr-2" size={16} />}
              Finalize & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Issue & Return Task Modal */}
      <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-red-600">
              <AlertCircle size={18} /> Return Task to Manager
            </DialogTitle>
            <DialogDescription className="text-xs">
              If you cannot complete this task for <strong className="text-foreground">{issueFollowup?.lead_name}</strong>, explain the issue below. Your manager will be notified immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReportIssueSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase">Issue Note / Reason *</label>
              <textarea
                rows={4}
                required
                placeholder="e.g. Customer unavailable, location out of service area, request callback next month..."
                className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm outline-none transition-all"
                value={issueNote}
                onChange={(e) => setIssueNote(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsIssueModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingIssue || !issueNote.trim()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isSubmittingIssue ? <Loader2 className="animate-spin mr-2" size={16} /> : <AlertCircle className="mr-2" size={16} />}
                Send Issue & Return Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit / Reschedule Follow-up Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-amber-900">
              ✏️ Reschedule &amp; Edit Follow-up
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reschedule follow-up for <strong className="text-foreground">{editFollowup?.lead_name}</strong>. Rescheduling creates a log entry on the Lead Profile timeline.
            </DialogDescription>
          </DialogHeader>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!editFollowup) return;
              editMutation.mutate({
                id: editFollowup.id,
                scheduled_date: editDate,
                note: editNote,
                priority: editPriority
              });
            }} 
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase">Scheduled Date &amp; Time *</label>
              <input
                type="datetime-local"
                required
                className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm outline-none font-medium"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase">Priority</label>
              <select
                className="w-full p-2.5 rounded-xl border border-gray-300 bg-gray-50 text-sm font-semibold outline-none"
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Priority</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase">Updated Note / Reason *</label>
              <textarea
                rows={3}
                required
                placeholder="Why is this follow-up being rescheduled? e.g. Customer requested call next Tuesday."
                className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm outline-none"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editMutation.isPending || !editDate || !editNote.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {editMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Save &amp; Log Reschedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove / Cancel Follow-up Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-700">
              🗑️ Cancel / Remove Follow-up Task
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cancelling this task for <strong className="text-foreground">{cancelFollowup?.lead_name}</strong> will remove it from pending queues while logging the cancellation on the Lead Profile history.
            </DialogDescription>
          </DialogHeader>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!cancelFollowup) return;
              cancelMutation.mutate({ id: cancelFollowup.id, reason: cancelReason });
            }} 
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase">Reason for Cancellation *</label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Lead purchased elsewhere, duplicate follow-up task, customer not interested..."
                className="w-full p-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white text-sm outline-none"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsCancelModalOpen(false)}>
                Go Back
              </Button>
              <Button
                type="submit"
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {cancelMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Confirm &amp; Log Cancellation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Followups;
