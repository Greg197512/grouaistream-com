
-- Party rooms table for QR party mode
CREATE TABLE public.party_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id UUID NOT NULL,
  room_code TEXT NOT NULL DEFAULT SUBSTRING(md5(random()::text) FROM 1 FOR 8),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '4 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  guest_count INTEGER NOT NULL DEFAULT 0
);

-- Party commands table for guest commands/votes
CREATE TABLE public.party_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.party_rooms(id) ON DELETE CASCADE,
  guest_label TEXT NOT NULL DEFAULT 'Gość',
  command TEXT NOT NULL,
  command_type TEXT NOT NULL DEFAULT 'custom',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.party_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_commands ENABLE ROW LEVEL SECURITY;

-- Party rooms policies
CREATE POLICY "Anyone can view active rooms" ON public.party_rooms FOR SELECT USING (is_active = true);
CREATE POLICY "Host can manage own rooms" ON public.party_rooms FOR ALL TO authenticated USING (auth.uid() = host_user_id);

-- Party commands policies  
CREATE POLICY "Anyone can view commands" ON public.party_commands FOR SELECT USING (true);
CREATE POLICY "Anyone can insert commands" ON public.party_commands FOR INSERT WITH CHECK (true);

-- Enable realtime for commands
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_rooms;
