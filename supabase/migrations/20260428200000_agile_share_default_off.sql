-- Agile share is now off by default — the builder has zero shares
-- until the GM fires the Agile share super-power. Previously
-- shares_remaining defaulted to 3 (a built-in cap), so the builder
-- could share 3x even when the GM never triggered the super-power.
--
-- This migration only changes the column default; existing
-- pair_rounds rows keep their (now-stale) values until the next
-- round starts. New rows from now on start at 0.
alter table pair_rounds alter column shares_remaining set default 0;
