-- Add the builder-side counterpart to the v4 "Distracted" guider brief.
-- Same persona; the rule's verb flips ("respond to guidance" instead
-- of "provide guidance") so it makes sense for whichever side draws it.

insert into briefs_library (role, complexity_min, complexity_max, title, rules) values
('builder', 1, 8, 'Distracted',
  '["Talk about anything other than the game.", "You can only respond to guidance if explicitly asked — otherwise, talk about anything else."]'::jsonb);
