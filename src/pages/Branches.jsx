import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/api/axios';
import { MapPin, Plus, Loader2, TrendingUp, Users, BarChart3, DollarSign, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
  DialogTrigger,
} from '@/components/ui/dialog';

const branchSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  address: z.string().min(5, 'Address is required'),
  phone: z.string().min(10, 'Valid phone is required'),
  lat: z.string().optional(),
  lng: z.string().optional(),
  company: z.number().optional()
});

const segmentSchema = z.object({
  name: z.string().min(1, 'Segment name is required'),
  description: z.string().optional()
});

const BranchesPage = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBranchForSegment, setSelectedBranchForSegment] = useState(null);
  const [isSegmentDialogOpen, setIsSegmentDialogOpen] = useState(false);

  // Fetch Companies (required for creating a branch)
  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get('/branches/companies/').then(res => res.data.results || res.data)
  });

  // Fetch Branches
  const { data: branchesData, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => res.data.results || res.data)
  });

  // Fetch Leads for metrics
  const { data: leadsData } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.get('/leads/leads/').then(res => res.data.results || res.data)
  });

  // Fetch Sales for metrics
  const { data: salesData } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.get('/sales/sales/').then(res => res.data.results || res.data)
  });

  // Fetch Team for metrics
  const { data: teamData } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get('/accounts/users/').then(res => res.data.results || res.data)
  });

  // Chart data
  const branchPerformanceData = React.useMemo(() => {
    if (!branchesData || branchesData.length === 0) return [];
    
    return branchesData.map(branch => ({
      name: branch.name,
      leads: leadsData?.filter(l => l.branch === branch.id).length || 0,
      sales: salesData?.filter(s => s.branch === branch.id).length || 0,
      staff: teamData?.filter(t => t.branch === branch.id).length || 0
    }));
  }, [branchesData, leadsData, salesData, teamData]);

  const segmentDistributionData = React.useMemo(() => {
    if (!branchesData || branchesData.length === 0) return [];
    
    const segmentCounts = {};
    branchesData.forEach(branch => {
      branch.segments?.forEach(seg => {
        const name = seg.name_display || seg.name;
        segmentCounts[name] = (segmentCounts[name] || 0) + 1;
      });
    });
    
    return Object.entries(segmentCounts).map(([name, count]) => ({
      name,
      value: count
    }));
  }, [branchesData]);

  const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#B03A2E', '#6B7280', '#EF4444'];

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(branchSchema)
  });

  const segmentForm = useForm({
    resolver: zodResolver(segmentSchema)
  });

  const createMutation = useMutation({
    mutationFn: (newBranch) => api.post('/branches/', newBranch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setIsDialogOpen(false);
      reset();
    }
  });

  const onSubmit = (data) => {
    // If we have companies, attach the first company ID
    if (companiesData && companiesData.length > 0) {
      data.company = companiesData[0].id;
    }
    // Clean up empty optional fields so they don't cause backend decimal validation errors
    if (!data.lat || data.lat.trim() === '') {
      delete data.lat;
    }
    if (!data.lng || data.lng.trim() === '') {
      delete data.lng;
    }
    createMutation.mutate(data);
  };

  const createSegmentMutation = useMutation({
    mutationFn: (newSegment) => api.post('/branches/segments/', newSegment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      segmentForm.reset();
    }
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: (segmentId) => api.delete(`/branches/segments/${segmentId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    }
  });

  const onSegmentSubmit = (data) => {
    createSegmentMutation.mutate({ ...data, branch: selectedBranchForSegment.id });
  };

  const openSegmentModal = (branch) => {
    setSelectedBranchForSegment(branch);
    segmentForm.reset();
    setIsSegmentDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <MapPin className="text-primary" /> Branches
        </h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} /> Add Branch
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Add New Branch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Branch Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g. MG Road Branch" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" {...register('address')} placeholder="123 Main St" />
                {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register('phone')} placeholder="9999999999" />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitude (Opt)</Label>
                  <Input id="lat" {...register('lat')} placeholder="8.5241" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Longitude (Opt)</Label>
                  <Input id="lng" {...register('lng')} placeholder="76.9366" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                Create Branch
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-[#C9972A] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Branches</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchesData?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#0F6E56] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamData?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#1A5490] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadsData?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#B03A2E] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesData?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Branch Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {branchPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={branchPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="leads" orientation="left" stroke="#C9972A" />
                  <YAxis yAxisId="sales" orientation="right" stroke="#1A5490" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="leads" dataKey="leads" fill="#C9972A" name="Leads" />
                  <Bar yAxisId="sales" dataKey="sales" fill="#1A5490" name="Sales" />
                </BarChart>
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
            <CardTitle>Segment Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {segmentDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <PieChart>
                  <Pie
                    data={segmentDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {segmentDistributionData.map((entry, index) => (
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Branches</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Segments</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchesData?.length > 0 ? branchesData.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.address}</TableCell>
                    <TableCell>{branch.phone}</TableCell>
                    <TableCell>{branch.company_name || 'Bindu Jewellery'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {branch.segments?.map(seg => (
                          <span key={seg.id} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full whitespace-nowrap">
                            {seg.name_display}
                          </span>
                        ))}
                        {(!branch.segments || branch.segments.length === 0) && (
                          <span className="text-muted-foreground text-xs italic">No segments</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openSegmentModal(branch)}>
                        Manage Segments
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No branches found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Segments Dialog */}
      <Dialog open={isSegmentDialogOpen} onOpenChange={setIsSegmentDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Manage Segments for {selectedBranchForSegment?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const currentBranch = branchesData?.find(b => b.id === selectedBranchForSegment?.id) || selectedBranchForSegment;
              return (
                <div className="bg-muted p-4 rounded-md space-y-2">
                  <h3 className="text-sm font-semibold mb-2">Current Segments</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentBranch?.segments?.map(seg => (
                      <span key={seg.id} className="bg-primary text-primary-foreground text-sm px-3 py-1 rounded-full flex items-center gap-2">
                        {seg.name_display}
                        <button 
                          onClick={() => deleteSegmentMutation.mutate(seg.id)}
                          className="hover:bg-primary-foreground/20 rounded-full p-0.5"
                          title="Remove Segment"
                          disabled={deleteSegmentMutation.isPending}
                        >
                          {deleteSegmentMutation.isPending && deleteSegmentMutation.variables === seg.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <X size={14} />
                          )}
                        </button>
                      </span>
                    ))}
                    {(!currentBranch?.segments || currentBranch?.segments.length === 0) && (
                      <span className="text-muted-foreground text-sm italic">None added yet.</span>
                    )}
                  </div>
                </div>
              );
            })()}

            <form onSubmit={segmentForm.handleSubmit(onSegmentSubmit)} className="space-y-4 border-t pt-4 border-border">
              <div className="space-y-2">
                <Label htmlFor="segment_name">Add New Segment</Label>
                <select 
                  id="segment_name" 
                  {...segmentForm.register('name')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select Segment...</option>
                  <option value="bridal">Bridal Jewellery</option>
                  <option value="daily_wear">Daily Wear</option>
                  <option value="investment">Investment Gold</option>
                  <option value="diamond">Diamond Collection</option>
                </select>
                {segmentForm.formState.errors.name && <p className="text-sm text-destructive">{segmentForm.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment_description">Description (Optional)</Label>
                <Input id="segment_description" {...segmentForm.register('description')} placeholder="Segment details" />
              </div>
              <Button type="submit" className="w-full" disabled={createSegmentMutation.isPending}>
                {createSegmentMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                Add Segment
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchesPage;
