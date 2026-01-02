-- Add publishing_enabled and getlate_account_id to linkedin_accounts table
-- This tracks when a user has completed the GetLate OAuth flow
ALTER TABLE public.linkedin_accounts 
ADD COLUMN IF NOT EXISTS getlate_account_id text,
ADD COLUMN IF NOT EXISTS publishing_enabled boolean DEFAULT false;