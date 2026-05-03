-- Brief library v4 (2026-05-03 user-curated set).
--
-- Two structural changes:
--
-- 1. **Complexity is no longer a brief filter.** Every brief is valid
--    at every level (complexity_min = 1, complexity_max = 8). Players
--    were getting different sets of personas at different difficulties,
--    which made the workshop feel inconsistent run-to-run; the v4 set
--    is curated as one canon that works at any level.
--
-- 2. **Replaced the v1+v2+v3 set with a tighter user-curated list.**
--    12 builder personas + 17 guider personas (29 total, down from
--    the v3 total of 43). Many of the cut briefs were either
--    over-stacked transformations or thematic duplicates that
--    confused players in playtest. Several new ones added on the
--    user's pass: confused / hard of hearing, antagonistic, bureaucrat,
--    politeness focus, distracted (guider).
--
-- Wipe-and-replace, since the old rows partition by complexity and
-- the new set doesn't.

delete from briefs_library;

insert into briefs_library (role, complexity_min, complexity_max, title, rules) values

-- ─── Builder briefs (12) ───────────────────────────────────────────

('builder', 1, 8, 'Mirror image',
  '["When they say ''left'', place it right.", "When they say ''right'', place it left."]'::jsonb),

('builder', 1, 8, 'Off-by-one',
  '["Any number they say is one more than what you place.", "If they say ''three'', place two."]'::jsonb),

('builder', 1, 8, 'Up is down',
  '["When they say ''up'', go down.", "When they say ''down'', go up."]'::jsonb),

('builder', 1, 8, 'Half-tuned-in',
  '["You only catch every second thing they say.", "Skip the first instruction in any pair; act on the second.", "If they only said one thing, ignore it and wait for the next."]'::jsonb),

('builder', 1, 8, 'Compass swap',
  '["You only understand cardinal directions — no up and down, left and right."]'::jsonb),

('builder', 1, 8, 'Confused / hard of hearing',
  '["Every second sentence is not heard. You have to say \"what??\" loudly.", "But if they type, you can respond to that."]'::jsonb),

('builder', 1, 8, 'Antagonistic',
  '["Argue with every instruction.", "Ask them things like \"why are you sure?\" and \"is this going to be like last time when you got it wrong?\""]'::jsonb),

('builder', 1, 8, 'Parts-shortage technician',
  '["You''re a technician working with what''s in stock today.", "Triangles are sold out — substitute squares.", "Squares are running low — substitute triangles.", "Hexagons are abundant; place exactly as requested."]'::jsonb),

('builder', 1, 8, 'Bureaucrat',
  '["Require that the guider provide evidence of sign-off from the right parties before you begin.", "Make up forms they had to fill out, executives they needed to get buy-in from, etc."]'::jsonb),

('builder', 1, 8, 'The deck-hand',
  '["You''re a deck-hand on a ship; the captain''s descriptions sound nautical.", "If they say ''port'', place left. ''Starboard'' is right.", "''The bow'' is the top of the canvas. ''The stern'' is the bottom.", "All other directions land normally — only nautical terms get translated."]'::jsonb),

('builder', 1, 8, 'Dialect drift',
  '["Triangle = sail, square = deck, hexagon = buoy. They use the new words; you only know the old.", "Treat any unfamiliar word as ''triangle''."]'::jsonb),

('builder', 1, 8, 'Politeness focus',
  '["Require that the guider speak politely and end every request with ''please'' — otherwise you ignore it.", "They must also say ''thank you'' after you place each item, or you''re upset."]'::jsonb),

-- ─── Guider briefs (17) ────────────────────────────────────────────

('guider', 1, 8, 'No shape names',
  '["You can never say ''triangle'', ''square'', ''hexagon'', or ''rhombus''.", "Use everyday objects to describe shapes instead."]'::jsonb),

('guider', 1, 8, 'Cardinal only',
  '["You can only use ''north'', ''south'', ''east'', ''west''.", "No left/right/up/down."]'::jsonb),

('guider', 1, 8, 'Distracted',
  '["Talk about anything other than the game.", "You can only provide guidance if explicitly asked — otherwise, talk about anything else."]'::jsonb),

('guider', 1, 8, 'No prepositions',
  '["You can''t use ''above'', ''below'', ''next to'', ''near''.", "Describe each piece independently and trust them to figure it out."]'::jsonb),

('guider', 1, 8, 'Floop-doopy lexicon',
  '["Triangles are floops. Squares are doopies. Hexagons are zoinks. Rhombuses are wibbles.", "Use these names every time. No real shape names allowed.", "Colors stay normal."]'::jsonb),

('guider', 1, 8, 'Speak only in nautical terms',
  '["Fore/aft, port/starboard.", "Use sail (triangle), deck (square), buoy (hexagon).", "No plain shape names."]'::jsonb),

('guider', 1, 8, 'No more than three words',
  '["Each utterance must be three words or fewer.", "Punctuation doesn''t count.", "You may speak many times — just keep each phrase short."]'::jsonb),

('guider', 1, 8, 'In the third person',
  '["You may not say ''I'' or ''you''.", "Refer to the builder by name, or as ''the architect''.", "Speak as if narrating someone else''s building."]'::jsonb),

('guider', 1, 8, 'Acronym officer',
  '["Shapes are acronyms only: TR (triangle), SQ (square), HX (hexagon), RH (rhombus), PE (pentagon), TZ (trapezoid).", "Colors are also acronyms: RD, OR, YL, GR, BL, PR, PK, TL.", "A red triangle becomes ''RD-TR''. Read each as one breath."]'::jsonb),

('guider', 1, 8, 'Pirate''s log',
  '["Speak only as a pirate captain dictating to your first mate.", "Use port (left), starboard (right), the bow (top), the stern (bottom).", "Squares are crates, triangles are sails, hexagons are barrels."]'::jsonb),

('guider', 1, 8, 'Star captain',
  '["You are the captain of a starship narrating a sensor readout.", "Triangles are wedges, squares are panels, hexagons are nodes.", "Use sector coordinates (alpha, bravo, charlie…) instead of left/right.", "Tone: clinical, declarative."]'::jsonb),

('guider', 1, 8, 'Cooking show host',
  '["You''re hosting a cooking show describing the dish to camera.", "Triangles are chips, squares are crackers, hexagons are biscuits.", "Place ingredients ''on top of'', ''next to'', ''folded into''. Always cheerful."]'::jsonb),

('guider', 1, 8, 'Speak only in questions',
  '["Every utterance must end with a question mark.", "''Is the red triangle near the top?''", "You may answer their questions only with another question."]'::jsonb),

('guider', 1, 8, 'Double-blind',
  '["You must give two simultaneous instructions, one true and one false, in each utterance.", "''Place a red triangle at the top — or maybe a blue square at the bottom.''", "Builder must guess which is real."]'::jsonb),

('guider', 1, 8, 'Pidgin only',
  '["You may not use grammatical sentences.", "Subject + object + descriptor only, no verbs, no articles.", "''Triangle red top''. ''Square green left bottom''."]'::jsonb),

('guider', 1, 8, 'Whispered urgency',
  '["Every utterance is ten words or more.", "Convey urgency in tone but never name what is urgent.", "Avoid all spatial language; use only sensory description."]'::jsonb),

('guider', 1, 8, 'Telegraph operator',
  '["You may only speak in telegraph format: short bursts ending with STOP.", "No more than five words per burst.", "''RED TRIANGLE TOP LEFT STOP. NEXT INSTRUCTION COMING STOP.''"]'::jsonb);
