import axios from 'axios';

// Production: REACT_APP_API_URL="" → axios dùng relative URL → /api/events → titicket.id.vn/api/events ✓
// Development: fallback về localhost:5001 chỉ khi đang ở dev
const isProduction = process.env.NODE_ENV === 'production';
const API_URL = isProduction
  ? (process.env.REACT_APP_API_URL ?? '')   // ?? không fallback khi empty string
  : (process.env.REACT_APP_API_URL || 'http://localhost:5001');

const api = axios.create({
    baseURL: API_URL
});

// Thêm token vào header nếu có
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
