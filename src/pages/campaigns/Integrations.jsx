import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { 
  Settings, 
  RefreshCw, 
  Plus, 
  Search, 
  Filter,
  Loader2,
  Shield
} from 'lucide-react';
import IntegrationCard from '@/components/integrations/IntegrationCard';
import ConnectionModal from '@/components/integrations/ConnectionModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AVAILABLE_PLATFORMS = [
  { key: 'google_analytics', name: 'Google Analytics', icon: '📊', description: 'Track website traffic and user behavior' },
  { key: 'google_search_console', name: 'Google Search Console', icon: '🔎', description: 'Search clicks, impressions, CTR and position' },
  { key: 'google_ads', name: 'Google Ads', icon: '📣', description: 'Monitor ad performance and ROI' },
  { key: 'facebook_ads', name: 'Facebook Ads', icon: '📘', description: 'Track Facebook ad campaigns' },
  { key: 'instagram_insights', name: 'Instagram Insights', icon: '📷', description: 'Monitor Instagram engagement metrics' },
  { key: 'youtube_analytics', name: 'YouTube Analytics', icon: '▶️', description: 'Track video performance and audience' },
  { key: 'whatsapp_business', name: 'WhatsApp Business', icon: '💬', description: 'Monitor messaging analytics' },
  { key: 'mailchimp', name: 'Mailchimp', icon: '📧', description: 'Track email campaign performance' },
  { key: 'brevo', name: 'Brevo', icon: '📧', description: 'Monitor email marketing metrics' },
  { key: 'sendgrid', name: 'SendGrid', icon: '📧', description: 'Track email deliverability and engagement' },
];

const CampaignIntegrationsPage = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [days, setDays] = useState(7);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectingBindu, setConnectingBindu] = useState(false);
  const bootstrappedRef = useRef(false);

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches/').then(res => {
      const data = res.data.results || res.data;
      return Array.isArray(data) ? data : [];
    }),
  });

  const { data: integrations, isLoading, refetch } = useQuery({
    queryKey: ['integrations', selectedBranch],
    queryFn: () => {
      const params = selectedBranch !== 'all' ? `?branch=${selectedBranch}` : '';
      return api.get(`/campaigns/integrations/${params}`).then(res => {
        const data = res.data.results || res.data;
        return Array.isArray(data) ? data : [];
      });
    },
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    api.post('/campaigns/integrations/connect-bindu/')
      .then(() => refetch())
      .catch(() => {});
  }, [refetch]);

  const startGoogleSignIn = async () => {
    localStorage.removeItem('oauth_branch_id');
    localStorage.setItem('oauth_platform', 'google_all');
    const redirectUri = window.location.origin + '/campaigns/integrations/callback';
    const res = await api.get('/campaigns/integrations/oauth-url/', {
      params: { platform: 'google_all', redirect_uri: redirectUri }
    });
    window.location.href = res.data.url;
  };

  const handleConnect = async (platform) => {
    const googleOauth = ['google_analytics', 'google_ads', 'google_search_console'];
    if (googleOauth.includes(platform)) {
      try {
        await startGoogleSignIn();
      } catch (err) {
        alert(`Failed to start Google sign-in: ${err.response?.data?.detail || err.message}`);
      }
      return;
    }
    if (platform === 'youtube_analytics' || platform === 'google_all') {
      try {
        setConnectingBindu(true);
        await api.post('/campaigns/integrations/connect-bindu/');
        await refetch();
      } catch (err) {
        alert(`Failed to connect Bindu APIs: ${err.response?.data?.detail || err.message}`);
      } finally {
        setConnectingBindu(false);
      }
      return;
    }
    setSelectedPlatform(platform);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedPlatform(null);
  };

  const handleModalSuccess = () => {
    refetch();
  };

  // Get connected platforms
  const connectedPlatforms = integrations?.map(i => i.platform) || [];
  const availablePlatforms = AVAILABLE_PLATFORMS.filter(
    p => !connectedPlatforms.includes(p.key)
  );

  // Filter integrations by search and status
  const filteredIntegrations = integrations?.filter(integration => {
    const platformName = integration.platform_name?.toLowerCase() || '';
    const accountName = integration.account_name?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    
    // Search match
    const searchMatch = platformName.includes(query) || accountName.includes(query);
    
    // Status match
    let statusMatch = true;
    if (statusFilter === 'connected') statusMatch = integration.is_connected;
    if (statusFilter === 'disconnected') statusMatch = !integration.is_connected;
    if (statusFilter === 'error') statusMatch = !!integration.sync_error;
    
    return searchMatch && statusMatch;
  }) || [];

  // Filter available platforms by search
  const filteredAvailablePlatforms = availablePlatforms.filter(platform => {
    const name = platform.name.toLowerCase();
    const description = platform.description.toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || description.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Settings className="text-primary" />
            Campaign Integrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect external platforms to sync analytics and track campaign performance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => handleConnect('google_all')}
            disabled={connectingBindu}
            className="gap-2 bg-black text-white hover:bg-gray-800"
          >
            {connectingBindu ? 'Refreshing YouTube…' : 'Refresh live YouTube'}
          </Button>
          <Button
            variant="outline"
            onClick={() => startGoogleSignIn().catch((err) => alert(`Failed to start Google sign-in: ${err.response?.data?.detail || err.message}`))}
            className="gap-2"
          >
            Connect Analytics & Search Console
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="text-blue-600 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-blue-900">READ-ONLY Analytics Integration</h3>
              <p className="text-sm text-blue-700 mt-1">
                YouTube subscribers and video count load live from the Bindu channel.
                Google Analytics and Search Console need one Connect with the Bindu Google
                that owns G-BCCC6B1DHX — then those APIs fill this page.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 border rounded-md bg-white text-sm"
          >
            <option value="all">All Branches</option>
            {branchesData?.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-md bg-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
            <option value="error">With Errors</option>
          </select>

          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border rounded-md bg-white text-sm"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Connected Integrations */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Connected Integrations</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : filteredIntegrations.length > 0 ? (
          <div className="grid gap-5 grid-cols-1 min-w-0">
            {filteredIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                days={days}
                refetch={refetch}
                onConnect={handleConnect}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-3">🔌</div>
              <h3 className="font-semibold text-gray-900 mb-1">No integrations connected</h3>
              <p className="text-sm text-gray-500 mb-4">
                Connect your first platform to start syncing analytics
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Available Integrations */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Integrations</h2>
        {filteredAvailablePlatforms.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 min-w-0">
            {filteredAvailablePlatforms.map((platform) => (
              <Card 
                key={platform.key} 
                className="hover:shadow-md transition-shadow cursor-pointer min-w-0"
                onClick={() => handleConnect(platform.key)}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <div className="text-3xl shrink-0">{platform.icon}</div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{platform.name}</CardTitle>
                    </div>
                    <Button size="sm" className="gap-1 shrink-0">
                      <Plus size={14} />
                      Connect
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{platform.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-gray-500">
                {searchQuery ? 'No platforms match your search' : 'All platforms are connected'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Connection Modal */}
      <ConnectionModal
        platform={selectedPlatform}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default CampaignIntegrationsPage;
