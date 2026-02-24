import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, AlertCircle } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const user = searchParams.get('user');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      switch(errorParam) {
        case 'not_invited':
          setError('You are not invited. Please contact your administrator.');
          break;
        case 'oauth_not_configured':
          setError('Google OAuth is not configured on the server.');
          break;
        case 'no_code':
        case 'token_failed':
        case 'no_email':
          setError('Google authentication failed. Please try again.');
          break;
        default:
          setError('Authentication failed. Please try again.');
      }
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    if (token && user) {
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('user', user);
        sessionStorage.removeItem('hasSeenWelcome');
        navigate('/workspace');
      } catch (e) {
        setError('Failed to save credentials');
        setTimeout(() => navigate('/login'), 2000);
      }
    } else {
      setError('Invalid authentication response');
      setTimeout(() => navigate('/login'), 2000);
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0b0d] via-[#1a1d21] to-[#0f1115]">
      <div className="text-center">
        {error ? (
          <div className="bg-gradient-to-br from-[#1a1d21]/90 to-[#0f1115]/90 backdrop-blur-xl border border-red-500/30 p-10 rounded-2xl shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Authentication Failed</h2>
            <p className="text-red-400">{error}</p>
            <p className="text-gray-400 text-sm mt-4">Redirecting to login...</p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#1a1d21]/90 to-[#0f1115]/90 backdrop-blur-xl border border-purple-500/30 p-10 rounded-2xl shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/10 rounded-full flex items-center justify-center animate-pulse">
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Authenticating...</h2>
            <p className="text-gray-400">Please wait while we log you in</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
