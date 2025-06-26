#!/usr/bin/env python3
"""
Script to populate ocean tasks in the monitored_services table
"""
import sys
import os

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.monitor import populate_ocean_tasks_in_monitoring_table

def main():
    print("Populating ocean tasks in monitored_services table...")
    populate_ocean_tasks_in_monitoring_table()
    print("Done!")

if __name__ == "__main__":
    main() 