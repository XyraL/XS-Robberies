Minigames = { list = {}, order = {} }

local function define(id, def)
    def.id = id
    Minigames.list[id] = def
    Minigames.order[#Minigames.order + 1] = id
end

define('none', {
    label = 'None',
    provider = 'cipher',
    resource = nil,
    blurb = 'Just the timer. No skill check.',
    difficulty = false,
})

define('cipher:signal_lock', {
    label = 'Signal Lock',
    provider = 'cipher',
    blurb = 'Hold a drifting carrier inside the band until it locks.',
    difficulty = true,
})

define('cipher:circuit', {
    label = 'Circuit Routing',
    provider = 'cipher',
    blurb = 'Route power across a grid before the breaker trips.',
    difficulty = true,
})

define('cipher:tumbler', {
    label = 'Tumbler',
    provider = 'cipher',
    blurb = 'Feel out each pin and set it. Miss and the whole set drops.',
    difficulty = true,
})

define('cipher:sequence', {
    label = 'Sequence Recall',
    provider = 'cipher',
    blurb = 'Watch a pattern, repeat it back, one longer each round.',
    difficulty = true,
})

define('cipher:frequency', {
    label = 'Frequency Match',
    provider = 'cipher',
    blurb = 'Tune two waves until they sit on top of each other.',
    difficulty = true,
})

define('cipher:wire_trace', {
    label = 'Wire Trace',
    provider = 'cipher',
    blurb = 'Follow one wire through a tangle and cut the right end.',
    difficulty = true,
})

define('cipher:thermite', {
    label = 'Thermite',
    provider = 'cipher',
    blurb = 'A pattern lights up on the grid. Watch it, then put it back.',
    difficulty = true,
})

define('cipher:fingerprint', {
    label = 'Fingerprint',
    provider = 'cipher',
    blurb = 'One print matches the one on file. The rest are close.',
    difficulty = true,
})

define('cipher:drill', {
    label = 'Drill',
    provider = 'cipher',
    blurb = 'Lean on it and ease off. Push too hard and the bit burns out.',
    difficulty = true,
})

define('cipher:pinpad', {
    label = 'Pin Pad',
    provider = 'cipher',
    blurb = 'Crack a combination. Every guess says which digits are right and which are close.',
    difficulty = true,
})

define('cipher:bypass', {
    label = 'Bypass',
    provider = 'cipher',
    blurb = 'Stop a running cursor inside each gate, in order.',
    difficulty = true,
})

define('cipher:sweep', {
    label = 'Sweep',
    provider = 'cipher',
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
