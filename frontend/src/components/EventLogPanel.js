// src/components/EventLogPanel.js
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@mdi/react';
import {
  mdiCheckCircle,
  mdiCloseCircle,
  mdiRefresh,
  mdiHistory,
  mdiAlertCircle,
  mdiClockOutline,
  mdiChevronLeft
} from '@mdi/js';
import { utilityApi } from '../services/api';

const EventLogPanel = ({ refreshTrigger = 0, isCollapsed, onToggleCollapse }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Use useCallback to ensure the same function reference is used
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date(); // current local time

      // End time = today at 23:59:59.999
      const endTime = new Date();
      endTime.setHours(23, 59, 59, 999);

      // Start time = 2 days ago at 00:00:00.000
      const startTime = new Date();
      startTime.setDate(now.getDate() - 2);
      startTime.setHours(0, 0, 0, 0);

      // Use central API client to ensure correct base URL is used (and include debug)
      console.info('DEBUG: EventLogPanel using API_BASE_URL ->', process.env.REACT_APP_API_URL);
      const logs = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8085/widget10-api'}/monitoring_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || 'ssshh',
        },
        body: JSON.stringify({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
        })
      }).then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      });

      // Transform logs into events format based on the provided structure
      const transformedEvents = (logs || [])
        .sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at)) // Sort by most recent first
        .slice(0, 50) // Limit to 50 most recent events
        .map(log => ({
          id: log.id,
          serviceId: log.service_id,
          serviceName: log.name || `Service ${log.service_id}`,
          status: log.status,
          timestamp: log.checked_at,
          message: log.message ? log.message.split('\n')[0] : `Service is ${log.status}`, // Use first line of message
          fullMessage: log.message,
          responseTime: null, // Not provided in this API response
          details: log.message
        }));

      setEvents(transformedEvents);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError(err.message || 'Failed to fetch events');
      setEvents([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since the function doesn't depend on any props/state

  useEffect(() => {
    if (!isCollapsed) {
      fetchEvents();
    }
  }, [refreshTrigger, isCollapsed, fetchEvents]);

  useEffect(() => {
    let interval;
    if (autoRefresh && !isCollapsed) {
      interval = setInterval(() => {
        console.log('Auto-refresh triggered'); // Debug log
        fetchEvents();
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) {
        console.log('Clearing interval'); // Debug log
        clearInterval(interval);
      }
    };
  }, [autoRefresh, isCollapsed, fetchEvents]);

  const getEventIcon = (status) => {
    switch (status) {
      case 'up':
        return { path: mdiCheckCircle, color: '#22c55e' };
      case 'down':
        return { path: mdiCloseCircle, color: '#ef4444' };
      default:
        return { path: mdiAlertCircle, color: '#f59e0b' };
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';

    // Parse the timestamp. Since we've switched to TIMESTAMPTZ, 
    // the string will already contain timezone info (e.g., +00).
    const eventTime = Date.parse(timestamp);

    if (isNaN(eventTime)) {
      console.error(`Invalid timestamp received: ${timestamp}`);
      return 'Invalid time';
    }

    const now = Date.now();
    const diffInSeconds = Math.floor((now - eventTime) / 1000);

    if (diffInSeconds < 0) return 'Just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };


  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={`event-log-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* Collapse/Expand Toggle */}
      <button
        className="sidebar-toggle"
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Show Event Log' : 'Hide Event Log'}
      >
        <Icon
          path={mdiChevronLeft}
          size={1}
          style={{
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.3s ease'
          }}
        />
      </button>

      {!isCollapsed && (
        <div className="event-log-panel">
          <div className="event-log-header">
            <div className="header-left">
              <Icon path={mdiHistory} size={1} color="var(--text-color)" />
              <h3>Recent Events</h3>
              <span className="event-count">({(events || []).length})</span>
            </div>

            <div className="header-controls">
              <button
                className={`auto-refresh-toggle ${autoRefresh ? 'active' : ''}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
                title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
              >
                <Icon path={mdiClockOutline} size={0.8} />
                {autoRefresh ? '30s' : 'Off'}
              </button>

              <button
                className="refresh-btn"
                onClick={fetchEvents}
                disabled={loading}
                title="Refresh events"
              >
                <Icon
                  path={mdiRefresh}
                  size={0.8}
                  className={loading ? 'spinning' : ''}
                />
              </button>
            </div>
          </div>

          <div className="event-log-content">
            {loading && (events || []).length === 0 ? (
              <div className="event-loading">
                <div className="spinner"></div>
                <span>Loading events...</span>
              </div>
            ) : error ? (
              <div className="event-error">
                <Icon path={mdiAlertCircle} size={1} color="#ef4444" />
                <span>Error: {error}</span>
                <button onClick={fetchEvents} className="retry-btn">
                  Retry
                </button>
              </div>
            ) : (events || []).length === 0 ? (
              <div className="no-events">
                <Icon path={mdiHistory} size={2} color="var(--text-muted)" />
                <p>No recent events found</p>
              </div>
            ) : (
              <div className="events-list">
                {(events || []).map((event) => {
                  const icon = getEventIcon(event.status);
                  return (
                    <div key={event.id} className={`event-item ${event.status}`}>
                      <div className="event-icon">
                        <Icon path={icon.path} size={0.9} color={icon.color} />
                      </div>

                      <div className="event-content">
                        <div className="event-main">
                          <span className="event-service">{event.serviceName}</span>
                          <span className="event-message">{event.message}</span>
                        </div>

                        <div className="event-meta">
                          <span className="event-time" title={formatTimestamp(event.timestamp)}>
                            {formatRelativeTime(event.timestamp)}
                          </span>
                          {event.responseTime && (
                            <span className="event-response-time">
                              {event.responseTime}ms
                            </span>
                          )}
                        </div>

                        {event.fullMessage && event.fullMessage !== event.message && (
                          <div className="event-details">
                            {event.fullMessage.split('\n').slice(1, 3).join('\n')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventLogPanel;