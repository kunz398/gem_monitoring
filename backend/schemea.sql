-- public.monitored_services definition

-- Drop table

-- DROP TABLE public.monitored_services;

CREATE TABLE public.monitored_services (
	id serial4 NOT NULL,
	name text NOT NULL,
	ip_address text NOT NULL,
	port int4 NOT NULL,
	protocol text NOT NULL,
	check_interval_sec int4 DEFAULT 60 NULL,
	last_status text DEFAULT 'unknown'::text NULL,
	success_count int4 DEFAULT 0 NULL,
	failure_count int4 DEFAULT 0 NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	"comment" text NULL,
	CONSTRAINT monitored_services_pkey PRIMARY KEY (id)
);

-- Table Triggers

create trigger trg_monitored_services_updated_at before
update
    on
    public.monitored_services for each row execute function update_updated_at_column();



    -- public.monitoring_logs definition

-- Drop table

-- DROP TABLE public.monitoring_logs;

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

-- Table Triggers

create trigger trg_monitoring_logs_updated_at before
update
    on
    public.monitoring_logs for each row execute function update_updated_at_column();


    -- public.test_table definition

-- Drop table

-- DROP TABLE public.test_table;

CREATE TABLE public.test_table (
	id serial4 NOT NULL,
	"comment" text NULL,
	CONSTRAINT test_table_pkey PRIMARY KEY (id)
);




INSERT INTO public.monitored_services ("name",ip_address,port,protocol,check_interval_sec,last_status,success_count,failure_count,created_at,updated_at,"comment") VALUES
	 ('Web Serveaaaar Ping','192.168.1.10',0,'ping',60,'down',0,3,'2025-06-20 16:19:38.264169','2025-06-23 08:46:29.942432','1 test from postman'),
	 ('google','8.8.8.8',80,'ping',60,'up',1,3,'2025-06-20 16:34:55.682309','2025-06-23 09:09:22.037011','1 test from 8');
