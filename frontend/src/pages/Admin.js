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
    protocol: 'http',
    interval_type: 'seconds',
    interval_value: 60,
    interval_unit: 'seconds',
    comment: '',
    check_interval_sec: 60,
    display_order: ''
  });

  const protocols = ['http', 'https', 'tcp', 'ping', 'curl', 'heartbeat', 'external'];
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
      protocol: 'http',
      interval_type: 'seconds',
      interval_value: 60,
      interval_unit: 'seconds',
      comment: '',
      check_interval_sec: 60,
      display_order: ''
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
      display_order: typeof service.display_order === 'number' ? service.display_order : ''
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
        display_order: typeof service.display_order === 'number' ? service.display_order : ''
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
        await servicesApi.create(payload);
        alert('Service created successfully!');
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
                <p><strong>Seconds:</strong> For critical services (30-60s)<br/>
                <strong>Minutes:</strong> For web servers (1-15min)<br/>
                <strong>Hours:</strong> For backup servers<br/>
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
                    <label htmlFor="name">Service Name *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      disabled={formMode === 'view'}
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
                      disabled={formMode === 'view'}
                      placeholder="e.g., 192.168.1.10 or example.com"
                    />
                  </div>

                  {/* Only show port if protocol is not http/https/external */}
                  {(formData.protocol !== 'http' && formData.protocol !== 'https' && formData.protocol !== 'external') && (
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
                        disabled={formMode === 'view'}
                        placeholder="e.g., 80, 443, 8080"
                      />
                    </div>
                  )}

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
                      {protocols.map(protocol => (
                        <option key={protocol} value={protocol}>
                          {protocol.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.protocol !== 'external' && (
                    <div className="form-group">
                      <label htmlFor="interval_type">Interval Type *</label>
                      <select
                        id="interval_type"
                        name="interval_type"
                        value={formData.interval_type}
                        onChange={handleInputChange}
                        required={formData.protocol !== 'external'}
                        disabled={formMode === 'view'}
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
                      disabled={formMode === 'view'}
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
                        disabled={formMode === 'view'}
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
                      disabled={formMode === 'view'}
                      placeholder="0 = Show first"
                    />
                  </div>

                  <div className="form-group full-width">
                    {formData.protocol === 'external' ? (
                      <>
                        <label>External Service Info</label>
                        <div className="interval-description" style={{color: '#2196F3'}}>
                          <strong>📡 This service will be monitored externally via API calls.</strong>
                          <p style={{fontSize: '0.9em', marginTop: '0.5rem'}}>
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
                      disabled={formMode === 'view'}
                      placeholder="Optional description or notes about this service"
                    />
                  </div>
                </div>

                {formMode === 'view' && selectedService && (
                  <div className="service-metadata">
                    <h3>Service Information</h3>
                    <div className="metadata-grid">
                      <p><strong>ID:</strong> {selectedService.id}</p>
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
      </main>
    


    </div>
  );
}

export default Admin;