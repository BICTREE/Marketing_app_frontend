import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';

const SyncStatusBadge = ({ status, size = 'sm' }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const statusConfig = {
    idle: {
      icon: Clock,
      label: 'Idle',
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    syncing: {
      icon: Loader2,
      label: 'Syncing',
      className: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
      spin: true,
    },
    success: {
      icon: CheckCircle2,
      label: 'Synced',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    reconnect: {
      icon: AlertCircle,
      label: 'Reconnect',
      className: 'bg-amber-50 text-amber-800 border-amber-200',
    },
  };

  const config = statusConfig[status] || statusConfig.idle;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses[size]} ${config.className}`}
    >
      <Icon size={iconSize[size]} className={config.spin ? 'animate-spin' : ''} />
      {config.label}
    </span>
  );
};

export default SyncStatusBadge;
