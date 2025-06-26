#!/usr/bin/env python3
"""
Test script to verify ocean integration
"""
from app.monitor import populate_ocean_tasks_in_monitoring_table, ocean_service_check
from app.db import get_connection
import psycopg2.extras

def test_populate_ocean_tasks():
    """Test populating ocean tasks"""
    print("Testing populate_ocean_tasks_in_monitoring_table...")
    populate_ocean_tasks_in_monitoring_table()
    print("✓ Ocean tasks populated successfully")

def test_ocean_service_check():
    """Test ocean service check"""
    print("Testing ocean_service_check...")
    
    # Get a sample ocean service from the database
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM monitored_services 
                WHERE ip_address LIKE '%ocean-middleware.spc.int/middleware/api/%' 
                LIMIT 1
            """)
            service = cur.fetchone()
    
    if service:
        print(f"Testing with service: {service['name']}")
        result = ocean_service_check(service)
        print(f"✓ Ocean service check result: {result['status']} - {result['output']}")
    else:
        print("No ocean services found in database")

def main():
    print("Testing Ocean Integration...")
    print("=" * 50)
    
    try:
        test_populate_ocean_tasks()
        print()
        test_ocean_service_check()
        print()
        print("✓ All tests completed successfully!")
    except Exception as e:
        print(f"✗ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 