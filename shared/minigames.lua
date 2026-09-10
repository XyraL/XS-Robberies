Minigames = { list = {}, order = {} }

local function define(id, def)
    def.id = id
    Minigames.list[id] = def
    Minigames.order[#Minigames.order + 1] = id
end

define('none', {
    label = 'None',
    provider = 'xs',
    resource = nil,
    blurb = 'Just the timer. No skill check.',
    difficulty = false,
})

define('xs:signal_lock', {
    label = 'Signal Lock',
    provider = 'xs',
    blurb = 'Hold a drifting carrier inside the band until it locks.',
    difficulty = true,
})

define('xs:circuit', {
    label = 'Circuit Routing',
    provider = 'xs',
    blurb = 'Route power across a grid before the breaker trips.',
    difficulty = true,
})

define('xs:tumbler', {
    label = 'Tumbler',
    provider = 'xs',
    blurb = 'Feel out each pin and set it. Miss and the whole set drops.',
    difficulty = true,
})

define('xs:sequence', {
    label = 'Sequence Recall',
    provider = 'xs',
    blurb = 'Watch a pattern, repeat it back, one longer each round.',
    difficulty = true,
})

define('xs:frequency', {
    label = 'Frequency Match',
    provider = 'xs',
    blurb = 'Tune two waves until they sit on top of each other.',
    difficulty = true,
})

define('xs:wire_trace', {
    label = 'Wire Trace',
    provider = 'xs',
    blurb = 'Follow one wire through a tangle and cut the right end.',
    difficulty = true,
})

define('xs:thermite', {
    label = 'Thermite',
    provider = 'xs',
    blurb = 'A pattern lights up on the grid. Watch it, then put it back.',
    difficulty = true,
})

define('xs:fingerprint', {
    label = 'Fingerprint',
    provider = 'xs',
    blurb = 'One print matches the one on file. The rest are close.',
    difficulty = true,
})

define('xs:drill', {
    label = 'Drill',
    provider = 'xs',
    blurb = 'Lean on it and ease off. Push too hard and the bit burns out.',
    difficulty = true,
})

define('xs:pinpad', {
    label = 'Pin Pad',
    provider = 'xs',
    blurb = 'Crack a combination. Every guess says which digits are right and which are close.',
    difficulty = true,
})

define('xs:bypass', {
    label = 'Bypass',
    provider = 'xs',
    blurb = 'Stop a running cursor inside each gate, in order.',
    difficulty = true,
})

define('xs:sweep', {
    label = 'Sweep',
    provider = 'xs',
    blurb = 'A radar sweep goes round. Hit it as it crosses the contact.',
    difficulty = true,
})

define('ox_lib:skillcheck', {
    label = 'ox_lib Skill Check',
    provider = 'ox_lib',
    resource = 'ox_lib',
    blurb = 'The standard ox_lib timed key press.',
    difficulty = true,
})

define('ps-ui:circle', {
    label = 'ps-ui Circle',
    provider = 'ps-ui',
    resource = 'ps-ui',
    blurb = 'Timed circle click.',
    difficulty = true,
})

define('ps-ui:maze', {
    label = 'ps-ui Maze',
    provider = 'ps-ui',
    resource = 'ps-ui',
    blurb = 'Steer a marker through a maze.',
    difficulty = true,
})

define('ps-ui:thermite', {
    label = 'ps-ui Thermite',
    provider = 'ps-ui',
    resource = 'ps-ui',
    blurb = 'Memorise a grid and reproduce it.',
    difficulty = true,
})

define('ps-ui:scrambler', {
    label = 'ps-ui Scrambler',
    provider = 'ps-ui',
    resource = 'ps-ui',
    blurb = 'Stop the scrambler on target.',
    difficulty = true,
})

define('memorygame:start', {
    label = 'Memory Game',
    provider = 'memorygame',
    resource = 'memorygame',
    blurb = 'Match pairs against a clock.',
    difficulty = true,
})

define('howdy:hack', {
    label = 'Howdy Hack',
    provider = 'howdy-hackminigame',
    resource = 'howdy-hackminigame',
    blurb = 'Word-search style terminal hack.',
    difficulty = true,
})

-- Robberies built before the XyraLScripts rename store these ids with a
-- `cipher:` prefix, and that stage data lives in the database. Keep the old
-- ids resolvable so those robberies still run, but leave them out of `order`
-- so the builder only ever offers the new ones.
local legacy = {}
for id, def in pairs(Minigames.list) do
    local bare = id:match('^xs:(.+)$')
    if bare then legacy['cipher:' .. bare] = def end
end
for id, def in pairs(legacy) do
    Minigames.list[id] = def
end

function Minigames.Available(id)
    local def = Minigames.list[id]
    if not def then return false end
    if Config.Minigames and Config.Minigames[def.provider] == false then return false end
    if not def.resource then return true end
    return GetResourceState(def.resource) == 'started'
end

function Minigames.Catalogue()
    local out = {}
    for _, id in ipairs(Minigames.order) do
        local d = Minigames.list[id]
        out[#out + 1] = {
            id = id, label = d.label, provider = d.provider, blurb = d.blurb,
            resource = d.resource, difficulty = d.difficulty,
            available = Minigames.Available(id),
        }
    end
    return out
end
