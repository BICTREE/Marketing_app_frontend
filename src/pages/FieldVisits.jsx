import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import useAuth from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, FileCheck, Loader2, X, Clock, User, Phone, Mail, Filter, TrendingUp, CheckCircle, BarChart3, Map, Plus } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

const MapRecenter = ({ center, zoom = 14 }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
};

const FieldVisitsPage = () => {
  const { user, hasPermission } = useAuth();
  const canManageVisits = hasPermission('field_visits:manage');
  const canViewLiveTracking = canManageVisits || user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager' || user?.is_superuser;
  const queryClient = useQueryClient();
  const [locationError, setLocationError] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [selectedTrackedStaff, setSelectedTrackedStaff] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ lead: '', staff: '', notes: '', scheduled_date: '' });
  const [userLocation, setUserLocation] = useState(null);

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    })
  });
  
  const { data: visitsData, isLoading } = useQuery({
    queryKey: ['fieldvisits', selectedBranch, selectedStaff, statusFilter],
    queryFn: () => {
      if (canManageVisits) {
        const params = new URLSearchParams();
        if (selectedBranch !== 'all') params.set('branch', selectedBranch);
        if (selectedStaff !== 'all') params.set('staff', selectedStaff);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        const qs = params.toString();
        return api.get(`/field-visits/field-visits/${qs ? '?' + qs : ''}`).then(res => res.data.results || res.data);
      } else {
        return api.get(`/field-visits/field-visits/?staff=${user?.id}`).then(res => res.data.results || res.data);
      }
    }
  });


  const filteredVisits = visitsData || [];

  // Chart data
  const statusDistributionData = React.useMemo(() => {
    if (!filteredVisits || filteredVisits.length === 0) return [];
    
    const statusCounts = {};
    filteredVisits.forEach(visit => {
      const status = visit.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace('_', ' ').toUpperCase(),
      value: count
    }));
  }, [filteredVisits]);

  const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#B03A2E', '#6B7280', '#EF4444'];

  // Live tracking data for map (owner/admin/manager)
  const { data: liveTrackingData } = useQuery({
    queryKey: ['live-tracking'],
    queryFn: () => api.get('/field-visits/live-tracking/').then(res => res.data.locations || []),
    refetchInterval: 8000,
    enabled: !!canViewLiveTracking
  });

  // Fetch Staff Location Trail for Selected Staff Member (Full Daily Roadmap)
  const { data: staffLocationTrail } = useQuery({
    queryKey: ['location-trail', selectedTrackedStaff],
    queryFn: () => {
      if (selectedTrackedStaff === 'all') return Promise.resolve([]);
      return api.get(`/field-visits/location-tracking/?user=${selectedTrackedStaff}`).then(res => {
        const list = res.data.results || res.data;
        return Array.isArray(list) ? list : [];
      });
    },
    enabled: selectedTrackedStaff !== 'all'
  });

  const checkInMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/field-visits/field-visits/${id}/check-in/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldvisits'] });
      toast.success('GPS Check-in recorded!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to check in');
    }
  });

  // Fetch Leads for assignment
  const { data: leadsData } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.get('/leads/leads/').then(res => res.data.results || res.data),
    enabled: !!canManageVisits
  });

  // Fetch Staff for assignment
  const { data: staffData } = useQuery({
    queryKey: ['staff', selectedBranch],
    queryFn: () => {
      let url = '/accounts/staff/';
      if (selectedBranch !== 'all') url += `?branch=${selectedBranch}`;
      return api.get(url).then(res => res.data.results || res.data);
    },
    enabled: !!canManageVisits
  });

  const createVisitMutation = useMutation({
    mutationFn: (data) => api.post('/field-visits/field-visits/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldvisits'] });
      toast.success('Field visit assigned successfully!');
      setShowAssignModal(false);
      setAssignForm({ lead: '', staff: '', notes: '', scheduled_date: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to assign visit');
    }
  });

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!assignForm.lead || !assignForm.staff) {
      toast.error('Please select both a lead and a staff member');
      return;
    }
    const payload = { lead: assignForm.lead, staff: assignForm.staff, notes: assignForm.notes };
    if (assignForm.scheduled_date) payload.scheduled_date = assignForm.scheduled_date;
    createVisitMutation.mutate(payload);
  };

  useEffect(() => {
    if (!canManageVisits && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          
          // If there's an active visit, update live tracking
          const activeVisit = filteredVisits.find(v => v.status === 'active' && v.start_lat);
          if (activeVisit) {
            api.post('/field-visits/location-tracking/', {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              field_visit: activeVisit.id
            }).catch(err => console.error('Tracking error:', err));
          }
        },
        (error) => console.error('Location error:', error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [canManageVisits, filteredVisits]);

  const updateLeadLocationMutation = useMutation({
    mutationFn: ({ id, lat, lng }) => api.patch(`/leads/leads/${id}/`, { lat, lng }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fieldvisits'] });
      toast.success('Customer location saved successfully!');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to save location');
    }
  });

  const handleSaveCustomerLocation = (leadId) => {
    if (!userLocation) {
      toast.error('Unable to get your current location');
      return;
    }
    updateLeadLocationMutation.mutate({ 
      id: leadId, 
      lat: userLocation.lat, 
      lng: userLocation.lng 
    });
  };

  const handleGPSCheckIn = (visitId) => {
    setLocationError(null);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        checkInMutation.mutate({
          id: visitId,
          data: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        });
      },
      (error) => {
        toast.error('Unable to retrieve location');
      }
    );
  };

  const handleViewDetails = (visit) => {
    setSelectedVisit(visit);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedVisit(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Field Visits
        </h1>
        <div className="flex flex-wrap gap-2">
          {canManageVisits && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Branch Filter */}
              <div className="flex items-center gap-1">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select 
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="all">All Branches</option>
                  {branchesData?.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>

              {/* Staff Filter */}
              <select 
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="all">All Staff</option>
                {staffData?.filter(s => s.role === 'field_staff' || s.role === 'staff').map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Upcoming / Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
          <div className="flex gap-2">
            {canManageVisits ? (
              <Button className="bg-[#0F6E56] hover:bg-[#094d3c]" onClick={() => {
                setAssignForm({ lead: '', staff: '', notes: '', scheduled_date: '' });
                setShowAssignModal(true);
              }}>
                <Plus size={16} className="mr-2" /> Assign Visit
              </Button>
            ) : (
              <Button className="bg-[#0F6E56] hover:bg-[#094d3c]" onClick={() => {
                setAssignForm({ lead: '', staff: user?.id, notes: '', scheduled_date: '' });
                setShowAssignModal(true);
              }}>
                <Plus size={16} className="mr-2" /> Start New Visit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {canManageVisits && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-[#C9972A] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Visits</CardTitle>
              <Navigation className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredVisits.length}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#0F6E56] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredVisits.filter(v => v.status === 'completed').length}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#1A5490] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredVisits.filter(v => v.status === 'active' && v.start_lat).length}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#B03A2E] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Duration</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredVisits.filter(v => v.duration_minutes).length > 0 
                  ? (filteredVisits.reduce((acc, v) => acc + (v.duration_minutes || 0), 0) / filteredVisits.filter(v => v.duration_minutes).length).toFixed(0) 
                  : 0}m
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {canManageVisits && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Visit Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {statusDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={statusDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusDistributionData.map((entry, index) => (
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
              <CardTitle>Visits by Status</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {statusDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <BarChart data={statusDistributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#C9972A" name="Count" />
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
      )}

      {/* Live Tracking Map & Daily Field Staff Roadmap — Visible to Admins, Owners & Permitted Managers */}
      {canViewLiveTracking && (
        <Card className="shadow-sm overflow-hidden border-border/60">
          <CardHeader className="bg-muted/20 border-b border-border/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Map size={20} className="text-primary" />
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Live Field GPS Tracking & Staff Travel Roadmap
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Real-time movement points, waypoints, and polyline travel route history.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Staff Roadmap Route Selector */}
              <div className="flex items-center gap-1 bg-background px-2.5 py-1 rounded-lg border border-border">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">🗺️ Staff Roadmap:</span>
                <select
                  value={selectedTrackedStaff}
                  onChange={(e) => setSelectedTrackedStaff(e.target.value)}
                  className="text-xs font-bold bg-transparent outline-none cursor-pointer"
                >
                  <option value="all">📍 All Active Field Staff ({liveTrackingData?.length || 0})</option>
                  {liveTrackingData?.map(loc => (
                    <option key={loc.staff_id} value={loc.staff_id}>
                      🟢 {loc.staff_name} ({loc.lead_name ? `Visiting ${loc.lead_name}` : 'On Field'})
                    </option>
                  ))}
                  {staffData?.map(s => (
                    <option key={s.id} value={s.id}>
                      👤 {s.full_name} ({s.role_display || s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                {liveTrackingData?.length || 0} Staff Live
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[440px] w-full relative z-0">
              <MapContainer
                center={
                  selectedTrackedStaff !== 'all' && staffLocationTrail?.length > 0
                    ? [parseFloat(staffLocationTrail[staffLocationTrail.length - 1].latitude), parseFloat(staffLocationTrail[staffLocationTrail.length - 1].longitude)]
                    : liveTrackingData?.[0]
                    ? [liveTrackingData[0].latitude, liveTrackingData[0].longitude]
                    : [8.5241, 76.9366]
                }
                zoom={14}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapRecenter 
                  center={
                    selectedTrackedStaff !== 'all' && staffLocationTrail?.length > 0
                      ? [parseFloat(staffLocationTrail[staffLocationTrail.length - 1].latitude), parseFloat(staffLocationTrail[staffLocationTrail.length - 1].longitude)]
                      : liveTrackingData?.[0]
                      ? [liveTrackingData[0].latitude, liveTrackingData[0].longitude]
                      : null
                  } 
                />

                {/* ── 1. SELECTED STAFF DAILY ROADMAP POLYLINE TRAIL ─────────────────────── */}
                {selectedTrackedStaff !== 'all' && staffLocationTrail?.length > 0 && (
                  <React.Fragment>
                    {/* Glowing Polyline Route Path */}
                    <Polyline 
                      positions={staffLocationTrail.map(pt => [parseFloat(pt.latitude), parseFloat(pt.longitude)])}
                      color="#10B981"
                      weight={6}
                      opacity={0.8}
                    />
                    <Polyline 
                      positions={staffLocationTrail.map(pt => [parseFloat(pt.latitude), parseFloat(pt.longitude)])}
                      color="#ffffff"
                      weight={2}
                      dashArray="5, 10"
                      opacity={0.9}
                    />

                    {/* Start Location Pin */}
                    {staffLocationTrail[0] && (
                      <Marker
                        position={[parseFloat(staffLocationTrail[0].latitude), parseFloat(staffLocationTrail[0].longitude)]}
                        icon={L.divIcon({
                          className: 'custom-start-marker',
                          html: `<div style="background:#10B981;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🏁 Start</div>`,
                          iconSize: [50, 24],
                          iconAnchor: [25, 24]
                        })}
                      >
                        <Popup>
                          <div className="text-xs">
                            <p className="font-bold text-emerald-800">🏁 Field Shift Start Point</p>
                            <p className="text-muted-foreground">{new Date(staffLocationTrail[0].timestamp).toLocaleTimeString()}</p>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Intermediate Waypoint Pings */}
                    {staffLocationTrail.slice(1, -1).map((pt, idx) => (
                      <Marker
                        key={`trail-pt-${pt.id || idx}`}
                        position={[parseFloat(pt.latitude), parseFloat(pt.longitude)]}
                        icon={L.divIcon({
                          className: 'custom-waypoint-marker',
                          html: `<div style="width:10px;height:10px;background:#3B82F6;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
                          iconSize: [10, 10],
                          iconAnchor: [5, 5]
                        })}
                      >
                        <Popup>
                          <div className="text-xs">
                            <p className="font-bold">📍 Waypoint #{idx + 1}</p>
                            <p className="text-muted-foreground">{new Date(pt.timestamp).toLocaleTimeString()}</p>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </React.Fragment>
                )}

                {/* ── 2. LIVE FIELD STAFF MAP PINS ────────────────────────────────────── */}
                {liveTrackingData?.map((loc, i) => {
                  const staffColors = ['#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#F59E0B', '#EC4899', '#06B6D4'];
                  const color = staffColors[i % staffColors.length];
                  const firstName = (loc.staff_name || 'Staff').split(' ')[0];
                  
                  return (
                    <Marker 
                      key={loc.staff_id || i} 
                      position={[loc.latitude, loc.longitude]}
                      icon={L.divIcon({
                        className: 'custom-staff-marker',
                        html: `
                          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
                            <div style="
                              background:${color};color:#fff;font-size:10px;font-weight:700;
                              padding:3px 8px;border-radius:12px;white-space:nowrap;
                              box-shadow:0 2px 8px rgba(0,0,0,0.3);letter-spacing:0.3px;
                              border:2px solid #fff;
                            ">${firstName}</div>
                            <div style="
                              width:14px;height:14px;background:${color};border-radius:50%;
                              border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);
                              margin-top:2px;
                            "></div>
                          </div>
                        `,
                        iconSize: [80, 50],
                        iconAnchor: [40, 50],
                        popupAnchor: [0, -50]
                      })}
                    >
                      <Popup>
                        <div className="text-sm min-w-[200px] space-y-1">
                          <div className="flex items-center gap-2 border-b pb-1.5 mb-1">
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>
                              {(loc.staff_name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-xs leading-none">{loc.staff_name}</p>
                              <span className="text-[10px] text-emerald-700 font-semibold">🟢 Active Field Staff</span>
                            </div>
                          </div>
                          {loc.lead_name && <p className="text-xs font-semibold">📍 Visiting Lead: {loc.lead_name}</p>}
                          <p className="text-[11px] text-muted-foreground">
                            🕐 Last Location Ping: {new Date(loc.timestamp).toLocaleTimeString()}
                          </p>
                          {loc.accuracy && <p className="text-[10px] text-muted-foreground">GPS Accuracy: ±{Math.round(loc.accuracy)}m</p>}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Visits List */}
      <div className="space-y-6">
        {/* Upcoming / Scheduled Visits - Priority for Staff */}
        {!canManageVisits && filteredVisits.filter(v => v.status === 'active' && !v.start_lat).length > 0 && (
          <Card className="shadow-sm border-l-4 border-l-[#C9972A]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#C9972A]" /> My Upcoming Field Visits
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {filteredVisits.filter(v => v.status === 'active' && !v.start_lat).length} visit(s) scheduled for you
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVisits.filter(v => v.status === 'active' && !v.start_lat).map(visit => (
                  <div key={visit.id} className="p-4 rounded-xl border bg-muted/20 flex flex-col justify-between hover:border-primary/30 transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID: #{visit.id}</span>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 uppercase text-[9px]">Scheduled</Badge>
                      </div>
                      <p className="font-bold text-foreground truncate">{visit.lead_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin size={12} /> {visit.branch_name}
                      </p>
                      {visit.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">📝 {visit.notes}</p>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" className="flex-1 bg-[#0F6E56] hover:bg-[#094d3c]" onClick={() => handleGPSCheckIn(visit.id)}>
                        <Navigation size={14} className="mr-2" /> Start Visit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleViewDetails(visit)}>
                        <TrendingUp size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manager/Admin view: Upcoming visits summary */}
        {canManageVisits && filteredVisits.filter(v => v.status === 'active' && !v.start_lat).length > 0 && (
          <Card className="shadow-sm border-l-4 border-l-amber-400">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" /> Upcoming Scheduled Visits
                <Badge className="bg-amber-100 text-amber-700 border-0 ml-1">
                  {filteredVisits.filter(v => v.status === 'active' && !v.start_lat).length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredVisits.filter(v => v.status === 'active' && !v.start_lat).map(visit => (
                  <div key={visit.id} className="p-4 rounded-xl border bg-amber-50/30 hover:bg-amber-50/60 transition-all cursor-pointer" onClick={() => handleViewDetails(visit)}>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-amber-700">{visit.lead_name}</span>
                      <Badge variant="outline" className="bg-white text-amber-600 border-amber-200 text-[9px] uppercase">Pending</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User size={11} /> {visit.staff_name || 'Unassigned'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <MapPin size={11} /> {visit.branch_name}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Log */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>{canManageVisits ? 'All Field Visits' : 'My Visit History'}</CardTitle>
            {!canManageVisits && (
               <Badge variant="outline" className="text-[10px]">{filteredVisits.length} Records</Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-20">ID</TableHead>
                        {canManageVisits && <TableHead>Staff Name</TableHead>}
                        <TableHead>Lead / Customer</TableHead>
                        <TableHead>Time Info</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(filteredVisits) && filteredVisits.length > 0 ? filteredVisits.map((visit) => (
                        <TableRow key={visit.id} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs">#{visit.id}</TableCell>
                          {canManageVisits && (
                            <TableCell className="font-medium">{visit.staff_name || 'Unknown'}</TableCell>
                          )}
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold">{visit.lead_name || 'Customer'}</span>
                              <span className="text-[10px] text-muted-foreground">{visit.branch_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-xs flex items-center gap-1">
                                <Clock size={10} /> {safeFormat(visit.started_at, 'MMM dd, HH:mm', 'Not started')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              visit.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                              (visit.status === 'active' && visit.start_lat) ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                              (visit.status === 'active' && !visit.start_lat) ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                              {visit.status === 'active' ? (visit.start_lat ? 'IN PROGRESS' : 'SCHEDULED') : visit.status?.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {(!canManageVisits && visit.status === 'active' && visit.start_lat) ? (
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 border-primary text-primary hover:bg-primary/5"
                                  onClick={() => handleSaveCustomerLocation(visit.lead)}
                                  disabled={updateLeadLocationMutation.isPending}
                                >
                                  <MapPin size={14} className="mr-1" /> Pin Location
                                </Button>
                                <Button 
                                  size="sm" 
                                  className="h-8 bg-[#0F6E56] hover:bg-[#094d3c]"
                                  onClick={() => handleViewDetails(visit)}
                                >
                                  <FileCheck size={14} className="mr-1" /> Finish
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-8" onClick={() => handleViewDetails(visit)}>
                                Details
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={canManageVisits ? 6 : 5} className="text-center py-12 text-muted-foreground italic">
                            No field visits recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View - Cards */}
                <div className="md:hidden space-y-4">
                  {Array.isArray(filteredVisits) && filteredVisits.length > 0 ? filteredVisits.map((visit) => (
                    <div key={visit.id} className="p-4 rounded-xl border border-border bg-card shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-muted-foreground">VISIT #{visit.id}</span>
                          <span className="font-bold text-foreground text-base">{visit.lead_name}</span>
                        </div>
                        <Badge variant="outline" className={`text-[9px] uppercase font-bold ${
                          visit.status === 'completed' ? 'text-green-700 bg-green-50' :
                          (visit.status === 'active' && visit.start_lat) ? 'text-blue-700 bg-blue-50' :
                          (visit.status === 'active' && !visit.start_lat) ? 'text-amber-700 bg-amber-50' :
                          'text-gray-700 bg-gray-50'
                        }`}>
                          {visit.status === 'active' ? (visit.start_lat ? 'IN PROGRESS' : 'SCHEDULED') : visit.status?.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock size={14} /> 
                          {safeFormat(visit.started_at, 'MMM dd, hh:mm a', 'Not Started')}
                        </div>
                        {canManageVisits && (
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <User size={14} /> {visit.staff_name}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-dashed flex gap-2">
                        {(!canManageVisits && visit.status === 'active' && visit.start_lat) ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1 h-9 text-xs"
                              onClick={() => handleSaveCustomerLocation(visit.lead)}
                            >
                              <MapPin size={14} className="mr-1" /> Pin Location
                            </Button>
                            <Button 
                              size="sm" 
                              className="flex-1 h-9 text-xs bg-[#0F6E56]"
                              onClick={() => handleViewDetails(visit)}
                            >
                              <FileCheck size={14} className="mr-1" /> Finish
                            </Button>
                          </>
                        ) : (
                          <Button 
                            variant="ghost" 
                            className="w-full h-9 text-xs font-bold"
                            onClick={() => handleViewDetails(visit)}
                          >
                            View Visit Details
                          </Button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed border-border text-muted-foreground text-sm italic">
                      No field visits found.
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visit Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Visit Details</span>
              <Button variant="ghost" size="sm" onClick={handleCloseDetails}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedVisit && (
            <div className="space-y-6">
              {/* Visit Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Visit Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Visit ID:</span>
                      <span className="text-sm">#{selectedVisit.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge variant={selectedVisit.status === 'completed' ? 'default' : 'secondary'}>
                        {selectedVisit.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">
                        Started: {safeFormat(selectedVisit.started_at, 'MMM dd, yyyy HH:mm', 'Not started')}
                      </span>
                    </div>
                    {selectedVisit.ended_at && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">
                          Ended: {safeFormat(selectedVisit.ended_at, 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                    )}
                    {selectedVisit.duration_minutes && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">Duration: {selectedVisit.duration_minutes} minutes</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Staff Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="text-sm font-medium">Staff:</span>
                      <span className="text-sm">{selectedVisit.staff_name || 'Unknown'}</span>
                    </div>
                    {selectedVisit.staff_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">{selectedVisit.staff_phone}</span>
                      </div>
                    )}
                    {selectedVisit.staff_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="text-sm">{selectedVisit.staff_email}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lead Information */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Lead Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">Lead:</span>
                    <span className="text-sm">{selectedVisit.lead_name || `Lead #${selectedVisit.lead}`}</span>
                  </div>
                  {selectedVisit.lead_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span className="text-sm">{selectedVisit.lead_phone}</span>
                    </div>
                  )}
                  {selectedVisit.lead_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm">{selectedVisit.lead_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Location Information */}
              {(selectedVisit.start_lat && selectedVisit.start_lng) && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Location Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm font-medium">Start Location:</span>
                      <span className="text-sm">
                        {Number(selectedVisit.start_lat).toFixed(6)}, {Number(selectedVisit.start_lng).toFixed(6)}
                      </span>
                    </div>
                    {selectedVisit.end_lat && selectedVisit.end_lng && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm font-medium">End Location:</span>
                        <span className="text-sm">
                          {Number(selectedVisit.end_lat).toFixed(6)}, {Number(selectedVisit.end_lng).toFixed(6)}
                        </span>
                      </div>
                    )}
                    {selectedVisit.distance_km && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm font-medium">Distance:</span>
                        <span className="text-sm">{selectedVisit.distance_km} km</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Branch Information */}
              {selectedVisit.branch_name && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Branch Information</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Branch:</span>
                    <span className="text-sm">{selectedVisit.branch_name}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedVisit.notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-gray-600">{selectedVisit.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Assign Visit Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{canManageVisits ? 'Assign Field Visit' : 'Start New Field Visit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssignSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Lead</label>
              <select 
                className="w-full p-2 rounded-md border border-input bg-background"
                value={assignForm.lead}
                onChange={(e) => setAssignForm({ ...assignForm, lead: e.target.value })}
                required
              >
                <option value="">Choose a lead...</option>
                {leadsData?.map(lead => (
                  <option key={lead.id} value={lead.id}>{lead.name} ({lead.phone})</option>
                ))}
              </select>
            </div>
            
            {canManageVisits && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Assign Field Staff</label>
                <select 
                  className="w-full p-2 rounded-md border border-input bg-background"
                  value={assignForm.staff}
                  onChange={(e) => setAssignForm({ ...assignForm, staff: e.target.value })}
                  required
                >
                  <option value="">Choose field staff...</option>
                  {staffData?.filter(s => s.role === 'field_staff' || s.role === 'staff').map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.branch_name})</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">Only field staff roles are shown</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Scheduled Date (Optional)</label>
              <input
                type="datetime-local"
                className="w-full p-2 rounded-md border border-input bg-background text-sm"
                value={assignForm.scheduled_date}
                onChange={(e) => setAssignForm({ ...assignForm, scheduled_date: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-[10px] text-muted-foreground">When should the staff member visit?</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <textarea 
                className="w-full p-2 rounded-md border border-input bg-background min-h-[80px]"
                placeholder="Instructions for the staff member..."
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#0F6E56] hover:bg-[#094d3c]" 
              disabled={createVisitMutation.isPending || !assignForm.lead}
            >
              {createVisitMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : (canManageVisits ? <FileCheck size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />)}
              {canManageVisits ? 'Assign Field Visit' : 'Start Visit Now'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FieldVisitsPage;
