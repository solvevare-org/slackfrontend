// Debug: Check environment variables
// Open browser console and run: window.checkEnv()

import { BACKEND_URL } from './config/api';

window.checkEnv = () => {
  console.log('=== Environment Check ===');
  console.log('VITE_BACKEND_URL:', import.meta.env.VITE_BACKEND_URL);
  console.log('BACKEND_URL:', BACKEND_URL);
  console.log('All env vars:', import.meta.env);
};

console.log('🔍 Run window.checkEnv() to check environment variables');
