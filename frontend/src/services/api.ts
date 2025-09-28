import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (userData: any) =>
    api.post('/auth/register', userData),
  
  chat: (message: string, sessionId?: string) =>
    api.post('/auth/chat', { message, sessionId }),
  
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

// Users API
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.put('/users/profile', data),
  getKycStatus: () => api.get('/users/kyc'),
  uploadKycDocuments: (documents: FormData) => api.post('/users/kyc/documents', documents),
};

// Accounts API
export const accountsAPI = {
  getAccounts: () => api.get('/accounts'),
  getAccount: (id: string) => api.get(`/accounts/${id}`),
  createAccount: (data: any) => api.post('/accounts', data),
  getBalance: (accountId: string) => api.get(`/accounts/${accountId}/balance`),
};

// Transactions API
export const transactionsAPI = {
  getTransactions: (params?: any) => api.get('/transactions', { params }),
  getTransaction: (id: string) => api.get(`/transactions/${id}`),
  createTransaction: (data: any) => api.post('/transactions', data),
  getTransactionHistory: (params?: any) => api.get('/transactions/history', { params }),
};

// DeFi API
export const defiAPI = {
  getPositions: () => api.get('/defi/positions'),
  supplyToAave: (data: any) => api.post('/defi/aave/supply', data),
  withdrawFromAave: (data: any) => api.post('/defi/aave/withdraw', data),
  swapOnUniswap: (data: any) => api.post('/defi/uniswap/swap', data),
  joinBalancerPool: (data: any) => api.post('/defi/balancer/join', data),
  getAnalytics: () => api.get('/defi/analytics'),
  getRecommendations: (data: any) => api.post('/defi/recommendations', data),
};

// Payments API
export const paymentsAPI = {
  getMethods: () => api.get('/payments/methods'),
  createStripePayment: (data: any) => api.post('/payments/stripe/create-payment-intent', data),
  confirmStripePayment: (data: any) => api.post('/payments/stripe/confirm-payment', data),
  createYumoneyPayment: (data: any) => api.post('/payments/yumoney/create-payment', data),
  createPayeerPayment: (data: any) => api.post('/payments/payeer/create-payment', data),
  createIcardPayment: (data: any) => api.post('/payments/icard/create-payment', data),
  getPaymentHistory: (params?: any) => api.get('/payments/history', { params }),
};

// Exchange API
export const exchangeAPI = {
  getMarketData: (symbol?: string) => api.get('/exchange/bybit/market-data', { params: { symbol } }),
  getBalance: () => api.get('/exchange/bybit/balance'),
  placeOrder: (data: any) => api.post('/exchange/bybit/place-order', data),
  getOrders: (params?: any) => api.get('/exchange/bybit/orders', { params }),
  connectBybit: (data: any) => api.post('/exchange/bybit/connect', data),
  getPairs: (exchange?: string) => api.get('/exchange/pairs', { params: { exchange } }),
  getPriceHistory: (params?: any) => api.get('/exchange/price-history', { params }),
  getStats: () => api.get('/exchange/stats'),
};

// AI API
export const aiAPI = {
  chat: (message: string, sessionId?: string) => api.post('/ai/chat', { message, sessionId }),
  analyzeTransaction: (data: any) => api.post('/ai/analyze-transaction', data),
  getPortfolioAdvice: (data: any) => api.post('/ai/portfolio-advice', data),
  translateText: (text: string, targetLanguage: string) => 
    api.post('/ai/translate', { text, targetLanguage }),
  generateMarketReport: (data: any) => api.post('/ai/market-report', data),
  detectFraud: (data: any) => api.post('/ai/fraud-detection', data),
};

// Tokens API
export const tokensAPI = {
  getBalance: () => api.get('/token/balance'),
  getHistory: (params?: any) => api.get('/token/history', { params }),
  burnTokens: (data: any) => api.post('/token/burn', data),
  earnTokens: (data: any) => api.post('/token/earn', data),
  getStats: () => api.get('/token/stats'),
  transferTokens: (data: any) => api.post('/token/transfer', data),
  getLeaderboard: (params?: any) => api.get('/token/leaderboard', { params }),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  getTransactions: (params?: any) => api.get('/admin/transactions', { params }),
  withdrawFunds: (data: any) => api.post('/admin/withdraw', data),
  getWithdrawals: (params?: any) => api.get('/admin/withdrawals', { params }),
  updateSettings: (data: any) => api.post('/admin/settings', data),
  getSettings: () => api.get('/admin/settings'),
  getHealth: () => api.get('/admin/health'),
};

export default api;