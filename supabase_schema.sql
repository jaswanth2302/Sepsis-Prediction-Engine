-- ============================================================
-- SEPSIS EARLY DETECTION SYSTEM - DATABASE SCHEMA
-- ============================================================
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- 
-- This creates the required tables for the sepsis monitoring system:
--   1. vitals - Stores patient vital signs (manual or automated input)
--   2. risk_assessments - Stores ML model predictions linked to vitals
-- ============================================================

-- ============================================================
-- CLEANUP: Drop existing tables if they exist (for fresh install)
-- COMMENT OUT these lines if you want to preserve existing data
-- ============================================================

DROP TABLE IF EXISTS public.risk_assessments CASCADE;
DROP TABLE IF EXISTS public.vitals CASCADE;

-- ============================================================
-- TABLE: vitals
-- Stores patient vital sign measurements
-- ============================================================

CREATE TABLE public.vitals (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Patient reference (optional - for multi-patient systems)
    user_id TEXT,
    
    -- Vital sign measurements
    heart_rate INTEGER,                    -- bpm (20-300)
    spo2 INTEGER,                          -- % oxygen saturation (50-100)
    systolic_bp INTEGER,                   -- mmHg (50-250)
    diastolic_bp INTEGER,                  -- mmHg (30-150)
    respiratory_rate INTEGER,              -- breaths per minute (5-60)
    temperature NUMERIC(4,1),              -- Celsius (32.0-42.0)
    
    -- ML feature: ICU Length of Stay (hours since admission)
    iculos INTEGER DEFAULT 1,
    
    -- Data source
    source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'device', 'hl7'
    
    -- Processing flag for Python watcher
    processed BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient polling by the Python watcher
CREATE INDEX idx_vitals_source_processed 
    ON public.vitals (source, processed) 
    WHERE processed = FALSE;

-- Index for patient lookup
CREATE INDEX idx_vitals_user_id 
    ON public.vitals (user_id);

-- ============================================================
-- TABLE: risk_assessments
-- Stores ML model predictions for sepsis risk
-- ============================================================

CREATE TABLE public.risk_assessments (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to vitals
    vitals_id UUID NOT NULL REFERENCES public.vitals(id) ON DELETE CASCADE,
    
    -- Risk assessment results
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'HIGH', 'ERROR')),
    risk_score NUMERIC(5,4),               -- Probability 0.0000 to 1.0000
    
    -- Model reasoning/explanation (JSONB for flexibility)
    reasoning JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up assessments by vitals
CREATE INDEX idx_risk_assessments_vitals_id 
    ON public.risk_assessments (vitals_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on both tables
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all vitals
CREATE POLICY "Allow authenticated read vitals" ON public.vitals
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow authenticated users to insert vitals
CREATE POLICY "Allow authenticated insert vitals" ON public.vitals
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Allow anon users to read/insert for demo purposes
CREATE POLICY "Allow anon read vitals" ON public.vitals
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow anon insert vitals" ON public.vitals
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Policy: Allow service role full access (for Python backend)
CREATE POLICY "Allow service role full access vitals" ON public.vitals
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Allow authenticated read risk_assessments
CREATE POLICY "Allow authenticated read risk_assessments" ON public.risk_assessments
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Allow anon read risk_assessments (for demo)
CREATE POLICY "Allow anon read risk_assessments" ON public.risk_assessments
    FOR SELECT
    TO anon
    USING (true);

-- Policy: Allow service role full access (for Python backend inserts)
CREATE POLICY "Allow service role full access risk_assessments" ON public.risk_assessments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================

-- Enable realtime for risk_assessments (frontend listens for results)
ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_assessments;

-- Enable realtime for vitals (optional - for monitoring dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE public.vitals;

-- ============================================================
-- VERIFICATION QUERY
-- Run this after creating the tables to verify they exist
-- ============================================================

-- SELECT 
--     table_name, 
--     column_name, 
--     data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('vitals', 'risk_assessments')
-- ORDER BY table_name, ordinal_position;
