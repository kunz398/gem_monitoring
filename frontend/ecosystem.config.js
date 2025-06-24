module.exports = {
  apps: [{
    name: 'react-app',
    script: 'node_modules/.bin/react-scripts',
    args: 'start',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
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