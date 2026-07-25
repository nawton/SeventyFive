-- RÄTTNING: reports-tabellen fanns redan (20260722000011, target_kind/
-- details) när 20260723000005 skrevs mot fel kolumnnamn — den blev en
-- no-op och de nya anmälningsflödena (grupper m.m.) skrev mot kolumner
-- som inte finns. Klienten är nu rättad till target_kind/details; här
-- utökas bara kind-checken med 'group'.

ALTER TABLE reports DROP CONSTRAINT reports_target_kind_check;
ALTER TABLE reports ADD CONSTRAINT reports_target_kind_check
  CHECK (target_kind IN ('user', 'post', 'comment', 'group'));
