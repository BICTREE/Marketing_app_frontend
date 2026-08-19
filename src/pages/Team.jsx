import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/api/axios';
import { Users, Plus, Loader2, User as UserIcon, Shield, ChevronRight, ListTodo, Clock, AlertCircle, Filter, TrendingUp, BarChart3, Target, CheckCircle2, XCircle, Mail, RefreshCw, Send, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import useAuth from '@/hooks/useAuth';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const staffCreateSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Valid phone is required'),
  role: z.string().min(1, 'Role is required'),
  branch: z.number().min(1, 'Branch is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password2: z.string().min(8, 'Confirm Password must be at least 8 characters')
}).refine((data) => data.password === data.password2, {
  message: "Passwords don't match",
  path: ["password2"],
});

const profileUpdateSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Valid phone is required'),
  whatsapp_number: z.string().optional().nullable(),
  marital_status: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  join_date: z.string().optional().nullable(),
  employee_id: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const taskCreateSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().optional(),
  priority: z.string().default('medium'),
  due_date: z.string().optional().nullable(),
});

const PERMISSION_GROUPS = [
  { group: 'Leads', fields: ['can_view_leads', 'can_add_leads', 'can_edit_leads', 'can_assign_leads', 'can_delete_leads'] },
  { group: 'Staff', fields: ['can_view_staff', 'can_add_staff', 'can_edit_staff', 'can_delete_staff'] },
  { group: 'Attendance', fields: ['can_view_attendance', 'can_approve_attendance'] },
  { group: 'Calls & Sales', fields: ['can_view_calls', 'can_add_calls', 'can_view_sales', 'can_add_sales'] },
  { group: 'Reports & Campaigns', fields: ['can_view_reports', 'can_export_reports', 'can_view_campaigns', 'can_create_campaigns', 'can_view_field_visits'] }
];

const TeamPage = () => {
  const queryClient = useQueryClient();
  const { user, isOwner, isManager } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [terminationReason, setTerminationReason] = useState('');
  const [isTerminateOpen, setIsTerminateOpen] = useState(false);

  // Helper to ensure media URLs point to backend
  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
    const host = baseUrl.replace('/api/v1', '');
    return `${host}${url}`;
  };

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    })
  });

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fetch Team (server-side branch + search)
  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team', selectedBranch, debouncedSearch],
    queryFn: () => {
      const params = {};
      if (selectedBranch !== 'all') params.branch = selectedBranch;
      if (debouncedSearch) params.search = debouncedSearch;
      params.page_size = 500;
      return api.get('/accounts/users/', { params }).then(res => {
        const data = res.data.results || res.data;
        return Array.isArray(data) ? data : [];
      });
    }
  });

  // System Setting for Daily Staff Email Notifications
  const { data: emailSettingData, refetch: refetchEmailSetting } = useQuery({
    queryKey: ['systemSettingDailyEmails'],
    queryFn: async () => {
      const res = await api.get('/accounts/system-settings/toggle-daily-emails/');
      return res.data;
    },
    enabled: isOwner || isManager,
  });

  const [isTogglingEmail, setIsTogglingEmail] = useState(false);
  const [isTriggeringDigest, setIsTriggeringDigest] = useState(false);
  const [isPreviewEmailOpen, setIsPreviewEmailOpen] = useState(false);
  const [previewStaffId, setPreviewStaffId] = useState('');

  // Email Digest Template Preview query
  const { data: emailPreviewData, isLoading: isLoadingEmailPreview, refetch: refetchEmailPreview } = useQuery({
    queryKey: ['emailPreview', previewStaffId],
    queryFn: async () => {
      const param = previewStaffId ? `?user_id=${previewStaffId}` : '';
      const res = await api.get(`/accounts/preview-daily-email/${param}`);
      return res.data;
    },
    enabled: isPreviewEmailOpen && (isOwner || isManager),
  });

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

  // Toggle individual staff member email notifications
  const toggleStaffEmailMutation = useMutation({
    mutationFn: async ({ userId, enabled }) => {
      const res = await api.patch(`/accounts/users/${userId}/`, { email_notifications_enabled: enabled });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Email notifications for ${data.full_name} set to ${data.email_notifications_enabled ? 'ENABLED' : 'DISABLED'}.`);
      queryClient.invalidateQueries(['team']);
      queryClient.invalidateQueries(['admin-team']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to update email setting.');
    }
  });
  const { data: leadsData } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.get('/leads/leads/').then(res => res.data.results || res.data)
  });

  // Fetch Sales for performance metrics
  const { data: salesData } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.get('/sales/sales/').then(res => res.data.results || res.data)
  });

  const filteredTeam = teamData || [];

  const currentUser = React.useMemo(() => {
    if (!selectedUser) return null;
    return teamData?.find(m => m.id === selectedUser.id) || selectedUser;
  }, [selectedUser, teamData]);



  // Chart data
  const roleDistributionData = React.useMemo(() => {
    if (!filteredTeam || filteredTeam.length === 0) return [];
    
    const roleCounts = {};
    filteredTeam.forEach(member => {
      const role = member.display_role || member.role || 'unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
    
    return Object.entries(roleCounts).map(([role, count]) => ({
      name: role.charAt(0).toUpperCase() + role.slice(1),
      value: count
    }));
  }, [filteredTeam]);

  const staffPerformanceData = React.useMemo(() => {
    if (!filteredTeam || filteredTeam.length === 0) return [];
    
    return filteredTeam
      .filter(member => member.role !== 'owner')
      .map(member => ({
        name: member.full_name,
        leads: leadsData?.filter(l => l.assigned_to === member.id).length || 0,
        normalSales: salesData?.filter(s => s.staff === member.id && s.sale_type !== 'advance').length || 0,
        advanceBookings: salesData?.filter(s => s.staff === member.id && s.sale_type === 'advance').length || 0,
        totalSales: salesData?.filter(s => s.staff === member.id).length || 0
      }))
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10);
  }, [filteredTeam, leadsData, salesData]);

  const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#B03A2E', '#6B7280', '#EF4444'];

  // Fetch Permissions
  const { data: permissionsData, isLoading: loadingPermissions } = useQuery({
    queryKey: ['permissions', selectedUser?.id],
    queryFn: () => api.get(`/accounts/staff-permissions/?user=${selectedUser.id}`).then(res => res.data.results?.[0]),
    enabled: !!selectedUser && selectedUser.role !== 'owner' && isDetailsOpen
  });

  // Fetch Tasks for selected user
  const { data: userTasks, isLoading: loadingTasks } = useQuery({
    queryKey: ['user-tasks', selectedUser?.id],
    queryFn: () => api.get(`/tasks/tasks/?assigned_to=${selectedUser.id}`).then(res => res.data.results || res.data),
    enabled: !!selectedUser && isDetailsOpen
  });

  // Fetch Activity History (Leads)
  const { data: userActivities, isLoading: loadingActivities } = useQuery({
    queryKey: ['user-activities', selectedUser?.id],
    queryFn: () => api.get(`/leads/activities/?actor=${selectedUser.id}`).then(res => res.data.results || res.data),
    enabled: !!selectedUser && isDetailsOpen
  });

  // Fetch Call Logs for selected user
  const { data: userCallLogs } = useQuery({
    queryKey: ['user-calls', selectedUser?.id],
    queryFn: () => api.get(`/calls/call-logs/?staff=${selectedUser.id}`).then(res => res.data.results || res.data),
    enabled: !!selectedUser && isDetailsOpen
  });

  // Fetch Sales for selected user
  const { data: userSales } = useQuery({
    queryKey: ['user-sales', selectedUser?.id],
    queryFn: () => api.get(`/sales/sales/?staff=${selectedUser.id}`).then(res => res.data.results || res.data),
    enabled: !!selectedUser && isDetailsOpen
  });

  // Combined and sorted activity feed
  const unifiedActivities = React.useMemo(() => {
    const activities = [];

    // Add Lead Activities
    if (userActivities) {
      userActivities.forEach(a => activities.push({
        ...a,
        type: 'lead_activity',
        timestamp: new Date(a.created_at)
      }));
    }

    // Add Call Logs
    if (userCallLogs) {
      userCallLogs.forEach(c => activities.push({
        id: `call-${c.id}`,
        action: 'call_logged',
        detail: `Logged a call with ${c.lead_name}. Outcome: ${c.outcome_display}`,
        timestamp: new Date(c.created_at),
        type: 'call'
      }));
    }

    // Add Sales
    if (userSales) {
      userSales.forEach(s => activities.push({
        id: `sale-${s.id}`,
        action: 'sale_recorded',
        detail: `Recorded a sale of ${s.weight_grams}g gold to ${s.lead_name}.`,
        timestamp: new Date(s.created_at),
        type: 'sale'
      }));
    }

    return activities.sort((a, b) => b.timestamp - a.timestamp);
  }, [userActivities, userCallLogs, userSales]);

  // Fetch Profile Requests
  const { data: profileRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ['profile-requests'],
    queryFn: () => api.get('/accounts/profile-requests/').then(res => res.data.results || res.data)
  });

  const approveRequestMutation = useMutation({
    mutationFn: (id) => api.post(`/accounts/profile-requests/${id}/approve/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-requests'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Request approved and applied');
    }
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (id) => api.post(`/accounts/profile-requests/${id}/reject/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-requests'] });
      toast.success('Request rejected');
    }
  });

  // Create Form
  const createForm = useForm({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: {
      branch: !isOwner ? user?.branch : undefined
    }
  });

  // Edit Form
  const editForm = useForm({
    resolver: zodResolver(profileUpdateSchema)
  });

  // Permissions Form
  const permissionsForm = useForm();

  // Task Form
  const taskForm = useForm({
    resolver: zodResolver(taskCreateSchema)
  });

  // Sync edit form when currentUser updates from backend
  React.useEffect(() => {
    if (isDetailsOpen && currentUser) {
      editForm.reset({
        full_name: currentUser.full_name || '',
        phone: currentUser.phone || '',
        whatsapp_number: currentUser.whatsapp_number || '',
        marital_status: currentUser.marital_status || '',
        qualification: currentUser.qualification || '',
        date_of_birth: currentUser.date_of_birth || '',
        join_date: currentUser.join_date || '',
        employee_id: currentUser.employee_id || '',
        address: currentUser.address || '',
        emergency_contact_name: currentUser.emergency_contact_name || '',
        emergency_contact_phone: currentUser.emergency_contact_phone || '',
        notes: currentUser.notes || ''
      });
    }
  }, [currentUser, isDetailsOpen, editForm]);

  const createMutation = useMutation({
    mutationFn: (newStaff) => api.post('/accounts/users/', newStaff),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setIsCreateOpen(false);
      createForm.reset();
      toast.success('Staff created successfully');
    },
    onError: (err) => {
      const data = err.response?.data;
      const first = data && typeof data === 'object'
        ? Object.values(data).flat()?.[0]
        : null;
      toast.error(first || data?.detail || 'Failed to create staff');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => api.patch(`/accounts/users/${id}/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setAvatarFile(null);
      toast.success('Profile updated successfully');
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error("You don't have permission to update this user's profile");
      } else {
        toast.error(err.response?.data?.detail || 'Failed to update profile');
      }
    }
  });

  const permissionsMutation = useMutation({
    mutationFn: ({ id, formData }) => api.patch(`/accounts/staff-permissions/${id}/`, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', selectedUser?.id] });
      toast.success('Permissions updated successfully');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to update permissions');
    }
  });

  const taskMutation = useMutation({
    mutationFn: (newTask) => api.post('/tasks/tasks/', { ...newTask, assigned_to: selectedUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-tasks', selectedUser?.id] });
      taskForm.reset();
      toast.success('Task assigned successfully');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to assign task');
    }
  });

  const setRoleMutation = useMutation({
    mutationFn: (role) => api.post(`/accounts/users/${selectedUser.id}/set-role/`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Role updated successfully');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to update role');
    }
  });

  const setBranchMutation = useMutation({
    mutationFn: (branch_id) => api.post(`/accounts/users/${selectedUser.id}/set-branch/`, { branch_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Branch updated successfully');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to update branch');
    }
  });

  const terminateMutation = useMutation({
    mutationFn: (reason) => api.post(`/accounts/users/${selectedUser.id}/terminate/`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setIsTerminateOpen(false);
      setIsDetailsOpen(false);
      toast.success('Staff terminated successfully');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to terminate staff');
    }
  });

  const onCreateSubmit = (data) => {
    createMutation.mutate(data);
  };

  const onPermissionsSubmit = (data) => {
    if (!permissionsData?.id) return;
    const flags = {};
    PERMISSION_GROUPS.forEach(group => {
      group.fields.forEach(field => {
        flags[field] = !!data[field];
      });
    });
    permissionsMutation.mutate({ id: permissionsData.id, formData: flags });
  };

  const onTaskSubmit = (data) => {
    taskMutation.mutate(data);
  };

  const onEditSubmit = (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value === null || value === undefined) return;
      formData.append(key, value);
    });
    
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }
    
    updateMutation.mutate({ id: selectedUser.id, formData });
  };

  const openDetailsModal = (user) => {
    setSelectedUser(user);
    editForm.reset({
      full_name: user.full_name || '',
      phone: user.phone || '',
      whatsapp_number: user.whatsapp_number || '',
      marital_status: user.marital_status || '',
      qualification: user.qualification || '',
      date_of_birth: user.date_of_birth || '',
      join_date: user.join_date || '',
      employee_id: user.employee_id || '',
      address: user.address || '',
      emergency_contact_name: user.emergency_contact_name || '',
      emergency_contact_phone: user.emergency_contact_phone || '',
      notes: user.notes || ''
    });
    setAvatarFile(null);
    setIsDetailsOpen(true);
  };

  // Reset permissions form when data loads
  React.useEffect(() => {
    if (permissionsData) {
      permissionsForm.reset(permissionsData);
    }
  }, [permissionsData, permissionsForm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Users className="text-primary" /> Team Management
        </h1>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Branches</option>
              {branchesData?.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          {(isOwner || isManager || user?.permissions?.can_add_staff) && (
            <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} /> Add Staff
            </Button>
          )}
        </div>
      </div>

      {/* ── Gmail / Staff Morning Email Notification Settings ────────────── */}
      {(isOwner || isManager) && (
        <Card className="border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/40 shadow-sm rounded-xl overflow-hidden mb-4">
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

            <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewEmailOpen(true)}
                className="h-9 px-3 border-amber-300 text-[#C9972A] hover:bg-amber-100/60 text-xs font-bold rounded-lg gap-1.5 shadow-sm"
              >
                <Eye size={14} />
                Preview & Send Digest
              </Button>

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
      )}

      {/* ── Email Template Preview & Direct Send Modal ─────────────────── */}
      <Dialog open={isPreviewEmailOpen} onOpenChange={setIsPreviewEmailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 bg-white rounded-2xl">
          <DialogHeader className="border-b pb-3 mb-4">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <Mail className="text-[#C9972A]" size={22} />
              Morning Staff Email Digest — Template & Direct Send Preview
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Top controls: Pick Staff to Preview */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50/70 p-3.5 border border-amber-200 rounded-xl">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Preview Template For Staff Member:
                </label>
                <select
                  value={previewStaffId}
                  onChange={(e) => setPreviewStaffId(e.target.value)}
                  className="px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-semibold bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9972A]"
                >
                  <option value="">My Account ({user?.full_name || user?.email})</option>
                  {filteredTeam?.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.display_role || m.role}) — {m.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchEmailPreview()}
                  className="text-xs h-8 gap-1 font-semibold"
                >
                  <RefreshCw size={12} className={isLoadingEmailPreview ? 'animate-spin' : ''} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Email Subject Box */}
            <div className="bg-gray-50 p-3 border rounded-xl">
              <span className="text-[11px] uppercase font-bold text-gray-500 block mb-0.5">Email Subject Line:</span>
              <p className="text-sm font-bold text-gray-900">{emailPreviewData?.subject || '☀️ Good Morning! Your Work Plan'}</p>
            </div>

            {/* Live Template HTML Frame */}
            <div className="border rounded-xl overflow-hidden bg-gray-100 shadow-inner">
              <div className="bg-slate-900 text-white text-xs font-bold px-3 py-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Mail size={14} className="text-amber-400" />
                  Live Email Visual HTML Preview (With Gold Logo & Dynamic Work List)
                </span>
                <span className="text-[11px] text-amber-300 font-mono">Recipient: {emailPreviewData?.user_email || user?.email}</span>
              </div>
              {isLoadingEmailPreview ? (
                <div className="p-12 flex flex-col items-center justify-center gap-2 text-gray-500">
                  <Loader2 className="animate-spin text-[#C9972A]" size={28} />
                  <span className="text-xs font-semibold">Rendering HTML Email Template...</span>
                </div>
              ) : (
                <iframe
                  srcDoc={emailPreviewData?.html || ''}
                  title="Email Template Preview"
                  className="w-full h-[420px] border-none bg-white"
                />
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
              <p className="text-xs text-gray-500 font-medium">
                Emails are sent directly via Gmail SMTP with gold branding logo & daily work summaries.
              </p>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsPreviewEmailOpen(false)}
                  className="text-xs font-semibold"
                >
                  Close
                </Button>
                <Button
                  onClick={async () => {
                    await handleTriggerDigestNow();
                    setIsPreviewEmailOpen(false);
                  }}
                  disabled={isTriggeringDigest}
                  className="bg-[#C9972A] hover:bg-[#7A5500] text-white font-bold text-xs gap-1.5 px-4 shadow-md"
                >
                  <Send size={14} className={isTriggeringDigest ? 'animate-spin' : ''} />
                  {isTriggeringDigest ? 'Sending Emails...' : 'Send Morning Digest Now'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="directory">Staff Directory</TabsTrigger>
          {(isOwner || isManager) && (
            <TabsTrigger value="requests" className="relative">
              Profile Requests
              {profileRequests?.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[10px] h-5 w-5 flex items-center justify-center rounded-full">
                  {profileRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="directory" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-[#C9972A] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTeam.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#0F6E56] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTeam.filter(m => m.is_active).length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#1A5490] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadsData?.filter(l => filteredTeam.some(m => m.id === l.assigned_to)).length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#B03A2E] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesData?.filter(s => filteredTeam.some(m => m.id === s.staff)).length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {roleDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <PieChart>
                  <Pie
                    data={roleDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {roleDistributionData.map((entry, index) => (
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
            <CardTitle>Staff Performance (Top 10)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {staffPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={staffPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="leads" orientation="left" stroke="#C9972A" />
                  <YAxis yAxisId="sales" orientation="right" stroke="#1A5490" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="leads" dataKey="leads" fill="#C9972A" name="Leads" />
                  <Bar yAxisId="sales" dataKey="normalSales" fill="#1A5490" stackId="a" name="Normal Sales" />
                  <Bar yAxisId="sales" dataKey="advanceBookings" fill="#8B5CF6" stackId="a" name="Advance Bookings" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create_full_name">Full Name</Label>
              <Input id="create_full_name" {...createForm.register('full_name')} placeholder="John Doe" />
              {createForm.formState.errors.full_name && <p className="text-sm text-destructive">{createForm.formState.errors.full_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_email">Email</Label>
              <Input id="create_email" type="email" {...createForm.register('email')} placeholder="john@bindu.com" />
              {createForm.formState.errors.email && <p className="text-sm text-destructive">{createForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_phone">Phone</Label>
              <Input id="create_phone" {...createForm.register('phone')} placeholder="9999999999" />
              {createForm.formState.errors.phone && <p className="text-sm text-destructive">{createForm.formState.errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_role">System Role</Label>
              <select 
                id="create_role" 
                {...createForm.register('role')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select Role...</option>
                {isOwner && (
                  <>
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="sub_manager">Sub Manager</option>
                  </>
                )}
                {isManager && !isOwner && (
                  <option value="sub_manager">Sub Manager</option>
                )}
                <option value="telecaller">Telecaller</option>
                <option value="field_staff">Field Staff</option>
                <option value="staff">Staff</option>
              </select>
              {createForm.formState.errors.role && <p className="text-sm text-destructive">{createForm.formState.errors.role.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_branch">Branch</Label>
              <select 
                id="create_branch" 
                {...createForm.register('branch', { valueAsNumber: true })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select Branch...</option>
                {isOwner ? (
                  branchesData?.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))
                ) : (
                  <option value={user?.branch}>{user?.branch_name || 'My Branch'}</option>
                )}
              </select>
              {createForm.formState.errors.branch && <p className="text-sm text-destructive">{createForm.formState.errors.branch.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create_password">Password</Label>
                <Input id="create_password" type="password" {...createForm.register('password')} />
                {createForm.formState.errors.password && <p className="text-sm text-destructive">{createForm.formState.errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_password2">Confirm</Label>
                <Input id="create_password2" type="password" {...createForm.register('password2')} />
                {createForm.formState.errors.password2 && <p className="text-sm text-destructive">{createForm.formState.errors.password2.message}</p>}
              </div>
            </div>
            <Button type="submit" className="w-full mt-4" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unified Staff Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          
          {/* Header Banner */}
          <div className="bg-primary/5 p-6 border-b border-border flex items-center gap-6">
            <Avatar className="h-24 w-24 border-4 border-background shadow-sm">
              <AvatarImage src={getMediaUrl(currentUser?.avatar)} />
              <AvatarFallback className="bg-primary/20 text-primary text-3xl font-semibold">
                {currentUser?.full_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-foreground">{currentUser?.full_name}</h2>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <UserIcon size={14} /> {currentUser?.email}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold capitalize">
                  {currentUser?.display_role || currentUser?.role}
                </span>
                <span className="bg-muted text-muted-foreground border px-2 py-1 rounded-md text-xs font-semibold">
                  {currentUser?.branch_name}
                </span>
                <span className={`px-2 py-1 rounded-md text-xs font-semibold ${currentUser?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {currentUser?.is_active ? 'Active Account' : 'Inactive Account'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 pt-2">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="profile">Profile Details</TabsTrigger>
                {selectedUser?.role !== 'owner' && (
                  <TabsTrigger value="permissions">Security & Permissions</TabsTrigger>
                )}
                <TabsTrigger value="tasks">Assigned Tasks</TabsTrigger>
                <TabsTrigger value="activity">Activity History</TabsTrigger>
              </TabsList>
              
              {/* Profile Details Tab */}
              <TabsContent value="profile" className="space-y-4">
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <Label htmlFor="avatar" className="cursor-pointer text-sm font-medium text-primary hover:underline flex items-center gap-2 mb-2">
                      <UserIcon size={16} /> Update Profile Picture
                    </Label>
                    <Input 
                      id="avatar" 
                      type="file" 
                      accept="image/*" 
                      className="bg-background cursor-pointer" 
                      onChange={(e) => setAvatarFile(e.target.files[0])}
                    />
                    {avatarFile && <span className="text-xs text-muted-foreground mt-1">{avatarFile.name} ready to upload</span>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_full_name">Full Name</Label>
                      <Input id="edit_full_name" {...editForm.register('full_name')} />
                      {editForm.formState.errors.full_name && <p className="text-sm text-destructive">{editForm.formState.errors.full_name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_phone">Phone Number</Label>
                      <Input id="edit_phone" {...editForm.register('phone')} />
                      {editForm.formState.errors.phone && <p className="text-sm text-destructive">{editForm.formState.errors.phone.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_employee_id">Employee ID</Label>
                      <Input id="edit_employee_id" {...editForm.register('employee_id')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_join_date">Join Date</Label>
                      <Input id="edit_join_date" type="date" {...editForm.register('join_date')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_date_of_birth">Date of Birth</Label>
                      <Input id="edit_date_of_birth" type="date" {...editForm.register('date_of_birth')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_whatsapp">WhatsApp Number</Label>
                      <Input id="edit_whatsapp" {...editForm.register('whatsapp_number')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_marital">Marital Status</Label>
                      <select 
                        id="edit_marital" 
                        {...editForm.register('marital_status')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select...</option>
                        <option value="married">Married</option>
                        <option value="unmarried">Unmarried</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit_qualification">Qualification</Label>
                      <Input id="edit_qualification" {...editForm.register('qualification')} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit_address">Home Address</Label>
                      <Input id="edit_address" {...editForm.register('address')} />
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_emergency_contact_name">Emergency Contact Name</Label>
                      <Input id="edit_emergency_contact_name" {...editForm.register('emergency_contact_name')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_emergency_contact_phone">Emergency Contact Phone</Label>
                      <Input id="edit_emergency_contact_phone" {...editForm.register('emergency_contact_phone')} />
                    </div>
                  </div>

                  {/* Owner-Only Administrative Controls */}
                  {user?.role === 'owner' && (
                    <div className="border-t border-red-100 pt-6 mt-6 space-y-4">
                      <h4 className="text-sm font-bold text-red-600 flex items-center gap-2">
                        <Shield size={16} /> Administrative Controls (Owner Only)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-red-50/50 rounded-xl border border-red-100">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-red-700">Change Staff Role</Label>
                          <select 
                            value={currentUser?.role}
                            onChange={(e) => setRoleMutation.mutate(e.target.value)}
                            className="w-full p-2 border rounded-md bg-white"
                          >
                            <option value="owner">Owner</option>
                            <option value="manager">Manager</option>
                            <option value="sub_manager">Sub Manager</option>
                            <option value="telecaller">Telecaller</option>
                            <option value="field_staff">Field Staff</option>
                            <option value="staff">Staff</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-red-700">Transfer Branch</Label>
                          <select 
                            value={currentUser?.branch}
                            onChange={(e) => setBranchMutation.mutate(parseInt(e.target.value))}
                            className="w-full p-2 border rounded-md bg-white"
                          >
                            {branchesData?.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2 pt-2">
                          <Button 
                            type="button" 
                            variant="destructive" 
                            className="w-full"
                            onClick={() => setIsTerminateOpen(true)}
                            disabled={!currentUser?.is_active}
                          >
                            {currentUser?.is_active ? 'Terminate Staff Member' : 'Account Already Terminated'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {(user?.role === 'owner' || user?.role === 'manager' || user?.role === 'admin' || user?.permissions?.can_edit_staff) && (
                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                        Save Profile Changes
                      </Button>
                    </div>
                  )}
                </form>
              </TabsContent>

              {/* Permissions Tab */}
              {currentUser?.role !== 'owner' && (
                <TabsContent value="permissions">
                  {loadingPermissions ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                  ) : !permissionsData ? (
                    <div className="text-center py-8 text-muted-foreground">No permissions record found.</div>
                  ) : (
                    <form onSubmit={permissionsForm.handleSubmit(onPermissionsSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {PERMISSION_GROUPS.map((group) => (
                          <Card key={group.group} className="shadow-none border-border">
                            <CardHeader className="py-3 px-4 bg-muted/30 border-b border-border">
                              <CardTitle className="text-base font-semibold">{group.group}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                              {group.fields.map(field => (
                                <div key={field} className="flex items-center space-x-3">
                                    <input
                                      type="checkbox"
                                      id={field}
                                      {...permissionsForm.register(field)}
                                      disabled={user?.role !== 'owner' && user?.role !== 'admin'}
                                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <Label htmlFor={field} className="text-sm font-medium cursor-pointer">
                                      {field.replace(/can_/g, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </Label>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        {(isOwner || user?.role === 'admin') && (
                          <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={permissionsMutation.isPending}>
                              {permissionsMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Shield size={16} className="mr-2" />}
                              Update Security Matrix
                            </Button>
                          </div>
                        )}
                      </form>
                  )}
                </TabsContent>
              )}

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="space-y-6">
                {(isOwner || isManager) && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="py-4">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Plus size={18} /> Assign New Task
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Task Title</Label>
                            <Input {...taskForm.register('title')} placeholder="e.g. Call high-priority leads" />
                            {taskForm.formState.errors.title && <p className="text-sm text-destructive">{taskForm.formState.errors.title.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>Due Date</Label>
                            <Input type="datetime-local" {...taskForm.register('due_date')} />
                          </div>
                          <div className="space-y-2">
                            <Label>Priority</Label>
                            <select 
                              {...taskForm.register('priority')}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea {...taskForm.register('description')} placeholder="Detailed instructions..." />
                        </div>
                        <div className="flex justify-end">
                          <Button type="submit" disabled={taskMutation.isPending}>
                            {taskMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <ListTodo size={16} className="mr-2" />}
                            Assign Task
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Current Assignments</h3>
                  {loadingTasks ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                  ) : userTasks?.length > 0 ? (
                    <div className="grid gap-3">
                      {userTasks.map(task => (
                        <div key={task.id} className="bg-background border rounded-lg p-4 flex justify-between items-start shadow-sm">
                          <div className="space-y-1">
                            <div className="font-medium flex items-center gap-2">
                              {task.title}
                              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-bold ${
                                task.priority === 'high' ? 'bg-red-100 text-red-700' : 
                                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Clock size={12} /> Due: {task.due_date ? new Date(task.due_date).toLocaleString() : 'N/A'}</span>
                              <span className="flex items-center gap-1"><AlertCircle size={12} /> Status: <span className="capitalize font-medium">{task.status.replace('_', ' ')}</span></span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                      <p className="text-muted-foreground">No tasks assigned yet.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Activity History</h3>
                  {loadingActivities ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                  ) : unifiedActivities?.length > 0 ? (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                      {unifiedActivities.slice(0, 30).map(activity => (
                        <div key={activity.id} className="relative">
                          <div className={`absolute -left-[22px] top-1 h-4 w-4 rounded-full border-2 border-background shadow-sm ${
                            activity.type === 'sale' ? 'bg-green-500' :
                            activity.type === 'call' ? 'bg-blue-500' :
                            'bg-primary'
                          }`} />
                          <div className="bg-background border rounded-lg p-4 shadow-sm hover:border-primary/50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="font-bold flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase font-bold px-1 py-0 h-4">
                                    {activity.type.replace('_', ' ')}
                                  </Badge>
                                  <span className="capitalize">{activity.action.replace('_', ' ')}</span>
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed">{activity.detail}</p>
                              </div>
                              <div className="text-[10px] font-medium text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-1 rounded">
                                {activity.timestamp.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20">
                      <Clock className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground font-medium">No activity history found for this member.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Staff Directory</CardTitle>
          <div className="relative w-72">
            <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, email or phone..."
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  {(isOwner || isManager) && <TableHead>Email Digest</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeam?.length > 0 ? filteredTeam.map((member) => (
                  <TableRow key={member.id} className="group cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openDetailsModal(member)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={getMediaUrl(member.avatar)} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.full_name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-medium group-hover:text-primary transition-colors">{member.full_name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell className="capitalize">{member.display_role || member.role}</TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {member.branch_name || (member.role === 'owner' || member.role === 'admin' ? 'All Branches (HQ)' : 'Unassigned')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${member.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    {(isOwner || isManager) && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={toggleStaffEmailMutation.isLoading}
                          onClick={() => toggleStaffEmailMutation.mutate({
                            userId: member.id,
                            enabled: !(member.email_notifications_enabled ?? true)
                          })}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
                            member.email_notifications_enabled ?? true
                              ? 'bg-amber-50 text-[#C9972A] border-amber-300 hover:bg-amber-100'
                              : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                          }`}
                          title={member.email_notifications_enabled ?? true ? 'Click to disable morning email digest' : 'Click to enable morning email digest'}
                        >
                          <Mail size={12} />
                          {member.email_notifications_enabled ?? true ? 'ON' : 'OFF'}
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDetailsModal(member); }}>
                        View Details <ChevronRight size={14} className="ml-1 opacity-50" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No staff members found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    {(isOwner || isManager) && (
      <TabsContent value="requests">
        <Card>
          <CardHeader>
            <CardTitle>Pending Profile Updates</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Requested Changes</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profileRequests?.length > 0 ? profileRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.user_name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {Object.entries(request.requested_data).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="font-bold capitalize">{key.replace(/_/g, ' ')}:</span> {value?.toString()}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={request.status === 'pending' ? 'outline' : request.status === 'approved' ? 'success' : 'destructive'} className="capitalize">
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {request.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => approveRequestMutation.mutate(request.id)}
                              disabled={approveRequestMutation.isPending}
                            >
                              <CheckCircle2 size={14} className="mr-1" /> Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => rejectRequestMutation.mutate(request.id)}
                              disabled={rejectRequestMutation.isPending}
                            >
                              <XCircle size={14} className="mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No profile update requests found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    )}
  </Tabs>

  {/* Termination Confirmation Dialog */}
  <Dialog open={isTerminateOpen} onOpenChange={setIsTerminateOpen}>
    <DialogContent className="max-w-md" aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle className="text-red-600 flex items-center gap-2">
          <AlertCircle size={20} /> Terminate Staff Member
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-100">
          <strong>Warning:</strong> This action will deactivate the user account immediately. They will no longer be able to log in.
        </div>
        <div className="space-y-2">
          <Label>Reason for Termination</Label>
          <Textarea 
            placeholder="e.g. Resigned, Performance issues, etc." 
            value={terminationReason}
            onChange={(e) => setTerminationReason(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setIsTerminateOpen(false)}>Cancel</Button>
        <Button 
          variant="destructive" 
          onClick={() => terminateMutation.mutate(terminationReason)}
          disabled={terminateMutation.isPending || !terminationReason}
        >
          {terminateMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
          Confirm Termination
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</div>
);
};

export default TeamPage;
