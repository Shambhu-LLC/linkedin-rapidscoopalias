-- Fix the schedule_post_job function to handle non-existent jobs gracefully
CREATE OR REPLACE FUNCTION public.schedule_post_job()
RETURNS TRIGGER AS $$
DECLARE
  cron_expression TEXT;
  job_name TEXT;
  scheduled_minute INT;
  scheduled_hour INT;
  scheduled_day INT;
  scheduled_month INT;
  http_command TEXT;
  job_exists BOOLEAN;
BEGIN
  -- Only schedule if status is pending and scheduled_at is in the future
  IF NEW.status = 'pending' AND NEW.scheduled_at > NOW() THEN
    -- Extract time components from scheduled_at (in UTC)
    scheduled_minute := EXTRACT(MINUTE FROM NEW.scheduled_at AT TIME ZONE 'UTC');
    scheduled_hour := EXTRACT(HOUR FROM NEW.scheduled_at AT TIME ZONE 'UTC');
    scheduled_day := EXTRACT(DAY FROM NEW.scheduled_at AT TIME ZONE 'UTC');
    scheduled_month := EXTRACT(MONTH FROM NEW.scheduled_at AT TIME ZONE 'UTC');
    
    -- Create cron expression for the exact time
    cron_expression := scheduled_minute || ' ' || scheduled_hour || ' ' || scheduled_day || ' ' || scheduled_month || ' *';
    job_name := 'post_' || NEW.id::TEXT;
    
    -- Build the HTTP command
    http_command := 'SELECT net.http_post(url := ''https://dmtnwfdjcapiketfcrur.supabase.co/functions/v1/process-scheduled-posts'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdG53ZmRqY2FwaWtldGZjcnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzI5NDYsImV4cCI6MjA4MjU0ODk0Nn0.DXd0p-g6XieguHmEdkUlv2P3OlKfmUkC3T12UcBA8RE"}''::jsonb, body := ''{}''::jsonb);';
    
    -- Check if job already exists before trying to unschedule
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = job_name) INTO job_exists;
    
    IF job_exists THEN
      PERFORM cron.unschedule(job_name);
    END IF;
    
    -- Schedule the job
    PERFORM cron.schedule(job_name, cron_expression, http_command);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix the cleanup_post_job function to handle non-existent jobs gracefully
CREATE OR REPLACE FUNCTION public.cleanup_post_job()
RETURNS TRIGGER AS $$
DECLARE
  job_name TEXT;
  job_exists BOOLEAN;
BEGIN
  -- If status changed from pending to posted or failed, remove the cron job
  IF OLD.status = 'pending' AND NEW.status IN ('posted', 'failed') THEN
    job_name := 'post_' || NEW.id::TEXT;
    
    -- Check if job exists before trying to unschedule
    SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = job_name) INTO job_exists;
    
    IF job_exists THEN
      PERFORM cron.unschedule(job_name);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;