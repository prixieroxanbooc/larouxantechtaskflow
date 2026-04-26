import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import LtHexLogo from '@/components/LtHexLogo';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }
    axios
      .get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('success'))
      .catch((e) => {
        setStatus('error');
        setMessage(e.response?.data?.error || 'Verification failed. The link may have expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-4">
          <LtHexLogo size={52} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Larouxantech TaskFlow</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Email Verification</p>

        {status === 'loading' && (
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Verifying your email…
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-700 font-semibold mb-1">Email verified!</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Your account is now active. You can sign in.</p>
            <Link
              to="/login"
              className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 font-semibold mb-1">Verification failed</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{message}</p>
            <Link to="/register" className="text-brand-600 hover:underline text-sm">
              Back to registration
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
