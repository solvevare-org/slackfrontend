// export const API_URL = import.meta.env.VITE_BACKEND_URL ;
// export const SOCKET_URL = API_URL;

export const API_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;
export const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;