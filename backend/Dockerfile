# Base Image - Ubuntu with Python
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies including cron and Python
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    iputils-ping \
    netcat-openbsd \
    telnet \
    cron \
    python3 \
    python3-pip \
    python3-venv \
    inotify-tools \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Create directories for cron
RUN mkdir -p /var/log/cron /etc/cron.d

# Create a default crontab file
RUN echo "# Default crontab - will be replaced by dynamic crontab" > /etc/cron.d/app-crontab

# Create script to reload crontab
RUN echo '#!/bin/bash' > /usr/local/bin/reload-crontab && \
    echo '# Script to reload crontab when changes are detected' >> /usr/local/bin/reload-crontab && \
    echo 'echo "Reloading crontab..."' >> /usr/local/bin/reload-crontab && \
    echo 'crontab /etc/cron.d/app-crontab' >> /usr/local/bin/reload-crontab && \
    echo 'echo "Crontab reloaded successfully"' >> /usr/local/bin/reload-crontab && \
    chmod +x /usr/local/bin/reload-crontab

# Create script to watch for crontab changes
RUN echo '#!/bin/bash' > /usr/local/bin/watch-crontab && \
    echo '# Watch for changes in crontab file and reload' >> /usr/local/bin/watch-crontab && \
    echo 'while true; do' >> /usr/local/bin/watch-crontab && \
    echo '    if [ -f /etc/cron.d/app-crontab ]; then' >> /usr/local/bin/watch-crontab && \
    echo '        inotifywait -e modify /etc/cron.d/app-crontab 2>/dev/null || sleep 5' >> /usr/local/bin/watch-crontab && \
    echo '        /usr/local/bin/reload-crontab' >> /usr/local/bin/watch-crontab && \
    echo '    else' >> /usr/local/bin/watch-crontab && \
    echo '        sleep 5' >> /usr/local/bin/watch-crontab && \
    echo '    fi' >> /usr/local/bin/watch-crontab && \
    echo 'done' >> /usr/local/bin/watch-crontab && \
    chmod +x /usr/local/bin/watch-crontab

COPY app/ /app/app/
COPY requirements.txt /app/
COPY monitor_daemon.py /app/

RUN pip3 install --no-cache-dir -r requirements.txt

# Make the monitoring daemon executable
RUN chmod +x /app/monitor_daemon.py

# Create startup script that starts both cron and Python server
RUN echo '#!/bin/bash' > /usr/local/bin/start.sh && \
    echo '# Kunal 23/06/2025 #' \
    echo 'set -e' >> /usr/local/bin/start.sh && \
    echo '' >> /usr/local/bin/start.sh && \
    echo '# Ensure cron directories exist' >> /usr/local/bin/start.sh && \
    echo 'mkdir -p /var/spool/cron/crontabs' >> /usr/local/bin/start.sh && \
    echo 'mkdir -p /var/log/cron' >> /usr/local/bin/start.sh && \
    echo '' >> /usr/local/bin/start.sh && \
    echo '# Initialize crontab if empty' >> /usr/local/bin/start.sh && \
    echo 'if [ ! -s /var/spool/cron/crontabs/root ]; then' >> /usr/local/bin/start.sh && \
    echo '    echo "# Default crontab - will be replaced by dynamic crontab" > /var/spool/cron/crontabs/root' >> /usr/local/bin/start.sh && \
    echo '    echo "Monitoring daemon will be started by the application" >> /var/spool/cron/crontabs/root' >> /usr/local/bin/start.sh && \
    echo '    chmod 600 /var/spool/cron/crontabs/root' >> /usr/local/bin/start.sh && \
    echo '    echo "Initialized empty crontab"' >> /usr/local/bin/start.sh && \
    echo 'fi' >> /usr/local/bin/start.sh && \
    echo '' >> /usr/local/bin/start.sh && \
    echo '# Start cron daemon' >> /usr/local/bin/start.sh && \
    echo 'echo "Starting cron daemon..."' >> /usr/local/bin/start.sh && \
    echo 'service cron start || { echo "Failed to start cron service"; exit 1; }' >> /usr/local/bin/start.sh && \
    echo 'echo "Cron daemon started successfully"' >> /usr/local/bin/start.sh && \
    echo '' >> /usr/local/bin/start.sh && \
    echo '# Verify cron is running' >> /usr/local/bin/start.sh && \
    echo 'sleep 2' >> /usr/local/bin/start.sh && \
    echo 'if ! service cron status > /dev/null 2>&1; then' >> /usr/local/bin/start.sh && \
    echo '    echo "ERROR: Cron service is not running!"' >> /usr/local/bin/start.sh && \
    echo '    exit 1' >> /usr/local/bin/start.sh && \
    echo 'fi' >> /usr/local/bin/start.sh && \
    echo 'echo "Cron service is running"' >> /usr/local/bin/start.sh && \
    echo '' >> /usr/local/bin/start.sh && \
    echo '# Start crontab watcher in background' >> /usr/local/bin/start.sh && \
    echo '/usr/local/bin/watch-crontab &' >> /usr/local/bin/start.sh && \
    echo 'echo "Crontab watcher started"' >> /usr/local/bin/start.sh && \
    echo '' >> /usr/local/bin/start.sh && \
    echo '# Start monitoring daemon in background' >> /usr/local/bin/start.sh && \
    echo 'if [ -f .env ]; then' >> /usr/local/bin/start.sh && \
    echo '    export $(grep -v "^#" .env | xargs)' >> /usr/local/bin/start.sh && \
    echo 'fi' >> /usr/local/bin/start.sh && \
    echo 'nohup python3 /app/monitor_daemon.py > /var/log/cron/monitoring.log 2>&1 &' >> /usr/local/bin/start.sh && \
    echo 'echo $! > /tmp/monitor_daemon.pid' >> /usr/local/bin/start.sh && \
    echo 'echo "Monitoring daemon started"' >> /usr/local/bin/start.sh && \
    echo '' >> /usr/local/bin/start.sh && \
    echo '# Start the Python application' >> /usr/local/bin/start.sh && \
    echo 'echo "Starting Python application..."' >> /usr/local/bin/start.sh && \
    echo 'exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8011 --reload' >> /usr/local/bin/start.sh && \
    chmod +x /usr/local/bin/start.sh

EXPOSE 8011

# Use the startup script
CMD ["/usr/local/bin/start.sh"]
