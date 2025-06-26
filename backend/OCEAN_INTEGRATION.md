# Ocean Portal Integration

This document describes the integration of Ocean Portal monitoring into the monitoring system.

## Overview

The Ocean Portal integration allows monitoring of ocean middleware services by:
1. **Automatic population** of ocean tasks in the monitoring database
2. Fetching data from Ocean Portal APIs
3. Processing task status based on file dates and frequencies
4. Updating the monitoring database with results

## Components

### 1. Ocean Service Check (`monitor.py`)

The `ocean_service_check()` function in `monitor.py` handles the monitoring logic for ocean services:

- **Input**: Service dictionary from the database
- **Process**: 
  - Extracts task ID from service name
  - Fetches data from Ocean Portal APIs
  - Processes dates and determines status
  - Logs results to monitoring_logs table
- **Output**: Status dictionary with service_id, status, and output

### 2. Ocean Task Population (`monitor.py`)

The `populate_ocean_tasks_in_monitoring_table()` function populates the monitored_services table with ocean tasks:

- Fetches dataset and task data from Ocean Portal APIs
- Determines check intervals based on frequency (daily/monthly)
- Inserts missing tasks into the database

### 3. Monitor Daemon Integration (`monitor_daemon.py`)

The monitor daemon has been updated to handle ocean services automatically:

- **Automatic Population**: Populates ocean tasks on startup and every hour
- Detects ocean services by IP address pattern
- Uses `check_ocean_service()` method for ocean services
- Regular services continue to use standard monitoring

## Usage

### 1. Automatic Population (Recommended)

The daemon now automatically handles ocean task population:

- **On Startup**: Automatically populates ocean tasks when the daemon starts
- **Every Hour**: Checks for new ocean tasks and adds them to the database
- **No Manual Intervention**: You don't need to run any scripts manually

### 2. Manual Population (Optional)

If you want to manually populate ocean tasks, you can still run:

```bash
cd backend
python populate_ocean_tasks.py
```

### 3. Test Integration

Test the integration with:

```bash
cd backend
python test_ocean_integration.py
```

### 4. Monitor Daemon

Start the monitor daemon and it will handle everything automatically:

```bash
cd backend
python app/monitor_daemon.py
```

The daemon will:
1. Populate ocean tasks on startup
2. Check for new ocean tasks every hour
3. Monitor all services (regular + ocean) based on their intervals

## API Endpoints

The integration uses these Ocean Portal API endpoints:

- **Dataset API**: `https://ocean-middleware.spc.int/middleware/api/dataset/`
- **Task Download API**: `https://ocean-middleware.spc.int/middleware/api/task_download/`

## Status Logic

### Daily Tasks
- Check if last download was within the last 2 days
- Status: `up` if recent, `down` if not

### Monthly Tasks
- Check if data is from current month (or last month for special cases)
- Status: `up` if current, `down` if not

### Special Cases
- Dataset ID 2: Always 1 month behind
- Some tasks have no date information: marked as `unknown`

## Database Schema

Ocean services are stored in the `monitored_services` table with:

- **name**: Format "ID: task_name" (e.g., "1: download_sst_daily")
- **ip_address**: "ocean-middleware.spc.int/middleware/api/"
- **protocol**: "http"
- **port**: 80
- **interval_type**: "hours" for daily, "daily" for monthly
- **interval_value**: 1
- **interval_unit**: "hours" or "days"

## Monitoring Logs

Results are logged to the `monitoring_logs` table with:

- **service_id**: The monitored service ID
- **status**: "up", "down", or "unknown"
- **message**: Detailed status information and comments

## Error Handling

The integration includes comprehensive error handling:

- API connection failures
- JSON parsing errors
- Date parsing errors
- Database connection issues

All errors are logged to the monitoring_logs table for debugging.

## Automatic Features

### Population Schedule
- **Startup**: Automatically populates ocean tasks when daemon starts
- **Hourly**: Checks for new ocean tasks every hour
- **Logging**: All population activities are logged

### Monitoring Schedule
- **Daily Tasks**: Checked every hour
- **Monthly Tasks**: Checked daily
- **Adaptive**: Sleeps efficiently between checks 