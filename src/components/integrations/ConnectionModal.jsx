import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '@/api/axios';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ConnectionModal = ({ platform, isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState('form'); // form, oauth, success

  // Fetch branches for selection
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
  });

  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm({
    defaultValues: {
      account_name: '',
      account_id: '',
      access_token: '',
      refresh_token: '',
      branch: '',
    }
  });

  const connectMutation = useMutation({
    mutationFn: (data) => api.post('/campaigns/integrations/', data),
    onSuccess: () => {
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
        setStep('form');
      }, 1500);
    },
  });

  const onSubmit = (data) => {
    const payload = {
      platform: platform,
      is_connected: true,
      sync_enabled: true,
      ...data,
    };
    if (!payload.branch || payload.branch === 'global') {
      payload.branch = null;
    }
    connectMutation.mutate(payload);
  };

  const getPlatformName = (platformKey) => {
    if (!platformKey) return 'Platform';
    const names = {
      'google_analytics': 'Google Analytics',
      'google_ads': 'Google Ads',
      'facebook_ads': 'Facebook Ads',
      'instagram_insights': 'Instagram Insights',
      'youtube_analytics': 'YouTube Analytics',
      'whatsapp_business': 'WhatsApp Business',
      'mailchimp': 'Mailchimp',
      'brevo': 'Brevo',
      'sendgrid': 'SendGrid',
    };
    return names[platformKey] || platformKey;
  };

  const getPlatformIcon = (platformKey) => {
    if (!platformKey) return '🔗';
    const icons = {
      'google_analytics': '📊',
      'google_ads': '📣',
      'facebook_ads': '📘',
      'instagram_insights': '📷',
      'youtube_analytics': '▶️',
      'whatsapp_business': '💬',
      'mailchimp': '📧',
      'brevo': '📧',
      'sendgrid': '📧',
    };
    return icons[platformKey] || '🔗';
  };

  if (!isOpen) return null;

  console.log('ConnectionModal opened with platform:', platform);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{getPlatformIcon(platform)}</span>
              Connect {getPlatformName(platform)}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-6 pt-4">
            {(platform === 'google_analytics' || platform === 'google_ads' || platform === 'youtube_analytics') && (
              <div className="space-y-4">
                <div className="bg-muted/30 p-4 rounded-lg border border-dashed text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect your Google Analytics account to track campaign performance and website traffic.
                  </p>
                  <Button 
                    type="button"
                    className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 font-medium"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const selectedBranch = getValues('branch');
                        if (selectedBranch && selectedBranch !== 'global') {
                          localStorage.setItem('oauth_branch_id', selectedBranch);
                        } else {
                          localStorage.removeItem('oauth_branch_id');
                        }
                        localStorage.setItem('oauth_platform', platform);

                        const redirectUri = window.location.origin + '/campaigns/integrations/callback';
                        const res = await api.get('/campaigns/integrations/oauth-url/', {
                          params: { platform, redirect_uri: redirectUri }
                        });
                        window.location.href = res.data.url;
                      } catch (err) {
                        alert(`Failed to initialize Google login: ${err.response?.data?.detail || err.message}`);
                      }
                    }}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or manual configuration
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(platform === 'facebook_ads' || platform === 'instagram_insights') && (
              <div className="space-y-4">
                <div className="bg-[#1877F2]/10 p-4 rounded-lg border border-dashed border-[#1877F2]/30 text-center">
                  <p className="text-sm text-[#1877F2] mb-4 font-medium">
                    Connect your Meta account to sync Facebook, Instagram, and Lead Ads.
                  </p>
                  <Button 
                    type="button"
                    className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white font-medium"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Meta OAuth button clicked');
                      try {
                        const selectedBranch = getValues('branch');
                        console.log('Selected branch for Meta:', selectedBranch);
                        const res = await api.get('/campaigns/integrations/meta/oauth-url/', {
                          params: { branch_id: selectedBranch === 'global' ? '' : selectedBranch, platform }
                        });
                        console.log('Meta OAuth URL:', res.data.url);
                        window.location.href = res.data.url;
                      } catch (err) {
                        console.error('Meta OAuth failed:', err);
                        alert(`Failed to initialize Meta login: ${err.response?.data?.detail || err.message}`);
                      }
                    }}
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Continue with Facebook
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or manual configuration
                    </span>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch (Optional)</Label>
                <Select onValueChange={(value) => setValue('branch', value)}>
                  <SelectTrigger id="branch">
                    <SelectValue placeholder="Select branch (leave empty for global)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Branches)</SelectItem>
                    {branchesData?.map(branch => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Leave empty for global integration visible to all branches
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  placeholder="My Business Account"
                  {...register('account_name', { required: 'Account name is required' })}
                />
                {errors.account_name && (
                  <p className="text-sm text-destructive">{errors.account_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_id">Account ID / Property ID</Label>
                <Input
                  id="account_id"
                  placeholder="Enter platform account ID"
                  {...register('account_id', { required: 'Account ID is required' })}
                />
                {errors.account_id && (
                  <p className="text-sm text-destructive">{errors.account_id.message}</p>
                )}
                <p className="text-xs text-gray-500">
                  This is your account ID from {getPlatformName(platform)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access_token">Access Token / API Key</Label>
                <Input
                  id="access_token"
                  type="password"
                  placeholder="Enter access token or API key"
                  {...register('access_token', { required: 'Access token is required' })}
                />
                {errors.access_token && (
                  <p className="text-sm text-destructive">{errors.access_token.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh_token">Refresh Token (Optional)</Label>
                <Input
                  id="refresh_token"
                  type="password"
                  placeholder="Enter refresh token if applicable"
                  {...register('refresh_token')}
                />
                <p className="text-xs text-gray-500">
                  Required for OAuth-based integrations like Google and Meta
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  'Connect Integration'
                )}
              </Button>
            </form>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-semibold mb-2">Connected Successfully!</h3>
            <p className="text-sm text-gray-600">
              Your {getPlatformName(platform)} integration is now active.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConnectionModal;
