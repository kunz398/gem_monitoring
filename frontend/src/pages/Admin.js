// src/pages/Admin.js
import React, { useState, useEffect, useCallback } from 'react';
import { servicesApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import '../App.css';

function Admin() {
  const { theme } = useTheme();
  const themeClass = theme ? `theme-${theme}` : 'theme-default';
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('create'); // 'create', 'edit', 'view'
  const [showHelp, setShowHelp] = useState(false);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);
  const [createdServiceId, setCreatedServiceId] = useState(null);
  const [activeTab, setActiveTab] = useState('registration'); // 'registration', 'dashboard'
  const [groupingPreferences, setGroupingPreferences] = useState({
    grouping_mode: 'type',
    group_by_servers: false,
    group_by_datasets: false,
    group_by_ocean_plotters: false,
    group_by_models: false,
    group_by_server_cloud: false
  });
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    port: '',
    protocol: '',
    interval_type: 'seconds',
    interval_value: 60,
    interval_unit: 'seconds',
    comment: '',
    check_interval_sec: 60,
    display_order: '',
    type: '',
    collection: 'uncategorized'
  });

  const protocols = ['http', 'https', 'tcp', 'ping', 'curl', 'heartbeat', 'external', 'api'];
  const serviceTypes = [
    { value: 'servers', label: 'Servers' },
    { value: 'datasets', label: 'Datasets' },
    { value: 'thredds', label: 'THREDDS' },
    { value: 'ocean-plotters', label: 'Ocean Plotters' },
    { value: 'models', label: 'Models' },
    { value: 'server_cloud', label: 'Server Cloud', disabled: true }
  ];
  const intervalTypes = [
    { value: 'seconds', label: 'Seconds' },
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'specific_day', label: 'Specific Day of Month' }
  ];

  const intervalUnits = [
    { value: 'seconds', label: 'Seconds' },
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
    { value: 'weeks', label: 'Weeks' },
    { value: 'months', label: 'Months' }
  ];

  // Check if user is already authenticated on component mount
  useEffect(() => {
    const storedApiKey = sessionStorage.getItem('admin_api_key');
    if (storedApiKey) {
      // Verify the stored key is still valid
      validateApiKey(storedApiKey);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'dashboard') {
      fetchGroupingPreferences();
      fetchRefreshInterval();
    }
  }, [isAuthenticated, activeTab]);

  const fetchGroupingPreferences = async () => {
    try {
      const prefs = await servicesApi.getGroupingPreferences();
      if (prefs) {
        setGroupingPreferences(prefs);
      }
    } catch (err) {
      console.error('Failed to fetch grouping preferences:', err);
    }
  };

  const fetchRefreshInterval = async () => {
    try {
      const config = await servicesApi.getRefreshInterval();
      if (config && config.interval) {
        setRefreshInterval(config.interval);
      }
    } catch (err) {
      console.error('Failed to fetch refresh interval:', err);
    }
  };

  const handleRefreshIntervalChange = async (e) => {
    const newValue = parseInt(e.target.value, 10);
    if (isNaN(newValue) || newValue < 5) {
      alert('Please enter a valid interval (minimum 5 seconds)');
      return;
    }
    setRefreshInterval(newValue);
    try {
      await servicesApi.updateRefreshInterval({ interval: newValue });
    } catch (err) {
      console.error('Failed to update refresh interval:', err);
      alert('Failed to update refresh interval');
    }
  };

  const handleGroupingChange = async (key, value) => {
    const newPrefs = { ...groupingPreferences, [key]: value };
    setGroupingPreferences(newPrefs);
    try {
      await servicesApi.updateGroupingPreferences(newPrefs);
    } catch (err) {
      console.error('Failed to update grouping preferences:', err);
      // Revert on error
      setGroupingPreferences(groupingPreferences);
    }
  };

  const validateApiKey = async (key) => {
    try {
      // Make a test API call to validate the key
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://opmthredds.gem.spc.int/service'}/services`, {
        headers: {
          'X-API-Key': key,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setAuthError('');
        // Store the valid key in session storage
        sessionStorage.setItem('admin_api_key', key);
        return true;
      } else {
        throw new Error('Invalid API key');
      }
    } catch (err) {
      setIsAuthenticated(false);
      setAuthError('Invalid API key. Please check your credentials.');
      sessionStorage.removeItem('admin_api_key');
      return false;
    }
  };

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      ip_address: '',
      port: '',
      protocol: '',
      interval_type: 'seconds',
      interval_value: 60,
      interval_unit: 'seconds',
      comment: '',
      check_interval_sec: 60,
      display_order: '',
      type: '',
      collection: 'uncategorized',
      monitoring_proxy: 'backend'
    });
    setSelectedService(null);
    setShowForm(false);
    setFormMode('create');
  }, []);

  const handleApiKeySubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!apiKeyInput.trim()) {
      setAuthError('Please enter an API key');
      return;
    }

    const isValid = await validateApiKey(apiKeyInput);
    if (isValid) {
      setApiKeyInput(''); // Clear the input for security
    }
  };

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
    setApiKeyInput('');
    setAuthError('');
    setServices([]);
    sessionStorage.removeItem('admin_api_key');
    // Reset all form state
    resetForm();
  }, [resetForm]);

  const handleBackToDashboard = () => {
    // Navigate back to dashboard - you might want to use React Router here
    window.location.href = '/monitoring/';
  };

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await servicesApi.getAll();
      const sortedServices = [...(data || [])].sort((a, b) => {
        const orderA = a.display_order;
        const orderB = b.display_order;

        const hasOrderA = typeof orderA === 'number';
        const hasOrderB = typeof orderB === 'number';

        if (hasOrderA && hasOrderB) {
          if (orderA === orderB) {
            return a.id - b.id;
          }
          return orderA - orderB;
        }
        if (hasOrderA) return -1;
        if (hasOrderB) return 1;
        return a.id - b.id;
      });
      setServices(sortedServices);
    } catch (err) {
      setError(err.message || err.output);
      setServices([]);
      // If we get an auth error, logout
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchServices();
    }
  }, [isAuthenticated, fetchServices]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      // If protocol is changed to external, clear port and set default intervals
      if (name === 'protocol' && value === 'external') {
        return {
          ...prev,
          protocol: value,
          port: '',
          interval_type: 'seconds',
          interval_value: 60,
          interval_unit: 'seconds'
        };
      }

      // If protocol is changed from external to something else, set defaults
      if (name === 'protocol' && prev.protocol === 'external' && value !== 'external') {
        return {
          ...prev,
          protocol: value,
          interval_type: 'seconds',
          interval_value: 60,
          interval_unit: 'seconds'
        };
      }
      // If protocol changes to http/https, clear port
      if (name === 'protocol') {
        if (value === 'http' || value === 'https') {
          return {
            ...prev,
            protocol: value,
            port: '',
          };
        }
        return {
          ...prev,
          protocol: value
        };
      }
      if (name === 'port') {
        if (value === '') {
          return {
            ...prev,
            port: ''
          };
        }
        const parsedPort = parseInt(value, 10);
        return Number.isNaN(parsedPort)
          ? prev
          : {
            ...prev,
            port: parsedPort
          };
      }
      if (name === 'interval_value' || name === 'check_interval_sec' || name === 'display_order') {
        if (value === '') {
          return {
            ...prev,
            [name]: ''
          };
        }
        const parsedNumber = parseInt(value, 10);
        return Number.isNaN(parsedNumber)
          ? prev
          : {
            ...prev,
            [name]: parsedNumber
          };
      }
      return {
        ...prev,
        [name]: value
      };
    });
  };


  const handleSyncCloud = async () => {
    setLoading(true);
    try {
      // 1. Try Backend Sync first (Cleanest if it worked)
      let result;
      try {
        result = await servicesApi.syncCloud();
      } catch (backendError) {
        // Check if error is related to network/timeout (VPN issue)
        const msg = backendError.message.toLowerCase();
        const isNetworkError = msg.includes('504') ||
          msg.includes('502') ||
          msg.includes('timeout') ||
          msg.includes('timed out') ||
          msg.includes('connection refused');

        if (isNetworkError) {
          console.warn("Backend failed to reach cloud (likely VPN isolation). Attempting Frontend Fetch...");

          // 2. Frontend Fetch Fallback
          // Credentials (from existing backend config)
          const CLOUD_AUTH_URL = "https://cloud-monitoring.corp.spc.int/api/collections/users/auth-with-password";
          const CLOUD_RECORDS_URL = "https://cloud-monitoring.corp.spc.int/api/collections/systems/records";
          const IDENTITY = "divesha@spc.int";
          const PASSWORD = "Un2345678";

          try {
            // A. Authenticate
            const authRes = await fetch(CLOUD_AUTH_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ identity: IDENTITY, password: PASSWORD })
            });

            if (!authRes.ok) throw new Error(`Frontend Auth Failed: ${authRes.status}`);
            const authData = await authRes.json();
            const token = authData.token;

            // B. Fetch Items
            const itemsRes = await fetch(CLOUD_RECORDS_URL, {
              headers: { "Authorization": `Bearer ${token}` }
            });

            if (!itemsRes.ok) throw new Error(`Frontend Fetch Failed: ${itemsRes.status}`);
            const data = await itemsRes.json();

            // C. Send to Backend
            console.info(`Frontend fetched ${data.items ? data.items.length : 0} items. Sending to backend...`);
            result = await servicesApi.syncCloud(data);

          } catch (feError) {
            console.error("Frontend Fallback also failed:", feError);
            throw new Error(`Both Backend and Frontend sync failed. Backend: ${backendError.message}. Frontend: ${feError.message}`);
          }
        } else {
          throw backendError; // Re-throw non-network errors
        }
      }

      if (result && result.items) {
        const count = result.items.length;
        alert(`Cloud Sync Complete: Processed ${count} systems from cloud.`);
      } else {
        alert('Cloud Sync completed.');
      }
      await fetchServices();
    } catch (err) {
      console.error('Cloud sync error:', err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDatasets = async () => {
    setLoading(true);
    try {
      const result = await servicesApi.syncOceanDatasets();

      if (result && result.message) {
        alert(`Dataset Sync Complete: ${result.message}`);
      } else {
        alert('Dataset Sync completed.');
      }
      await fetchServices();
    } catch (err) {
      console.error('Dataset sync error:', err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncThredds = async () => {
    setLoading(true);
    try {
      const result = await servicesApi.syncThreddsServices();

      if (result && result.message) {
        alert(`THREDDS Sync Complete: ${result.message}`);
      } else {
        alert('THREDDS Sync completed.');
      }
      await fetchServices();
    } catch (err) {
      console.error('THREDDS sync error:', err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormMode('create');
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (service) => {
    setFormMode('edit');
    setSelectedService(service);
    setFormData({
      name: service.name,
      ip_address: service.ip_address,
      port: service.protocol === 'http' || service.protocol === 'https' ? '' : service.port,
      protocol: service.protocol,
      interval_type: service.interval_type,
      interval_value: service.interval_value,
      interval_unit: service.interval_unit,
      comment: service.comment || '',
      check_interval_sec: service.check_interval_sec || 60,
      display_order: typeof service.display_order === 'number' ? service.display_order : '',
      type: service.type || 'servers',
      collection: service.collection || 'uncategorized',
      monitoring_proxy: service.monitoring_proxy || 'backend'
    });
    setShowForm(true);
  };

  const handleView = async (serviceId) => {
    try {
      const service = await servicesApi.getById(serviceId);
      setSelectedService(service);
      setFormMode('view');
      setFormData({
        name: service.name,
        ip_address: service.ip_address,
        port: service.protocol === 'http' || service.protocol === 'https' ? '' : service.port,
        protocol: service.protocol,
        interval_type: service.interval_type,
        interval_value: service.interval_value,
        interval_unit: service.interval_unit,
        comment: service.comment || '',
        check_interval_sec: service.check_interval_sec || 60,
        display_order: typeof service.display_order === 'number' ? service.display_order : '',
        type: service.type || 'servers',
        collection: service.collection || 'uncategorized',
        monitoring_proxy: service.monitoring_proxy || 'backend'
      });
      setShowForm(true);
    } catch (err) {
      alert(`Failed to fetch service: ${err.message}`);
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        handleLogout();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Prepare payload: only include port if protocol is not http/https
      // For external services, interval values are optional
      const isExternal = formData.protocol === 'external';

      const normalizedIntervalValue = isExternal ? 60 :
        (formData.interval_value === '' ? 1 : parseInt(formData.interval_value, 10));
      const normalizedCheckInterval = isExternal ? 60 :
        (formData.check_interval_sec === '' ? 60 : parseInt(formData.check_interval_sec, 10));
      const normalizedDisplayOrder =
        formData.display_order === '' ? null : parseInt(formData.display_order, 10);

      // Only validate interval values for non-external services
      if (!isExternal) {
        if (!Number.isInteger(normalizedIntervalValue) || normalizedIntervalValue <= 0) {
          alert('Please enter a positive number for the interval value.');
          setLoading(false);
          return;
        }

        if (!Number.isInteger(normalizedCheckInterval) || normalizedCheckInterval <= 0) {
          alert('Please enter a positive number for the check interval (seconds).');
          setLoading(false);
          return;
        }
      }

      if (normalizedDisplayOrder !== null) {
        if (!Number.isInteger(normalizedDisplayOrder) || normalizedDisplayOrder < 0) {
          alert('Please enter a non-negative whole number for the display position.');
          setLoading(false);
          return;
        }
      }

      const payload = {
        ...formData,
        interval_value: normalizedIntervalValue,
        check_interval_sec: normalizedCheckInterval,
        display_order: normalizedDisplayOrder
      };

      // Handle port based on protocol
      if (payload.protocol === 'external') {
        payload.port = 0; // External services don't use ports, set to 0
      } else if (payload.protocol === 'http' || payload.protocol === 'https') {
        delete payload.port;
      } else if (payload.protocol === 'ping') {
        payload.port = 0; // Ping doesn't use ports, set to 0
      } else {
        const parsedPort = Number(formData.port);
        if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
          alert('Please enter a valid port between 1 and 65535 for this protocol.');
          setLoading(false);
          return;
        }
        payload.port = parsedPort;
      }

      payload.comment = payload.comment?.trim() || null;
      if (payload.display_order === null) {
        delete payload.display_order;
      }

      if (formMode === 'create') {
        const result = await servicesApi.create(payload);

        // If external service, show code snippet with the service ID
        if (payload.protocol === 'external' && result && result.id) {
          setCreatedServiceId(result.id);
          setShowCodeSnippet(true);
        } else {
          alert('Service created successfully!');
        }
      } else if (formMode === 'edit') {
        await servicesApi.update(selectedService.id, payload);
        alert('Service updated successfully!');
      }
      resetForm();
      await fetchServices();
    } catch (err) {
      alert(`Operation failed: ${err.message}`);
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (serviceId, serviceName) => {
    if (window.confirm(`Are you sure you want to delete "${serviceName}"? This action cannot be undone.`)) {
      try {
        setLoading(true);
        await servicesApi.delete(serviceId);
        alert('Service deleted successfully!');
        await fetchServices();
      } catch (err) {
        alert(`Delete failed: ${err.message}`);
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          handleLogout();
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  // Helper function to get interval description
  const getIntervalDescription = () => {
    const { interval_type, interval_value } = formData;

    switch (interval_type) {
      case 'seconds':
        return `Check every ${interval_value} second${interval_value > 1 ? 's' : ''}`;
      case 'minutes':
        return `Check every ${interval_value} minute${interval_value > 1 ? 's' : ''}`;
      case 'hours':
        return `Check every ${interval_value} hour${interval_value > 1 ? 's' : ''}`;
      case 'daily':
        return `Check every ${interval_value} day${interval_value > 1 ? 's' : ''} at midnight`;
      case 'weekly':
        return `Check every ${interval_value} week${interval_value > 1 ? 's' : ''} on Sunday at midnight`;
      case 'monthly':
        return `Check every ${interval_value} month${interval_value > 1 ? 's' : ''} on the 1st at midnight`;
      case 'specific_day':
        return `Check on the ${interval_value}${getDaySuffix(interval_value)} day of every month at midnight`;
      default:
        return '';
    }
  };

  const getDaySuffix = (day) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Helper function to get interval description for a specific service
  const getServiceIntervalDescription = (service) => {
    const { interval_type, interval_value } = service;

    switch (interval_type) {
      case 'seconds':
        return `Every ${interval_value}s`;
      case 'minutes':
        return `Every ${interval_value}m`;
      case 'hours':
        return `Every ${interval_value}h`;
      case 'daily':
        return `Every ${interval_value} day${interval_value > 1 ? 's' : ''}`;
      case 'weekly':
        return `Every ${interval_value} week${interval_value > 1 ? 's' : ''}`;
      case 'monthly':
        return `Every ${interval_value} month${interval_value > 1 ? 's' : ''}`;
      case 'specific_day':
        return `${interval_value}${getDaySuffix(interval_value)} of month`;
      default:
        return 'Unknown';
    }
  };

  // If not authenticated, show login form
  if (!isAuthenticated) {
    return (
      <div className={`dashboard ${themeClass}`}>
        <header className="app-header">
          <h1>Admin Panel - Authentication Required</h1>
          <div className="header-controls">
            <button
              onClick={handleBackToDashboard}
              className="btn btn-secondary"
            >
              ← Back to Dashboard
            </button>
            <ThemeToggle />
          </div>
        </header>

        <main className="main-content">
          <div className="auth-container">
            <div className="auth-card">
              <h2>Admin Access</h2>
              <p>Please enter your API key to access the admin panel.</p>

              <form onSubmit={handleApiKeySubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="apiKey">API Key</label>
                  <div className="password-input-container">
                    <input
                      type={showApiKey ? "text" : "password"}
                      id="apiKey"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="Enter your API key"
                      required
                      className={authError ? 'error' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="password-toggle"
                      title={showApiKey ? "Hide API key" : "Show API key"}
                    >
                      {showApiKey ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="error-message">
                    <strong>Error:</strong> {authError}
                  </div>
                )}

                <button type="submit" className="btn btn-primary">
                  Authenticate
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If authenticated, show the normal admin interface
  return (
    <div className={`dashboard ${themeClass}`}>
      <header className="app-header">
        <h1>Admin Panel - Service Management</h1>
        <div className="header-controls">
          <button
            onClick={handleBackToDashboard}
            className="btn btn-secondary"
          >
            ← Back to Dashboard
          </button>
          <button onClick={handleLogout} className="btn btn-danger">
            Logout
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="main-content">
        <div className="tabs-container" style={{ marginBottom: '20px', borderBottom: '1px solid #ccc' }}>
          <button
            onClick={() => setActiveTab('registration')}
            style={{
              padding: '10px 20px',
              marginRight: '5px',
              border: 'none',
              borderBottom: activeTab === 'registration' ? '3px solid #007bff' : 'none',
              background: 'transparent',
              fontWeight: activeTab === 'registration' ? 'bold' : 'normal',
              cursor: 'pointer',
              color: 'inherit'
            }}
          >
            Service Registration
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              padding: '10px 20px',
              marginRight: '5px',
              border: 'none',
              borderBottom: activeTab === 'dashboard' ? '3px solid #007bff' : 'none',
              background: 'transparent',
              fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal',
              cursor: 'pointer',
              color: 'inherit'
            }}
          >
            Dashboard Config
          </button>
        </div>

        {activeTab === 'registration' && (
          <>
            <div className="controls">
              <button
                onClick={handleCreate}
                disabled={loading}
                className="btn btn-primary"
              >
                Create New Service
              </button>
              <button
                onClick={fetchServices}
                disabled={loading}
                className="btn btn-secondary"
              >
                {loading ? 'Loading...' : 'Refresh Services'}
              </button>
              <button
                onClick={handleSyncCloud}
                disabled={loading}
                className="btn btn-info"
                style={{ marginLeft: '10px', backgroundColor: '#17a2b8', color: 'white' }}
                title="Fetch services from Cloud Monitoring"
              >
                ☁️ Sync Cloud
              </button>
              <button
                onClick={handleSyncDatasets}
                disabled={loading}
                className="btn btn-info"
                style={{ marginLeft: '10px', backgroundColor: '#10b981', color: 'white' }}
                title="Fetch datasets from Ocean Middleware"
              >
                📊 Sync Datasets
              </button>
              <button
                onClick={handleSyncThredds}
                disabled={loading}
                className="btn btn-info"
                style={{ marginLeft: '10px', backgroundColor: '#8b5cf6', color: 'white' }}
                title="Fetch THREDDS services from Ocean Middleware"
              >
                🌊 Sync THREDDS
              </button>
              {/* <button 
            onClick={() => setShowHelp(!showHelp)} 
            className="btn btn-help"
            title="Quick Help"
          >
            📚 Quick Help
          </button> */}
            </div>

            {/* Quick Help Section */}
            {showHelp && (
              <div className="quick-help">
                <h3>🚀 Quick Start Guide</h3>
                <div className="quick-help-content">
                  <div className="quick-help-item">
                    <h4>1. Create a Service</h4>
                    <p>Click "Create New Service" and fill in the details. The form will show you exactly what your monitoring interval means.</p>
                  </div>
                  <div className="quick-help-item">
                    <h4>2. Choose Your Interval</h4>
                    <p><strong>Seconds:</strong> For critical services (30-60s)<br />
                      <strong>Minutes:</strong> For web servers (1-15min)<br />
                      <strong>Hours:</strong> For backup servers<br />
                      <strong>Daily/Weekly/Monthly:</strong> For maintenance</p>
                  </div>
                  <div className="quick-help-item">
                    <h4>3. Monitor & Manage</h4>
                    <p>View your services in the table below. Use the action buttons to view details, edit, or delete services.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="btn btn-secondary"
                >
                  Got it!
                </button>
              </div>
            )}

            {error && <div className="error-message"><strong>Error:</strong> {error}</div>}

            {/* Service Form Modal */}
            {showForm && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <div className="modal-header">
                    <h2>
                      {formMode === 'create' && 'Create New Service'}
                      {formMode === 'edit' && `Edit Service: ${selectedService?.name}`}
                      {formMode === 'view' && `View Service: ${selectedService?.name}`}
                    </h2>
                    <div className="modal-header-controls">
                      {formMode === 'create' && (
                        <button
                          type="button"
                          onClick={() => setShowHelp(!showHelp)}
                          className="btn btn-help"
                          title="Show/Hide Help"
                        >
                          {showHelp ? 'Hide Help' : 'Show Help'}
                        </button>
                      )}
                      <button
                        onClick={resetForm}
                        className="btn-close"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Help Section */}
                  {showHelp && formMode === 'create' && (
                    <div className="help-section">
                      <h3>📚 How to Set Up Monitoring Intervals</h3>

                      <div className="help-examples">
                        <h4>🕐 Common Examples:</h4>

                        <div className="example-grid">
                          <div className="example-card">
                            <h5>Every 30 seconds</h5>
                            <div className="example-settings">
                              <span><strong>Type:</strong> Seconds</span>
                              <span><strong>Value:</strong> 30</span>
                              <span><strong>Unit:</strong> Seconds</span>
                            </div>
                            <p>Perfect for critical services that need frequent monitoring</p>
                          </div>

                          <div className="example-card">
                            <h5>Every 5 minutes</h5>
                            <div className="example-settings">
                              <span><strong>Type:</strong> Minutes</span>
                              <span><strong>Value:</strong> 5</span>
                              <span><strong>Unit:</strong> Minutes</span>
                            </div>
                            <p>Good for web servers and databases</p>
                          </div>

                          <div className="example-card">
                            <h5>Every 2 hours</h5>
                            <div className="example-settings">
                              <span><strong>Type:</strong> Hours</span>
                              <span><strong>Value:</strong> 2</span>
                              <span><strong>Unit:</strong> Hours</span>
                            </div>
                            <p>Suitable for backup servers and non-critical services</p>
                          </div>

                          <div className="example-card">
                            <h5>Daily at midnight</h5>
                            <div className="example-settings">
                              <span><strong>Type:</strong> Daily</span>
                              <span><strong>Value:</strong> 1</span>
                              <span><strong>Unit:</strong> Days</span>
                            </div>
                            <p>For daily maintenance and report servers</p>
                          </div>

                          <div className="example-card">
                            <h5>Weekly on Sunday</h5>
                            <div className="example-settings">
                              <span><strong>Type:</strong> Weekly</span>
                              <span><strong>Value:</strong> 1</span>
                              <span><strong>Unit:</strong> Weeks</span>
                            </div>
                            <p>For weekly backup and maintenance tasks</p>
                          </div>

                          <div className="example-card">
                            <h5>15th day of month</h5>
                            <div className="example-settings">
                              <span><strong>Type:</strong> Specific Day</span>
                              <span><strong>Value:</strong> 15</span>
                              <span><strong>Unit:</strong> Days</span>
                            </div>
                            <p>For monthly billing or maintenance checks</p>
                          </div>
                        </div>

                        <div className="help-tips">
                          <h4>💡 Tips:</h4>
                          <ul>
                            <li><strong>Seconds:</strong> Use for critical services (30-60 seconds)</li>
                            <li><strong>Minutes:</strong> Good for most web services (1-15 minutes)</li>
                            <li><strong>Hours:</strong> For backup servers and non-critical services</li>
                            <li><strong>Daily/Weekly/Monthly:</strong> For maintenance and reporting</li>
                            <li><strong>Specific Day:</strong> Choose any day 1-31 for monthly checks</li>
                          </ul>
                        </div>

                        <div className="help-note">
                          <h4>⚠️ Important:</h4>
                          <p><strong>Seconds Intervals:</strong> Due to cron limitations, services with seconds intervals will actually run every minute (60 seconds minimum). For true sub-minute monitoring, consider using minutes intervals instead.</p>
                          <p>More frequent checks (seconds/minutes) will generate more monitoring data and use more resources. Choose the interval that balances your monitoring needs with system performance.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="service-form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label htmlFor="type">Service Type</label>
                        <select
                          id="type"
                          name="type"
                          value={formData.type}
                          onChange={handleInputChange}
                          disabled={formMode === 'view'}
                          required
                        >
                          <option value="" disabled>Select Service Type</option>
                          {serviceTypes.map(type => (
                            <option key={type.value} value={type.value} disabled={type.disabled}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="monitoring_proxy">Monitoring Proxy</label>
                        <select
                          id="monitoring_proxy"
                          name="monitoring_proxy"
                          value={formData.monitoring_proxy || 'backend'}
                          onChange={handleInputChange}
                          disabled={formMode === 'view'}
                        >
                          <option value="backend">Backend (Server)</option>
                          <option value="frontend">Frontend (Browser)</option>
                        </select>
                        <p className="field-help" style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.8 }}>
                          Choose Browser if the server cannot reach this URL.
                        </p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="collection">Collection</label>
                        <input
                          type="text"
                          id="collection"
                          name="collection"
                          value={formData.collection}
                          onChange={handleInputChange}
                          disabled={formMode === 'view'}
                          placeholder="e.g., uncategorized"
                        />
                      </div>


                      <div className="form-group">
                        <label htmlFor="protocol">Protocol *</label>
                        <select
                          id="protocol"
                          name="protocol"
                          value={formData.protocol}
                          onChange={handleInputChange}
                          required
                          disabled={formMode === 'view'}
                        >
                          <option value="" disabled>Select Protocol</option>
                          {protocols.map(protocol => (
                            <option key={protocol} value={protocol}>
                              {protocol.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor="name">Service Name *</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          disabled={formMode === 'view' || !formData.type || !formData.protocol}
                          placeholder="e.g., My Web Server"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="ip_address">IP Address/Domain *</label>
                        <input
                          type="text"
                          id="ip_address"
                          name="ip_address"
                          value={formData.ip_address}
                          onChange={handleInputChange}
                          required
                          disabled={formMode === 'view' || !formData.type || !formData.protocol}
                          placeholder="e.g., 192.168.1.10 or example.com"
                        />
                      </div>

                      {/* Only show port if protocol is not http/https/external/ping */}
                      {(formData.protocol !== 'http' && formData.protocol !== 'https' && formData.protocol !== 'external' && formData.protocol !== 'ping') && (
                        <div className="form-group">
                          <label htmlFor="port">Port</label>
                          <input
                            type="number"
                            id="port"
                            name="port"
                            value={formData.port}
                            onChange={handleInputChange}
                            min="0"
                            max="65535"
                            disabled={formMode === 'view' || !formData.type || !formData.protocol}
                            placeholder="e.g., 80, 443, 8080"
                          />
                        </div>
                      )}

                      {formData.protocol !== 'external' && (
                        <div className="form-group">
                          <label htmlFor="interval_type">Interval Type *</label>
                          <select
                            id="interval_type"
                            name="interval_type"
                            value={formData.interval_type}
                            onChange={handleInputChange}
                            required={formData.protocol !== 'external'}
                            disabled={formMode === 'view' || !formData.type || !formData.protocol}
                          >
                            {intervalTypes.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {formData.protocol !== 'external' && (
                        <div className="form-group">
                          <label htmlFor="interval_value">Interval Value *</label>
                          <input
                            type="number"
                            id="interval_value"
                            name="interval_value"
                            value={formData.interval_value}
                            onChange={handleInputChange}
                            min="1"
                            max={formData.interval_type === 'specific_day' ? 31 : 999}
                            required={formData.protocol !== 'external'}
                            disabled={formMode === 'view' || !formData.type || !formData.protocol}
                            placeholder={formData.interval_type === 'specific_day' ? "1-31" : "e.g., 1, 5, 15"}
                          />
                        </div>
                      )}

                      {formData.protocol !== 'external' && (
                        <div className="form-group">
                          <label htmlFor="interval_unit">Interval Unit *</label>
                          <select
                            id="interval_unit"
                            name="interval_unit"
                            value={formData.interval_unit}
                            onChange={handleInputChange}
                            required={formData.protocol !== 'external'}
                            disabled={formMode === 'view' || !formData.type || !formData.protocol}
                          >
                            {intervalUnits.map(unit => (
                              <option key={unit.value} value={unit.value}>
                                {unit.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="form-group">
                        <label htmlFor="display_order">Display Position</label>
                        <input
                          type="number"
                          id="display_order"
                          name="display_order"
                          value={formData.display_order}
                          onChange={handleInputChange}
                          min="0"
                          disabled={formMode === 'view' || !formData.type || !formData.protocol}
                          placeholder="0 = Show first"
                        />
                      </div>

                      <div className="form-group full-width">
                        {formData.protocol === 'external' ? (
                          <>
                            <label>External Service Info</label>
                            <div className="interval-description" style={{ color: '#2196F3' }}>
                              <strong>📡 This service will be monitored externally via API calls.</strong>
                              <p style={{ fontSize: '0.9em', marginTop: '0.5rem' }}>
                                Use the <code>/service/monitor_log</code> endpoint to send status updates from your external application.
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <label>Interval Description</label>
                            <div className="interval-description">
                              <strong>{getIntervalDescription()}</strong>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="form-group full-width">
                        <label htmlFor="comment">Comment</label>
                        <textarea
                          id="comment"
                          name="comment"
                          value={formData.comment}
                          onChange={handleInputChange}
                          rows="3"
                          disabled={formMode === 'view' || !formData.type || !formData.protocol}
                          placeholder="Optional description or notes about this service"
                        />
                      </div>
                    </div>

                    {formMode === 'view' && selectedService && (
                      <div className="service-metadata">
                        <h3>Service Information</h3>
                        <div className="metadata-grid">
                          <p><strong>ID:</strong> {selectedService.id}</p>
                          <p><strong>Collection:</strong> {selectedService.collection || 'uncategorized'}</p>
                          <p><strong>Status:</strong>
                            <span className={`status-badge ${selectedService.last_status}`}>
                              {selectedService.last_status}
                            </span>
                          </p>
                          <p><strong>Success Count:</strong> {selectedService.success_count}</p>
                          <p><strong>Failure Count:</strong> {selectedService.failure_count}</p>
                          <p><strong>Created:</strong> {formatDate(selectedService.created_at)}</p>
                          <p><strong>Updated:</strong> {formatDate(selectedService.updated_at)}</p>
                          {selectedService.checked_at && (
                            <p><strong>Last Checked:</strong> {formatDate(selectedService.checked_at)}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                      {formMode !== 'view' && (
                        <button
                          type="submit"
                          disabled={loading}
                          className="btn btn-primary"
                        >
                          {loading ? 'Saving...' : (formMode === 'create' ? 'Create Service' : 'Update Service')}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Services Table */}
            {!loading && (services || []).length > 0 && (
              <div className="services-table-container">
                <table className="services-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Order</th>
                      <th>Name</th>
                      <th>Collection</th>
                      <th>Address</th>
                      <th>Protocol</th>
                      <th>Status</th>
                      <th>Interval</th>
                      <th>Success/Failure</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(services || []).map((service) => (
                      <tr key={service.id}>
                        <td>{service.id}</td>
                        <td>{typeof service.display_order === 'number' ? service.display_order : '—'}</td>
                        <td>{service.name}</td>
                        <td>{service.collection || 'uncategorized'}</td>
                        <td>{service.ip_address}:{service.port}</td>
                        <td>
                          <span className="protocol-badge">{service.protocol.toUpperCase()}</span>
                        </td>
                        <td>
                          <span className={`status-badge ${service.last_status}`}>
                            {service.last_status}
                          </span>
                        </td>
                        <td>{getServiceIntervalDescription(service)}</td>
                        <td>{service.success_count}/{service.failure_count}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => handleView(service.id)}
                              className="btn btn-small btn-info"
                              title="View Details"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleEdit(service)}
                              className="btn btn-small btn-warning"
                              title="Edit Service"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(service.id, service.name)}
                              className="btn btn-small btn-danger"
                              title="Delete Service"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                <span>Loading services...</span>
              </div>
            )}

            {!loading && (services || []).length === 0 && !error && (
              <div className="no-data">
                <p>No services found. Create your first service to get started!</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'dashboard' && (
          <div className="dashboard-config-tab">
            <h2>Dashboard Configuration</h2>
            <div className="config-section">
              <h3>Grouping Settings</h3>
              <p className="help-text">
                Choose how you want to group your services on the dashboard.
              </p>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Grouping Mode:</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="grouping_mode"
                      value="type"
                      checked={groupingPreferences.grouping_mode === 'type'}
                      onChange={() => handleGroupingChange('grouping_mode', 'type')}
                      style={{ marginRight: '8px' }}
                    />
                    By Service Type
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="grouping_mode"
                      value="collection"
                      checked={groupingPreferences.grouping_mode === 'collection'}
                      onChange={() => handleGroupingChange('grouping_mode', 'collection')}
                      style={{ marginRight: '8px' }}
                    />
                    By Collection
                  </label>
                </div>
              </div>

              {groupingPreferences.grouping_mode === 'type' && (
                <>
                  <p className="help-text">
                    Enable grouping for specific service types. Services of enabled types will be grouped together into a single summary card.
                  </p>
                  <div className="grouping-toggles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    {serviceTypes.map((type) => {
                      // Map service type value to preference key
                      // servers -> group_by_servers
                      // server_cloud -> group_by_server_cloud
                      const prefKey = `group_by_${type.value.replace('-', '_')}`;

                      return (
                        <div key={type.value} className="form-group" style={{ marginBottom: 0 }}>
                          <div className="toggle-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <label className="theme-switch">
                              <input
                                type="checkbox"
                                checked={!!groupingPreferences[prefKey]}
                                onChange={(e) => handleGroupingChange(prefKey, e.target.checked)}
                              />
                              <span className="slider"></span>
                            </label>
                            <span className="toggle-label">
                              Group {type.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {groupingPreferences.grouping_mode === 'collection' && (
                <div className="info-box" style={{ marginTop: '20px', padding: '15px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <p><strong>ℹ️ Collection Grouping Enabled</strong></p>
                  <p>Services will be automatically grouped by their assigned "Collection" name. Services without a collection will appear in "Uncategorized".</p>
                </div>
              )}
            </div>

            <div className="config-section" style={{ marginTop: '30px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3>Dashboard Refresh Interval</h3>
              <p className="help-text">
                Set how often the dashboard should automatically refresh data (in seconds).
              </p>
              <div className="form-group" style={{ maxWidth: '300px' }}>
                <label htmlFor="refreshInterval">Refresh Interval (seconds):</label>
                <input
                  type="number"
                  id="refreshInterval"
                  className="form-control"
                  value={refreshInterval}
                  onChange={handleRefreshIntervalChange}
                  min="5"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Code Snippet Modal for External Services */}
      {showCodeSnippet && (
        <div className="modal-overlay" onClick={() => setShowCodeSnippet(false)}>
          <div className="modal-content code-snippet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎉 External Service Created!</h2>
              <button className="modal-close" onClick={() => setShowCodeSnippet(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="code-snippet-intro">
                Use this code snippet to send status updates from your application:
              </p>
              <pre className="code-snippet">
                {`import requests

API_URL = 'https://opmthredds.gem.spc.int/monitor_log'
API_KEY = 'ssshh'
SERVICE_ID = ${createdServiceId}

def monitor_logs(payload: dict):
    """Send monitoring log to API and print the response."""

    HEADERS = {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
    }

    response = requests.post(API_URL, json=payload, headers=HEADERS)

    try:
        print("Response JSON:", response.json())
    except Exception:
        print("Response Text:", response.text)

def main():
    # Positive test case: service is up
    positive_payload = {
        "service_id": SERVICE_ID,
        "status": "up",
        "message": "Model finished successfully.",
        "comment": "Service started successfully."
    }

    # Negative test case: service is down
    negative_payload = {
        "service_id": SERVICE_ID,
        "status": "down",
        "message": "Model failed.",
        "comment": "Service failed to start."
    }

    monitor_logs(positive_payload)
    monitor_logs(negative_payload)

if __name__ == "__main__":
    main()`}
              </pre>
              <div className="modal-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const codeText = document.querySelector('.code-snippet').textContent;
                    navigator.clipboard.writeText(codeText);
                    alert('Code copied to clipboard!');
                  }}
                >
                  📋 Copy Code
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCodeSnippet(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;