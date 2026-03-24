import axios from 'axios';

// Single axios instance for the entire app, Interceptors handle token injection and automatic token refresh.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  withCredentials: true,  // sends httpOnly refresh token cookie automatically
  timeout: 15000,
});

//  Request interceptor , attach the access token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

//  Response interceptor 
// If a request fails with 401, try refreshing the token once, then replay the original request. This is "silent refresh" —
// the user never sees an error or has to log in again.
let isRefreshing = false;
let pendingQueue = [];  // requests waiting while refresh is in progress

const processQueue = (error, token = null) => {
  pendingQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retried) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retried = true;
      isRefreshing = true;

      try {
        const res = await api.post('/auth/refresh', {});
        const newToken = res.data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
