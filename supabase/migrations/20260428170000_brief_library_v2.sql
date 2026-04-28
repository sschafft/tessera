-- Brief library v2: add briefs in styles surfaced by playtest feedback
-- (silly invented vocabularies, acronym shorthand, more themed jargon)
-- and soften two over-stacked existing briefs that were borderline
-- impossible to apply live (4 simultaneous transformations).
--
-- All shapes referenced: triangle, square, hexagon, rhombus, pentagon,
-- trapezoid (matches lib/canvas/Tile.tsx TileShape).

-- ─── New guider briefs — invented + jargon vocabularies ──────────────
-- These follow the established "Speak only in nautical terms" pattern:
-- one consistent themed vocabulary that constrains how the guider
-- describes the picture without making the puzzle unsolvable.

insert into briefs_library (role, complexity_min, complexity_max, title, rules) values

('guider', 1, 3, 'Floop-doopy lexicon',
  '["Triangles are floops. Squares are doopies. Hexagons are zoinks. Rhombuses are wibbles.", "Use these names every time. No real shape names allowed.", "Colors stay normal."]'::jsonb),

('guider', 4, 6, 'Acronym officer',
  '["Shapes are acronyms only: TR (triangle), SQ (square), HX (hexagon), RH (rhombus), PE (pentagon), TZ (trapezoid).", "Colors are also acronyms: RD, OR, YL, GR, BL, PR, PK, TL.", "A red triangle becomes ''RD-TR''. Read each as one breath."]'::jsonb),

('guider', 4, 6, 'Pirate''s log',
  '["Speak only as a pirate captain dictating to your first mate.", "Use port (left), starboard (right), the bow (top), the stern (bottom).", "Squares are crates, triangles are sails, hexagons are barrels."]'::jsonb),

('guider', 4, 6, 'Star captain',
  '["You are the captain of a starship narrating a sensor readout.", "Triangles are wedges, squares are panels, hexagons are nodes.", "Use sector coordinates (alpha, bravo, charlie…) instead of left/right.", "Tone: clinical, declarative."]'::jsonb),

('guider', 4, 6, 'Cooking show host',
  '["You''re hosting a cooking show describing the dish to camera.", "Triangles are chips, squares are crackers, hexagons are biscuits.", "Place ingredients ''on top of'', ''next to'', ''folded into''. Always cheerful."]'::jsonb),

('guider', 7, 8, 'Telegraph operator',
  '["You may only speak in telegraph format: short bursts ending with STOP.", "No more than five words per burst.", "''RED TRIANGLE TOP LEFT STOP. NEXT INSTRUCTION COMING STOP.''"]'::jsonb),

-- ─── New builder briefs — translation challenges ──────────────────────

('builder', 1, 3, 'Compass swap',
  '["When they say ''north'', go south. When they say ''south'', go north.", "East and west are also swapped.", "Up/down/left/right work normally — only cardinals are flipped."]'::jsonb),

('builder', 4, 6, 'Diagonal logic',
  '["Treat every direction they give as a 45° rotation clockwise.", "''Left'' means upper-left. ''Up'' means upper-right. ''Right'' means lower-right. ''Down'' means lower-left.", "Distances stay the same — only the angle shifts."]'::jsonb);


-- ─── Soften two over-stacked existing briefs ─────────────────────────
-- 'Three-step delay' had four stacked transformations (queue + reverse
-- pairs + halve numbers + mirror). Live playtests showed players
-- dropping out at three. Cut to the queue + one transform.
update briefs_library
   set rules = '["Apply each instruction three pieces late — keep the latest in your head.", "When you finally place the held instruction, also reverse left/right inside it."]'::jsonb
 where role = 'builder' and title = 'Three-step delay';

-- 'Reverse perspective' was four flips at once (lr + tb + colors +
-- numbers). That's untenable as a live constraint. Keep the
-- perspective-flip premise; cut to the two clearest transforms.
update briefs_library
   set rules = '["You see the canvas as the guider does — left/right are flipped.", "Top/bottom are also flipped.", "Shapes and colors arrive normally."]'::jsonb
 where role = 'builder' and title = 'Reverse perspective';
