// src/pages/ServiceDetail.js
import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { monitoringApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

// Status icons
const StatusIcon = ({ status }) => {
  if (status.toLowerCase() === 'up') {
    return <span style={{ color: '#2e7d32', fontSize: '1.2em' }}>●</span>;
  } else {
    return <span style={{ color: '#c62828', fontSize: '1.2em' }}>●</span>;
  }
};

function ServiceDetail() {
  const { theme } = useTheme();
  const { id } = useParams();
  const location = useLocation();
  
  // Format the initial start time from previous page or default to current time
  const getInitialStartTime = () => {
    const initialStart = location.state?.updated_at || new Date().toISOString();
    // Convert to the format needed for datetime-local input (YYYY-MM-DDTHH:mm)
    return new Date(initialStart).toISOString().slice(0, 16);
  };

  const [startTime, setStartTime] = useState(getInitialStartTime());
  const [endTime, setEndTime] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const payload = {
        id: parseInt(id),
        ...(startTime && { start_time: startTime + ':00' }), // Add seconds for API compatibility
        ...(endTime && { end_time: endTime + ':00' }),
      };
      const data = await monitoringApi.getLogs(payload);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch logs', err);
      setLogs([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };
 const handleBackToDashboard = () => {
    // Navigate back to dashboard - you might want to use React Router here
    window.location.href = '/monitoring/';
  };
  useEffect(() => {
    // Only fetch logs on component mount if we have a start time
    if (startTime) {
      fetchLogs();
    }
  }, []); // Remove dependency to prevent re-fetching on every render

  // Format date/time nicely
  const formatDate = (dateStr) => {
    const dt = new Date(dateStr);
    return dt.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    
    <div className={`service-detail ${theme}-mode`}>
              <button 
              onClick={handleBackToDashboard}
              className="btn btn-secondary"
            >
              ← Back to Dashboard
            </button>
      <header className="service-detail-header">
        <h1>Service #{id} Monitoring Logs</h1>
        <ThemeToggle />
      </header>

      <div className="time-controls">
        <h3>Filter Logs by Time Range</h3>
        <div className="time-inputs">
          <div className="time-input-group">
            <label htmlFor="start-time">Start Time:</label>
            <input
              id="start-time"
              type="datetime-local"
              value={startTime.slice(0, 16)}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="time-input-group">
            <label htmlFor="end-time">End Time (optional):</label>
            <input
              id="end-time"
              type="datetime-local"
              value={endTime.slice(0, 16)}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        <div className="button-container">
          <button onClick={fetchLogs} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      <div className="logs-list">
        <h3>Log Entries ({(logs || []).length} total)</h3>
        {(logs || []).length === 0 ? (
          <div className="no-logs">
            <p>No logs available for the selected time range.</p>
          </div>
        ) : (
          (logs || []).map((log) => (
            <div key={log.id} className="log-entry">
              <div className="log-status">
                <div className={`status-indicator ${log.status.toLowerCase()}`}>
                  <StatusIcon status={log.status} />
                  {log.status.toUpperCase()}
                </div>
              </div>
              
              <div className="log-details">
                <p>
                  <strong>Timestamp:</strong> {formatDate(log.checked_at)}
                </p>
                <p>
                  <strong>Log ID:</strong> #{log.id}
                </p>
              </div>
              
              <div className="log-message-container">
                <strong>Response Details:</strong>
                <pre className="log-message">{log.message || 'No additional details available.'}</pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ServiceDetail;