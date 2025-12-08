--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: gem_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO gem_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: monitored_services; Type: TABLE; Schema: public; Owner: gem_user
--

CREATE TABLE public.monitored_services (
    id integer NOT NULL,
    name text NOT NULL,
    ip_address text NOT NULL,
    port integer,
    protocol text NOT NULL,
    check_interval_sec integer DEFAULT 60,
    type text DEFAULT 'servers',
    interval_type text DEFAULT 'seconds'::text,
    interval_value integer DEFAULT 60,
    interval_unit text DEFAULT 'seconds'::text,
    cron_expression text,
    cron_job_name text,
    last_status text DEFAULT 'unknown'::text,
    success_count integer DEFAULT 0,
    failure_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    comment text,
    display_order integer,
    is_active boolean DEFAULT true,
    CONSTRAINT monitored_services_interval_type_check CHECK ((interval_type = ANY (ARRAY['seconds'::text, 'minutes'::text, 'hours'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'specific_day'::text]))),
    CONSTRAINT monitored_services_interval_unit_check CHECK ((interval_unit = ANY (ARRAY['seconds'::text, 'minutes'::text, 'hours'::text, 'days'::text, 'weeks'::text, 'months'::text])))
);


ALTER TABLE public.monitored_services OWNER TO gem_user;

--
-- Name: monitored_services_id_seq; Type: SEQUENCE; Schema: public; Owner: gem_user
--

CREATE SEQUENCE public.monitored_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.monitored_services_id_seq OWNER TO gem_user;

--
-- Name: monitored_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gem_user
--

ALTER SEQUENCE public.monitored_services_id_seq OWNED BY public.monitored_services.id;


--
-- Name: monitoring_logs; Type: TABLE; Schema: public; Owner: gem_user
--

CREATE TABLE public.monitoring_logs (
    id integer NOT NULL,
    service_id integer,
    checked_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status text NOT NULL,
    message text,
    notification_sent boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    comment text
);


ALTER TABLE public.monitoring_logs OWNER TO gem_user;

--
-- Name: monitoring_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: gem_user
--

CREATE SEQUENCE public.monitoring_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.monitoring_logs_id_seq OWNER TO gem_user;

--
-- Name: monitoring_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gem_user
--

ALTER SEQUENCE public.monitoring_logs_id_seq OWNED BY public.monitoring_logs.id;


--
-- Name: test_table; Type: TABLE; Schema: public; Owner: gem_user
--

CREATE TABLE public.test_table (
    id integer NOT NULL,
    comment text
);


ALTER TABLE public.test_table OWNER TO gem_user;

--
-- Name: test_table_id_seq; Type: SEQUENCE; Schema: public; Owner: gem_user
--

CREATE SEQUENCE public.test_table_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.test_table_id_seq OWNER TO gem_user;

--
-- Name: test_table_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gem_user
--

ALTER SEQUENCE public.test_table_id_seq OWNED BY public.test_table.id;


--
-- Name: monitored_services id; Type: DEFAULT; Schema: public; Owner: gem_user
--

ALTER TABLE ONLY public.monitored_services ALTER COLUMN id SET DEFAULT nextval('public.monitored_services_id_seq'::regclass);


--
-- Name: monitoring_logs id; Type: DEFAULT; Schema: public; Owner: gem_user
--

ALTER TABLE ONLY public.monitoring_logs ALTER COLUMN id SET DEFAULT nextval('public.monitoring_logs_id_seq'::regclass);


--
-- Name: test_table id; Type: DEFAULT; Schema: public; Owner: gem_user
--

ALTER TABLE ONLY public.test_table ALTER COLUMN id SET DEFAULT nextval('public.test_table_id_seq'::regclass);


--
-- Data for Name: monitored_services; Type: TABLE DATA; Schema: public; Owner: gem_user
--

COPY public.monitored_services (id, name, ip_address, port, protocol, check_interval_sec, interval_type, interval_value, interval_unit, cron_expression, cron_job_name, last_status, success_count, failure_count, created_at, updated_at, comment, display_order, is_active) FROM stdin;
\.


--
-- Data for Name: monitoring_logs; Type: TABLE DATA; Schema: public; Owner: gem_user
--

COPY public.monitoring_logs (id, service_id, checked_at, status, message, notification_sent, updated_at, comment) FROM stdin;
\.


--
-- Data for Name: test_table; Type: TABLE DATA; Schema: public; Owner: gem_user
--

COPY public.test_table (id, comment) FROM stdin;
1	This is the first comment
2	Another comment goes here
3	Testing auto-increment ID
4	Sample comment with special characters !@#$%^&*()
5	Last comment in the test data
\.


--
-- Name: monitored_services_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gem_user
--

SELECT pg_catalog.setval('public.monitored_services_id_seq', 45, true);


--
-- Name: monitoring_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gem_user
--

SELECT pg_catalog.setval('public.monitoring_logs_id_seq', 961, true);


--
-- Name: test_table_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gem_user
--

SELECT pg_catalog.setval('public.test_table_id_seq', 5, true);


--
-- Name: monitored_services monitored_services_pkey; Type: CONSTRAINT; Schema: public; Owner: gem_user
--

ALTER TABLE ONLY public.monitored_services
    ADD CONSTRAINT monitored_services_pkey PRIMARY KEY (id);


--
-- Name: monitoring_logs monitoring_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: gem_user
--

ALTER TABLE ONLY public.monitoring_logs
    ADD CONSTRAINT monitoring_logs_pkey PRIMARY KEY (id);


--
-- Name: test_table test_table_pkey; Type: CONSTRAINT; Schema: public; Owner: gem_user
--

ALTER TABLE ONLY public.test_table
    ADD CONSTRAINT test_table_pkey PRIMARY KEY (id);


--
-- Name: monitored_services trg_monitored_services_updated_at; Type: TRIGGER; Schema: public; Owner: gem_user
--

CREATE TRIGGER trg_monitored_services_updated_at BEFORE UPDATE ON public.monitored_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: monitoring_logs trg_monitoring_logs_updated_at; Type: TRIGGER; Schema: public; Owner: gem_user
--

CREATE TRIGGER trg_monitoring_logs_updated_at BEFORE UPDATE ON public.monitoring_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: monitoring_logs monitoring_logs_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gem_user
--

ALTER TABLE ONLY public.monitoring_logs
    ADD CONSTRAINT monitoring_logs_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.monitored_services(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

INSERT INTO public.monitored_services ("name",ip_address,port,protocol,check_interval_sec,interval_type,interval_value,interval_unit,cron_expression,cron_job_name,last_status,success_count,failure_count,created_at,updated_at,"comment",is_active) VALUES
	 ('google dns','8.8.8.8',80,'ping',60,'hours',2,'hours',NULL,NULL,'up',2,0,'2025-06-23 21:30:05.021581','2025-06-23 21:31:13.542439','this is just a test',true);
