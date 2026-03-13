import axios from 'axios';

// Backend server configuration - reads from VITE_BACKEND_URL in .env
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://localhost:6004';


// Frontend server configuration
export const FRONTEND_PORT = parseInt(import.meta.env.VITE_PORT || '6007', 10);
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
console.log(BACKEND_URL);