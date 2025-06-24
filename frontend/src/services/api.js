// src/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'ssshh';

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Handle empty responses (like DELETE requests)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
};

// API functions for your services
export const servicesApi = {
  // Get all services
  getAll: () => apiRequest('/services'),
  
  // Get single service
  getById: (id) => apiRequest(`/services/${id}`),
  
  // Create new service
  create: (serviceData) => 
    apiRequest('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    }),
  
  // Update service
  update: (id, serviceData) =>
    apiRequest(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    }),
  
  // Delete service
  delete: (id) =>
    apiRequest(`/services/${id}`, {
      method: 'DELETE',
    }),
};

// Monitoring API functions
export const monitoringApi = {
  // Monitor all services
  monitorAll: () => apiRequest('/monitor/all', { method: 'POST' }),
  
  // Monitor single service
  monitorSingle: (id) => apiRequest(`/monitor/${id}`, { method: 'POST' }),
  
  // Monitor all in background
  monitorAllBackground: () => 
    apiRequest('/monitor/all/background', { method: 'POST' }),
  
  // Get monitoring logs
  getLogs: (filter = {}) =>
    apiRequest('/monitoring_logs', {
      method: 'POST',
      body: JSON.stringify(filter),
    }),
};

// Utility API functions
export const utilityApi = {
  // Check API status
  getStatus: () => apiRequest('/status'),
  
  // Ping test
  ping: (ip) =>
    apiRequest('/ping', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    }),
  
  // Netcat test
  netcat: (ip, port) =>
    apiRequest('/netcat', {
      method: 'POST',
      body: JSON.stringify({ ip, port }),
    }),
};

export default { servicesApi, monitoringApi, utilityApi };