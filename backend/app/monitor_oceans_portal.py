import re
import logging
import psycopg2
import psycopg2.extras
import psycopg2.pool
import os
import requests
import json
from datetime import datetime, timedelta

# Configure logging
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(levelname)s - %(message)s',
#     handlers=[
#         logging.FileHandler('ocean_portal_monitor.log'),
#         logging.StreamHandler()
#     ]
# )
# logger = logging.getLogger(__name__)

api_dataset = 'https://ocean-middleware.spc.int/middleware/api/dataset/'
api_task_download = 'https://ocean-middleware.spc.int/middleware/api/task_download/'

# # Database configuration
DB_CONFIG = {
    'dbname': os.getenv('DB_NAME', 'monitoring_db'),
    'user': os.getenv('DB_USER', 'gem_user'),
    'password': os.getenv('DB_PASSWORD', 'P@ssword123'),
    'host': os.getenv('DB_HOST', 'db'),
    'port': os.getenv('DB_PORT', '5432')
}
# DB_CONFIG = {
#     'dbname': os.getenv('DB_NAME', 'monitoring_db'),
#     'user': os.getenv('DB_USER', 'postgres'),
#     'password': os.getenv('DB_PASSWORD', 'postgres'),
#     'host': os.getenv('DB_HOST', 'localhost'),
#     'port': int(os.getenv('DB_PORT', '5432'))
# }


def sort_json_by_id(data):
    """
    Sort JSON data by ID field
    """
    if isinstance(data, list):
       # if object
        return sorted(data, key=lambda x: x.get('id', 0))
    elif isinstance(data, dict):
        # If dictionary
        if 'results' in data and isinstance(data['results'], list):
            data['results'] = sorted(data['results'], key=lambda x: x.get('id', 0))
        elif 'data' in data and isinstance(data['data'], list):
            data['data'] = sorted(data['data'], key=lambda x: x.get('id', 0))
        return data
    return data

def get_dataset_json():
    try:
        response = requests.get(api_dataset, timeout=60)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        # logger.error(f"Error fetching data from {api_dataset}: {e}")
        return None
    except json.JSONDecodeError as e:
        # logger.error(f"Error parsing JSON response: {e}")
        return None

def get_task_json():
    try:
        # print(api_task_download + str(task_id))
        response = requests.get( api_task_download, timeout=60)

        response.raise_for_status()

        return response.json()

    except requests.exceptions.RequestException as e:
        # logger.error(f"Error fetching data from {api_task_download}: {e}")
        return None

    except json.JSONDecodeError as e:
        # logger.error(f"Error parsing JSON response: {e}")
        return None

def check_tasks_in_monitoring_table(tasks_json):
    """
    Check which tasks are already in monitored_services.

    """
    if not tasks_json:
        return []
        
    task_names = [f"{task['id']}: {task['short_name']}" for task in tasks_json]

    try:
        connection = psycopg2.connect(**DB_CONFIG)
        cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)

        # Fetch existing task names
        cursor.execute("SELECT name FROM monitored_services WHERE name IN %s", (tuple(task_names),))
        existing_tasks = [row["name"] for row in cursor.fetchall()]

        # Insert missing tasks
        for task in tasks_json:
            name = f"{task['id']}: {task['short_name']}"
            if name not in existing_tasks:
                when = task.get('when', '').lower()
                final_status = task.get('final_status', 'unknown')
                final_comments = task.get('final_comments', '')

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
                    name,
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

                cursor.execute(insert_query, values)
                print(f"Inserted: {name}")

        connection.commit()
        return existing_tasks

    except Exception as e:
        print(f"Error checking or inserting tasks: {e}")
        return []

    finally:
        if 'cursor' in locals(): cursor.close()
        if 'connection' in locals(): connection.close()



def get_item_by_id(data, target_id):
    """
    Get a specific item by ID from the dataset list
    """
    if isinstance(data, list):
        for item in data:
            if item.get('id') == target_id:
                return item
    return None

def get_items_by_field_value(data, field, value):
    """
    Get items that have a specific field value
    """
    results = []
    if isinstance(data, list):
        for item in data:
            if item.get(field) == value:
                results.append(item)
    return results


def safe_get(dataset, key, default="Not specified"):
    """
    Safely get a value from dataset dictionary
    """
    return dataset.get(key, default)

def main():
    # logger.info("Fetching dataset from Ocean Portal API")
    dataset_data = get_dataset_json()
    task_data = get_task_json()

    if dataset_data:
        dataset_data = sort_json_by_id(dataset_data)  # sorting the dataset by ID
        for dataset in dataset_data:
            # if dataset['frequency_minutes'] != 0:
            #     print(f"Frequency (Minutes): {dataset['frequency_minutes']}")
            if dataset['frequency_hours'] != 0:  # 1,
                dataset['when'] = "daily"  # print(f"Frequency (Hours): {dataset['frequency_hours']}")
            if dataset['frequency_days'] != 0:  # 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 18, 19, 20, 21, 22
                dataset['when'] = "daily"  # print(f"Frequency (Days): {dataset['frequency_days']}")
            if dataset['frequency_months'] != 0:  # 2, 4, 9, 15, 17
                dataset['when'] = "monthly"  # print(f"Frequency (Months): {dataset['frequency_months']}")

            # if dataset['frequency_years'] != 0:
            #     print(f"Frequency (Years): {dataset['frequency_years']}")
            # if dataset['check_minutes'] != 0:
            #     print(f"Check (Minutes): {dataset['check_minutes']}")
            # if dataset['check_hours'] != 0:
            #     print(f"Check (Hours): {dataset['check_hours']}")
            # if dataset['check_days'] != 0:
            #     print(f"Check (Days): {dataset['check_days']}")
            # if dataset['check_months'] != 0:
            #     print(f"Check (Months): {dataset['check_months']}")
            # if dataset['check_years'] != 0:
            #     print(f"Check (Years): {dataset['check_years']}")

            # task = get_task_json(dataset.get('id'))
            # if task:
            #     print(f"task {task['id']} : {task['task_name']}  should run every ")
            #     print(f"\nDataset ID: {dataset['id']}")
            # #     print(f"Task ID: {task['task_name']}")
            # else:
            #     print("Failed to retrieve dataset data")

    # print(json.dumps(dataset_data, indent=4))
    if task_data:
        task_data = sort_json_by_id(task_data)

    if dataset_data:
        for dd_dataset_id in dataset_data:
            if task_data:
                for task in task_data:
                    if task['id'] == dd_dataset_id['id']:
                        id = task['id']
                        task_name = task['task_name']
                        when = dd_dataset_id['when']
                        last_download_file = task['last_download_file']
                        next_download_file = task['next_download_file']
                        download_file_prefix = dd_dataset_id['download_file_prefix']
                        download_file_infix = dd_dataset_id['download_file_infix']
                        download_file_suffix = dd_dataset_id['download_file_suffix']
                        # print(f"task {id} : {task_name}  should run {when}")
                        # print(f"last downloaded file: {last_download_file}")
                        # print(f"next download date: {next_download_file}")
                        # print(f"file prefix: {download_file_prefix}")
                        # print(f"date format: {download_file_infix}")
                        # print(f"file suffix: {download_file_suffix}")

                        if task_name == 'download_coral_bleaching_monthly_outlook':
                            # logger.info(f"task_name == 'download_coral_bleaching_monthly_outlook':{id}")
                            download_file_prefix = 'cfsv2_outlook-060perc_4mon-and-wkly_v5_icwk'
                            download_file_suffix = '_for_20250706to20251026.nc'
                        # Extract date string from filename
                        next_date_str = next_download_file[len(download_file_prefix):-len(download_file_suffix)]
                        last_date_str = last_download_file[len(download_file_prefix):-len(download_file_suffix)]
                        # print(next_date_str)
                        if '_%H' in download_file_infix:
                            # logger.info(f"if '_%H' in download_file_infix: {id}")
                            download_file_infix = "%Y%m%d"
                            next_date_str = next_date_str.split("_")[0]
                            parsed_date = datetime.strptime(next_date_str, download_file_infix)
                            dd_dataset_id['next_start_date'] = parsed_date.isoformat()
                            dd_dataset_id['next_end_date'] = "none"
                            #last
                            last_date_str = last_date_str.split("_")[0]
                            parsed_date = datetime.strptime(last_date_str, download_file_infix)
                            dd_dataset_id['last_start_date'] = parsed_date.isoformat()
                            dd_dataset_id['last_end_date'] = "none"
                        elif '_' in next_date_str:
                            if task_name.strip() == 'calculate_ssh_monthly':
                                next_match = re.search(r'(\d{6}_\d{6})\.nc$', next_download_file)
                                last_match = re.search(r'(\d{6}_\d{6})\.nc$', last_download_file)
                                download_file_infix = '%Y%m_%Y%m'
                                if next_match:
                                    # logger.info(f" if next_match: {id}")
                                    next_date_str = next_match.group(1)
                                    date_format_start, date_format_end = download_file_infix.split("_")

                                    start_str, end_str = next_date_str.split("_")

                                    # Parse the dates
                                    parsed_date_start = datetime.strptime(start_str, date_format_start)
                                    parsed_date_end = datetime.strptime(end_str, date_format_end)
                                    dd_dataset_id['next_start_date'] = parsed_date_start.isoformat()
                                    dd_dataset_id['next_end_date'] = parsed_date_end.isoformat()
                                    # print("Extracted start date:", parsed_date_start)
                                    # print("Extracted end date:", parsed_date_end)
                                    # logger.info(f" if last_match: {id}")
                                    if last_match:
                                        last_date_str = last_match.group(1)
                                        date_format_start, date_format_end = download_file_infix.split("_")

                                        start_str, end_str = last_date_str.split("_")

                                        # Parse the dates
                                        parsed_date_start = datetime.strptime(start_str, date_format_start)
                                        parsed_date_end = datetime.strptime(end_str, date_format_end)
                                        dd_dataset_id['last_start_date'] = parsed_date_start.isoformat()
                                        dd_dataset_id['lastend_date'] = parsed_date_end.isoformat()
                                        # print("Extracted start date:", parsed_date_start)
                                        # print("Extracted end date:", parsed_date_end)
                                    else:
                                        # logger.info("No last_match found")
                                        pass
                                else:
                                    # logger.info("No next_match found")
                                    pass
                            else:
                                # logger.info(f" __  else: {id}")
                                date_format_start, date_format_end = download_file_infix.split("_")
                                start_str, end_str = next_date_str.split("_")
                                # Parse the dates
                                parsed_date_start = datetime.strptime(start_str, date_format_start)
                                parsed_date_end = datetime.strptime(end_str, date_format_end)
                                dd_dataset_id['next_start_date'] = parsed_date_start.isoformat()
                                dd_dataset_id['next_end_date'] = parsed_date_end.isoformat()
                                # print("Extracted start date:", parsed_date_start)
                                # print("Extracted end date:", parsed_date_end)

                                date_format_start, date_format_end = download_file_infix.split("_")
                                start_str, end_str = last_date_str.split("_")
                                # Parse the dates
                                parsed_date_start = datetime.strptime(start_str, date_format_start)
                                parsed_date_end = datetime.strptime(end_str, date_format_end)
                                dd_dataset_id['last_start_date'] = parsed_date_start.isoformat()
                                dd_dataset_id['last_end_date'] = parsed_date_end.isoformat()
                        elif task_name.strip() == 'calculate_sst_anomalies_monthly':
                            # logger.info(f"task_name.strip() == 'calculate_sst_anomalies_monthly': {id}")
                            download_file_prefix = 'oisst-avhrr-v02r01.'
                            download_file_suffix = '.nc'
                            download_file_infix = '%Y%m'
                            next_date_str = next_download_file[len(download_file_prefix):-len(download_file_suffix)]
                            parsed_date = datetime.strptime(next_date_str, download_file_infix)
                            dd_dataset_id['next_start_date'] = parsed_date.isoformat()
                            dd_dataset_id['next_end_date'] = "none"
                            # print("Extracted date:", parsed_date)
                            last_date_str = last_download_file[len(download_file_prefix):-len(download_file_suffix)]
                            parsed_date = datetime.strptime(last_date_str, download_file_infix)
                            dd_dataset_id['last_start_date'] = parsed_date.isoformat()
                            dd_dataset_id['last_end_date'] = "none"
                        elif task_name.strip() == 'download_bluelink_daily_forecast':
                            # logger.info(f"task_name.strip() == 'download_bluelink_daily_forecast': {id}")
                            dd_dataset_id['next_start_date'] = "none"
                            dd_dataset_id['next_end_date'] = "none"
                            # logger.info('Handle this later because no dates')
                            dd_dataset_id['last_start_date'] = "none"
                            dd_dataset_id['last_end_date'] = "none"
                        elif download_file_infix == 'none':
                            # logger.info(f"download_file_infix == 'none' {id}")
                            dd_dataset_id['next_start_date'] = "none"
                            dd_dataset_id['next_end_date'] = "none"
                            # logger.info('Handle this later because the infix is none')
                            dd_dataset_id['last_start_date'] = "none"
                            dd_dataset_id['last_end_date'] = "none"
                        else:
                            # Single date format
                            # logger.info(f"else: {id}")
                            parsed_date = datetime.strptime(next_date_str, download_file_infix)
                            dd_dataset_id['next_start_date'] = parsed_date.isoformat()
                            dd_dataset_id['next_end_date'] = "none"
                            # print("Extracted date:", parsed_date)
                            parsed_date = datetime.strptime(last_date_str, download_file_infix)
                            dd_dataset_id['last_start_date'] = parsed_date.isoformat()
                            dd_dataset_id['last_end_date'] = "none"

                        # print("-" * 50)  # separator
        # logger.info("-" * 50)  # separator
        current_year = datetime.now().year
        current_month = datetime.now().month
        current_day = datetime.now().day
        previous_date = datetime.now() - timedelta(days=1)
        previous_date_2_days = datetime.now() - timedelta(days=2)
        # Calculate last month
        if current_month == 1:
            last_month = 12
            last_month_year = current_year - 1
        else:
            last_month = current_month - 1
            last_month_year = current_year

        for dd_dataset_id in dataset_data:
            # logger.info(f"\nDataset ID: {dd_dataset_id['id']} - {dd_dataset_id['long_name']}")
            # logger.info(f"  Next Start Date : {dd_dataset_id.get('next_start_date', 'N/A')}")
            # logger.info(f"  Next End Date   : {dd_dataset_id.get('next_end_date', 'N/A')}")
            # logger.info(f"  Last Start Date : {dd_dataset_id.get('last_start_date', 'N/A')}")
            # logger.info(f"  Last End Date   : {dd_dataset_id.get('last_end_date', 'N/A')}")
            # logger.info(f"  When   : {dd_dataset_id.get('when', 'N/A')}")
            if dd_dataset_id['when'] == 'monthly':
                # print(f"\nDataset ID: {dd_dataset_id['id']}")
                # print(f"  Next Start Date : {dd_dataset_id.get('next_start_date', 'N/A')}")
                # print(f"  Next End Date   : {dd_dataset_id.get('next_end_date', 'N/A')}")
                # print(f"  Last Start Date : {dd_dataset_id.get('last_start_date', 'N/A')}")
                # print(f"  Last End Date   : {dd_dataset_id.get('last_end_date', 'N/A')}")
                if dd_dataset_id.get('when') == 'monthly':
                    if dd_dataset_id['id'] == 2:
                        # print(f"This dataset would be always 1 month behind, since the data would be avilable at the end of the month")
                        dataset_date = dd_dataset_id.get('next_end_date', 'none')
                        if dataset_date == 'none':
                            dataset_date = dd_dataset_id.get('next_start_date', 'none')
                        if dataset_date == 'none':
                            dd_dataset_id['final_status'] = 'unknown'
                            dd_dataset_id['final_comments'] = (f"Handle this later because the last start date is none")
                            # logger.info(f"Handle this later because the last start date is none")
                            dd_dataset_id['final_status'] = 'none'
                        try:
                            parsed_date = datetime.fromisoformat(dataset_date)
                            if parsed_date.year == last_month_year and parsed_date.month == last_month:
                                dd_dataset_id['final_status'] = 'up'
                                dd_dataset_id['final_comments'] = ''
                                # logger.info(f"Dataset ID {dd_dataset_id['id']} => Valid")
                            else:
                                dd_dataset_id['final_status'] = 'down'
                                dd_dataset_id['final_comments'] = ''
                                # logger.info(f"Dataset ID {dd_dataset_id['id']} => Invalid (expected last month)")
                        except ValueError:
                            dd_dataset_id['final_status'] = 'unknown'
                            dd_dataset_id['final_comments'] = (f"Dataset ID {dd_dataset_id['id']} => Invalid date format: {dataset_date}")
                            # logger.error(f"Dataset ID {dd_dataset_id['id']} => Invalid date format: {dataset_date}")
                    else:
                        if dd_dataset_id.get('next_end_date', 'N/A') == 'none':
                            dataset_date = dd_dataset_id.get('next_start_date', 'N/A')
                        else:
                            dataset_date = dd_dataset_id.get('next_end_date', 'N/A')

                        try:
                            parsed_date = datetime.fromisoformat(dataset_date)
                            if parsed_date.year == current_year and parsed_date.month == current_month:
                                dd_dataset_id['final_status'] = 'up'
                                dd_dataset_id['final_comments'] = ''
                                # logger.info(f"Dataset ID {dd_dataset_id['id']} => Valid")
                            else:
                                dd_dataset_id['final_status'] = 'down'
                                dd_dataset_id['final_comments'] = ''
                                # logger.info(f"Dataset ID {dd_dataset_id['id']} => Invalid)
                        except ValueError:
                            dd_dataset_id['final_status'] = 'unknown'
                            dd_dataset_id['final_comments'] =(f"Dataset ID {dd_dataset_id['id']} => Invalid date format: {dataset_date}")
                            # logger.error(f"Dataset ID {dd_dataset_id['id']} => Invalid date format: {dataset_date}")
            if dd_dataset_id['when'] == 'daily':
                try:
                    dataset_date = dd_dataset_id.get('last_start_date', 'none')
                    if dataset_date == 'none':
                        dd_dataset_id['final_status'] = 'unknown'
                        dd_dataset_id['final_comments'] = (f"Handle this later because the last start date is none")
                        # logger.info(f"Handle this later because the last start date is none")
                    parsed_date = datetime.fromisoformat(dataset_date)
                    # print(f"compare {parsed_date.date()} == {previous_date_2_days.date()} or {parsed_date.date()} == {previous_date.date()}")
                    if parsed_date.date() == previous_date_2_days.date() or parsed_date.date() == previous_date.date():
                        dd_dataset_id['final_status'] = 'up'
                        dd_dataset_id['final_comments'] = ''
                        # logger.info(f"Dataset ID {dd_dataset_id['id']} => Valid")
                    else:
                        dd_dataset_id['final_status'] = 'down'
                        dd_dataset_id['final_comments'] = ''
                        # dd_dataset_id['final_comments'] = (f"Dataset ID {dd_dataset_id['id']} => Invalid expected {previous_date.strftime('%y-%m-%d')}")
                        # logger.info(f"Dataset ID {dd_dataset_id['id']} => Invalid expected {previous_date.strftime('%y-%m-%d')}")
                except ValueError:
                    dd_dataset_id['final_status'] = 'unknown'
                    dd_dataset_id['final_comments'] = (f"Dataset ID {dd_dataset_id['id']} => Invalid date format: {parsed_date}")
                    # logger.error(f"Dataset ID {dd_dataset_id['id']} => Invalid date format: {parsed_date}")
    check_tasks_in_monitoring_table(dataset_data)
    # print(json.dumps(dataset_data, indent=4))

if __name__ == "__main__":
    main() 