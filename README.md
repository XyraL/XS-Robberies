# XS-Robberies

Build any robbery you want, in game, without touching a config file.

Stores, banks, jewelry, houses, custom MLOs — you place the points, set what each
one needs, and decide what it pays.

It ships **empty**. No stores of ours to delete, no coordinates from someone
else's map, no items you have to add before anything works. Every robbery on your
server is one you built.

Standalone for QBox and QBCore.



## Door locks

A **Door** stage opens a door in your door lock resource as part of a run. It
auto-detects `ox_doorlock`, `qb-doorlock`, `nui_doorlock` and `jd_doorlock`;
Settings tells you which one it found. Put the door id in exactly as your door
lock resource names it, and choose whether the door goes back to how it was
when the run ends.

Running something else? Register it yourself:

```lua
exports['XS-Robberies']:RegisterDoorProvider('my-doors', {
    available = function() return GetResourceState('my-doors') == 'started' end,
    setState = function(id, locked) exports['my-doors']:setLock(id, locked) end,
})
```

## Guards, lasers and consequences

- **Armed guards** are a stage with nothing to press. Set the model, weapon,
  accuracy, health and armour; the stage completes when they go down. Leave
  *Starts hostile* off and they ignore you until the alarm goes, which is what
  makes a quiet approach worth doing.
- **Laser grids** draw beams across a doorway and trip the alarm if anybody
  walks through. Make the power box a requirement and cutting power kills them.
- **Failure penalties** let any stage answer a botched attempt with a shock,
  fire, gas or an explosion.
- **Item loss** sets the odds that failing destroys the tool being used.

## Presets

Open **Robberies -> Presets**. Six ship with it, and all of them arrive switched
off with their loot tables so you can read every stage before anyone can rob it.

| Preset | Stages | Where |
|---|---|---|
| ATM | 1 | Anchored to the ATM prop models. Finds every machine itself. |
| 24-7 Store | 6 | Twenty shop fronts bundled |
| Fleeca Bank | 11 | All six Fleecas bundled |
| Vangelico Jewelry | 6 | One site. Pays in goods only, no cash. |
| Blaine County Savings | 9 | Paleto Bay |
| Pacific Standard | 12 | Vinewood Boulevard |

Each card names any item your server does not have, so you can add it or point
the stage at something you do have before installing.

The bundled coordinates are a starting grid and have not been checked in game.
Walk each site and use **Move origin** to line it up; everything rotates with it.

## Robberies that find their own spots

A robbery is normally anchored to locations you stamp by hand. Set **Anchor** to
**Prop models** in Robbery settings instead, list the models, and every matching
prop in the map becomes its own robbery with nothing to place. That is how the
ATM preset covers the whole state from one design.

Stage positions are stored as offsets from wherever you built them, and they
rotate with each prop, so a stage placed on the front of one ATM lands on the
front of all of them.

## It does not need another Cipher script

Nothing here depends on anything else we make. Every outside system goes through
a bridge that detects what you already run, and every bridge has a way out if it
finds nothing:

| | Detected |
|---|---|
| Framework | qbx_core, qb-core |
| Inventory | ox_inventory, qb-inventory, qs-inventory, codem-inventory, core_inventory, ps-inventory |
| Target | ox_target, qb-target — with neither, a built-in marker and key prompt is used instead |
| Dispatch | XS-Dispatch, ps-dispatch, qs-dispatch, cd_dispatch, core_dispatch, rcore_dispatch, origen_police — or any other through `Config.Integrations.GenericDispatch`. With none of them, police get a notification and a blip. |
| MDT | XS-MDT, or any other through `Config.Integrations.Generic`, or one registered by another resource. With none, no paperwork is filed and nothing complains. |
| Minigames | Six of our own that need nothing, plus ox_lib, ps-ui, memorygame and howdy-hackminigame when present |

Cipher resources appear in those lists because they exist, not because they are
required. `node tools/check-standalone.mjs` fails the build if anything outside
a bridge ever reaches for one by name.

**Adding an MDT we have never heard of**, without touching our code:

```lua
Config.Integrations.Generic = {
    resource     = 'your-mdt',
    createExport = 'CreateIncident',
    noteExport   = 'AddNote',       -- optional
}
```

Or register one properly from your own resource:

```lua
exports['XS-Robberies']:RegisterMdtProvider('your-mdt', {
    available      = function() return GetResourceState('your-mdt') == 'started' end,
    createIncident = function(data) return yourCreate(data) end,
    attachNote     = function(handle, text) return yourNote(handle, text) end,
})
```

## Requirements

- `ox_lib`
- `oxmysql`
- Any of: `ox_inventory`, `qb-inventory`, `qs-inventory`, `codem-inventory`, `core_inventory`, `ps-inventory`

That is the whole list. `ox_target` or `qb-target` are used if you have one;
without either, interaction falls back to a marker and a key prompt.

Optional: `XS-Dispatch`, `ps-dispatch`, `qs-dispatch`, `cd_dispatch`, `core_dispatch`
(a plain notification is used when none are present), and any supported minigame
resource you want offered in the builder.

## Install

1. Drop the folder in your resources.
2. Import `sql/xs_robberies.sql`.
3. Add `ensure XS-Robberies` after `ox_lib` and `oxmysql`.
4. Give yourself access — `add_ace group.admin xs.robberies allow`, or list
   your framework groups in `Config.Admin`.
5. In game, `/robberies`.

## Building your first one

There is nothing in it. That is on purpose — no stores you have to delete, no
coordinates from someone else's map, no items you have to add before anything
works. What you build is what your server has.

1. `/robberies` → **New robbery**. Name it, pick a category.
2. **Add Stage** → pick a type. The panel steps aside, you fly to the spot and
   drop the point.
3. Keep going. A till, a safe, a camera, a way out. Five stages is a shop;
   eleven is a bank.
4. Set what each one needs — an item, a minigame, how long, what it pays.
5. **Validate**, then flip it **Live** and save.
6. **Locations → Stamp a location** and place it in the world. Stamp it again
   anywhere else the same building shape exists.

Items come from your own inventory — the picker lists whatever your server
already has, so nothing needs adding first.

## How it works

A **robbery** is a set of **stages**. A stage is a point you place in the world
with a type — hack, drill, keypad, camera, power box, register, safe, container,
two-man point, hostage, hold point, escape zone — and its own options, payout and
requirements.

Requirements are what make it more than a checklist. By default each stage waits
on the one before it, so you get a straight sequence. Open **Requirements** on a
stage and you can wire it differently: make the safe need the cameras *or* the
power cut, hide a keypad code in another room, add optional stages that only
raise the payout.

Nothing is placed from chat. Everything happens in the builder: click Add Stage,
pick a type, and the panel steps aside so you can fly to the spot and drop the
point. Confirm and you are back in the panel with that stage selected.

## What a run looks like

A run starts the moment someone works the first stage that has no requirements,
and it belongs to the location, not the player — anyone who joins in is part of
the same crew.

- The alarm follows what you set. Disabling cameras or cutting power re-routes it.
- Loot items go into the bag at the stage. Cash goes into a pot that only pays
  when the crew reaches the escape zone, so getting caught on the way out costs
  them the money but not the goods.
- Registers and safes restock on their own timer, and remember it across restarts.
- A run nobody is near ends itself, and the location goes on cooldown either way.
- Everything the client reports is checked: the stage token, the time it actually
  took, the distance, the items, the prerequisites, and the cooldowns.

## Locations

A robbery on its own is a template. Stamp it onto a location and it exists in the
world. Stamp the same one onto twenty stores and they all behave the same way,
with per-site overrides where you want them different.

## What you can change

There is no hidden layer. Everything below is a field in the builder, and there is
nothing a robbery can do that you cannot reach.

**Per robbery**, in the Editor under Robbery settings:
name, category, live or not, radius, blip sprite, colour, scale, name and when
it shows, police required and whether they must be on duty, minimum and maximum
crew, location cooldown, player cooldown, a server-wide cooldown across every
site of that robbery, and a proximity rule that stops a crew running a whole
street at once.

Police response is its own set: alarm instant, delayed, silent or none; the delay;
what disabling cameras changes it to; what cutting power changes it to; the
dispatch code and title; how often it re-alerts; and whether a botched stage
calls it in.

**Per stage**, starting with whether it exists at all — every stage has an on/off
switch, so the same store can be register-only on one server and a full
cameras-clerk-register-safe job on another without deleting anything. Turn one
off and whatever was waiting on it carries on without it. Then: name, how long it
takes, which item it needs and whether that is
consumed or just worn down, optional or required, whether it alerts police,
difficulty, what happens on failure, its minigame and how many attempts, the
payout account, range and loot table, and which other stages have to be finished
first.

Plus the things that make it yours rather than ours:

- **Prop model** — spawn any object at the point and target that instead of an
  invisible marker. A safe, a till, a laptop, a fuse box.
- **Prop height** — nudge it up or down to sit on a counter.
- **Held prop** — put a model in their hand while they work. A drill, a crowbar.
- **Animation dict and clip** — any animation you like. Leave them empty and the
  stage type picks a sensible one.

**Per location**, in Locations: label, live or not, and overrides for payout
multiplier, radius, police required and cooldown. Empty means follow the
robbery.

**Per server**, in `config.lua`: which bridges to force, who can open the
builder, the blocked jobs, the payout accounts and what dirty cash and bags are
called, a global payout multiplier, whether crews split or each get paid, when a
run is abandoned, how long one can last, logging and a Discord webhook, and which
minigame backends to offer.

**Every line a player reads** lives in `Config.Text`. Rewrite them in your own
voice or another language — keep the `%d` and `%s` where they are and the
script fills them in.

## Tuning one location

Open a location from the Locations panel and you get everything that is specific
to that site: its label, whether it is live, and a set of override boxes. Leave a
box empty and it follows the robbery. Fill one in — payout multiplier, radius,
police required, cooldown — and only that location changes.

Below that is every stage as it really sits in the world at that site. Nudge any
that do not line up with that interior and only this location moves; the design
and every other location stay where they were. Reset puts one back.

## Staff controls

**Live** shows every run happening right now — where, how far in, how loud, who
is inside, and what the pot is worth. Two things you can do from there:

- **End it.** Everyone inside is told it is over. They keep whatever is already
  in their pockets; the pot is lost.
- **Ban someone.** Click their name. They cannot start or join a robbery until
  you lift it.

**Settings** has the kill switch — no robbery can be started while it is on, and
runs already going are left to finish. It survives a restart. Bans are listed
there too, with a button to lift each one.

## Police paperwork

With an MDT connected, an alarm files its own incident, the way a monitoring
company would phone one in — title, location, time, and a narrative saying nobody
has been identified from the alarm alone. When the run ends, a closing note goes
on the same incident with the outcome and who was seen at the scene.

Officers get a case to work rather than a blip that disappears. Both halves are
switches in `Config.Integrations`, and with no MDT at all nothing happens and
nothing complains.

XS-MDT works out of the box. Any other MDT connects through
`Config.Integrations.Generic` or the `RegisterMdtProvider` export — see the top
of this file.


## Hooking your own systems in

The script does not ship levelling, achievements or its own logging, because
every server wants those a different way. It fires events instead, and you build
what you want on top.

```lua
AddEventHandler('XS-Robberies:runStarted', function(data)
    -- robberyId, locationId, label, coords, startedBy (citizenid), source
end)

AddEventHandler('XS-Robberies:stageCompleted', function(data)
    -- robberyId, locationId, stageId, stageType, citizenid, source, paid
    -- This is the one to hang XP off. It fires per stage, for the person who
    -- did it, and tells you what kind of stage it was.
end)

AddEventHandler('XS-Robberies:runEnded', function(data)
    -- robberyId, locationId, label, outcome, payout, participants, seconds
    -- outcome is completed, failed or abandoned.
end)
```

There are read-only exports too:

```lua
exports['XS-Robberies']:GetActiveRuns()        -- what is happening now
exports['XS-Robberies']:IsRunActive(locationId)
exports['XS-Robberies']:IsBlacklisted(citizenid)
exports['XS-Robberies']:GetRobberies()         -- every definition
```

## Sharing

Every robbery exports to JSON and imports back. Imported ones arrive disabled so
nothing goes live before you have looked at it.

That is also how a robbery travels between servers — build one, export it, and
anyone can paste it in. Nothing about it is tied to our map or our items.

## Config

`config.lua` holds only what applies to the whole resource — bridges, who can
open the builder, payout accounts, run limits, which minigame backends to offer.
Everything about an individual robbery lives in the database and is edited in
game.

PD and EMS can never start or progress a robbery. That is not a setting.
