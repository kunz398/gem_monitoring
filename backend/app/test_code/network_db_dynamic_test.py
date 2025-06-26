from app.db import get_connection
import psycopg2.extras
import subprocess
import time

# ---------- CONFIG ----------
RETRIES = 3
RETRY_DELAY = 1  # seconds between retries

# ---------- LOGGING TO MONITORING_LOGS ----------
def log_monitoring_result(service_id: int, status: str, message: str, command: str):
    full_message = f"Command: {command}\nResult: {message[:450]}"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO monitoring_logs (service_id, status, message)
                VALUES (%s, %s, %s)
            """, (service_id, status, full_message))
            conn.commit()

# ---------- UPDATE MAIN SERVICE STATUS ----------
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

# ---------- FETCH ALL SERVICES ----------
def fetch_all_services():
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM monitored_services ORDER BY id")
            return cur.fetchall()

# ---------- PERFORM CHECK WITH RETRIES ----------
def check_service_and_log(service: dict):
    protocol = service["protocol"]
    ip = service["ip_address"]
    port = str(service["port"])
    service_id = service["id"]

    command = []
    status = "down"
    output = ""

    print(f"\n[CHECK] {service['name']} (ID: {service_id}) via {protocol}")

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
        return

    # Retry loop
    for attempt in range(RETRIES):
        print(f"[TRY {attempt+1}/{RETRIES}] {' '.join(command)}")
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                status = "up"
                output = result.stdout or result.stderr
                print("[SUCCESS] Service is UP")
                break
            else:
                output = result.stderr or "Command failed"
                print("[FAIL] Command returned non-zero code")

        except subprocess.TimeoutExpired:
            output = "Timeout occurred"
            print("[TIMEOUT] Command timed out")
        except Exception as e:
            output = str(e)
            print(f"[ERROR] Exception: {output}")

        time.sleep(RETRY_DELAY)

    # Log and update
    log_monitoring_result(service_id, status, output, " ".join(command))
    update_service_status(service_id, status)

# ---------- MONITOR ALL ----------
def monitor_all_services():
    print("\n[MONITOR] Starting checks...")
    services = fetch_all_services()
    for service in services:
        check_service_and_log(service)
    print("[MONITOR] Done.\n")

# ---------- RUN ----------
if __name__ == "__main__":
    monitor_all_services() 