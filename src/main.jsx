import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'
import 'leaflet/dist/leaflet.css'

// Auto-reload on deployment chunk load errors (handles stale browser cache)
window.addEventListener('error', (event) => {
  const isChunkError = 
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Failed to load module script') ||
    event.message?.includes('Importing a module script failed');

  if (isChunkError) {
    const key = 'chunk_reload_retry';
    const lastReload = sessionStorage.getItem(key);
    if (!lastReload || Date.now() - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem(key, Date.now().toString());
      window.location.reload();
    }
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-right" />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
