// src/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://opmthredds.gem.spc.int/service';
console.info('DEBUG: API_BASE_URL =', API_BASE_URL);
const FALLBACK_API_KEY = process.env.REACT_APP_API_KEY || 'ssshh';

const getApiKey = () => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('admin_api_key') || FALLBACK_API_KEY;
  }
  return FALLBACK_API_KEY;
};

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      ...options.headers,
    },
    ...options,
  };

  // Log payload for POST/PUT for debugging 422 errors
  if (config.method && (config.method === 'POST' || config.method === 'PUT')) {
    if (typeof config.body === 'string') {
      try {
        const bodyObj = JSON.parse(config.body);
        console.log('API payload:', bodyObj);
      } catch (e) {
        console.debug('Unable to log payload JSON', e);
      }
    }
  }

  try {
    const response = await fetch(url, config);

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      if (isJson && responseText) {
        try {
          const errorBody = JSON.parse(responseText);
          if (typeof errorBody === 'string') {
            errorMessage = errorBody;
          } else if (errorBody?.detail) {
            errorMessage = Array.isArray(errorBody.detail)
              ? errorBody.detail.map((item) => item.msg || item).join(', ')
              : errorBody.detail;
          }
        } catch (parseError) {
          console.debug('Failed to parse error response JSON', parseError);
        }
      }
      throw new Error(errorMessage);
    }

    if (!isJson || !responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response', parseError);
      throw new Error('Failed to parse server response');
    }
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

  // Sync Cloud Services
  syncCloud: (data = null) =>
    apiRequest('/cloud/sync', {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  // Get grouping preferences
  getGroupingPreferences: () => apiRequest('/grouping-preferences'),

  // Update grouping preferences
  updateGroupingPreferences: (prefs) =>
    apiRequest('/grouping-preferences', {
      method: 'POST',
      body: JSON.stringify(prefs),
    }),

  // Get refresh interval
  getRefreshInterval: () => apiRequest('/refresh-interval'),

  // Update refresh interval
  updateRefreshInterval: (config) =>
    apiRequest('/refresh-interval', {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  // Get ocean datasets
  getOceanDatasets: () => apiRequest('/ocean/datasets'),

  // Sync ocean datasets
  syncOceanDatasets: () =>
    apiRequest('/ocean/datasets/sync', {
      method: 'POST',
    }),

  // Sync THREDDS services
  syncThreddsServices: () =>
    apiRequest('/thredds/sync', {
      method: 'POST',
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

const apiClient = { servicesApi, monitoringApi, utilityApi };

export default apiClient;