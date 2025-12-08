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

function Dashboard() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [eventRefreshTrigger, setEventRefreshTrigger] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Add sidebar state

  // Dashboard view config
  const [groupByType, setGroupByType] = useState(localStorage.getItem('gem_dashboard_group_by_type') === 'true');
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    checkApiStatus();
    document.title = 'Dashboard - Service Monitoring';
    fetchServices();
  }, []);

  const checkApiStatus = async () => {
    try {
      const status = await utilityApi.getStatus();
      setApiStatus(status);
    } catch (err) {
      console.error('API status check failed:', err);
      setApiStatus({ error: 'API not reachable' });
    }
  };

  const fetchServices = async () => {
    setLoading(true);
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
      setLoading(false);
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
      alert(`Monitoring failed: ${err.output}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMonitorSingle = async (event, serviceId) => {
    // Prevent the card click event from firing
    event.stopPropagation();

    try {
      const result = await monitoringApi.monitorSingle(serviceId);
      console.log('Monitoring:', result);
      alert(`Monitor result: ${result.status}`);

      await fetchServices();
      // Trigger event log refresh after single monitoring
      setEventRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(`Monitoring failed: ${err.output}`);
    }
  };

  const handleCardClick = (service) => {
    navigate(`/service/${service.id}`, {
      state: { updated_at: service.updated_at }
    });
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
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
                <div className="summary-card success">
                  <div className="summary-icon"><Icon path={mdiCheckboxMarkedCircleAutoOutline} size={2} color="#22c55e" /></div>
                  <div className="summary-content">
                    <div className="summary-number">
                      {(services || []).filter(s => s.last_status === 'up').length}
                    </div>
                    <div className="summary-label">Services Up</div>
                  </div>
                </div>

                <div className="summary-card error">
                  <div className="summary-icon"><Icon path={mdiCloseCircleOutline} color="#ef4444" size={2} /></div>
                  <div className="summary-content">
                    <div className="summary-number">
                      {(services || []).filter(s => s.last_status === 'down').length}
                    </div>
                    <div className="summary-label">Services Down</div>
                  </div>
                </div>

                <div className="summary-card warning">
                  <div className="summary-icon"><Icon path={mdiChartBellCurveCumulative} color="#f59e0b" size={1} /></div>
                  <div className="summary-content">
                    <div className="summary-number">
                      {(services || []).length > 0 ? (
                        (services || []).reduce((acc, service) => {
                          const total = service.success_count + service.failure_count;
                          return acc + (total > 0 ? (service.success_count / total) * 100 : 0);
                        }, 0) / (services || []).length
                      ).toFixed(1) : 0}%
                    </div>
                    <div className="summary-label">Avg Uptime</div>
                  </div>
                </div>
              </div>

              {/* Remove the inline EventLogPanel from here since it's now a sidebar */}

              {/* Services Grid or Group View */}
              <div className="services-section">
                <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 className="section-title">
                    {selectedType ? `Type: ${selectedType} Services` : 'Service Details'}
                  </h2>
                  {selectedType && (
                    <button onClick={() => setSelectedType(null)} className="btn btn-secondary">
                      ← Back to Groups
                    </button>
                  )}
                </div>

                {groupByType && !selectedType ? (
                  /* Grouped View */
                  <div className="type-summary-grid">
                    {[...new Set(services.map(s => s.type || 'Other'))].sort().map(type => {
                      const typeServices = services.filter(s => (s.type || 'Other') === type);
                      const upCount = typeServices.filter(s => s.last_status && s.last_status.toLowerCase() === 'up').length;
                      const downCount = typeServices.filter(s => s.last_status && s.last_status.toLowerCase() === 'down').length;
                      const totalCount = typeServices.length;

                      return (
                        <div
                          key={type}
                          className="type-summary-card"
                          onClick={() => setSelectedType(type)}
                        >
                          <h3>{type.charAt(0).toUpperCase() + type.slice(1)}</h3>
                          <div className="type-stats">
                            <div className={`stat-row ${downCount > 0 ? 'has-issues' : 'all-good'}`}>
                              <strong>{upCount}/{totalCount}</strong> Up
                            </div>
                            {downCount > 0 && (
                              <div className="stat-row error">
                                <strong>{downCount}</strong> Down
                              </div>
                            )}
                            {(totalCount - upCount - downCount) > 0 && (
                              <div className="stat-row warning" style={{ marginTop: '0.5rem', fontSize: '0.9em', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
                                <strong>{totalCount - upCount - downCount}</strong> Unknown
                              </div>
                            )}
                          </div>
                          <div className="click-hint">Click for more information</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Regular Grid View (filtered if selectedType is set) */
                  <div className="services-grid">
                    {(services || [])
                      .filter(service => !selectedType || (service.type || 'Other') === selectedType)
                      .map((service) => (
                        <div
                          key={service.id}
                          className="service-card"
                          onClick={() => handleCardClick(service)}
                          style={{ cursor: 'pointer' }}
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
                                onClick={(event) => handleMonitorSingle(event, service.id)}
                                className="btn btn-small"
                              >
                                Test Now
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
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