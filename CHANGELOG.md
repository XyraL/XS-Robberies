# Changelog

## Unreleased

### Changed

- Finished the rename off the Cipher name. The seven database tables are now
  `xs_robbery_*` instead of `cipher_robbery_*`, and the built-in minigames are
  `xs:tumbler` and friends instead of `cipher:tumbler`.
- **Nothing to do on your end.** The old tables are renamed in place the first
  time the resource starts, and only when the old name exists and the new one
  does not. Every robbery your players built comes with them.
- Robberies saved with the old `cipher:` minigame ids still run. Those ids stay
  resolvable for good; the builder just offers the new ones from now on.
- `tools/check-standalone.mjs` only knew the old `cipher-*` names, so after the
  rename it would have waved through a hard reference to a sibling script. It
  matches both now.

## 0.11.0

### Added

- **Events for other resources to hang things off.** `runStarted`,
  `stageCompleted` and `runEnded` fire server side with everything a server
  needs to build its own levelling, achievements or logging. `stageCompleted`
  carries the stage type and the citizenid of whoever did it, which is the hook
  to use if you want XP without us deciding how XP works.
- Read-only exports: `GetActiveRuns`, `IsRunActive`, `IsBlacklisted` and
  `GetRobberies`.
- A LICENSE, matching the terms the rest of the Cipher line ships with.

## 0.10.0

### Added

- **Six more built-in minigames**, doubling the set to twelve: Thermite (watch a
  pattern, put it back), Fingerprint (pick the print that matches the one on
  file), Drill (lean on it with W, ease off with S, and watch the heat), Pin Pad
  (crack a combination with exact and close feedback on every guess), Bypass
  (stop a running cursor inside each gate in order) and Sweep (hit the radar as
  it crosses the contact).
- **Anchors can follow vehicles and peds**, not just props. A robbery anchored to
  a vehicle model works on every one of them wherever they happen to be.
- **Bank Truck preset.** Anchored to the Stockade, so every armoured van on the
  road is a job: torch the rear doors, then work five cash boxes out one at a
  time. Nothing to stamp.

### Fixed

- Fingerprint decoys could render identically to the answer, which made the
  puzzle unfair and sometimes unsolvable by looking. Every print is now built
  from a guaranteed-distinct set of ridge offsets.

## 0.9.0

### Added

- **Door locks.** A new **Door** stage unlocks (or locks) a door in whatever
  door lock resource you run. Auto-detects ox_doorlock, qb-doorlock,
  nui_doorlock and jd_doorlock, and any door a run opened is put back the way it
  was when the run ends. Another resource can register its own handler with
  `exports['XS-Robberies']:RegisterDoorProvider(name, provider)` rather
  than waiting for us to support it.
- **Armed guards.** A guard stage spawns a ped who fights back: model, weapon,
  accuracy, health, armour and an idle scenario are all yours to set. There is
  nothing to press — the stage completes when the guard goes down, and whoever
  put them there gets whatever the stage drops. Guards can start passive and
  only turn hostile once the alarm goes, so a quiet crew can walk past them.
- **Laser grids.** Beams drawn across a doorway that trip the alarm when
  somebody walks through. Width and beam count are configurable, and they go
  dark once the stage is disabled — wire it behind the power box and cutting
  power kills the lasers too.
- **Failure penalties.** Any stage can now punish a botched attempt with an
  electric shock, fire, a gas cloud or an explosion. The power box's old shock
  option still works and is folded into this.
- **Item loss risk.** A stage can set the odds that a failure destroys the tool
  being used, so a drill is no longer a one-off purchase.

### Changed

- Settings lists the door lock bridge alongside the others, so you can see at a
  glance whether a Door stage will do anything.
- Validation flags a Door stage with no door id, a Door stage when no door lock
  resource is running, and an armed guard with no weapon.

## 0.8.0

### Added

- **Robberies can be anchored to prop models instead of stamped locations.**
  Point a design at the ATM models and every cash machine in the map becomes
  robbable with nothing to place. Stage positions are read as offsets from
  where you built them and rotate with each prop, so a point put on the front
  of one ATM lands on the front of all of them. The prop the map already
  placed is the thing you target, so nothing is spawned on top of it.
- **Six presets**, all arriving switched off with their loot tables:
  ATM (model anchored, no locations to place), 24-7 Store (six stages, twenty
  shop fronts bundled), Fleeca Bank (eleven stages, six banks), Vangelico
  Jewelry (a pure goods smash and grab, no cash at all), Blaine County Savings
  (nine stages, built long because nobody is coming quickly) and Pacific
  Standard (twelve stages and every mechanic in the script).
- Presets are reachable from the Robberies panel and from the empty state, and
  each one tells you which of its items your server is missing before you
  install it. Location-anchored presets offer to stamp every bundled site.

### Changed

- The preset gallery opens in a wide modal, so six of them are readable at once.

## 0.7.1

### Changed

- **A stage pays the person who did it.** Money used to go into one pot that was
  handed to the whole crew at the escape; it is now banked against whoever
  earned it. Empty the register and that money is yours, crack the safe and its
  cash and its gold chain are the safe-cracker's. A stage with no payout set
  pays nobody, so a camera or a power box costs someone effort and earns them
  nothing, which is what makes a crew split the work.
- Holding money until the escape still works the same way, it just holds each
  robber's own share rather than a common pot. The HUD shows you your earnings
  and nobody else's.

## 0.7.0

### Added

- **A payout can be cash, items, or any mix of both.** Set money and a list of
  items on the same stage, or leave the money at zero and pay purely in goods.
  Each item takes its own least, most and chance, so a safe can reliably hand
  over marked bills and only sometimes a gold chain. The shared loot table is
  still there for drops used by several stages at once.
- Items land in their pockets immediately even when the cash is held back until
  the escape. Carrying the goods is the risk.
- Animation and prop options moved out of Advanced into their own **Look and
  feel** section on every stage: scenario, animation dict, clip and flag, the
  world prop, the held prop with its bone and offset, and the progress style.

### Removed

- Splitting a payout across the crew. Everyone taking part is paid the full
  amount, as they were with the setting off.

### Notes

- Stages built before this keep working. The old single-account payout shape is
  read back and converted the first time a stage is opened or run.

## 0.6.0

### Added

- **Six themes**, picked from swatches in Settings and saved on the server, so
  every admin sees the colour the owner chose: emerald, amber, violet, rose, ice
  and gold. Only the accent moves. Backgrounds stay near-black and the semantic
  colours never change, so a theme can never make a delete button look safe.
- **Category colours.** Stores, banks, jewelry, ATMs and houses each get their
  own hue on the card edge and a chip beside the name, so a bank does not look
  like a corner shop in a list of twenty.

### Changed

- Depth across the panel: gradient grounds on the wrapper, sidebar, topbar and
  cards, an accent hairline under the topbar, a gradient on the active nav item,
  an accent bar on every section heading, and accent-tinted scrollbars. The glow
  behind the panel follows the chosen theme.

## 0.5.0

### Added

- **Flow panel.** The robbery drawn as columns: what opens the run, then what
  each step unlocks. Colour coded by stage type, and flags anything optional,
  switched off, unplaced or caught in a requirement loop. Click a node to edit
  that stage. It is the only place the branching actually looks like branching.
- **Placement precision.** SPACE pins the point so it stops following your view
  and you can fly around it. **X drops it onto whatever is underneath** using a
  real downward probe, which works indoors — this is the one for putting a ped
  on the floor instead of through it. Z cycles grid snapping (off, 10cm, 25cm,
  50cm, 1m) and CTRL makes nudging ten times finer.
- The ghost now draws a person-high column and a disc on the surface below it,
  so a point buried in the floor or poking through a ceiling is obvious before
  you place it. The header shows whether it is pinned and the grid step.

### Changed

- ALT crawl speed dropped from 2 m/s to 0.8 m/s for close work.

## 0.4.0

### Added

- Eight more things to set per stage: animation flag, a scenario as an
  alternative to a dict and clip, the bone and offset a held prop attaches to,
  circle or bar progress, whether the player is held still, whether the action
  can be cancelled, and how far away it is heard. Heard-from used to be on tool
  stages only and now applies to any of them.
- A Tuning section in Settings. Payout multiplier, splitting payouts across the
  crew, holding payouts until the escape, whether off-duty police may rob,
  writing runs to history, and the abandon timer. They take effect immediately,
  survive a restart, and each says whether it is still following config.lua or
  has been set in the panel.

## 0.3.5

### Changed

- `/robberylist` shows each robbery's crew range and police requirement, so you
  can see the gates that are actually stored rather than the ones you meant to
  store.
- The Editor shows the id of the robbery you are editing next to its name. Two
  robberies can share a name, and editing the wrong one looks exactly like a
  setting that will not save.

## 0.3.4

### Fixed

- The HUD threw on every update. It read `os.time()`, and `os` does not exist
  in the client sandbox, so the objective list errored the moment a run started.
  The server now sends its own clock with the run state, which is also more
  accurate than reading a clock on the client.

## 0.3.3

### Changed

- `/robberylist` also shows how many locations each robbery owns and how many
  of those are switched on, so duplicate definitions are easy to tell apart.

## 0.3.2

### Added

- The boot line now prints the folder the resource is actually running from, so
  a second, older copy somewhere on the server cannot hide.

## 0.3.1

### Added

- `/robberylist` and `/robberylive <id>`, run from the server console. The first
  prints every robbery's stored flag beside the one held in memory and its
  revision. The second switches one on server side, reads the row straight back,
  and says whether the write actually landed - no panel, no NUI, no client in
  the way.

## 0.3.0

### Fixed

- **Nothing could ever be set live.** oxmysql hands a `TINYINT(1)` column back
  as a Lua boolean, not a number, so `row.enabled == 1` was false for every row
  ever loaded. Robberies and locations saved their live flag correctly and then
  read it back as disabled on the next restart, every time. This is why a
  robbery could show Live in the panel, be Live in the database, and still do
  nothing in the world.

  Both read paths now accept a boolean, a number or a string.

## 0.2.9

### Changed

- Saving a robbery, a location or a loot table now goes through `MySQL.query`
  rather than `MySQL.prepare`. Prepare already proved unreliable here once, and
  an upsert whose UPDATE branch quietly does nothing looks exactly like a
  setting that will not stick.
- Settings and stage collectors refuse to run when their fields are not on
  screen. Reading an absent field returned an empty string and a false toggle,
  which could be written over real values.

### Added

- `/robberydebug` prints each robbery's stored `enabled` column beside the
  value held in memory, plus the revision number, and flags any disagreement.
  A revision that never moves means saves are not landing at all.

## 0.2.8

### Fixed

- Setting a robbery Live did not stick. Robbery settings were only read back if
  you were still looking at that view when you pressed Save — click a stage
  first and every change you made there, Live included, was silently dropped.
  Settings are now captured the moment you change them.

### Changed

- Live is a button in the Editor topbar instead of a toggle buried in Robbery
  settings. It shows Draft or Live at a glance and saves on the spot. Two
  switches with the same name in different places was the single biggest way to
  end up with a robbery that looked set up and did nothing.

## 0.2.7

### Added

- `Config.BlockedJobsRespectDuty`. Off duty police and EMS are still blocked by
  default, as before. Set it true and clocking off lets them rob like anyone
  else. Which of those two a server wants is not ours to decide.

### Fixed

- Console output was not ASCII, so the FiveM console printed rows of question
  marks instead of the separators and dashes.
- `/robberydebug` now says whether being off duty would lift a job block, and
  which setting decides it.

## 0.2.6

### Fixed

- Placed points sank through the floor. Ground snap was on by default and used
  terrain height, which ignores interior floors, kerbs and anything raised — so
  a point placed on a counter or a pavement ended up metres below it, out of
  reach of the target. Snap is now off by default (the placement ray already
  lands on the surface you are looking at), and when it is on it refuses any
  snap that would drop the point more than 1.5m through what you aimed at.

### Added

- Interaction reach per stage, under Advanced. Widen it if a point is fiddly to
  aim at. Default is 1.5m, up from 1.2m.

## 0.2.5

### Fixed

- One failed interaction killed every interaction after it. The client asked the
  server to start a stage and waited **forever** for a reply, so a server-side
  error left the request hanging with the busy flag stuck on — every later click
  was silently ignored until the resource restarted. The stage requests now time
  out, say plainly that the server did not answer, and a watchdog releases a
  wedged interaction after 45 seconds.

## 0.2.4

### Changed

- An escape zone is no longer required. Without one, the run finishes the moment
  the last required stage is done and pays on the spot instead of holding a pot.
  Right for an ATM or a vending machine, wrong for a bank — so it is now a
  warning that says which you have built, not an error that blocks saving.

### Added

- `/robberydebug` prints why a robbery is or is not showing up: your job, both
  Live switches, whether the client received the location, whether zones were
  built at your distance, and per stage the distance and the reason it is hidden.

## 0.2.3

### Fixed

- A second player could never join a robbery already in progress. What was
  unlocked at a place was only told to people already in the crew, and the only
  way to join was to interact with something — so once the opening stages were
  done, nobody else could see anything to touch. On Fleeca that made the paired
  release switches impossible to reach, which is the whole point of the bank.
  What is open at a place is now public; the HUD stays crew-only.

## 0.2.2

### Changed

- Item fields are a searchable box instead of a dropdown. Type to filter your
  server's items by name or label, or just type an item name we never detected
   and it is used as typed. A dropdown of a few thousand ox_inventory items was
  unusable, and it could never offer an item added after the panel opened.
- Loot table rows use the same box, so a table can hold any item on the server.
- Both tell you the item's label once it matches, or say plainly that it is not
  in your items list and will be used anyway.

## 0.2.1

### Fixed

- Stamping a location crashed with `table index is nil`. Both places that need
  a new row id back from the database were using `MySQL.prepare`, which does not
  return one — locations and run history now use `MySQL.insert`. Saving a
  location also refuses cleanly now instead of indexing a nil id.

## 0.2.0

Everything below is unreleased. Nothing has been run on a live server yet.

### The builder

- Robberies, Editor, Locations, Loot, Live, History and Settings panels.
- Add Stage steps out of the panel into a freecam so you place the point where
  you are looking, then steps back in with that stage selected. Same flow for
  moving a stage, setting a location origin and drawing an escape zone.
- Stages are a graph. Each one lists what has to be finished first, so a vault
  can need the cameras *or* the power, a code can live in another room, and
  optional stages can just raise the payout.
- Duplicate a stage. The copy keeps every setting and you place it where you
  want — six deposit boxes is six clicks, not six forms.
- Switch a stage off without deleting it. A store can be register-only today and
  register-and-safe tomorrow, and anything that was waiting on the switched-off
  stage carries on without it.
- Validation on save and on demand: unreachable stages, requirement loops, no
  escape zone, empty loot tables, items your inventory does not have, unpaired
  two-man points, keypads reading a code from a stage that never reveals one.
  Click a problem to jump to the stage it is about.
- Import and export any robbery as JSON.

### Playing one

- Twelve stage types: hack, tool, keypad, camera, power box, register, safe,
  loot container, two-man point, hostage, hold point, escape zone.
- Six minigames of our own — signal lock, circuit routing, tumbler, sequence
  recall, frequency match, wire trace — plus ox_lib, ps-ui, memorygame and
  howdy-hackminigame when they are installed.
- Server-authoritative throughout. Every attempt is checked for its token, the
  time it really took, distance, items, prerequisites and cooldowns.
- Loot goes in the bag at the stage; cash goes into a pot that only pays at the
  escape zone, so getting caught on the way out costs the money, not the goods.
- Objective HUD with the alarm state, a clock, and a countdown when the escape
  is on a timer.
- Alarms are audible at the shop to anyone nearby. A silent alarm is silent.

### Placing it

- Stamp a robbery onto as many buildings as you like. Stamping rotates the
  design onto each site rather than sliding it, so a shop that faces another way
  still gets its safe in the back room.
- Move origin aims a whole site; Nudge moves one stage at one site; Reset puts
  it back.
- Coordinates can be typed, or pasted whole — `vector4(x, y, z, h)`, a bare
  `x, y, z`, or space separated. Paste into any box and the row fills itself.
- Per-location overrides for payout multiplier, radius, police required and
  cooldown, and a per-location switch for each stage — a custom interior with no
  back room drops the safe without touching anywhere else.

### Owner control

- Live shows every run as it happens. End one, or ban someone from inside it.
- A kill switch that survives a restart, and a ban list you can lift from.
- Everything a player reads lives in `Config.Text`.
- Props, held props and animations are per stage and yours to choose.

### Standalone

- Framework, inventory, target and dispatch all auto-detect. Dispatch falls back
  to a notification and a blip, and interaction falls back to a marker and a key
  prompt, so neither a dispatch nor a target resource is required.
- No Cipher script is needed for anything. cipher-mdt and cipher-dispatch are
  two names in lists that also hold everyone else's.
- MDT is a provider registry: cipher-mdt out of the box, any other through
  `Config.Integrations.Generic` or the `RegisterMdtProvider` export.
- `tools/check-standalone.mjs` fails the build if anything outside a bridge ever
  reaches for another Cipher resource by name.

### Ships empty

Nothing is bundled — no robberies, no coordinates, no items. Anything shipped
would be a map and an item list somebody has to undo first, and the whole point
is that what your server has is what you built.

### Known gaps

- None of it has been run inside FiveM yet.
