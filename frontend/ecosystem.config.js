module.exports = {
  apps: [{
    name: 'react-app',
    script: 'node',
    args: 'node_modules/react-scripts/scripts/start.js',
    env: {
      NODE_ENV: 'development',
      PORT: 3111,
      HOST: '0.0.0.0'
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
