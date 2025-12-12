#!/usr/bin/env python3
"""
Monitoring Daemon - Handles all service monitoring in a single process
"""
import time
import os
import sys
import signal
import logging
import subprocess
import requests
import json
import urllib3
from datetime import datetime, timedelta
from typing import Dict, List
import psycopg2
import psycopg2.extras
import psycopg2.pool

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Import ocean service check functionality
from app.monitor import ocean_service_check, populate_ocean_tasks_in_monitoring_table, check_dataset_service, check_thredds_service

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/cron/monitoring.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'dbname': os.getenv('DB_NAME', 'monitoring_db'),
    'user': os.getenv('DB_USER', 'gem_user'),
    'password': os.getenv('DB_PASSWORD', 'P@ssword123'),
    'host': os.getenv('DB_HOST', 'db'),
    'port': int(os.getenv('DB_PORT', '5432'))
}

# DB_CONFIG = {
#     'dbname': os.getenv('DB_NAME', 'monitoring_db'),
#     'user': os.getenv('DB_USER', 'postgres'),
#     'password': os.getenv('DB_PASSWORD', 'postgres'),
#     'host': os.getenv('DB_HOST', 'localhost'),
#     'port': int(os.getenv('DB_PORT', '5432'))
# }


class MonitoringDaemon:
    def __init__(self):
        """Initialize the monitoring daemon"""
        self.running = True
        self.service_schedules = {}  # service_id -> next_run_time
        self.last_ocean_population = None  # Track when we last populated ocean tasks
        
        # Set up signal handlers
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)
        
        # Initialize connection pool
        try:
            self.connection_pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,
                maxconn=5,
                **DB_CONFIG
            )
            logger.info("Database connection pool initialized")
        except Exception as e:
            logger.error(f"Error initializing connection pool: {e}")
            self.connection_pool = None
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, shutting down...")
        self.running = False
        if self.connection_pool:
            self.connection_pool.closeall()
    
    def get_connection(self):
        """Get database connection from pool"""
        if self.connection_pool:
            try:
                return self.connection_pool.getconn()
            except psycopg2.pool.PoolError as e:
                logger.error(f"Connection pool exhausted: {e}")
                return psycopg2.connect(**DB_CONFIG)
        else:
            return psycopg2.connect(**DB_CONFIG)
    
    def return_connection(self, conn):
        """Return connection to pool"""
        if self.connection_pool:
            try:
                if conn and not conn.closed:
                    self.connection_pool.putconn(conn)
            except Exception as e:
                logger.error(f"Error returning connection to pool: {e}")
                try:
                    conn.close()
                except:
                    pass
        else:
            try:
                conn.close()
            except:
                pass
    
    def get_active_services(self) -> List[Dict]:
        """Get all active services from database"""
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, name, ip_address, port, protocol, 
                           interval_type, interval_value, interval_unit,
                           last_status, success_count, failure_count, type
                    FROM monitored_services 
                    WHERE is_active = true 
                    ORDER BY id
                """)
                return cur.fetchall()
        except Exception as e:
            logger.error(f"Error fetching services: {e}")
            return []
        finally:
            if conn:
                self.return_connection(conn)
    
    def calculate_next_run_time(self, service: Dict, current_time: datetime) -> datetime:
        """Calculate when the service should run next based on its interval"""
        interval_type = service['interval_type']
        interval_value = service['interval_value']
        
        if interval_type == 'seconds':
            return current_time + timedelta(minutes=1)
        elif interval_type == 'minutes':
            return current_time + timedelta(minutes=interval_value)
        elif interval_type == 'hours':
            return current_time + timedelta(hours=interval_value)
        elif interval_type == 'daily':
            return current_time + timedelta(days=interval_value)
        elif interval_type == 'weekly':
            return current_time + timedelta(weeks=interval_value)
        elif interval_type == 'monthly':
            return current_time + timedelta(days=30 * interval_value)
        elif interval_type == 'specific_day':
            next_month = current_time.replace(day=1) + timedelta(days=32)
            next_month = next_month.replace(day=1)
            target_day = min(interval_value, 28)
            return next_month.replace(day=target_day)
        else:
            return current_time + timedelta(minutes=1)
    
    def get_cloud_token(self):
        """Get the cloud monitoring token from the database"""
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT configuration FROM dashboard_configs WHERE name = 'cloud-monitoring.corp.spc.int'")
                result = cur.fetchone()
                if result:
                    return result[0]
        except Exception as e:
            logger.error(f"Error getting cloud token: {e}")
        finally:
            if conn:
                self.return_connection(conn)
        return None

    def check_cloud_service(self, service: Dict):
        """Check a Server Cloud service"""
        service_id = service["id"]
        service_name = service["name"]
        
        token = self.get_cloud_token()
        if not token:
            self.log_monitoring_result(service_id, "unknown", "No cloud token found in database", "Cloud API Check")
            self.update_service_status(service_id, "unknown")
            return

        url = "https://cloud-monitoring.corp.spc.int/api/collections/systems/records"
        params = {
            "page": 1,
            "perPage": 1,
            "filter": f"name='{service_name}'"
        }
        headers = {
            "Authorization": f"Bearer {token}"
        }

        try:
            response = requests.get(url, params=params, headers=headers, verify=False, timeout=10)
            
            if response.status_code != 200:
                self.log_monitoring_result(service_id, "unknown", f"API Error: {response.status_code} - {response.text}", f"GET {url}")
                self.update_service_status(service_id, "unknown")
                return

            data = response.json()
            items = data.get("items", [])
            
            if not items:
                self.log_monitoring_result(service_id, "unknown", f"Service '{service_name}' not found in cloud monitoring", f"GET {url}")
                self.update_service_status(service_id, "unknown")
                return

            item = items[0]
            status = item.get("status", "unknown")
            updated_at_str = item.get("updated")
            
            # Log the result
            self.log_monitoring_result(service_id, status, f"Cloud status: {status}, Last updated: {updated_at_str}", f"GET {url}")
            
            # Update service status and updated_at time
            conn = None
            try:
                conn = self.get_connection()
                with conn.cursor() as cur:
                    # We need to update updated_at specifically from the cloud data
                    # The standard update_service_status sets updated_at to NOW(), which is fine for local check time
                    # But user requested "created and updated at would come from updated"
                    # However, for monitoring logs, we usually want to know when WE checked it.
                    # But the user said: "update the status and updated: ..."
                    
                    # Let's stick to the standard update first, but maybe we should also update the record with the cloud's updated time?
                    # The user said: "all we need to do is update the status and updated"
                    
                    success = status == "up"
                    cur.execute("""
                        UPDATE monitored_services
                        SET
                            last_status = %s,
                            success_count = success_count + %s,
                            failure_count = failure_count + %s,
                            updated_at = %s
                        WHERE id = %s
                    """, (status, 1 if success else 0, 0 if success else 1, updated_at_str, service_id))
                    conn.commit()
            except Exception as e:
                logger.error(f"Error updating cloud service status {service_id}: {e}")
            finally:
                if conn:
                    self.return_connection(conn)
                    
            logger.info(f"Checked cloud service {service_id} ({service_name}): {status}")

        except Exception as e:
            logger.error(f"Error checking cloud service {service_id}: {e}")
            self.log_monitoring_result(service_id, "unknown", f"Exception: {str(e)}", f"GET {url}")
            self.update_service_status(service_id, "unknown")

    def check_service(self, service: Dict):
        """Check a single service"""
        protocol = service["protocol"]
        ip = service["ip_address"]
        port = str(service["port"])
        service_id = service["id"]
        service_name = service["name"]
        
        # Check for Server Cloud type
        # We check the 'type' field if it exists in the service dict (it was added to the query in get_active_services)
        service_type = service.get("type")
        if service_type == "Server Cloud":
            self.check_cloud_service(service)
            return
        
        # Check for datasets type
        if service_type == "datasets":
            self.check_dataset_service(service)
            return
        
        # Check for thredds type
        if service_type == "thredds":
            self.check_thredds_service(service)
            return

        # Skip external services - they report their own status via API
        if protocol == "external":
            logger.debug(f"Skipping external service {service_id} ({service_name})")
            return

        # Check if this is an ocean middleware service
        if "ocean-middleware.spc.int/middleware/api/" in ip:
            self.check_ocean_service(service)
            return

        # Build command for regular services
        if protocol == "ping":
            command = ["ping", "-c", "2", ip]
        elif protocol == "http":
            command = ["curl", "-Is", f"http://{ip}:{port}"]
        elif protocol == "tcp":
            command = ["nc", "-zv", ip, port]
        else:
            self.log_monitoring_result(service_id, "down", f"Unsupported protocol: {protocol}", "")
            self.update_service_status(service_id, "down")
            return

        # Retry loop
        status = "down"
        output = ""
        for attempt in range(3):
            try:
                result = subprocess.run(command, capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    status = "up"
                    output = result.stdout or result.stderr
                    break
                else:
                    output = result.stderr or "Command failed"
            except subprocess.TimeoutExpired:
                output = "Timeout occurred"
            except Exception as e:
                output = str(e)
            time.sleep(1)

        self.log_monitoring_result(service_id, status, output, " ".join(command))
        self.update_service_status(service_id, status)
        logger.info(f"Checked service {service_id} ({service_name}): {status}")
    
    def log_monitoring_result(self, service_id: int, status: str, message: str, command: str):
        """Log monitoring result to database"""
        full_message = f"Command: {command}\nResult: {message[:450]}"
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO monitoring_logs (service_id, status, message)
                    VALUES (%s, %s, %s)
                """, (service_id, status, full_message))
                conn.commit()
        except Exception as e:
            logger.error(f"Error logging result for service {service_id}: {e}")
        finally:
            if conn:
                self.return_connection(conn)
    
    def update_service_status(self, service_id: int, status: str):
        """Update service status in database"""
        success = status == "up"
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE monitored_services
                    SET
                        last_status = %s,
                        success_count = success_count + %s,
                        failure_count = failure_count + %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (status, 1 if success else 0, 0 if success else 1, service_id))
                conn.commit()
        except Exception as e:
            logger.error(f"Error updating status for service {service_id}: {e}")
        finally:
            if conn:
                self.return_connection(conn)
    
    def check_ocean_service(self, service: Dict):
        """Check ocean middleware services using the ocean_service_check function"""
        try:
            result = ocean_service_check(service)
            logger.info(f"Checked ocean service {service['id']} ({service['name']}): {result['status']}")
        except Exception as e:
            logger.error(f"Error checking ocean service {service['id']}: {e}")
            # Log the error to monitoring_logs
            self.log_monitoring_result(service['id'], "unknown", f"Error: {str(e)}", "Ocean Portal API check")
            self.update_service_status(service['id'], "unknown")
    
    def check_dataset_service(self, service: Dict):
        """Check dataset services using the check_dataset_service function"""
        try:
            result = check_dataset_service(service)
            logger.info(f"Checked dataset service {service['id']} ({service['name']}): {result['status']}")
        except Exception as e:
            logger.error(f"Error checking dataset service {service['id']}: {e}")
            self.log_monitoring_result(service['id'], "unknown", f"Error: {str(e)}", "Dataset API check")
            self.update_service_status(service['id'], "unknown")
    
    def check_thredds_service(self, service: Dict):
        """Check THREDDS WMS services using the check_thredds_service function"""
        try:
            result = check_thredds_service(service)
            logger.info(f"Checked THREDDS service {service['id']} ({service['name']}): {result['status']}")
        except Exception as e:
            logger.error(f"Error checking THREDDS service {service['id']}: {e}")
            self.log_monitoring_result(service['id'], "unknown", f"Error: {str(e)}", "THREDDS WMS check")
            self.update_service_status(service['id'], "unknown")
    
    def populate_ocean_tasks(self):
        """Populate ocean tasks in the monitoring table"""
        try:
            logger.info("Populating ocean tasks in monitoring table...")
            populate_ocean_tasks_in_monitoring_table()
            self.last_ocean_population = datetime.now()
            logger.info("Ocean tasks population completed")
        except Exception as e:
            logger.error(f"Error populating ocean tasks: {e}")

    def should_populate_ocean_tasks(self) -> bool:
        """Check if we should populate ocean tasks (every hour)"""
        if self.last_ocean_population is None:
            return True
        
        time_since_last = datetime.now() - self.last_ocean_population
        return time_since_last.total_seconds() >= 3600  # 1 hour
    
    def run(self):
        """Main daemon loop"""
        logger.info("Starting monitoring daemon...")
        
        # Populate ocean tasks on startup
        # self.populate_ocean_tasks()
        
        while self.running:
            try:
                current_time = datetime.now()
                
                # Check if we should populate ocean tasks (every hour)
                # if self.should_populate_ocean_tasks():
                #     self.populate_ocean_tasks()
                
                services = self.get_active_services()
                
                # Initialize schedules for new services
                for service in services:
                    service_id = service['id']
                    if service_id not in self.service_schedules:
                        self.service_schedules[service_id] = current_time
                        logger.info(f"Added service {service_id} ({service['name']}) to monitoring schedule")
                
                # Check which services need to be monitored
                services_to_check = []
                next_check_time = None
                
                for service in services:
                    service_id = service['id']
                    next_run = self.service_schedules.get(service_id)
                    
                    if next_run and current_time >= next_run:
                        services_to_check.append(service)
                        self.service_schedules[service_id] = self.calculate_next_run_time(service, current_time)
                    elif next_run:
                        if next_check_time is None or next_run < next_check_time:
                            next_check_time = next_run
                
                # Check services that are due
                for service in services_to_check:
                    try:
                        self.check_service(service)
                    except Exception as e:
                        logger.error(f"Error checking service {service['id']}: {e}")
                
                # Remove schedules for services that are no longer active
                active_service_ids = {s['id'] for s in services}
                for service_id in list(self.service_schedules.keys()):
                    if service_id not in active_service_ids:
                        del self.service_schedules[service_id]
                        logger.info(f"Removed service {service_id} from monitoring schedule")
                
                # Adaptive sleep
                if next_check_time:
                    sleep_seconds = min((next_check_time - current_time).total_seconds(), 60)
                    sleep_seconds = max(sleep_seconds, 1)
                else:
                    sleep_seconds = 60
                
                time.sleep(sleep_seconds)
                
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(30)
        
        logger.info("Monitoring daemon stopped")

def cleanup():
    """Cleanup function to remove PID file on exit"""
    try:
        if os.path.exists('/tmp/monitor_daemon.pid'):
            os.remove('/tmp/monitor_daemon.pid')
            logger.info("Removed PID file")
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")

def main():
    """Main function to run the monitoring daemon"""
    # Set up signal handlers
    signal.signal(signal.SIGTERM, lambda s, f: (cleanup(), sys.exit(0)))
    signal.signal(signal.SIGINT, lambda s, f: (cleanup(), sys.exit(0)))
    
    # Check if daemon is already running
    if os.path.exists('/tmp/monitor_daemon.pid'):
        try:
            with open('/tmp/monitor_daemon.pid', 'r') as f:
                pid = f.read().strip()
            if pid and os.path.exists(f'/proc/{pid}'):
                try:
                    with open(f'/proc/{pid}/cmdline', 'r') as f:
                        cmdline = f.read()
                    if 'monitor_daemon.py' in cmdline:
                        logger.warning("Monitoring daemon already running, exiting")
                        sys.exit(1)
                except:
                    pass
            logger.info("Removing stale PID file")
            os.remove('/tmp/monitor_daemon.pid')
        except Exception as e:
            logger.warning(f"Error checking PID file: {e}, removing it")
            try:
                os.remove('/tmp/monitor_daemon.pid')
            except:
                pass
    
    # Write PID file
    try:
        with open('/tmp/monitor_daemon.pid', 'w') as f:
            f.write(str(os.getpid()))
    except Exception as e:
        logger.error(f"Error writing PID file: {e}")
    
    logger.info("Starting monitoring daemon...")
    daemon = MonitoringDaemon()
    daemon.run()

if __name__ == "__main__":
    main() 