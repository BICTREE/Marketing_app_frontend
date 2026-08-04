import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import useAuth from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, Clock, LogIn, LogOut, Loader2, Calendar as CalendarIcon, Filter, TrendingUp, Users, CheckCircle, Activity, Info } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconRetinaUrl: iconRetina,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

const FitMapToBounds = ({ data }) => {
  const map = useMap();
  useEffect(() => {
    if (data && data.length > 0) {
      const markers = data.filter(d => d.check_in_lat && d.check_in_lng);
      if (markers.length > 0) {
        const bounds = L.latLngBounds(markers.map(m => [m.check_in_lat, m.check_in_lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [data, map]);
  return null;
};

const ChangeMapCenter = ({ branchLat, branchLng, userLat, userLng }) => {
  const map = useMap();
  useEffect(() => {
    const points = [];
    if (branchLat && branchLng) points.push([branchLat, branchLng]);
    if (userLat && userLng) points.push([userLat, userLng]);
    
    if (points.length === 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 17);
    }
  }, [branchLat, branchLng, userLat, userLng, map]);
  return null;
};

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

const AttendancePage = () => {
  const { user, hasPermission } = useAuth();
  const canManageAttendance = hasPermission('attendance:manage');
  const queryClient = useQueryClient();
  const [locationError, setLocationError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('all');

  // Track user location for geofencing UI
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [canManageAttendance]);

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    })
  });

  // For staff: fetch their specific branch details for geofencing
  const { data: myBranch } = useQuery({
    queryKey: ['my-branch', user?.branch],
    queryFn: () => api.get(`/branches/${user.branch}/`).then(res => res.data),
    enabled: !!user?.branch
  });
  
  // Search and Date filters for Managers
  const [searchName, setSearchName] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Shift Punch-out Timing settings state for Managers
  const [shiftCheckOutTime, setShiftCheckOutTime] = useState('19:00');
  const [shiftCheckInTime, setShiftCheckInTime] = useState('09:30');
  const [shiftGracePeriod, setShiftGracePeriod] = useState(15);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  // Fetch Attendance Schedule
  const { data: scheduleData } = useQuery({
    queryKey: ['attendance-schedules'],
    queryFn: () => api.get('/attendance/schedules/').then(res => {
      const list = res.data.results || res.data;
      if (Array.isArray(list) && list.length > 0) {
        setShiftCheckOutTime(list[0].check_out_time || '19:00');
        setShiftCheckInTime(list[0].check_in_time || '09:30');
        setShiftGracePeriod(list[0].grace_period_minutes || 15);
        return list[0];
      }
      return null;
    }),
    enabled: canManageAttendance
  });

  // Save / Update Schedule Mutation
  const saveScheduleMutation = useMutation({
    mutationFn: (data) => {
      if (scheduleData?.id) {
        return api.patch(`/attendance/schedules/${scheduleData.id}/`, data);
      }
      return api.post('/attendance/schedules/', {
        branch: user?.branch || 1,
        name: 'Default Shift',
        ...data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-schedules'] });
      setIsEditingSchedule(false);
      toast.success('Shift Punch-Out timing saved successfully!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to save shift timing');
    }
  });

  // 1. Fetch Management Data (for Owners/Managers)
  const { data: managementAttendance, isLoading: isManagementLoading } = useQuery({
    queryKey: ['attendance-management', selectedBranch, selectedDate, selectedStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.set('branch', selectedBranch);
      if (selectedDate) params.set('date', selectedDate);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      return api.get(`/attendance/attendance/?${params.toString()}`).then(res => res.data.results || res.data);
    },
    enabled: canManageAttendance
  });

  // Approve Attendance Mutation
  const approveMutation = useMutation({
    mutationFn: (id) => api.patch(`/attendance/attendance/${id}/approve/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-management'] });
      toast.success('Attendance record approved!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to approve attendance');
    }
  });

  // Reject Attendance Mutation
  const rejectMutation = useMutation({
    mutationFn: (id) => api.patch(`/attendance/attendance/${id}/reject/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-management'] });
      toast.success('Attendance record rejected!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to reject attendance');
    }
  });

  // Approve Overtime Mutation
  const approveOvertimeMutation = useMutation({
    mutationFn: (id) => api.patch(`/attendance/attendance/${id}/approve-overtime/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-management'] });
      toast.success('Shift Overtime approved!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to approve overtime');
    }
  });

  // Reject Overtime Mutation
  const rejectOvertimeMutation = useMutation({
    mutationFn: (id) => api.patch(`/attendance/attendance/${id}/reject-overtime/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-management'] });
      toast.success('Shift Overtime rejected!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to reject overtime');
    }
  });

  // Filter pending requests & overtime requests
  const pendingRequests = React.useMemo(() => {
    if (!managementAttendance || !Array.isArray(managementAttendance)) return [];
    return managementAttendance.filter(r => r.status === 'pending');
  }, [managementAttendance]);

  const pendingOvertimeRequests = React.useMemo(() => {
    if (!managementAttendance || !Array.isArray(managementAttendance)) return [];
    return managementAttendance.filter(r => r.overtime_requested && r.overtime_status === 'pending');
  }, [managementAttendance]);

  // 2. Fetch User's Today Record (for Punch-in UI - ALL users)
  const { data: todayRecord, isLoading: isTodayLoading } = useQuery({
    queryKey: ['attendance-today', user?.id],
    queryFn: () => api.get('/attendance/attendance/today/').then(res => res.data),
    staleTime: 60_000,
  });

  const filteredAttendance = canManageAttendance 
    ? (managementAttendance || []) 
    : (todayRecord?.id ? [todayRecord] : []);

  const statusDistributionData = React.useMemo(() => {
    const dataToProcess = canManageAttendance ? managementAttendance : (todayRecord ? [todayRecord] : []);
    if (!dataToProcess || dataToProcess.length === 0) return [];

    const statusCounts = {};
    dataToProcess.forEach(record => {
      const status = record.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      value: count
    }));
  }, [managementAttendance, todayRecord, canManageAttendance]);

  const COLORS = ['#C9972A', '#0F6E56', '#1A5490', '#B03A2E', '#6B7280', '#EF4444'];

  const checkInMutation = useMutation({
    mutationFn: (data) => api.post('/attendance/attendance/gps-checkin/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Successfully checked in!');
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Failed to check in';
      toast.error(msg, { duration: 5000 });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/attendance/checkout/'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Successfully checked out!');
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || error.response?.data?.error || 'Failed to check out';
      toast.error(msg, { duration: 5000 });
    }
  });

  const handleCheckIn = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        checkInMutation.mutate({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        setLocationError('Unable to retrieve your location. Please ensure location services are enabled.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handleCheckOut = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      checkOutMutation.mutate(); // Fallback if geo not supported
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        checkOutMutation.mutate({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        // Even if geo fails, allow checkout but without coordinates
        console.warn('Geo failed for checkout', error);
        checkOutMutation.mutate();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const hasCheckedIn = todayRecord?.checked_in;
  const hasCheckedOut = !!(todayRecord?.check_out_time);
  const isLoading = canManageAttendance ? isManagementLoading : isTodayLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Attendance
        </h1>
        {canManageAttendance && (
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
      </div>

      {/* Summary Cards */}
      {canManageAttendance && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-[#C9972A] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredAttendance.length}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#0F6E56] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredAttendance.filter(a => a.status === 'present').length}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#1A5490] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Late</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredAttendance.filter(a => a.status === 'late').length}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-[#B03A2E] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Absent</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredAttendance.filter(a => a.status === 'absent').length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {canManageAttendance && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Status Distribution</CardTitle>
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
              <CardTitle>Attendance by Status</CardTitle>
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

      {/* Staff Check-in/out section */}
      {/* Staff Check-in/out section - VISIBLE TO ALL */}
      <Card className="shadow-sm overflow-hidden border-primary/10">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-lg">Daily Attendance</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex flex-col items-center justify-center py-8 space-y-6 bg-muted/20 rounded-xl border border-border/50">
                <div className="text-center space-y-2">
                  <p className="text-xl font-bold text-foreground">
                    {format(new Date(), 'EEEE, MMM do')}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-primary font-medium">
                    <Clock size={18} />
                    <span className="text-lg">{format(new Date(), 'hh:mm a')}</span>
                  </div>
                </div>

                {locationError && (
                  <div className="text-sm text-destructive bg-destructive/5 border border-destructive/10 p-4 rounded-lg max-w-md text-center flex items-center gap-2 mx-4">
                    <Info size={16} className="shrink-0" />
                    {locationError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 w-full px-6 max-w-md">
                  <Button 
                    size="lg" 
                    onClick={handleCheckIn} 
                    disabled={hasCheckedIn || checkInMutation.isPending}
                    className={cn(
                      "flex-1 h-14 text-base font-bold transition-all shadow-md",
                      hasCheckedIn ? "bg-green-600 hover:bg-green-700 opacity-100" : "bg-[#C9972A] hover:bg-[#7A5500]"
                    )}
                  >
                    {checkInMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <LogIn className="mr-2" />}
                    {hasCheckedIn ? `In: ${format(new Date(todayRecord.check_in_time), 'hh:mm a')}` : 'Check In'}
                  </Button>
                  
                  {hasCheckedIn && (
                    <Button 
                      size="lg" 
                      variant="outline" 
                      onClick={handleCheckOut}
                      disabled={hasCheckedOut || checkOutMutation.isPending}
                      className={cn(
                        "flex-1 h-14 text-base font-bold transition-all border-2",
                        hasCheckedOut ? "border-primary/20 text-muted-foreground" : "border-primary text-primary hover:bg-primary/5"
                      )}
                    >
                      {checkOutMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <LogOut className="mr-2" />}
                      {hasCheckedOut ? `Out: ${format(new Date(todayRecord.check_out_time), 'hh:mm a')}` : 'Check Out'}
                    </Button>
                  )}
                </div>
                
                {hasCheckedIn && !hasCheckedOut && (
                  <p className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                    <Activity size={12} /> Status: Currently Active
                  </p>
                )}
              </div>

              {/* Geofence Map for Staff */}
              <div className="h-[300px] md:h-auto min-h-[300px] rounded-xl overflow-hidden border border-border/50 relative">
                {myBranch?.lat && myBranch?.lng ? (
                  <MapContainer center={[myBranch.lat, myBranch.lng]} zoom={17} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <ChangeMapCenter branchLat={myBranch.lat} branchLng={myBranch.lng} userLat={currentLocation?.lat} userLng={currentLocation?.lng} />
                    <Marker position={[myBranch.lat, myBranch.lng]}>
                      <Popup>Branch Location</Popup>
                    </Marker>
                    <Circle 
                      center={[myBranch.lat, myBranch.lng]} 
                      radius={100} 
                      pathOptions={{ fillColor: '#C9972A', color: '#C9972A', fillOpacity: 0.1 }} 
                    />
                    {currentLocation && (
                      <Marker position={[currentLocation.lat, currentLocation.lng]} icon={L.divIcon({
                        className: 'user-location-icon',
                        html: `<div style="background-color: #3B82F6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`
                      })}>
                        <Popup>My Current Location</Popup>
                      </Marker>
                    )}
                  </MapContainer>
                ) : (
                  <div className="flex items-center justify-center h-full bg-muted/20 text-muted-foreground text-sm flex-col gap-2 p-4 text-center">
                    <MapPin size={24} />
                    {user?.branch ? 'Loading branch location...' : 'No branch assigned to your profile.'}
                  </div>
                )}
                <div className="absolute top-2 right-2 z-[400] bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold border shadow-sm">
                  100m Geofence Active
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Live Tracking Map for Managers */}
      {canManageAttendance && (
        <Card className="shadow-sm overflow-hidden border-border/50">
          <CardHeader className="bg-muted/10 border-b border-border/50">
            <CardTitle className="flex items-center gap-2">
              <MapPin size={18} className="text-primary" /> Live Team Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[400px] w-full z-0 relative">
              <MapContainer 
                center={[
                  filteredAttendance.find(a => a.check_in_lat)?.check_in_lat || myBranch?.lat || 12.9716, 
                  filteredAttendance.find(a => a.check_in_lng)?.check_in_lng || myBranch?.lng || 77.5946
                ]} 
                zoom={11} 
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="Street Map (OSM)">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Satellite">
                    <TileLayer
                      attribution='Tiles &copy; Esri'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Topographic">
                    <TileLayer
                      attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
                      url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                    />
                  </LayersControl.BaseLayer>
                </LayersControl>
                <FitMapToBounds data={filteredAttendance} />
                
                {/* Show branch geofences */}
                {branchesData?.map(branch => branch.lat && branch.lng && (
                  <Circle 
                    key={`geofence-${branch.id}`}
                    center={[branch.lat, branch.lng]} 
                    radius={100} 
                    pathOptions={{ fillColor: '#C9972A', color: '#C9972A', fillOpacity: 0.05, dashArray: '5, 5' }} 
                  >
                    <Popup>{branch.name} - 100m Geofence</Popup>
                  </Circle>
                ))}

                {filteredAttendance.filter(record => record.check_in_lat && record.check_in_lng).map(record => (
                  <Marker 
                    key={record.id} 
                    position={[record.check_in_lat, record.check_in_lng]}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold border-b pb-1 mb-1">{record.user_name}</p>
                        <p className="flex items-center gap-1 text-xs"><Clock size={12} /> {format(new Date(record.check_in_time), 'hh:mm a')}</p>
                        <p className="text-xs mt-1 capitalize font-medium text-primary">{record.status?.replace('_', ' ') || 'Present'}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shift Timings & Punch-Out Configuration Card for Owners / Admins / Managers */}
      {canManageAttendance && (
        <Card className="shadow-sm border-blue-200 bg-blue-50/10">
          <CardHeader className="bg-blue-50/40 border-b border-blue-100 flex flex-row items-center justify-between py-3">
            <CardTitle className="text-blue-900 text-sm font-bold flex items-center gap-2">
              <Clock size={16} className="text-blue-600" /> Shift Punch-Out & Workday Timing Settings
            </CardTitle>
            <Button
              size="xs"
              variant={isEditingSchedule ? "outline" : "default"}
              onClick={() => setIsEditingSchedule(!isEditingSchedule)}
              className="text-xs h-7"
            >
              {isEditingSchedule ? 'Cancel' : '⚙️ Configure Shift Time'}
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            {isEditingSchedule ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Check-in Start Time</label>
                  <input
                    type="time"
                    value={shiftCheckInTime}
                    onChange={(e) => setShiftCheckInTime(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-md text-xs bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold font-amber-900 text-gray-700 mb-1">Mandatory Shift Punch-Out Time *</label>
                  <input
                    type="time"
                    value={shiftCheckOutTime}
                    onChange={(e) => setShiftCheckOutTime(e.target.value)}
                    className="w-full px-3 py-1.5 border border-amber-400 rounded-md text-xs font-bold bg-background text-amber-900"
                  />
                </div>

                <div>
                  <Button
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs"
                    onClick={() => saveScheduleMutation.mutate({
                      check_in_time: shiftCheckInTime,
                      check_out_time: shiftCheckOutTime,
                      grace_period_minutes: shiftGracePeriod
                    })}
                    disabled={saveScheduleMutation.isPending}
                  >
                    {saveScheduleMutation.isPending ? 'Saving...' : 'Save Shift Punch-Out Time'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground font-medium">Standard Shift Punch-Out Time: </span>
                  <span className="font-bold text-amber-800 text-sm">{shiftCheckOutTime || '19:00'}</span>
                  <span className="text-muted-foreground ml-2">(Staff will be prompted to Punch-Out or Request Overtime)</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium">Check-In Time: </span>
                  <span className="font-bold text-gray-800">{shiftCheckInTime || '09:30'}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Overtime Requests Queue for Managers */}
      {canManageAttendance && pendingOvertimeRequests.length > 0 && (
        <Card className="shadow-sm border-purple-300 bg-purple-50/20">
          <CardHeader className="bg-purple-100/50 border-b border-purple-200">
            <CardTitle className="text-purple-900 text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock size={18} className="text-purple-600" /> Pending Overtime / Shift Extension Requests ({pendingOvertimeRequests.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-purple-100/30">
                  <TableRow>
                    <TableHead className="font-bold text-purple-900">Staff Name</TableHead>
                    <TableHead className="font-bold text-purple-900">Branch & Date</TableHead>
                    <TableHead className="font-bold text-purple-900">Overtime Reason</TableHead>
                    <TableHead className="font-bold text-purple-900 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOvertimeRequests.map((record) => (
                    <TableRow key={`ot-${record.id}`} className="hover:bg-purple-50/50">
                      <TableCell className="font-bold text-gray-900">{record.user_name || 'Staff'}</TableCell>
                      <TableCell className="text-xs">
                        <p className="font-semibold">{record.branch_name || 'Main Branch'}</p>
                        <p className="text-muted-foreground">{record.date}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="font-medium text-purple-900">"{record.overtime_reason || 'Working extra shift hours'}"</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-purple-700 hover:bg-purple-800 text-white font-bold h-8 text-xs"
                            onClick={() => approveOvertimeMutation.mutate(record.id)}
                            disabled={approveOvertimeMutation.isPending}
                          >
                            Approve Overtime
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs font-bold"
                            onClick={() => rejectOvertimeMutation.mutate(record.id)}
                            disabled={rejectOvertimeMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Attendance Approvals Section for Managers */}
      {canManageAttendance && pendingRequests.length > 0 && (
        <Card className="shadow-sm border-amber-300 bg-amber-50/20">
          <CardHeader className="bg-amber-100/50 border-b border-amber-200">
            <CardTitle className="text-amber-900 text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Info size={18} className="text-amber-600" /> Pending Attendance Approvals ({pendingRequests.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-amber-100/30">
                  <TableRow>
                    <TableHead className="font-bold text-amber-900">Staff Name</TableHead>
                    <TableHead className="font-bold text-amber-900">Branch & Date</TableHead>
                    <TableHead className="font-bold text-amber-900">Check-in Method</TableHead>
                    <TableHead className="font-bold text-amber-900">Distance / Notes</TableHead>
                    <TableHead className="font-bold text-amber-900">Selfie Photo</TableHead>
                    <TableHead className="font-bold text-amber-900 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((record) => (
                    <TableRow key={`pending-${record.id}`} className="hover:bg-amber-50/50">
                      <TableCell className="font-bold text-gray-900">{record.user_name || 'Staff'}</TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">
                          <p>{record.branch_name || 'Main Branch'}</p>
                          <p className="text-muted-foreground">{record.date}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800">
                          {record.check_in_type === 'photo' ? '📸 Selfie Photo' : '📍 Remote GPS'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="font-bold text-amber-800">
                          {record.distance_from_branch ? `${Math.round(record.distance_from_branch)}m away` : 'Remote'}
                        </p>
                        {record.notes && <p className="text-muted-foreground italic truncate max-w-[200px]">"{record.notes}"</p>}
                      </TableCell>
                      <TableCell>
                        {record.photo ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto(record.photo)}
                            className="text-xs text-primary font-bold hover:underline flex items-center gap-1 bg-primary/10 px-2 py-1 rounded"
                          >
                            🖼️ View Selfie
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No photo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white font-bold h-8 text-xs"
                            onClick={() => approveMutation.mutate(record.id)}
                            disabled={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs font-bold"
                            onClick={() => rejectMutation.mutate(record.id)}
                            disabled={rejectMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Table */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle>{canManageAttendance ? 'Team Attendance Sheet & Audit Logs' : 'Attendance History'}</CardTitle>
          
          {/* Manager Filters */}
          {canManageAttendance && (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search staff name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="px-3 py-1.5 border rounded-md text-xs bg-background w-full sm:w-44"
              />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border rounded-md text-xs bg-background"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold"
                >
                  Clear Date
                </button>
              )}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 border rounded-md text-xs bg-background"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      {canManageAttendance ? <TableHead>Staff Name</TableHead> : null}
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Audit Log / Approval</TableHead>
                      {canManageAttendance ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(filteredAttendance) && filteredAttendance.length > 0 ? filteredAttendance.map((record, index) => (
                      <TableRow key={record.id || index} className="hover:bg-muted/30">
                      {canManageAttendance ? (
                          <TableCell className="font-semibold">{record.user_name || 'Staff'}</TableCell>
                        ) : null}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarIcon size={14} className="text-muted-foreground" />
                            {safeFormat(record.date, 'MMM dd, yyyy', record.date || '—')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            record.status === 'present'  ? 'bg-green-100 text-green-700 border border-green-200' :
                            record.status === 'late'     ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                            record.status === 'pending'  ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            record.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {record.status?.replace('_', ' ') || 'UNKNOWN'}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-gray-600">{safeFormat(record.check_in_time, 'hh:mm a')}</TableCell>
                        <TableCell className="font-medium text-gray-600">{safeFormat(record.check_out_time, 'hh:mm a')}</TableCell>
                        <TableCell className="text-xs">
                          {record.approved_by_name ? (
                            <span className="text-green-700 font-bold flex items-center gap-1">
                              <CheckCircle size={13} /> Approved by {record.approved_by_name}
                            </span>
                          ) : record.status === 'present' ? (
                            <span className="text-muted-foreground font-medium">⚡ Auto-approved (GPS)</span>
                          ) : record.status === 'pending' ? (
                            <span className="text-amber-700 font-bold">🟡 Pending Manager Review</span>
                          ) : (
                            <span className="text-red-600 font-medium">Rejected</span>
                          )}
                        </TableCell>
                        {canManageAttendance ? (
                          <TableCell className="text-right">
                            {record.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="xs"
                                  className="bg-green-600 hover:bg-green-700 text-white font-bold h-7 text-[11px] px-2"
                                  onClick={() => approveMutation.mutate(record.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="xs"
                                  variant="destructive"
                                  className="h-7 text-[11px] px-2 font-bold"
                                  onClick={() => rejectMutation.mutate(record.id)}
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : record.check_in_lat && record.check_in_lng ? (
                              <a 
                                href={`https://www.google.com/maps?q=${record.check_in_lat},${record.check_in_lng}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center justify-end gap-1 text-xs text-primary hover:underline font-medium"
                              >
                                <MapPin size={12} /> Map
                              </a>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={canManageAttendance ? 6 : 4} className="text-center py-12 text-muted-foreground italic">
                          No attendance records found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {Array.isArray(filteredAttendance) && filteredAttendance.length > 0 ? (
                  filteredAttendance.map((record, index) => (
                    <div key={record.id || index} className="p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          {canManageAttendance && <p className="font-bold text-foreground mb-1">{record.user_name}</p>}
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                            <CalendarIcon size={14} />
                            {safeFormat(record.date, 'MMM dd, yyyy')}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          record.status === 'present'  ? 'bg-green-100 text-green-700 border border-green-200' :
                          record.status === 'late'     ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                          {record.status?.replace('_', ' ') || 'UNKNOWN'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-dashed">
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Check In</p>
                          <div className="flex items-center gap-1.5 text-sm font-semibold">
                            <Clock size={14} className="text-green-600" />
                            {safeFormat(record.check_in_time, 'hh:mm a')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Check Out</p>
                          <div className="flex items-center gap-1.5 text-sm font-semibold">
                            <Clock size={14} className="text-amber-600" />
                            {safeFormat(record.check_out_time, 'hh:mm a')}
                          </div>
                        </div>
                      </div>

                      {canManageAttendance && record.check_in_lat && (
                        <div className="mt-4 pt-3 border-t border-dashed">
                          <a 
                            href={`https://www.google.com/maps?q=${record.check_in_lat},${record.check_in_lng}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 text-xs text-primary font-bold bg-primary/5 py-2 rounded-lg"
                          >
                            <MapPin size={14} /> View Location on Map
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed border-border text-muted-foreground italic text-sm">
                    No attendance records found.
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Selfie Photo Preview Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-xl w-full bg-background rounded-xl p-4 border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">Staff Selfie Photo Verification</h3>
              <button 
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="text-muted-foreground hover:text-foreground font-bold text-base px-2"
              >
                ✕
              </button>
            </div>
            <img 
              src={previewPhoto} 
              alt="Staff Selfie Verification" 
              className="w-full max-h-[70vh] object-contain rounded-lg border border-border bg-black/5"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
