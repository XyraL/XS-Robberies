Stages = { types = {}, order = {} }

local function define(id, def)
    def.id = id
    Stages.types[id] = def
    Stages.order[#Stages.order + 1] = id
end

Stages.commonFields = {
    { key = 'label',        label = 'Name',            type = 'text',   default = '' },
    { key = 'duration',     label = 'Duration',        type = 'number', default = 10, min = 1, max = 900, unit = 's' },
    { key = 'requiredItem', label = 'Required item',   type = 'item',   default = '' },
    { key = 'consumeItem',  label = 'Consume it',      type = 'toggle', default = false },
    { key = 'itemDamage',   label = 'Item wear',       type = 'number', default = 0, min = 0, max = 100, unit = '%', advanced = true },
    { key = 'optional',     label = 'Optional stage',  type = 'toggle', default = false, advanced = true },
    { key = 'reach',        label = 'Interaction reach', type = 'number', default = 1.5, min = 0.5, max = 6,
      unit = 'm', advanced = true, hint = 'How close you must be to see the prompt. Widen it if a point is fiddly to aim at.' },
    { key = 'notifyPolice', label = 'Alert police',    type = 'toggle', default = false, advanced = true },
    { key = 'prop',         label = 'Prop model',      type = 'text',   default = '', advanced = true,
      hint = 'Spawned at the point and used as the thing you target. Leave empty for an invisible marker.' },
    { key = 'propZ',        label = 'Prop height',     type = 'number', default = 0, min = -5, max = 5, unit = 'm', advanced = true },
    { key = 'handProp',     label = 'Held prop',       type = 'text',   default = '', advanced = true,
      hint = 'Put in their right hand while they work. A drill, a crowbar, a laptop.' },
    { key = 'animDict',     label = 'Animation dict',  type = 'text',   default = '', advanced = true,
      hint = 'Leave both empty to use the one that fits the stage type.' },
    { key = 'animClip',     label = 'Animation clip',  type = 'text',   default = '', advanced = true },
    { key = 'animFlag',     label = 'Animation flag',  type = 'number', default = 16, min = 0, max = 63, advanced = true,
      hint = '16 plays it once and holds. 1 loops. 49 loops on the upper body only, so they can still walk.' },
    { key = 'scenario',     label = 'Scenario',        type = 'text',   default = '', advanced = true,
      hint = 'Used instead of a dict and clip. WORLD_HUMAN_WELDING, WORLD_HUMAN_HAMMERING, PROP_HUMAN_PARKING_METER.' },
    { key = 'handBone',     label = 'Held prop bone',  type = 'number', default = 57005, min = 0, max = 65535, advanced = true,
      hint = '57005 is the right hand, 18905 the left, 28422 the head.' },
    { key = 'handOffset',   label = 'Held prop offset', type = 'text',  default = '', advanced = true,
      hint = 'x,y,z and optionally three rotations. Empty uses a sensible default for a hand.' },
    { key = 'progressStyle', label = 'Progress style', type = 'select', default = 'circle', advanced = true,
      options = {
          { value = 'circle', label = 'Circle' },
          { value = 'bar',    label = 'Bar' },
      } },
    { key = 'freezePlayer', label = 'Hold them still', type = 'toggle', default = true, advanced = true,
      hint = 'Off lets them walk around while the timer runs.' },
    { key = 'canCancel',    label = 'Can be cancelled', type = 'toggle', default = true, advanced = true },
    { key = 'loudness',     label = 'Heard from',      type = 'number', default = 0, min = 0, max = 300, unit = 'm', advanced = true,
      hint = 'Anyone this close who is not in the crew is told they hear something. 0 for silent.' },
    { key = 'difficulty',   label = 'Difficulty',      type = 'select', default = '2', advanced = true,
      options = {
          { value = '1', label = 'Easy' },
          { value = '2', label = 'Normal' },
          { value = '3', label = 'Hard' },
      } },
    { key = 'penalty',      label = 'Punish a failure with', type = 'select', default = 'none', advanced = true,
      hint = 'What happens to them when they get it wrong, on top of whatever On failure does.',
      options = {
          { value = 'none',        label = 'Nothing' },
          { value = 'shock',       label = 'Electric shock' },
          { value = 'fire',        label = 'Set them alight' },
          { value = 'gas',         label = 'Gas cloud' },
          { value = 'explosion',   label = 'Explosion' },
      } },
    { key = 'loseItemChance', label = 'Chance to lose the item', type = 'number', default = 0, min = 0, max = 100,
      unit = '%', advanced = true, hint = 'On a failure, the odds the tool they used is destroyed.' },
    { key = 'onFail',       label = 'On failure',      type = 'select', default = 'retry', advanced = true,
      options = {
          { value = 'retry',    label = 'Let them retry' },
          { value = 'escalate', label = 'Escalate response' },
          { value = 'fail',     label = 'Fail the run' },
      } },
}

local MARKER = {
    entry   = { 25, 229, 140 },
    tool    = { 245, 165, 36 },
    puzzle  = { 76, 154, 255 },
    loot    = { 48, 209, 88 },
    people  = { 255, 90, 95 },
    control = { 168, 130, 255 },
}

define('hack', {
    label = 'Hack',
    group = 'puzzle',
    icon = 'terminal',
    colour = MARKER.puzzle,
    blurb = 'A minigame point. Terminals, alarm panels, security consoles.',
    fields = {
        { key = 'minigame', label = 'Minigame',  type = 'minigame', default = 'xs:signal_lock' },
        { key = 'attempts', label = 'Attempts',  type = 'number', default = 3, min = 1, max = 10 },
        { key = 'revealCode', label = 'Reveals a code', type = 'number', default = 0, min = 0, max = 8,
          advanced = true, hint = 'How many digits. 0 for none. A keypad elsewhere can ask for it.' },
    },
})

define('tool', {
    label = 'Tool action',
    group = 'tool',
    icon = 'screwdriver-wrench',
    colour = MARKER.tool,
    blurb = 'A timed action gated on an item. Lockpick, drill, thermite, grinder, torch.',
    fields = {
        { key = 'toolKind', label = 'Tool', type = 'select', default = 'drill',
          options = {
              { value = 'lockpick', label = 'Lockpick' },
              { value = 'drill',    label = 'Drill' },
              { value = 'thermite', label = 'Thermite' },
              { value = 'grinder',  label = 'Angle grinder' },
              { value = 'torch',    label = 'Cutting torch' },
              { value = 'crowbar',  label = 'Crowbar' },
          } },
        { key = 'minigame', label = 'Skill check', type = 'minigame', default = 'none' },
    },
})

define('keypad', {
    label = 'Keypad',
    group = 'puzzle',
    icon = 'grip',
    colour = MARKER.puzzle,
    blurb = 'A code entry. The code comes from another stage, so the crew has to split up.',
    fields = {
        { key = 'digits',   label = 'Code length', type = 'number', default = 4, min = 3, max = 8 },
        { key = 'codeFrom', label = 'Code found at', type = 'stage', default = '' },
        { key = 'attempts', label = 'Attempts',    type = 'number', default = 3, min = 1, max = 10 },
    },
})

define('camera', {
    label = 'Camera / security',
    group = 'control',
    icon = 'video',
    colour = MARKER.control,
    blurb = 'Disable to change what the alarm does. The change itself is set under Police Response.',
    fields = {
        { key = 'minigame', label = 'Minigame', type = 'minigame', default = 'xs:wire_trace' },
    },
})

define('power', {
    label = 'Power box',
    group = 'control',
    icon = 'bolt',
    colour = MARKER.control,
    blurb = 'Cuts power. Kills interior lights and can soften the alarm.',
    fields = {
        { key = 'killLights', label = 'Darken interior', type = 'toggle', default = true },
        { key = 'shockRisk',  label = 'Shock on failure', type = 'toggle', default = true, advanced = true },
    },
})

define('register', {
    label = 'Register',
    group = 'loot',
    icon = 'cash-register',
    colour = MARKER.loot,
    blurb = 'A fast grab for a small payout.',
    fields = {
        { key = 'minigame', label = 'Minigame', type = 'minigame', default = 'xs:tumbler' },
        { key = 'restock',  label = 'Restocks after', type = 'number', default = 1800, min = 0, max = 86400, unit = 's' },
    },
})

define('safe', {
    label = 'Safe / vault',
    group = 'loot',
    icon = 'vault',
    colour = MARKER.loot,
    blurb = 'Long, loud, and worth it.',
    fields = {
        { key = 'minigame', label = 'Minigame', type = 'minigame', default = 'xs:circuit' },
        { key = 'restock',  label = 'Restocks after', type = 'number', default = 7200, min = 0, max = 86400, unit = 's' },
        { key = 'revealCode', label = 'Reveals a code', type = 'number', default = 0, min = 0, max = 8,
          advanced = true, hint = 'How many digits. 0 for none. A keypad elsewhere can ask for it.' },
    },
})

define('container', {
    label = 'Loot container',
    group = 'loot',
    icon = 'box-open',
    colour = MARKER.loot,
    blurb = 'Grab into a bag, one handful at a time, up to a weight limit.',
    fields = {
        { key = 'grabs',     label = 'Grabs available', type = 'number', default = 6, min = 1, max = 40 },
        { key = 'grabTime',  label = 'Per grab',        type = 'number', default = 4, min = 1, max = 60, unit = 's' },
        { key = 'needsBag',  label = 'Requires a bag',  type = 'toggle', default = false, advanced = true },
    },
})

define('twoman', {
    label = 'Two-man point',
    group = 'control',
    icon = 'users',
    colour = MARKER.control,
    blurb = 'Two players must hold it at the same time. Pair it with a second one elsewhere.',
    fields = {
        { key = 'pairWith', label = 'Paired with', type = 'stage', default = '' },
        { key = 'holdTime', label = 'Hold for',    type = 'number', default = 6, min = 1, max = 120, unit = 's' },
    },
})

define('hostage', {
    label = 'Hostage / clerk',
    group = 'people',
    icon = 'user-lock',
    colour = MARKER.people,
    blurb = 'Intimidate whoever is behind the counter. Stalls the response while it holds.',
    fields = {
        { key = 'ped',        label = 'Ped model',    type = 'text',   default = 'mp_m_shopkeep_01' },
        { key = 'needsAim',   label = 'Requires aiming', type = 'toggle', default = true },
        { key = 'stallFor',   label = 'Stalls alert',  type = 'number', default = 60, min = 0, max = 600, unit = 's' },
        { key = 'panicChance', label = 'Panic chance', type = 'number', default = 15, min = 0, max = 100, unit = '%', advanced = true },
    },
})

define('hold', {
    label = 'Hold point',
    group = 'control',
    icon = 'hourglass-half',
    colour = MARKER.control,
    blurb = 'Stand here while a timer runs. Good for making people expose themselves.',
    fields = {
        { key = 'radius',      label = 'Radius',        type = 'number', default = 3.0, min = 1.0, max = 30.0, unit = 'm' },
        { key = 'breakOnLeave', label = 'Resets if you leave', type = 'toggle', default = true },
    },
})

define('doorlock', {
    label = 'Door',
    group = 'control',
    icon = 'door-closed',
    colour = MARKER.control,
    blurb = 'Unlocks a door in your door lock resource. Put the door id in and it opens when this stage is done.',
    fields = {
        { key = 'doorId',      label = 'Door id',        type = 'text',   default = '',
          hint = 'Exactly as your door lock resource names it. ox_doorlock uses a number or a name.' },
        { key = 'doorAction',  label = 'Do what',        type = 'select', default = 'unlock',
          options = {
              { value = 'unlock', label = 'Unlock it' },
              { value = 'lock',   label = 'Lock it' },
          } },
        { key = 'relockOnEnd', label = 'Put it back when the run ends', type = 'toggle', default = true },
        { key = 'minigame',    label = 'Minigame',       type = 'minigame', default = 'xs:signal_lock' },
        { key = 'attempts',    label = 'Attempts',       type = 'number', default = 3, min = 1, max = 10 },
    },
})

define('guard', {
    label = 'Armed guard',
    group = 'people',
    icon = 'user-shield',
    colour = MARKER.people,
    blurb = 'A guard who fights back. There is nothing to press: the stage is done when they are down.',
    fields = {
        { key = 'ped',         label = 'Ped model',      type = 'text',   default = 's_m_m_security_01' },
        { key = 'weapon',      label = 'Weapon',         type = 'text',   default = 'WEAPON_PISTOL' },
        { key = 'accuracy',    label = 'Accuracy',       type = 'number', default = 40, min = 1, max = 100, unit = '%' },
        { key = 'guardHealth', label = 'Health',         type = 'number', default = 200, min = 100, max = 1000 },
        { key = 'armour',      label = 'Armour',         type = 'number', default = 0, min = 0, max = 100 },
        { key = 'hostile',     label = 'Starts hostile', type = 'toggle', default = false,
          hint = 'Off means they only turn on you once the alarm goes, so a quiet crew can walk past.' },
        { key = 'alertOnDeath', label = 'Killing them calls it in', type = 'toggle', default = true },
        { key = 'guardScenario', label = 'Idle scenario', type = 'text', default = 'WORLD_HUMAN_GUARD_STAND', advanced = true },
    },
})

define('laser', {
    label = 'Laser grid',
    group = 'control',
    icon = 'grip-lines',
    colour = MARKER.control,
    blurb = 'Beams across a doorway. Walk through while they are live and the alarm goes. Disable it here, or wire it to the power box.',
    fields = {
        { key = 'span',        label = 'Width',          type = 'number', default = 2.0, min = 0.5, max = 12.0, unit = 'm' },
        { key = 'beams',       label = 'Beams',          type = 'number', default = 4, min = 1, max = 12 },
        { key = 'tripAlarm',   label = 'Crossing it trips the alarm', type = 'toggle', default = true },
        { key = 'minigame',    label = 'Minigame',       type = 'minigame', default = 'xs:frequency' },
        { key = 'attempts',    label = 'Attempts',       type = 'number', default = 2, min = 1, max = 10 },
    },
})

define('escape', {
    label = 'Escape zone',
    group = 'entry',
    icon = 'flag-checkered',
    colour = MARKER.entry,
    blurb = 'Where the run resolves and everything pays out. Every robbery needs one.',
    fields = {
        { key = 'radius',    label = 'Radius',       type = 'number', default = 25.0, min = 5.0, max = 300.0, unit = 'm' },
        { key = 'inVehicle', label = 'Must be in a vehicle', type = 'toggle', default = false },
        { key = 'timeLimit', label = 'Time limit',   type = 'number', default = 0, min = 0, max = 3600, unit = 's', advanced = true },
    },
})

function Stages.Get(typeId)
    return Stages.types[typeId]
end

function Stages.FieldsFor(typeId)
    local def = Stages.types[typeId]
    if not def then return Stages.commonFields end

    local out = {}
    for _, f in ipairs(Stages.commonFields) do out[#out + 1] = f end
    for _, f in ipairs(def.fields or {}) do out[#out + 1] = f end
    return out
end

function Stages.Catalogue()
    local out = {}
    for _, id in ipairs(Stages.order) do
        local d = Stages.types[id]
        out[#out + 1] = {
            id = id, label = d.label, group = d.group, icon = d.icon,
            colour = d.colour, blurb = d.blurb, fields = Stages.FieldsFor(id),
        }
    end
    return out
end

function Stages.Defaults(typeId)
    local out = {}
    for _, f in ipairs(Stages.FieldsFor(typeId)) do
        out[f.key] = f.default
    end
    return out
end
