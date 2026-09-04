import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import CustomerQuickActions from './CustomerQuickActions';
import {
  User, Phone, MapPin, Calendar, Clock, Mail, Activity, UserCheck,
  ShoppingBag, TrendingUp, MessageSquare, Star, Tag, ChevronDown,
  ChevronUp, Flame, CheckCircle2, AlertCircle, Gift, Edit2,
  Home, Map, Globe, StickyNote, Briefcase, FileText, Save, X, Plus, Loader2,
  ShieldCheck, RefreshCw, Send, Sparkles, Filter, CheckCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { formatGrams } from '../lib/utils';
import toast from 'react-hot-toast';

// ── Helpers & Constants ───────────────────────────────────────────────────────
const STAGE_META = {
  new:        { label: 'New Lead',   color: '#6B7280', bg: '#F3F4F6' },
  contacted:  { label: 'Contacted',  color: '#3B82F6', bg: '#DBEAFE' },
  interested: { label: 'Interested', color: '#8B5CF6', bg: '#EDE9FE' },
  scheduled:  { label: 'Meeting',    color: '#F59E0B', bg: '#FEF3C7' },
  converted:  { label: 'Won Deal',   color: '#10B981', bg: '#D1FAE5' },
  lost:       { label: 'Closed',     color: '#EF4444', bg: '#FEE2E2' },
};

const SOURCE_COLORS = {
  walkin: '#6B7280', instagram: '#E1306C', facebook: '#1877F2',
  website: '#10B981', referral: '#8B5CF6', whatsapp: '#25D366', other: '#9CA3AF',
};

const TIMELINE_META = {
  call:               { icon: Phone,         color: 'bg-blue-100 text-blue-600 border-blue-200',   label: 'Call Log' },
  visit_started:      { icon: MapPin,        color: 'bg-indigo-100 text-indigo-600 border-indigo-200', label: 'Visit Started' },
  visit_completed:    { icon: CheckCircle2,  color: 'bg-emerald-100 text-emerald-600 border-emerald-200', label: 'Visit Completed' },
  lead_created:       { icon: UserCheck,     color: 'bg-amber-100 text-amber-600 border-amber-200',  label: 'New Lead' },
  followup_scheduled: { icon: Clock,         color: 'bg-orange-100 text-orange-600 border-orange-200',label: 'Follow-up Set' },
  followup_completed: { icon: CheckCircle2,  color: 'bg-teal-100 text-teal-600 border-teal-200',      label: 'Follow-up Done' },
  call_logged:        { icon: Phone,         color: 'bg-blue-100 text-blue-600 border-blue-200',      label: 'Call Log' },
  sale:               { icon: ShoppingBag,   color: 'bg-emerald-100 text-emerald-600 border-emerald-200',  label: 'Closed Sale' },
  note:               { icon: StickyNote,    color: 'bg-purple-100 text-purple-600 border-purple-200', label: 'Manager Note / Activity' },
};

const formatTimelineDetails = (event) => {
  const d = event?.details;
  if (d == null || d === '') return 'No details provided.';
  if (typeof d === 'string') return d;
  if (d.outcome || d.notes || d.staff || d.duration != null) {
    return [
      d.outcome ? `Outcome: ${String(d.outcome).replace(/_/g, ' ')}` : null,
      d.staff ? `Staff: ${d.staff}` : null,
      d.duration != null && d.duration !== '' ? `Duration: ${d.duration}s` : null,
      d.notes || d.note || d.message || d.details || null,
    ].filter(Boolean).join('\n');
  }
  return d.note || d.message || d.details || JSON.stringify(d);
};

// ── Sub-Components ────────────────────────────────────────────────────────────

const TimelineEvent = ({ event }) => {
  const meta = TIMELINE_META[event.type] || TIMELINE_META.note;
  const isManagerNote = typeof event.details === 'string' && event.details.includes('Manager Note');

  return (
    <div className="relative pl-8 pb-6 last:pb-0 group">
      <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-gray-100 group-last:hidden" />
      <div className={`absolute left-0 top-0 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center z-10 ${meta.color} shadow-xs`}>
        <meta.icon size={14} />
      </div>
      <div className={`rounded-2xl p-4 transition-all hover:shadow-xs ${
        isManagerNote 
          ? 'bg-amber-50/80 border border-amber-200/80' 
          : 'bg-gray-50/70 border border-gray-100 hover:bg-white'
      }`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-900">{meta.label}</span>
            {isManagerNote && (
              <Badge className="bg-amber-200 text-amber-900 text-[9px] font-extrabold px-1.5 py-0 border-0">
                👑 MANAGER NOTE
              </Badge>
            )}
          </div>
          <span className="text-[10px] font-semibold text-gray-400">
            {event.date ? formatDistanceToNow(new Date(event.date), { addSuffix: true }) : '—'}
          </span>
        </div>
        <div className="text-xs text-gray-800 font-medium leading-relaxed whitespace-pre-wrap">
          {formatTimelineDetails(event)}
        </div>
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-gray-200/50 flex flex-wrap gap-2">
            {Object.entries(event.metadata).map(([k, v]) => (
              <span key={k} className="text-[10px] font-medium bg-white text-gray-600 px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LeadDetail = ({ lead, onReassign }) => {
  const [isOpen, setIsOpen] = useState(true);
  const meta = STAGE_META[lead.stage] || STAGE_META.new;
  
  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden mb-4 last:mb-0 transition-all hover:shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs"
               style={{ background: SOURCE_COLORS[lead.source] || '#9CA3AF' }}>
            {lead.source?.[0]?.toUpperCase() || 'L'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">{lead.source_display || lead.source} Lead #{lead.id}</span>
              {lead.is_hot && <Flame size={14} className="text-red-500" />}
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              {lead.branch_name || 'Main Branch'} • Created {lead.created_at ? format(new Date(lead.created_at), 'MMM dd, yyyy') : 'Recently'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="font-bold text-[10px] uppercase tracking-wider border-0 px-2.5 py-1" style={{ backgroundColor: meta.bg, color: meta.color }}>
            {meta.label}
          </Badge>
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown size={16} className="text-gray-400" />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 bg-gray-50/40 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Product Interest</p>
              <p className="text-xs font-bold text-gray-800">{lead.product_interest || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Approx Weight</p>
              <p className="text-xs font-extrabold text-[#C9972A]">
                {lead.approx_grams ? formatGrams(lead.approx_grams) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Occasion</p>
              <p className="text-xs font-semibold text-gray-800">{lead.occasion || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Assigned Staff</p>
              <p className="text-xs font-bold text-indigo-700">{lead.assigned_to_name || 'Unassigned'}</p>
            </div>
          </div>

          {lead.notes && (
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                <FileText size={12} className="text-gray-500" /> Initial Lead Note
              </p>
              <p className="text-xs text-gray-700 leading-relaxed font-medium">{lead.notes}</p>
            </div>
          )}

          {onReassign && (
            <div className="flex justify-end pt-1">
              <Button 
                size="sm"
                variant="outline" 
                className="text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={() => onReassign(lead)}
              >
                👤 Reassign Staff Member
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Profile Attributes Tab (Editable) ────────────────────────────────────────

const ATTR_FIELDS = [
  { label: 'House / Building', key: 'house_name', icon: Home, placeholder: 'e.g. Sunshine Villa' },
  { label: "Father's Name",    key: 'father_name', icon: User, placeholder: 'e.g. Rajan K.' },
  { label: 'Village / Town',   key: 'village',     icon: Globe, placeholder: 'e.g. Sullia' },
  { label: 'District',         key: 'district',    icon: MapPin, placeholder: 'e.g. Dakshina Kannada' },
  { label: 'Panchayath',       key: 'panchayath',  icon: Map, placeholder: 'e.g. Sullia Gram Panchayath' },
  { label: 'Alternate Phone',  key: 'mobile2',     icon: Phone, placeholder: 'e.g. 9876543210' },
];

const ProfileAttributesTab = ({ customer, customerId }) => {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState(null);
  const [draftValue, setDraftValue] = useState('');

  const patchMutation = useMutation({
    mutationFn: (data) => api.patch(`/leads/customers/${customerId}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      setEditingKey(null);
      toast.success('Profile attribute updated!');
    },
    onError: (err) => toast.error('Failed to save: ' + (err.response?.data?.detail || err.message)),
  });

  const startEdit = (field) => {
    setEditingKey(field.key);
    setDraftValue(customer[field.key] || '');
  };

  const cancelEdit = () => { setEditingKey(null); setDraftValue(''); };

  const saveEdit = () => {
    if (!editingKey) return;
    patchMutation.mutate({ [editingKey]: draftValue });
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Home size={18} className="text-[#C9972A]" /> Profile Attributes &amp; Demographics
        </h3>
        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
          Click ✏ to edit any attribute
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ATTR_FIELDS.map((field) => {
          const IconCmp = field.icon;
          const isEditing = editingKey === field.key;
          const currentVal = customer[field.key];

          return (
            <div
              key={field.key}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isEditing
                  ? 'border-[#C9972A]/50 bg-amber-50/30 shadow-md shadow-[#C9972A]/10'
                  : 'border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-xs hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-400 border border-gray-100 shadow-2xs shrink-0">
                  <IconCmp size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{field.label}</p>
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        placeholder={field.placeholder}
                        className="h-8 text-xs bg-white border-[#C9972A]/40"
                        autoFocus
                      />
                      <button onClick={saveEdit} disabled={patchMutation.isPending} className="p-1.5 bg-[#C9972A] text-white rounded-lg hover:bg-[#7A5500]">
                        <Save size={12} />
                      </button>
                      <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-600">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-gray-900 truncate mt-0.5">
                      {currentVal || <span className="text-gray-300 font-normal italic">Not specified</span>}
                    </p>
                  )}
                </div>
                {!isEditing && (
                  <button onClick={() => startEdit(field)} className="p-1.5 text-gray-400 hover:text-[#C9972A] transition-colors">
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main CustomerProfileDetail Component ──────────────────────────────────────

const CustomerProfileDetail = ({ customerId }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  // Quick Manager Feedback / Decision state
  const [managerNotes, setManagerNotes] = useState('');
  const [selectedLeadForReassign, setSelectedLeadForReassign] = useState(null);
  const [newStaffId, setNewStaffId] = useState('');
  const [callLogForm, setCallLogForm] = useState({
    leadId: '',
    outcome: 'interested',
    notes: '',
    duration_seconds: '',
    next_followup_date: '',
  });

  // Fetch Customer details
  const { data: customer, isLoading, isError } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.get(`/leads/customers/${customerId}/`).then(r => r.data),
    enabled: !!customerId,
  });

  // Fetch Staff users for reassignment
  const { data: staffData } = useQuery({
    queryKey: ['staff-list'],
    queryFn: () => api.get('/accounts/users/').then(r => r.data.results || r.data),
  });

  const activeLead = customer?.leads?.[customer?.leads?.length - 1] || null;
  const leadIdsKey = (customer?.leads || []).map((l) => l.id).join(',');

  const { data: profileCallLogs = [] } = useQuery({
    queryKey: ['customer-call-logs', customerId, leadIdsKey],
    queryFn: async () => {
      const ids = (customer?.leads || []).map((l) => l.id);
      const batches = await Promise.all(ids.map((id) =>
        api.get('/calls/call-logs/', { params: { lead: id, page_size: 100 } })
          .then((r) => r.data.results || [])
      ));
      return batches.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    enabled: !!customerId && !!leadIdsKey,
  });

  // Manager Decision Mutation
  const managerDecisionMutation = useMutation({
    mutationFn: ({ decision, extraPayload }) => {
      const targetLeadId = activeLead?.id || customer?.leads?.[0]?.id;
      if (!targetLeadId) throw new Error('No linked lead available to update.');
      return api.post(`/leads/leads/${targetLeadId}/manager-decision/`, {
        decision,
        notes: managerNotes,
        ...extraPayload
      });
    },
    onSuccess: (res) => {
      toast.success(res.data?.detail || 'Manager note saved successfully!');
      setManagerNotes('');
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to save decision.');
    }
  });

  // Temperature Update Mutation
  const tempMutation = useMutation({
    mutationFn: (newTemp) => api.patch(`/leads/customers/${customerId}/`, { temperature: newTemp }),
    onSuccess: () => {
      toast.success('Customer priority temperature updated!');
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    }
  });

  // Staff Reassignment Mutation
  const reassignMutation = useMutation({
    mutationFn: ({ leadId, staffId }) => api.post(`/leads/leads/${leadId}/assign/`, { staff_id: staffId }),
    onSuccess: (res) => {
      toast.success(res.data?.detail || 'Lead reassigned to staff!');
      setSelectedLeadForReassign(null);
      setNewStaffId('');
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Reassignment failed.')
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch(`/leads/customers/${customerId}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    },
    onError: (err) => toast.error("Update failed: " + (err.response?.data?.detail || err.message))
  });

  const logProfileCallMutation = useMutation({
    mutationFn: (payload) => api.post('/calls/call-logs/', payload),
    onSuccess: () => {
      toast.success('Call added to this lead. Earlier calls are still here.');
      setCallLogForm((prev) => ({ ...prev, notes: '', duration_seconds: '', next_followup_date: '' }));
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-call-logs', customerId] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Could not save call'),
  });

  const handleUpdate = (e) => {
    e.preventDefault();
    updateMutation.mutate(editData);
  };

  if (isLoading) return (
    <div className="p-8 max-w-[1400px] mx-auto flex gap-6 animate-pulse">
      <div className="w-[350px] shrink-0 space-y-4">
        <div className="h-80 bg-gray-100 rounded-3xl" />
        <div className="h-40 bg-gray-100 rounded-3xl" />
      </div>
      <div className="flex-1 space-y-4">
        <div className="h-12 bg-gray-100 rounded-xl w-1/2" />
        <div className="h-96 bg-gray-100 rounded-3xl" />
      </div>
    </div>
  );

  if (isError || !customer) return (
    <div className="p-20 text-center flex flex-col items-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6 shadow-xs">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Unavailable</h2>
      <p className="text-gray-500">The customer profile could not be loaded.</p>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview & Notes', icon: Activity },
    { id: 'calls', label: `Calls (${profileCallLogs.length || customer.total_calls || 0})`, icon: Phone },
    { id: 'timeline', label: 'Activity Timeline', icon: Clock },
    { id: 'leads', label: `Lead Records (${customer.leads?.length || 0})`, icon: Briefcase },
    { id: 'details', label: 'Demographics & Address', icon: FileText },
  ];

  // Filtered timeline
  const filteredTimeline = (customer.timeline || []).filter(ev => {
    if (timelineFilter === 'notes') return ev.type === 'note' || String(ev.details).includes('Manager Note');
    if (timelineFilter === 'visits') return ev.type?.includes('visit');
    if (timelineFilter === 'calls') return ev.type === 'call' || ev.type?.includes('followup');
    if (timelineFilter === 'sales') return ev.type === 'sale';
    return true;
  });

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-8 pb-20">
      
      {/* ── LEFT SIDEBAR: Persistent Identity & Quick Controls ── */}
      <div className="w-full lg:w-[350px] shrink-0 space-y-6">
        
        {/* Hero Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#C9972A]/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#C9972A] to-amber-300 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-[#C9972A]/30 border-4 border-white">
                {(customer.name || '?')[0].toUpperCase()}
              </div>
              <div className="absolute bottom-0 right-0 w-7 h-7 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white shadow-xs" title="Active Lead Profile">
                <CheckCircle2 size={14} />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
              {customer.name}
            </h1>

            {/* Priority & Stage Badges */}
            <div className="flex items-center gap-2 mt-1 mb-4 flex-wrap justify-center">
              <select
                value={customer.temperature || 'warm'}
                onChange={(e) => tempMutation.mutate(e.target.value)}
                className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border-0 cursor-pointer outline-none shadow-2xs ${
                  customer.temperature === 'hot' 
                    ? 'bg-rose-100 text-rose-700' 
                    : customer.temperature === 'warm'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                <option value="hot">🔥 HOT PRIORITY</option>
                <option value="warm">☀️ WARM PRIORITY</option>
                <option value="cold">❄️ COLD PRIORITY</option>
              </select>

              {activeLead?.stage && (
                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase px-2.5 py-1 border-0">
                  {activeLead.stage}
                </Badge>
              )}
            </div>
            
            <p className="text-xs font-semibold text-gray-400 mb-5">
              Customer since {customer.created_at ? format(new Date(customer.created_at), 'MMMM yyyy') : 'Recently'}
            </p>
            
            <div className="flex gap-2 w-full">
              <Button onClick={() => { setEditData(customer); setIsEditing(true); }} className="flex-1 bg-gray-900 hover:bg-black text-white rounded-xl shadow-sm h-10 font-bold text-xs">
                <Edit2 size={13} className="mr-1.5" /> Edit Profile
              </Button>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-gray-100 mt-6">
            <div className="flex items-center justify-between text-gray-700 text-xs">
              <span className="flex items-center gap-2 text-gray-500 font-semibold">
                <Phone size={14} className="text-gray-400" /> Mobile Phone
              </span>
              <a href={`tel:${customer.phone}`} className="font-bold text-indigo-600 hover:underline">{customer.phone}</a>
            </div>
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="block">
                <Button type="button" className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                  <Phone size={14} className="mr-1.5" /> Call this lead
                </Button>
              </a>
            )}

            {customer.email && (
              <div className="flex items-center justify-between text-gray-700 text-xs">
                <span className="flex items-center gap-2 text-gray-500 font-semibold">
                  <Mail size={14} className="text-gray-400" /> Email
                </span>
                <span className="font-medium text-gray-800 truncate max-w-[180px]">{customer.email}</span>
              </div>
            )}

            {customer.location && (
              <div className="flex items-center justify-between text-gray-700 text-xs">
                <span className="flex items-center gap-2 text-gray-500 font-semibold">
                  <MapPin size={14} className="text-gray-400" /> Location
                </span>
                <span className="font-semibold text-gray-800">{customer.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Value Metrics */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Gold &amp; Value Metrics</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Total Gold Purchased</p>
              <p className="text-2xl font-black text-[#C9972A] truncate">{formatGrams(customer.total_spent)} g</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Purchases</p>
                <p className="text-lg font-bold text-gray-900">{customer.total_purchases || 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Visits</p>
                <p className="text-lg font-bold text-gray-900">{customer.total_visits || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT MAIN CONTENT: Tabs & Operational Control ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Quick Contact & Action Buttons */}
        <div className="mb-6">
          <CustomerQuickActions customer={customer} />
        </div>

        {/* Manager Decision & Feedback Action Card (FEATURED ON TOP FOR ADMIN/MANAGER) */}
        {activeLead && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-6 mb-6 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                👑 Manager Feedback &amp; Next Action (Lead #{activeLead.id})
              </h3>
              <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px]">
                Assigned: {activeLead.assigned_to_name || 'Unassigned'}
              </Badge>
            </div>

            <textarea
              className="w-full p-3 text-xs rounded-2xl border border-amber-200 bg-white min-h-[70px] focus:ring-2 focus:ring-[#C9972A]/30 focus:outline-none"
              placeholder="Type manager notes, review feedback, or staff instructions to save to lead history..."
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                className="bg-[#0F6E56] hover:bg-[#094d3c] text-white font-bold text-xs shadow-2xs"
                onClick={() => managerDecisionMutation.mutate({ decision: 'save_note' })}
                disabled={managerDecisionMutation.isPending || !managerNotes.trim()}
              >
                {managerDecisionMutation.isPending && <Loader2 className="animate-spin mr-1.5" size={14} />}
                💾 Save Note to Profile
              </Button>

              {activeLead.stage !== 'converted' && (
                <Button 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                  onClick={() => managerDecisionMutation.mutate({ decision: 'convert' })}
                  disabled={managerDecisionMutation.isPending}
                >
                  ✓ Mark Converted
                </Button>
              )}

              {activeLead.stage !== 'lost' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs"
                  onClick={() => managerDecisionMutation.mutate({ decision: 'mark_lost', extraPayload: { lost_reason: managerNotes } })}
                  disabled={managerDecisionMutation.isPending}
                >
                  ✕ Mark Lost
                </Button>
              )}

              <Button 
                size="sm" 
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100/50 font-semibold text-xs"
                onClick={() => managerDecisionMutation.mutate({ decision: 'schedule_visit' })}
                disabled={managerDecisionMutation.isPending}
              >
                📅 Schedule Field Visit
              </Button>

              <Button 
                size="sm" 
                variant="outline"
                className="border-amber-300 text-amber-900 hover:bg-amber-100/50 font-semibold text-xs"
                onClick={() => managerDecisionMutation.mutate({ decision: 'schedule_followup' })}
                disabled={managerDecisionMutation.isPending}
              >
                📞 Schedule Call
              </Button>
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 bg-gray-50/70 p-1.5 rounded-2xl border border-gray-200/80">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id 
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              <tab.icon size={15} className={activeTab === tab.id ? 'text-[#C9972A]' : 'text-gray-400'} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 min-h-[450px]">
          
          {/* TAB: OVERVIEW & NOTES */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Executive Notes */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <StickyNote size={18} className="text-[#C9972A]" /> Executive Notes &amp; Manager Review History
                </h3>
                {customer.notes ? (
                  <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-5 shadow-2xs">
                    <p className="text-xs text-amber-950 leading-relaxed font-medium whitespace-pre-wrap">
                      {customer.notes}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center border border-dashed border-gray-200">
                    <p className="text-xs text-gray-500 font-medium">No internal manager notes saved yet. Use the box above to add notes.</p>
                  </div>
                )}
              </div>

              {/* Engagement Stats */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <Activity size={18} className="text-[#C9972A]" /> Engagement Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Calls', value: customer.total_calls || 0, icon: Phone, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Field Visits', value: customer.total_visits || 0, icon: MapPin, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                    { label: 'WhatsApp', value: customer.total_whatsapp || 0, icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-50' },
                    { label: 'Total Leads', value: customer.lead_count || customer.leads?.length || 0, icon: UserCheck, color: 'text-amber-500', bg: 'bg-amber-50' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-gray-50/60 rounded-2xl p-4 border border-gray-100">
                      <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                        <stat.icon size={14} />
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: CALLS */}
          {activeTab === 'calls' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-1">
                  <Phone size={18} className="text-[#C9972A]" /> Call this lead
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Dial, then add notes. Each save creates a new call record — older notes stay on this profile.
                </p>
                <form
                  className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const leadId = callLogForm.leadId || activeLead?.id || customer.leads?.[0]?.id;
                    if (!leadId) {
                      toast.error('This customer has no lead to attach a call to.');
                      return;
                    }
                    logProfileCallMutation.mutate({
                      lead: Number(leadId),
                      outcome: callLogForm.outcome,
                      notes: callLogForm.notes,
                      duration_seconds: callLogForm.duration_seconds ? Number(callLogForm.duration_seconds) : null,
                      next_followup_date: callLogForm.next_followup_date || null,
                    });
                  }}
                >
                  {customer.leads?.length > 1 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Lead record</Label>
                      <select
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs"
                        value={callLogForm.leadId || String(activeLead?.id || '')}
                        onChange={(e) => setCallLogForm({ ...callLogForm, leadId: e.target.value })}
                      >
                        {customer.leads.map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            Lead #{lead.id} · {lead.stage || lead.stage_display || 'open'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Outcome</Label>
                      <select
                        className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs"
                        value={callLogForm.outcome}
                        onChange={(e) => setCallLogForm({ ...callLogForm, outcome: e.target.value })}
                      >
                        <option value="interested">Interested</option>
                        <option value="call_later">Call later</option>
                        <option value="no_answer">No answer</option>
                        <option value="not_interested">Not interested</option>
                        <option value="converted">Converted</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Duration (sec)</Label>
                      <Input
                        type="number"
                        className="h-10 rounded-xl text-xs"
                        value={callLogForm.duration_seconds}
                        onChange={(e) => setCallLogForm({ ...callLogForm, duration_seconds: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Next call date</Label>
                    <Input
                      type="date"
                      className="h-10 rounded-xl text-xs"
                      value={callLogForm.next_followup_date}
                      onChange={(e) => setCallLogForm({ ...callLogForm, next_followup_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <textarea
                      className="w-full min-h-[90px] rounded-xl border border-gray-200 bg-white p-3 text-xs"
                      value={callLogForm.notes}
                      onChange={(e) => setCallLogForm({ ...callLogForm, notes: e.target.value })}
                      placeholder="What they said, interest, callback time…"
                    />
                  </div>
                  <Button type="submit" className="w-full h-10 text-xs font-bold" disabled={logProfileCallMutation.isPending}>
                    {logProfileCallMutation.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                    Save call (keep history)
                  </Button>
                </form>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Call history</h3>
                {profileCallLogs.length === 0 ? (
                  <div className="py-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500">No call logs yet on this profile.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profileCallLogs.map((call) => (
                      <div key={call.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold capitalize text-gray-900">
                            {(call.outcome || '').replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {call.created_at ? format(new Date(call.created_at), 'dd MMM yyyy, h:mm a') : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">{call.staff_name || 'Staff'} · {call.duration_seconds ? `${call.duration_seconds}s` : 'no duration'}</p>
                        {call.notes && <p className="text-xs text-gray-800 mt-2 whitespace-pre-wrap">{call.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Clock size={18} className="text-[#C9972A]" /> Activity &amp; Interaction Feed
                </h3>

                {/* Timeline Filters */}
                <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200/60 flex-wrap">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'notes', label: 'Notes' },
                    { id: 'visits', label: 'Visits' },
                    { id: 'calls', label: 'Calls' },
                    { id: 'sales', label: 'Sales' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setTimelineFilter(f.id)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        timelineFilter === f.id
                          ? 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-w-2xl">
                {filteredTimeline.length > 0 ? (
                  [...filteredTimeline].reverse().map((ev, i) => (
                    <TimelineEvent key={i} event={ev} />
                  ))
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                    <Clock className="mx-auto text-gray-300 mb-3" size={36} />
                    <p className="text-gray-500 font-semibold text-sm">No Activity Found</p>
                    <p className="text-xs text-gray-400 mt-1">Interactions will appear here automatically.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: LEADS */}
          {activeTab === 'leads' && (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
                <Briefcase size={18} className="text-[#C9972A]" /> Associated Marketing Lead Records
              </h3>
              <div className="max-w-3xl">
                {customer.leads && customer.leads.length > 0 ? (
                  customer.leads.map(lead => (
                    <LeadDetail 
                      key={lead.id} 
                      lead={lead} 
                      onReassign={(l) => { setSelectedLeadForReassign(l); setNewStaffId(''); }} 
                    />
                  ))
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                    <UserCheck className="mx-auto text-gray-300 mb-3" size={36} />
                    <p className="text-gray-500 font-semibold text-sm">No Lead History</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: DETAILS */}
          {activeTab === 'details' && (
            <ProfileAttributesTab customer={customer} customerId={customerId} />
          )}

        </div>
      </div>

      {/* ── Reassign Staff Modal ──────────────────────────────────────────────── */}
      <Dialog open={!!selectedLeadForReassign} onOpenChange={(open) => !open && setSelectedLeadForReassign(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-950 text-sm font-bold">
              👤 Reassign Lead #{selectedLeadForReassign?.id} Staff Member
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Select Field Staff Member</label>
              <select
                className="w-full p-2.5 text-xs rounded-xl border border-gray-200 bg-background font-medium"
                value={newStaffId}
                onChange={(e) => setNewStaffId(e.target.value)}
              >
                <option value="">Choose staff member...</option>
                {Array.isArray(staffData) && staffData.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.role}) - {s.branch_name || 'Main Branch'}
                  </option>
                ))}
              </select>
            </div>

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10"
              onClick={() => reassignMutation.mutate({ leadId: selectedLeadForReassign.id, staffId: newStaffId })}
              disabled={reassignMutation.isPending || !newStaffId}
            >
              {reassignMutation.isPending ? <Loader2 className="animate-spin mr-1.5" size={14} /> : null}
              Confirm Staff Reassignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Profile Modal ────────────────────────────────────────────────── */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-white p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit Customer Profile</h2>
              <p className="text-sm text-gray-500 mt-1">Update core identity and contact details.</p>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase">Full Name</Label>
                  <Input value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} className="rounded-xl h-10 bg-gray-50 border-gray-200 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase">Priority Temperature</Label>
                  <select 
                    value={editData.temperature || 'cold'} 
                    onChange={e => setEditData({...editData, temperature: e.target.value})}
                    className="w-full h-10 rounded-xl bg-gray-50 border border-gray-200 px-3 text-xs font-semibold"
                  >
                    <option value="hot">🔥 Hot Priority</option>
                    <option value="warm">☀️ Warm Priority</option>
                    <option value="cold">❄️ Cold Priority</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase">Phone Number</Label>
                  <Input value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} className="rounded-xl h-10 bg-gray-50 border-gray-200 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-600 uppercase">Email Address</Label>
                  <Input value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} className="rounded-xl h-10 bg-gray-50 border-gray-200 text-xs" />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="flex-1 rounded-xl h-10 text-xs font-semibold">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1 rounded-xl h-10 bg-gray-900 hover:bg-black text-white text-xs font-bold">
                  {updateMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerProfileDetail;
