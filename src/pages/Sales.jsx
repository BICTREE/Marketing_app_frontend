import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/api/axios';
import { DollarSign, Plus, Loader2, Calendar, ShoppingBag, Weight, Filter, TrendingUp, BarChart3, Target } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import useAuth from '@/hooks/useAuth';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const saleSchema = z.object({
  phone: z.string().min(10, 'Valid phone number is required'),
  customer_name: z.string().optional(),
  segment: z.string().min(1, 'Segment is required'),
  product_name: z.string().min(2, 'Product name is required'),
  weight_grams: z.string().min(1, 'Weight is required'),
  notes: z.string().optional(),
  staff: z.string().optional(),
  sale_type: z.enum(['normal', 'advance']).default('normal')
});

const SalesPage = () => {
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const canViewAllSales = hasPermission('sales:view'); // Simplified for this demo
  const canViewStaff = hasPermission('staff:view');
  const canViewBranches = hasPermission('branches:view');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [matchedLead, setMatchedLead] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);

  const checkPhone = async (phone) => {
    if (!phone || phone.length < 10) {
      setMatchedLead(null);
      return;
    }
    setIsPhoneSearching(true);
    try {
      const normalizedPhone = phone.replace(/\s+/g, '').replace(/\+/g, '').replace(/^91/, '');
      const response = await api.get(`/leads/customers/by-phone/${normalizedPhone}/`);
      if (response.data && response.data.exists !== false) {
        setMatchedLead(response.data);
        setValue('customer_name', response.data.name);
      } else {
        setMatchedLead(null);
      }
    } catch (error) {
      setMatchedLead(null);
    } finally {
      setIsPhoneSearching(false);
    }
  };

  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('add') === 'true') {
      setIsDialogOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    })
  });

  // Fetch Leads for dropdown
  const { data: leadsData } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.get('/leads/leads/').then(res => res.data.results || res.data)
  });

  // Fetch Staff for assignment
  const { data: staffData } = useQuery({
    queryKey: ['staff', selectedBranch],
    queryFn: () => {
      let url = '/accounts/staff/';
      if (selectedBranch !== 'all') {
         url += `?branch=${selectedBranch}`;
      }
      return api.get(url).then(res => res.data.results || res.data);
    },
    enabled: canViewStaff
  });

  // Fetch Segments (usually from the first branch or a specific context)
  const { data: segmentsData } = useQuery({
    queryKey: ['segments'],
    queryFn: () => api.get('/branches/segments/').then(res => res.data.results || res.data)
  });

  // Fetch Sales Records
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.get('/sales/sales/').then(res => res.data.results || res.data)
  });

  // Filter sales by branch
  const filteredSales = React.useMemo(() => {
    if (!salesData || selectedBranch === 'all') return salesData || [];
    return salesData.filter(sale => {
      if (!sale.branch) return false;
      const branchId = typeof sale.branch === 'object' ? sale.branch.id : sale.branch;
      // Handle both string and number comparison
      return String(branchId) === String(selectedBranch);
    });
  }, [salesData, selectedBranch]);

  // Chart data
  const salesBySegmentData = React.useMemo(() => {
    if (!filteredSales || filteredSales.length === 0) return [];
    
    const segmentSales = {};
    filteredSales.forEach(sale => {
      const segment = sale.segment_name || 'General';
      if (!segmentSales[segment]) {
        segmentSales[segment] = { name: segment, weight: 0, count: 0, advanceCount: 0, normalCount: 0 };
      }
      segmentSales[segment].weight += parseFloat(sale.weight_grams || 0);
      segmentSales[segment].count += 1;
      if (sale.sale_type === 'advance') segmentSales[segment].advanceCount += 1;
      else segmentSales[segment].normalCount += 1;
    });
    
    return Object.values(segmentSales);
  }, [filteredSales]);

  const salesTrendData = React.useMemo(() => {
    if (!filteredSales || filteredSales.length === 0) return [];
    
    const salesByDate = {};
    filteredSales.forEach(sale => {
      const date = new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!salesByDate[date]) {
        salesByDate[date] = { date, weight: 0, count: 0, advanceWeight: 0, normalWeight: 0 };
      }
      const weight = parseFloat(sale.weight_grams || 0);
      salesByDate[date].weight += weight;
      salesByDate[date].count += 1;
      if (sale.sale_type === 'advance') salesByDate[date].advanceWeight += weight;
      else salesByDate[date].normalWeight += weight;
    });
    
    return Object.values(salesByDate).slice(-7);
  }, [filteredSales]);

  const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#B03A2E', '#6B7280', '#EF4444'];

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(saleSchema)
  });

  const createMutation = useMutation({
    mutationFn: (newSale) => api.post('/sales/sales/', newSale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      setIsDialogOpen(false);
      reset();
    }
  });

  const handleRowClick = (sale) => {
    setSelectedSale(sale);
    setIsDetailsOpen(true);
  };

  const onSubmit = async (data) => {
    let leadId = null;
    
    // Check if matchedLead exists
    if (matchedLead) {
      leadId = matchedLead.id;
    } else {
      if (!data.customer_name) {
        toast.error("Customer name is required for new customers");
        return;
      }
      try {
        const res = await api.post('/leads/leads/', {
          phone: data.phone,
          name: data.customer_name,
          source: 'walkin',
          branch: selectedBranch !== 'all' ? selectedBranch : branchesData?.[0]?.id,
        });
        leadId = res.data.id;
        toast.success("New customer profile created!");
      } catch (err) {
        toast.error("Failed to create new customer profile");
        return;
      }
    }

    const saleData = {
      lead: leadId,
      segment: data.segment,
      sale_type: data.sale_type,
      product_name: data.product_name,
      weight_grams: data.weight_grams,
      notes: data.notes
    };
    if (data.staff) {
      saleData.staff = data.staff;
    }
    
    createMutation.mutate(saleData);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Weight className="text-primary" /> Sales Records
        </h1>
        <div className="flex flex-wrap gap-2">
          {canViewBranches && (
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
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus size={16} /> Record Sale
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>Record New Sale</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Customer Phone Number</Label>
                  <Input 
                    id="phone" 
                    placeholder="Enter 10-digit phone number"
                    {...register('phone')}
                    onChange={(e) => {
                      const val = e.target.value;
                      setValue('phone', val); // Sync with react-hook-form
                      setPhoneNumber(val);
                      if (val.length >= 10) {
                        checkPhone(val);
                      } else {
                        setMatchedLead(null);
                        setValue('customer_name', '');
                      }
                    }}
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                  
                  {phoneNumber.length >= 10 && (
                    <div className="mt-3 space-y-2 animate-in fade-in duration-300">
                      {isPhoneSearching ? (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground bg-gray-50 rounded-xl border border-gray-100 mb-2">
                          <Loader2 className="animate-spin h-4 w-4 text-primary" />
                          <span>Searching Marketing customer database...</span>
                        </div>
                      ) : matchedLead ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100 mb-2 animate-in slide-in-from-top-1 duration-200">
                          <div className="w-10 h-10 rounded-xl bg-[#0F6E56] text-white flex items-center justify-center font-bold">
                            {matchedLead.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{matchedLead.name}</p>
                            <p className="text-xs text-gray-600">{matchedLead.phone}</p>
                            <p className="text-[10px] text-green-600 font-bold mt-0.5">✓ Existing Customer Linked</p>
                          </div>
                        </div>
                      ) : (
                        <div className="border-l-2 border-primary pl-3 space-y-2 animate-in slide-in-from-top-1 duration-200">
                          <Label htmlFor="customer_name" className="text-primary flex items-center justify-between">
                            <span>New Customer Name</span>
                            <span className="text-[11px] text-[#C9972A] font-bold">
                              New Customer profile will be created
                            </span>
                          </Label>
                          <Input 
                            id="customer_name" 
                            placeholder="Enter customer name" 
                            {...register('customer_name')}
                          />
                          {errors.customer_name && <p className="text-sm text-destructive">{errors.customer_name.message}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sale_type">Sale Type</Label>
                  <Select onValueChange={(value) => setValue('sale_type', value)} defaultValue="normal">
                    <SelectTrigger id="sale_type">
                      <SelectValue placeholder="Select sale type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal Sale</SelectItem>
                      <SelectItem value="advance">Advance Booking</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.sale_type && <p className="text-sm text-destructive">{errors.sale_type.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="segment">Segment</Label>
                  <Select onValueChange={(value) => setValue('segment', value)}>
                    <SelectTrigger id="segment">
                      <SelectValue placeholder="Select segment..." />
                    </SelectTrigger>
                    <SelectContent>
                      {segmentsData?.map(seg => (
                        <SelectItem key={seg.id} value={seg.id.toString()}>{seg.name_display}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.segment && <p className="text-sm text-destructive">{errors.segment.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_name">Product Name</Label>
                  <Input id="product_name" {...register('product_name')} placeholder="Gold Necklace Set" />
                  {errors.product_name && <p className="text-sm text-destructive">{errors.product_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight_grams">Weight (g)</Label>
                  <Input id="weight_grams" type="number" step="0.001" {...register('weight_grams')} placeholder="12.5" />
                  {errors.weight_grams && <p className="text-sm text-destructive">{errors.weight_grams.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" {...register('notes')} placeholder="Bridal collection sale" />
                </div>

                {canViewStaff && (
                  <div className="space-y-2">
                    <Label htmlFor="staff">Converted By (Staff)</Label>
                    <Select onValueChange={(value) => setValue('staff', value)}>
                      <SelectTrigger id="staff">
                        <SelectValue placeholder="Select staff member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffData?.map(staff => (
                          <SelectItem key={staff.id} value={staff.id.toString()}>
                            {staff.full_name} ({staff.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button type="submit" className="w-full mt-4" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                  Record Sale
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-[#C9972A] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gold Sold</CardTitle>
            <Weight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredSales.reduce((acc, s) => acc + parseFloat(s.weight_grams || 0), 0).toFixed(1)} g
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#0F6E56] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales Closed</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSales.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#8B5CF6] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Advance Bookings</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSales.filter(s => s.sale_type === 'advance').length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#1A5490] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Sale Weight</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredSales.length > 0 ? (filteredSales.reduce((acc, s) => acc + parseFloat(s.weight_grams || 0), 0) / filteredSales.length).toFixed(2) : 0} g
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Sales by Segment</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {salesBySegmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={salesBySegmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="weight" orientation="left" stroke="#C9972A" />
                  <YAxis yAxisId="count" orientation="right" stroke="#1A5490" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'weight' ? `${value.toFixed(2)} g` : value,
                      name === 'weight' ? 'Gold Weight' : name === 'normalCount' ? 'Normal Sales' : 'Advance Bookings'
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="weight" dataKey="weight" fill="#C9972A" name="Gold Weight" />
                  <Bar yAxisId="count" dataKey="normalCount" stackId="a" fill="#1A5490" name="Normal Sales" />
                  <Bar yAxisId="count" dataKey="advanceCount" stackId="a" fill="#8B5CF6" name="Advance Bookings" />
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
            <CardTitle>Sales Volume Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {salesTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis orientation="left" stroke="#C9972A" />
                  <Tooltip 
                    formatter={(value, name) => [
                      `${value.toFixed(2)} g`,
                      name === 'normalWeight' ? 'Normal Sale Volume' : 'Advance Booking Volume'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="normalWeight" stackId="a" fill="#0F6E56" name="Normal Sale Volume" />
                  <Bar dataKey="advanceWeight" stackId="a" fill="#8B5CF6" name="Advance Booking Volume" />
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

      <Card className="overflow-hidden">
        <CardHeader className="bg-card">
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Product</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead className="hidden md:table-cell">Staff</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <Loader2 className="animate-spin inline-block mr-2" /> Loading sales...
                    </TableCell>
                  </TableRow>
                ) : filteredSales?.length > 0 ? (
                  filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(sale)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ShoppingBag size={14} className="text-primary" />
                          {sale.product_name || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-[#C9972A] whitespace-nowrap">
                        {sale.weight_grams ? `${sale.weight_grams} g` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className={`px-2 py-0.5 rounded-full w-fit text-xs font-bold ${sale.sale_type === 'advance' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                          {sale.sale_type === 'advance' ? 'Advance' : 'Normal'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full w-fit text-xs">
                          {sale.segment_name || 'General'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {sale.recorded_by_name || `ID: ${sale.staff || sale.recorded_by}`}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Calendar size={14} />
                          {format(new Date(sale.created_at), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No sales records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[425px]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4 pt-4">
              <div className="flex justify-between pb-2 border-b">
                <span className="font-semibold text-muted-foreground">Product</span>
                <span>{selectedSale.product_name}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="font-semibold text-muted-foreground">Weight</span>
                <span className="font-bold text-[#C9972A]">{selectedSale.weight_grams ? `${selectedSale.weight_grams} g` : 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="font-semibold text-muted-foreground">Type</span>
                <span className={`font-bold ${selectedSale.sale_type === 'advance' ? 'text-purple-600' : 'text-green-600'}`}>
                  {selectedSale.sale_type === 'advance' ? 'Advance Booking' : 'Normal Sale'}
                </span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="font-semibold text-muted-foreground">Customer / Lead</span>
                <span>{selectedSale.lead_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="font-semibold text-muted-foreground">Segment</span>
                <span>{selectedSale.segment_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="font-semibold text-muted-foreground">Converted By</span>
                <span>{selectedSale.staff_name || selectedSale.staff || 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="font-semibold text-muted-foreground">Branch</span>
                <span>{selectedSale.branch_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="font-semibold text-muted-foreground">Date</span>
                <span>{format(new Date(selectedSale.created_at), 'MMM dd, yyyy HH:mm')}</span>
              </div>
              {selectedSale.notes && (
                <div className="pt-2">
                  <span className="font-semibold text-muted-foreground block mb-1">Notes</span>
                  <p className="text-sm bg-muted/30 p-2 rounded-md">{selectedSale.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesPage;
