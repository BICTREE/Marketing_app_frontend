import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/api/axios';
import { 
  Phone, Plus, Loader2, Calendar, Filter, Clock, 
  TrendingUp, BarChart3, User, CheckCircle2, MapPin, Flame 
} from 'lucide-react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { toast } from 'react-hot-toast';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const callSchema = z.object({
  phone: z.string().min(10, 'Phone number is required'),
  lead: z.string().min(1, 'Lead is required'),
  outcome: z.string().min(1, 'Outcome is required'),
  is_hot: z.boolean().default(false),
  needs_field_visit: z.boolean().default(false),
  occasion: z.string().optional(),
  product_interest: z.string().optional(),
  approx_grams: z.string().optional(),
  duration_seconds: z.string().optional(),
  notes: z.string().optional(),
  next_contact_choice: z.string().optional(),
  next_contact_date: z.string().optional(),
  customer_name: z.string().optional()
});

const CallsPage = () => {
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState(null);
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingCall, setEditingCall] = useState(null);

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    })
  });

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'sub_manager';
  const isStaff = !isAdmin && !isManager;
  const isTelecaller = user?.role === 'telecaller' || user?.role === 'staff';

  // Fetch Leads for dropdown
  const { data: leadsData, refetch: refetchLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.get('/leads/leads/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: isDialogOpen
  });

  // Fetch staff list for admin/manager to filter by telecaller
  const { data: staffListData } = useQuery({
    queryKey: ['staff-list-calls'],
    queryFn: () => api.get('/accounts/users/', {
      params: { role: 'telecaller,staff', page_size: 100 }
    }).then(res => {
      const d = res.data.results || res.data;
      return Array.isArray(d) ? d : [];
    }),
    enabled: isAdmin || isManager,
  });

  // Fetch Call Logs (server-side branch filter via DjangoFilterBackend)
  const { data: callsResponse, isLoading } = useQuery({
    queryKey: [
      'calls', selectedBranch, timeRange, 
      customStartDate, customEndDate, page, selectedStaff
    ],
    queryFn: () => api.get('/calls/call-logs/', {
      params: {
        page,
        branch: selectedBranch !== 'all' ? selectedBranch : undefined,
        time_range: timeRange !== 'all' ? timeRange : undefined,
        start_date: timeRange === 'custom' ? customStartDate : undefined,
        end_date: timeRange === 'custom' ? customEndDate : undefined,
        staff: selectedStaff !== 'all' ? selectedStaff : undefined,
      }
    }).then(res => res.data)
  });

  // Server-side filtered — no client-side re-filter needed
  const filteredCalls = callsResponse?.results || [];
  const totalPages = callsResponse?.total_pages || 1;
  const totalCount = callsResponse?.count || 0;
  
  // user/role detection moved above staff query (line ~83)

  // Upcoming scheduled call follow-ups for telecallers
  const { data: upcomingCallsData } = useQuery({
    queryKey: ['upcoming-call-followups', user?.id],
    queryFn: () => api.get('/leads/followups/', {
      params: {
        followup_type: 'call',
        completed: false,
        assigned_to: user?.id,
        time_frame: 'upcoming',
      }
    }).then(r => r.data.results || r.data),
    enabled: !!user?.id && (isStaff || isTelecaller),
  });

  const todayFollowupCalls = React.useMemo(() => {
    if (!upcomingCallsData) return [];
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 2); // today + tomorrow
    return upcomingCallsData.filter(f => {
      const d = new Date(f.scheduled_date);
      return d >= today && d < tomorrow;
    });
  }, [upcomingCallsData]);

  // Chart data
  const callOutcomeData = React.useMemo(() => {
    if (!filteredCalls || filteredCalls.length === 0) return [];
    
    const outcomeCounts = {};
    filteredCalls.forEach(call => {
      const outcome = call.outcome || 'unknown';
      outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
    });
    
    return Object.entries(outcomeCounts).map(([outcome, count]) => ({
      name: outcome.replace('_', ' ').charAt(0).toUpperCase() + outcome.replace('_', ' ').slice(1),
      value: count
    }));
  }, [filteredCalls]);

  const callTrendData = React.useMemo(() => {
    if (!filteredCalls || filteredCalls.length === 0) return [];
    
    const callsByDate = {};
    filteredCalls.forEach(call => {
      const date = new Date(call.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!callsByDate[date]) {
        callsByDate[date] = { date, count: 0, duration: 0 };
      }
      callsByDate[date].count += 1;
      callsByDate[date].duration += parseInt(call.duration_seconds || 0);
    });
    
    return Object.values(callsByDate).slice(-7);
  }, [filteredCalls]);

  const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#B03A2E', '#6B7280', '#EF4444'];

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm({
    resolver: zodResolver(callSchema),
    defaultValues: {
      outcome: 'interested',
      is_hot: false,
      needs_field_visit: false,
      next_contact_choice: 'none'
    }
  });

  const watchedOutcome = watch('outcome');
  const nextContactChoice = watch('next_contact_choice');

  const createMutation = useMutation({
    mutationFn: (newCall) => api.post('/calls/call-logs/', newCall),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      toast.success('Call log saved successfully');
      setIsDialogOpen(false);
      reset();
      setPhoneLookup(null);
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || error.message || 'Failed to save call log';
      toast.error(msg);
      console.error('Call log creation error:', error.response?.data || error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/calls/call-logs/${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      toast.success('Call log updated successfully');
      setIsDialogOpen(false);
      setEditingCall(null);
      reset();
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update call log');
    }
  });

  // Reset form when editingCall changes
  useEffect(() => {
    if (editingCall) {
      reset({
        phone: editingCall.lead_phone || '',
        customer_name: editingCall.lead_name || '',
        lead: editingCall.lead.toString(),
        outcome: editingCall.outcome,
        needs_field_visit: editingCall.needs_field_visit,
        occasion: editingCall.occasion || '',
        notes: editingCall.notes || '',
        duration_seconds: editingCall.duration_seconds?.toString() || '',
        next_contact_choice: 'none', 
      });
      // Try to find customer by phone to populate phoneLookup
      if (editingCall.lead_phone) {
        checkPhone(editingCall.lead_phone);
      }
    } else {
      reset({
        outcome: 'interested',
        is_hot: false,
        needs_field_visit: false,
        next_contact_choice: 'none'
      });
      setPhoneLookup(null);
    }
  }, [editingCall]);

  const checkPhone = async (phone) => {
    if (!phone || phone.length < 10) {
      setPhoneLookup(null);
      return;
    }
    setIsPhoneSearching(true);
    try {
      // Normalize phone number: remove spaces, +, and country code
      const normalizedPhone = phone.replace(/\s+/g, '').replace(/\+/g, '').replace(/^91/, '');
      const response = await api.get(`/leads/customers/by-phone/${normalizedPhone}/`);
      if (response.data && response.data.exists === false) {
        setPhoneLookup(null);
      } else {
        setPhoneLookup(response.data);
        // Fetch leads for this customer
        refetchLeads();
      }
    } catch (error) {
      setPhoneLookup(null);
    } finally {
      setIsPhoneSearching(false);
    }
  };

  const watchedPhone = watch('phone');

  // Debounced phone lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (watchedPhone && watchedPhone.length >= 10) {
        checkPhone(watchedPhone);
      } else {
        setPhoneLookup(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [watchedPhone]);

  const onSubmit = async (data) => {
    const { 
      phone, 
      customer_name, 
      product_interest, 
      approx_grams, 
      is_hot, 
      next_contact_date, 
      next_contact_choice,
      duration_seconds,
      lead: selectedLeadId,
      ...baseCallData 
    } = data;
    
    let leadId = selectedLeadId;

    if (selectedLeadId === 'new_lead') {
      try {
        const newLeadResponse = await api.post('/leads/leads/', {
          name: customer_name || 'New Customer',
          phone: phone,
          source: 'other',
          stage: 'new',
          is_hot: is_hot,
          product_interest: product_interest,
          approx_grams: approx_grams ? parseFloat(approx_grams) : null
        });
        leadId = newLeadResponse.data.id;
      } catch (err) {
        toast.error('Failed to create new lead');
        return;
      }
    }

    const callData = {
      ...baseCallData,
      lead: leadId,
      duration_seconds: duration_seconds ? parseInt(duration_seconds, 10) : null,
      next_followup_date: next_contact_date || null
    };
    
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the errors in the form');
      return;
    }

    if (editingCall) {
      updateMutation.mutate({ id: editingCall.id, data: callData });
    } else {
      if (customer_name && phoneLookup && phoneLookup.id && selectedLeadId !== 'new_lead') {
        api.patch(`/leads/customers/${phoneLookup.id}/`, { name: customer_name })
          .catch(err => console.error('Failed to update customer name:', err));
      }

      if (selectedLeadId !== 'new_lead' && selectedLeadId) {
        const leadUpdate = {};
        if (product_interest) leadUpdate.product_interest = product_interest;
        if (approx_grams) {
          const parsedGrams = parseFloat(approx_grams);
          if (!isNaN(parsedGrams)) leadUpdate.approx_grams = parsedGrams;
        }
        if (is_hot !== undefined) leadUpdate.is_hot = is_hot;
        
        if (Object.keys(leadUpdate).length > 0) {
          api.patch(`/leads/leads/${leadId}/`, leadUpdate)
            .catch(err => console.error('Failed to update lead info:', err));
        }
      }

      createMutation.mutate(callData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Phone className="text-primary" /> Call Logs
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-primary text-primary-foreground' : ''}
          >
            <Filter size={16} className="mr-2" />
            {showFilters ? 'Hide Filters' : 'Filters'}
          </Button>

          {showFilters && (
            <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2">
              {(isAdmin || isManager) && (
                <select 
                  value={selectedBranch}
                  onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="all">All Branches</option>
                  {branchesData?.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              )}

              {(isAdmin || isManager) && staffListData && staffListData.length > 0 && (
                <select
                  value={selectedStaff}
                  onChange={(e) => { setSelectedStaff(e.target.value); setPage(1); }}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="all">All Staff</option>
                  {staffListData.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                  ))}
                </select>
              )}

              <select 
                value={timeRange}
                onChange={(e) => { setTimeRange(e.target.value); setPage(1); }}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>

              {timeRange === 'custom' && (
                <>
                  <Input 
                    type="date" 
                    value={customStartDate} 
                    onChange={e => { setCustomStartDate(e.target.value); setPage(1); }} 
                    className="w-40 h-10"
                  />
                  <Input 
                    type="date" 
                    value={customEndDate} 
                    onChange={e => { setCustomEndDate(e.target.value); setPage(1); }} 
                    className="w-40 h-10"
                  />
                </>
              )}
            </div>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingCall(null);
                setIsDialogOpen(true);
              }}>
                <Plus className="mr-2" size={18} /> Log Call
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCall ? 'Edit Call Log' : 'Log New Call'}</DialogTitle>
                <DialogDescription>
                  {editingCall 
                    ? `Updating interaction details for ${editingCall.lead_name}.` 
                    : 'Record interaction details for a lead. This will update the lead history and follow-up schedule.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Input 
                      id="phone"
                      {...register('phone')} 
                      placeholder="Enter phone number" 
                      className="pr-10"
                    />
                    {isPhoneSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" size={16} />}
                    {!isPhoneSearching && watchedPhone && watchedPhone.length >= 10 && (
                      phoneLookup && phoneLookup.exists !== false ? (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                      ) : (
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      )
                    )}
                  </div>
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>

                {phoneLookup && phoneLookup.exists !== false && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                        {phoneLookup.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{phoneLookup.name}</p>
                        <p className="text-sm text-gray-600">{phoneLookup.phone}</p>
                        {phoneLookup.lead_count > 0 && (
                          <p className="text-xs text-green-600 font-medium">{phoneLookup.lead_count} lead(s) found</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {watchedPhone && watchedPhone.length >= 10 && (
                  <div className="space-y-2">
                    <Label htmlFor="lead">Select Lead *</Label>
                    <Controller
                      name="lead"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger id="lead">
                            <SelectValue placeholder="Select a lead..." />
                          </SelectTrigger>
                          <SelectContent>
                            {leadsData?.filter(l => l.phone === watchedPhone).map(lead => (
                              <SelectItem key={lead.id} value={lead.id.toString()}>
                                {lead.source_display || lead.source} - {lead.stage_display || lead.stage}
                                <span className="text-xs text-gray-500 ml-2">
                                  ({format(new Date(lead.created_at), 'MMM dd')})
                                </span>
                              </SelectItem>
                            ))}
                            <SelectItem value="new_lead" className="text-primary font-medium italic">
                              + Create New Lead for this number
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.lead && <p className="text-sm text-destructive">{errors.lead.message}</p>}
                    
                    {phoneLookup && phoneLookup.exists !== false && (!phoneLookup.leads || phoneLookup.leads.length === 0) && (
                      <p className="text-xs text-amber-600 mt-1">
                        No active leads found for this customer. Please select "+ Create New Lead".
                      </p>
                    )}
                  </div>
                )}

                {(watchedOutcome === 'interested' || phoneLookup) && (
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">
                      {watchedOutcome === 'interested' ? 'Customer Name *' : 'Customer Name'}
                    </Label>
                    <Input 
                      id="customer_name" 
                      {...register('customer_name', { required: watchedOutcome === 'interested' })} 
                      placeholder={phoneLookup ? "Update customer name" : "Enter customer name"}
                      defaultValue={phoneLookup?.name || ''}
                    />
                    {watchedOutcome === 'interested' && !phoneLookup && (
                      <p className="text-xs text-gray-500">Required for interested customers</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="outcome">Outcome *</Label>
                  <Controller
                    name="outcome"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="outcome">
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interested">Interested</SelectItem>
                          <SelectItem value="call_later">Call Later / Callback</SelectItem>
                          <SelectItem value="not_interested">Not Interested</SelectItem>
                          <SelectItem value="no_answer">No Answer</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.outcome && <p className="text-sm text-destructive">{errors.outcome.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col justify-end">
                    <div className="flex items-center space-x-2 py-2 px-3 bg-red-50/50 rounded-lg border border-red-100/50">
                      <input 
                        type="checkbox" 
                        id="is_hot" 
                        {...register('is_hot')} 
                        className="w-4 h-4 text-red-500 rounded focus:ring-red-500 cursor-pointer"
                      />
                      <label htmlFor="is_hot" className="text-sm font-bold text-red-700 cursor-pointer flex items-center gap-1">
                        <Flame size={13} /> Hot Lead
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration_seconds">Duration (sec)</Label>
                    <Input id="duration_seconds" type="number" {...register('duration_seconds')} placeholder="180 (optional)" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="occasion">Special Occasion</Label>
                    <Input id="occasion" {...register('occasion')} placeholder="e.g. Wedding" />
                  </div>
                  <div className="flex flex-col justify-end pb-1">
                    <div className="flex items-center space-x-2 py-2 px-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
                      <input 
                        type="checkbox" 
                        id="needs_field_visit" 
                        {...register('needs_field_visit')} 
                        className="w-4 h-4 text-primary rounded focus:ring-primary cursor-pointer"
                      />
                      <label htmlFor="needs_field_visit" className="text-sm font-bold text-blue-700 cursor-pointer flex items-center gap-1">
                        <MapPin size={13} /> Needs Field Visit
                      </label>
                    </div>
                  </div>
                </div>

                {['interested', 'call_later'].includes(watchedOutcome) && (
                  <>
                    <div className="space-y-2">
                      <Label>Next Contact Date</Label>
                      <Select 
                        value={nextContactChoice || 'none'} 
                        onValueChange={(value) => {
                          setValue('next_contact_choice', value);
                          if (value !== 'custom') {
                            const today = new Date();
                            let nextDate = new Date();
                            switch(value) {
                              case '1day': nextDate.setDate(today.getDate() + 1); break;
                              case '3days': nextDate.setDate(today.getDate() + 3); break;
                              case '7days': nextDate.setDate(today.getDate() + 7); break;
                              case '1month': nextDate.setMonth(today.getMonth() + 1); break;
                              case '6months': nextDate.setMonth(today.getMonth() + 6); break;
                              default: nextDate = null;
                            }
                            if (nextDate) {
                              setValue('next_contact_date', nextDate.toISOString().split('T')[0]);
                            } else {
                              setValue('next_contact_date', '');
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select when to follow up..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No follow-up</SelectItem>
                          <SelectItem value="1day">1 Day</SelectItem>
                          <SelectItem value="3days">3 Days</SelectItem>
                          <SelectItem value="7days">7 Days</SelectItem>
                          <SelectItem value="1month">1 Month</SelectItem>
                          <SelectItem value="6months">6 Months</SelectItem>
                          <SelectItem value="custom">Custom Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {nextContactChoice === 'custom' && (
                      <div className="space-y-2 animate-in slide-in-from-top-1">
                        <Label htmlFor="next_contact_date">Custom Date</Label>
                        <Input 
                          id="next_contact_date" 
                          type="date" 
                          {...register('next_contact_date')} 
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product_interest">Product Interest</Label>
                    <Input id="product_interest" {...register('product_interest')} placeholder="e.g. Bridal Set" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="approx_grams">Approx Weight (Grams)</Label>
                    <Input id="approx_grams" type="number" step="0.01" {...register('approx_grams')} placeholder="45.5" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" {...register('notes')} placeholder="Customer interested in bridal set" />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createMutation.isPending || isPhoneSearching}
                >
                  {createMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                  {editingCall ? 'Update Call Log' : 'Save Call Log'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-[#C9972A] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callsResponse?.total_calls || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {timeRange === 'all' ? 'All-time volume' : `In selected period`}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#0F6E56] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callsResponse?.converted_count || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Lead stage → Won</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#1A5490] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callsResponse?.avg_duration || 0}s</div>
            <p className="text-[10px] text-muted-foreground mt-1">Talk time per call</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#B03A2E] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {callsResponse?.total_calls > 0 ? ((callsResponse.converted_count / callsResponse.total_calls) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Success rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Call Outcomes</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {callOutcomeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <PieChart>
                  <Pie
                    data={callOutcomeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {callOutcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Call Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {callTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <LineChart data={callTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="count" orientation="left" stroke="#C9972A" />
                  <YAxis yAxisId="duration" orientation="right" stroke="#1A5490" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="count" type="monotone" dataKey="count" stroke="#C9972A" strokeWidth={2} name="Calls" />
                  <Line yAxisId="duration" type="monotone" dataKey="duration" stroke="#1A5490" strokeWidth={2} name="Duration (s)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Calls for Telecallers/Staff */}
      {(isStaff || isTelecaller) && upcomingCallsData && upcomingCallsData.length > 0 && (
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" /> My Upcoming Calls
              <Badge className="bg-blue-100 text-blue-700 border-0 ml-1">{upcomingCallsData.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Scheduled follow-up calls assigned to you</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingCallsData.map(followup => (
                <div key={followup.id} className="p-4 rounded-xl border bg-blue-50/30 hover:bg-blue-50/60 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{followup.lead_name}</p>
                      {followup.lead_phone && (
                        <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                          <Phone size={11} /> {followup.lead_phone}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-white text-blue-600 border-blue-200 text-[9px] uppercase">
                      {followup.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
                    <Calendar size={11} />
                    {followup.scheduled_date ? new Date(followup.scheduled_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </div>
                  {followup.note && (
                    <p className="text-xs text-gray-600 italic bg-white rounded-lg p-2 border border-blue-100">{followup.note}</p>
                  )}
                  <button
                    onClick={() => setIsDialogOpen(true)}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                  >
                    <Phone size={13} /> Log This Call
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="bg-card">
          <CardTitle>Call History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Lead</TableHead>
                  {(isAdmin || isManager) && <TableHead>Staff</TableHead>}
                  <TableHead>Outcome</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="hidden md:table-cell">Details</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <Loader2 className="animate-spin inline-block mr-2" /> Loading calls...
                    </TableCell>
                  </TableRow>
                ) : filteredCalls?.length > 0 ? (
                  filteredCalls.map((call) => (
                    <TableRow 
                      key={call.id} 
                      className="group hover:bg-gray-50/80 cursor-pointer transition-colors"
                      onClick={() => {
                        setEditingCall(call);
                        setIsDialogOpen(true);
                      }}
                    >
                      <TableCell className="font-semibold">
                        <div className="flex flex-col">
                          <span className="text-gray-900">{call.lead_name || `Lead #${call.lead}`}</span>
                          {call.needs_field_visit && (
                            <span className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 uppercase tracking-tight">
                              <MapPin size={10} /> Visit Needed
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {(isAdmin || isManager) && <TableCell className="text-sm">{call.staff_name || '—'}</TableCell>}
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          call.outcome === 'converted' ? 'bg-green-100 text-green-800' :
                          call.outcome === 'interested' ? 'bg-blue-100 text-blue-800' :
                          call.outcome === 'callback' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {call.outcome.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>{call.duration_seconds}s</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px]">
                        <div className="flex flex-col gap-0.5">
                          {call.occasion && <p className="text-[10px] font-bold text-indigo-600 uppercase">Occasion: {call.occasion}</p>}
                          <p className="text-sm truncate">{call.notes || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {format(new Date(call.created_at), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No call logs found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {isLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="animate-spin inline-block mr-2 text-muted-foreground" />
                </div>
              ) : filteredCalls?.length > 0 ? (
                filteredCalls.map((call) => (
                  <div 
                    key={call.id} 
                    className="p-4 hover:bg-gray-50 border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-100 transition-colors"
                    onClick={() => {
                      setEditingCall(call);
                      setIsDialogOpen(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <h4 className="font-bold text-gray-900 text-sm">{call.lead_name || `Lead #${call.lead}`}</h4>
                        {call.needs_field_visit && (
                          <span className="text-[9px] font-bold text-blue-600 flex items-center gap-0.5 uppercase">
                            <MapPin size={10} /> Visit Needed
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          call.outcome === 'converted' ? 'bg-green-100 text-green-800' :
                          call.outcome === 'interested' ? 'bg-blue-100 text-blue-800' :
                          call.outcome === 'callback' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {call.outcome.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-500 mb-2">
                      <span className="flex items-center gap-1"><Clock size={10}/> {call.duration_seconds || 0}s</span>
                      <span className="flex items-center gap-1"><Calendar size={10}/> {format(new Date(call.created_at), 'MMM dd, yyyy')}</span>
                    </div>
                    {call.occasion && (
                      <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Occasion: {call.occasion}</p>
                    )}
                    {call.notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md line-clamp-2 italic">
                        &ldquo;{call.notes}&rdquo;
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No call logs found.
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center bg-gray-50/50">
            <p className="text-xs text-muted-foreground font-medium">
              Showing <span className="text-foreground">{filteredCalls.length}</span> of <span className="text-foreground">{totalCount}</span> logs
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3"
              >
                Prev
              </Button>
              <div className="flex items-center px-4 text-xs font-bold text-gray-500">
                {page} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default CallsPage;
