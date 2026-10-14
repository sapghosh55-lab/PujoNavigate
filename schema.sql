-- ============================================================================
-- Kolkata Durga Puja Crowd Navigation & Accessibility Schema (PostgreSQL/Supabase)
-- ============================================================================

-- Enable pgcrypto / uuid-ossp if not already enabled (Supabase has this enabled by default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Table: pandals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pandals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    bengali_name TEXT,
    zone TEXT NOT NULL, -- e.g., 'South', 'North', 'Central', 'East', 'West', 'Howrah', 'Salt Lake'
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    nearest_metro_station TEXT,
    metro_walking_mins INTEGER CHECK (metro_walking_mins >= 0),
    wheelchair_accessible BOOLEAN NOT NULL DEFAULT FALSE,
    senior_queue BOOLEAN NOT NULL DEFAULT FALSE,
    medical_booth BOOLEAN NOT NULL DEFAULT FALSE,
    police_kiosk TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for zone filtering & location queries
CREATE INDEX IF NOT EXISTS idx_pandals_zone ON public.pandals(zone);
CREATE INDEX IF NOT EXISTS idx_pandals_lat_lng ON public.pandals(latitude, longitude);

-- ----------------------------------------------------------------------------
-- 2. Table: crowd_reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crowd_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pandal_id UUID NOT NULL REFERENCES public.pandals(id) ON DELETE CASCADE,
    wait_time_minutes INTEGER CHECK (wait_time_minutes >= 0),
    crowd_level INTEGER NOT NULL CHECK (crowd_level BETWEEN 1 AND 5), -- 1: Very Low, 5: Extreme
    reported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Composite index optimized for 45-minute recency window lookups per pandal
CREATE INDEX IF NOT EXISTS idx_crowd_reports_pandal_recency 
    ON public.crowd_reports (pandal_id, reported_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Function: get_pandal_weighted_crowd_level
--
-- Calculates the weighted average crowd level for a pandal using reports
-- submitted within the last 45 minutes. More recent reports receive higher weight
-- based on linear time decay (weight scales from ~1.0 at report time down to 0 at 45m).
-- If no reports exist within the 45-minute window, it falls back to p_default_level.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pandal_weighted_crowd_level(
    p_pandal_id UUID,
    p_default_level NUMERIC DEFAULT 1.0
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_weighted_crowd NUMERIC;
    v_cutoff TIMESTAMPTZ := timezone('utc'::text, now()) - INTERVAL '45 minutes';
BEGIN
    WITH recent_reports AS (
        SELECT 
            crowd_level,
            reported_at,
            -- Weight decays linearly with elapsed time over 45 minutes (2700 seconds)
            -- A report submitted just now has weight ~1.0, and a report from 44m ago has weight ~0.02
            GREATEST(
                0.01,
                (2700.0 - EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - reported_at))) / 2700.0
            ) AS weight
        FROM public.crowd_reports
        WHERE pandal_id = p_pandal_id
          AND reported_at >= v_cutoff
    )
    SELECT 
        ROUND(SUM(crowd_level * weight) / NULLIF(SUM(weight), 0), 2)
    INTO v_weighted_crowd
    FROM recent_reports;

    -- Fall back to default level if no reports were found in the last 45 minutes
    RETURN COALESCE(v_weighted_crowd, p_default_level);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Convenient View: pandals_with_live_crowd
-- Provides pandal details along with the live calculated crowd level & recent report count
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.pandals_with_live_crowd AS
SELECT 
    p.*,
    public.get_pandal_weighted_crowd_level(p.id, 1.0) AS live_crowd_level,
    (
        SELECT COUNT(*) 
        FROM public.crowd_reports cr 
        WHERE cr.pandal_id = p.id 
          AND cr.reported_at >= timezone('utc'::text, now()) - INTERVAL '45 minutes'
    ) AS recent_reports_count
FROM public.pandals p;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS) policies for Supabase
-- ----------------------------------------------------------------------------
ALTER TABLE public.pandals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crowd_reports ENABLE ROW LEVEL SECURITY;

-- Allow read-only access to all users (both anonymous and authenticated)
CREATE POLICY "Public read access for pandals" 
    ON public.pandals FOR SELECT 
    USING (true);

CREATE POLICY "Public read access for crowd reports" 
    ON public.crowd_reports FOR SELECT 
    USING (true);

-- Allow anyone (public/crowdsourced) to submit crowd reports
CREATE POLICY "Public insert access for crowd reports" 
    ON public.crowd_reports FOR INSERT 
    WITH CHECK (true);
