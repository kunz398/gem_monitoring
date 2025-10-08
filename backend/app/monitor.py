# app/monitor.py
from app.db import get_connection
import psycopg2.extras
import subprocess
import time
import requests
import json
import re
from datetime import datetime, timedelta

RETRIES = 3
RETRY_DELAY = 1  # seconds between retries

# Ocean Portal API endpoints
OCEAN_API_DATASET = 'https://ocean-middleware.spc.int/middleware/api/dataset/'
OCEAN_API_TASK_DOWNLOAD = 'https://ocean-middleware.spc.int/middleware/api/task_download/'

def log_monitoring_result(service_id: int, status: str, message: str, command: str):
    full_message = f"Command: {command}\nResult: {message[:450]}"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO monitoring_logs (service_id, status, message)
                VALUES (%s, %s, %s)
            """, (service_id, status, full_message))
            conn.commit()

def update_service_status(service_id: int, status: str):
    success = status == "up"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE monitored_services
                SET
                    last_status = %s,
                    success_count = success_count + %s,
                    failure_count = failure_count + %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (status, 1 if success else 0, 0 if success else 1, service_id))
            conn.commit()

def fetch_all_services():
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM monitored_services ORDER BY id")
            return cur.fetchall()

def fetch_service(service_id: int):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM monitored_services WHERE id = %s", (service_id,))
            return cur.fetchone()

def sort_json_by_id(data):
    """Sort JSON data by ID field"""
    if isinstance(data, list):
        return sorted(data, key=lambda x: x.get('id', 0))
    elif isinstance(data, dict):
        if 'results' in data and isinstance(data['results'], list):
            data['results'] = sorted(data['results'], key=lambda x: x.get('id', 0))
        elif 'data' in data and isinstance(data['data'], list):
            data['data'] = sorted(data['data'], key=lambda x: x.get('id', 0))
        return data
    return data

def get_dataset_json():
    """Fetch dataset from Ocean Portal API"""
    try:
        response = requests.get(OCEAN_API_DATASET, timeout=60)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return None
    except json.JSONDecodeError as e:
        return None

def get_task_json():
    """Fetch task data from Ocean Portal API"""
    try:
        response = requests.get(OCEAN_API_TASK_DOWNLOAD, timeout=60)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return None
    except json.JSONDecodeError as e:
        return None

def ocean_service_check(service: dict) -> dict:
    """
    Special monitoring function for ocean middleware services
    """
    service_id = service["id"]
    service_name = service["name"]
    
    try:
        # Extract task ID from service name (format: "ID: task_name")
        task_id_str = service_name.split(":")[0].strip()
        task_id = int(task_id_str)
        
        # Fetch data from Ocean Portal APIs
        dataset_data = get_dataset_json()
        task_data = get_task_json()
        
        if not dataset_data or not task_data:
            status = "down"
            message = "Failed to fetch data from Ocean Portal APIs"
            log_monitoring_result(service_id, status, message, "Ocean Portal API check")
            update_service_status(service_id, status)
            return {"service_id": service_id, "status": status, "output": message}
        
        # Sort data by ID
        dataset_data = sort_json_by_id(dataset_data)
        task_data = sort_json_by_id(task_data)
        
        # Process dataset data to determine frequency (matching monitor_oceans_portal.py logic)
        for dataset in dataset_data:
            if dataset['frequency_hours'] != 0:
                dataset['when'] = "daily"
            if dataset['frequency_days'] != 0:
                dataset['when'] = "daily"
            if dataset['frequency_months'] != 0:
                dataset['when'] = "monthly"
        
        # Find the specific dataset and task
        target_dataset = None
        target_task = None
        
        for dataset in dataset_data:
            if dataset['id'] == task_id:
                target_dataset = dataset
                break
        
        for task in task_data:
            if task['id'] == task_id:
                target_task = task
                break
        
        if not target_dataset or not target_task:
            status = "down"
            message = f"Task ID {task_id} not found in Ocean Portal data"
            log_monitoring_result(service_id, status, message, "Ocean Portal API check")
            update_service_status(service_id, status)
            return {"service_id": service_id, "status": status, "output": message}
        
        # Process dates and determine status using the exact logic from monitor_oceans_portal.py
        status, message = process_ocean_task_status_exact(target_dataset, target_task)
        
        # Log and update
        log_monitoring_result(service_id, status, message, "Ocean Portal API check")
        update_service_status(service_id, status)
        
        return {"service_id": service_id, "status": status, "output": message}
        
    except Exception as e:
        status = "unknown"
        message = f"Error checking ocean service: {str(e)}"
        log_monitoring_result(service_id, status, message, "Ocean Portal API check")
        update_service_status(service_id, status)
        return {"service_id": service_id, "status": status, "output": message}

def process_ocean_task_status_exact(dataset, task):
    """Process ocean task status using exact logic from monitor_oceans_portal.py"""
    task_name = task['task_name']
    when = dataset.get('when', 'unknown')
    last_download_file = task['last_download_file']
    next_download_file = task['next_download_file']
    download_file_prefix = dataset['download_file_prefix']
    download_file_infix = dataset['download_file_infix']
    download_file_suffix = dataset['download_file_suffix']
    
    # Handle special cases
    if task_name == 'download_coral_bleaching_monthly_outlook':
        download_file_prefix = 'cfsv2_outlook-060perc_4mon-and-wkly_v5_icwk'
        download_file_suffix = '_for_20250706to20251026.nc'
    
    # Extract date strings
    if next_download_file and last_download_file:
        next_date_str = next_download_file[len(download_file_prefix):-len(download_file_suffix)]
        last_date_str = last_download_file[len(download_file_prefix):-len(download_file_suffix)]
        
        # Parse dates using exact logic from monitor_oceans_portal.py
        next_start_date, next_end_date = parse_ocean_date_exact(next_date_str, download_file_infix, task_name, download_file_prefix, download_file_suffix, next_download_file)
        last_start_date, last_end_date = parse_ocean_date_exact(last_date_str, download_file_infix, task_name, download_file_prefix, download_file_suffix, last_download_file)
    else:
        next_start_date, next_end_date = "none", "none"
        last_start_date, last_end_date = "none", "none"
    
    # Determine status based on frequency using exact logic
    if when == "monthly":
        return check_monthly_status_exact(dataset['id'], next_start_date, next_end_date, last_start_date, last_end_date)
    elif when == "daily":
        return check_daily_status_exact(last_start_date)
    else:
        return "unknown", f"Unknown frequency: {when}"

def parse_ocean_date_exact(date_str, infix, task_name, prefix, suffix, full_filename):
    """Parse ocean date string using exact logic from monitor_oceans_portal.py"""
    if full_filename is None:
        return "none", "none"
        
    if task_name == 'download_bluelink_daily_forecast':
        return "none", "none"
    
    if task_name == 'calculate_sst_anomalies_monthly':
        prefix = 'oisst-avhrr-v02r01.'
        suffix = '.nc'
        infix = '%Y%m'
        date_str = full_filename[len(prefix):-len(suffix)]
        try:
            parsed_date = datetime.strptime(date_str, infix)
            return parsed_date.isoformat(), "none"
        except ValueError:
            return "none", "none"
    
    if '_%H' in infix:
        infix = "%Y%m%d"
        date_str = date_str.split("_")[0]
        try:
            parsed_date = datetime.strptime(date_str, infix)
            return parsed_date.isoformat(), "none"
        except ValueError:
            return "none", "none"
    
    if '_' in date_str:
        if task_name.strip() == 'calculate_ssh_monthly':
            match = re.search(r'(\d{6}_\d{6})\.nc$', full_filename)
            if match:
                date_str = match.group(1)
                infix = '%Y%m_%Y%m'
                date_format_start, date_format_end = infix.split("_")
                start_str, end_str = date_str.split("_")
                try:
                    parsed_date_start = datetime.strptime(start_str, date_format_start)
                    parsed_date_end = datetime.strptime(end_str, date_format_end)
                    return parsed_date_start.isoformat(), parsed_date_end.isoformat()
                except ValueError:
                    return "none", "none"
        else:
            date_format_start, date_format_end = infix.split("_")
            start_str, end_str = date_str.split("_")
            try:
                parsed_date_start = datetime.strptime(start_str, date_format_start)
                parsed_date_end = datetime.strptime(end_str, date_format_end)
                return parsed_date_start.isoformat(), parsed_date_end.isoformat()
            except ValueError:
                return "none", "none"
    
    elif infix == 'none':
        return "none", "none"
    else:
        # Single date format
        try:
            parsed_date = datetime.strptime(date_str, infix)
            return parsed_date.isoformat(), "none"
        except ValueError:
            return "none", "none"

def check_monthly_status_exact(dataset_id, next_start_date, next_end_date, last_start_date, last_end_date):
    """Check status for monthly tasks using exact logic from monitor_oceans_portal.py"""
    current_year = datetime.now().year
    current_month = datetime.now().month
    
    if current_month == 1:
        last_month = 12
        last_month_year = current_year - 1
    else:
        last_month = current_month - 1
        last_month_year = current_year
    
    if dataset_id == 2:
        # Special case for dataset 2 (always 1 month behind)
        dataset_date = next_end_date if next_end_date != 'none' else next_start_date
        if dataset_date == 'none':
            return 'unknown', "Handle this later because the date is none"
        
        try:
            parsed_date = datetime.fromisoformat(dataset_date)
            if parsed_date.year == last_month_year and parsed_date.month == last_month:
                return 'up', ''
            else:
                return 'down', ''
        except ValueError:
            return 'unknown', f"Invalid date format: {dataset_date}"
    else:
        if next_end_date == 'none':
            dataset_date = next_start_date
        else:
            dataset_date = next_end_date
        
        if dataset_date == 'none':
            return 'unknown', "Handle this later because the date is none"
        
        try:
            parsed_date = datetime.fromisoformat(dataset_date)
            if parsed_date.year == current_year and parsed_date.month == current_month:
                return 'up', ''
            else:
                return 'down', ''
        except ValueError:
            return 'unknown', f"Invalid date format: {dataset_date}"

def check_daily_status_exact(last_start_date):
    """Check status for daily tasks using exact logic from monitor_oceans_portal.py"""
    if last_start_date == 'none':
        return 'unknown', "Handle this later because the last start date is none"
    
    try:
        parsed_date = datetime.fromisoformat(last_start_date)
        previous_date = datetime.now() - timedelta(days=1)
        previous_date_2_days = datetime.now() - timedelta(days=2)
        
        if parsed_date.date() == previous_date_2_days.date() or parsed_date.date() == previous_date.date():
            return 'up', ''
        else:
            return 'down', ''
    except ValueError:
        return 'unknown', f"Invalid date format: {last_start_date}"

def check_service(service: dict) -> dict:
    protocol = service["protocol"]
    ip = service["ip_address"]
    port = service["port"]
    service_id = service["id"]

    # Check if this is an ocean middleware service
    if "ocean-middleware.spc.int/middleware/api/" in ip:
        return ocean_service_check(service)

    command = []
    status = "down"
    output = ""

    # Build command
    if protocol == "ping":
        command = ["ping", "-c", "2", ip]
    elif protocol == "http":
        # Only append port if it's a valid, non-default port
        url = f"http://{ip}"
        if port and str(port).isdigit() and int(port) not in (0, 80):
            url += f":{port}"
        command = ["curl", "-Is", url]
    elif protocol == "https":
        url = f"https://{ip}"
        if port and str(port).isdigit() and int(port) not in (0, 443):
            url += f":{port}"
        command = ["curl", "-Is", url]
    elif protocol == "tcp":
        command = ["nc", "-zv", ip, str(port)]
    else:
        output = f"Unsupported protocol: {protocol}"
        log_monitoring_result(service_id, "down", output, "")
        update_service_status(service_id, "down")
        return {"service_id": service_id, "status": "down", "output": output}

    # Retry loop
    for attempt in range(RETRIES):
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
        time.sleep(RETRY_DELAY)

    log_monitoring_result(service_id, status, output, " ".join(command))
    update_service_status(service_id, status)

    return {"service_id": service_id, "status": status, "output": output}

def monitor_all_services() -> list[dict]:
    services = fetch_all_services()
    results = []
    for svc in services:
        results.append(check_service(svc))
    return results

def check_service_by_id(service_id: int):
    """
    Check a specific service by ID - used by cron jobs
    
    Args:
        service_id: The service ID to check
    """
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM monitored_services WHERE id = %s", (service_id,))
                service = cur.fetchone()
                
                if not service:
                    print(f"Service with ID {service_id} not found")
                    return
                
                # Check the service
                result = check_service(service)
                print(f"Checked service {service_id} ({service['name']}): {result['status']}")
                
    except Exception as e:
        print(f"Error checking service {service_id}: {e}")

def populate_ocean_tasks_in_monitoring_table():
    """
    Check which ocean tasks are already in monitored_services.
    Insert any missing ones based on their 'when' value.
    """

    try:
        # Fetch data from Ocean Portal APIs
        dataset_data = get_dataset_json()
        task_data = get_task_json()
        
        if not dataset_data or not task_data:
            print("Failed to fetch data from Ocean Portal APIs")
            return
        
        # Sort data by ID
        dataset_data = sort_json_by_id(dataset_data)
        task_data = sort_json_by_id(task_data)

        # Process dataset data to determine frequency (matching monitor_oceans_portal.py logic)
        for dataset in dataset_data:
            if dataset['frequency_hours'] != 0:
                dataset['when'] = "daily"
            if dataset['frequency_days'] != 0:
                dataset['when'] = "daily"
            if dataset['frequency_months'] != 0:
                dataset['when'] = "monthly"
        
        # Create task names and determine intervals
        task_names = []
        for task in task_data:
            task_name = f"{task['id']}: {task['task_name']}"
            task_names.append(task_name)

            # Find corresponding dataset
            dataset = None
            for ds in dataset_data:
                if ds['id'] == task['id']:
                    dataset = ds
                    break
            
            if dataset:
                when = dataset.get('when', 'unknown')
                final_status = task.get('final_status', 'unknown')
                final_comments = task.get('final_comments', '')
                
                # Determine check interval based on frequency
                if when == 'daily':
                    check_interval_sec = 1
                    interval_type = 'daily'
                    interval_value = 1
                    interval_unit = 'days'
                elif when == 'monthly':
                    check_interval_sec = 60
                    interval_type = 'specific_day'
                    interval_value = 4
                    interval_unit = 'months'
                else:
                    print(f"Skipping unknown frequency: {when}")
                    continue

                # Check if task already exists in monitored_services
                with get_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT name FROM monitored_services WHERE name = %s", (task_name,))
                        existing_task = cur.fetchone()
                        
                        if not existing_task:
                            # Insert new task
                            insert_query = """
                                INSERT INTO public.monitored_services
                                (id, "name", ip_address, port, protocol, check_interval_sec, interval_type,
                                 interval_value, interval_unit, cron_expression, cron_job_name, last_status,
                                 success_count, failure_count, created_at, updated_at, "comment", is_active)
                                VALUES (nextval('monitored_services_id_seq'::regclass), 
                                        %s, 
                                        %s, 
                                        %s, 
                                        %s, 
                                        %s, 
                                        %s, 
                                        %s, 
                                        %s, 
                                        '', '', 
                                        %s, 
                                        0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 
                                        %s, 
                                        true) 
                                """
                            
                            values = (
                                task_name,
                                'ocean-middleware.spc.int/middleware/api/',
                                80,
                                'http',
                                check_interval_sec,
                                interval_type,
                                interval_value,
                                interval_unit,
                                final_status,
                                final_comments
                            )
                            
                            cur.execute(insert_query, values)
                            conn.commit()
                            print(f"Inserted ocean task: {task_name}")
                        else:
                            print(f"Ocean task already exists: {task_name}")
    
    except Exception as e:
        print(f"Error populating ocean tasks: {e}")
