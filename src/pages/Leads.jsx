import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  Search, Plus, User, Phone, Mail, Calendar, Flame, Loader2,
  TrendingUp, BarChart3, ChevronDown, RefreshCw, Filter, Clock,
  ArrowUpRight, CheckCircle2, Users, Activity, Info, Tag, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';

// Design Tokens
const STAGE_META = {
  new:        { label: 'New',       color: '#6B7280', bg: '#F3F4F6' },
  contacted:  { label: 'Contacted', color: '#3B82F6', bg: '#DBEAFE' },
  interested: { label: 'Interested', color: '#8B5CF6', bg: '#EDE9FE' },
  scheduled:  { label: 'Scheduled', color: '#F59E0B', bg: '#FEF3C7' },
  converted:  { label: 'Won',       color: '#10B981', bg: '#D1FAE5' },
  lost:       { label: 'Lost',      color: '#EF4444', bg: '#FEE2E2' },
};

const SOURCE_META = {
  walkin:    { label: 'Walk-in',   color: '#6B7280', bg: '#F3F4F6' },
  instagram: { label: 'Instagram', color: '#E1306C', bg: '#FDF2F8' },
  facebook:  { label: 'Facebook',  color: '#1877F2', bg: '#EFF6FF' },
  website:   { label: 'Website',   color: '#10B981', bg: '#ECFDF5' },
  referral:  { label: 'Referral',  color: '#8B5CF6', bg: '#F5F3FF' },
  whatsapp:  { label: 'WhatsApp',  color: '#25D366', bg: '#F0FDF4' },
};

const COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444'];

const StageBadge = ({ stage }) => {
  const m = STAGE_META[stage] || { label: stage, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <Badge style={{ background: m.bg, color: m.color }} className="font-medium">
      {m.label}
    </Badge>
  );
};

const SourceBadge = ({ source }) => {
  const m = SOURCE_META[source] || { label: source, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <Badge style={{ background: m.bg, color: m.color }} className="font-medium">
      {m.label}
    </Badge>
  );
};

const leadSchema = z.object({
  name:   z.string().min(2, 'Name is required'),
  phone:  z.string().min(10, 'Valid phone required'),
  email:  z.string().email().optional().or(z.literal('')),
  source: z.string().min(1, 'Source is required'),
  stage:  z.string().min(1, 'Stage is required'),
  notes:  z.string().optional(),
  recommendations: z.string().optional(),
  referred_by: z.string().optional(),
  approx_grams: z.string().optional().or(z.number()).optional(),
  occasion: z.string().optional(),
  product_interest: z.string().optional(),
  lead_type: z.string().default('normal'),
  followup_choice: z.string().optional(),
  followup_date: z.string().optional(),
  date_of_birth: z.string().optional().or(z.literal('')),
  is_hot: z.boolean().default(false),
});

// ── Components ──────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 border rounded shadow">
      <p className="text-xs font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-lg border">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, color }}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
    <p className="text-xs text-gray-400">{sub}</p>
  </div>
);

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

const Leads = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [timeRange, setTimeRange] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState(null);
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);

  // Follow-up Modal state
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedLeadForFollowUp, setSelectedLeadForFollowUp] = useState(null);
  const [followUpForm, setFollowUpForm] = useState({
    lead_id: '',
    followup_type: 'call',
    assigned_to: '',
    scheduled_date: '',
    priority: 'medium',
    note: ''
  });

  const queryClient = useQueryClient();

  const createFollowUpMutation = useMutation({
    mutationFn: async (payload) => {
      const targetLeadId = payload.lead_id || selectedLeadForFollowUp?.id;
      if (!targetLeadId) throw new Error("Please select a lead for follow-up.");

      // 1. Create Followup
      const res = await api.post('/leads/followups/', {
        lead: targetLeadId,
        followup_type: payload.followup_type,
        assigned_to: payload.assigned_to || undefined,
        scheduled_date: payload.scheduled_date,
        priority: payload.priority,
        note: payload.note
      });

      // 2. If type is 'visit' and assigned, also create FieldVisit record
      if (payload.followup_type === 'visit' && payload.assigned_to) {
        try {
          await api.post('/field-visits/field-visits/', {
            lead: targetLeadId,
            staff: payload.assigned_to,
            scheduled_date: payload.scheduled_date,
            notes: payload.note
          });
        } catch (e) {
          console.error("Field visit creation error:", e);
        }
      }

      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['fieldvisits'] });
      toast.success('Follow-up scheduled & assigned successfully!');
      setShowFollowUpModal(false);
      setSelectedLeadForFollowUp(null);
      setFollowUpForm({
        lead_id: '',
        followup_type: 'call',
        assigned_to: '',
        scheduled_date: '',
        priority: 'medium',
        note: ''
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || err.message || 'Failed to schedule follow-up');
    }
  });

  // Auto-open modal if ?add=true in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('add') === 'true') {
      setIsAddModalOpen(true);
      // Clean up the URL without reloading the page
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'sub_manager';
  const isStaff = !isAdmin && !isManager;
  const isStaffView = window.location.pathname.startsWith('/staff');
  const pathPrefix = isStaffView ? '/staff/leads' : '/leads';

  // Fetch segments for filtering
  const { data: segmentsData } = useQuery({
    queryKey: ['segments'],
    queryFn: () => api.get('/branches/segments/').then(res => res.data.results || res.data)
  });

  // Fetch branches for admin/owner
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => res.data.results || res.data),
    enabled: isAdmin
  });

  // Fetch team members for filtering
  const { data: teamData } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get('/accounts/users/').then(res => res.data.results || res.data)
  });

  const { data: leadsResponse, isLoading } = useQuery({
    queryKey: [
      'leads', page, stageFilter, searchTerm, 
      selectedBranch, selectedSource, selectedSegment, 
      selectedStaff, timeRange, customStartDate, customEndDate
    ],
    queryFn: () => api.get('/leads/leads/', { 
      params: { 
        page, 
        stage: stageFilter !== 'all' ? stageFilter : undefined,
        search: searchTerm || undefined,
        branch: selectedBranch !== 'all' ? selectedBranch : undefined,
        source: selectedSource !== 'all' ? selectedSource : undefined,
        segment: selectedSegment !== 'all' ? selectedSegment : undefined,
        assigned_to: selectedStaff !== 'all' ? selectedStaff : undefined,
        time_range: timeRange !== 'all' ? timeRange : undefined,
        start_date: timeRange === 'custom' ? customStartDate : undefined,
        end_date: timeRange === 'custom' ? customEndDate : undefined,
      } 
    }).then(r => r.data)
  });

  const leadsData = leadsResponse?.results || [];
  const totalLeadsCount = leadsResponse?.count || 0;
  const totalPages = leadsResponse?.total_pages || 1;

  // Fetch summary stats for source conversion cards
  const { data: summaryData } = useQuery({
    queryKey: [
      'leads-summary', stageFilter, searchTerm, 
      selectedBranch, selectedSource, selectedSegment, 
      selectedStaff, timeRange, customStartDate, customEndDate
    ],
    queryFn: () => api.get('/leads/leads/summary/', { 
      params: { 
        stage: stageFilter !== 'all' ? stageFilter : undefined,
        search: searchTerm || undefined,
        branch: selectedBranch !== 'all' ? selectedBranch : undefined,
        source: selectedSource !== 'all' ? selectedSource : undefined,
        segment: selectedSegment !== 'all' ? selectedSegment : undefined,
        assigned_to: selectedStaff !== 'all' ? selectedStaff : undefined,
        time_range: timeRange !== 'all' ? timeRange : undefined,
        start_date: timeRange === 'custom' ? customStartDate : undefined,
        end_date: timeRange === 'custom' ? customEndDate : undefined,
      } 
    }).then(r => r.data)
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/leads/leads/', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads']);
      setIsAddModalOpen(false);
      reset();
      setPhoneLookup(null);
    },
    onError: (error) => {
      console.error('Lead creation error:', error.response?.data || error.message);
      alert(`Error creating lead: ${JSON.stringify(error.response?.data || 'Unknown error')}`);
    }
  });

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
        // Pre-fill form with existing customer data
        if (response.data.name) setValue('name', response.data.name);
        if (response.data.email) setValue('email', response.data.email);
        if (response.data.date_of_birth) setValue('date_of_birth', response.data.date_of_birth);
      }
    } catch (error) {
      setPhoneLookup(null);
    } finally {
      setIsPhoneSearching(false);
    }
  };

  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors } } = useForm({
    resolver: zodResolver(leadSchema),
    defaultValues: { source: 'walkin', stage: 'new', followup_choice: 'none', is_hot: false },
  });

  const watchedPhone = watch('phone');
  const followupChoice = watch('followup_choice');
  const watchedBranch = watch('branch');

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

  const onSubmit = (data) => {
    console.log('Form data before cleanup:', data);
    console.log('User data:', user);
    console.log('isAdmin:', isAdmin);
    console.log('watchedBranch:', watchedBranch);
    console.log('branchesData:', branchesData);
    
    // Clean up empty fields
    if (data.email === '') delete data.email;
    if (data.date_of_birth === '') delete data.date_of_birth;
    if (data.notes === '') delete data.notes;
    if (data.recommendations === '') delete data.recommendations;
    if (data.referred_by === '') delete data.referred_by;
    if (data.occasion === '') delete data.occasion;
    if (data.product_interest === '') delete data.product_interest;
    if (data.approx_grams === '' || data.approx_grams === undefined) {
      delete data.approx_grams;
    } else {
      const parsed = parseFloat(data.approx_grams);
      if (isNaN(parsed)) {
        delete data.approx_grams;
      } else {
        data.approx_grams = parsed;
      }
    }
    
    // Ensure followup fields are kept so the backend can create the FollowUp task
    // (Django REST Framework ignores unknown fields during validation, but views can read them from request.data)
    
    // Always set branch for non-admin users from localStorage
    if (!isAdmin) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          if (userData.branch) {
            data.branch = userData.branch;
            console.log('Setting branch from localStorage:', userData.branch);
          } else {
            alert('Error: Your account is not assigned to a branch. Please contact admin.');
            return;
          }
        } catch (e) {
          console.error('Error parsing user data:', e);
          alert('Error: Could not determine your branch. Please contact admin.');
          return;
        }
      } else {
        alert('Error: User data not found. Please log in again.');
        return;
      }
    } else {
      // For admin users, branch must be selected from dropdown
      // Use watchedBranch since Controller may not sync to data object immediately
      if (!watchedBranch) {
        alert('Error: Please select a branch.');
        return;
      }
      data.branch = watchedBranch;
    }
    
    console.log('Form data after cleanup:', data);
    createMutation.mutate(data);
  };

  const leads = Array.isArray(leadsData) ? leadsData : [];

  // Groups leads by phone for the table display
  const groupedLeads = React.useMemo(() => {
    const groups = {};
    leads.forEach(lead => {
      if (!groups[lead.phone]) {
        groups[lead.phone] = { ...lead, total_leads: 1 };
      } else {
        groups[lead.phone].total_leads += 1;
        if (new Date(lead.created_at) > new Date(groups[lead.phone].created_at)) {
          groups[lead.phone] = { ...lead, total_leads: groups[lead.phone].total_leads };
        }
      }
    });
    return Object.values(groups);
  }, [leads]);

  const converted = leads.filter(l => l.stage === 'converted').length;
  const hotLeads  = leads.filter(l => l.is_hot).length;
  const convRate  = leads.length > 0 ? ((converted / leads.length) * 100).toFixed(1) : '0.0';

  const stageData = React.useMemo(() => {
    const counts = {};
    groupedLeads.forEach(l => { const s = l.stage || 'unknown'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([s, c]) => ({ name: STAGE_META[s]?.label || s, value: c }));
  }, [groupedLeads]);

  const sourceData = React.useMemo(() => {
    const counts = {};
    groupedLeads.forEach(l => { const s = l.source || 'unknown'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([s, c]) => ({ name: SOURCE_META[s]?.label || s, value: c }));
  }, [groupedLeads]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">{totalLeadsCount} total leads</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="pl-10 pr-4 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9972A]/40 w-64 bg-white"
            />
          </div>

          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 h-10 rounded-xl border text-sm font-bold transition-all ${showFilters ? 'bg-[#C9972A] text-white border-[#C9972A]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#C9972A]'}`}
          >
            <Filter size={16} />
            {showFilters ? 'Hide Filters' : 'Filters'}
          </button>

          <Button
            variant="outline"
            className="gap-2 h-10 px-4 rounded-xl border-[#C9972A]/60 text-[#C9972A] hover:bg-amber-50 font-bold text-xs shadow-xs"
            onClick={() => {
              setSelectedLeadForFollowUp(null);
              setFollowUpForm({
                lead_id: '',
                followup_type: 'call',
                assigned_to: '',
                scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                priority: 'medium',
                note: ''
              });
              setShowFollowUpModal(true);
            }}
          >
            <Clock size={16} /> Schedule Follow-up
          </Button>

          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-10 px-6 rounded-xl bg-gray-900 hover:bg-black text-white border-0">
                <Plus size={16} /> Add Lead
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{phoneLookup ? 'Add Lead to Existing Customer' : 'Add New Lead'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Phone number first */}
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <div className="relative">
                  <Input 
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
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>

              {/* Show existing customer info if found */}
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
                        <p className="text-xs text-green-600 font-medium">{phoneLookup.lead_count} existing lead(s)</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-green-700 mt-2 font-medium">
                    ✓ This lead will be added to the existing customer profile
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Name *</Label>
                <Input {...register('name')} placeholder="Full name" disabled={!!phoneLookup && !!phoneLookup.name} />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                {phoneLookup && phoneLookup.name && (
                  <p className="text-xs text-gray-500">Auto-filled from existing customer profile</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lead Type *</Label>
                  <Select onValueChange={v => setValue('lead_type', v)} defaultValue="normal">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal Sale</SelectItem>
                      <SelectItem value="advance">Advance Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source *</Label>
                  <Select onValueChange={v => setValue('source', v)} defaultValue="walkin">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SOURCE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stage *</Label>
                <Select onValueChange={v => setValue('stage', v)} defaultValue="new">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STAGE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Branch selector - only for admin/owner */}
              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch *</Label>
                  <Controller
                    name="branch"
                    control={control}
                    render={({ field }) => (
                      <Select 
                        value={field.value || ''} 
                        onValueChange={v => {
                          console.log('Branch selected:', v);
                          field.onChange(v);
                        }}
                      >
                        <SelectTrigger id="branch">
                          <SelectValue placeholder={branchesData?.length ? "Select branch" : "Loading branches..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {branchesData?.map(branch => (
                            <SelectItem key={branch.id} value={branch.id.toString()}>{branch.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.branch && <p className="text-sm text-red-500">{errors.branch.message}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input {...register('email')} placeholder="Email (needed for birthday wish)" disabled={!!phoneLookup && !!phoneLookup.email} />
                  {phoneLookup && phoneLookup.email && (
                    <p className="text-xs text-gray-500">Auto-filled from existing customer profile</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" {...register('date_of_birth')} disabled={!!phoneLookup && !!phoneLookup.date_of_birth} />
                  <p className="text-[11px] text-muted-foreground">On this date at 12:01 AM we email a birthday wish automatically.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Approx. Grams (g)</Label>
                  <Input type="number" step="0.001" {...register('approx_grams')} placeholder="Expected weight in grams" />
                </div>
                <div className="space-y-2">
                  <Label>Occasion</Label>
                  <Input {...register('occasion')} placeholder="e.g. Wedding, Anniversary" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product Interest</Label>
                <Input {...register('product_interest')} placeholder="e.g. Diamond Necklace, Gold Bangles" />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <textarea {...register('notes')} className="w-full min-h-[80px] rounded-md border p-3 text-sm" placeholder="Additional notes..." />
              </div>

              {/* Hot Lead Toggle */}
              <div className="flex items-center gap-2 py-2 px-3 bg-red-50/50 rounded-xl border border-red-100/50">
                <input
                  type="checkbox"
                  id="is_hot"
                  {...register('is_hot')}
                  className="w-4 h-4 text-red-500 rounded focus:ring-red-500 cursor-pointer"
                />
                <label htmlFor="is_hot" className="text-sm font-bold text-red-600 cursor-pointer flex items-center gap-1.5">
                  <Flame size={14} /> Mark as Hot Lead (High Priority)
                </label>
              </div>

              {/* Follow-up Scheduling */}
              <div className="space-y-2">
                <Label>Schedule Follow-up</Label>
                <Select onValueChange={v => setValue('followup_choice', v)} defaultValue="none">
                  <SelectTrigger>
                    <SelectValue placeholder="Select follow-up schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No follow-up</SelectItem>
                    <SelectItem value="7_days">7 days</SelectItem>
                    <SelectItem value="1_month">1 month</SelectItem>
                    <SelectItem value="6_months">6 months</SelectItem>
                    <SelectItem value="custom">Custom date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {followupChoice === 'custom' && (
                <div className="space-y-2">
                  <Label>Custom Follow-up Date</Label>
                  <Input 
                    type="date" 
                    {...register('followup_date')} 
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={createMutation.isPending || isPhoneSearching}>
                {createMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                {phoneLookup ? 'Add Lead to Customer' : 'Add Lead'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div></div>

      {/* ── Top Level Filter Panel ─────────────────────────────────── */}
      {showFilters && (
        <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 animate-in slide-in-from-top duration-300">
          {/* Mobile Search - Removed as it is now in the table header */}


          {/* Stage */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Current Stage</label>
            <select 
              value={stageFilter} 
              onChange={e => { setStageFilter(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none font-medium"
            >
              <option value="all">All Stages</option>
              {Object.entries(STAGE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Marketing Source</label>
            <select 
              value={selectedSource} 
              onChange={e => { setSelectedSource(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none"
            >
              <option value="all">All Sources</option>
              {Object.entries(SOURCE_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>

          {/* Segment */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Category / Segment</label>
            <select 
              value={selectedSegment} 
              onChange={e => { setSelectedSegment(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none"
            >
              <option value="all">All Segments</option>
              {(segmentsData || []).map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Staff (Only for Admin/Manager) */}
          {(isAdmin || isManager) && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Assigned Staff</label>
              <select 
                value={selectedStaff} 
                onChange={e => { setSelectedStaff(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none"
              >
                <option value="all">All Staff</option>
                {(teamData || []).map(u => (
                  <option key={u.id} value={String(u.id)}>{u.full_name || u.username}</option>
                ))}
              </select>
            </div>
          )}

          {/* Branch (Admin Only) */}
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Branch Location</label>
              <select 
                value={selectedBranch} 
                onChange={e => { setSelectedBranch(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none"
              >
                <option value="all">All Branches</option>
                {(branchesData || []).map(b => (
                  <option key={b.id} value={String(b.id)}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Time Range */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Time Period</label>
            <select 
              value={timeRange} 
              onChange={e => { setTimeRange(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Dates */}
          {timeRange === 'custom' && (
            <div className="lg:col-span-2 flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Start Date</label>
                <input type="date" value={customStartDate} onChange={e => { setCustomStartDate(e.target.value); setPage(1); }} className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white" />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">End Date</label>
                <input type="date" value={customEndDate} onChange={e => { setCustomEndDate(e.target.value); setPage(1); }} className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white" />
              </div>
            </div>
          )}

          <div className="flex items-end pb-1 lg:col-start-4 xl:col-start-6 justify-end">
            <button 
              onClick={() => {
                setSelectedSource('all');
                setSelectedSegment('all');
                setSelectedStaff('all');
                setSelectedBranch('all');
                setTimeRange('month');
                setStageFilter('all');
                setSearchTerm('');
                setPage(1);
              }}
              className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={isStaff ? "My Total Leads" : (timeRange === 'all' ? "Global Total" : "Period Total")} value={totalLeadsCount} sub={isStaff ? "Assigned to me" : "Across all branches"} icon={Users} color="#C9972A" />
        <StatCard label={isStaff ? "My Won Deals" : "Won Deals"} value={leadsResponse?.total_converted || 0} sub={isStaff ? "My conversions" : "Period conversions"} icon={CheckCircle2} color="#10B981" />
        <StatCard label={isStaff ? "My Hot Leads" : "Hot Leads"} value={leadsResponse?.total_hot || 0} sub={isStaff ? "My priorities" : "Period priorities"} icon={Flame} color="#EF4444" />
        <StatCard label={isStaff ? "My Conv. Rate" : "Conv. Rate"} value={`${leadsResponse?.conversion_rate || 0}%`} sub={isStaff ? "My success rate" : "Period success rate"} icon={TrendingUp} color="#8B5CF6" />
      </div>

      {/* Source-wise Performance breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">
            {isStaff ? 'My Performance Breakdown' : 'Source Performance Breakdown'}
          </h3>
          <p className="text-[10px] text-[#C9972A] font-bold uppercase tracking-wider">Total vs Won</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(SOURCE_META).map(([key, meta]) => {
            const stats = (summaryData || []).find(s => s.source === key) || { total: 0, converted: 0 };
            const rate = stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0;
            return (
              <div key={key} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}15`, color: meta.color }}>
                    {key === 'whatsapp' && <MessageSquare size={16} />}
                    {key === 'facebook' && <Users size={16} />}
                    {key === 'instagram' && <Activity size={16} />}
                    {key === 'website' && <TrendingUp size={16} />}
                    {key === 'walkin' && <User size={16} />}
                    {key === 'referral' && <Tag size={16} />}
                  </div>
                  <span className="text-[10px] font-black text-gray-300 group-hover:text-[#C9972A] transition-colors">{rate}%</span>
                </div>
                <h4 className="text-[11px] font-bold text-gray-500 uppercase mb-1">{meta.label}</h4>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-gray-900">{stats.total}</span>
                  <span className="text-[10px] font-bold text-green-500">({stats.converted} Won)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-sm font-semibold mb-4">Stage Distribution</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height={200} minWidth={0}>
              <PieChart>
                <Pie data={stageData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                  {stageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border">
          <h3 className="text-sm font-semibold mb-4">Source Performance</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height={200} minWidth={0}>
              <BarChart data={sourceData}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                  {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold">Leads Table</h3>
            <div className="relative w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Showing page {page} of {totalPages}
          </div>
        </div>
        
        {/* Mobile Search Bar (visible only on small screens) */}
        <div className="p-4 border-b sm:hidden">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="pl-10 h-9 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Desktop Table View */}
          <table className="w-full text-left hidden md:table">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Phone</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Source</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Stage</th>
                {isAdmin && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Branch</th>}
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Owner</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Created</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i}><td colSpan={8} className="px-4 py-8"><div className="h-8 bg-gray-100 rounded animate-pulse"></div></td></tr>
                ))
              ) : groupedLeads.map(lead => (
                <tr
                  key={lead.phone}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`${pathPrefix}/${lead.customer || lead.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-medium">
                        {(lead.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {lead.name}
                          {lead.is_hot && <Badge variant="destructive" className="text-xs"><Flame size={10} className="mr-1" /> Hot</Badge>}
                          {lead.total_leads > 1 && <Badge variant="secondary" className="text-xs">{lead.total_leads}</Badge>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.phone}</td>
                  <td className="px-4 py-3"><SourceBadge source={lead.source} /></td>
                  <td className="px-4 py-3"><StageBadge stage={lead.stage} /></td>
                  {isAdmin && <td className="px-4 py-3 text-sm text-gray-600">{lead.branch_name || '—'}</td>}
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.assigned_to_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {safeFormat(lead.created_at, 'MMM dd, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 text-xs font-bold border-[#C9972A]/50 text-[#C9972A] hover:bg-amber-50 shadow-2xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLeadForFollowUp(lead);
                        setFollowUpForm({
                          lead_id: lead.id,
                          followup_type: 'call',
                          assigned_to: lead.assigned_to ? String(lead.assigned_to) : '',
                          scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                          priority: 'medium',
                          note: ''
                        });
                        setShowFollowUpModal(true);
                      }}
                    >
                      <Clock size={12} className="mr-1" /> Follow-up
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {isLoading ? (
              [1,2,3,4].map(i => (
                <div key={i} className="p-4"><div className="h-20 bg-gray-100 rounded-xl animate-pulse"></div></div>
              ))
            ) : groupedLeads.map(lead => (
              <div 
                key={lead.phone}
                onClick={() => navigate(`${pathPrefix}/${lead.customer || lead.id}`)}
                className="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold shadow-sm">
                      {(lead.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {lead.name}
                        {lead.is_hot && <Flame size={14} className="text-red-500" />}
                      </h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {lead.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3" />
                      {safeFormat(lead.created_at, 'MMM dd')}
                    </span>
                    <StageBadge stage={lead.stage} />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <SourceBadge source={lead.source} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] font-bold border-[#C9972A]/50 text-[#C9972A] hover:bg-amber-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLeadForFollowUp(lead);
                        setFollowUpForm({
                          lead_id: lead.id,
                          followup_type: 'call',
                          assigned_to: lead.assigned_to ? String(lead.assigned_to) : '',
                          scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                          priority: 'medium',
                          note: ''
                        });
                        setShowFollowUpModal(true);
                      }}
                    >
                      <Clock size={11} className="mr-1" /> + Follow-up
                    </Button>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                      <User size={10} /> {lead.assigned_to_name || 'Unassigned'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isLoading && groupedLeads.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500">No leads found</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center bg-gray-50/50">
            <p className="text-sm text-gray-500">
              Showing <span className="font-semibold">{leads.length}</span> of <span className="font-semibold">{totalLeadsCount}</span> leads
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="flex items-center px-4 text-sm font-medium">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Schedule & Assign Follow-up Modal ────────────────────────────────────── */}
      <Dialog open={showFollowUpModal} onOpenChange={setShowFollowUpModal}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Clock size={18} className="text-[#C9972A]" /> Schedule &amp; Assign Follow-up
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createFollowUpMutation.mutate(followUpForm);
            }}
            className="space-y-4 pt-2"
          >
            {/* Select Lead (if not pre-selected) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Target Lead *</Label>
              {selectedLeadForFollowUp ? (
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900">{selectedLeadForFollowUp.name}</p>
                    <p className="text-gray-500">📞 {selectedLeadForFollowUp.phone} • {selectedLeadForFollowUp.stage || 'lead'}</p>
                  </div>
                  <Badge className="bg-[#C9972A] text-white">Selected</Badge>
                </div>
              ) : (
                <select
                  required
                  value={followUpForm.lead_id}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, lead_id: e.target.value })}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none font-medium"
                >
                  <option value="">Select lead for follow-up...</option>
                  {(groupedLeads || []).map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.phone})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Channel & Staff Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Follow-up Channel *</Label>
                <select
                  value={followUpForm.followup_type}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, followup_type: e.target.value })}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none font-medium"
                >
                  <option value="call">📞 Telecall Follow-up</option>
                  <option value="visit">🚗 Field Visit</option>
                  <option value="whatsapp">💬 WhatsApp Message</option>
                  <option value="email">✉️ Email</option>
                  <option value="sms">📱 SMS</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Assign To Staff</Label>
                <select
                  value={followUpForm.assigned_to}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, assigned_to: e.target.value })}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none font-medium"
                >
                  <option value="">Leave Unassigned / Current Owner</option>
                  {(teamData || []).map(u => (
                    <option key={u.id} value={String(u.id)}>
                      {u.full_name || u.username} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Schedule Date & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Scheduled Date &amp; Time *</Label>
                <Input
                  type="datetime-local"
                  required
                  value={followUpForm.scheduled_date}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, scheduled_date: e.target.value })}
                  min={new Date().toISOString().slice(0, 16)}
                  className="h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Priority</Label>
                <select
                  value={followUpForm.priority}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, priority: e.target.value })}
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#C9972A]/40 outline-none font-medium"
                >
                  <option value="low">🟢 Low Priority</option>
                  <option value="medium">🔵 Medium Priority</option>
                  <option value="high">🟡 High Priority</option>
                  <option value="urgent">🔴 Urgent Priority</option>
                </select>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Follow-up Instructions / Notes</Label>
              <textarea
                value={followUpForm.note}
                onChange={(e) => setFollowUpForm({ ...followUpForm, note: e.target.value })}
                placeholder="Details of what to discuss or follow up on..."
                className="w-full min-h-[80px] p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#C9972A]/40 outline-none"
              />
            </div>

            <Button
              type="submit"
              disabled={createFollowUpMutation.isPending}
              className="w-full h-11 bg-[#C9972A] hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-md shadow-[#C9972A]/20"
            >
              {createFollowUpMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Clock size={16} className="mr-2" />}
              {createFollowUpMutation.isPending ? 'Scheduling...' : 'Save & Assign Follow-up'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
