-- ===================================================================
-- Lakshmish Sports Platform - Unified Database Schema Migration SQL
-- Run this entire script in the Supabase SQL Editor console.
-- ===================================================================

-- 1. PROFILES TABLE (Handles User Accounts, Avatars, Roles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
CREATE POLICY "Allow public read access" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow individual insert access" ON public.profiles;
CREATE POLICY "Allow individual insert access" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow individual update access" ON public.profiles;
CREATE POLICY "Allow individual update access" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);


-- 2. TOURNAMENTS TABLE (Leagues / Cups)
CREATE TABLE IF NOT EXISTS public.tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  sport TEXT NOT NULL,
  rules TEXT,
  status TEXT DEFAULT 'upcoming',
  teams JSONB DEFAULT '[]'::jsonb,
  fixtures JSONB DEFAULT '[]'::jsonb,
  points_table JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.tournaments;
DROP POLICY IF EXISTS "Allow write access for authenticated users" ON public.tournaments;
DROP POLICY IF EXISTS "Allow public write access" ON public.tournaments;
CREATE POLICY "Allow public write access" ON public.tournaments
  FOR ALL USING (true) WITH CHECK (true);


-- 3. TEAMS TABLE (Franchises / Roster Purses)
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  players JSONB DEFAULT '[]'::jsonb,
  captain_id TEXT,
  vice_captain_id TEXT,
  purse NUMERIC DEFAULT 1500,
  stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.teams;
DROP POLICY IF EXISTS "Allow write access for authenticated users" ON public.teams;
DROP POLICY IF EXISTS "Allow public write access" ON public.teams;
CREATE POLICY "Allow public write access" ON public.teams
  FOR ALL USING (true) WITH CHECK (true);


-- 4. PLAYERS TABLE (Athletes & Bid Stats)
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  photo TEXT,
  role TEXT,
  auction_base_value NUMERIC DEFAULT 100,
  sold_value NUMERIC,
  sold_to_team_id TEXT,
  mvp_points NUMERIC DEFAULT 0,
  stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.players;
DROP POLICY IF EXISTS "Allow write access for authenticated users" ON public.players;
DROP POLICY IF EXISTS "Allow public write access" ON public.players;
CREATE POLICY "Allow public write access" ON public.players
  FOR ALL USING (true) WITH CHECK (true);


-- 5. SPONSORS TABLE (Corporate Ads / Partners)
CREATE TABLE IF NOT EXISTS public.sponsors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  link TEXT DEFAULT '#',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.sponsors;
DROP POLICY IF EXISTS "Allow write access for authenticated users" ON public.sponsors;
DROP POLICY IF EXISTS "Allow public write access" ON public.sponsors;
CREATE POLICY "Allow public write access" ON public.sponsors
  FOR ALL USING (true) WITH CHECK (true);


-- 6. MATCHES TABLE (Real-Time Scoring Logs & Feeds)
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY,
  tournament_id TEXT,
  sport TEXT NOT NULL,
  team_a JSONB DEFAULT '{}'::jsonb,
  team_b JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'upcoming',
  winner_id TEXT,
  toss_text TEXT,
  date TEXT,
  control_token TEXT,
  cricket_state JSONB DEFAULT '{}'::jsonb,
  kabaddi_state JSONB DEFAULT '{}'::jsonb,
  kabaddi_actions JSONB DEFAULT '[]'::jsonb,
  ball_by_ball JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.matches;
DROP POLICY IF EXISTS "Allow write access for authenticated users" ON public.matches;
DROP POLICY IF EXISTS "Allow public write access" ON public.matches;
CREATE POLICY "Allow public write access" ON public.matches
  FOR ALL USING (true) WITH CHECK (true);
