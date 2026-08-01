import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, Navigation, Users, Clock, RefreshCw, 
  Activity, Target, AlertCircle, CheckCircle
} from 'lucide-react';
import LocationMap from '@/components/maps/LocationMap';
import api from '@/lib/api';

const LiveTrackingDashboard = () => {
  const [liveLocations, setLiveLocations] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffHistory, setStaffHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [mapCenter, setMapCenter] = useState([12.9716, 77.5946]); // Bangalore

  // Fetch live locations
  const fetchLiveLocations = useCallback(async () => {
    try {
      const response = await api.get('/field-visits/live-tracking/');
      const locations = response.data.locations || [];
      
      // Transform data for map
      const mapMarkers = locations.map(location => ({
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.staff_name,
        user_name: location.staff_name,
        lead_name: location.lead_name,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        type: 'staff',
        is_active: true,
        staff_id: location.staff_id,
        field_visit_id: location.field_visit_id
      }));

      setLiveLocations(locations);
      setLastUpdate(new Date());
      
      // Auto-center map if there are active locations
      if (mapMarkers.length > 0) {
        const avgLat = mapMarkers.reduce((sum, m) => sum + m.latitude, 0) / mapMarkers.length;
        const avgLng = mapMarkers.reduce((sum, m) => sum + m.longitude, 0) / mapMarkers.length;
        setMapCenter([avgLat, avgLng]);
      }
      
    } catch (error) {
      console.error('Error fetching live locations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch staff location history
  const fetchStaffHistory = async (staffId) => {
    try {
      const response = await api.get(`/field-visits/location-tracking/?user=${staffId}&limit=50`);
      const history = response.data.results || [];
      
      // Transform for map polylines
      const pathCoordinates = history
        .filter(loc => loc.latitude && loc.longitude)
        .map(loc => [loc.latitude, loc.longitude])
        .reverse(); // Show oldest to newest

      setStaffHistory(history);
      
    } catch (error) {
      console.error('Error fetching staff history:', error);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    fetchLiveLocations();
    
    if (autoRefresh) {
      const interval = setInterval(fetchLiveLocations, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchLiveLocations]);

  // Handle staff selection
  const handleStaffSelect = (staff) => {
    setSelectedStaff(staff);
    if (staff.staff_id) {
      fetchStaffHistory(staff.staff_id);
    }
  };

  // Get status badge for staff
  const getStatusBadge = (location) => {
    const now = new Date();
    const lastUpdate = new Date(location.timestamp);
    const minutesAgo = Math.floor((now - lastUpdate) / (1000 * 60));
    
    if (minutesAgo < 5) {
      return <Badge className="bg-green-500 text-white">Live</Badge>;
    } else if (minutesAgo < 15) {
      return <Badge className="bg-yellow-500 text-white">Recent</Badge>;
    } else {
      return <Badge className="bg-gray-500 text-white">Offline</Badge>;
    }
  };

  // Create polylines for staff movement history
  const getStaffPolylines = () => {
    if (!staffHistory || staffHistory.length < 2) return [];
    
    const pathCoordinates = staffHistory
      .filter(loc => loc.latitude && loc.longitude)
      .map(loc => [loc.latitude, loc.longitude])
      .reverse();
    
    return [{
      positions: pathCoordinates,
      color: '#3B82F6',
      weight: 3,
      opacity: 0.7
    }];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Location Tracking</h1>
          <p className="text-muted-foreground">Real-time GPS tracking for field staff</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLiveLocations}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Status Info */}
      {lastUpdate && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Live Tracking Active</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </span>
                <span className="text-sm text-muted-foreground">
                  {liveLocations.length} staff active
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Live Map View
                {autoRefresh && (
                  <Badge variant="outline" className="text-xs">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                    Live
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LocationMap
                center={mapCenter}
                height="500px"
                markers={[
                  ...liveLocations.map((loc, i) => ({
                    ...loc,
                    name: loc.staff_name || 'Staff',
                    user_name: loc.staff_name,
                    type: 'staff',
                    is_active: true
                  })),
                  ...(selectedStaff ? staffHistory.map(loc => ({
                    ...loc,
                    type: 'staff',
                    is_active: false
                  })) : [])
                ]}
                polylines={selectedStaff ? getStaffPolylines() : []}
                showLiveTracking={autoRefresh}
              />
            </CardContent>
          </Card>
        </div>

        {/* Staff List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading locations...</p>
                  </div>
                ) : liveLocations.length === 0 ? (
                  <div className="text-center py-4">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No active staff locations</p>
                  </div>
                ) : (
                  liveLocations.map((location, index) => (
                    <div
                      key={location.staff_id || index}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedStaff?.staff_id === location.staff_id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleStaffSelect(location)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="font-medium text-sm">{location.staff_name}</span>
                        </div>
                        {getStatusBadge(location)}
                      </div>
                      
                      {location.lead_name && (
                        <div className="text-xs text-muted-foreground mb-1">
                          <Target className="h-3 w-3 inline mr-1" />
                          Visiting: {location.lead_name}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(location.timestamp).toLocaleTimeString()}
                        </div>
                        {location.accuracy && (
                          <span>±{Math.round(location.accuracy)}m</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Staff Details */}
          {selectedStaff && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Staff Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <p className="text-sm">{selectedStaff.user_name}</p>
                  </div>
                  
                  {selectedStaff.lead_name && (
                    <div>
                      <label className="text-sm font-medium">Current Visit</label>
                      <p className="text-sm">{selectedStaff.lead_name}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium">Last Update</label>
                    <p className="text-sm">
                      {new Date(selectedStaff.timestamp).toLocaleString()}
                    </p>
                  </div>
                  
                  {selectedStaff.accuracy && (
                    <div>
                      <label className="text-sm font-medium">GPS Accuracy</label>
                      <p className="text-sm">±{Math.round(selectedStaff.accuracy)} meters</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium">Location History</label>
                    <p className="text-sm text-muted-foreground">
                      {staffHistory.length} location points
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTrackingDashboard;
