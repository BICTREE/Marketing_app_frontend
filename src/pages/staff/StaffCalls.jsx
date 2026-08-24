import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, isPast, startOfDay, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Phone, PhoneCall, Clock, AlertCircle, Calendar, User, Loader2,
  CheckCircle2, ExternalLink, Plus, MessageSquare, ListTodo
} from 'lucide-react';

import api from '@/api/axios';
import useAuth from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const OUTCOMES = [
  { value: 'interested', label: 'Interested' },
  { value: 'call_later', label: 'Call later / callback' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'converted', label: 'Converted' },
];

const emptyLogForm = {
  outcome: 'interested',
  notes: '',
  duration_seconds: '',
  next_followup_date: '',
  needs_field_visit: false,
};

const parseFollowupDate = (value) => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? parseISO(value) : new Date(value);
  } catch {
    return new Date(value);
  }
};

const telHref = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
};

const StaffCalls = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [queueTab, setQueueTab] = useState('due');
  const [activeTask, setActiveTask] = useState(null);
  const [logForm, setLogForm] = useState(emptyLogForm);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraPhone, setExtraPhone] = useState('');
  const [extraLeadId, setExtraLeadId] = useState('');
  const [phoneLookup, setPhoneLookup] = useState(null);
  const [phoneSearching, setPhoneSearching] = useState(false);

  const { data: followups = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['staff-call-tasks', user?.id],
    queryFn: () => api.get('/leads/followups/', {
      params: {
        followup_type: 'call',
        completed: false,
        page_size: 200,
      },
    }).then((r) => r.data.results || r.data || []),
    enabled: !!user?.id,
  });

  const { data: recentCalls = [], isLoading: historyLoading } = useQuery({
    queryKey: ['staff-call-history', user?.id],
    queryFn: () => api.get('/calls/call-logs/', {
      params: { page: 1, page_size: 30, time_range: 'month' },
    }).then((r) => r.data.results || []),
    enabled: !!user?.id,
  });

  const buckets = useMemo(() => {
    const overdue = [];
    const today = [];
    const later = [];
    (Array.isArray(followups) ? followups : []).forEach((task) => {
      const when = parseFollowupDate(task.scheduled_date);
      if (!when) {
        later.push(task);
        return;
      }
      const day = startOfDay(when);
      if (isToday(when)) today.push(task);
      else if (isPast(day) && !isToday(when)) overdue.push(task);
      else later.push(task);
    });
    const byDate = (a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date);
    overdue.sort(byDate);
    today.sort(byDate);
    later.sort(byDate);
    return { overdue, today, later };
  }, [followups]);

  const dueNow = [...buckets.overdue, ...buckets.today];
  const visibleTasks =
    queueTab === 'due' ? dueNow :
    queueTab === 'later' ? buckets.later :
    [];

  const invalidateCallWork = () => {
    queryClient.invalidateQueries({ queryKey: ['staff-call-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['staff-call-history'] });
    queryClient.invalidateQueries({ queryKey: ['calls'] });
    queryClient.invalidateQueries({ queryKey: ['followups'] });
    queryClient.invalidateQueries({ queryKey: ['customer'] });
  };

  const saveCallMutation = useMutation({
    mutationFn: async ({ payload, followupId }) => {
      const created = await api.post('/calls/call-logs/', payload);
      if (followupId) {
        try {
          await api.patch(`/leads/followups/${followupId}/done/`, {
            outcome: payload.outcome,
            status_reason: payload.notes || '',
          });
        } catch {
          // Call is already stored on the lead; do not roll it back.
        }
      }
      return created.data;
    },
    onSuccess: () => {
      toast.success('Call saved on the lead profile');
      setActiveTask(null);
      setLogForm(emptyLogForm);
      setExtraOpen(false);
      setExtraPhone('');
      setExtraLeadId('');
      setPhoneLookup(null);
      invalidateCallWork();
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Could not save this call. Previous calls were not changed.');
    },
  });

  const openLog = (task) => {
    setActiveTask(task);
    setLogForm(emptyLogForm);
  };

  const submitTaskLog = (e) => {
    e.preventDefault();
    if (!activeTask?.lead) {
      toast.error('This task is missing a lead.');
      return;
    }
    saveCallMutation.mutate({
      followupId: activeTask.id,
      payload: {
        lead: activeTask.lead,
        outcome: logForm.outcome,
        notes: logForm.notes,
        duration_seconds: logForm.duration_seconds ? Number(logForm.duration_seconds) : null,
        needs_field_visit: logForm.needs_field_visit,
        next_followup_date: logForm.next_followup_date || null,
      },
    });
  };

  const lookupPhone = async () => {
    const raw = extraPhone.replace(/\s+/g, '').replace(/\+/g, '').replace(/^91/, '');
    if (raw.length < 10) {
      toast.error('Enter a 10-digit phone number');
      return;
    }
    setPhoneSearching(true);
    try {
      const response = await api.get(`/leads/customers/by-phone/${raw}/`);
      if (response.data?.exists === false) {
        setPhoneLookup(null);
        setExtraLeadId('');
        toast.error('No customer found for this number');
      } else {
        setPhoneLookup(response.data);
        const firstLead = response.data.leads?.[0]?.id || response.data.leads?.[0];
        setExtraLeadId(firstLead ? String(firstLead) : '');
      }
    } catch {
      setPhoneLookup(null);
      toast.error('Could not look up this number');
    } finally {
      setPhoneSearching(false);
    }
  };

  const submitExtraCall = (e) => {
    e.preventDefault();
    const leadId = extraLeadId || phoneLookup?.leads?.[0]?.id;
    if (!leadId) {
      toast.error('Find the lead first, then save the call');
      return;
    }
    saveCallMutation.mutate({
      followupId: null,
      payload: {
        lead: Number(leadId),
        outcome: logForm.outcome,
        notes: logForm.notes,
        duration_seconds: logForm.duration_seconds ? Number(logForm.duration_seconds) : null,
        needs_field_visit: logForm.needs_field_visit,
        next_followup_date: logForm.next_followup_date || null,
      },
    });
  };

  const TaskCard = ({ task, tone }) => {
    const when = parseFollowupDate(task.scheduled_date);
    const phone = task.lead_phone;
    const callLink = telHref(phone);
    const toneClass =
      tone === 'overdue' ? 'border-l-rose-500 bg-rose-50/40' :
      tone === 'today' ? 'border-l-amber-500 bg-amber-50/30' :
      'border-l-sky-500 bg-sky-50/30';

    return (
      <div className={`rounded-2xl border border-gray-100 border-l-4 ${toneClass} p-4 space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 truncate">{task.lead_name || `Lead #${task.lead}`}</p>
            <p className="text-sm text-indigo-700 font-semibold mt-0.5">{phone || 'No phone on file'}</p>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase shrink-0">
            {task.priority || 'medium'}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Calendar size={12} />
          {when ? format(when, 'dd MMM yyyy, h:mm a') : 'No time set'}
          {isTomorrow(when || new Date(0)) && <span className="text-sky-700 font-semibold">Tomorrow</span>}
        </div>

        {task.note && (
          <p className="text-xs text-gray-700 bg-white/80 rounded-xl p-2.5 border border-gray-100">
            {task.note}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {callLink ? (
            <a href={callLink}>
              <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700 h-10">
                <PhoneCall size={15} className="mr-1.5" /> Call
              </Button>
            </a>
          ) : (
            <Button type="button" disabled className="w-full h-10">No number</Button>
          )}
          <Button type="button" variant="outline" className="h-10" onClick={() => openLog(task)}>
            <MessageSquare size={15} className="mr-1.5" /> Add notes
          </Button>
        </div>

        <Link
          to={`/staff/leads/${task.lead}`}
          className="flex items-center justify-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-900"
        >
          Open lead profile <ExternalLink size={11} />
        </Link>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Phone className="text-primary" /> My call tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Call the lead, then save notes. Extra calls are added to the same lead history — nothing is overwritten.
          </p>
        </div>
        <Button onClick={() => { setLogForm(emptyLogForm); setExtraOpen(true); }}>
          <Plus size={16} className="mr-2" /> Log another call
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle size={14} /> Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{buckets.overdue.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <ListTodo size={14} /> Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{buckets.today.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock size={14} /> Later
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{buckets.later.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 bg-gray-50 p-1 rounded-2xl border border-gray-100 w-full sm:w-fit">
        {[
          { id: 'due', label: `Due now (${dueNow.length})` },
          { id: 'later', label: `Upcoming (${buckets.later.length})` },
          { id: 'history', label: 'My recent calls' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setQueueTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              queueTab === tab.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {queueTab !== 'history' && (
        <div>
          {tasksLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="animate-spin inline-block mr-2" /> Loading your call tasks…
            </div>
          ) : visibleTasks.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" />
                <p className="font-semibold">No call tasks in this list</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Use “Log another call” if you need to reach a lead that is not in today’s queue.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleTasks.map((task) => {
                const when = parseFollowupDate(task.scheduled_date);
                const tone = buckets.overdue.some((t) => t.id === task.id)
                  ? 'overdue'
                  : when && isToday(when)
                    ? 'today'
                    : 'later';
                return <TaskCard key={task.id} task={task} tone={tone} />;
              })}
            </div>
          )}
        </div>
      )}

      {queueTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Calls you logged (this month)</CardTitle>
            <p className="text-xs text-muted-foreground">Each save adds a new record. Opening a lead shows the full history.</p>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="py-10 text-center"><Loader2 className="animate-spin inline-block" /></div>
            ) : recentCalls.length === 0 ? (
              <p className="p-8 text-sm text-muted-foreground text-center">No calls logged yet.</p>
            ) : (
              <div className="divide-y">
                {recentCalls.map((call) => (
                  <Link
                    key={call.id}
                    to={`/staff/leads/${call.lead}`}
                    className="flex items-start justify-between gap-3 p-4 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{call.lead_name || `Lead #${call.lead}`}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{(call.outcome || '').replace('_', ' ')}</p>
                      {call.notes && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{call.notes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-gray-400">
                        {call.created_at ? format(new Date(call.created_at), 'dd MMM, h:mm a') : ''}
                      </p>
                      <p className="text-[11px] text-indigo-600 font-semibold mt-1">View profile</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!activeTask} onOpenChange={(open) => !open && setActiveTask(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save call notes</DialogTitle>
            <DialogDescription>
              {activeTask?.lead_name} · {activeTask?.lead_phone}. This adds a new call on the lead profile.
            </DialogDescription>
          </DialogHeader>
          {activeTask && (
            <form onSubmit={submitTaskLog} className="space-y-4 pt-2">
              {telHref(activeTask.lead_phone) && (
                <a href={telHref(activeTask.lead_phone)} className="block">
                  <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <PhoneCall size={16} className="mr-2" /> Dial {activeTask.lead_phone}
                  </Button>
                </a>
              )}
              <CallResultFields form={logForm} setForm={setLogForm} />
              <Button type="submit" className="w-full" disabled={saveCallMutation.isPending}>
                {saveCallMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                Save to lead profile
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={extraOpen} onOpenChange={setExtraOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log another call</DialogTitle>
            <DialogDescription>
              Use this for a callback that is not in your task list. History on the lead is kept; a new call is added.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitExtraCall} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Lead phone</Label>
              <div className="flex gap-2">
                <Input
                  value={extraPhone}
                  onChange={(e) => setExtraPhone(e.target.value)}
                  placeholder="10-digit number"
                />
                <Button type="button" variant="outline" onClick={lookupPhone} disabled={phoneSearching}>
                  {phoneSearching ? <Loader2 className="animate-spin" size={16} /> : 'Find'}
                </Button>
              </div>
            </div>

            {phoneLookup && (
              <div className="rounded-xl border bg-green-50 p-3 text-sm">
                <p className="font-semibold flex items-center gap-2">
                  <User size={14} /> {phoneLookup.name}
                </p>
                <p className="text-xs text-gray-600 mt-1">{phoneLookup.phone}</p>
                {Array.isArray(phoneLookup.leads) && phoneLookup.leads.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <Label className="text-xs">Which lead</Label>
                    <Select value={extraLeadId} onValueChange={setExtraLeadId}>
                      <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                      <SelectContent>
                        {phoneLookup.leads.map((lead) => {
                          const id = String(lead.id || lead);
                          return (
                            <SelectItem key={id} value={id}>
                              Lead #{id} {lead.stage ? `· ${lead.stage}` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {telHref(phoneLookup.phone) && (
                  <a href={telHref(phoneLookup.phone)} className="block mt-3">
                    <Button type="button" variant="outline" className="w-full">
                      <PhoneCall size={14} className="mr-2" /> Dial now
                    </Button>
                  </a>
                )}
              </div>
            )}

            <CallResultFields form={logForm} setForm={setLogForm} />
            <Button type="submit" className="w-full" disabled={saveCallMutation.isPending}>
              {saveCallMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
              Save extra call
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const CallResultFields = ({ form, setForm }) => (
  <>
    <div className="space-y-2">
      <Label>Outcome</Label>
      <Select value={form.outcome} onValueChange={(value) => setForm((prev) => ({ ...prev, outcome: value }))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {OUTCOMES.map((item) => (
            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Duration (sec)</Label>
        <Input
          type="number"
          value={form.duration_seconds}
          onChange={(e) => setForm((prev) => ({ ...prev, duration_seconds: e.target.value }))}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-2">
        <Label>Next call date</Label>
        <Input
          type="date"
          value={form.next_followup_date}
          onChange={(e) => setForm((prev) => ({ ...prev, next_followup_date: e.target.value }))}
        />
      </div>
    </div>
    <label className="flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={form.needs_field_visit}
        onChange={(e) => setForm((prev) => ({ ...prev, needs_field_visit: e.target.checked }))}
      />
      Needs field visit
    </label>
    <div className="space-y-2">
      <Label>Notes</Label>
      <Textarea
        rows={4}
        value={form.notes}
        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
        placeholder="What they said, product interest, when to call back…"
      />
    </div>
  </>
);

export default StaffCalls;
