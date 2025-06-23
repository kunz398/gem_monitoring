# app/monitor.py
from app.db import get_connection
import psycopg2.extras
import subprocess
import time

RETRIES = 3
RETRY_DELAY = 1  # seconds between retries

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

def check_service(service: dict) -> dict:
    protocol = service["protocol"]
    ip = service["ip_address"]
    port = str(service["port"])
    service_id = service["id"]

    command = []
    status = "down"
    output = ""

    # Build command
    if protocol == "ping":
        command = ["ping", "-c", "2", ip]
    elif protocol == "http":
        command = ["curl", "-Is", f"http://{ip}:{port}"]
    elif protocol == "tcp":
        command = ["nc", "-zv", ip, port]
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
