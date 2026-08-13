-- ============================================================================
-- OTAQ.GG - SUPABASE DATABASE SCHEMA & REALTIME SETUP
-- ============================================================================
-- Copy and paste this script directly into your Supabase SQL Editor.
-- It creates the necessary tables, indexes, row-level security (RLS) policies,
-- and enables Realtime replication for both tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP EXISTING TABLES (Optional Cleanup)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;

-- ----------------------------------------------------------------------------
-- 2. CREATE ROOMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished')),
  game_mode TEXT DEFAULT NULL CHECK (game_mode IN ('sabotage', 'auction', NULL)),
  game_state JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. CREATE PLAYERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE public.players (
  id UUID PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  is_host BOOLEAN DEFAULT false,
  role TEXT DEFAULT NULL,
  hp INTEGER DEFAULT 100,
  is_alive BOOLEAN DEFAULT true,
  vote TEXT DEFAULT NULL,
  bid INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. CREATE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX idx_players_room_code ON public.players(room_code);

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable full anonymous access for real-time peer-to-peer party gameplay.
-- ----------------------------------------------------------------------------

-- Enable RLS on rooms table
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public SELECT on rooms" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "Allow public INSERT on rooms" ON public.rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public UPDATE on rooms" ON public.rooms
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public DELETE on rooms" ON public.rooms
  FOR DELETE USING (true);

-- Enable RLS on players table
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public SELECT on players" ON public.players
  FOR SELECT USING (true);

CREATE POLICY "Allow public INSERT on players" ON public.players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public UPDATE on players" ON public.players
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public DELETE on players" ON public.players
  FOR DELETE USING (true);

-- ----------------------------------------------------------------------------
-- 6. ENABLE SUPABASE REALTIME REPLICATION
-- Adds both rooms and players tables to the realtime publication.
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
