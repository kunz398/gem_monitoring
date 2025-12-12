// src/pages/Datasets.js
import React, { useState, useEffect } from 'react';
import { servicesApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import '../App.css';

function Datasets() {
    const { theme } = useTheme();
    const themeClass = theme ? `theme-${theme}` : 'theme-default';
    const [datasets, setDatasets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastSync, setLastSync] = useState(null);
    const [stats, setStats] = useState({ total: 0, filtered: 0 });

    const fetchDatasets = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await servicesApi.getOceanDatasets();
            setDatasets(response.datasets || []);
            setStats({ total: response.total, filtered: response.filtered });
        } catch (err) {
            setError(err.message || 'Failed to fetch datasets');
            setDatasets([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await servicesApi.syncOceanDatasets();
            alert(result.message || 'Datasets synced successfully!');
            setLastSync(new Date());
            await fetchDatasets();
        } catch (err) {
            setError(err.message || 'Failed to sync datasets');
            alert(`Sync failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDatasets();
    }, []);

    const getHealthBadgeClass = (health) => {
        switch (health) {
            case 'Excellent':
                return 'badge-success';
            case 'Good':
                return 'badge-info';
            case 'Fair':
                return 'badge-warning';
            case 'Poor':
                return 'badge-danger';
            default:
                return 'badge-secondary';
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Ready':
                return 'badge-success';
            case 'Running':
                return 'badge-info';
            case 'Paused':
                return 'badge-warning';
            default:
                return 'badge-secondary';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleString();
        } catch {
            return dateStr;
        }
    };

    const handleBackToDashboard = () => {
        window.location.href = '/monitoring/';
    };

    // Separate datasets by health status
    const excellentDatasets = datasets.filter(d => d.health === 'Excellent');
    const nonExcellentDatasets = datasets.filter(d => d.health !== 'Excellent');

    return (
        <div className={`dashboard ${themeClass}`}>
            <header className="app-header">
                <h1>Ocean Middleware - Dataset Monitoring</h1>
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
                <div className="controls" style={{ marginBottom: '20px' }}>
                    <button
                        onClick={fetchDatasets}
                        disabled={loading}
                        className="btn btn-primary"
                    >
                        {loading ? 'Loading...' : '🔄 Refresh'}
                    </button>
                    <button
                        onClick={handleSync}
                        disabled={loading}
                        className="btn btn-success"
                        style={{ marginLeft: '10px' }}
                    >
                        {loading ? 'Syncing...' : '🔄 Sync Datasets'}
                    </button>
                    {lastSync && (
                        <span style={{ marginLeft: '20px', fontSize: '14px' }}>
                            Last synced: {lastSync.toLocaleTimeString()}
                        </span>
                    )}
                </div>

                {error && (
                    <div className="error-message" style={{ marginBottom: '20px' }}>
                        <strong>Error:</strong> {error}
                    </div>
                )}

                <div className="stats-bar" style={{
                    padding: '15px',
                    background: 'var(--card-bg)',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    display: 'flex',
                    gap: '30px',
                    flexWrap: 'wrap'
                }}>
                    <div>
                        <strong>Total Datasets:</strong> {stats.total}
                    </div>
                    <div>
                        <strong>Filtered (excluding Deleted):</strong> {stats.filtered}
                    </div>
                    <div>
                        <strong>Excellent Health:</strong> {excellentDatasets.length}
                    </div>
                    <div>
                        <strong>Needs Attention:</strong> {nonExcellentDatasets.length}
                    </div>
                </div>

                {/* Non-Excellent Datasets - Bigger Cards */}
                {nonExcellentDatasets.length > 0 && (
                    <div style={{ marginBottom: '40px' }}>
                        <h2 style={{
                            color: 'var(--danger-color)',
                            marginBottom: '20px',
                            fontSize: '24px',
                            borderBottom: '2px solid var(--danger-color)',
                            paddingBottom: '10px'
                        }}>
                            ⚠️ Datasets Requiring Attention ({nonExcellentDatasets.length})
                        </h2>
                        <div className="dataset-grid-large">
                            {nonExcellentDatasets.map((dataset) => (
                                <div key={dataset.id} className="dataset-card dataset-card-large" style={{
                                    border: '2px solid var(--danger-color)',
                                    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
                                }}>
                                    <div className="dataset-card-header">
                                        <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>
                                            {dataset.task_name}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            <span className={`badge ${getHealthBadgeClass(dataset.health)}`}>
                                                Health: {dataset.health}
                                            </span>
                                            <span className={`badge ${getStatusBadgeClass(dataset.status)}`}>
                                                {dataset.status}
                                            </span>
                                            {dataset.enabled && (
                                                <span className="badge badge-info">Enabled</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="dataset-card-body" style={{ fontSize: '14px' }}>
                                        <div className="dataset-info-row">
                                            <strong>Class:</strong> {dataset.class_id}
                                        </div>
                                        <div className="dataset-info-row">
                                            <strong>Priority:</strong> {dataset.priority}
                                        </div>
                                        <div className="dataset-info-row">
                                            <strong>Dataset ID:</strong> {dataset.dataset_id}
                                        </div>
                                        <div className="dataset-info-row">
                                            <strong>Success/Fail:</strong> {dataset.success_count} / {dataset.fail_count}
                                        </div>
                                        <div className="dataset-info-row">
                                            <strong>Last Run:</strong> {formatDate(dataset.last_run_time)}
                                        </div>
                                        <div className="dataset-info-row">
                                            <strong>Next Run:</strong> {formatDate(dataset.next_run_time)}
                                        </div>
                                        {dataset.last_download_file && (
                                            <div className="dataset-info-row">
                                                <strong>Last File:</strong>
                                                <span style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                                                    {dataset.last_download_file}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Excellent Datasets - Normal Cards */}
                {excellentDatasets.length > 0 && (
                    <div>
                        <h2 style={{
                            color: 'var(--success-color)',
                            marginBottom: '20px',
                            fontSize: '20px',
                            borderBottom: '2px solid var(--success-color)',
                            paddingBottom: '10px'
                        }}>
                            ✅ Healthy Datasets ({excellentDatasets.length})
                        </h2>
                        <div className="dataset-grid">
                            {excellentDatasets.map((dataset) => (
                                <div key={dataset.id} className="dataset-card">
                                    <div className="dataset-card-header">
                                        <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>
                                            {dataset.task_name}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <span className={`badge ${getHealthBadgeClass(dataset.health)}`}>
                                                {dataset.health}
                                            </span>
                                            <span className={`badge ${getStatusBadgeClass(dataset.status)}`}>
                                                {dataset.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="dataset-card-body" style={{ fontSize: '13px' }}>
                                        <div className="dataset-info-row">
                                            <strong>Class:</strong> {dataset.class_id}
                                        </div>
                                        <div className="dataset-info-row">
                                            <strong>Success/Fail:</strong> {dataset.success_count} / {dataset.fail_count}
                                        </div>
                                        <div className="dataset-info-row">
                                            <strong>Last Run:</strong> {formatDate(dataset.last_run_time)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && datasets.length === 0 && (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: 'var(--text-secondary)'
                    }}>
                        <p>No datasets found. Click "Sync Datasets" to fetch data from Ocean Middleware.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default Datasets;
