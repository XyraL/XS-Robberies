Petty = Petty or {}
Petty.kinds = {}
Petty.order = {}

Petty.groups = {
    { id = 'street', label = 'Street theft', colour = { 255, 93, 115 } },
    { id = 'car',    label = 'Car crimes',   colour = { 255, 195, 90 } },
    { id = 'small',  label = 'Small theft',  colour = { 57, 212, 155 } },
    { id = 'shop',   label = 'Shop crimes',  colour = { 169, 139, 255 } },
    { id = 'scrap',  label = 'Scrap theft',  colour = { 214, 132, 84 } },
}

Petty.classes = {
    { id = 0, label = 'Compacts' }, { id = 1, label = 'Sedans' }, { id = 2, label = 'SUVs' },
    { id = 3, label = 'Coupes' }, { id = 4, label = 'Muscle' }, { id = 5, label = 'Sports classics' },
    { id = 6, label = 'Sports' }, { id = 7, label = 'Super' }, { id = 8, label = 'Motorcycles' },
    { id = 9, label = 'Off-road' }, { id = 10, label = 'Industrial' }, { id = 11, label = 'Utility' },
    { id = 12, label = 'Vans' }, { id = 13, label = 'Cycles' }, { id = 14, label = 'Boats' },
    { id = 15, label = 'Helicopters' }, { id = 16, label = 'Planes' }, { id = 17, label = 'Service' },
    { id = 18, label = 'Emergency' }, { id = 19, label = 'Military' }, { id = 20, label = 'Commercial' },
    { id = 21, label = 'Trains' }, { id = 22, label = 'Open wheel' },
}

local CARS = { 0, 1, 2, 3, 4, 5, 6, 7, 9, 12 }

local LAW = {
    's_m_y_cop_01', 's_f_y_cop_01', 's_m_y_sheriff_01', 's_f_y_sheriff_01', 's_m_y_hwaycop_01',
    's_m_y_swat_01', 's_m_y_ranger_01', 's_f_y_ranger_01', 's_m_m_prisguard_01', 's_m_m_security_01',
    's_m_m_armoured_01', 's_m_m_armoured_02', 's_m_m_highsec_01', 's_m_m_highsec_02', 's_m_m_fibsec_01',
    's_m_m_ciasec_01', 's_m_y_blackops_01', 's_m_y_blackops_02', 's_m_y_marine_01', 's_m_y_marine_02',
    's_m_y_marine_03', 's_m_m_marine_01', 's_m_m_marine_02', 's_m_y_armymech_01', 's_m_y_uscg_01',
}

local function list(src)
    local out = {}
    for i, v in ipairs(src or {}) do out[i] = v end
    return out
end

local function anim(dict, clip, flag)
    return { mode = 'anim', dict = dict, clip = clip, flag = flag or 1, scenario = '' }
end

local function scenario(name)
    return { mode = 'scenario', dict = '', clip = '', flag = 1, scenario = name }
end

local function define(id, def)
    def.id = id
    Petty.kinds[id] = def
    Petty.order[#Petty.order + 1] = id
end

local function config(target, o)
    local cfg = {
        enabled = o.enabled ~= false,
        label = o.label,
        duration = o.duration or 5,
        reach = o.reach or 1.5,
        minigame = o.minigame or 'none',
        difficulty = o.difficulty or '2',
        anim = o.anim or { mode = 'none', dict = '', clip = '', flag = 1, scenario = '' },
        item = o.item or { name = '', consume = false, breakChance = 0 },
        payout = {
            cash = { account = 'cash', min = o.cash and o.cash[1] or 0, max = o.cash and o.cash[2] or 0 },
            items = o.items or {},
            lootTable = '',
        },
        alert = {
            chance = o.alert or 0,
            delay = o.delay or 30,
            onFail = o.onFail == true,
            code = o.code or '10-31',
            title = o.title or o.label,
        },
        witness = { chance = o.witness or 0, radius = o.radius or 20 },
        shock = o.shock or 0,
        cooldown = { target = o.targetCooldown or 30, player = o.playerCooldown or 2 },
        police = 0,
    }

    if target == 'ped' or target == 'aim' then
        cfg.peds = {
            gender = o.gender or 'any',
            skipCops = true,
            skipMission = true,
            models = {},
            exclude = list(LAW),
        }
        cfg.victim = {
            notice = o.notice or 0,
            fight = o.fight or 0,
            resist = o.resist or 0,
            flee = o.flee ~= false,
        }
    elseif target == 'vehicle' then
        cfg.vehicles = {
            classes = list(CARS),
            parked = true,
            skipOwned = true,
            alarm = o.carAlarm or 0,
            alarmAlerts = true,
        }
    elseif target == 'model' then
        cfg.models = list(o.models)
    elseif target == 'spot' then
        cfg.spots = {}
        cfg.prop = o.prop or ''
    end

    return cfg
end

define('pickpocket', {
    group = 'street', target = 'ped', icon = 'hand', fa = 'hand',
    label = 'Pickpocket',
    blurb = 'Lift a wallet off someone on the street. They might feel it.',
    defaults = config('ped', {
        label = 'Pickpocket', duration = 4, reach = 1.6, minigame = 'mgc:skill_circle', difficulty = '1',
        anim = anim('anim@gangops@facility@servers@bodysearch@', 'player_search', 1),
        cash = { 20, 90 },
        items = { { item = 'stolen_wallet', min = 1, max = 1, chance = 10 } },
        alert = 5, delay = 25, onFail = true, title = 'Pickpocket',
        witness = 8, radius = 15, notice = 15, fight = 20,
        targetCooldown = 30, playerCooldown = 1,
    }),
})

define('purse', {
    group = 'street', target = 'ped', icon = 'purse', fa = 'bag-shopping',
    label = 'Purse snatch',
    blurb = 'Grab the bag and run. They always notice, and some chase you.',
    defaults = config('ped', {
        label = 'Snatch the bag', duration = 2, reach = 1.6, gender = 'female',
        anim = anim('mp_common', 'givetake1_a', 48),
        cash = { 30, 140 },
        items = { { item = 'stolen_purse', min = 1, max = 1, chance = 25 } },
        alert = 15, delay = 20, onFail = true, title = 'Purse snatching',
        witness = 25, radius = 25, notice = 100, fight = 25,
        targetCooldown = 30, playerCooldown = 2,
    }),
})

define('mugging', {
    group = 'street', target = 'aim', icon = 'gun', fa = 'gun',
    label = 'Mugging',
    blurb = 'Aim at someone and they hand it over. Some refuse.',
    defaults = config('aim', {
        label = 'Rob them', duration = 5, reach = 8,
        cash = { 60, 260 },
        items = {
            { item = 'stolen_wallet', min = 1, max = 1, chance = 30 },
            { item = 'phone', min = 1, max = 1, chance = 10 },
        },
        alert = 40, delay = 30, onFail = true, title = 'Armed robbery',
        witness = 35, radius = 30, resist = 15, fight = 50,
        targetCooldown = 30, playerCooldown = 5,
    }),
})

define('carwindow', {
    group = 'car', target = 'vehicle', icon = 'window', fa = 'car-burst',
    label = 'Smash and grab',
    blurb = 'Put a window in on a parked car and take what is on the seat.',
    defaults = config('vehicle', {
        label = 'Smash the window', duration = 6, reach = 2.0,
        anim = anim('oddjobs@shop_robbery@rob_till', 'loop', 1),
        cash = { 10, 80 },
        items = {
            { item = 'stolen_purse', min = 1, max = 1, chance = 12 },
            { item = 'stolen_wallet', min = 1, max = 1, chance = 12 },
            { item = 'phone', min = 1, max = 1, chance = 6 },
        },
        alert = 15, delay = 30, onFail = true, title = 'Vehicle break-in',
        witness = 20, radius = 20, carAlarm = 60,
        targetCooldown = 60, playerCooldown = 2,
    }),
})

define('catalytic', {
    group = 'car', target = 'vehicle', icon = 'converter', fa = 'screwdriver-wrench',
    label = 'Catalytic converter',
    blurb = 'Lie under a parked car and cut the converter out.',
    defaults = config('vehicle', {
        label = 'Cut the converter', duration = 15, reach = 2.2,
        anim = scenario('WORLD_HUMAN_VEHICLE_MECHANIC'),
        item = { name = 'angle_grinder', consume = false, breakChance = 5 },
        items = { { item = 'catalytic_converter', min = 1, max = 1, chance = 100 } },
        alert = 30, delay = 40, onFail = true, title = 'Catalytic converter theft',
        witness = 15, radius = 25, carAlarm = 35,
        targetCooldown = 120, playerCooldown = 10,
    }),
})

define('wheels', {
    group = 'car', target = 'vehicle', icon = 'wheel', fa = 'circle-notch',
    label = 'Wheel theft',
    blurb = 'Take the wheels off a parked car, one at a time.',
    defaults = config('vehicle', {
        label = 'Take the wheel', duration = 12, reach = 2.0,
        anim = anim('anim@amb@clubhouse@tutorial@bkr_tut_ig3@', 'machinic_loop_mechandplayer', 1),
        item = { any = { 'WEAPON_WRENCH', 'weapon_wrench' }, consume = false, breakChance = 0 },
        items = { { item = 'stolen_wheel', min = 1, max = 1, chance = 100 } },
        alert = 20, delay = 40, onFail = true, title = 'Wheel theft',
        witness = 15, radius = 25, carAlarm = 25,
        targetCooldown = 120, playerCooldown = 5,
    }),
})

define('mailbox', {
    group = 'small', target = 'model', icon = 'mail', fa = 'envelope',
    label = 'Mailboxes',
    blurb = 'Fish the mail out of street and house mailboxes.',
    defaults = config('model', {
        label = 'Go through the mail', duration = 5,
        anim = anim('amb@prop_human_bum_bin@base', 'base', 1),
        models = { 'prop_postbox_01a', 'prop_letterbox_01', 'prop_letterbox_02', 'prop_letterbox_03', 'prop_letterbox_04' },
        cash = { 5, 45 },
        items = { { item = 'stolen_package', min = 1, max = 1, chance = 15 } },
        alert = 5, delay = 30, title = 'Mail theft',
        witness = 10, radius = 15,
        targetCooldown = 45, playerCooldown = 1,
    }),
})

define('vending', {
    group = 'small', target = 'model', icon = 'vending', fa = 'bottle-water',
    label = 'Vending machines',
    blurb = 'Pop the coin box on a vending machine.',
    defaults = config('model', {
        label = 'Break into it', duration = 8, minigame = 'mgc:button_mash', difficulty = '1',
        anim = anim('mini@repair', 'fixing_a_ped', 1),
        item = { name = 'lockpick', consume = false, breakChance = 15 },
        models = { 'prop_vend_soda_01', 'prop_vend_soda_02', 'prop_vend_snak_01', 'prop_vend_snak_01_tu', 'prop_vend_coffe_01', 'prop_vend_water_01', 'prop_vend_fags_01' },
        cash = { 15, 70 },
        items = {
            { any = { 'sprunk', 'kurkakola', 'water', 'water_bottle' }, min = 1, max = 2, chance = 30 },
        },
        alert = 10, delay = 30, title = 'Vending machine break-in',
        witness = 10, radius = 15,
        targetCooldown = 30, playerCooldown = 2,
    }),
})

define('meter', {
    group = 'small', target = 'model', icon = 'meter', fa = 'square-parking',
    label = 'Parking meters',
    blurb = 'Crack a parking meter for the coins inside.',
    defaults = config('model', {
        label = 'Crack the meter', duration = 6, minigame = 'mgc:skill_bar', difficulty = '1',
        anim = anim('amb@prop_human_parking_meter@male@base', 'base', 1),
        item = { name = 'lockpick', consume = false, breakChance = 10 },
        models = { 'prop_parknmeter_01', 'prop_parknmeter_02' },
        cash = { 8, 40 },
        alert = 5, delay = 30, title = 'Parking meter theft',
        witness = 8, radius = 15,
        targetCooldown = 30, playerCooldown = 1,
    }),
})

define('payphone', {
    group = 'small', target = 'model', icon = 'phone', fa = 'phone',
    label = 'Payphones',
    blurb = 'Pry the coin box off a payphone and empty it.',
    defaults = config('model', {
        label = 'Pry the coin box', duration = 6, minigame = 'mgc:button_mash', difficulty = '1',
        anim = anim('mini@repair', 'fixing_a_ped', 1),
        item = { any = { 'WEAPON_CROWBAR', 'weapon_crowbar' }, consume = false, breakChance = 0 },
        models = { 'prop_phonebox_01a', 'prop_phonebox_01b', 'prop_phonebox_01c', 'prop_phonebox_02', 'prop_phonebox_03', 'prop_phonebox_04', 'prop_phonebox_05a' },
        cash = { 10, 55 },
        alert = 5, delay = 30, title = 'Payphone theft',
        witness = 8, radius = 15,
        targetCooldown = 45, playerCooldown = 1,
    }),
})

define('newspaper', {
    group = 'small', target = 'model', icon = 'news', fa = 'newspaper',
    label = 'Newspaper boxes',
    blurb = 'Jimmy a newspaper box for the change inside.',
    defaults = config('model', {
        label = 'Jimmy the box', duration = 4,
        anim = anim('mini@repair', 'fixing_a_ped', 1),
        models = { 'prop_news_disp_01a', 'prop_news_disp_02a', 'prop_news_disp_02b', 'prop_news_disp_02c', 'prop_news_disp_02d', 'prop_news_disp_02e', 'prop_news_disp_03a', 'prop_news_disp_03c', 'prop_news_disp_05a', 'prop_news_disp_06a' },
        cash = { 3, 20 },
        alert = 3, delay = 30, title = 'Theft',
        witness = 6, radius = 12,
        targetCooldown = 30, playerCooldown = 1,
    }),
})

define('package', {
    group = 'small', target = 'spot', icon = 'box', fa = 'box',
    label = 'Porch packages',
    blurb = 'Parcels left on doorsteps. Place the doorsteps, a box sits on each.',
    defaults = config('spot', {
        label = 'Take the package', duration = 2,
        anim = anim('pickup_object', 'pickup_low', 16),
        prop = 'prop_cs_cardbox_01',
        items = { { item = 'stolen_package', min = 1, max = 1, chance = 100 } },
        alert = 10, delay = 30, title = 'Package theft',
        witness = 12, radius = 20,
        targetCooldown = 30, playerCooldown = 3,
    }),
})

define('tipjar', {
    group = 'small', target = 'spot', icon = 'jar', fa = 'jar',
    label = 'Tip jars',
    blurb = 'Empty the tip jar on a counter. Place one on each counter.',
    defaults = config('spot', {
        label = 'Empty the tip jar', duration = 2,
        anim = anim('mp_common', 'givetake1_a', 1),
        cash = { 10, 60 },
        alert = 5, delay = 25, title = 'Theft',
        witness = 10, radius = 12,
        targetCooldown = 20, playerCooldown = 2,
    }),
})

define('elecbox', {
    group = 'scrap', target = 'model', icon = 'bolt', fa = 'bolt', risk = 'shock',
    label = 'Electrical boxes',
    blurb = 'Strip the copper wire out of a street electrical box. It might still be live.',
    defaults = config('model', {
        label = 'Strip the copper', duration = 10, minigame = 'mgc:wire_cut', difficulty = '1',
        anim = anim('mini@repair', 'fixing_a_ped', 1),
        models = {
            'prop_elecbox_01a', 'prop_elecbox_01b', 'prop_elecbox_02a', 'prop_elecbox_02b', 'prop_elecbox_03a', 'prop_elecbox_04a',
            'prop_elecbox_05a', 'prop_elecbox_06a', 'prop_elecbox_07a', 'prop_elecbox_08', 'prop_elecbox_08b', 'prop_elecbox_09',
            'prop_elecbox_10', 'prop_elecbox_11', 'prop_elecbox_12', 'prop_elecbox_13', 'prop_elecbox_14', 'prop_elecbox_15',
            'prop_elecbox_16', 'prop_elecbox_17', 'prop_elecbox_18', 'prop_elecbox_19', 'prop_elecbox_20', 'prop_elecbox_21',
            'prop_elecbox_22', 'prop_elecbox_23', 'prop_elecbox_24', 'prop_elecbox_24b', 'prop_elecbox_25',
        },
        items = { { any = { 'copper', 'copper_wire', 'copperwire', 'metalscrap' }, min = 2, max = 5, chance = 100 } },
        shock = 15,
        alert = 10, delay = 40, title = 'Copper theft',
        witness = 10, radius = 20,
        targetCooldown = 60, playerCooldown = 3,
    }),
})

define('aircon', {
    group = 'scrap', target = 'model', icon = 'fan', fa = 'fan', risk = 'shock',
    label = 'AC units',
    blurb = 'Pull the copper coil out of an air conditioning unit.',
    defaults = config('model', {
        label = 'Pull the copper coil', duration = 12, minigame = 'mgc:skill_bar', difficulty = '1',
        anim = anim('mini@repair', 'fixing_a_ped', 1),
        item = { any = { 'WEAPON_WRENCH', 'weapon_wrench' }, consume = false, breakChance = 0 },
        models = {
            'prop_aircon_s_01a', 'prop_aircon_s_02a', 'prop_aircon_s_02b', 'prop_aircon_s_03a', 'prop_aircon_s_03b', 'prop_aircon_s_04a',
            'prop_aircon_s_05a', 'prop_aircon_s_06a', 'prop_aircon_s_07a', 'prop_aircon_s_07b',
            'prop_aircon_m_01', 'prop_aircon_m_02', 'prop_aircon_m_03', 'prop_aircon_m_04', 'prop_aircon_m_05', 'prop_aircon_m_06',
            'prop_aircon_m_07', 'prop_aircon_m_08', 'prop_aircon_m_09', 'prop_aircon_m_10',
            'prop_aircon_l_01', 'prop_aircon_l_02', 'prop_aircon_l_03', 'prop_aircon_l_04',
        },
        items = { { any = { 'copper', 'copper_wire', 'copperwire', 'metalscrap' }, min = 3, max = 7, chance = 100 } },
        shock = 5,
        alert = 15, delay = 40, title = 'Copper theft',
        witness = 12, radius = 20,
        targetCooldown = 90, playerCooldown = 4,
    }),
})

define('shoplift', {
    group = 'shop', target = 'spot', icon = 'basket', fa = 'basket-shopping',
    label = 'Shoplifting',
    blurb = 'Pocket things off a shelf while the clerk is not looking.',
    defaults = config('spot', {
        label = 'Pocket something', duration = 3,
        anim = anim('mp_common', 'givetake1_a', 1),
        items = {
            { any = { 'sandwich', 'tosti', 'burger' }, min = 1, max = 2, chance = 60 },
            { any = { 'kurkakola', 'sprunk', 'water_bottle', 'water' }, min = 1, max = 2, chance = 60 },
        },
        alert = 5, delay = 20, onFail = true, title = 'Shoplifting',
        targetCooldown = 10, playerCooldown = 1,
    }),
})

define('till', {
    group = 'shop', target = 'spot', icon = 'register', fa = 'cash-register',
    label = 'Grab the till',
    blurb = 'Reach over the counter and empty the till while the clerk looks away.',
    defaults = config('spot', {
        label = 'Grab the till', duration = 4,
        anim = anim('oddjobs@shop_robbery@rob_till', 'loop', 1),
        cash = { 60, 250 },
        alert = 25, delay = 20, onFail = true, title = 'Till theft',
        targetCooldown = 30, playerCooldown = 10,
    }),
})

Petty.shopDefaults = {
    watch = 8,
    away = 7,
    jitter = 4,
    caught = 60,
    model = 'mp_m_shopkeep_01',
    clerks = {},
}

Petty.openDefaults = {
    {
        item = 'stolen_wallet', label = 'Going through the wallet', duration = 3, enabled = true,
        payout = { cash = { account = 'cash', min = 20, max = 160 }, items = {}, lootTable = '' },
    },
    {
        item = 'stolen_purse', label = 'Going through the bag', duration = 3, enabled = true,
        payout = { cash = { account = 'cash', min = 15, max = 120 }, items = { { item = 'phone', min = 1, max = 1, chance = 8 } }, lootTable = '' },
    },
    {
        item = 'stolen_package', label = 'Opening the package', duration = 4, enabled = true,
        payout = {
            cash = { account = 'cash', min = 0, max = 150 },
            items = {
                { item = 'phone', min = 1, max = 1, chance = 10 },
                { item = 'radio', min = 1, max = 1, chance = 10 },
            },
            lootTable = '',
        },
    },
}

local function deep(value)
    if type(value) ~= 'table' then return value end
    local out = {}
    for k, v in pairs(value) do out[k] = deep(v) end
    return out
end

local function firstOf(names)
    return names[1]
end

local function resolveItems(items, resolve)
    for _, entry in ipairs(items or {}) do
        if type(entry.any) == 'table' then
            entry.item = resolve(entry.any) or entry.any[1]
            entry.any = nil
        end
    end
end

function Petty.Defaults(id, resolve)
    local def = Petty.kinds[id]
    if not def then return nil end
    resolve = resolve or firstOf

    local cfg = deep(def.defaults)
    resolveItems(cfg.payout.items, resolve)
    if type(cfg.item.any) == 'table' then
        cfg.item.name = resolve(cfg.item.any) or cfg.item.any[1]
        cfg.item.any = nil
    end
    return cfg
end

function Petty.OpenDefaults(resolve)
    local out = deep(Petty.openDefaults)
    for _, entry in ipairs(out) do resolveItems(entry.payout.items, resolve or firstOf) end
    return out
end

local LIMITS = {
    duration = { 1, 120 },
    reach = { 0.5, 25 },
    police = { 0, 64 },
    ['anim.flag'] = { 0, 63 },
    ['item.breakChance'] = { 0, 100 },
    ['payout.cash.min'] = { 0, 10000000 },
    ['payout.cash.max'] = { 0, 10000000 },
    ['alert.chance'] = { 0, 100 },
    ['alert.delay'] = { 0, 600 },
    ['witness.chance'] = { 0, 100 },
    ['witness.radius'] = { 0, 100 },
    ['cooldown.target'] = { 0, 1440 },
    ['cooldown.player'] = { 0, 1440 },
    ['victim.notice'] = { 0, 100 },
    ['victim.fight'] = { 0, 100 },
    ['victim.resist'] = { 0, 100 },
    ['vehicles.alarm'] = { 0, 100 },
    shock = { 0, 100 },
}

local ENUMS = {
    ['anim.mode'] = { anim = true, scenario = true, none = true },
    ['peds.gender'] = { any = true, male = true, female = true },
    ['payout.cash.account'] = { cash = true, dirty = true, bank = true },
    difficulty = { ['1'] = true, ['2'] = true, ['3'] = true },
}

local function trim(value)
    return (tostring(value):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function number(value, path, fallback)
    local n = tonumber(value)
    if n == nil or n ~= n then return fallback end
    local range = LIMITS[path]
    if range then
        if n < range[1] then n = range[1] end
        if n > range[2] then n = range[2] end
    end
    return n
end

local function text(value, fallback, max)
    if type(value) == 'number' then value = tostring(value) end
    if type(value) ~= 'string' then return fallback end
    return trim(value):sub(1, max or 64)
end

local function models(value)
    local out, seen = {}, {}
    if type(value) ~= 'table' then return out end
    for _, m in ipairs(value) do
        local entry = nil
        if type(m) == 'number' then
            entry = math.floor(m)
        elseif type(m) == 'string' and trim(m) ~= '' then
            entry = trim(m):sub(1, 64)
            if entry:match('^%-?%d+$') then entry = math.floor(tonumber(entry)) end
        end
        if type(entry) == 'number' and entry > 2147483647 then entry = entry - 4294967296 end
        if type(entry) == 'number' then entry = math.tointeger(entry) or entry end
        if entry ~= nil and not seen[tostring(entry)] and #out < 100 then
            seen[tostring(entry)] = true
            out[#out + 1] = entry
        end
    end
    return out
end

local function classes(value)
    local out, seen = {}, {}
    if type(value) ~= 'table' then return out end
    for _, c in ipairs(value) do
        local n = tonumber(c)
        if n and n >= 0 and n <= 22 and not seen[math.floor(n)] then
            seen[math.floor(n)] = true
            out[#out + 1] = math.floor(n)
        end
    end
    table.sort(out)
    return out
end

local function coordsOf(entry)
    local x, y, z = tonumber(entry.x), tonumber(entry.y), tonumber(entry.z)
    if not x or not y or not z then return nil end
    return x, y, z, tonumber(entry.h) or 0.0
end

local function spots(value)
    local out, seen = {}, {}
    if type(value) ~= 'table' then return out end
    for i, entry in ipairs(value) do
        if type(entry) == 'table' and #out < 300 then
            local x, y, z, h = coordsOf(entry)
            if x then
                local id = text(entry.id, '', 32)
                if id == '' or seen[id] then
                    local n = i
                    repeat id = 'spot_' .. n n = n + 1 until not seen[id]
                end
                seen[id] = true
                out[#out + 1] = {
                    id = id,
                    label = text(entry.label, '', 48),
                    shop = text(entry.shop, '', 48),
                    x = x, y = y, z = z, h = h,
                }
            end
        end
    end
    return out
end

local function items(value)
    local out = {}
    if type(value) ~= 'table' then return out end
    for _, entry in ipairs(value) do
        if type(entry) == 'table' and #out < 20 then
            local name = text(entry.item, '', 64)
            if name ~= '' then
                local low = math.floor(math.max(1, math.min(1000, tonumber(entry.min) or 1)))
                local high = math.floor(math.max(low, math.min(1000, tonumber(entry.max) or low)))
                out[#out + 1] = {
                    item = name,
                    min = low,
                    max = high,
                    chance = math.floor(math.max(0, math.min(100, tonumber(entry.chance) or 100))),
                }
            end
        end
    end
    return out
end

local LISTS = {
    ['peds.models'] = models,
    ['peds.exclude'] = models,
    ['models'] = models,
    ['vehicles.classes'] = classes,
    ['spots'] = spots,
    ['payout.items'] = items,
}

local function overlay(path, defaults, input, out)
    for key, fallback in pairs(defaults) do
        local p = path == '' and key or (path .. '.' .. key)
        local value = nil
        if type(input) == 'table' then value = input[key] end

        if LISTS[p] then
            if value ~= nil then out[key] = LISTS[p](value) else out[key] = fallback end
        elseif type(fallback) == 'table' then
            out[key] = {}
            overlay(p, fallback, value, out[key])
        elseif type(fallback) == 'number' then
            out[key] = number(value, p, fallback)
        elseif type(fallback) == 'boolean' then
            if value == nil then out[key] = fallback else out[key] = value == true end
        else
            local s = text(value, fallback, (p == 'label' or p == 'alert.title') and 48 or 96)
            if ENUMS[p] and not ENUMS[p][s] then s = fallback end
            out[key] = s
        end
    end
end

function Petty.Clean(id, input, resolve)
    local defaults = Petty.Defaults(id, resolve)
    if not defaults then return nil end

    local out = {}
    overlay('', defaults, type(input) == 'table' and input or {}, out)

    if out.label == '' then out.label = defaults.label end
    if out.alert.title == '' then out.alert.title = defaults.alert.title end
    if out.alert.code == '' then out.alert.code = defaults.alert.code end
    if out.payout.cash.min > out.payout.cash.max then out.payout.cash.min = out.payout.cash.max end
    out.duration = math.floor(out.duration * 10 + 0.5) / 10
    out.police = math.floor(out.police)

    if Minigames and Minigames.list and not Minigames.list[out.minigame] then
        out.minigame = 'none'
    end

    return out
end

function Petty.CleanShops(input)
    input = type(input) == 'table' and input or {}
    local d = Petty.shopDefaults
    local function clamp(v, lo, hi, fallback)
        local n = tonumber(v)
        if not n then return fallback end
        return math.floor(math.max(lo, math.min(hi, n)))
    end

    local clerks = {}
    for i, entry in ipairs(type(input.clerks) == 'table' and input.clerks or {}) do
        if type(entry) == 'table' and #clerks < 100 then
            local x, y, z, h = coordsOf(entry)
            if x then
                clerks[#clerks + 1] = {
                    id = text(entry.id, '', 32) ~= '' and text(entry.id, '', 32) or ('clerk_' .. i),
                    shop = text(entry.shop, '', 48),
                    x = x, y = y, z = z, h = h,
                }
            end
        end
    end

    local model = text(input.model, d.model, 64)
    if model == '' then model = d.model end

    return {
        watch = clamp(input.watch, 1, 120, d.watch),
        away = clamp(input.away, 1, 120, d.away),
        jitter = clamp(input.jitter, 0, 60, d.jitter),
        caught = clamp(input.caught, 0, 100, d.caught),
        model = model,
        clerks = clerks,
    }
end

function Petty.CleanOpenables(input, resolve)
    if type(input) ~= 'table' or type(input.list) ~= 'table' then
        return { list = Petty.OpenDefaults(resolve) }
    end

    local out, seen = {}, {}
    for _, entry in ipairs(input.list) do
        if type(entry) == 'table' and #out < 20 then
            local name = text(entry.item, '', 64)
            if name ~= '' and not seen[name] then
                seen[name] = true
                local payout = type(entry.payout) == 'table' and entry.payout or {}
                local cash = type(payout.cash) == 'table' and payout.cash or {}
                local high = math.floor(math.max(0, math.min(10000000, tonumber(cash.max) or 0)))
                local account = text(cash.account, 'cash', 16)
                if not ENUMS['payout.cash.account'][account] then account = 'cash' end
                out[#out + 1] = {
                    item = name,
                    label = text(entry.label, '', 48) ~= '' and text(entry.label, '', 48) or 'Going through it',
                    duration = math.floor(math.max(1, math.min(30, tonumber(entry.duration) or 3))),
                    enabled = entry.enabled ~= false,
                    payout = {
                        cash = {
                            account = account,
                            min = math.floor(math.max(0, math.min(high, tonumber(cash.min) or 0))),
                            max = high,
                        },
                        items = items(payout.items),
                        lootTable = text(payout.lootTable, '', 64),
                    },
                }
            end
        end
    end

    return { list = out }
end

function Petty.Catalogue(resolve)
    local kinds = {}
    for _, id in ipairs(Petty.order) do
        local def = Petty.kinds[id]
        kinds[#kinds + 1] = {
            id = id, group = def.group, target = def.target, icon = def.icon, risk = def.risk,
            label = def.label, blurb = def.blurb,
            defaults = Petty.Defaults(id, resolve),
        }
    end

    return {
        groups = Petty.groups,
        classes = Petty.classes,
        kinds = kinds,
        shops = Petty.CleanShops(nil),
        openables = { list = Petty.OpenDefaults(resolve) },
    }
end

function Petty.Unsigned(hash)
    hash = tonumber(hash)
    if not hash then return nil end
    hash = math.floor(hash)
    if hash < 0 then hash = hash + 4294967296 end
    return hash
end

function Petty.Hash(model)
    if type(model) == 'number' then return Petty.Unsigned(model) end
    if type(model) ~= 'string' or model == '' then return nil end
    if model:match('^%-?%d+$') then return Petty.Unsigned(tonumber(model)) end
    return Petty.Unsigned(GetHashKey(model))
end

function Petty.HashSet(list)
    local set = {}
    for _, m in ipairs(list or {}) do
        local h = Petty.Hash(m)
        if h then set[h] = true end
    end
    return set
end

function Petty.Seed(name)
    local h = 0
    name = tostring(name or '')
    for i = 1, #name do
        h = (h * 31 + name:byte(i)) % 1000003
    end
    return h % 997
end

function Petty.ShopKey(name)
    if type(name) ~= 'string' then return nil end
    name = trim(name):lower()
    if name == '' then return nil end
    return 'shop:' .. name
end

function Petty.ClerkName(kind, spot)
    return (spot and Petty.ShopKey(spot.shop)) or ('%s:%s'):format(kind, spot and spot.id or '?')
end

function Petty.Clerk(name, t, shops)
    shops = shops or Petty.shopDefaults
    local watch = math.max(1, math.floor(tonumber(shops.watch) or 8))
    local away = math.max(1, math.floor(tonumber(shops.away) or 7))
    local jitter = math.max(0, math.floor(tonumber(shops.jitter) or 0))
    local cycle = watch + away + jitter
    local seed = Petty.Seed(name)

    local function start(index)
        local shift = math.floor((index * 7919.0 + seed * 104729.0) % 10007.0) % (jitter + 1)
        return math.max(1, watch + shift - math.floor(jitter / 2))
    end

    local tt = (tonumber(t) or 0) + seed
    local index = math.floor(tt / cycle)
    local pos = tt - index * cycle
    local from = start(index)
    local to = from + away

    if pos >= from and pos < to then
        return { state = 'away', left = to - pos, window = index }
    end

    if pos < from then
        return { state = 'watching', left = from - pos }
    end
    return { state = 'watching', left = cycle - pos + start(index + 1) }
end
