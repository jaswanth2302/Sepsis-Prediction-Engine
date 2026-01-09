-- ============================================================
-- PHASE 1: DATABASE SCHEMA UPDATES
-- Progressive Sepsis Detection System
-- ============================================================
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- This adds stage tracking, WBC, and vital_predictions table
-- ============================================================

-- 1. Add stage tracking columns to risk_assessments
ALTER TABLE public.risk_assessments 
ADD COLUMN IF NOT EXISTS active_stage INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS qsofa_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS simulation_id UUID;

-- 2. Add WBC and stage columns to vitals
ALTER TABLE public.vitals 
ADD COLUMN IF NOT EXISTS wbc INTEGER,
ADD COLUMN IF NOT EXISTS stage INTEGER DEFAULT 1;

-- 3. Create vital_predictions table for 5-second forecasts
CREATE TABLE IF NOT EXISTS public.vital_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vitals_id UUID REFERENCES public.vitals(id) ON DELETE CASCADE,
    simulation_id UUID NOT NULL,
    sequence_index INTEGER NOT NULL,  -- 1, 2, 3, 4, 5 for 5-step forecast
    
    -- Predicted vital values
    hr_predicted NUMERIC(5,1),
    resp_predicted NUMERIC(4,1),
    temp_predicted NUMERIC(4,2),
    sbp_predicted NUMERIC(5,1),
    o2sat_predicted NUMERIC(4,1),
    
    -- Risk score at this prediction step
    risk_score NUMERIC(5,4),
    risk_level TEXT CHECK (risk_level IN ('LOW', 'HIGH')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_predictions_vitals_id 
    ON public.vital_predictions(vitals_id);
CREATE INDEX IF NOT EXISTS idx_predictions_simulation_id 
    ON public.vital_predictions(simulation_id);
CREATE INDEX IF NOT EXISTS idx_predictions_sequence 
    ON public.vital_predictions(simulation_id, sequence_index);

-- 5. Enable RLS on vital_predictions
ALTER TABLE public.vital_predictions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for vital_predictions
CREATE POLICY "Allow anon read predictions" ON public.vital_predictions
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow authenticated read predictions" ON public.vital_predictions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow service role full access predictions" ON public.vital_predictions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- 7. Enable Realtime for vital_predictions
ALTER PUBLICATION supabase_realtime ADD TABLE public.vital_predictions;

-- ============================================================
-- VERIFICATION: Run after migration to confirm
-- ============================================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'vital_predictions';

-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_name = 'risk_assessments' AND column_name IN ('active_stage', 'qsofa_score', 'simulation_id');
