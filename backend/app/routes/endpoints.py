from app.monitor import monitor_all_services, check_service, fetch_service
from app.cron_manager import cron_manager
from fastapi import APIRouter, Depends, HTTPException, status, Body, BackgroundTasks
from pydantic import BaseModel, IPvAnyAddress, constr, Field
from typing import List, Optional
from app.auth import verify_api_key
from app.db import get_connection, get_connection_pool  # Using connection pool
import psycopg2.extras
import subprocess
import requests
from datetime import datetime
from typing import Dict, Any
import requests
import json
import urllib3
# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
# created_at: datetime  -- removing stray type hints if they cause issues, but keeping original structure mostly



router = APIRouter()

class PingRequest(BaseModel):
    ip: IPvAnyAddress  # validates IPv4 or IPv6 automatically

class NetcatRequest(BaseModel):
    ip: str
    port: int

# Pydantic schemas
class ServiceBase(BaseModel):
    name: str = Field(..., min_length=1)
    # Accepts both IPs and domain names
    ip_address: str = Field(..., min_length=1)
    port: Optional[int] = None
    protocol: str = Field(..., min_length=1)  # e.g. ping, curl, telnet
    check_interval_sec: Optional[int] = 60  # Keep for backward compatibility
    interval_type: Optional[str] = Field(default='seconds')
    interval_value: Optional[int] = Field(default=60, ge=1)
    interval_unit: Optional[str] = Field(default='seconds')
    comment: Optional[str] = None
    display_order: Optional[int] = Field(default=None, ge=0)
    type: Optional[str] = Field(default='servers')
    collection: Optional[str] = Field(default='uncategorized')

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    ip_address: Optional[str] = Field(default=None, min_length=1)  # Accepts IP or hostname
    port: Optional[int] = Field(default=None)
    protocol: Optional[str] = Field(default=None, min_length=1)
    check_interval_sec: Optional[int] = Field(default=None)
    interval_type: Optional[str] = Field(default=None)
    interval_value: Optional[int] = Field(default=None, ge=1)
    interval_unit: Optional[str] = Field(default=None)
    comment: Optional[str] = Field(default=None)
    is_active: Optional[bool] = Field(default=None)
    display_order: Optional[int] = Field(default=None, ge=0)
    type: Optional[str] = Field(default=None)
    collection: Optional[str] = Field(default=None)

class ServiceOut(BaseModel):
    id: int
    name: str
    ip_address: str
    port: Optional[int] = None
    protocol: str
    check_interval_sec: int
    interval_type: str
    interval_value: int
    interval_unit: str
    cron_expression: Optional[str] = None
    cron_job_name: Optional[str] = None
    last_status: str
    success_count: int
    failure_count: int
    created_at: datetime
    updated_at: datetime
    comment: Optional[str] = None
    is_active: bool
    checked_at: Optional[datetime] = None  # Add default None
    display_order: Optional[int] = None
    type: Optional[str] = None
    collection: Optional[str] = None



    class Config:
        orm_mode = True

class MonitoringLogCreate(BaseModel):
    service_id: int
    status: str
    message: str
    comment: Optional[str] = None


    class Config:
        orm_mode = True

class MonitoringLogOut(BaseModel):
    id: int
    service_id: int
    name: Optional[str] = None  # Add service name field
    checked_at: datetime
    status: str
    message: str
    notification_sent: Optional[bool] = None
    updated_at: Optional[datetime] = None
    comment: Optional[str] = None

    class Config:
        orm_mode = True

class MonitoringLogFilter(BaseModel):
    id: Optional[int] = None  
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    class Config:
        orm_mode = True

# Cronjob Pydantic models for API responses
class CronJobOut(BaseModel):
    id: int
    service_id: int
    job_name: str
    cron_expression: str
    command: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class CronStatusOut(BaseModel):
    cron_service_running: bool
    total_jobs: int
    active_jobs: int
    last_updated: str
    error: Optional[str] = None

class GroupingPreferences(BaseModel):
    grouping_mode: str = 'type'
    group_by_servers: bool = False
    group_by_datasets: bool = False
    group_by_ocean_plotters: bool = False
    group_by_models: bool = False
    group_by_server_cloud: bool = False

@router.get("/grouping-preferences")
def get_grouping_preferences(api_key: str = Depends(verify_api_key)):
    """Get dashboard grouping preferences"""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT configuration FROM dashboard_configs WHERE name = 'grouping_preferences'")
                result = cur.fetchone()
                if result:
                    prefs = json.loads(result[0])
                    # Ensure grouping_mode exists for backward compatibility
                    if 'grouping_mode' not in prefs:
                        prefs['grouping_mode'] = 'type'
                    return prefs
                else:
                    # Return defaults
                    return {
                        "grouping_mode": "type",
                        "group_by_servers": False,
                        "group_by_datasets": False,
                        "group_by_ocean_plotters": False,
                        "group_by_models": False,
                        "group_by_server_cloud": False
                    }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/grouping-preferences")
def update_grouping_preferences(prefs: GroupingPreferences, api_key: str = Depends(verify_api_key)):
    """Update dashboard grouping preferences"""
    try:
        print(f"Updating grouping preferences: {prefs}")
        prefs_json = json.dumps(prefs.dict())
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Upsert
                cur.execute("""
                    INSERT INTO dashboard_configs (name, configuration) 
                    VALUES ('grouping_preferences', %s)
                    ON CONFLICT (name) 
                    DO UPDATE SET configuration = EXCLUDED.configuration
                """, (prefs_json,))
                conn.commit()
        print("Grouping preferences updated successfully")
        return {"status": "success", "preferences": prefs}
    except Exception as e:
        print(f"Error updating grouping preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status", summary="Check service health", dependencies=[Depends(verify_api_key)])
def get_status():
    return {"status": "status ok"}

@router.get("/db-pool-status", summary="Check database connection pool status", dependencies=[Depends(verify_api_key)])
def get_db_pool_status():
    """Get database connection pool status"""
    try:
        pool = get_connection_pool()
        return {
            "pool_type": "SimpleConnectionPool",
            "min_connections": 1,
            "max_connections": 10,
            "pool_status": "active"
        }
    except Exception as e:
        return {
            "error": str(e),
            "pool_status": "unavailable"
        }

@router.post("/ping", summary="Ping test for an IP", dependencies=[Depends(verify_api_key)])
def ping_test(request: PingRequest):
    ip = str(request.ip)
    try:
        result = subprocess.run(
            ["ping", "-c", "4", ip],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return {
                "ip": ip,
                "success": True,
                "output": result.stdout
            }
        else:
            return {
                "ip": ip,
                "success": False,
                "output": result.stderr or "Ping failed"
            }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Ping command timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running ping: {str(e)}")

@router.post("/netcat", summary="Netcat test for IP and port", dependencies=[Depends(verify_api_key)])
def netcat_test(request: NetcatRequest):
    ip = request.ip
    port = str(request.port)

    try:
        result = subprocess.run(
            ["nc", "-zv", ip, port],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return {
                "ip": ip,
                "port": port,
                "success": True,
                "output": result.stdout or result.stderr
            }
        else:
            return {
                "ip": ip,
                "port": port,
                "success": False,
                "output": result.stderr or "Connection failed"
            }

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Netcat command timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running netcat: {str(e)}")

# Utility function for DB query execution with connection pool
def fetch_all_services():
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM monitored_services
                    ORDER BY
                        CASE WHEN display_order IS NULL THEN 1 ELSE 0 END,
                        display_order ASC NULLS LAST,
                        id
                """)
                return cur.fetchall()
    except Exception as e:
        print(f"Database error in fetch_all_services: {e}")
        raise HTTPException(status_code=500, detail="Database error")

def fetch_service(service_id: int):
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM monitored_services WHERE id = %s", (service_id,))
                return cur.fetchone()
    except Exception as e:
        print(f"Database error in fetch_service: {e}")
        raise HTTPException(status_code=500, detail="Database error")

def fetch_monitor_log(log_id: int):
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM monitoring_logs WHERE id = %s", (log_id,))
                return cur.fetchone()
    except Exception as e:
        print(f"Database error in fetch_monitor_log: {e}")
        raise HTTPException(status_code=500, detail="Database error")

def insert_service(service: ServiceCreate):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                display_order_value = service.display_order

                if display_order_value is None:
                    cur.execute("SELECT MAX(display_order) FROM monitored_services")
                    max_order = cur.fetchone()[0]
                    if max_order is None:
                        display_order_value = 0
                    else:
                        display_order_value = int(max_order) + 1
                else:
                    display_order_value = int(display_order_value)

                cur.execute("""
                    INSERT INTO monitored_services (
                        name, ip_address, port, protocol, check_interval_sec, 
                        interval_type, interval_value, interval_unit, comment,
                        display_order, type, collection
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    service.name, str(service.ip_address), service.port, service.protocol, 
                    service.check_interval_sec, service.interval_type, service.interval_value, 
                    service.interval_unit, service.comment, display_order_value, service.type,
                    service.collection
                ))
                result = cur.fetchone()
                service_id = result[0] if result else None
                conn.commit()
                
                if service_id is None:
                    raise Exception("Failed to insert service")
                
                # Create cron job for the new service (skip for external services)
                if service.protocol != 'external':
                    try:
                        cron_manager.add_service_cronjob(
                            service_id, service.name, 
                            service.interval_type or 'seconds', 
                            service.interval_value or 60, 
                            service.interval_unit or 'seconds'
                        )
                    except Exception as e:
                        print(f"Warning: Failed to create cron job for service {service_id}: {e}")
                else:
                    print(f"Skipping cron job creation for external service {service_id}")
                
                return service_id
    except Exception as e:
        print(f"Database error in insert_service: {e}")
        raise HTTPException(status_code=500, detail="Database error")

def insert_monitor_log(monitor_log: MonitoringLogCreate) -> int:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO monitoring_logs (service_id, status, message, comment)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (monitor_log.service_id, monitor_log.status, monitor_log.message, monitor_log.comment))
                result = cur.fetchone()
                
                if not result:
                    raise Exception("Failed to insert monitoring log")
                
                log_id = result[0]

                # Update service status in monitored_services
                # Only increment counts for 'up' or 'down' to avoid skewing stats with custom statuses
                status_val = monitor_log.status
                success_inc = 1 if status_val == 'up' else 0
                failure_inc = 1 if status_val == 'down' else 0
                
                cur.execute("""
                    UPDATE monitored_services
                    SET
                        last_status = %s,
                        success_count = success_count + %s,
                        failure_count = failure_count + %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (status_val, success_inc, failure_inc, monitor_log.service_id))

                conn.commit()
                return log_id
    except Exception as e:
        print(f"Database error in insert_monitor_log: {e}")
        raise HTTPException(status_code=500, detail="Database error")


def update_service(service_id: int, service_update: ServiceUpdate):
    try:
        fields = []
        values = []
        update_data = service_update.dict(exclude_unset=True)
        
        if not update_data:
            return False  # Nothing to update
        
        for key, value in update_data.items():
            fields.append(f"{key} = %s")
            # Convert ip_address back to string for DB
            if key == "ip_address":
                value = str(value)
            if key == "display_order" and value is not None:
                value = int(value)
            values.append(value)

        if not fields:
            return False  # Nothing to update

        set_clause = ", ".join(fields)
        values.append(service_id)

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE monitored_services SET {set_clause} WHERE id = %s
                """, values)
                updated = cur.rowcount
                conn.commit()
                return updated > 0
    except Exception as e:
        print(f"Database error in update_service: {e}")
        raise HTTPException(status_code=500, detail="Database error")

def delete_service(service_id: int):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM monitored_services WHERE id = %s", (service_id,))
                deleted = cur.rowcount
                conn.commit()
                return deleted > 0
    except Exception as e:
        print(f"Database error in delete_service: {e}")
        raise HTTPException(status_code=500, detail="Database error")

# API endpoints
@router.get("/services", response_model=List[ServiceOut], dependencies=[Depends(verify_api_key)])
def list_services():
    services = fetch_all_services()
    return services

@router.get("/services/{service_id}", response_model=ServiceOut, dependencies=[Depends(verify_api_key)])
def get_service(service_id: int):
    service = fetch_service(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@router.post("/services", response_model=ServiceOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_api_key)])
def create_service(service: ServiceCreate):
    service_id = insert_service(service)
    created = fetch_service(service_id)
    return created



@router.post("/monitor_log", response_model=MonitoringLogOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_api_key)])
def create_monitor_log(monitor_log: MonitoringLogCreate):
    monitor_log_id = insert_monitor_log(monitor_log)
    created = fetch_monitor_log(monitor_log_id)
    return created

@router.put("/services/{service_id}", response_model=ServiceOut, dependencies=[Depends(verify_api_key)])
def update_existing_service(
    service_id: int,
    service_update: ServiceUpdate = Body(default=None)
):
    if service_update is None:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    print("Received update fields:", service_update.dict(exclude_unset=True))
    if not fetch_service(service_id):
        raise HTTPException(status_code=404, detail="Service not found")

    updated = update_service(service_id, service_update)
    if not updated:
        raise HTTPException(status_code=400, detail="Nothing to update")

    updated_service = fetch_service(service_id)
    return updated_service

@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_api_key)])
def delete_existing_service(service_id: int):
    if not fetch_service(service_id):
        raise HTTPException(status_code=404, detail="Service not found")

    deleted = delete_service(service_id)
    if not deleted:
        raise HTTPException(status_code=400, detail="Failed to delete service")
    return



####################### Run monitoring for all services #######################
@router.post("/monitor/all", summary="Run monitoring check for all services", dependencies=[Depends(verify_api_key)])
def api_monitor_all_services():
    results = monitor_all_services()
    return {"results": results}

# Run monitoring check for one service by ID
@router.post("/monitor/{service_id}", summary="Run monitoring check for one service by ID", dependencies=[Depends(verify_api_key)])
def api_monitor_single_service(service_id: int):
    service = fetch_service(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    result = check_service(service)
    return result


@router.post("/monitor/all/background", summary="Run monitoring for all services in background", dependencies=[Depends(verify_api_key)])
def api_monitor_all_services_bg(background_tasks: BackgroundTasks):
    background_tasks.add_task(monitor_all_services)
    return {"message": "Monitoring started in background"}

##########

##Monitoring logs table##
@router.post("/monitoring_logs", response_model=List[MonitoringLogOut], dependencies=[Depends(verify_api_key)])
def get_monitoring_logs(filter: MonitoringLogFilter):
    try:
        query = "SELECT monitoring_logs.id, monitored_services.name, monitoring_logs.service_id, monitoring_logs.status, monitoring_logs.message, monitoring_logs.checked_at FROM monitoring_logs LEFT JOIN monitored_services ON monitored_services.id = monitoring_logs.service_id "
        conditions = []
        params = []

        if filter.id is not None:
            conditions.append("monitoring_logs.service_id = %s")
            params.append(filter.id)

        if filter.start_time and filter.end_time:
            conditions.append("monitoring_logs.checked_at BETWEEN %s AND %s")
            params.extend([filter.start_time, filter.end_time])
        elif filter.start_time:
            conditions.append("monitoring_logs.checked_at >= %s")
            params.append(filter.start_time)
        elif filter.end_time:
            conditions.append("monitoring_logs.checked_at <= %s")
            params.append(filter.end_time)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY monitoring_logs.checked_at DESC"

        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query, tuple(params))
                logs = cur.fetchall()
                return logs
    except Exception as e:
        print(f"Database error in get_monitoring_logs: {e}")
        raise HTTPException(status_code=500, detail="Database error")

# Cronjob Management Endpoints
@router.get("/cronjobs", response_model=List[CronJobOut], dependencies=[Depends(verify_api_key)])
def list_cronjobs():
    """List all cron jobs"""
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM cron_jobs ORDER BY id")
                return cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching cron jobs: {str(e)}")

@router.get("/cronjobs/status", response_model=CronStatusOut, dependencies=[Depends(verify_api_key)])
def get_cron_status():
    """Get cron service status"""
    status = cron_manager.get_cron_status()
    return status

@router.post("/cronjobs/reload", dependencies=[Depends(verify_api_key)])
def reload_cronjobs():
    """Reload all cron jobs from database"""
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM monitored_services WHERE is_active = true")
                services = cur.fetchall()
                
                # Clear existing cron jobs
                cron_manager.clear_all_cronjobs()
                
                # Recreate cron jobs for all active services (skip external services)
                for service in services:
                    if service['protocol'] != 'external':
                        cron_manager.add_service_cronjob(
                            service['id'], service['name'],
                            service['interval_type'] or 'seconds',
                            service['interval_value'] or 60,
                            service['interval_unit'] or 'seconds'
                        )
                
                return {"message": "Cron jobs reloaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reloading cron jobs: {str(e)}")


CLOUD_BASE_URL = "https://cloud-monitoring.corp.spc.int"
CLOUD_CONFIG_NAME = "cloud-monitoring.corp.spc.int"

def get_stored_token():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT configuration FROM dashboard_configs WHERE name = %s", (CLOUD_CONFIG_NAME,))
                result = cur.fetchone()
                if result:
                    return result[0]
    except Exception as e:
        print(f"Error getting stored token: {e}")
    return None

def authenticate_and_store_token():
    auth_url = f"{CLOUD_BASE_URL}/api/collections/users/auth-with-password"
    auth_payload = {
        "identity": "divesha@spc.int",
        "password": "Un2345678"
    }
    headers = {'Content-Type': 'application/json'}
    
    print(f"Authenticating to {auth_url}...")
    try:
        response = requests.post(auth_url, headers=headers, json=auth_payload, verify=False)
        response.raise_for_status()
        
        auth_data = response.json()
        token = auth_data.get("token")
        
        if not token:
            raise Exception("Failed to retrieve token from authentication response")
            
        # Store in DB
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Check if exists
                cur.execute("SELECT id FROM dashboard_configs WHERE name = %s", (CLOUD_CONFIG_NAME,))
                if cur.fetchone():
                    cur.execute("UPDATE dashboard_configs SET configuration = %s WHERE name = %s", (token, CLOUD_CONFIG_NAME))
                else:
                    cur.execute("INSERT INTO dashboard_configs (name, configuration) VALUES (%s, %s)", (CLOUD_CONFIG_NAME, token))
                conn.commit()
        
        return token
        
    except Exception as e:
        print(f"Authentication failed: {e}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@router.post("/cloud/sync", dependencies=[Depends(verify_api_key)])
def sync_cloud():
    token = get_stored_token()
    
    if not token:
        print("No token found in DB, authenticating...")
        token = authenticate_and_store_token()
    
    systems_url = f"{CLOUD_BASE_URL}/api/collections/systems/records"
    
    def fetch_systems(auth_token):
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }
        print(f"Fetching systems from {systems_url}...")
        return requests.get(systems_url, headers=headers, verify=False)

    try:
        response = fetch_systems(token)
        
        # Check if request failed or returned empty items as per user requirement
        should_refresh = False
        if response.status_code != 200:
            should_refresh = True
            print(f"Request failed with status {response.status_code}")
        else:
            try:
                data = response.json()
                if "items" in data and len(data["items"]) == 0:
                    should_refresh = True
                    print("Response contained 0 items, assuming token issue...")
            except ValueError:
                should_refresh = True
                print("Invalid JSON response")
        
        if should_refresh:
            print("Refreshing token and retrying...")
            token = authenticate_and_store_token()
            response = fetch_systems(token)
            response.raise_for_status()
            data = response.json()

        # Sync items to database
        if "items" in data:
            try:
                print(f"Syncing {len(data['items'])} items to database...")
                with get_connection() as conn:
                    with conn.cursor() as cur:
                        for item in data["items"]:
                            name = item.get('name')
                            if not name:
                                continue

                            ip_address = item.get('host', '')
                            try:
                                port = int(item.get('port')) if item.get('port') else None
                            except (ValueError, TypeError):
                                port = None

                            status_val = item.get('status', 'unknown')
                            updated_str = item.get('updated')
                            created_str = item.get('created')

                            # Check if service exists
                            cur.execute("SELECT id FROM monitored_services WHERE name = %s", (name,))
                            existing = cur.fetchone()

                            if existing:
                                # Update existing service
                                cur.execute("""
                                    UPDATE monitored_services 
                                    SET ip_address = %s,
                                        port = %s,
                                        last_status = %s,
                                        updated_at = %s,
                                        type = 'Server Cloud'
                                    WHERE id = %s
                                """, (ip_address, port, status_val, updated_str, existing[0]))
                            else:
                                # Insert new service
                                cur.execute("""
                                    INSERT INTO monitored_services (
                                        name, ip_address, port, protocol, 
                                        check_interval_sec, interval_type, interval_value, interval_unit,
                                        last_status, created_at, updated_at, is_active, type
                                    ) VALUES (
                                        %s, %s, %s, 'api',
                                        300, 'minutes', 5, 'minutes',
                                        %s, %s, %s, true, 'Server Cloud'
                                    )
                                """, (name, ip_address, port, status_val, created_str, updated_str))
                        
                        conn.commit()
                        print("Database sync complete.")
            except Exception as e:
                print(f"Error syncing to database: {e}")
                # Continue to return data even if DB sync fails
            
        return data
        
    except Exception as e:
        print(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")