# Tessera brief library

Current state of the brief library after migrations
`20260426000002_tessera_v1_seed_brief_library.sql` →
`20260428170000_brief_library_v2.sql` →
`20260428180000_brief_library_v3.sql`.

Edit titles and rules freely; ping me when you're done and I'll fold the
changes back into a new SQL migration. Each brief is `### Title` with
its rules as a bullet list. The bucket headings (`#### 1–3`, `#### 4–6`,
`#### 7–8`) drive `complexity_min` / `complexity_max` in the DB —
moving a brief between buckets is the same as changing those columns.

Conventions:
- One brief = one `### Heading` + one bullet list of rules
- Rules are `- ` items; each is one short sentence the player reads
- Apostrophes inside rules are normal `'` (not `''`); SQL escaping happens at migration time
- Titles are the primary key per role — renaming = `update … where title = 'old' set title = 'new', rules = …`

Counts: 20 builder briefs + 23 guider briefs = 43 total.

---

## Builder briefs

The builder hears the guider's words and translates them into placements.
Builder briefs distort *interpretation* — the builder thinks they're
following directions while quietly doing something else.

Just use the below briefs for all complexity levels:

#### Mirror image
- When they say 'left', place it right.
- When they say 'right', place it left.

#### Off-by-one
- Any number they say is one more than what you place.
- If they say 'three', place two.

#### Up is down
- When they say 'up', go down.
- When they say 'down', go up.

#### Color cousins
- Treat 'red' as orange.
- Treat 'yellow' as green.

#### Half-tuned-in
- You only catch every second thing they say.
- Skip the first instruction in any pair; act on the second.
- If they only said one thing, ignore it and wait for the next.

#### Compass swap
- You only understand cardinal directions - no up and down, left and right.
- 

#### Confused / hard of hearing
- Every second sentence is not heard. You have to say "what??" loudly.
- But if they type you can respond to that.

#### Antagonistic
- Argue with every instruction.
- Ask them things like "why are you sure?", "is this going to be like last time when you got it wrong?"

#### Parts-shortage technician
- You're a technician working with what's in stock today.
- Triangles are sold out — substitute squares.
- Squares are running low — substitute triangles.
- Hexagons are abundant; place exactly as requested.

#### Bureaucrat
- Require that the guider provide evidence of sign off from the right parties before you begin.
- Make up forms that they had to fill out, executives they needed to get buy in from etc.

#### The deck-hand
- You're a deck-hand on a ship; the captain's descriptions sound nautical.
- If they say 'port', place left. 'Starboard' is right.
- 'The bow' is the top of the canvas. 'The stern' is the bottom.
- All other directions land normally — only nautical terms get translated.

#### Reverse perspective
- You see the canvas as the guider does — left/right are flipped.
- Top/bottom are also flipped.
- Shapes and colors arrive normally.

#### Dialect drift
- Triangle = sail, square = deck, hexagon = buoy. They use the new words; you only know the old.
- Treat any unfamiliar word as 'triangle'.

---

## Guider briefs

The guider sees the goal and describes it through a constraint that
distorts *production*. Guider briefs make the guider work to find a way
to say what they want to say.

### 1–3 complexity (introductory, single-vocabulary constraint)

#### No shape names
- You can never say 'triangle', 'square', 'hexagon', or 'rhombus'.
- Use everyday objects to describe shapes instead.

#### Cardinal only
- You can only use 'north', 'south', 'east', 'west'.
- No left/right/up/down.

#### Plain colors
- Only describe colors using primary names: red, yellow, blue.
- Anything outside those is 'mixed'.

#### Numbers as fractions
- You may only describe distances as halves and quarters of the canvas.
- No specific cell counts.

#### No prepositions
- You can't use 'above', 'below', 'next to', 'near'.
- Describe each piece independently and trust them to figure it out.

#### Floop-doopy lexicon
- Triangles are floops. Squares are doopies. Hexagons are zoinks. Rhombuses are wibbles.
- Use these names every time. No real shape names allowed.
- Colors stay normal.

### 4–6 complexity (themed personas, multi-axis constraint)

#### Speak only in nautical terms
- Fore/aft, port/starboard.
- Use sail (triangle), deck (square), buoy (hexagon).
- No plain shape names.

#### Only emotions
- Describe each piece by the emotion it evokes.
- 'Anxious red'. 'Cheerful triangle'. 'Stoic hex'.
- No literal descriptions.

#### Through a clock face
- The canvas is a clock. Pieces sit at hour positions.
- 'A red triangle at 2 o'clock', 'a green square at 7'.

#### No more than three words
- Each utterance must be three words or fewer.
- Punctuation doesn't count.
- You may speak many times — just keep each phrase short.

#### In the third person
- You may not say 'I' or 'you'.
- Refer to the builder by name, or as 'the architect'.
- Speak as if narrating someone else's building.

#### Through metaphor
- Describe the picture as a story.
- 'Two friends meet at a yellow door.'
- No literal coordinates or shape names.

#### Acronym officer
- Shapes are acronyms only: TR (triangle), SQ (square), HX (hexagon), RH (rhombus), PE (pentagon), TZ (trapezoid).
- Colors are also acronyms: RD, OR, YL, GR, BL, PR, PK, TL.
- A red triangle becomes 'RD-TR'. Read each as one breath.

#### Pirate's log
- Speak only as a pirate captain dictating to your first mate.
- Use port (left), starboard (right), the bow (top), the stern (bottom).
- Squares are crates, triangles are sails, hexagons are barrels.

#### Star captain
- You are the captain of a starship narrating a sensor readout.
- Triangles are wedges, squares are panels, hexagons are nodes.
- Use sector coordinates (alpha, bravo, charlie…) instead of left/right.
- Tone: clinical, declarative.

#### Cooking show host
- You're hosting a cooking show describing the dish to camera.
- Triangles are chips, squares are crackers, hexagons are biscuits.
- Place ingredients 'on top of', 'next to', 'folded into'. Always cheerful.

### 7–8 complexity (high-friction utterance constraints)

#### Speak only in questions
- Every utterance must end with a question mark.
- 'Is the red triangle near the top?'
- You may answer their questions only with another question.

#### No two consecutive nouns
- You cannot follow one noun directly with another.
- Adjectives and verbs must intervene.
- Plan each sentence.

#### Backwards instructions
- State the last piece first.
- Work backwards through the build order.
- Don't repeat yourself.

#### Double-blind
- You must give two simultaneous instructions, one true and one false, in each utterance.
- 'Place a red triangle at the top — or maybe a blue square at the bottom.'
- Builder must guess which is real.

#### Pidgin only
- You may not use grammatical sentences.
- Subject + object + descriptor only, no verbs, no articles.
- 'Triangle red top'. 'Square green left bottom'.

#### Whispered urgency
- Every utterance is ten words or more.
- Convey urgency in tone but never name what is urgent.
- Avoid all spatial language; use only sensory description.

#### Telegraph operator
- You may only speak in telegraph format: short bursts ending with STOP.
- No more than five words per burst.
- 'RED TRIANGLE TOP LEFT STOP. NEXT INSTRUCTION COMING STOP.'

---

## Editing notes for round-tripping

When you're done editing:

1. Mark with a quick comment what changed (e.g., a `[NEW]`, `[RENAMED from X]`, or `[DROP]` next to the heading) — makes the migration easier to author.
2. New briefs: add a fresh `### Heading` under the right complexity bucket.
3. Renames: change the `### Heading`. The diff alone tells me which row to `update … set title = …`.
4. Rule edits: change the bullet list. Each migration is a one-liner per brief, so I'll just regenerate the JSON array.
5. Bucket moves: cut the brief and paste it under the new bucket; I'll generate `update … set complexity_min = …, complexity_max = …`.
6. Drops: delete the section and add `[DROP]` to a comment near it (or just tell me which titles).

Once edits are stable I'll write `supabase/migrations/<date>_brief_library_v4.sql` to apply them in prod.
