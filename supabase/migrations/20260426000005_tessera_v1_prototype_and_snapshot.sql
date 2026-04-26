-- Prototype unlock + Agile share accelerants need extra state on
-- pair_rounds. Both default to null; the accelerant triggers populate
-- them.
alter table pair_rounds
  add column prototype_until timestamptz,
  add column builder_snapshot jsonb;
