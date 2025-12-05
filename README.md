# GEM Monitoring System

A comprehensive monitoring system for tracking service health and status with support for both automatic and external monitoring.

## Features

- 🔍 **Multiple Monitoring Protocols**: HTTP, HTTPS, TCP, Ping, and External
- ⏰ **Flexible Scheduling**: Seconds, minutes, hours, daily, weekly, monthly intervals
- 📡 **External Service Support**: Monitor services via API calls from external applications
- 📊 **Real-time Dashboard**: View service status, logs, and history
- 🎨 **Theme Support**: Light and dark mode
- 🔐 **API Key Authentication**: Secure access control
- 🐳 **Docker Support**: Easy deployment with Docker Compose

## Quick Start

### Development
```bash
docker-compose up --build
```

Access:
- Frontend: http://localhost:3111
- Backend API: http://localhost:8011
- Admin Panel: http://localhost:3111/admin

### Production
```bash
docker-compose -f docker-compiser.prod.yml up --build -d
```

## Monitoring Protocols

### Automatic Monitoring
- **HTTP/HTTPS**: Web service health checks
- **TCP**: Port connectivity checks
- **Ping**: ICMP ping tests

### External Monitoring
For services that monitor themselves and report status via API:
- Use protocol: `external`
- No cron jobs or intervals required
- Send status updates from your application

See [EXTERNAL_MONITORING.md](EXTERNAL_MONITORING.md) for complete guide and examples.

## Documentation

- [Deployment Guide](DEPLOYMENT.md) - Production deployment instructions
- [External Monitoring](EXTERNAL_MONITORING.md) - External service integration guide

