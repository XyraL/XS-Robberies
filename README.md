# XS-Robberies

Build any robbery you want, in game. Stores, ATMs, banks, jewelry stores, houses,
armoured trucks, your own MLOs. You place every point yourself, decide what each
one needs and what it pays, then stamp the job anywhere it should work.

It ships empty. No presets, no coordinates from someone else's map, no items to
add before it works. Every robbery on your server is one you built.

QBox and QBCore.

## What you get

- **A guided setup.** Pick Store, ATM, Bank, Jewelry, House or Vehicle and it
  walks you through the job in game: stand at the till, press ENTER, next point.
  Skip anything you do not want. Or start blank and add exactly the steps you want.
- **15 kinds of step.** Hack, tool (lockpick, drill, thermite, grinder, torch,
  crowbar), keypad, cameras, power box, till, safe, loot container, two-man
  switch, clerk, hold point, door, armed guard, laser grid, getaway zone.
- **Build it your way.** A bank can be a keypad and a vault and nothing else. The
  getaway is optional, and only a job that cannot work at all is kept from going live.
- **Steps unlock each other.** By default it is a straight line, and players only
  see the step they can do next. Change what opens what and you get parallel
  paths, a code found in one room for a keypad in another, or a keypad they have
  to crack, and optional steps that only add to the take.
- **Doors.** Aim at a door and any step can unlock it, lock it, or swing a vault
  door open when it is done. It all goes back when the place resets.
- **Contacts.** Put a ped somewhere who has to be talked to before a job opens.
  They can charge a fee, want an item, and send the player to the nearest place
  or a random one.
- **Armoured trucks.** Talking to the contact sends a truck out on the road with
  your guards riding inside. Stop it, deal with the guards, then blow the doors
  and take the cargo. Let it reach its drop-off and it got away. Needs OneSync.
- **Lootable props.** Place a gold trolley and make it lootable. It pays cash,
  any items, or a loot table.
- **A plan of the job.** Every point drawn to scale around the anchor, with the
  way each one faces and the distances between them. A flow view shows the order
  and when the alarm goes.
- **Props.** Cash trolleys, gold stacks, a laptop on a desk. Tie one to a step and
  it disappears or swaps (full trolley to empty) when that step is done, then
  comes back when the place resets.
- **NPCs.** Tellers, a guard by the door, customers. Pick the ped, what they are
  doing, and whether they put their hands up or run when the robbery starts.
- **Payouts your way.** Each job pays as cash, dirty money or bank, and any step
  can pay differently. Set the least and most, add items with their own odds, or
  point at a shared loot table. Choose whether the cash goes to whoever did the
  step or is split across the crew, and whether it pays on the spot (the default)
  or at the getaway.
- **Stamp it anywhere.** Build a 24/7 once and place it at every 24/7. You line up
  the anchor and the whole job turns with it. Each place can nudge single points,
  switch steps off, or set its own payout, police and cooldown.
- **Jobs that find their own spots.** Aim at an ATM and every ATM with that model
  becomes the job. Same for vehicles. Give a job areas and ATMs in different parts
  of the map can be different jobs.
- **Cooldowns that make sense.** A robber's wait covers one type of job, so after a
  bank they can still do a store. Or just that job, or every robbery.
- **The alarm is yours.** Instant, delayed, silent or none. Cutting the cameras or
  the power can change it. Steps can call the police, failed steps can too, and the
  call repeats on a timer while the job is running.
- **Minigames.** 53 to pick from: 12 of our own plus the minigame resources people
  already run (list below). Every step picks its own and how hard it is. Try any
  of them from the builder.
- **Live control.** See every robbery happening right now, end one, ban someone
  from robberies, or switch them all off. Players can call off their own job, and
  a job nobody is working ends itself.

## Install

1. Drop the folder in your resources.
2. `ensure XS-Robberies` after `ox_lib` and `oxmysql`.
3. Give yourself access: `add_ace group.admin xs.robberies allow`, or list your
   framework groups or licenses in `Config.Admin`.
4. In game, `/robberies`.

The database tables are created on first start. `sql/xs_robberies.sql` is there if
you would rather import them yourself.

Coming from Cipher-Robberies? Your old tables are renamed in place on first start
and every robbery comes with them.

## Building your first job

1. `/robberies`, then **New job**. Name it and pick what it is.
2. Leave **Walk me through it** on and press Create. The builder hides and asks for
   each point in turn. ENTER places it, BACKSPACE skips it, DEL stops.
3. Back in the builder, open each step on the right to set what it needs: an item,
   a minigame, how long it takes, what happens on a failure.
4. **Loot**: set how the job pays and what each step is worth.
5. **Places**: add every other location it should exist at.
6. Press **Live** and save.

Nothing is placed from chat. Every point is placed in the world with a freecam:
WASD to fly, SPACE to pin, X to drop to the floor, the scroll wheel to turn it, the
arrow keys to nudge.

## Integrations

Everything outside the script goes through a bridge that finds what you already run.

| | Supported |
|---|---|
| Framework | qbx_core, qb-core |
| Inventory | ox_inventory, qb-inventory, qs-inventory, codem-inventory, core_inventory, ps-inventory |
| Target | ox_target, qb-target. With neither, a marker and a key prompt. |
| Dispatch | ps-dispatch, qs-dispatch, cd_dispatch, core_dispatch, rcore_dispatch, linden_outlawalert, XS-Dispatch, or any export through `Config.Integrations.GenericDispatch`. With none, police get a notification and a blip. |
| Door locks | ox_doorlock, mri_Qdoorlock, qb-doorlock, rcore_doorlock, Quasar Doorlock Creator, jaksam's Doors Creator, cd_doorlock, or your own through `RegisterDoorProvider`. With none, the game opens doors itself. |
| MDT | XS-MDT, or any other through `Config.Integrations.Generic` or `RegisterMdtProvider`. Optional. |
| Minigames | 12 built in, plus ox_lib, ps-ui (or ps_lib), bl_ui, qb-minigames, glow_minigames, utk_fingerprint, ultra-voltlab, mhacking, SN-Hacking, boii_minigames, memorygame and howdy-hackminigame. 53 in all, each with an easy, normal and hard setting. |

None of them are required apart from a framework and an inventory.

## Items

There is no item list to install. Tools and loot are picked in the builder from
whatever your inventory already has.

Two items are set in `config.lua` because the script uses them itself:

| Setting | Default | What it is |
|---|---|---|
| `Config.Payout.DirtyItem` | `markedbills` | What dirty money pays in. `DirtyMode` sets whether the amount is stored on one item (QBCore/Qbox markedbills) or paid as a stack. |
| `Config.Run.BagItem` | `bag` | What a loot container asks for when it needs a bag. Any step can pick its own. |

A `markedbills.png` ships in `inventory_images/` in case you need one.

## Commands

| Command | Who | What |
|---|---|---|
| `/robberies` | admins | Opens the builder |
| `/robberylist` | admins, console | Every job with its crew, police and places |
| `/robberylive <id>` | admins, console | Switches a job live from chat or the console |
| `/cancelrobbery` | players | Calls off the job they are on. The name is `Config.Run.CancelCommand`. |

## Hooking your own systems in

Server events, with everything you need to build levelling, achievements or logs
on top:

```lua
AddEventHandler('XS-Robberies:runStarted', function(data)
    -- robberyId, locationId, label, coords, startedBy (citizenid), source
end)

AddEventHandler('XS-Robberies:stageCompleted', function(data)
    -- robberyId, locationId, stageId, stageType, citizenid, source, paid
end)

AddEventHandler('XS-Robberies:runEnded', function(data)
    -- robberyId, locationId, label, outcome, payout, participants, seconds
end)
```

Exports:

```lua
exports['XS-Robberies']:GetActiveRuns()
exports['XS-Robberies']:IsRunActive(locationId)
exports['XS-Robberies']:IsBlacklisted(citizenid)
exports['XS-Robberies']:GetRobberies()
exports['XS-Robberies']:RegisterDoorProvider(name, provider)
exports['XS-Robberies']:RegisterMdtProvider(name, provider)
```

## Sharing jobs

Every job exports from **Rules** and imports from the button next to New job.
Imported jobs arrive as drafts so nothing goes live before you have looked at it.
Nothing in a job is tied to our map, so one built on your server works on anyone's.

## Config

`config.lua` only holds what applies to the whole server: bridges, who can open the
builder, the jobs that can never rob, payout types, run limits, sounds, minigame
backends, and every line a player reads (`Config.Text`). Everything about a single
job lives in the database and is changed in game.

Police and EMS can never start or work a robbery. Whether going off duty lifts
that is `Config.BlockedJobsRespectDuty`.

## Support

[Discord](https://discord.gg/XRURAw4TM2)
