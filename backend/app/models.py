"""
Database models and schema management
Automatically creates tables and tracks schema changes on app startup
"""
from app.db import get_connection
import psycopg2.extras


class DatabaseSchema:
    """Manages database schema creation and migrations"""
    
    @staticmethod
    def get_table_columns(cur, table_name):
        """Get existing columns for a table"""
        cur.execute("""
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
        """, (table_name,))
        return {row['column_name']: row for row in cur.fetchall()}
    
    @staticmethod
    def table_exists(cur, table_name):
        """Check if a table exists"""
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = %s
            )
        """, (table_name,))
        result = cur.fetchone()
        return result['exists'] if isinstance(result, dict) else result[0]
    
    @staticmethod
    def column_exists(cur, table_name, column_name):
        """Check if a column exists in a table"""
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = %s 
                AND column_name = %s
            )
        """, (table_name, column_name))
        result = cur.fetchone()
        return result['exists'] if isinstance(result, dict) else result[0]
    
    @staticmethod
    def create_update_trigger_function(cur):
        """Create the update_updated_at_column function if it doesn't exist"""
        cur.execute("""
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)
    
    @staticmethod
    def create_monitored_services_table(cur):
        """Create monitored_services table if it doesn't exist"""
        table_name = 'monitored_services'
        
        if not DatabaseSchema.table_exists(cur, table_name):
            print(f"Creating table: {table_name}")
            cur.execute("""
                CREATE TABLE monitored_services (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    ip_address TEXT NOT NULL,
                    port INTEGER,
                    protocol TEXT NOT NULL,
                    check_interval_sec INTEGER DEFAULT 60,
                    interval_type TEXT DEFAULT 'seconds',
                    interval_value INTEGER DEFAULT 60,
                    interval_unit TEXT DEFAULT 'seconds',
                    cron_expression TEXT,
                    cron_job_name TEXT,
                    last_status TEXT DEFAULT 'unknown',
                    success_count INTEGER DEFAULT 0,
                    failure_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    comment TEXT,
                    is_active BOOLEAN DEFAULT true,
                    display_order INTEGER,
                    type TEXT DEFAULT 'servers',
                    collection TEXT DEFAULT 'uncategorized',
                    CONSTRAINT monitored_services_interval_type_check 
                        CHECK (interval_type = ANY (ARRAY['seconds', 'minutes', 'hours', 'daily', 'weekly', 'monthly', 'specific_day'])),
                    CONSTRAINT monitored_services_interval_unit_check 
                        CHECK (interval_unit = ANY (ARRAY['seconds', 'minutes', 'hours', 'days', 'weeks', 'months']))
                )
            """)
            
            # Create trigger
            cur.execute("""
                DROP TRIGGER IF EXISTS trg_monitored_services_updated_at ON monitored_services;
                CREATE TRIGGER trg_monitored_services_updated_at 
                BEFORE UPDATE ON monitored_services 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            """)
            print(f"✓ Table {table_name} created successfully")
        else:
            print(f"Table {table_name} already exists, checking for new columns...")
            # Check and add new columns if needed
            existing_cols = DatabaseSchema.get_table_columns(cur, table_name)
            
            # Define expected columns
            new_columns = []
            
            if 'type' not in existing_cols:
                new_columns.append(("type", "TEXT DEFAULT 'servers'"))
            if 'display_order' not in existing_cols:
                new_columns.append(("display_order", "INTEGER"))
            if 'is_active' not in existing_cols:
                new_columns.append(("is_active", "BOOLEAN DEFAULT true"))
            if 'collection' not in existing_cols:
                new_columns.append(("collection", "TEXT DEFAULT 'uncategorized'"))
            
            # Add new columns
            for col_name, col_def in new_columns:
                print(f"  Adding column: {col_name}")
                cur.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_def}")
            
            if new_columns:
                print(f"✓ Added {len(new_columns)} new column(s) to {table_name}")
    
    @staticmethod
    def create_monitoring_logs_table(cur):
        """Create monitoring_logs table if it doesn't exist"""
        table_name = 'monitoring_logs'
        
        if not DatabaseSchema.table_exists(cur, table_name):
            print(f"Creating table: {table_name}")
            cur.execute("""
                CREATE TABLE monitoring_logs (
                    id SERIAL PRIMARY KEY,
                    service_id INTEGER,
                    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status TEXT NOT NULL,
                    message TEXT,
                    notification_sent BOOLEAN DEFAULT false,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    comment TEXT,
                    CONSTRAINT monitoring_logs_service_id_fkey 
                        FOREIGN KEY (service_id) 
                        REFERENCES monitored_services(id) 
                        ON DELETE CASCADE
                )
            """)
            
            # Create trigger
            cur.execute("""
                DROP TRIGGER IF EXISTS trg_monitoring_logs_updated_at ON monitoring_logs;
                CREATE TRIGGER trg_monitoring_logs_updated_at 
                BEFORE UPDATE ON monitoring_logs 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
            """)
            print(f"✓ Table {table_name} created successfully")
        else:
            print(f"Table {table_name} already exists, checking for new columns...")
            existing_cols = DatabaseSchema.get_table_columns(cur, table_name)
            
            # Define expected columns and add if missing
            new_columns = []
            
            if 'comment' not in existing_cols:
                new_columns.append(("comment", "TEXT"))
            if 'notification_sent' not in existing_cols:
                new_columns.append(("notification_sent", "BOOLEAN DEFAULT false"))
            
            # Add new columns
            for col_name, col_def in new_columns:
                print(f"  Adding column: {col_name}")
                cur.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_def}")
            
            if new_columns:
                print(f"✓ Added {len(new_columns)} new column(s) to {table_name}")
    
    @staticmethod
    def create_dashboard_configs_table(cur):
        """Create dashboard_configs table if it doesn't exist"""
        table_name = 'dashboard_configs'
        
        if not DatabaseSchema.table_exists(cur, table_name):
            print(f"Creating table: {table_name}")
            cur.execute("""
                CREATE TABLE dashboard_configs (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    configuration TEXT
                )
            """)
            print(f"✓ Table {table_name} created successfully")
        else:
            print(f"Table {table_name} already exists, checking for new columns...")
            existing_cols = DatabaseSchema.get_table_columns(cur, table_name)
            
            # Check if we need to rename 'config' to 'configuration'
            if 'config' in existing_cols and 'configuration' not in existing_cols:
                print(f"  Renaming column: config -> configuration")
                cur.execute(f"ALTER TABLE {table_name} RENAME COLUMN config TO configuration")
                print(f"✓ Renamed column in {table_name}")

        # Insert default grouping preferences if not exists
        default_grouping_prefs = '{"grouping_mode": "type", "group_by_servers": false, "group_by_datasets": false, "group_by_ocean_plotters": false, "group_by_models": false, "group_by_server_cloud": false}'
        cur.execute("""
            INSERT INTO dashboard_configs (name, configuration)
            VALUES ('grouping_preferences', %s)
            ON CONFLICT (name) DO NOTHING
        """, (default_grouping_prefs,))
        print(f"✓ Verified default grouping preferences in {table_name}")

        # Insert default refresh interval if not exists
        default_refresh_interval = '{"interval": 30}'
        cur.execute("""
            INSERT INTO dashboard_configs (name, configuration)
            VALUES ('refresh_interval', %s)
            ON CONFLICT (name) DO NOTHING
        """, (default_refresh_interval,))
        print(f"✓ Verified default refresh interval in {table_name}")
    
    @staticmethod
    def initialize_database():
        """Initialize all database tables and schemas"""
        print("\n" + "="*60)
        print("Initializing Database Schema")
        print("="*60)
        
        try:
            with get_connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Create trigger function first
                    DatabaseSchema.create_update_trigger_function(cur)
                    
                    # Create/update tables in order (respecting foreign keys)
                    DatabaseSchema.create_monitored_services_table(cur)
                    DatabaseSchema.create_monitoring_logs_table(cur)
                    DatabaseSchema.create_dashboard_configs_table(cur)
                    
                    conn.commit()
                    print("="*60)
                    print("✓ Database schema initialization complete")
                    print("="*60 + "\n")
        except Exception as e:
            print(f"✗ Error initializing database: {e}")
            raise


# Model classes for type hinting and validation
class MonitoredService:
    """Model for monitored_services table"""
    pass


class MonitoringLog:
    """Model for monitoring_logs table"""
    pass


class DashboardConfig:
    """Model for dashboard_configs table"""
    pass
