import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import api from '@/api/axios';
import useAuth from '@/hooks/useAuth';
import { 
  Megaphone, Plus, Loader2, Calendar, Users, BarChart3, Filter, 
  TrendingUp, Target, Settings, Search, Grid, Menu,
  Globe, Camera, MessageSquare, Monitor, MapPin,
  CheckCircle, XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const campaignSchema = z.object({
  name: z.string().min(2, 'Campaign name is required'),
  channel_type: z.string().min(1, 'Channel is required'),
  objective: z.string().min(1, 'Objective is required'),
  campaign_type: z.string().min(1, 'Type is required'),
  template_name: z.string().min(1, 'Template name is required'),
  message: z.string().min(10, 'Message body is required')
});

const CampaignsPage = () => {
  const { hasPermission } = useAuth();
  const canCreateCampaign = hasPermission('campaigns:create') || hasPermission('campaigns:manage');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  // Multi-branch selection for campaign creation form
  const [formSelectedBranches, setFormSelectedBranches] = useState([]);
  const [branchSelectionError, setBranchSelectionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Fetch Campaigns (server-side branch + search)
  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['campaigns', selectedBranch, debouncedSearch],
    queryFn: () => {
      const params = {};
      if (selectedBranch !== 'all') params.branch = selectedBranch;
      if (debouncedSearch) params.search = debouncedSearch;
      params.page_size = 500;
      return api.get('/campaigns/campaigns/', { params }).then(res => {
        const data = res.data.results || res.data;
        return Array.isArray(data) ? data : [];
      });
    }
  });

  // Client-side filtering
  const filteredCampaigns = useMemo(() => {
    let data = campaignsData || [];
    
    if (activeTab !== 'all') {
      data = data.filter(c => c.channel_type === activeTab);
    }
    
    return data;
  }, [campaignsData, activeTab]);

  // Chart data
  const campaignStatusData = useMemo(() => {
    if (!filteredCampaigns || filteredCampaigns.length === 0) return [];
    const statusCounts = {};
    filteredCampaigns.forEach(camp => {
      const status = camp.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count
    }));
  }, [filteredCampaigns]);

  const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#B03A2E', '#6B7280', '#EF4444'];

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      campaign_type: 'custom',
      channel_type: 'paid',
      objective: 'awareness'
    }
  });

  const createMutation = useMutation({
    mutationFn: (newCampaign) => api.post('/campaigns/campaigns/', newCampaign),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const toggleBranch = (branchId) => {
    setBranchSelectionError('');
    setFormSelectedBranches(prev =>
      prev.includes(branchId)
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const toggleAllBranches = () => {
    setBranchSelectionError('');
    const allIds = (branchesData || []).map(b => b.id.toString());
    setFormSelectedBranches(prev =>
      prev.length === allIds.length ? [] : allIds
    );
  };

  const onSubmit = async (data) => {
    if (formSelectedBranches.length === 0) {
      setBranchSelectionError('Please select at least one branch');
      return;
    }

    const { ...campaignFields } = data;
    const branchesToCreate = formSelectedBranches;
    let successCount = 0;
    let failCount = 0;
    setIsSubmitting(true);

    for (const branchId of branchesToCreate) {
      try {
        await api.post('/campaigns/campaigns/', {
          ...campaignFields,
          branch: parseInt(branchId, 10),
        });
        successCount++;
      } catch (err) {
        failCount++;
        const branchName = branchesData?.find(b => b.id.toString() === branchId)?.name || branchId;
        console.error(`Failed to create campaign for branch ${branchName}:`, err.response?.data);
      }
    }

    setIsSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ['campaigns'] });

    if (successCount > 0 && failCount === 0) {
      toast.success(
        branchesToCreate.length === 1
          ? 'Campaign created successfully!'
          : `Campaign created for ${successCount} branch${successCount > 1 ? 'es' : ''}!`
      );
      setIsDialogOpen(false);
      reset();
      setFormSelectedBranches([]);
      setBranchSelectionError('');
    } else if (successCount > 0 && failCount > 0) {
      toast.success(`${successCount} campaign(s) created, ${failCount} failed.`);
      setIsDialogOpen(false);
      reset();
      setFormSelectedBranches([]);
    } else {
      toast.error('Failed to create campaign. Check console for details.');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Megaphone className="text-primary h-6 w-6" /> 
            </div>
            Campaigns
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Monitor and scale your marketing efforts across all channels.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 border-primary/20 hover:bg-primary/5 transition-colors"
            onClick={() => navigate('/campaigns/settings/integrations')}
          >
            <Settings size={16} className="text-primary" />
            Integrations
          </Button>
          
          {canCreateCampaign && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-md">
                <Plus size={16} /> Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle className="text-xl">Launch New Campaign</DialogTitle>
                <CardDescription>Setup a new marketing campaign to reach your audience.</CardDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input id="name" {...register('name')} placeholder="e.g. Diwali Mega Offer 2026" />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>

                {/* Branch Context — Multi-Select */}
                <div className="space-y-2">
                  <Label>Branch Context *</Label>
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/20 max-h-40 overflow-y-auto">
                    {/* All Branches toggle */}
                    <label className="flex items-center gap-2.5 cursor-pointer hover:bg-background/70 rounded-md px-2 py-1.5 transition-colors">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded text-primary accent-primary cursor-pointer"
                        checked={(branchesData || []).length > 0 && formSelectedBranches.length === (branchesData || []).length}
                        onChange={toggleAllBranches}
                      />
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Globe size={13} className="text-primary" /> All Branches
                      </span>
                      {formSelectedBranches.length === (branchesData || []).length && (branchesData || []).length > 0 && (
                        <Badge className="ml-auto text-[10px] bg-primary/10 text-primary border-0 px-1.5">All</Badge>
                      )}
                    </label>
                    <div className="border-t border-border/40 my-1" />
                    {/* Individual branches */}
                    {(branchesData || []).map(branch => (
                      <label key={branch.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-background/70 rounded-md px-2 py-1.5 transition-colors">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded text-primary accent-primary cursor-pointer"
                          checked={formSelectedBranches.includes(branch.id.toString())}
                          onChange={() => toggleBranch(branch.id.toString())}
                        />
                        <span className="text-sm text-foreground">{branch.name}</span>
                      </label>
                    ))}
                  </div>
                  {/* Selected summary */}
                  {formSelectedBranches.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formSelectedBranches.length === (branchesData || []).length
                        ? `All ${formSelectedBranches.length} branches selected — one campaign will be created per branch.`
                        : `${formSelectedBranches.length} branch${formSelectedBranches.length > 1 ? 'es' : ''} selected.`}
                    </p>
                  )}
                  {branchSelectionError && <p className="text-sm text-destructive">{branchSelectionError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channel_type">Channel Type</Label>
                  <Select defaultValue="paid" onValueChange={(value) => setValue('channel_type', value)}>
                    <SelectTrigger id="channel_type">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="organic">Organic</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="objective">Objective</Label>
                    <Select defaultValue="awareness" onValueChange={(value) => setValue('objective', value)}>
                      <SelectTrigger id="objective">
                        <SelectValue placeholder="Select objective" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="awareness">Awareness</SelectItem>
                        <SelectItem value="engagement">Engagement</SelectItem>
                        <SelectItem value="lead_generation">Lead Generation</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="retention">Retention</SelectItem>
                        <SelectItem value="branding">Branding</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaign_type">Campaign Category</Label>
                    <Select defaultValue="custom" onValueChange={(value) => setValue('campaign_type', value)}>
                      <SelectTrigger id="campaign_type">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="festival">Festival</SelectItem>
                        <SelectItem value="birthday">Birthday</SelectItem>
                        <SelectItem value="anniversary">Anniversary</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template_name">WhatsApp Template Name</Label>
                  <Input id="template_name" {...register('template_name')} placeholder="e.g. festival_offer_v1" />
                  {errors.template_name && <p className="text-sm text-destructive">{errors.template_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message Body</Label>
                  <Textarea id="message" {...register('message')} placeholder="Type your campaign message here..." className="min-h-[120px] resize-none" />
                  {errors.message && <p className="text-sm text-destructive">{errors.message.message}</p>}
                </div>

                <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Megaphone className="mr-2 h-4 w-4" />}
                  {isSubmitting
                    ? `Creating for ${formSelectedBranches.length} branch${formSelectedBranches.length > 1 ? 'es' : ''}...`
                    : 'Launch Campaign'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Integrations Quick-View Bar */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-secondary/30 rounded-lg border border-border/50 shadow-sm">
        <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Settings className="h-4 w-4" /> Connections:
        </span>
        <Badge variant="outline" className="bg-background gap-1.5 py-1 px-3 border-green-200">
          <Globe className="h-3 w-3 text-blue-600" /> Meta Ads
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-1"></span>
        </Badge>
        <Badge variant="outline" className="bg-background gap-1.5 py-1 px-3 border-green-200">
          <Camera className="h-3 w-3 text-pink-600" /> Instagram
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-1"></span>
        </Badge>
        <Badge variant="outline" className="bg-background gap-1.5 py-1 px-3 border-green-200">
          <MessageSquare className="h-3 w-3 text-green-500" /> WhatsApp API
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-1"></span>
        </Badge>
        <Badge variant="outline" className="bg-background gap-1.5 py-1 px-3 opacity-60 border-red-200">
          <Monitor className="h-3 w-3 text-blue-500" /> Google Ads
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 ml-1"></span>
        </Badge>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[#C9972A] shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Campaigns</CardTitle>
            <div className="p-2 bg-yellow-50 rounded-full">
              <Megaphone className="h-4 w-4 text-[#C9972A]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaignsData?.filter(c => c.status === 'active').length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+2</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#0F6E56] shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reach</CardTitle>
            <div className="p-2 bg-green-50 rounded-full">
              <Users className="h-4 w-4 text-[#0F6E56]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaignsData?.reduce((acc, c) => acc + (c.sent_count || 0), 0).toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">+15%</span> engagement
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#1A5490] shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Leads Generated</CardTitle>
            <div className="p-2 bg-blue-50 rounded-full">
              <Filter className="h-4 w-4 text-[#1A5490]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaignsData?.reduce((acc, c) => acc + (c.total_leads || 0), 0).toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-500 font-medium">8.4%</span> conv. rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#B03A2E] shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. ROAS</CardTitle>
            <div className="p-2 bg-red-50 rounded-full">
              <Target className="h-4 w-4 text-[#B03A2E]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaignsData?.length > 0 
                ? (campaignsData.reduce((acc, c) => acc + (c.roi_percent || 0), 0) / campaignsData.length).toFixed(1) 
                : 0}x
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              Target: 4.0x
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Campaign Management Area */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            
            {/* Level 1: Channel Tabs */}
            <Tabs defaultValue="all" className="w-full md:w-auto" onValueChange={setActiveTab}>
              <TabsList className="bg-secondary/50">
                <TabsTrigger value="all">All Channels</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="organic">Organic</TabsTrigger>
                <TabsTrigger value="offline">Offline</TabsTrigger>
                <TabsTrigger value="event">Event</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Level 2 & 3: Smart Filters (Simplified for space, expanding to advanced in future) */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  className="pl-9 bg-background focus-visible:ring-primary/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-full sm:w-[150px] bg-background">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branchesData?.map(branch => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* View Toggles */}
                <div className="hidden sm:flex border rounded-md p-0.5 bg-secondary/20">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-8 w-8 rounded-sm ${viewMode === 'grid' ? 'bg-background shadow-sm' : ''}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-8 w-8 rounded-sm ${viewMode === 'list' ? 'bg-background shadow-sm' : ''}`}
                    onClick={() => setViewMode('list')}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 bg-secondary/5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Loading campaigns data...</p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-background">
              <div className="bg-secondary p-4 rounded-full mb-4">
                <Megaphone className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground">No campaigns found</p>
              <p className="text-sm mt-1">Try adjusting your filters or create a new campaign.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((camp) => (
                <Card key={camp.id} className="hover:border-primary/50 transition-colors group overflow-hidden flex flex-col bg-background">
                  <CardHeader className="pb-3 px-5 pt-5 flex-row justify-between items-start space-y-0 relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors"></div>
                    <div>
                      <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-wider font-semibold border-primary/20 text-primary">
                        {camp.channel_display || camp.channel_type}
                      </Badge>
                      <CardTitle className="text-lg line-clamp-1" title={camp.name}>{camp.name}</CardTitle>
                    </div>
                    <Badge variant={camp.status === 'active' ? 'success' : 'secondary'} className="capitalize shrink-0">
                      {camp.status}
                    </Badge>
                  </CardHeader>
                  
                  <CardContent className="px-5 py-2 flex-grow">
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {camp.objective && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted font-normal text-xs capitalize">
                          {camp.objective.replace('_', ' ')}
                        </Badge>
                      )}
                      {camp.tags && camp.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted font-normal text-xs capitalize">
                          {tag}
                        </Badge>
                      ))}
                      {(!camp.tags || camp.tags.length === 0) && !camp.objective && (
                         <span className="text-xs text-muted-foreground">No tags</span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm mt-4">
                      <div>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Reach</p>
                        <p className="font-semibold flex items-center gap-1.5 text-foreground">
                          <Users size={14} className="text-primary/70" /> {camp.sent_count || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Leads</p>
                        <p className="font-semibold flex items-center gap-1.5 text-foreground">
                          <Filter size={14} className="text-blue-500/70" /> {camp.total_leads || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">ROAS</p>
                        <p className="font-semibold flex items-center gap-1.5 text-green-600">
                          <BarChart3 size={14} /> {camp.roi_percent || 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Scheduled</p>
                        <p className="font-semibold flex items-center gap-1.5 text-foreground">
                          <Calendar size={14} className="text-muted-foreground" />
                          <span className="truncate">{camp.scheduled_at ? format(new Date(camp.scheduled_at), 'MMM dd') : 'Immediate'}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="px-5 py-3 bg-muted/20 border-t flex justify-between items-center mt-auto">
                    <div className="flex -space-x-1">
                      {/* Fake platforms for visual layout demo */}
                      <div className="h-6 w-6 rounded-full bg-white border flex items-center justify-center z-20 shadow-sm" title="Meta">
                        <Globe className="h-3 w-3 text-blue-600" />
                      </div>
                      <div className="h-6 w-6 rounded-full bg-white border flex items-center justify-center z-10 shadow-sm" title="Instagram">
                        <Camera className="h-3 w-3 text-pink-600" />
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-medium group-hover:text-primary transition-colors">
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-background rounded-md border shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Type & Tags</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((camp) => (
                    <TableRow key={camp.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-foreground">{camp.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar size={12} /> {camp.scheduled_at ? format(new Date(camp.scheduled_at), 'MMM dd, yyyy') : 'Immediate'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1.5">
                          <Badge variant="outline" className="text-[10px] uppercase border-primary/20 text-primary">{camp.channel_display || camp.channel_type}</Badge>
                          <span className="text-xs text-muted-foreground capitalize">{camp.objective?.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Globe className="h-4 w-4 text-blue-600" />
                          <Camera className="h-4 w-4 text-pink-600" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-4 text-sm">
                          <div title="Reach">
                            <Users size={14} className="inline mr-1 text-muted-foreground" />
                            {camp.sent_count || 0}
                          </div>
                          <div title="ROAS" className="font-medium text-green-600">
                            <BarChart3 size={14} className="inline mr-1" />
                            {camp.roi_percent || 0}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={camp.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                          {camp.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Manage</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics Overview Section */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm md:col-span-1 border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Campaign Health</CardTitle>
            <CardDescription>Status distribution across active channels</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {campaignStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={campaignStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {campaignStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm md:col-span-2 border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Performance Trends</CardTitle>
              <CardDescription>Reach and engagement over the last 30 days</CardDescription>
            </div>
            <Select defaultValue="30d">
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last Quarter</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="h-72 pt-4">
            {filteredCampaigns.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredCampaigns.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="sent_count" name="Reach" fill="#C9972A" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="flex items-center justify-center h-full text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CampaignsPage;
