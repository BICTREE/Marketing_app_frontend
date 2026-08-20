import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { 
  RefreshCw, 
  Power, 
  Plug, 
  Unplug, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Eye,
  MousePointer2,
  Target,
  Users,
  CreditCard,
  TrendingUp,
  Trash2
} from 'lucide-react';
import SyncStatusBadge from './SyncStatusBadge';
import { Button } from '@/components/ui/button';

// Helper component for metrics
const Metric = ({ label, value, icon: IconComponent, colorClass = "text-[#C9972A]" }) => (
  <div className="min-w-0 bg-white/50 backdrop-blur-sm p-3 rounded-xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-primary/20">
    <div className="flex items-start gap-2 text-gray-500 mb-1 min-w-0">
      <div className={`${colorClass.replace('text', 'bg')}/10 p-1 rounded-md shrink-0`}>
        {React.cloneElement(IconComponent, { size: 14, className: colorClass })}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wide leading-tight opacity-70 line-clamp-2">{label}</span>
    </div>
    <div className={`text-lg font-black tracking-tight tabular-nums truncate ${colorClass}`}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </div>
  </div>
);

const IntegrationCard = ({ integration, days = 7, refetch, onConnect }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

  // Platform styling config
  const platformConfig = {
    facebook_ads: { color: 'text-[#1877F2]', bg: 'bg-[#1877F2]/5', border: 'border-[#1877F2]/20', icon: '📘' },
    instagram_insights: { color: 'text-[#E4405F]', bg: 'bg-[#E4405F]/5', border: 'border-[#E4405F]/20', icon: '📷' },
    google_analytics: { color: 'text-[#34A853]', bg: 'bg-[#34A853]/5', border: 'border-[#34A853]/20', icon: '📊' },
    google_ads: { color: 'text-[#4285F4]', bg: 'bg-[#4285F4]/5', border: 'border-[#4285F4]/20', icon: '📣' },
    youtube_analytics: { color: 'text-[#FF0000]', bg: 'bg-[#FF0000]/5', border: 'border-[#FF0000]/20', icon: '▶️' },
    default: { color: 'text-[#C9972A]', bg: 'bg-[#C9972A]/5', border: 'border-[#C9972A]/20', icon: '🔌' }
  };

  const config = platformConfig[integration.platform] || platformConfig.default;

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['integration-analytics', integration.id, days],
    queryFn: () => api.get(`/campaigns/integrations/${integration.id}/analytics/?days=${days}`).then(res => res.data),
    enabled: integration.is_connected && !integration.needs_reconnect,
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/integrations/${integration.id}/sync/`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-analytics', integration.id] });
      queryClient.invalidateQueries({ queryKey: ['integration-posts', integration.id] });
      refetch();
    },
  });

  const { data: latestPosts, isLoading: postsLoading } = useQuery({
    queryKey: ['integration-posts', integration.id],
    queryFn: () => api.get(`/campaigns/integrations/${integration.id}/latest-posts/`).then(res => res.data),
    enabled: integration.is_connected && (
      integration.platform === 'facebook_ads' || 
      integration.platform === 'instagram_insights' ||
      integration.platform === 'youtube_analytics'
    ) && isExpanded,
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/integrations/${integration.id}/disconnect/`),
    onSuccess: () => refetch(),
  });

  const removeMutation = useMutation({
    mutationFn: () => api.delete(`/campaigns/integrations/${integration.id}/`),
    onSuccess: () => refetch(),
  });

  // Fetch available properties for Google Analytics property selector
  const { data: properties } = useQuery({
    queryKey: ['integration-properties', integration.id],
    queryFn: () => api.get(`/campaigns/integrations/${integration.id}/properties/`).then(res => res.data),
    enabled: integration.is_connected && (
      integration.platform === 'google_analytics' || integration.platform === 'google_ads'
    ),
  });

  const selectPropertyMutation = useMutation({
    mutationFn: ({ property_id, property_name }) => 
      api.post(`/campaigns/integrations/${integration.id}/select-property/`, { property_id, property_name }),
    onSuccess: () => {
      queryClient.invalidateQueries(['integrations']);
      queryClient.invalidateQueries(['integration-analytics', integration.id]);
      if (refetch) refetch();
    }
  });

  const handlePropertyChange = (e) => {
    const selectedId = e.target.value;
    const selectedProp = properties?.find(p => p.id === selectedId);
    if (selectedProp) {
      selectPropertyMutation.mutate({
        property_id: selectedProp.id,
        property_name: selectedProp.name
      });
    }
  };

  const handleSync = (e) => {
    e.stopPropagation();
    syncMutation.mutate();
  };

  const handleDisconnect = (e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to disconnect?')) {
      disconnectMutation.mutate();
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (confirm('This will delete all synced data. Are you sure?')) {
      removeMutation.mutate();
    }
  };

  return (
    <div 
      onClick={() => integration.is_connected && setIsExpanded(!isExpanded)}
      className={`group relative min-w-0 w-full bg-white border ${config.border} rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-lg ${integration.is_connected ? 'cursor-pointer' : ''}`}
    >
      <div className={`pointer-events-none absolute top-0 right-0 w-24 h-24 ${config.bg} rounded-full -mr-10 -mt-10 blur-2xl opacity-40`} />
      
      {/* Header */}
      <div className="p-5 relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`text-3xl p-3 rounded-2xl ${config.bg} shadow-inner shrink-0`}>
              {config.icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-gray-900 leading-tight truncate">{integration.platform_name}</h3>
              <div className="flex flex-col gap-1 mt-1">
                {integration.is_connected ? (
                  <>
                    <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Active Property:
                    </span>
                    { (integration.platform === 'google_analytics' || integration.platform === 'google_ads') && properties && properties.length > 0 ? (
                      <select
                        value={integration.account_id}
                        onChange={handlePropertyChange}
                        disabled={selectPropertyMutation.isPending}
                        className="text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary mt-1 max-w-[180px]"
                      >
                        {properties.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-bold text-gray-700 ml-2.5">
                        {integration.account_name || 'Connected'}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm font-medium text-gray-400">Disconnected</span>
                )}
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <SyncStatusBadge status={integration.needs_reconnect ? 'reconnect' : integration.sync_status} />
          </div>
        </div>
      </div>

      {integration.needs_reconnect && (
        <div className="mx-5 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium leading-relaxed">
          Google is not signed in. Click Reconnect Google once — it connects Ads, Analytics, and YouTube together with live APIs.
        </div>
      )}

      {/* Sync Error Message */}
      {integration.sync_status === 'error' && integration.sync_error && (
        <div className="mx-5 mb-3 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
          ⚠️ {integration.sync_error}
        </div>
      )}

      {/* Platform-Specific Analytics Grid */}
      {integration.is_connected && !integration.needs_reconnect && (
        <div className="px-5 pb-5 grid grid-cols-2 gap-3 relative">
          {analyticsLoading ? (
            <>
              <div className="bg-gray-100 animate-pulse h-16 rounded-xl border border-gray-200/60 flex items-center justify-center text-xs text-gray-400 font-semibold gap-2">
                <Loader2 size={14} className="animate-spin text-gray-500" /> Fetching live metrics...
              </div>
              <div className="bg-gray-100 animate-pulse h-16 rounded-xl border border-gray-200/60" />
              <div className="bg-gray-100 animate-pulse h-16 rounded-xl border border-gray-200/60" />
              <div className="bg-gray-100 animate-pulse h-16 rounded-xl border border-gray-200/60" />
            </>
          ) : integration.platform === 'youtube_analytics' ? (
            <>
              <Metric label="Video Views" value={analytics?.video_views || analytics?.lifetime_views || 0} icon={<Eye />} colorClass="text-[#FF0000]" />
              <Metric label="Engagement / Likes" value={analytics?.engagement ?? analytics?.likes ?? 0} icon={<Target />} colorClass="text-[#FF0000]" />
              <Metric label="Subscribers" value={analytics?.subscribers ?? 0} icon={<Users />} colorClass="text-[#FF0000]" />
              <Metric label="Channel Videos" value={analytics?.video_count ?? 0} icon={<TrendingUp />} colorClass="text-[#FF0000]" />
            </>
          ) : integration.platform === 'google_analytics' ? (
            <>
              <Metric label="Active Visitors" value={analytics?.reach ?? analytics?.clicks ?? 0} icon={<Users />} colorClass="text-[#34A853]" />
              <Metric label="Total Pageviews" value={analytics?.impressions ?? 0} icon={<Eye />} colorClass="text-[#34A853]" />
              <Metric label="Engagements" value={analytics?.engagement ?? 0} icon={<Target />} colorClass="text-[#34A853]" />
              <Metric label="Conversions" value={analytics?.conversions ?? 0} icon={<TrendingUp />} colorClass="text-[#34A853]" />
            </>
          ) : integration.platform === 'google_ads' ? (
            <>
              <Metric label="Ad Impressions" value={analytics?.impressions ?? 0} icon={<Eye />} colorClass="text-[#4285F4]" />
              <Metric label="Ad Clicks" value={analytics?.clicks ?? 0} icon={<MousePointer2 />} colorClass="text-[#4285F4]" />
              <Metric label="Ad Spend" value={`₹${analytics?.spend ?? 0}`} icon={<CreditCard />} colorClass="text-[#4285F4]" />
              <Metric label="Leads Generated" value={analytics?.conversions ?? analytics?.leads ?? 0} icon={<Target />} colorClass="text-[#4285F4]" />
            </>
          ) : (
            <>
              <Metric label="Total Reach" value={analytics?.reach || analytics?.impressions || 0} icon={<Eye />} colorClass={config.color} />
              <Metric label="Engagement" value={analytics?.engagement || 0} icon={<Target />} colorClass={config.color} />
              <Metric label="Ad Spend" value={`₹${analytics?.spend || 0}`} icon={<CreditCard />} colorClass={config.color} />
              <Metric label="Leads" value={analytics?.conversions || analytics?.leads || 0} icon={<TrendingUp />} colorClass={config.color} />
            </>
          )}
        </div>
      )}

      {/* Detailed Feed / Video List */}
      {integration.is_connected && !integration.needs_reconnect && isExpanded && (
        <div className="px-5 pb-5 border-t border-gray-100/80 pt-4 space-y-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>{integration.platform === 'youtube_analytics' ? '🎬 Recent Videos Analytics' : 'Latest Feed / Posts'}</span>
            {postsLoading && <Loader2 size={12} className="animate-spin text-gray-400" />}
          </h4>
          
          {latestPosts && latestPosts.length > 0 ? (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {latestPosts.map((item) => (
                <div key={item.id} className="bg-gray-50/50 hover:bg-gray-50 p-3 rounded-xl border border-gray-100 transition-all flex gap-3">
                  {item.media_url && (
                    <img 
                      src={item.media_url} 
                      alt="Thumbnail" 
                      className="w-16 h-12 object-cover rounded-lg border border-gray-200/50 flex-shrink-0" 
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 line-clamp-1 leading-snug">
                      {item.title || item.caption}
                    </p>
                    {item.title && (
                      <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                        {item.caption}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] font-bold text-gray-500">
                      {item.views !== undefined && (
                        <span className="flex items-center gap-1 text-red-600">
                          👁️ {item.views.toLocaleString()} Views
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-pink-600">
                        ❤️ {item.likes.toLocaleString()} Likes
                      </span>
                      <span className="flex items-center gap-1 text-blue-600">
                        💬 {item.comments.toLocaleString()} Comments
                      </span>
                      {item.watch_hours !== undefined && (
                        <span className="flex items-center gap-1 text-purple-600">
                          ⏱️ {item.watch_hours} Watch Hours
                        </span>
                      )}
                      <span className="ml-auto text-gray-400">
                        {new Date(item.created_time).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !postsLoading ? (
            <p className="text-xs text-gray-400 text-center py-4">No recent content found.</p>
          ) : null}
        </div>
      )}

      {/* Footer Actions */}
      <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 space-y-2 min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {integration.is_connected ? (
            <>
              {!integration.needs_reconnect && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="rounded-xl h-9 px-3 shrink-0 border-gray-200 hover:bg-white"
                >
                  {syncMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} className="mr-1.5" />}
                  Sync
                </Button>
              )}
              {integration.needs_reconnect && (
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onConnect(integration.platform); }}
                  className="rounded-xl h-9 px-3 shrink-0 bg-black hover:bg-gray-800 text-white border-none font-bold"
                >
                  Reconnect Google
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="rounded-xl h-9 px-3 shrink-0 text-gray-600 hover:bg-gray-100 font-bold text-xs gap-1 border border-gray-200"
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {isExpanded ? 'Hide' : 'Details'}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleDisconnect}
                className="rounded-xl h-9 px-2 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
                title="Disconnect"
              >
                <Unplug size={14} />
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                onClick={() => onConnect(integration.platform)}
                className="rounded-xl h-9 px-5 shrink-0 bg-black hover:bg-gray-800 text-white border-none font-bold"
              >
                Connect
              </Button>
              {integration.id && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleRemove}
                  className="rounded-xl h-9 px-3 shrink-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </>
          )}
        </div>
        {integration.last_sync && !integration.needs_reconnect && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Last Sync: {new Date(integration.last_sync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </p>
        )}
      </div>
    </div>
  );
};

export default IntegrationCard;
