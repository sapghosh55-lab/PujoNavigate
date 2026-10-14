-- ============================================================================
-- Supabase Migration: Accessible Durga Puja Navigation & Real-time Crowd App
-- ============================================================================

-- 0. Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Table: pandals
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pandals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en TEXT NOT NULL,
    name_bn TEXT,
    cluster TEXT NOT NULL, -- e.g., 'South-Rashbehari', 'North-Maniktala', 'East-SaltLake'
    entry_lat NUMERIC(10, 7) NOT NULL,
    entry_lng NUMERIC(10, 7) NOT NULL,
    nearest_metro TEXT,
    metro_line TEXT CHECK (metro_line IN ('Blue', 'Green', 'Purple', 'Orange')),
    metro_gate TEXT,
    walk_mins INTEGER CHECK (walk_mins >= 0),
    wheelchair_access BOOLEAN NOT NULL DEFAULT FALSE,
    senior_line BOOLEAN NOT NULL DEFAULT FALSE,
    medical_kiosk BOOLEAN NOT NULL DEFAULT FALSE,
    restroom_nearby BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for cluster browsing and coordinate lookups
CREATE INDEX IF NOT EXISTS idx_pandals_cluster ON public.pandals(cluster);
CREATE INDEX IF NOT EXISTS idx_pandals_coords ON public.pandals(entry_lat, entry_lng);
CREATE INDEX IF NOT EXISTS idx_pandals_metro ON public.pandals(nearest_metro, metro_line);

-- ----------------------------------------------------------------------------
-- 2. Table: crowd_reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crowd_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pandal_id UUID NOT NULL REFERENCES public.pandals(id) ON DELETE CASCADE,
    wait_time_bracket TEXT NOT NULL CHECK (wait_time_bracket IN ('under_15', '15_30', '30_60', '60_plus')),
    status_level INTEGER NOT NULL CHECK (status_level BETWEEN 1 AND 4), -- 1: Green/Smooth, 2: Yellow/Steady, 3: Orange/Heavy, 4: Red/Gridlock
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Fast index for scanning the 45-minute recency window per pandal
CREATE INDEX IF NOT EXISTS idx_crowd_reports_pandal_recency 
    ON public.crowd_reports (pandal_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Baseline Helper: Time-based default level when no recent reports exist
-- 
-- Timezone: 'Asia/Kolkata' (IST)
--   - Before 4 PM (< 16:00 IST): Level 1 (Smooth / Green)
--   - 4 PM to 6 PM (16:00 - 18:00 IST): Level 2 (Steady / Yellow)
--   - 6 PM to Midnight (18:00 - 24:00 IST): Level 3 (Heavy Rush / Orange)
--   - Midnight to 4 AM (00:00 - 04:00 IST): Level 2 (Late Night Hoppers)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_time_based_baseline_status()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT CASE 
        WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Kolkata')) < 16 THEN 1
        WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Kolkata')) < 18 THEN 2
        WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Kolkata')) < 24 THEN 3
        ELSE 2 -- Post-midnight night hopping window
    END;
$$;

-- ----------------------------------------------------------------------------
-- 4. View: get_current_pandal_status
--
-- Calculates effective crowd level from reports in the last 45 minutes.
-- If no reports exist within 45 minutes, seamlessly falls back to the IST baseline.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.get_current_pandal_status AS
WITH recent_window AS (
    SELECT 
        pandal_id,
        ROUND(AVG(status_level))::INTEGER AS avg_status_level,
        COUNT(*)::INTEGER AS recent_reports_count,
        MAX(created_at) AS latest_report_at,
        -- Pick the most commonly reported wait bracket in the window
        MODE() WITHIN GROUP (ORDER BY wait_time_bracket) AS typical_wait_bracket
    FROM public.crowd_reports
    WHERE created_at >= (timezone('utc'::text, now()) - INTERVAL '45 minutes')
    GROUP BY pandal_id
)
SELECT 
    p.id,
    p.name_en,
    p.name_bn,
    p.cluster,
    p.entry_lat,
    p.entry_lng,
    p.nearest_metro,
    p.metro_line,
    p.metro_gate,
    p.walk_mins,
    p.wheelchair_access,
    p.senior_line,
    p.medical_kiosk,
    p.restroom_nearby,
    -- Effective status level: live reports average if present, otherwise time-based baseline
    COALESCE(rw.avg_status_level, public.get_time_based_baseline_status()) AS effective_status_level,
    -- Human-friendly label
    CASE COALESCE(rw.avg_status_level, public.get_time_based_baseline_status())
        WHEN 1 THEN 'Green / Smooth'
        WHEN 2 THEN 'Yellow / Steady Queue'
        WHEN 3 THEN 'Orange / Heavy Rush'
        WHEN 4 THEN 'Red / Gridlock'
        ELSE 'Green / Smooth'
    END AS status_label,
    COALESCE(rw.recent_reports_count, 0) AS reports_last_45m,
    rw.latest_report_at,
    (rw.pandal_id IS NULL) AS is_using_baseline_default,
    COALESCE(rw.typical_wait_bracket, 
        CASE public.get_time_based_baseline_status()
            WHEN 1 THEN 'under_15'
            WHEN 2 THEN '15_30'
            WHEN 3 THEN '30_60'
            ELSE 'under_15'
        END
    ) AS effective_wait_bracket
FROM public.pandals p
LEFT JOIN recent_window rw ON p.id = rw.pandal_id;

-- ----------------------------------------------------------------------------
-- 5. Stored Procedure: get_current_pandal_status(p_cluster TEXT)
-- Callable via Supabase RPC: supabase.rpc('get_current_pandal_status', { p_cluster: 'South-Rashbehari' })
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_pandal_status(p_cluster TEXT DEFAULT NULL)
RETURNS SETOF public.get_current_pandal_status
LANGUAGE sql
STABLE
AS $$
    SELECT * 
    FROM public.get_current_pandal_status
    WHERE (p_cluster IS NULL OR cluster = p_cluster)
    ORDER BY effective_status_level ASC, walk_mins ASC;
$$;

-- ----------------------------------------------------------------------------
-- 6. Enable Realtime on crowd_reports for Supabase
-- ----------------------------------------------------------------------------
-- Set replica identity to full so update/delete events contain full record payloads
ALTER TABLE public.crowd_reports REPLICA IDENTITY FULL;

-- Add crowd_reports table to Supabase Realtime publication
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_publication_rel pr
            JOIN pg_publication p ON p.oid = pr.prpubid
            JOIN pg_class c ON c.oid = pr.prrelid
            WHERE p.pubname = 'supabase_realtime' AND c.relname = 'crowd_reports'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.crowd_reports;
        END IF;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.pandals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crowd_reports ENABLE ROW LEVEL SECURITY;

-- Allow public read access to pandals & reports
CREATE POLICY "Public read access for pandals"
    ON public.pandals FOR SELECT
    USING (true);

CREATE POLICY "Public read access for crowd reports"
    ON public.crowd_reports FOR SELECT
    USING (true);

-- Allow crowdsourced report insertions from all clients (anonymous or authenticated)
CREATE POLICY "Public insert access for crowd reports"
    ON public.crowd_reports FOR INSERT
    WITH CHECK (true);
