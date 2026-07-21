-- =============================================================================
-- PROFILDETALJER — födelsedatum, kön, vikt och längd på profilen.
-- Vikten driver kaloriberäkningen (speglas även lokalt i appen);
-- resten är profilinformation inför kommande funktioner.
-- =============================================================================

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists gender     text,
  add column if not exists weight_kg  numeric(5,1),
  add column if not exists height_cm  integer;
