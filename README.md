# XS-Robberies

Build any robbery you want, in game. Stores, ATMs, banks, jewelry stores, houses,
armoured trucks, your own MLOs. You place every point yourself, decide what each
one needs and what it pays, then stamp the job anywhere it should work.

Robberies ship empty. No presets, no coordinates from someone else's map, no items
to add before it works. Every robbery on your server is one you built.

Petty crime is the other half: pickpocketing, mugging, car break-ins, payphones,
copper theft and the rest. Most of it works the moment you start the script, and every
part of it can be changed in the builder.

QBox and QBCore.

This is a beta. Everything is in and working, but it has not been through many
servers yet. If something breaks or feels wrong, tell me on Discord.

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
- **Minigames.** 73 to pick from. New steps and crimes use
  [MGC Minigames](https://github.com/boiidevelopment/mgc) (free, 20 games). Without
  mgc, each of those plays the closest of our own 12 instead, so nothing breaks.
  The minigame resources people already run are there too (list below). Every
  step picks its own and how hard it is. Try any of them from the builder.
- **Live control.** See every robbery happening right now, end one, ban someone
  from robberies, or switch them all off. Players can call off their own job, and
  a job nobody is working ends itself.
- **Petty crime.** 17 small crimes that need no job: pickpocketing, purse
  snatching, mugging, smash and grab, catalytic converters, wheels, mailboxes,
  vending machines, parking meters, payphones, newspaper boxes, copper from
  electrical boxes and AC units, porch packages, tip jars, shoplifting and grabbing
  the till. Thirteen of them work everywhere the moment you start the script.

## Install

1. Drop the folder in your resources.
2. `ensure XS-Robberies` after `ox_lib` and `oxmysql`. For the MGC minigames, add
   [mgc](https://github.com/boiidevelopment/mgc) and `ensure mgc` too.
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

## Petty crime

`/robberies`, then **Petty crime** under Server. Every crime has its own card. Click
one to change anything about it, flip the switch to turn it on or off.

| Crime | How it works | On out of the box |
|---|---|---|
| Pickpocket | Walk up to someone on the street. They might feel it. | Yes |
| Purse snatch | Grab the bag and run. Some chase you. | Yes |
| Mugging | Aim a gun at someone and press E. Some refuse and fight. | Yes |
| Smash and grab | Put a window in on a parked car. The alarm might go. | Yes |
| Catalytic converter | Lie under a parked car with an angle grinder. | Yes, needs `angle_grinder` |
| Wheel theft | Take the wheels off a parked car with a wrench. | Yes, needs a wrench |
| Mailboxes | Any street or house mailbox. | Yes |
| Vending machines | Any vending machine, with a lockpick. | Yes |
| Parking meters | Any parking meter, with a lockpick. | Yes |
| Payphones | Pry the coin box off any payphone with a crowbar. | Yes, needs a crowbar |
| Newspaper boxes | Jimmy any newspaper box for the change. | Yes |
| Electrical boxes | Strip the copper out of a street electrical box. It can shock you. | Yes |
| AC units | Pull the copper coil out of an air conditioning unit with a wrench. It can shock you. | Yes, needs a wrench |
| Porch packages | A box on every doorstep you place. | Once you place spots |
| Tip jars | Every counter you place. | Once you place spots |
| Shoplifting | Shelves you place. Only works while the clerk looks away. | Once you place spots |
| Grab the till | Tills you place. Only works while the clerk looks away. | Once you place spots |

Each crime sets its own:

- What it takes: an item, whether it gets used up or can break, how long, a minigame, the animation.
- Who or what it hits: men, women or anyone, which peds are left alone, which car classes, which prop models.
- What it pays: cash, dirty money or bank, items with their own odds, or a loot table.
- Getting caught: the odds police are called and how long it takes, witnesses calling it in, car alarms, the victim noticing, fighting back or refusing, and the odds of a shock on the copper crimes.
- Limits: how long before the same person, car or spot can be hit again, how long a robber waits, and how many police have to be online.

**Placing spots.** Open Porch packages, Tip jars, Shoplifting or Grab the till and
press Place a spot. It uses the same freecam as the builder. Taken spots come back
when their cooldown runs out.

**Shop clerks.** Shoplifting and the till only work while the clerk looks away. If
they look back before it is done, they saw it. Spots with the same shop name share
one clerk. Under Shop clerks you set how long they watch and look away, and you can
place a clerk behind the counter who turns to their phone when they stop watching.
Players near a shelf or till see which it is on their screen.

**Minigames.** New steps and crimes start on MGC Minigames. Install
[mgc](https://github.com/boiidevelopment/mgc) and `ensure mgc`. Without it, each
MGC game plays the closest built-in game instead, and the builder says which. Already built jobs keep the games they have. **Switch saved steps to
MGC** in Settings moves every step and crime that uses a built-in game, the ox_lib
skill check or a boii_minigames game over to MGC in one go.

**Things to open.** Stolen wallets, bags and packages go in the pocket closed. Using
one opens it and pays what is inside. Set what each one holds under Things to open.

Three switches in **Settings** cover all of it: petty crime on or off, whether it
can call the police, and a payout multiplier. Police and EMS can never do it, and
the kill switch and robbery bans cover it too.

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
| Minigames | mgc (MGC Minigames) is the default. Also 12 built in, plus ox_lib, ps-ui (or ps_lib), bl_ui, qb-minigames, glow_minigames, utk_fingerprint, ultra-voltlab, mhacking, SN-Hacking, boii_minigames, memorygame and howdy-hackminigame. 73 in all, each with an easy, normal and hard setting. |

None of them are required apart from a framework and an inventory.

## Items

Robberies need no items of their own. Tools and loot are picked in the builder from
whatever your inventory already has.

Petty crime uses six. Add them to your inventory and copy the pictures from
`inventory_images/` into your inventory's image folder.

| Item | What it is |
|---|---|
| `stolen_wallet` | From pickpocketing and mugging. Use it to open it. |
| `stolen_purse` | From purse snatching and car break-ins. Use it to open it. |
| `stolen_package` | From porch packages and mailboxes. Use it to open it. |
| `catalytic_converter` | From under a car. For your scrap or chop shop to buy. |
| `stolen_wheel` | Off a parked car. For your chop shop to buy. |
| `angle_grinder` | The tool for catalytic converters. Sell it in a hardware store. |

The wheel crime and AC units ask for a wrench: `WEAPON_WRENCH` on ox_inventory,
`weapon_wrench` on qb-core. Payphones ask for a crowbar: `WEAPON_CROWBAR` or
`weapon_crowbar`. Vending machines and parking meters ask for a `lockpick`. The
copper crimes pay in `copper`, which qb-core's recycling items already have, or
`metalscrap` if that is what your inventory has. Change any of them in the builder.

ox_inventory and Qbox, in `ox_inventory/data/items.lua`:

```lua
['stolen_wallet'] = { label = 'Stolen Wallet', weight = 100, close = true, client = { export = 'XS-Robberies.openStolen' } },
['stolen_purse'] = { label = 'Stolen Purse', weight = 400, close = true, client = { export = 'XS-Robberies.openStolen' } },
['stolen_package'] = { label = 'Stolen Package', weight = 1500, close = true, client = { export = 'XS-Robberies.openStolen' } },
['catalytic_converter'] = { label = 'Catalytic Converter', weight = 4000 },
['stolen_wheel'] = { label = 'Stolen Wheel', weight = 9000 },
['angle_grinder'] = { label = 'Angle Grinder', weight = 2500, stack = false },
```

qb-core, in `qb-core/shared/items.lua`:

```lua
stolen_wallet = { name = 'stolen_wallet', label = 'Stolen Wallet', weight = 100, type = 'item', image = 'stolen_wallet.png', unique = false, useable = true, shouldClose = true, description = 'Not yours. See what is inside.' },
stolen_purse = { name = 'stolen_purse', label = 'Stolen Purse', weight = 400, type = 'item', image = 'stolen_purse.png', unique = false, useable = true, shouldClose = true, description = 'Not yours. See what is inside.' },
stolen_package = { name = 'stolen_package', label = 'Stolen Package', weight = 1500, type = 'item', image = 'stolen_package.png', unique = false, useable = true, shouldClose = true, description = 'Somebody is waiting for this.' },
catalytic_converter = { name = 'catalytic_converter', label = 'Catalytic Converter', weight = 4000, type = 'item', image = 'catalytic_converter.png', unique = false, useable = false, shouldClose = false, description = 'Worth something to the right buyer.' },
stolen_wheel = { name = 'stolen_wheel', label = 'Stolen Wheel', weight = 9000, type = 'item', image = 'stolen_wheel.png', unique = false, useable = false, shouldClose = false, description = 'Still has the tyre on.' },
angle_grinder = { name = 'angle_grinder', label = 'Angle Grinder', weight = 2500, type = 'item', image = 'angle_grinder.png', unique = true, useable = false, shouldClose = false, description = 'Cuts through anything.' },
```

On qb-core and the other inventories the open-on-use is hooked up for you.

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

AddEventHandler('XS-Robberies:pettyCrime', function(data)
    -- kind, citizenid, source, paid, account, coords
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
builder, the jobs that can never rob, payout types, run limits, the petty crime
switches, sounds, minigame backends, and every line a player reads (`Config.Text`).
Everything about a single job or crime lives in the database and is changed in game.

Police and EMS can never start or work a robbery. Whether going off duty lifts
that is `Config.BlockedJobsRespectDuty`.

## Support

[Discord](https://discord.gg/XRURAw4TM2)
