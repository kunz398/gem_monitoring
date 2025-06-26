#!/usr/bin/env python3
"""
Script to populate ocean tasks in the monitored_services table
"""
from app.monitor import populate_ocean_tasks_in_monitoring_table

def main():
    print("Populating ocean tasks in monitored_services table...")
    populate_ocean_tasks_in_monitoring_table()
    print("Done!")

if __name__ == "__main__":
    main() 