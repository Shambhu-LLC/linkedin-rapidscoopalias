-- Add unique constraint for user_id + linkedin_id combination
-- This allows upsert operations for syncing accounts

-- First check if the constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'linkedin_accounts_user_id_linkedin_id_key'
  ) THEN
    ALTER TABLE public.linkedin_accounts 
    ADD CONSTRAINT linkedin_accounts_user_id_linkedin_id_key 
    UNIQUE (user_id, linkedin_id);
  END IF;
END $$;