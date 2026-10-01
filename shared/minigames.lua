Minigames = { list = {}, order = {} }

local function define(id, def)
    def.id = id
    if def.difficulty == nil then def.difficulty = true end
    Minigames.list[id] = def
    Minigames.order[#Minigames.order + 1] = id
end

define('none', { label = 'None', provider = 'xs', blurb = 'Just the timer. No skill check.', difficulty = false })

define('xs:signal_lock', { label = 'Signal Lock', provider = 'xs', blurb = 'Hold a drifting carrier inside the band until it locks.' })
define('xs:circuit', { label = 'Circuit Routing', provider = 'xs', blurb = 'Route power across a grid before the breaker trips.' })
define('xs:tumbler', { label = 'Tumbler', provider = 'xs', blurb = 'Feel out each pin and set it. Miss and the whole set drops.' })
define('xs:sequence', { label = 'Sequence Recall', provider = 'xs', blurb = 'Watch a pattern, repeat it back, one longer each round.' })
define('xs:frequency', { label = 'Frequency Match', provider = 'xs', blurb = 'Tune two waves until they sit on top of each other.' })
define('xs:wire_trace', { label = 'Wire Trace', provider = 'xs', blurb = 'Follow one wire through a tangle and cut the right end.' })
define('xs:thermite', { label = 'Thermite', provider = 'xs', blurb = 'A pattern lights up on the grid. Watch it, then put it back.' })
define('xs:fingerprint', { label = 'Fingerprint', provider = 'xs', blurb = 'One print matches the one on file. The rest are close.' })
define('xs:drill', { label = 'Drill', provider = 'xs', blurb = 'Lean on it and ease off. Push too hard and the bit burns out.' })
define('xs:pinpad', { label = 'Pin Pad', provider = 'xs', blurb = 'Crack a combination. Every guess says which digits are right and which are close.' })
define('xs:bypass', { label = 'Bypass', provider = 'xs', blurb = 'Stop a running cursor inside each gate, in order.' })
define('xs:sweep', { label = 'Sweep', provider = 'xs', blurb = 'A radar sweep goes round. Hit it as it crosses the contact.' })

define('ox_lib:skillcheck', { label = 'Skill check', provider = 'ox_lib', resource = 'ox_lib', blurb = 'The ox_lib timed key press.' })

local PSUI = { 'ps-ui', 'ps_lib' }
define('ps-ui:circle', { label = 'Circle', provider = 'ps-ui', resource = PSUI, blurb = 'Press the key as each circle lines up.' })
define('ps-ui:maze', { label = 'Maze', provider = 'ps-ui', resource = PSUI, blurb = 'Steer through a maze before the clock runs out.' })
define('ps-ui:varhack', { label = 'Var Hack', provider = 'ps-ui', resource = PSUI, blurb = 'Remember the numbered blocks, then click them in order.' })
define('ps-ui:thermite', { label = 'Thermite', provider = 'ps-ui', resource = PSUI, blurb = 'Memorise the grid and put it back.' })
define('ps-ui:scrambler', { label = 'Scrambler', provider = 'ps-ui', resource = PSUI, blurb = 'Find the code in the scrambled characters.' })

define('bl_ui:circle_progress', { label = 'Circle Progress', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui skill check.' })
define('bl_ui:progress', { label = 'Progress', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui skill check.' })
define('bl_ui:key_spam', { label = 'Key Spam', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui skill check.' })
define('bl_ui:key_circle', { label = 'Key Circle', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui skill check.' })
define('bl_ui:number_slide', { label = 'Number Slide', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui skill check.' })
define('bl_ui:rapid_lines', { label = 'Rapid Lines', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui skill check.' })
define('bl_ui:circle_shake', { label = 'Circle Shake', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui skill check.' })
define('bl_ui:circle_sum', { label = 'Circle Sum', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })
define('bl_ui:word_wiz', { label = 'Word Wiz', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })
define('bl_ui:digit_dazzle', { label = 'Digit Dazzle', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })
define('bl_ui:lights_out', { label = 'Lights Out', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })
define('bl_ui:mine_sweeper', { label = 'Mine Sweeper', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })
define('bl_ui:path_find', { label = 'Path Find', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })
define('bl_ui:untangle', { label = 'Untangle', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })
define('bl_ui:print_lock', { label = 'Print Lock', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })
define('bl_ui:wave_match', { label = 'Wave Match', provider = 'bl_ui', resource = 'bl_ui', blurb = 'A bl_ui hacking game.' })

define('qb-minigames:skillbar', { label = 'Skill Bar', provider = 'qb-minigames', resource = 'qb-minigames', blurb = 'Press the key while the bar is in the zone.' })
define('qb-minigames:hacking', { label = 'Hacking', provider = 'qb-minigames', resource = 'qb-minigames', blurb = 'Find the sequence in the scrolling code.' })
define('qb-minigames:lockpick', { label = 'Lockpick', provider = 'qb-minigames', resource = 'qb-minigames', blurb = 'Set the pins without breaking the pick.' })

define('glow:path', { label = 'Path', provider = 'glow_minigames', resource = 'glow_minigames', blurb = 'Remember the path across the grid.' })
define('glow:spot', { label = 'Spot', provider = 'glow_minigames', resource = 'glow_minigames', blurb = 'Find the characters in the grid.' })
define('glow:math', { label = 'Math', provider = 'glow_minigames', resource = 'glow_minigames', blurb = 'Solve the sums against the clock.' })

define('utk:fingerprint', { label = 'Fingerprint', provider = 'utk_fingerprint', resource = 'utk_fingerprint', blurb = 'Match the fingerprint pieces.' })
define('voltlab:voltlab', { label = 'Voltlab', provider = 'ultra-voltlab', resource = 'ultra-voltlab', blurb = 'Wire the right voltages together.' })
define('mhacking:hack', { label = 'mHacking', provider = 'mhacking', resource = 'mhacking', blurb = 'Find the sequence in the scrolling code.' })

define('sn:memory', { label = 'Memory', provider = 'SN-Hacking', resource = 'SN-Hacking', blurb = 'Repeat the keys back.' })
define('sn:thermite', { label = 'Thermite', provider = 'SN-Hacking', resource = 'SN-Hacking', blurb = 'Memorise the grid and put it back.' })
define('sn:skillbar', { label = 'Skill Bar', provider = 'SN-Hacking', resource = 'SN-Hacking', blurb = 'Stop the bar in the zone.' })

define('boii:chip_hack', { label = 'Chip Hack', provider = 'boii_minigames', resource = 'boii_minigames', blurb = 'Find the chips before the timer runs out.' })
define('boii:safe_crack', { label = 'Safe Crack', provider = 'boii_minigames', resource = 'boii_minigames', blurb = 'Turn the dial until it catches.' })
define('boii:wire_cut', { label = 'Wire Cut', provider = 'boii_minigames', resource = 'boii_minigames', blurb = 'Cut the right wires.' })
define('boii:pincode', { label = 'Pincode', provider = 'boii_minigames', resource = 'boii_minigames', blurb = 'Guess the code from the hints.' })
define('boii:anagram', { label = 'Anagram', provider = 'boii_minigames', resource = 'boii_minigames', blurb = 'Unscramble the word.' })

define('memorygame:start', { label = 'Thermite memory', provider = 'memorygame', resource = 'memorygame', blurb = 'Remember the lit tiles and click them.' })
define('howdy:hack', { label = 'Hack', provider = 'howdy-hackminigame', resource = 'howdy-hackminigame', blurb = 'Match the icons before each timer runs out.' })

local legacy = {}
for id, def in pairs(Minigames.list) do
    local bare = id:match('^xs:(.+)$')
    if bare then legacy['cipher:' .. bare] = def end
end
for id, def in pairs(legacy) do
    Minigames.list[id] = def
end

function Minigames.Resource(def)
    local res = def.resource
    if not res then return nil end
    if type(res) == 'table' then
        for _, name in ipairs(res) do
            if GetResourceState(name) == 'started' then return name end
        end
        return res[1]
    end
    return res
end

function Minigames.Available(id)
    local def = Minigames.list[id]
    if not def then return false end
    if Config.Minigames and Config.Minigames[def.provider] == false then return false end
    if not def.resource then return true end
    return GetResourceState(Minigames.Resource(def)) == 'started'
end

function Minigames.Catalogue()
    local out = {}
    for _, id in ipairs(Minigames.order) do
        local d = Minigames.list[id]
        local res = type(d.resource) == 'table' and d.resource[1] or d.resource
        out[#out + 1] = {
            id = id, label = d.label, provider = d.provider, blurb = d.blurb,
            resource = res, difficulty = d.difficulty,
            available = Minigames.Available(id),
        }
    end
    return out
end
