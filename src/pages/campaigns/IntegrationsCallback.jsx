import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '@/api/axios';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const IntegrationsCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const processedRef = React.useRef(false);

  useEffect(() => {
    const processCallback = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setErrorMessage(error);
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received from Google.');
        return;
      }

      try {
        const redirectUri = window.location.origin + '/campaigns/integrations/callback';
        const branchId = localStorage.getItem('oauth_branch_id');
        const platform = localStorage.getItem('oauth_platform') || 'google_analytics';
        localStorage.removeItem('oauth_branch_id');
        localStorage.removeItem('oauth_platform');
        
        await api.post('/campaigns/integrations/google-callback/', {
          code,
          redirect_uri: redirectUri,
          branch: branchId,
          platform,
        }, { _skipInterceptor: true });

        setStatus('success');
        setTimeout(() => {
          navigate('/campaigns/settings/integrations');
        }, 2000);
      } catch (err) {
        console.error('OAuth callback failed', err);
        setStatus('error');
        const detail = err.response?.data?.detail;
        const statusText = err.response?.statusText;
        setErrorMessage(detail || statusText || err.message || 'Failed to complete integration.');
      }
    };

    processCallback();
  }, [location, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          {status === 'processing' && (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Completing Integration...</h2>
              <p className="text-muted-foreground">
                We're exchanging your authorization code for secure access tokens.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold text-green-700">Success!</h2>
              <p className="text-muted-foreground">
                Your Google Analytics account has been connected.
              </p>
              <div className="pt-4">
                <button 
                  onClick={() => navigate('/campaigns/settings/integrations')}
                  className="bg-[#C9972A] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#7A5500] transition-colors"
                >
                  Go back to Integrations
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-4 italic">Redirecting automatically in a moment...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold text-destructive">Integration Failed</h2>
              <p className="text-muted-foreground">{errorMessage}</p>
              <button 
                onClick={() => navigate('/campaigns/settings/integrations')}
                className="text-primary hover:underline font-medium"
              >
                Go back and try again
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsCallback;
