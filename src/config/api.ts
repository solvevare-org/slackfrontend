import axios from 'axios';

// Backend server configuration - Force production URL
// Backend server configuration 
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const BACKEND_URL = isLocalhost ? 'http://localhost:6006' : 'http://72.60.97.98:6006';


// Frontend server configuration
export const FRONTEND_PORT = 6007;
export const FRONTEND_ALLOWED_HOSTS = true;

// Centralized Axios instance
export const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);