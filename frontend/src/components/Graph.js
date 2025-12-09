import React from 'react';
import './Graph.css';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
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
      icon: '🕸️',
      description: 'Service reliability scores based on success rates',
      data: getReliabilityData(),
      renderChart: (chartData) => (
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-secondary)' }} />
            <Radar
              name="Reliability"
              dataKey="reliability"
              stroke="#4ade80"
              fill="#4ade80"
              fillOpacity={0.6}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              itemStyle={{ color: 'var(--text-primary)' }}
              formatter={(value) => [`${value}%`, 'Reliability']}
            />
          </RadarChart>
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


    </div>
  );
};

export default Graph;