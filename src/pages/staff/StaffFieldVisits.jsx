import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import useAuth from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Navigation, Clock, CheckCircle, Navigation2, FileCheck, Phone, Map as MapIcon, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const StaffFieldVisits = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [locationError, setLocationError] = useState(null);
  
  // State for creating a new field visit by self
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');

  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [completeForm, setCompleteForm] = useState({
    outcome: 'interested',
    notes: '',
    expected_grams: '',
    is_advance_booking: false,
    needs_followup: false,
    followup_type: 'call',
    followup_date: '',
    followup_notes: ''
  });

  // Fetch only this staff's field visits
  const { data: visitsData, isLoading } = useQuery({
    queryKey: ['staff-fieldvisits'],
    queryFn: () => api.get(`/field-visits/field-visits/?staff=${user?.id}`).then(res => res.data.results || res.data)
  });

  // Fetch only this staff's assigned leads to select for self visit
  const { data: leadsData } = useQuery({
    queryKey: ['staff-leads'],
    queryFn: () => api.get('/leads/leads/').then(res => res.data.results || res.data)
  });

  const visits = visitsData || [];
  // A visit is active (in progress) if status is 'active' AND start_lat is populated
  const activeVisit = visits.find(v => v.status === 'active' && v.start_lat !== null && v.start_lat !== undefined);
  // A visit is scheduled/assigned if status is 'active' AND (start_lat is null or undefined)
  const scheduledVisits = visits.filter(v => v.status === 'active' && (v.start_lat === null || v.start_lat === undefined));
  const completedVisits = visits.filter(v => {
    if (v.status !== 'completed') return false;
    const dateToCheck = v.ended_at || v.started_at;
    if (!dateToCheck) return false;
    const visitDate = new Date(dateToCheck);
    const today = new Date();
    return (
      visitDate.getDate() === today.getDate() &&
      visitDate.getMonth() === today.getMonth() &&
      visitDate.getFullYear() === today.getFullYear()
    );
  });

  const createVisitMutation = useMutation({
    mutationFn: (newVisit) => api.post('/field-visits/field-visits/', newVisit),
    onSuccess: () => {
      toast.success('Field visit created successfully!');
      queryClient.invalidateQueries(['staff-fieldvisits']);
      setIsCreateOpen(false);
      setSelectedLeadId('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create field visit.');
    }
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!selectedLeadId) {
      toast.error('Please select a lead.');
      return;
    }
    createVisitMutation.mutate({
      lead: selectedLeadId
    });
  };

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }),
          (error) => reject(error),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    });
  };

  const startVisitMutation = useMutation({
    mutationFn: async (visitId) => {
      try {
        const coords = await getLocation();
        return api.post(`/field-visits/field-visits/${visitId}/start/`, coords);
      } catch (err) {
        throw err;
      }
    },
    onSuccess: () => {
      toast.success('Field visit started!');
      queryClient.invalidateQueries(['staff-fieldvisits']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start visit. Check location permissions.');
    }
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ visitId, note }) => {
      const coords = await getLocation();
      return api.post(`/field-visits/field-visits/${visitId}/check-in/`, {
        ...coords,
        note
      });
    },
    onSuccess: () => {
      toast.success('Location check-in recorded!');
      queryClient.invalidateQueries(['staff-fieldvisits']);
    }
  });

  const reachedClientMutation = useMutation({
    mutationFn: async (visitId) => {
      const coords = await getLocation();
      return api.post(`/field-visits/field-visits/${visitId}/reached-client/`, coords);
    },
    onSuccess: () => {
      toast.success('Reached client! Location saved to profile.');
      queryClient.invalidateQueries(['staff-fieldvisits']);
    },
    onError: (error) => {
      if (error.response?.status === 404) {
        toast.error('Server update still deploying. Try again in 2 mins!');
      } else {
        toast.error(error.response?.data?.detail || error.message || 'Failed to update location. Please enable GPS.');
      }
    }
  });

  const endVisitMutation = useMutation({
    mutationFn: async (visitId) => {
      // Try to get coords but don't fail if they can't be fetched on complete
      let coords = { lat: null, lng: null };
      try { coords = await getLocation(); } catch (e) {}
      
      return api.post(`/field-visits/field-visits/${visitId}/end/`, {
        ...coords,
        ...completeForm
      });
    },
    onSuccess: () => {
      toast.success('Field visit completed!');
      queryClient.invalidateQueries(['staff-fieldvisits']);
      setIsCompleteOpen(false);
      setCompleteForm({ outcome: 'interested', notes: '', expected_grams: '', is_advance_booking: false, needs_followup: false, followup_type: 'call', followup_date: '', followup_notes: '' });
    }
  });

  if (isLoading) {
    return <div className="text-center p-8 text-gray-500">Loading your visits...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Field Visits</h2>
          <p className="text-sm text-gray-500">Manage your daily client visits</p>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#0F6E56] hover:bg-[#0a5240] text-white gap-2"
        >
          <Plus size={16} /> New Visit
        </Button>
      </div>

      {activeVisit && (
        <Card className="border-[#0F6E56] shadow-md border-2 overflow-hidden bg-white">
          <div className="bg-[#0F6E56] text-white p-3 flex items-center justify-between">
            <span className="font-bold flex items-center gap-2">
              <Navigation2 size={16} className="animate-pulse" /> Active Visit
            </span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">In Progress</span>
          </div>
          <CardContent className="pt-4 space-y-4">
            <div>
              <p className="font-bold text-lg">{activeVisit.lead_name}</p>
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                <Phone size={14} /> {activeVisit.lead_phone || 'No phone'}
              </p>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-xs">Started At</p>
                <p className="font-medium">{format(new Date(activeVisit.started_at), 'hh:mm a')}</p>
              </div>
              <Clock className="text-gray-400" />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => checkInMutation.mutate({ visitId: activeVisit.id, note: 'Regular update' })}
                className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-none text-xs px-2"
                variant="outline"
                disabled={checkInMutation.isPending}
              >
                <MapPin size={14} className="mr-1" /> Log Loc
              </Button>
              <Button 
                onClick={() => reachedClientMutation.mutate(activeVisit.id)}
                className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none text-xs px-2"
                variant="outline"
                disabled={reachedClientMutation.isPending}
              >
                <Navigation2 size={14} className="mr-1" /> Reached Client
              </Button>
            </div>
            <Button 
              onClick={() => setIsCompleteOpen(true)}
              className="w-full bg-[#0F6E56] hover:bg-[#0a5240] text-white"
            >
              <CheckCircle size={16} className="mr-2" /> Complete Visit
            </Button>

            {/* Live Tracking Map */}
            {activeVisit.start_lat && activeVisit.start_lng && (
              <div className="mt-4 border rounded-xl overflow-hidden h-[250px] relative z-0">
                <MapContainer 
                  center={[parseFloat(activeVisit.start_lat), parseFloat(activeVisit.start_lng)]} 
                  zoom={14} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  
                  {/* Start Point */}
                  <Marker position={[parseFloat(activeVisit.start_lat), parseFloat(activeVisit.start_lng)]}>
                    <Popup>Visit Started</Popup>
                  </Marker>
                  
                  {/* Checkins */}
                  {activeVisit.checkins?.map(checkin => (
                    <Marker key={checkin.id} position={[parseFloat(checkin.lat), parseFloat(checkin.lng)]}>
                      <Popup>
                        <div className="text-xs">
                          <p className="font-bold">Check-in</p>
                          <p>{format(new Date(checkin.timestamp), 'hh:mm a')}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  
                  {/* Route Polyline */}
                  {activeVisit.checkins && activeVisit.checkins.length > 0 && (
                    <Polyline 
                      positions={[
                        [parseFloat(activeVisit.start_lat), parseFloat(activeVisit.start_lng)],
                        ...activeVisit.checkins.map(c => [parseFloat(c.lat), parseFloat(c.lng)])
                      ]} 
                      color="#0F6E56" 
                      weight={3}
                      dashArray="5, 10"
                    />
                  )}
                </MapContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {scheduledVisits.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Clock size={16} /> Scheduled Visits ({scheduledVisits.length})
          </h3>
          {scheduledVisits.map(visit => (
            <Card key={visit.id} className="shadow-sm border-gray-100">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold">{visit.lead_name}</p>
                    <p className="text-xs text-gray-500">{visit.notes || visit.purpose || 'Follow-up Visit'}</p>
                    {visit.scheduled_date && (
                      <p className="text-xs text-gray-400 mt-1">
                        📅 Scheduled: {format(new Date(visit.scheduled_date), 'MMM dd, yyyy hh:mm a')}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Scheduled</Badge>
                </div>
                <Button 
                  onClick={() => startVisitMutation.mutate(visit.id)}
                  className="w-full bg-[#C9972A] hover:bg-[#b08221] text-white disabled:opacity-50"
                  disabled={startVisitMutation.isPending || !!activeVisit}
                >
                  <Navigation size={16} className="mr-2" /> Start Visit
                </Button>
                {!!activeVisit && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    Complete your active visit before starting another.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {scheduledVisits.length === 0 && !activeVisit && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <MapIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No scheduled visits</p>
          <p className="text-xs text-gray-400 mt-1">Check back later or ask your manager to assign leads.</p>
        </div>
      )}

      {completedVisits.length > 0 && (
        <div className="space-y-3 mt-8">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <FileCheck size={16} /> Completed Today
          </h3>
          {completedVisits.slice(0, 5).map(visit => (
            <Card key={visit.id} className="bg-gray-50/50 border-gray-100 shadow-none">
              <CardContent className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm text-gray-800">{visit.lead_name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock size={10} /> {visit.duration_minutes ? `${visit.duration_minutes} mins` : 'Completed'}
                  </p>
                </div>
                {visit.distance_km && (
                  <span className="text-xs font-semibold text-gray-600 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                    {visit.distance_km.toFixed(1)} km
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog for starting new self-visit */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Start New Field Visit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Select Customer / Lead</label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full flex h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56] focus:border-transparent text-gray-900"
              >
                <option value="">Choose a customer...</option>
                {leadsData?.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} ({lead.phone || 'No phone'})
                  </option>
                ))}
              </select>
              {leadsData?.length === 0 && (
                <p className="text-xs text-amber-600">No leads assigned to you. You can only start visits for leads assigned to you.</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0F6E56] hover:bg-[#0a5240] text-white font-bold"
              disabled={createVisitMutation.isPending || !selectedLeadId}
            >
              {createVisitMutation.isPending ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : (
                <MapPin className="mr-2" size={16} />
              )}
              Create Visit
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for completing a visit */}
      <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <DialogContent className="max-w-md bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Complete Field Visit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Outcome</label>
              <select
                value={completeForm.outcome}
                onChange={e => setCompleteForm(f => ({...f, outcome: e.target.value}))}
                className="w-full h-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              >
                <option value="interested">Interested</option>
                <option value="converted">Converted (Purchased)</option>
                <option value="call_later">Call Later</option>
                <option value="not_interested">Not Interested</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="adv-booking" 
                checked={completeForm.is_advance_booking} 
                onChange={e => setCompleteForm(f => ({...f, is_advance_booking: e.target.checked}))}
                className="rounded border-gray-300 text-[#0F6E56] focus:ring-[#0F6E56]"
              />
              <label htmlFor="adv-booking" className="text-sm font-semibold text-gray-700">Advance Booking Made?</label>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Expected Grams / Sold Grams</label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={completeForm.expected_grams}
                onChange={e => setCompleteForm(f => ({...f, expected_grams: e.target.value}))}
                className="w-full h-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Visit Notes</label>
              <textarea
                placeholder="Details about what happened..."
                value={completeForm.notes}
                onChange={e => setCompleteForm(f => ({...f, notes: e.target.value}))}
                className="w-full min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              />
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-gray-900 block">Needs Follow-up?</label>
                <input 
                  type="checkbox" 
                  checked={completeForm.needs_followup} 
                  onChange={e => setCompleteForm(f => ({...f, needs_followup: e.target.checked}))}
                  className="rounded border-gray-300 text-[#0F6E56] focus:ring-[#0F6E56] w-5 h-5"
                />
              </div>

              {completeForm.needs_followup && (
                <div className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant={completeForm.followup_type === 'call' ? 'default' : 'outline'}
                      className={completeForm.followup_type === 'call' ? 'bg-[#0F6E56] hover:bg-[#0a5240] text-white flex-1' : 'flex-1'}
                      onClick={() => setCompleteForm(f => ({...f, followup_type: 'call'}))}
                    >
                      Call
                    </Button>
                    <Button 
                      type="button"
                      variant={completeForm.followup_type === 'visit' ? 'default' : 'outline'}
                      className={completeForm.followup_type === 'visit' ? 'bg-[#0F6E56] hover:bg-[#0a5240] text-white flex-1' : 'flex-1'}
                      onClick={() => setCompleteForm(f => ({...f, followup_type: 'visit'}))}
                    >
                      Visit
                    </Button>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={completeForm.followup_date}
                      onChange={e => setCompleteForm(f => ({...f, followup_date: e.target.value}))}
                      className="w-full h-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Follow-up Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Call to confirm advance payment"
                      value={completeForm.followup_notes}
                      onChange={e => setCompleteForm(f => ({...f, followup_notes: e.target.value}))}
                      className="w-full h-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={() => endVisitMutation.mutate(activeVisit?.id)}
              className="w-full bg-[#0F6E56] hover:bg-[#0a5240] text-white font-bold mt-4"
              disabled={endVisitMutation.isPending}
            >
              {endVisitMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle className="mr-2" size={16} />}
              Submit & Complete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffFieldVisits;
