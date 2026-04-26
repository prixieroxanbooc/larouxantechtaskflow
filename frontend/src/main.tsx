import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// Apply persisted dark-mode class before first paint to avoid flash
try {
  const saved = localStorage.getItem('tf-theme');
  if (saved && JSON.parse(saved)?.state?.dark) {
    document.documentElement.classList.add('dark');
  }
} catch {}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
