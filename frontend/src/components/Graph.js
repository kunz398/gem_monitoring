import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';

const Graph = ({ data }) => {
  // Add null safety for data
  const safeData = data || [];
  
  // Transform data for different chart types
//   const getSuccessFailureData = () => {
//     return safeData.map(service => ({
//       name: service.name,
//       Success: service.success_count,
//       Failure: service.failure_count,
//       total: service.success_count + service.failure_count
//     }));
//   };

//   const getUptimeData = () => {
//     return safeData.map(service => {
//       const total = service.success_count + service.failure_count;
//       const uptime = total > 0 ? ((service.success_count / total) * 100).toFixed(1) : 0;
//       return {
//         name: service.name,
//         uptime: parseFloat(uptime),
//         downtime: parseFloat((100 - uptime).toFixed(1))
//       };
//     });
//   };

//   const getStatusOverviewData = () => {
//     const statusCounts = safeData.reduce((acc, service) => {
//       acc[service.last_status] = (acc[service.last_status] || 0) + 1;
//       return acc;
//     }, {});
    
//     return Object.entries(statusCounts).map(([status, count]) => ({
//       status: status.charAt(0).toUpperCase() + status.slice(1),
//       count,
//       fill: status === 'up' ? '#4ade80' : '#f87171'
//     }));
//   };

  const getReliabilityData = () => {
    return safeData.map(service => {
      const total = service.success_count + service.failure_count;
      const reliability = total > 0 ? (service.success_count / total) * 100 : 0;
      return {
        name: service.name,
        reliability: parseFloat(reliability.toFixed(1)),
        protocol: service.protocol,
        status: service.last_status
      };
    });
  };

  const chartConfigs = [
    // {
    //   id: 'success-failure',
    //   title: 'Success vs Failure Count',
    //   icon: '📊',
    //   description: 'Compare successful and failed requests for each service',
    //   data: getSuccessFailureData(),
    //   renderChart: (chartData) => (
    //     <ResponsiveContainer width="100%" height={300}>
    //       <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
    //         <XAxis dataKey="name" />
    //         <YAxis />
    //         <Tooltip />
    //         <Legend />
    //         <Bar dataKey="Success" fill="#4ade80" />
    //         <Bar dataKey="Failure" fill="#f87171" />
    //       </BarChart>
    //     </ResponsiveContainer>
    //   )
    // },
    // {
    //   id: 'uptime-percentage',
    //   title: 'Uptime vs Downtime',
    //   icon: '⏱️',
    //   description: 'View uptime and downtime percentages for each service',
    //   data: getUptimeData(),
    //   renderChart: (chartData) => (
    //     <ResponsiveContainer width="100%" height={300}>
    //       <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
    //         <XAxis dataKey="name" />
    //         <YAxis domain={[0, 100]} />
    //         <Tooltip formatter={(value) => [`${value}%`, '']} />
    //         <Legend />
    //         <Bar dataKey="uptime" fill="#4ade80" />
    //         <Bar dataKey="downtime" fill="#f87171" />
    //       </BarChart>
    //     </ResponsiveContainer>
    //   )
    // },
    // {
    //   id: 'status-overview',
    //   title: 'Status Distribution',
    //   icon: '🎯',
    //   description: 'Overall distribution of service statuses',
    //   data: getStatusOverviewData(),
    //   renderChart: (chartData) => (
    //     <ResponsiveContainer width="100%" height={300}>
    //       <PieChart>
    //         <Pie
    //           data={chartData}
    //           cx="50%"
    //           cy="50%"
    //           labelLine={false}
    //           label={({ status, count, percent }) => `${status}: ${count} (${(percent * 100).toFixed(0)}%)`}
    //           outerRadius={100}
    //           fill="#8884d8"
    //           dataKey="count"
    //         >
    //           {chartData.map((entry, index) => (
    //             <Cell key={`cell-${index}`} fill={entry.fill} />
    //           ))}
    //         </Pie>
    //         <Tooltip />
    //       </PieChart>
    //     </ResponsiveContainer>
    //   )
    // },
    {
      id: 'reliability-score',
      title: 'Reliability Score',
      icon: '📈',
      description: 'Service reliability scores based on success rates',
      data: getReliabilityData(),
      renderChart: (chartData) => (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip formatter={(value) => [`${value}%`, 'Reliability']} />
            <Area 
              type="monotone" 
              dataKey="reliability" 
              stroke="#4ade80" 
              fill="#4ade80" 
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      )
    }
  ];

  return (
    <div className="graph-container">
      <div className="graph-header">
        <h2 className="section-title" >Service Analytics Dashboard</h2>
        {/* <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: '24px',
          fontSize: '0.875rem'
        }}>
          Comprehensive analytics overview of all services
        </p> */}
      </div>

      {/* Summary Stats */}
      {/* <div className="chart-stats">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total Services:</span>
            <span className="stat-value">{safeData.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Services Up:</span>
            <span className="stat-value success">
              {safeData.filter(s => s.last_status === 'up').length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Services Down:</span>
            <span className="stat-value error">
              {safeData.filter(s => s.last_status === 'down').length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Uptime:</span>
            <span className="stat-value">
              {safeData.length > 0 ? (
                safeData.reduce((acc, service) => {
                  const total = service.success_count + service.failure_count;
                  return acc + (total > 0 ? (service.success_count / total) * 100 : 0);
                }, 0) / safeData.length
              ).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div> */}

      {/* Chart Cards Grid - All Visible */}
      <div className="chart-cards-grid">
        {chartConfigs.map((config) => (
          <div key={config.id} className="chart-card">
            <div className="chart-card-header">
              <div className="chart-card-icon">{config.icon}</div>
              <div className="chart-card-info">
                <h3 className="chart-card-title">{config.title}</h3>
                <p className="chart-card-description">{config.description}</p>
              </div>
            </div>
            
            <div className="chart-card-content">
              <div className="chart-wrapper">
                {data && data.length > 0 ? (
                  config.renderChart(config.data)
                ) : (
                  <div className="no-data-chart">
                    <p>No data available for visualization</p>
                  </div>
                )}
              </div>
              
              {/* Chart-specific insights */}
              <div className="chart-insights">
                {config.id === 'success-failure' && config.data.length > 0 && (
                  <div className="insight">
                    <strong>Top Performer:</strong> {
                      config.data.reduce((prev, current) => 
                        (prev.Success > current.Success) ? prev : current
                      ).name
                    }
                  </div>
                )}
                
                {config.id === 'uptime-percentage' && config.data.length > 0 && (
                  <div className="insight">
                    <strong>Best Uptime:</strong> {
                      config.data.reduce((prev, current) => 
                        (prev.uptime > current.uptime) ? prev : current
                      ).name
                    } ({config.data.reduce((prev, current) => 
                      (prev.uptime > current.uptime) ? prev : current
                    ).uptime}%)
                  </div>
                )}
                
                {config.id === 'status-overview' && config.data.length > 0 && (
                  <div className="insight">
                    <strong>Total Services:</strong> {
                      config.data.reduce((acc, item) => acc + item.count, 0)
                    } services monitored
                  </div>
                )}
                
                {config.id === 'reliability-score' && config.data.length > 0 && (
                  <div className="insight">
                    <strong>Most Reliable:</strong> {
                      config.data.reduce((prev, current) => 
                        (prev.reliability > current.reliability) ? prev : current
                      ).name
                    } ({config.data.reduce((prev, current) => 
                      (prev.reliability > current.reliability) ? prev : current
                    ).reliability}%)
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .graph-container {
          padding: 20px 0;
        }

        .graph-header {
          margin-bottom: 32px;
        }

        .section-title {
          text-align: center;
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 20px;
          padding-bottom: 8px;
        }

        .graph-header {
          margin-bottom: 32px;
        }

        .chart-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
          gap: 24px;
          margin-top: 24px;
        }

        .chart-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          box-shadow: var(--shadow);
          transition: all 0.3s ease;
          overflow: hidden;
        }

        .chart-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-hover);
          border-color: var(--primary-color);
        }

        .chart-card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 24px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%);
          border-bottom: 1px solid var(--border-color);
        }

        .chart-card-icon {
          font-size: 2.5rem;
          min-width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: var(--secondary-bg);
          border: 2px solid var(--border-color);
        }

        .chart-card-info {
          flex: 1;
        }

        .chart-card-title {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 6px 0;
          line-height: 1.2;
        }

        .chart-card-description {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin: 0;
          line-height: 1.5;
        }

        .chart-card-content {
          padding: 24px;
        }

        .chart-wrapper {
          background: var(--secondary-bg);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid var(--border-color);
        }

        .chart-insights {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.02) 100%);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 12px;
          padding: 16px 20px;
        }

        .insight {
          color: var(--text-secondary);
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .insight strong {
          color: var(--text-primary);
          font-weight: 600;
        }

        .no-data-chart {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: var(--text-secondary);
          font-style: italic;
          font-size: 1.1rem;
        }

        .chart-stats {
          margin-bottom: 32px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 20px;
          transition: all 0.3s ease;
        }


        .stat-item:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }

        .stat-label {
          color: var(--text-secondary);
          font-size: 0.875rem;
          font-weight: 500;
        }

        .stat-value {
          color: var(--text-primary);
          font-size: 1.5rem;
          font-weight: 700;
        }

        .stat-value.success {
          color: #22c55e;
        }

        .stat-value.error {
          color: #ef4444;
        }

        /* Responsive adjustments */
        @media (max-width: 1200px) {
          .chart-cards-grid {
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .chart-cards-grid {
            grid-template-columns: 1fr;
          }
          
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .chart-card-header {
            padding: 20px;
          }
          
          .chart-card-content {
            padding: 20px;
          }

          .chart-card-icon {
            font-size: 2rem;
            min-width: 48px;
            height: 48px;
          }

          .chart-card-title {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .chart-cards-grid {
            gap: 16px;
          }

          .chart-card-header {
            padding: 16px;
          }
          
          .chart-card-content {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default Graph;