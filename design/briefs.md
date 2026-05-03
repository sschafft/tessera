# Tessera brief library

Current state of the brief library after the v4 migration
(`20260503120000_brief_library_v4.sql`). v4 is a wipe-and-replace from
the v1+v2+v3 set; complexity is no longer a brief filter — every
brief is valid at every complexity (`complexity_min = 1`,
`complexity_max = 8`). Player experience stays consistent regardless
of difficulty dial.

Counts: 12 builder briefs + 17 guider briefs = 29 total.

Edit titles and rules freely; ping me when you're done and I'll fold
the changes back into a new SQL migration.

Conventions:
- One brief = one `### Heading` + one bullet list of rules.
- Rules are `- ` items; each is one short sentence the player reads.
- Apostrophes inside rules are normal `'` (not `''`); SQL escaping happens at migration time.
- Titles are the de-facto primary key per role — renaming = `update … where title = 'old' set title = 'new', rules = …`.

---

## Builder briefs

The builder hears the guider's words and translates them into placements.
Builder briefs distort *interpretation* — the builder thinks they're
following directions while quietly doing something else.

### Mirror image
- When they say 'left', place it right.
- When they say 'right', place it left.

### Off-by-one
- Any number they say is one more than what you place.
- If they say 'three', place two.

### Up is down
- When they say 'up', go down.
- When they say 'down', go up.

### Half-tuned-in
- You only catch every second thing they say.
- Skip the first instruction in any pair; act on the second.
- If they only said one thing, ignore it and wait for the next.

### Compass swap
- You only understand cardinal directions — no up and down, left and right.

### Confused / hard of hearing
- Every second sentence is not heard. You have to say "what??" loudly.
- But if they type, you can respond to that.

### Antagonistic
- Argue with every instruction.
- Ask them things like "why are you sure?" and "is this going to be like last time when you got it wrong?"

### Parts-shortage technician
- You're a technician working with what's in stock today.
- Triangles are sold out — substitute squares.
- Squares are running low — substitute triangles.
- Hexagons are abundant; place exactly as requested.

### Bureaucrat
- Require that the guider provide evidence of sign-off from the right parties before you begin.
- Make up forms they had to fill out, executives they needed to get buy-in from, etc.

### The deck-hand
- You're a deck-hand on a ship; the captain's descriptions sound nautical.
- If they say 'port', place left. 'Starboard' is right.
- 'The bow' is the top of the canvas. 'The stern' is the bottom.
- All other directions land normally — only nautical terms get translated.

### Dialect drift
- Triangle = sail, square = deck, hexagon = buoy. They use the new words; you only know the old.
- Treat any unfamiliar word as 'triangle'.

### Politeness focus
- Require that the guider speak politely and end every request with 'please' — otherwise you ignore it.
- They must also say 'thank you' after you place each item, or you're upset.

---

## Guider briefs

The guider sees the goal and describes it through a constraint that
distorts *production*. Guider briefs make the guider work to find a way
to say what they want to say.

### No shape names
- You can never say 'triangle', 'square', 'hexagon', or 'rhombus'.
- Use everyday objects to describe shapes instead.

### Cardinal only
- You can only use 'north', 'south', 'east', 'west'.
- No left/right/up/down.

### Distracted
- Talk about anything other than the game.
- You can only provide guidance if explicitly asked — otherwise, talk about anything else.

### No prepositions
- You can't use 'above', 'below', 'next to', 'near'.
- Describe each piece independently and trust them to figure it out.

### Floop-doopy lexicon
- Triangles are floops. Squares are doopies. Hexagons are zoinks. Rhombuses are wibbles.
- Use these names every time. No real shape names allowed.
- Colors stay normal.

### Speak only in nautical terms
- Fore/aft, port/starboard.
- Use sail (triangle), deck (square), buoy (hexagon).
- No plain shape names.

### No more than three words
- Each utterance must be three words or fewer.
- Punctuation doesn't count.
- You may speak many times — just keep each phrase short.

### In the third person
- You may not say 'I' or 'you'.
- Refer to the builder by name, or as 'the architect'.
- Speak as if narrating someone else's building.

### Acronym officer
- Shapes are acronyms only: TR (triangle), SQ (square), HX (hexagon), RH (rhombus), PE (pentagon), TZ (trapezoid).
- Colors are also acronyms: RD, OR, YL, GR, BL, PR, PK, TL.
- A red triangle becomes 'RD-TR'. Read each as one breath.

### Pirate's log
- Speak only as a pirate captain dictating to your first mate.
- Use port (left), starboard (right), the bow (top), the stern (bottom).
- Squares are crates, triangles are sails, hexagons are barrels.

### Star captain
- You are the captain of a starship narrating a sensor readout.
- Triangles are wedges, squares are panels, hexagons are nodes.
- Use sector coordinates (alpha, bravo, charlie…) instead of left/right.
- Tone: clinical, declarative.

### Cooking show host
- You're hosting a cooking show describing the dish to camera.
- Triangles are chips, squares are crackers, hexagons are biscuits.
- Place ingredients 'on top of', 'next to', 'folded into'. Always cheerful.

### Speak only in questions
- Every utterance must end with a question mark.
- 'Is the red triangle near the top?'
- You may answer their questions only with another question.

### Double-blind
- You must give two simultaneous instructions, one true and one false, in each utterance.
- 'Place a red triangle at the top — or maybe a blue square at the bottom.'
- Builder must guess which is real.

### Pidgin only
- You may not use grammatical sentences.
- Subject + object + descriptor only, no verbs, no articles.
- 'Triangle red top'. 'Square green left bottom'.

### Whispered urgency
- Every utterance is ten words or more.
- Convey urgency in tone but never name what is urgent.
- Avoid all spatial language; use only sensory description.

### Telegraph operator
- You may only speak in telegraph format: short bursts ending with STOP.
- No more than five words per burst.
- 'RED TRIANGLE TOP LEFT STOP. NEXT INSTRUCTION COMING STOP.'
