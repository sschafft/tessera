-- Test-build was a super-power that flipped pair_rounds.test_enabled
-- from false to true. As of v1.5, testing is the canonical default —
-- the builder always sees correctness halos when they hit Test
-- solution, and the guider sees the mirror. The super-power became
-- redundant; drop it from the UI and flip the column default so
-- new pair_rounds inherit the new behaviour without a separate
-- enable step.
--
-- Existing pair_rounds with test_enabled=false stay false; they're
-- all from games that have already moved on. The default change
-- only affects future inserts.

alter table pair_rounds alter column test_enabled set default true;
