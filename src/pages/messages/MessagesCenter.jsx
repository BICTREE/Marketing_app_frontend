import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, Mail, Send, Clock, FileText, Eye, Plus, Save, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import useAuth from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

const listFrom = (data) => data?.results || data || [];

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const MessagesCenter = () => {
  const { isOwner, dashboardPath } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [previewLog, setPreviewLog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    body: '',
    scheduled_at: '',
    repeat: 'once',
    send_in_app: true,
    send_email: true,
    audience: 'all',
    user_ids: [],
  });
  const [sendForm, setSendForm] = useState({
    title: '',
    body: '',
    send_in_app: true,
    send_email: true,
    audience: 'all',
    user_ids: [],
  });

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['email-logs', search],
    queryFn: () => api.get('/notifications/email-logs/', { params: search ? { search } : {} }).then((r) => r.data),
    enabled: isOwner,
  });

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => api.get('/notifications/templates/').then((r) => listFrom(r.data)),
    enabled: isOwner,
  });

  const { data: noticesData, isLoading: noticesLoading } = useQuery({
    queryKey: ['scheduled-notices'],
    queryFn: () => api.get('/notifications/scheduled-notices/').then((r) => listFrom(r.data)),
    enabled: isOwner,
  });

  const { data: usersData } = useQuery({
    queryKey: ['mail-users'],
    queryFn: () => api.get('/accounts/users/').then((r) => listFrom(r.data)),
    enabled: isOwner,
  });

  const { data: emailSetting, refetch: refetchEmailSetting } = useQuery({
    queryKey: ['daily-email-toggle'],
    queryFn: () => api.get('/accounts/system-settings/toggle-daily-emails/').then((r) => r.data),
    enabled: isOwner,
  });

  const logs = listFrom(logsData);
  const templates = templatesData || [];
  const notices = noticesData || [];
  const users = usersData || [];
  const digest = useMemo(() => templates.find((t) => t.key === 'daily_digest'), [templates]);

  const saveTemplate = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/notifications/templates/${id}/`, payload),
    onSuccess: () => {
      toast.success('Template saved');
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      setEditing(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Could not save template'),
  });

  const createNotice = useMutation({
    mutationFn: (payload) => api.post('/notifications/scheduled-notices/', payload),
    onSuccess: () => {
      toast.success('Scheduled notice saved');
      queryClient.invalidateQueries({ queryKey: ['scheduled-notices'] });
      setNoticeForm({
        title: '', body: '', scheduled_at: '', repeat: 'once',
        send_in_app: true, send_email: true, audience: 'all', user_ids: [],
      });
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Could not schedule notice'),
  });

  const sendNow = useMutation({
    mutationFn: (payload) => api.post('/notifications/scheduled-notices/send-now/', payload),
    onSuccess: (res) => {
      const r = res.data?.result || {};
      toast.success(`Sent. In-app ${r.in_app || 0}, email ${r.email || 0}`);
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-notices'] });
      setSendForm({ title: '', body: '', send_in_app: true, send_email: true, audience: 'all', user_ids: [] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Send failed'),
  });

  const sendScheduledNow = useMutation({
    mutationFn: (id) => api.post(`/notifications/scheduled-notices/${id}/send-now/`),
    onSuccess: (res) => {
      const r = res.data?.result || {};
      toast.success(`Sent. In-app ${r.in_app || 0}, email ${r.email || 0}`);
      queryClient.invalidateQueries({ queryKey: ['scheduled-notices'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Send failed'),
  });

  const pauseNotice = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/notifications/scheduled-notices/${id}/`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-notices'] }),
  });

  if (!isOwner) {
    return <Navigate to={dashboardPath || '/admin/dashboard'} replace />;
  }

  const startEdit = (tpl) => {
    setEditing(tpl.id);
    setDraft({
      name: tpl.name,
      subject: tpl.subject,
      greeting: tpl.greeting,
      body: tpl.body,
      birthday_note: tpl.birthday_note,
      footer: tpl.footer,
      send_hour: tpl.send_hour,
      send_minute: tpl.send_minute,
      is_active: tpl.is_active,
    });
  };

  const toggleUser = (form, setForm, id) => {
    const ids = form.user_ids.includes(id)
      ? form.user_ids.filter((x) => x !== id)
      : [...form.user_ids, id];
    setForm({ ...form, user_ids: ids, audience: ids.length ? 'users' : 'all' });
  };

  const UserPicker = ({ form, setForm }) => (
    <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3 space-y-2 bg-card">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.audience === 'all'}
          onChange={(e) => setForm({ ...form, audience: e.target.checked ? 'all' : 'users', user_ids: e.target.checked ? [] : form.user_ids })}
        />
        All active staff
      </label>
      {form.audience !== 'all' && users.map((u) => (
        <label key={u.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.user_ids.includes(u.id)}
            onChange={() => toggleUser(form, setForm, u.id)}
          />
          <span className="truncate">{u.full_name} <span className="text-muted-foreground">({u.email})</span></span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Mail & Alerts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Check SMTP mail sent by the system, edit the templates staff receive, and schedule custom notices.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-medium">Morning digest</p>
            <p className="text-xs text-muted-foreground">
              {digest
                ? `Sends at ${String(digest.send_hour).padStart(2, '0')}:${String(digest.send_minute).padStart(2, '0')} IST to staff with email alerts on.`
                : 'Sends at 09:00 IST.'}
              {' '}Turn staff on/off from Team.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const current = emailSetting?.enabled ?? true;
                  const res = await api.post('/accounts/system-settings/toggle-daily-emails/', { enabled: !current });
                  toast.success(res.data?.message || 'Updated');
                  refetchEmailSetting();
                } catch {
                  toast.error('Could not update digest setting');
                }
              }}
            >
              Digest {emailSetting?.enabled === false ? 'is OFF' : 'is ON'}
            </Button>
            <Button
              className="bg-[#C9972A] hover:bg-[#7A5500] text-white"
              onClick={async () => {
                try {
                  const res = await api.post('/accounts/trigger-daily-emails/', { force: true });
                  toast.success(`Digest sent to ${res.data?.result?.sent || 0} staff`);
                  refetchLogs();
                } catch {
                  toast.error('Could not send digest now');
                }
              }}
            >
              <Send size={14} className="mr-2" /> Send digest now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sent" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto w-full md:w-auto">
          <TabsTrigger value="sent" className="gap-1"><Mail size={14} /> Sent mail</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1"><FileText size={14} /> Templates</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1"><Clock size={14} /> Schedule</TabsTrigger>
          <TabsTrigger value="send" className="gap-1"><Send size={14} /> Send now</TabsTrigger>
        </TabsList>

        <TabsContent value="sent">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
              <CardTitle>SMTP sent log</CardTitle>
              <div className="flex gap-2 w-full md:w-auto">
                <Input
                  placeholder="Search email or subject"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="md:w-64"
                />
                <Button variant="outline" size="icon" onClick={() => refetchLogs()}><RefreshCw size={16} /></Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {logsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#C9972A]" /></div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No mail logged yet. Send a digest or custom notice to see it here.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {row.created_at ? format(new Date(row.created_at), 'dd MMM yyyy, hh:mm a') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{row.to_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{row.to_email}</div>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">{row.subject}</TableCell>
                        <TableCell className="text-xs">{row.template_key || '—'}</TableCell>
                        <TableCell>
                          <span className={row.status === 'sent' ? 'text-emerald-700' : 'text-red-600'}>
                            {row.status}{row.error ? `: ${row.error.slice(0, 40)}` : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setPreviewLog(row)}>
                            <Eye size={14} className="mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          {templatesLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#C9972A]" /></div>
          ) : (
            <div className="grid gap-4">
              <p className="text-xs text-muted-foreground">
                Placeholders: {'{first_name}'}, {'{full_name}'}, {'{date}'}, {'{short_date}'}, {'{title}'}, {'{body}'}. Work lists in the morning digest stay automatic.
              </p>
              {templates.map((tpl) => (
                <Card key={tpl.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{tpl.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{tpl.key.replace('_', ' ')}</p>
                    </div>
                    {editing === tpl.id ? (
                      <Button
                        className="bg-[#C9972A] hover:bg-[#7A5500] text-white"
                        disabled={saveTemplate.isPending}
                        onClick={() => saveTemplate.mutate({ id: tpl.id, payload: draft })}
                      >
                        {saveTemplate.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
                        Save
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => startEdit(tpl)}>Edit</Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {editing === tpl.id ? (
                      <>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <Label>Subject</Label>
                            <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                          </div>
                          {tpl.key === 'daily_digest' && (
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <Label>Send hour (IST)</Label>
                                <Input type="number" min={0} max={23} value={draft.send_hour} onChange={(e) => setDraft({ ...draft, send_hour: Number(e.target.value) })} />
                              </div>
                              <div className="flex-1">
                                <Label>Minute</Label>
                                <Input type="number" min={0} max={59} value={draft.send_minute} onChange={(e) => setDraft({ ...draft, send_minute: Number(e.target.value) })} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <Label>Greeting</Label>
                          <Textarea rows={3} value={draft.greeting} onChange={(e) => setDraft({ ...draft, greeting: e.target.value })} />
                        </div>
                        <div>
                          <Label>Extra message</Label>
                          <Textarea rows={3} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                        </div>
                        {tpl.key === 'daily_digest' && (
                          <div>
                            <Label>Birthday note</Label>
                            <Textarea rows={2} value={draft.birthday_note} onChange={(e) => setDraft({ ...draft, birthday_note: e.target.value })} />
                          </div>
                        )}
                        <div>
                          <Label>Footer / sign-off</Label>
                          <Textarea rows={3} value={draft.footer} onChange={(e) => setDraft({ ...draft, footer: e.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
                          Active
                        </label>
                      </>
                    ) : (
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Subject:</span> {tpl.subject || '—'}</p>
                        <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Greeting:</span> {tpl.greeting || '—'}</p>
                        {tpl.body ? <p className="whitespace-pre-wrap">{tpl.body}</p> : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedule">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>New scheduled notice</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input value={noticeForm.title} onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })} />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea rows={5} value={noticeForm.body} onChange={(e) => setNoticeForm({ ...noticeForm, body: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>When</Label>
                    <Input type="datetime-local" value={noticeForm.scheduled_at} onChange={(e) => setNoticeForm({ ...noticeForm, scheduled_at: e.target.value })} />
                  </div>
                  <div>
                    <Label>Repeat</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={noticeForm.repeat}
                      onChange={(e) => setNoticeForm({ ...noticeForm, repeat: e.target.value })}
                    >
                      <option value="once">One time</option>
                      <option value="daily">Every day</option>
                      <option value="weekly">Every week</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={noticeForm.send_in_app} onChange={(e) => setNoticeForm({ ...noticeForm, send_in_app: e.target.checked })} />
                  In-app notification
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={noticeForm.send_email} onChange={(e) => setNoticeForm({ ...noticeForm, send_email: e.target.checked })} />
                  Email (SMTP)
                </label>
                <UserPicker form={noticeForm} setForm={setNoticeForm} />
                <Button
                  className="bg-[#C9972A] hover:bg-[#7A5500] text-white w-full"
                  disabled={createNotice.isPending || !noticeForm.title || !noticeForm.body || !noticeForm.scheduled_at}
                  onClick={() => createNotice.mutate({
                    ...noticeForm,
                    scheduled_at: new Date(noticeForm.scheduled_at).toISOString(),
                  })}
                >
                  {createNotice.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Plus size={14} className="mr-2" />}
                  Schedule
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {noticesLoading ? (
                  <Loader2 className="animate-spin text-[#C9972A]" />
                ) : notices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scheduled notices yet.</p>
                ) : notices.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium text-sm">{n.title}</p>
                      <span className={`text-xs ${n.is_active ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                        {n.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{n.body}</p>
                    <p className="text-xs">
                      {n.scheduled_at ? format(new Date(n.scheduled_at), 'dd MMM yyyy, hh:mm a') : '—'} · {n.repeat}
                      {n.last_sent_at ? ` · last sent ${format(new Date(n.last_sent_at), 'dd MMM, hh:mm a')}` : ''}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => sendScheduledNow.mutate(n.id)}>Send now</Button>
                      <Button size="sm" variant="ghost" onClick={() => pauseNotice.mutate({ id: n.id, is_active: !n.is_active })}>
                        {n.is_active ? 'Pause' : 'Resume'}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="send">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Send a custom message now</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={sendForm.title} onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })} />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea rows={6} value={sendForm.body} onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sendForm.send_in_app} onChange={(e) => setSendForm({ ...sendForm, send_in_app: e.target.checked })} />
                In-app notification
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sendForm.send_email} onChange={(e) => setSendForm({ ...sendForm, send_email: e.target.checked })} />
                Email (SMTP)
              </label>
              <UserPicker form={sendForm} setForm={setSendForm} />
              <Button
                className="bg-[#C9972A] hover:bg-[#7A5500] text-white w-full"
                disabled={sendNow.isPending || !sendForm.title || !sendForm.body}
                onClick={() => sendNow.mutate(sendForm)}
              >
                {sendNow.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Send size={14} className="mr-2" />}
                Send to staff
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!previewLog} onOpenChange={() => setPreviewLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewLog?.subject}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{previewLog?.to_name} · {previewLog?.to_email}</p>
          {previewLog?.error ? <p className="text-sm text-red-600">{previewLog.error}</p> : null}
          <iframe
            title="Email preview"
            className="w-full min-h-[420px] rounded-md border border-border bg-white"
            srcDoc={previewLog?.body_preview || '<p>No preview</p>'}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesCenter;
