-- Add first_login_completed column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_login_completed BOOLEAN DEFAULT FALSE;

-- Create function to reset mood history on first login
CREATE OR REPLACE FUNCTION public.handle_first_login()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first login (profile just created or first_login not completed)
  IF NEW.first_login_completed = FALSE OR OLD.first_login_completed IS NULL THEN
    -- Delete any existing mood sessions for this user (fresh start)
    DELETE FROM public.mood_sessions WHERE user_id = NEW.user_id;
    
    -- Mark first login as completed
    NEW.first_login_completed := TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for first login handling
DROP TRIGGER IF EXISTS on_first_login ON public.profiles;
CREATE TRIGGER on_first_login
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.first_login_completed = FALSE AND NEW.first_login_completed = TRUE)
  EXECUTE FUNCTION public.handle_first_login();