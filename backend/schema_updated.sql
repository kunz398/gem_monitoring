-- Updated schema with flexible interval support

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.monitoring_logs CASCADE;
DROP TABLE IF EXISTS public.monitored_services CASCADE;

-- Create monitored_services table with enhanced interval support
CREATE TABLE public.monitored_services (
    id serial4 NOT NULL,
    name text NOT NULL,
    ip_address text NOT NULL,
    port int4 NOT NULL,
    protocol text NOT NULL,
    check_interval_sec int4 DEFAULT 60 NULL,  -- Keep for backward compatibility
    interval_type text DEFAULT 'seconds' CHECK (interval_type IN ('seconds', 'minutes', 'hours', 'daily', 'weekly', 'monthly', 'specific_day')),
    interval_value int4 DEFAULT 60 NULL,  -- Value for the interval (e.g., 30 for 30 minutes, 15 for 15th day of month)
    interval_unit text DEFAULT 'seconds' CHECK (interval_unit IN ('seconds', 'minutes', 'hours', 'days', 'weeks', 'months')),
    cron_expression text NULL,  -- Generated cron expression
    cron_job_name text NULL,    -- Name of the cron job
    last_status text DEFAULT 'unknown'::text NULL,
    success_count int4 DEFAULT 0 NULL,
    failure_count int4 DEFAULT 0 NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    "comment" text NULL,
    is_active bool DEFAULT true NULL,
    CONSTRAINT monitored_services_pkey PRIMARY KEY (id)
);

-- Create monitoring_logs table
CREATE TABLE public.monitoring_logs (
    id serial4 NOT NULL,
    service_id int4 NULL,
    checked_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    status text NOT NULL,
    message text NULL,
    notification_sent bool DEFAULT false NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    "comment" text NULL,
    CONSTRAINT monitoring_logs_pkey PRIMARY KEY (id),
    CONSTRAINT monitoring_logs_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.monitored_services(id) ON DELETE CASCADE
);

-- Create cron_jobs table to track managed cron jobs
CREATE TABLE public.cron_jobs (
    id serial4 NOT NULL,
    service_id int4 NOT NULL,
    job_name text NOT NULL UNIQUE,
    cron_expression text NOT NULL,
    command text NOT NULL,
    is_active bool DEFAULT true NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    CONSTRAINT cron_jobs_pkey PRIMARY KEY (id),
    CONSTRAINT cron_jobs_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.monitored_services(id) ON DELETE CASCADE
);

-- Table Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_monitored_services_updated_at 
    BEFORE UPDATE ON public.monitored_services 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_monitoring_logs_updated_at 
    BEFORE UPDATE ON public.monitoring_logs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_cron_jobs_updated_at 
    BEFORE UPDATE ON public.cron_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO public.monitored_services (
    "name", ip_address, port, protocol, 
    check_interval_sec, interval_type, interval_value, interval_unit,
    last_status, success_count, failure_count, "comment"
) VALUES
    ('Web Server Ping', '192.168.1.10', 0, 'ping', 60, 'seconds', 60, 'seconds', 'down', 0, 3, 'Test server'),
    ('Google DNS', '8.8.8.8', 80, 'ping', 60, 'minutes', 5, 'minutes', 'up', 1, 3, 'Google DNS server'),
    ('Monthly Backup Check', '192.168.1.100', 22, 'ssh', 86400, 'monthly', 1, 'months', 'unknown', 0, 0, 'Monthly backup server check'),
    ('Weekly Report Server', '192.168.1.200', 80, 'http', 604800, 'weekly', 1, 'weeks', 'unknown', 0, 0, 'Weekly report generation server'),
    ('Daily Database', '192.168.1.50', 5432, 'postgres', 86400, 'daily', 1, 'days', 'unknown', 0, 0, 'Daily database health check'),
    ('15th Day Check', '192.168.1.75', 443, 'https', 86400, 'specific_day', 15, 'days', 'unknown', 0, 0, 'Check on 15th of every month'); 