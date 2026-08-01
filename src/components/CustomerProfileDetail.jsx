import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import CustomerQuickActions from './CustomerQuickActions';
import {
  User, Phone, MapPin, Calendar, Clock, Mail, Activity, UserCheck,
  ShoppingBag, TrendingUp, MessageSquare, Star, Tag, ChevronDown,
  ChevronUp, Flame, CheckCircle2, AlertCircle, Gift, Edit2,
  Home, Map, Globe, StickyNote, Briefcase, FileText, Save, X, Plus, Loader2
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
  call:              { icon: Phone,         color: 'bg-blue-100 text-blue-600',   label: 'Call Log' },
  visit_started:     { icon: MapPin,        color: 'bg-indigo-100 text-indigo-600', label: 'Visit Started' },
  visit_completed:   { icon: CheckCircle2,  color: 'bg-green-100 text-green-600', label: 'Visit Completed' },
  lead_created:      { icon: UserCheck,     color: 'bg-amber-100 text-amber-600',  label: 'New Lead' },
  followup_scheduled:{ icon: Clock,         color: 'bg-orange-100 text-orange-600',label: 'Follow-up Set' },
  sale:              { icon: ShoppingBag,   color: 'bg-emerald-100 text-emerald-600',  label: 'Closed Sale' },
  note:              { icon: StickyNote,    color: 'bg-purple-100 text-purple-600', label: 'Internal Note' },
};

// ── Sub-Components ────────────────────────────────────────────────────────────

const TimelineEvent = ({ event }) => {
  const meta = TIMELINE_META[event.type] || TIMELINE_META.note;
  return (
    <div className="relative pl-8 pb-8 last:pb-0 group">
      <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-gray-100 group-last:hidden" />
      <div className={`absolute left-0 top-0 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center z-10 ${meta.color}`}>
        <meta.icon size={14} />
      </div>
      <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 transition-all hover:bg-white hover:shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-900">{meta.label}</span>
          <span className="text-[10px] font-semibold text-gray-400">
            {event.date ? formatDistanceToNow(new Date(event.date), { addSuffix: true }) : '—'}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          {typeof event.details === 'string' 
            ? event.details 
            : (event.details?.note || event.details?.message || JSON.stringify(event.details || "No details provided."))}
        </div>
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
            {Object.entries(event.metadata).map(([k, v]) => (
              <span key={k} className="text-[10px] font-medium bg-white text-gray-500 px-2 py-1 rounded-md border border-gray-100 shadow-sm">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LeadDetail = ({ lead }) => {
  const [isOpen, setIsOpen] = useState(false);
  const meta = STAGE_META[lead.stage] || STAGE_META.new;
  
  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-3 last:mb-0 transition-all hover:border-gray-200 hover:shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
               style={{ background: SOURCE_COLORS[lead.source] || '#9CA3AF' }}>
            {lead.source?.[0]?.toUpperCase() || 'L'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">{lead.source_display || lead.source}</span>
              {lead.is_hot && <Flame size={14} className="text-red-500" />}
            </div>
            <p className="text-[11px] text-gray-400 font-medium">
              {lead.branch_name} • {format(new Date(lead.created_at), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="font-bold text-[10px] uppercase tracking-wider border-0" style={{ backgroundColor: meta.bg, color: meta.color }}>
            {meta.label}
          </Badge>
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown size={16} className="text-gray-400" />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-50 bg-gray-50/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Interest</p>
              <p className="text-sm font-semibold text-gray-800">{lead.product_interest || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Approx. Weight</p>
              <p className="text-sm font-bold text-gray-900">
                {lead.approx_grams ? formatGrams(lead.approx_grams) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Occasion</p>
              <p className="text-sm font-semibold text-gray-800">{lead.occasion || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Assigned</p>
              <p className="text-sm font-semibold text-gray-800">{lead.assigned_to_name || 'Unassigned'}</p>
            </div>
          </div>
          {lead.notes && (
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Lead Notes
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{lead.notes}</p>
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
      queryClient.invalidateQueries(['customer', customerId]);
      setEditingKey(null);
      toast.success('Profile updated!');
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
          <Home size={18} className="text-[#C9972A]" /> Profile Attributes &amp; Legacy Data
        </h3>
        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
          Click ✏ to edit any field
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
                  : 'border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-sm hover:border-gray-200'
              }`}
            >
              {/* Display row */}
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-400 border border-gray-100 shadow-sm shrink-0">
                  <IconCmp size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{field.label}</p>
                  {!isEditing ? (
                    <p className={`text-sm font-semibold truncate ${currentVal ? 'text-gray-900' : 'text-gray-300 italic'}`}>
                      {currentVal || 'Not set'}
                    </p>
                  ) : (
                    <input
                      autoFocus
                      type={field.key === 'mobile2' ? 'tel' : 'text'}
                      value={draftValue}
                      onChange={e => setDraftValue(e.target.value)}
                      placeholder={field.placeholder}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                      className="w-full text-sm font-semibold text-gray-900 bg-transparent border-b border-[#C9972A]/60 focus:outline-none focus:border-[#C9972A] py-0.5"
                    />
                  )}
                </div>

                {/* Action buttons */}
                {!isEditing ? (
                  <button
                    onClick={() => startEdit(field)}
                    title="Edit"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-[#C9972A] hover:bg-amber-50 transition-all shrink-0"
                  >
                    <Edit2 size={13} />
                  </button>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={saveEdit}
                      disabled={patchMutation.isPending}
                      title="Save"
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#C9972A] text-white hover:bg-amber-700 transition-all disabled:opacity-50"
                    >
                      <Save size={13} />
                    </button>
                    <button
                      onClick={cancelEdit}
                      title="Cancel"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk edit section for convenience */}
      <BulkAddressEdit customer={customer} customerId={customerId} />
    </div>
  );
};

const BulkAddressEdit = ({ customer, customerId }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    house_name: '', father_name: '', village: '',
    district: '', panchayath: '', mobile2: ''
  });

  const patchMutation = useMutation({
    mutationFn: (data) => api.patch(`/leads/customers/${customerId}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer', customerId]);
      setIsOpen(false);
      toast.success('Address details saved!');
    },
    onError: (err) => toast.error('Save failed: ' + (err.response?.data?.detail || err.message)),
  });

  const openBulk = () => {
    setForm({
      house_name: customer.house_name || '',
      father_name: customer.father_name || '',
      village: customer.village || '',
      district: customer.district || '',
      panchayath: customer.panchayath || '',
      mobile2: customer.mobile2 || '',
    });
    setIsOpen(true);
  };

  return (
    <>
      <div className="mt-6 flex justify-center">
        <button
          onClick={openBulk}
          className="flex items-center gap-2 text-xs font-bold text-[#C9972A] hover:text-amber-700 transition-colors py-2 px-4 rounded-xl border border-[#C9972A]/30 hover:border-[#C9972A]/60 hover:bg-amber-50/50"
        >
          <Edit2 size={12} /> Edit All Address Fields at Once
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-white p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Home size={18} className="text-[#C9972A]" /> Edit Address &amp; Legacy Data
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={e => { e.preventDefault(); patchMutation.mutate(form); }}
              className="space-y-4 mt-5"
            >
              {ATTR_FIELDS.map(f => {
                const IconCmp = f.icon;
                return (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <IconCmp size={11} /> {f.label}
                    </Label>
                    <Input
                      type={f.key === 'mobile2' ? 'tel' : 'text'}
                      value={form[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="rounded-xl h-10 bg-gray-50 border-gray-200 focus:border-[#C9972A]/50"
                    />
                  </div>
                );
              })}
              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="flex-1 rounded-xl h-11">
                  Cancel
                </Button>
                <Button type="submit" disabled={patchMutation.isPending} className="flex-1 rounded-xl h-11 bg-gray-900 hover:bg-black text-white">
                  {patchMutation.isPending ? 'Saving...' : 'Save All Fields'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const CustomerProfileDetail = ({ customerId }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  // Add Note state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');

  const { data: customer, isLoading, isError } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.get(`/leads/customers/${customerId}/`).then(r => r.data),
    enabled: !!customerId,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch(`/leads/customers/${customerId}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['customer', customerId]);
      setIsEditing(false);
    },
    onError: (err) => alert("Error: " + JSON.stringify(err.response?.data))
  });

  const handleUpdate = (e) => {
    e.preventDefault();
    updateMutation.mutate(editData);
  };

  // Add Note mutation — posts to call-logs with outcome='note'
  const addNoteMutation = useMutation({
    mutationFn: ({ leadId, content }) =>
      api.post('/calls/call-logs/', {
        lead: leadId,
        outcome: 'note',
        duration_seconds: 0,
        notes: content,
      }),
    onSuccess: () => {
      toast.success('Note added to lead history!');
      setNoteDialogOpen(false);
      setNoteContent('');
      queryClient.invalidateQueries(['customer', customerId]);
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add note.'),
  });

  const handleAddNote = (leadId) => {
    if (!noteContent.trim()) { toast.error('Please write a note.'); return; }
    addNoteMutation.mutate({ leadId, content: noteContent.trim() });
  };

  if (isLoading) return (
    <div className="p-8 max-w-7xl mx-auto flex gap-6 animate-pulse">
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
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Unavailable</h2>
      <p className="text-gray-500">The customer profile could not be loaded.</p>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'leads', label: 'Lead History', icon: Briefcase },
    { id: 'details', label: 'Details & Address', icon: FileText },
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-8 pb-20">
      
      {/* ── LEFT SIDEBAR: Persistent Identity ── */}
      <div className="w-full lg:w-[350px] shrink-0 space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#C9972A] to-amber-300 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-[#C9972A]/30 border-4 border-white">
                {(customer.name || '?')[0].toUpperCase()}
              </div>
              <div className="absolute bottom-0 right-0 w-7 h-7 bg-green-500 border-2 border-white rounded-full flex items-center justify-center text-white shadow-sm">
                <CheckCircle2 size={14} />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
              {customer.name}
              {customer.temperature && customer.temperature !== 'cold' && (
                <Badge className={`text-[9px] uppercase px-1.5 py-0 border-0 ${
                  customer.temperature === 'hot' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {customer.temperature === 'hot' ? <Flame size={10} className="mr-1 inline" /> : null}
                  {customer.temperature}
                </Badge>
              )}
            </h1>
            <p className="text-sm font-medium text-gray-500 mb-4">
              Customer since {customer.created_at ? format(new Date(customer.created_at), 'MMMM yyyy') : '—'}
            </p>
            
            <div className="flex gap-2 w-full mb-6">
              <Button onClick={() => { setEditData(customer); setIsEditing(true); }} className="flex-1 bg-gray-900 hover:bg-black text-white rounded-xl shadow-sm h-10 font-semibold text-xs">
                Edit Profile
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                <Phone size={14} />
              </div>
              <span className="text-sm font-medium">{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <Mail size={14} />
                </div>
                <span className="text-sm font-medium">{customer.email}</span>
              </div>
            )}
            {customer.location && (
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <MapPin size={14} />
                </div>
                <span className="text-sm font-medium">{customer.location}</span>
              </div>
            )}
            {customer.age && (
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <User size={14} />
                </div>
                <span className="text-sm font-medium">{customer.age} Years Old</span>
              </div>
            )}
          </div>
        </div>

        {/* Value Metrics */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Customer Value</h3>
          <div className="space-y-5">
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
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Avg Vol/Ticket</p>
                <p className="text-lg font-bold text-gray-900">{formatGrams(customer.avg_ticket_size, 1)} g</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tags / Segments */}
        {customer.preferred_segments_names?.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Interests & Tags</h3>
            <div className="flex flex-wrap gap-2">
              {customer.preferred_segments_names.map((seg, i) => (
                <Badge key={i} className="bg-gray-50 text-gray-600 border border-gray-200 font-semibold px-3 py-1 shadow-sm">
                  {seg}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT MAIN CONTENT: Tabs & Context ── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Quick Actions Bar (Floating inside main) */}
        <div className="mb-8 relative z-40">
          <CustomerQuickActions customer={customer} />
        </div>

        {/* Tabs Navigation */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 bg-gray-50/50 p-1.5 rounded-2xl border border-gray-100">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id 
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-[#C9972A]' : 'text-gray-400'} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 min-h-[500px]">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Executive Summary */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <StickyNote size={18} className="text-[#C9972A]" /> Executive Summary
                </h3>
                {customer.notes ? (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6">
                    <p className="text-sm text-amber-900 leading-relaxed font-medium whitespace-pre-wrap">
                      {customer.notes}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">No internal notes added yet.</p>
                  </div>
                )}
              </div>

              {/* Engagement Stats */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <Activity size={18} className="text-[#C9972A]" /> Engagement Overview
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Calls', value: customer.total_calls || 0, icon: Phone, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Field Visits', value: customer.total_visits || 0, icon: MapPin, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                    { label: 'WhatsApp', value: customer.total_whatsapp || 0, icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-50' },
                    { label: 'Total Leads', value: customer.lead_count || 0, icon: UserCheck, color: 'text-amber-500', bg: 'bg-amber-50' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                        <stat.icon size={14} />
                      </div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{stat.label}</p>
                      <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Occasions */}
              {customer.occasions && customer.occasions.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <Gift size={18} className="text-[#C9972A]" /> Upcoming Milestones
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customer.occasions.map((occ, i) => (
                      <div key={i} className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{occ.type}</p>
                          <p className="text-sm font-semibold text-gray-900">{occ.date}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-500 shadow-sm">
                          <Gift size={16} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Clock size={18} className="text-[#C9972A]" /> Activity Timeline
                </h3>
                {/* Add Note Button — links to most recent lead */}
                {customer.leads && customer.leads.length > 0 && (
                  <button
                    onClick={() => setNoteDialogOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm shadow-purple-200"
                  >
                    <Plus size={14} /> Add Note
                  </button>
                )}
              </div>

              <div className="max-w-2xl">
                {customer.timeline && customer.timeline.length > 0 ? (
                  [...customer.timeline].reverse().map((ev, i) => (
                    <TimelineEvent key={i} event={ev} />
                  ))
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                    <Clock className="mx-auto text-gray-300 mb-4" size={40} />
                    <p className="text-gray-500 font-semibold">No Activity Logged</p>
                    <p className="text-xs text-gray-400 mt-1">Interactions will appear here automatically.</p>
                  </div>
                )}
              </div>

              {/* Add Note Dialog */}
              <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent className="max-w-lg rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
                  <div className="bg-white p-6">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <StickyNote size={20} className="text-purple-600" />
                        Add Note to Lead History
                      </DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-gray-500 mt-1 mb-5">
                      This note will be saved to <strong>{customer.name}</strong>'s activity timeline.
                    </p>

                    {/* Note Type */}
                    <div className="flex gap-2 mb-4">
                      {['general', 'follow_up', 'visit'].map(t => (
                        <button
                          key={t}
                          onClick={() => setNoteType(t)}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                            noteType === t
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          {t === 'general' ? 'General' : t === 'follow_up' ? 'Follow-up' : 'Visit Note'}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={noteContent}
                      onChange={e => setNoteContent(e.target.value)}
                      rows={5}
                      placeholder="Write your note here... e.g. Customer is interested in gold bangles, budget ~₹50K. Follow up after Diwali."
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 resize-none"
                    />

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => { setNoteDialogOpen(false); setNoteContent(''); }}
                        className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAddNote(customer.leads[customer.leads.length - 1]?.id)}
                        disabled={addNoteMutation.isPending || !noteContent.trim()}
                        className="flex-1 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {addNoteMutation.isPending
                          ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                          : <><StickyNote size={14} /> Save Note</>
                        }
                      </button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* TAB: LEADS */}
          {activeTab === 'leads' && (
            <div className="animate-in fade-in duration-300">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
                <Briefcase size={18} className="text-[#C9972A]" /> CRM Lead Records
              </h3>
              <div className="max-w-3xl">
                {customer.leads && customer.leads.length > 0 ? (
                  customer.leads.map(lead => <LeadDetail key={lead.id} lead={lead} />)
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                    <UserCheck className="mx-auto text-gray-300 mb-4" size={40} />
                    <p className="text-gray-500 font-semibold">No Lead History</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: DETAILS */}
          {activeTab === 'details' && (
            <ProfileAttributesTab customer={customer} customerId={customerId} />)
          }

        </div>
      </div>

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-white p-6 md:p-8">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900">Edit Customer Profile</h2>
              <p className="text-sm text-gray-500 mt-1">Update core identity and contact details.</p>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-600 uppercase">Full Name</Label>
                  <Input value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} className="rounded-xl h-11 bg-gray-50 border-gray-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-600 uppercase">Priority (Temperature)</Label>
                  <select 
                    value={editData.temperature || 'cold'} 
                    onChange={e => setEditData({...editData, temperature: e.target.value})}
                    className="w-full rounded-xl h-11 bg-gray-50 border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    <option value="hot">Hot (High Priority)</option>
                    <option value="warm">Warm (Medium)</option>
                    <option value="cold">Cold (Low/General)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-600 uppercase">Email</Label>
                  <Input value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} className="rounded-xl h-11 bg-gray-50 border-gray-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-600 uppercase">City / Location</Label>
                  <Input value={editData.location || ''} onChange={e => setEditData({...editData, location: e.target.value})} className="rounded-xl h-11 bg-gray-50 border-gray-200" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-600 uppercase">Age</Label>
                  <Input type="number" value={editData.age || ''} onChange={e => setEditData({...editData, age: e.target.value})} className="rounded-xl h-11 bg-gray-50 border-gray-200" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-600 uppercase">Executive Summary (Notes)</Label>
                <textarea 
                  value={editData.notes || ''} 
                  onChange={e => setEditData({...editData, notes: e.target.value})} 
                  className="w-full h-28 rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm focus:outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
                  placeholder="Master context about this client..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="flex-1 rounded-xl h-11 font-semibold text-gray-600">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1 rounded-xl h-11 bg-gray-900 hover:bg-black text-white font-semibold">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
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
