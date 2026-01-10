-- Add connection_type column to distinguish between posting and getlate connections
ALTER TABLE public.linkedin_accounts 
ADD COLUMN connection_type text DEFAULT 'getlate' 
CHECK (connection_type IN ('posting', 'getlate'));