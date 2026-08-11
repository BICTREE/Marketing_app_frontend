import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Loader2, Bell, Check, CheckCircle2, FileText, 
  AlertTriangle, Megaphone, Gift, PartyPopper, Plus,
  Users as UsersIcon, User, Image as ImageIcon, X
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import useAuth from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const getNotificationIcon = (type) => {
  switch(type) {
    case 'report': return <FileText className="text-blue-500" size={18} />;
    case 'alert': return <AlertTriangle className="text-red-500" size={18} />;
    case 'campaign': return <Megaphone className="text-[#C9972A]" size={18} />;
    case 'announcement': return <Megaphone className="text-purple-500" size={18} />;
    case 'birthday': return <Gift className="text-pink-500" size={18} />;
    case 'anniversary': return <PartyPopper className="text-amber-500" size={18} />;
    case 'reminder': return <Bell className="text-[#0F6E56]" size={18} />;
    default: return <Bell className="text-muted-foreground" size={18} />;
  }
};

const NotificationsPage = () => {
  const { isOwner, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNotif, setNewNotif] = useState({
    title: '',
    body: '',
    notif_type: 'announcement',
    recipient: 'all',
    image: null
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedReviewNotif, setSelectedReviewNotif] = useState(null);
  const [managerNotes, setManagerNotes] = useState('');

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/notifications/').then(res => res.data.results || res.data)
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/accounts/users/').then(res => res.data.results || res.data),
    enabled: isOwner
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/notifications/${id}/read/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/notifications/read-all/'),
    onSuccess: () => {
      toast.success('All notifications marked as read');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const managerDecisionMutation = useMutation({
    mutationFn: ({ leadId, decision, extraPayload }) => 
      api.post(`/leads/leads/${leadId}/manager-decision/`, {
        decision,
        notes: managerNotes,
        ...extraPayload
      }),
    onSuccess: (res) => {
      toast.success(res.data?.detail || 'Manager decision recorded successfully!');
      setSelectedReviewNotif(null);
      setManagerNotes('');
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['leads']);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to record decision.');
    }
  });

  const createNotifMutation = useMutation({
    mutationFn: (formData) => api.post('/notifications/notifications/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    onSuccess: () => {
      toast.success('Notification sent successfully');
      setIsCreateModalOpen(false);
      setNewNotif({ title: '', body: '', notif_type: 'announcement', recipient: 'all', image: null });
      setPreviewImage(null);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      toast.error('Failed to send notification');
      console.error(err);
    }
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewNotif({ ...newNotif, image: file });
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateNotif = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', newNotif.title);
    formData.append('body', newNotif.body);
    formData.append('notif_type', newNotif.notif_type);
    
    if (newNotif.recipient === 'all') {
      formData.append('is_broadcast', 'true');
    } else {
      formData.append('recipient', newNotif.recipient);
      formData.append('is_broadcast', 'false');
    }
    
    if (newNotif.image) {
      formData.append('image', newNotif.image);
    }
    
    createNotifMutation.mutate(formData);
  };

  const unreadCount = Array.isArray(notificationsData) 
    ? notificationsData.filter(n => !n.is_read).length 
    : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground px-2.5 py-0.5 rounded-full text-sm font-semibold">
              {unreadCount} new
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {isOwner && (
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#C9972A] hover:bg-[#7A5500]">
                  <Plus className="mr-2" size={16} /> New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Send Notification</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateNotif} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipient">Send to</Label>
                    <Select 
                      value={newNotif.recipient} 
                      onValueChange={(v) => setNewNotif({...newNotif, recipient: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Everyone (Team)</SelectItem>
                        {Array.isArray(usersData) && usersData.map(u => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.full_name} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notif_type">Type</Label>
                    <Select 
                      value={newNotif.notif_type} 
                      onValueChange={(v) => setNewNotif({...newNotif, notif_type: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="announcement">Announcement</SelectItem>
                        <SelectItem value="birthday">Birthday Wish</SelectItem>
                        <SelectItem value="anniversary">Work Anniversary</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input 
                      id="title" 
                      placeholder="Enter notification title" 
                      value={newNotif.title}
                      onChange={(e) => setNewNotif({...newNotif, title: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="body">Message</Label>
                    <textarea 
                      id="body"
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Write your message here..."
                      value={newNotif.body}
                      onChange={(e) => setNewNotif({...newNotif, body: e.target.value})}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image">Attachment (Optional Photo)</Label>
                    <div className="flex items-center gap-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => document.getElementById('notif-image-upload').click()}
                      >
                        <ImageIcon className="mr-2" size={16} /> Upload Photo
                      </Button>
                      <input 
                        id="notif-image-upload"
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageChange}
                      />
                      {previewImage && (
                        <div className="relative w-16 h-16 rounded border overflow-hidden">
                          <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl"
                            onClick={() => {setPreviewImage(null); setNewNotif({...newNotif, image: null})}}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <DialogFooter className="pt-4">
                    <Button 
                      type="submit" 
                      className="bg-[#C9972A] hover:bg-[#7A5500]"
                      disabled={createNotifMutation.isPending}
                    >
                      {createNotifMutation.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
                      Send Notification
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              {markAllReadMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle2 className="mr-2" size={16} />}
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="animate-spin" /></div>
          ) : Array.isArray(notificationsData) && notificationsData.length > 0 ? (
            <div className="divide-y divide-border">
              {notificationsData.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => {
                    if (!notif.is_read) markReadMutation.mutate(notif.id);
                    if (notif.data?.type === 'field_visit_outcome' || notif.data?.type === 'field_visit_report') {
                      setSelectedReviewNotif(notif);
                    }
                  }}
                  className={`p-4 flex gap-4 transition-colors cursor-pointer ${notif.is_read ? 'opacity-70 bg-background' : 'bg-primary/5 hover:bg-primary/10'}`}
                >
                  <div className="mt-1 flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-border shadow-sm">
                      {getNotificationIcon(notif.notif_type)}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`text-sm font-semibold ${notif.is_read ? 'text-foreground' : 'text-primary'}`}>
                          {notif.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                           {notif.sender_name && (
                             <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium">
                               From: {notif.sender_name}
                             </span>
                           )}
                           <span className="text-[10px] text-muted-foreground">
                            {notif.created_at ? format(new Date(notif.created_at), 'MMM dd, hh:mm a') : 'Just now'}
                          </span>
                        </div>
                      </div>
                      
                      {!notif.is_read && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate(notif.id);
                          }}
                          disabled={markReadMutation.isPending}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-full hover:bg-background shadow-sm border border-border/50"
                          title="Mark as read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">{notif.body}</p>
                      {notif.image && (
                        <div className="max-w-md rounded-lg border overflow-hidden shadow-sm">
                           <img 
                            src={notif.image.startsWith('http') ? notif.image : `${api.defaults.baseURL.replace('/api/v1', '')}${notif.image}`} 
                            alt="Notification" 
                            className="w-full h-auto max-h-[300px] object-contain bg-muted/20"
                           />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Bell size={24} className="text-muted-foreground opacity-50" />
              </div>
              <p className="text-lg font-medium text-muted-foreground">You're all caught up!</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                When you get new assignments, reports, or system alerts, they'll show up here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manager Decision Review Modal */}
      <Dialog open={!!selectedReviewNotif} onOpenChange={(open) => !open && setSelectedReviewNotif(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              👑 Manager Field Visit Review & Decision
            </DialogTitle>
          </DialogHeader>

          {selectedReviewNotif && (
            <div className="space-y-4 pt-2">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-900">
                <p className="font-bold text-sm text-amber-950">{selectedReviewNotif.title}</p>
                <p className="leading-relaxed">{selectedReviewNotif.body}</p>
                {selectedReviewNotif.data?.expected_grams && (
                  <p className="font-semibold text-amber-800 pt-1">
                    🏅 Gold Intention: {selectedReviewNotif.data.expected_grams} Grams
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Manager Review Notes & Feedback</label>
                <textarea
                  className="w-full p-2 text-xs rounded-md border border-input bg-background min-h-[70px]"
                  placeholder="e.g. Approved for advance scheme discount. Schedule follow-up visit..."
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
                  onClick={() => managerDecisionMutation.mutate({ 
                    leadId: selectedReviewNotif.data.lead_id, 
                    decision: 'convert' 
                  })}
                  disabled={managerDecisionMutation.isPending}
                >
                  ✓ Mark Converted
                </Button>

                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 font-medium text-xs"
                  onClick={() => managerDecisionMutation.mutate({ 
                    leadId: selectedReviewNotif.data.lead_id, 
                    decision: 'mark_lost',
                    extraPayload: { lost_reason: managerNotes } 
                  })}
                  disabled={managerDecisionMutation.isPending}
                >
                  ✕ Mark Lost
                </Button>

                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 font-medium text-xs"
                  onClick={() => managerDecisionMutation.mutate({ 
                    leadId: selectedReviewNotif.data.lead_id, 
                    decision: 'schedule_visit' 
                  })}
                  disabled={managerDecisionMutation.isPending}
                >
                  📅 Schedule Next Visit
                </Button>

                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 font-medium text-xs"
                  onClick={() => managerDecisionMutation.mutate({ 
                    leadId: selectedReviewNotif.data.lead_id, 
                    decision: 'schedule_followup' 
                  })}
                  disabled={managerDecisionMutation.isPending}
                >
                  📞 Schedule Call
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationsPage;
