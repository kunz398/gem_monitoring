import subprocess
import os
import re
from datetime import datetime
from typing import Optional, Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)

class CronManager:
    def __init__(self):
        """Initialize the cron manager"""
        self.crontab_file = "/var/spool/cron/crontabs/root"
        
        # Ensure crontab file exists and has proper permissions
        if not os.path.exists(self.crontab_file):
            with open(self.crontab_file, 'w') as f:
                f.write("# Default crontab - will be replaced by dynamic crontab\n")
                f.write("# Monitoring daemon will be started by the application\n")
            os.chmod(self.crontab_file, 0o600)
            logger.info("Created new crontab file")
        
        # Ensure crontab directory has proper permissions
        crontab_dir = os.path.dirname(self.crontab_file)
        if os.path.exists(crontab_dir):
            os.chmod(crontab_dir, 0o755)
    
    def generate_cron_expression(self, interval_type: str, interval_value: int, interval_unit: str) -> str:
        """
        Generate cron expression based on interval type and value
        
        Args:
            interval_type: 'seconds', 'minutes', 'hours', 'daily', 'weekly', 'monthly', 'specific_day'
            interval_value: The value for the interval
            interval_unit: The unit of the interval
        
        Returns:
            Cron expression string (minute hour day month weekday)
        """
        try:
            if interval_type == 'seconds':
                # For seconds, we'll use every minute as the minimum cron interval
                # Note: Cron doesn't support sub-minute intervals, so seconds intervals
                # will actually run every minute
                return "* * * * *"
            
            elif interval_type == 'minutes':
                if interval_value == 1:
                    return "* * * * *"
                elif interval_value < 60:
                    return f"*/{interval_value} * * * *"
                else:
                    # Convert to hours
                    hours = interval_value // 60
                    return f"0 */{hours} * * *"
            
            elif interval_type == 'hours':
                if interval_value == 1:
                    return "0 * * * *"
                else:
                    return f"0 */{interval_value} * * *"
            
            elif interval_type == 'daily':
                if interval_value == 1:
                    return "0 0 * * *"  # Every day at midnight
                else:
                    return f"0 0 */{interval_value} * *"  # Every N days at midnight
            
            elif interval_type == 'weekly':
                if interval_value == 1:
                    return "0 0 * * 0"  # Every Sunday at midnight
                else:
                    # For weekly intervals > 1, we'll use daily and handle the logic in the command
                    return "0 0 * * 0"
            
            elif interval_type == 'monthly':
                if interval_value == 1:
                    return "0 0 1 * *"  # First day of every month at midnight
                else:
                    # For monthly intervals > 1, we'll use monthly and handle the logic in the command
                    return "0 0 1 * *"
            
            elif interval_type == 'specific_day':
                # Specific day of the month (e.g., 15th day)
                if 1 <= interval_value <= 31:
                    return f"0 0 {interval_value} * *"
                else:
                    raise ValueError(f"Invalid day of month: {interval_value}")
            
            else:
                raise ValueError(f"Unsupported interval type: {interval_type}")
        
        except Exception as e:
            logger.error(f"Error generating cron expression: {e}")
            return "* * * * *"  # Default to every minute
    
    def create_monitoring_command(self, service_id: int, interval_type: str, interval_value: int, interval_unit: str) -> str:
        """
        Create the command to run for monitoring a service
        
        Args:
            service_id: The service ID to monitor
            interval_type: The interval type
            interval_value: The interval value
            interval_unit: The interval unit
        
        Returns:
            Command string to execute
        """
        # Use the single monitoring daemon script
        return "/app/app/monitor_daemon.py"
    
    def get_daemon_path(self) -> str:
        """Get the path to the monitoring daemon"""
        return "/app/app/monitor_daemon.py"
    
    def add_service_cronjob(self, service_id: int, service_name: str, interval_type: str, 
                           interval_value: int, interval_unit: str) -> bool:
        """
        Add a cron job for monitoring a service
        
        Args:
            service_id: The service ID
            service_name: The service name (used for job naming)
            interval_type: The interval type
            interval_value: The interval value
            interval_unit: The interval unit
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # For now, we don't need to add individual cron jobs since the daemon
            # handles all services dynamically. The daemon is started by the container
            # startup script and manages all services based on their intervals.
            logger.info(f"Service {service_id} ({service_name}) will be monitored by the daemon")
            return True
            
        except Exception as e:
            logger.error(f"Error adding cron job for service {service_id}: {e}")
            return False
    
    def update_service_cronjob(self, service_id: int, service_name: str, interval_type: str, 
                              interval_value: int, interval_unit: str) -> bool:
        """
        Update an existing cron job for a service
        
        Args:
            service_id: The service ID
            service_name: The service name
            interval_type: The interval type
            interval_value: The interval value
            interval_unit: The interval unit
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Remove existing job
            self.remove_service_cronjob(service_id, service_name)
            
            # Add new job
            return self.add_service_cronjob(service_id, service_name, interval_type, interval_value, interval_unit)
            
        except Exception as e:
            logger.error(f"Error updating cron job for service {service_id}: {e}")
            return False
    
    def remove_service_cronjob(self, service_id: int, service_name: str) -> bool:
        """
        Remove a cron job for a service
        
        Args:
            service_id: The service ID
            service_name: The service name
        
        Returns:
            True if successful, False otherwise
        """
        # With the daemon approach, we don't need to remove individual cron jobs
        # The daemon will automatically stop monitoring services that are deleted
        logger.info(f"Service {service_id} will be automatically removed from monitoring by the daemon")
        return True
    
    def reload_crontab(self):
        """Reload the crontab"""
        try:
            # Use crontab command to reload the file
            subprocess.run(['crontab', self.crontab_file], check=True)
            logger.info("Crontab reloaded successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Error reloading crontab: {e}")
        except Exception as e:
            logger.error(f"Unexpected error reloading crontab: {e}")
    
    def clear_all_cronjobs(self):
        """Clear all cron jobs"""
        try:
            # Clear the crontab file but keep the header
            with open(self.crontab_file, 'w') as f:
                f.write("# Default crontab - will be replaced by dynamic crontab\n")
                f.write("# Monitoring daemon will be started by the application\n")
            
            # Reload the crontab
            self.reload_crontab()
            logger.info("All cron jobs cleared")
        except Exception as e:
            logger.error(f"Error clearing cron jobs: {e}")
    
    def list_cronjobs(self) -> List[Dict]:
        """List all cron jobs"""
        try:
            jobs = []
            with open(self.crontab_file, 'r') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line and not line.startswith('#'):
                        # Parse cron line
                        parts = line.split()
                        if len(parts) >= 6:
                            cron_expr = ' '.join(parts[:5])
                            command = ' '.join(parts[5:])
                            jobs.append({
                                'line': line_num,
                                'cron_expression': cron_expr,
                                'command': command
                            })
            return jobs
        except Exception as e:
            logger.error(f"Error listing cron jobs: {e}")
            return []
    
    def get_cron_status(self) -> Dict:
        """Get cron service status"""
        try:
            # Check if cron service is running
            result = subprocess.run(['service', 'cron', 'status'], 
                                  capture_output=True, text=True)
            cron_running = "running" in result.stdout.lower()
            
            # Count jobs
            jobs = self.list_cronjobs()
            
            return {
                'cron_service_running': cron_running,
                'total_jobs': len(jobs),
                'active_jobs': len([j for j in jobs if j.get('active', True)]),
                'last_updated': datetime.now().isoformat(),
                'error': None
            }
            
        except Exception as e:
            logger.error(f"Error getting cron status: {e}")
            return {
                'cron_service_running': False,
                'total_jobs': 0,
                'active_jobs': 0,
                'last_updated': datetime.now().isoformat(),
                'error': str(e)
            }

# Global instance
cron_manager = CronManager() 