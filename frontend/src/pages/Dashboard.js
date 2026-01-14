// Updated Dashboard.js with EventLogPanel integration
import React, { useState, useEffect } from 'react';
import { servicesApi, monitoringApi, utilityApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import EventLogPanel from '../components/EventLogPanel'; // Add this import
import Icon from '@mdi/react';
import { mdiCloseCircleOutline, mdiChartBellCurveCumulative, mdiCheckCircleOutline, mdiAlertCircleOutline, mdiCheckboxMarkedCircleAutoOutline } from '@mdi/js';

import { useNavigate } from 'react-router-dom';
import '../App.css';
import Graph from '../components/Graph';
import { useRef } from 'react';

const SystemProgressBar = ({ value, label }) => {
  let colorClass = 'progress-low';
  if (value > 70) colorClass = 'progress-med';
  if (value > 90) colorClass = 'progress-high';

  return (
    <div className="system-metric">
      <div className="system-metric-header">
        <span>{label}</span>
        <span>{value.toFixed(1)}%</span>
      </div>
      <div className="system-progress-container">
        <div
          className={`system-progress-bar ${colorClass}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
};

function Dashboard() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [eventRefreshTrigger, setEventRefreshTrigger] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Add sidebar state
  const [groupingPreferences, setGroupingPreferences] = useState({});
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [refreshInterval, setRefreshInterval] = useState(30);
  const timersRef = useRef({});

  useEffect(() => {
    checkApiStatus();
    document.title = 'Dashboard - Service Monitoring';
    fetchServices();
    fetchGroupingPreferences();
    fetchRefreshInterval();
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const intervalId = setInterval(() => {
      fetchServices(true);
    }, refreshInterval * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshInterval]);

  // Precise Monitoring Scheduler for Frontend-proxied services
  useEffect(() => {
    // Clear existing timers
    if (timersRef.current) {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    }

    const now = new Date();
    services.forEach(service => {
      if (service.monitoring_proxy === 'frontend' && service.is_active !== false) {
        // Ensure we parse the timestamp correctly as UTC
        const lastChecked = new Date(service.updated_at || service.checked_at || 0);

        // Safety check: if date is invalid, set a default delay to avoid NaN or immediate loops
        if (isNaN(lastChecked.getTime())) {
          console.warn(`Frontend Scheduler [${service.name}]: Invalid date detected, using fallback check.`);
          timersRef.current[service.id] = setTimeout(() => handleMonitorSingle(null, service), 60000);
          return;
        }

        const intervalSec = service.check_interval_sec || 300;
        const intervalMs = intervalSec * 1000;

        const timeSinceLast = now.getTime() - lastChecked.getTime();
        const delay = Math.max(0, intervalMs - timeSinceLast);

        console.debug(`Frontend Scheduler [${service.name}]: Last check: ${lastChecked.toISOString()}, Now: ${now.toISOString()}, Interval: ${intervalSec}s, Delaying next check by: ${Math.round(delay / 1000)}s`);

        timersRef.current[service.id] = setTimeout(() => {
          console.info(`Frontend Scheduler: Triggering check for ${service.name} after ${intervalSec}s`);
          handleMonitorSingle(null, service);
        }, delay);
      }
    });

    return () => {
      if (timersRef.current) {
        Object.values(timersRef.current).forEach(clearTimeout);
      }
    };
  }, [services]);

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

  const checkApiStatus = async () => {
    try {
      const status = await utilityApi.getStatus();
      setApiStatus(status);
    } catch (err) {
      console.error('API status check failed:', err);
      setApiStatus({ error: 'API not reachable' });
    }
  };

  const fetchServices = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const data = await servicesApi.getAll();
      setServices(data || []);
      // Trigger event log refresh when services are updated
      setEventRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError(err.output || err.message);
      setServices([]); // Set empty array on error
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleMonitorAll = async () => {
    try {
      setLoading(true);
      await monitoringApi.monitorAll();
      await fetchServices();
      // Trigger event log refresh after monitoring
      setEventRefreshTrigger(prev => prev + 1);
      alert('Monitoring completed!');
    } catch (err) {
      console.error('Monitoring error:', err);
      alert(`Monitoring failed: ${err.output || err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const performFrontendCheck = async (service) => {
    console.info(`Performing Frontend Check for Service: ${service.name}`);
    const CLOUD_AUTH_URL = "https://cloud-monitoring.corp.spc.int/api/collections/users/auth-with-password";
    const CLOUD_RECORDS_URL = "https://cloud-monitoring.corp.spc.int/api/collections/systems/records";
    const IDENTITY = "divesha@spc.int";
    const PASSWORD = "Un2345678";

    // A. Authenticate
    const authRes = await fetch(CLOUD_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: IDENTITY, password: PASSWORD })
    });

    if (!authRes.ok) throw new Error(`Frontend Auth Failed (Status ${authRes.status})`);
    const authData = await authRes.json();
    const token = authData.token;

    // B. Fetch This Specific Item (with robust URL encoding)
    const filterParam = `name='${service.name}'`;
    const encodedFilter = encodeURIComponent(filterParam).replace(/'/g, "%27");

    const itemsRes = await fetch(`${CLOUD_RECORDS_URL}?filter=${encodedFilter}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!itemsRes.ok) throw new Error(`Frontend Fetch Failed (Status ${itemsRes.status})`);
    const data = await itemsRes.json();

    // C. Send to Backend to sync
    console.info(`Frontend fetched data for ${service.name}. Syncing to backend...`);
    await servicesApi.syncCloud(data);

    const item = data.items && data.items.length > 0 ? data.items[0] : null;
    return {
      status: item ? item.status : 'unknown',
      output: `Checked via Frontend Proxy. Cloud status: ${item ? item.status : 'not found in cloud'}`
    };
  };

  const handleMonitorSingle = async (event, service) => {
    if (event) event.stopPropagation();

    const targetService = typeof service === 'object' ? service : services.find(s => String(s.id) === String(service));

    if (!targetService) {
      console.warn("Monitor requested for unknown service:", service);
      return;
    }

    const useFrontendProxy = targetService.monitoring_proxy === 'frontend';

    try {
      let result;
      if (useFrontendProxy) {
        try {
          result = await performFrontendCheck(targetService);
        } catch (feError) {
          console.error("Frontend Monitoring failed:", feError);
          throw new Error(`Proxy check failed: ${feError.message}. Ensure VPN/Corporate Access.`);
        }
      } else {
        // Standard backend check
        result = await monitoringApi.monitorSingle(targetService.id);
      }

      console.log('Monitoring Result:', result);
      if (event) alert(`Monitor result for ${targetService.name}: ${result.status}`);

      await fetchServices(true); // Silent refresh
      setEventRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Monitoring error:', err);
      if (event) alert(`Monitoring failed for ${targetService?.name || 'service'}: ${err.message}`);
    }
  };

  const handleCardClick = (service) => {
    navigate(`/service/${service.id}`, {
      state: { updated_at: service.updated_at }
    });
  };

  const renderServiceCard = (service) => {
    if (service.is_external_system) {
      const uptimeDays = Math.floor((service.system_info?.u || 0) / (60 * 60 * 24));
      return (
        <div
          key={service.id}
          className="service-card"
          style={{
            cursor: 'default',
            border: (service.last_status || '').toLowerCase() === 'up' ? '2px solid #22c55e' :
              (service.last_status || '').toLowerCase() === 'down' ? '2px solid #ef4444' :
                '2px solid #f59e0b'
          }}
        >
          <div className="service-header">
            <h3>{service.name}</h3>
            <span className={`status-badge ${service.last_status}`}>
              {service.last_status}
            </span>
          </div>

          <div className="service-details">
            <div className="system-info-row">
              <span className="system-label">Host</span>
              <span className="system-value">{service.ip_address}</span>
            </div>
            <div className="system-info-row">
              <span className="system-label">Kernel</span>
              <span className="system-value">{service.system_info?.k}</span>
            </div>

            <SystemProgressBar value={service.system_info?.cpu || 0} label="CPU" />
            <SystemProgressBar value={service.system_info?.mp || 0} label="Memory" />
            <SystemProgressBar value={service.system_info?.dp || 0} label="Disk" />

            <div className="system-meta">
              <span>Uptime: {uptimeDays} days</span>
              <span>Updated: {new Date(service.updated_at).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={service.id}
        className="service-card"
        onClick={() => handleCardClick(service)}
        style={{
          cursor: 'pointer',
          border: (service.last_status || '').toLowerCase() === 'up' ? '2px solid #22c55e' :
            (service.last_status || '').toLowerCase() === 'down' ? '2px solid #ef4444' :
              '2px solid #f59e0b'
        }}
      >
        <div className="service-header">
          <h3>{service.name}</h3>
          <span className={`status-badge ${service.last_status}`}>
            {service.last_status}
          </span>
        </div>

        <div className="service-details">
          <p><strong>ID:</strong> {service.id}</p>
          <p><strong>Address:</strong> {service.ip_address}:{service.port}</p>
          <p><strong>Protocol:</strong> {service.protocol}</p>
          <p><strong>Check Interval:</strong> {service.check_interval_sec}s</p>
          <p><strong>Success/Failure:</strong> {service.success_count}/{service.failure_count}</p>
          {service.updated_at && (
            <p><strong>Last Checked:</strong> {new Date(service.updated_at).toLocaleString()}</p>
          )}
          <p><strong>Type:</strong> {service.type || 'Other'}</p>
        </div>

        <div className="service-actions">
          {service.protocol !== 'external' && (
            <button
              onClick={(event) => handleMonitorSingle(event, service)}
              className="btn btn-small"
            >
              Test Now
            </button>
          )}
        </div>
      </div>
    );
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleGroup = (groupLabel) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupLabel)) {
        newSet.delete(groupLabel);
      } else {
        newSet.add(groupLabel);
      }
      return newSet;
    });
  };

  return (
    <>
      <div className={`dashboard dashboard-with-sidebar ${!sidebarCollapsed ? 'sidebar-expanded' : ''}`}>
        <header className="app-header">
          <h1>Service Monitoring Dashboard</h1>
          <div className="header-controls">
            <ThemeToggle />

            <div className="api-status">
              {apiStatus ? (
                apiStatus.error ? (
                  <span className="status-badge error">
                    <Icon
                      path={mdiAlertCircleOutline}
                      title="Status Error"
                      size={1}
                      color="red"
                    />
                    <span className="status-text">{apiStatus.error}</span>
                  </span>
                ) : (
                  <span className="status-badge success">
                    <Icon
                      path={mdiCheckCircleOutline}
                      title="Status OK"
                      size={1}
                      color="green"
                    />
                    <span className="status-text">API Connected</span>
                  </span>
                )
              ) : (
                <span className="status-badge loading">
                  <span className="spinner">🔄</span>
                  <span className="status-text">Checking API...</span>
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">
          <div className="controls">
            <button onClick={fetchServices} disabled={loading} className="btn btn-primary">
              {loading ? 'Loading...' : 'Refresh Services'}
            </button>
            <button onClick={handleMonitorAll} disabled={loading} className="btn btn-secondary">
              Monitor All Services
            </button>
          </div>

          {error && <div className="error-message"><strong>Error:</strong> {error}</div>}

          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <span>Loading services...</span>
            </div>
          )}

          {!loading && (services || []).length === 0 && !error && (
            <div className="no-data">No services found</div>
          )}


          {!loading && (services || []).length > 0 && (
            <>
              {/* Service Summary Cards */}
              <div className="summary-cards">
                {(() => {
                  const isCollectionMode = groupingPreferences.grouping_mode === 'collection';
                  const stats = {};

                  (services || []).forEach(service => {
                    let key;
                    if (isCollectionMode) {
                      key = service.collection || 'Uncategorized';
                    } else {
                      key = service.type || 'Other';
                      if (key === 'server_cloud') key = 'Server Cloud';
                    }

                    if (!stats[key]) {
                      stats[key] = { total: 0, up: 0 };
                    }
                    stats[key].total += 1;
                    if ((service.last_status || '').toLowerCase() === 'up') {
                      stats[key].up += 1;
                    }
                  });

                  const typeLabels = {
                    'servers': 'Servers',
                    'datasets': 'Datasets',
                    'thredds': 'THREDDS',
                    'ocean-plotters': 'Ocean Plotters',
                    'models': 'Models',
                    'server_cloud': 'Server Cloud',
                    'Server Cloud': 'Server Cloud'
                  };

                  return Object.entries(stats).map(([key, stat]) => {
                    const label = isCollectionMode ? key : (typeLabels[key] || key);
                    const isAllUp = stat.up === stat.total;
                    const isNoneUp = stat.up === 0;

                    let statusClass = 'warning';
                    let icon = mdiChartBellCurveCumulative;
                    let color = '#f59e0b';

                    if (isAllUp) {
                      statusClass = 'success';
                      icon = mdiCheckboxMarkedCircleAutoOutline;
                      color = '#22c55e';
                    } else if (isNoneUp) {
                      statusClass = 'error';
                      icon = mdiCloseCircleOutline;
                      color = '#ef4444';
                    }

                    return (
                      <div key={key} className={`summary-card ${statusClass}`}>
                        <div className="summary-icon">
                          <Icon path={icon} size={1.5} color={color} />
                        </div>
                        <div className="summary-content">
                          <div className="summary-number">
                            {stat.up}/{stat.total}
                          </div>
                          <div className="summary-label">{label} Up</div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Remove the inline EventLogPanel from here since it's now a sidebar */}

              {/* Services Grid */}
              <div className="services-section">
                <div className="section-header">
                  <h2 className="section-title">Service Details</h2>
                </div>

                <div className="services-grid">
                  {(() => {
                    // Grouping Logic
                    const renderedItems = [];

                    if (groupingPreferences.grouping_mode === 'collection') {
                      // Group by Collection
                      const servicesByCollection = {};
                      (services || []).forEach(service => {
                        const collection = service.collection || 'Uncategorized';
                        if (!servicesByCollection[collection]) {
                          servicesByCollection[collection] = [];
                        }
                        servicesByCollection[collection].push(service);
                      });

                      Object.entries(servicesByCollection).forEach(([collectionName, collectionServices]) => {
                        // If expanded, render individual cards
                        if (expandedGroups.has(collectionName)) {
                          renderedItems.push(
                            <div key={`group-header-${collectionName}`} className="service-card group-card expanded-header" onClick={() => toggleGroup(collectionName)} style={{ minHeight: 'auto', cursor: 'pointer', border: '2px dashed var(--btn-primary)' }}>
                              <div className="group-card-header" style={{ borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>{collectionName} (Expanded)</h3>
                                <span className="btn btn-small btn-secondary">Collapse</span>
                              </div>
                            </div>
                          );
                          collectionServices.forEach(service => {
                            renderedItems.push(renderServiceCard(service));
                          });
                          return;
                        }

                        const total = collectionServices.length;
                        const up = collectionServices.filter(s => (s.last_status || '').toLowerCase() === 'up').length;
                        const down = collectionServices.filter(s => (s.last_status || '').toLowerCase() === 'down').length;
                        const unknown = collectionServices.filter(s => (s.last_status || '').toLowerCase() === 'unknown' || !s.last_status).length;

                        renderedItems.push(
                          <div key={`group-${collectionName}`} className="service-card group-card">
                            <div className="group-card-header">
                              <h3>{collectionName}</h3>
                            </div>
                            <div className="group-card-stats">
                              <div className="group-stat-row up">
                                <span className="stat-count">{up}/{total}</span>
                                <span className="stat-label">Up</span>
                              </div>
                              <div className="group-stat-row down">
                                <span className="stat-count">{down}</span>
                                <span className="stat-label">Down</span>
                              </div>
                              {unknown > 0 && (
                                <div className="group-stat-row unknown">
                                  <span className="stat-count">{unknown}</span>
                                  <span className="stat-label">Unknown</span>
                                </div>
                              )}
                            </div>
                            <div className="group-card-footer" onClick={() => toggleGroup(collectionName)}>
                              Click for more information
                            </div>
                          </div>
                        );
                      });

                    } else {
                      // Default: Group by Service Type (Existing Logic)
                      const groupedTypes = [];
                      if (groupingPreferences.group_by_servers) groupedTypes.push('servers');
                      if (groupingPreferences.group_by_datasets) groupedTypes.push('datasets');
                      if (groupingPreferences.group_by_thredds) groupedTypes.push('thredds');
                      if (groupingPreferences.group_by_ocean_plotters) groupedTypes.push('ocean-plotters');
                      if (groupingPreferences.group_by_models) groupedTypes.push('models');
                      if (groupingPreferences.group_by_server_cloud) {
                        groupedTypes.push('server_cloud');
                        groupedTypes.push('Server Cloud');
                      }

                      const groupedServices = services.filter(s => groupedTypes.includes(s.type || 'Other'));
                      const ungroupedServices = services.filter(s => !groupedTypes.includes(s.type || 'Other'));

                      const typeLabels = {
                        'servers': 'Servers',
                        'datasets': 'Datasets',
                        'thredds': 'THREDDS',
                        'ocean-plotters': 'Ocean-plotters',
                        'models': 'Models',
                        'server_cloud': 'Server Cloud',
                        'Server Cloud': 'Server Cloud'
                      };

                      // Render Group Cards
                      const renderedLabels = new Set();

                      groupedTypes.forEach(type => {
                        const label = typeLabels[type] || type;
                        if (renderedLabels.has(label)) return;

                        let typeServices;
                        if (label === 'Server Cloud') {
                          typeServices = groupedServices.filter(s => (s.type === 'server_cloud' || s.type === 'Server Cloud'));
                        } else {
                          typeServices = groupedServices.filter(s => (s.type || 'Other') === type);
                        }

                        if (typeServices.length > 0) {
                          renderedLabels.add(label);

                          // If expanded, render individual cards
                          if (expandedGroups.has(label)) {
                            renderedItems.push(
                              <div key={`group-header-${label}`} className="service-card group-card expanded-header" onClick={() => toggleGroup(label)} style={{ minHeight: 'auto', cursor: 'pointer', border: '2px dashed var(--btn-primary)' }}>
                                <div className="group-card-header" style={{ borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <h3>{label} (Expanded)</h3>
                                  <span className="btn btn-small btn-secondary">Collapse</span>
                                </div>
                              </div>
                            );
                            typeServices.forEach(service => {
                              renderedItems.push(renderServiceCard(service));
                            });
                            return;
                          }

                          const total = typeServices.length;
                          const up = typeServices.filter(s => (s.last_status || '').toLowerCase() === 'up').length;
                          const down = typeServices.filter(s => (s.last_status || '').toLowerCase() === 'down').length;
                          const unknown = typeServices.filter(s => (s.last_status || '').toLowerCase() === 'unknown' || !s.last_status).length;

                          renderedItems.push(
                            <div key={`group-${label}`} className="service-card group-card">
                              <div className="group-card-header">
                                <h3>{label}</h3>
                              </div>
                              <div className="group-card-stats">
                                <div className="group-stat-row up">
                                  <span className="stat-count">{up}/{total}</span>
                                  <span className="stat-label">Up</span>
                                </div>
                                <div className="group-stat-row down">
                                  <span className="stat-count">{down}</span>
                                  <span className="stat-label">Down</span>
                                </div>
                                {unknown > 0 && (
                                  <div className="group-stat-row unknown">
                                    <span className="stat-count">{unknown}</span>
                                    <span className="stat-label">Unknown</span>
                                  </div>
                                )}
                              </div>
                              <div className="group-card-footer" onClick={() => toggleGroup(label)}>
                                Click for more information
                              </div>
                            </div>
                          );
                        }
                      });

                      // Render Ungrouped Services
                      ungroupedServices.forEach(service => {
                        renderedItems.push(renderServiceCard(service));
                      });
                    }

                    return renderedItems;
                  })()}
                </div>
              </div>

            </>
          )}

          {/* Enhanced Analytics Section */}
          {!loading && (services || []).length > 0 && (
            <div className="analytics-section">
              <Graph data={services || []} />
            </div>
          )}
        </main>

      </div>

      {/* Event Log Sidebar */}
      <EventLogPanel
        refreshTrigger={eventRefreshTrigger}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
    </>
  );
}

export default Dashboard;