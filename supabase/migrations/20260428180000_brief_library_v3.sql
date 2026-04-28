-- Brief library v3: tighten older builder briefs that read as
-- "arbitrary stacks of rules" rather than themed personas. Same
-- mechanics; reframed with a clear voice the player can lean into.
-- Driven by 2026-04-28 UX-lens playtest feedback (Cameron + GM
-- specifically called out Translate-don't-transcribe and Helpful
-- pessimist as flatter than the new themed briefs).

-- ─── Reframe builder briefs as personas ──────────────────────────────

update briefs_library
   set title = 'Reluctant translator',
       rules = '["You''re translating in real time and a few words just don''t carry over.", "When they say ''left'', it lands as ''right'' in your ears (and vice versa).", "Color names arrive as their complements — what they call red, you hear as green; blue ↔ orange; yellow ↔ purple.", "Numbers arrive halved (round up). ''Four'' means two."]'::jsonb
 where role = 'builder' and title = 'Translate, don''t transcribe';

update briefs_library
   set rules = '["You''re a pessimist who''s sure your guider is exaggerating.", "When they say ''big'', you assume they meant small — place at half size.", "When they say ''small'', you assume they meant big — double size.", "Color names from them are aspirational; treat each as the colour one rung counter-clockwise on the rainbow (red → orange → yellow → green → blue → purple → pink → red)."]'::jsonb
 where role = 'builder' and title = 'Helpful pessimist';

update briefs_library
   set title = 'Parts-shortage technician',
       rules = '["You''re a technician working with what''s in stock today.", "Triangles are sold out — substitute squares.", "Squares are running low — substitute hexagons.", "Hexagons are abundant; place exactly as requested."]'::jsonb
 where role = 'builder' and title = 'Loose adapter';

-- 'Read between the lines' was mechanical ("ignore first, act on
-- second"). Reframe as a hard-of-hearing listener who genuinely
-- only catches every second instruction.
update briefs_library
   set title = 'Half-tuned-in',
       rules = '["You only catch every second thing they say.", "Skip the first instruction in any pair; act on the second.", "If they only said one thing, ignore it and wait for the next."]'::jsonb
 where role = 'builder' and title = 'Read between the lines';

-- ─── Two new builder briefs in the new themed style ──────────────────
-- These follow the persona-first pattern of Compass Swap + Diagonal
-- Logic, giving complexity 4-6 builders one more themed voice option.

insert into briefs_library (role, complexity_min, complexity_max, title, rules) values

('builder', 4, 6, 'The deck-hand',
  '["You''re a deck-hand on a ship; the captain''s descriptions sound nautical.", "If they say ''port'', place left. ''Starboard'' is right.", "''The bow'' is the top of the canvas. ''The stern'' is the bottom.", "All other directions land normally — only nautical terms get translated."]'::jsonb),

('builder', 7, 8, 'Old-timey postman',
  '["You read each instruction as a telegram with words missing where they used 50¢ words.", "Drop every shape adjective: ''bright red triangle'' becomes ''triangle''.", "Drop every superlative: ''very large'' becomes ''large''.", "What''s left is your full instruction — place exactly that, no more."]'::jsonb);
