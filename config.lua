Config = {}

-- Force a bridge instead of auto-detecting. 'auto' is almost always right.
Config.Bridges = {
    framework = 'auto',   -- auto | qbox | qbcore
    inventory = 'auto',   -- auto | ox_inventory | qb-inventory | qs-inventory | codem-inventory | core_inventory | ps-inventory
    target    = 'auto',   -- auto | ox_target | qb-target | builtin
    dispatch  = 'auto',   -- auto | XS-Dispatch | ps-dispatch | qs-dispatch | cd_dispatch | core_dispatch | rcore_dispatch | linden_outlawalert | none
    doorlock  = 'auto',   -- auto | ox_doorlock | qb-doorlock | nui_doorlock | jd_doorlock | none
}

-- Nothing about a robbery is hard-coded here. Everything — locations, stages,
-- timers, items, payouts, police response — is built in-game and stored in the
-- database. This file is only the parts that apply to the whole resource.

Config.Debug = false

-- ── Opening the builder ──────────────────────────────────────────────────────
-- The builder is the NUI. This command only opens it; nothing is placed or
-- configured from chat.
Config.Builder = {
    Command = 'robberies',

    -- Also bind a key. Leave empty for none. Players who are not admins never
    -- get the binding registered.
    KeyBind = '',

    -- Admins can place points through walls and fly further from themselves.
    -- Metres. Raise it for large interiors.
    PlacementRange = 60.0,

    -- Placement camera speed, metres per second at normal / shift / alt.
    CameraSpeed = { normal = 8.0, fast = 24.0, slow = 0.8 },

    -- Snap a placed point down to ground height. Off is right almost always:
    -- the placement ray already lands on the surface you are looking at, and
    -- ground height ignores interior floors, so snapping indoors drops the
    -- point through the floor. G toggles it while placing.
    SnapToGround = false,

    -- Nudge step in metres when adjusting a placed point with the arrow keys.
    NudgeStep = 0.05,
}

-- Who can open the builder. Any one of these passing is enough.
Config.Admin = {
    acePermission = 'xs.robberies',
    groups        = { 'admin', 'god' },
    licenses      = {},
}

-- ── Who can rob ──────────────────────────────────────────────────────────────
-- The only permanent restriction. Everything else is set per robbery in the
-- builder. Emergency services cannot start or progress a run whatever their
-- duty state, because "off duty" is a checkbox and this should not be.
Config.BlockedJobs = { 'police', 'sheriff', 'ambulance', 'fire' }

-- Does going off duty lift that block?
-- false (default) - anyone holding one of those jobs is blocked, on duty or not.
-- true            - only on-duty emergency services are blocked, so an officer
--                   who clocks off can rob. Set this if your server treats duty
--                   as the line between the character's job and their own time.
Config.BlockedJobsRespectDuty = false

-- Who receives a robbery alert. Only these jobs ever see a dispatch call or the
-- fallback notification.
Config.PoliceJobs = { 'police', 'sheriff', 'bcso', 'sast' }

-- ── Payouts ──────────────────────────────────────────────────────────────────
Config.Payout = {
    -- How a job can pay. The owner picks one per job in the builder, and any
    -- single step can be set to pay differently.
    Accounts = {
        { id = 'cash',  label = 'Cash' },
        { id = 'dirty', label = 'Dirty money' },
        { id = 'bank',  label = 'Bank' },
    },

    -- The item a job pays in when it is set to dirty money.
    DirtyItem = 'markedbills',

    -- How that item carries the money.
    -- 'worth' - one item per payout with the amount stored on it, the way
    --           QBCore and Qbox markedbills work. Laundering scripts read it.
    -- 'count' - a stack of items, DirtyPer dollars each. Use this for a
    --           black_money style item with DirtyPer = 1.
    DirtyMode = 'worth',
    DirtyPer  = 1,

    -- Multiplies every payout on the server. For tuning an economy without
    -- reopening every stage. 1.0 = exactly what the builder says.
    GlobalMultiplier = 1.0,
}

-- ── Runs ─────────────────────────────────────────────────────────────────────
Config.Run = {
    -- A run with nobody near it for this many seconds ends itself. Stops one
    -- abandoned attempt from locking a location until a restart.
    AbandonAfter = 600,

    -- How far from the robbery origin a participant can be before they stop
    -- counting as present. Metres.
    PresenceRadius = 120.0,

    -- Hard cap on a single run, seconds. 0 = none.
    MaxDuration = 3600,

    -- Cash from a stage goes into a pot that only pays out when the crew
    -- reaches the escape zone. Off pays each stage the moment it is finished.
    -- Loot items are always handed over at the stage itself, so anyone caught
    -- on the way out is caught holding them.
    PayoutOnEscape = true,

    -- What a loot container asks for when the owner ticks "Requires a bag".
    BagItem = 'bag',

    -- Log finished runs to the database. History panel reads this.
    LogRuns = true,

    -- Optional Discord webhook for run logs. Empty = off.
    Webhook = '',
}

-- ── Police paperwork ─────────────────────────────────────────────────────────
-- An alarm can open an incident in the MDT by itself, the way a monitoring
-- company would phone one in. Officers get a case to work rather than a blip
-- that vanishes. Needs XS-MDT; ignored quietly without it.
Config.Integrations = {
    Mdt = true,

    -- Which MDT to talk to. 'auto' takes the first one that is running.
    -- 'XS-MDT' and 'generic' ship with it; anything registered by another
    -- resource can be named here too. 'none' turns it off.
    Provider = 'auto',

    -- Point this at any MDT that can make an incident from a plain table.
    -- Nothing here is guessed for you — use the export names your MDT documents.
    -- The table it receives has: title, narrative, location, severity, status,
    -- actorName, code, coords, robberyId. Whatever your export returns is passed
    -- straight back to noteExport later, so it can be an id, a table, anything.
    Generic = {
        resource     = '',   -- e.g. 'ps-mdt'
        createExport = '',   -- e.g. 'CreateIncident'
        noteExport   = '',   -- optional. Called as (handle, text)
    },

    -- Same idea for a dispatch resource none of the built-in ones cover. It is
    -- called on the officer's client with a table of: coords, code, title,
    -- description, sprite, colour, radius, priority, jobs, blipTime.
    GenericDispatch = {
        resource = '',       -- e.g. 'my-dispatch'
        export   = '',       -- e.g. 'CustomAlert'
    },

    -- Add a closing note when the run ends, saying how it went and who was seen.
    MdtOutcome = true,

    -- Severity on the incident it files. Leave nil for the MDT's own default.
    MdtSeverity = nil,
}

-- ── Interacting without a target resource ────────────────────────────────────
-- ox_target and qb-target are used when you have one. With neither, this is
-- what players get: a marker on the point and a key prompt when they reach it.
Config.Interaction = {
    Key      = 38,      -- E
    MarkerType   = 21,
    MarkerColour = { 90, 162, 255 },
    MarkerScale  = 0.22,
    MarkerZ      = 0.9, -- how far above the point the marker floats

    DrawDistance     = 8.0,
    InteractDistance = 1.6,
}

-- ── Props and NPCs ───────────────────────────────────────────────────────────
-- Switch off every scene prop or every NPC a job places, on the whole server.
-- Props and peds that belong to a step (a till prop, a clerk, a guard) are part
-- of the job and are not affected.
Config.Scene = {
    Props = true,
    Npcs  = true,

    -- How far away a player can be before a place's props and NPCs appear.
    -- Metres past the job's own radius.
    SpawnDistance = 60.0,
}

-- ── Sound ────────────────────────────────────────────────────────────────────
-- Native GTA sounds. Nothing to ship, nothing to stream.
Config.Sounds = {
    Enabled = true,

    -- Repeats at the shop while the alarm is up, so anyone walking past hears
    -- it, not just the crew. A silent alarm makes no sound, which is the point.
    Alarm = {
        Enabled  = true,
        name     = 'Beep_Red',
        set      = 'DLC_HEIST_HACKING_SNAKE_SOUNDS',
        interval = 1200,
        range    = 60.0,
    },

    Events = {
        stageDone   = { name = 'CHECKPOINT_PERFECT',  set = 'HUD_MINI_GAME_SOUNDSET' },
        stageFailed = { name = 'CHECKPOINT_MISSED',   set = 'HUD_MINI_GAME_SOUNDSET' },
        codeFound   = { name = 'TIMER_STOP',          set = 'HUD_MINI_GAME_SOUNDSET' },
        runComplete = { name = 'ROBBERY_MONEY_TOTAL', set = 'HUD_FRONTEND_CUSTOM_SOUNDSET' },
    },
}

-- ── Minigames ────────────────────────────────────────────────────────────────
-- Which minigame backends to offer in the builder. Ones whose resource is not
-- running are shown greyed out rather than hidden, so an owner can see what
-- they would get by installing it.
Config.Minigames = {
    -- Our own. No dependency, always available.
    xs = true,

    -- Other minigame resources. Each one only shows up as ready when it is
    -- running. Set one to false to hide it from the builder.
    ox_lib                 = true,
    ['ps-ui']              = true,   -- ps-ui, or ps_lib which provides the same calls
    bl_ui                  = true,
    ['qb-minigames']       = true,
    glow_minigames         = true,
    utk_fingerprint        = true,
    ['ultra-voltlab']      = true,
    mhacking               = true,
    ['SN-Hacking']         = true,
    boii_minigames         = true,
    memorygame             = true,
    ['howdy-hackminigame'] = true,
}

-- ── Notifications ────────────────────────────────────────────────────────────
Config.NotifyStyle = {
    title    = 'Robbery',
    position = 'top',
    duration = 5000,
    icons = {
        inform  = { icon = 'circle-info',           color = '#5aa2ff' },
        success = { icon = 'circle-check',          color = '#30d158' },
        error   = { icon = 'circle-exclamation',    color = '#ff5a5f' },
        warning = { icon = 'triangle-exclamation',  color = '#f5a524' },
    },
}


-- ── What players read ────────────────────────────────────────────────────────
-- Every line the script says to a player. Rewrite them in your own voice, or
-- another language. The %d and %s are filled in by the script — keep them, and
-- keep them in the same order.
Config.Text = {
    blockedJob      = 'Not while you are on that job.',
    killSwitch      = 'Not tonight.',
    blacklisted     = 'You are not doing this any more.',
    forcedEnd       = 'Whatever you were doing is over.',
    noPolice        = 'Not enough police around. %d of %d.',
    locationCooling = 'This place was hit recently. %d minutes.',
    playerCooling   = 'You need to lie low. %d minutes.',
    globalCooling   = 'Too soon after the last one. %d minutes.',
    crewFull        = 'That crew is already full.',
    laserHit        = 'You walked straight through the beam.',
    guardDown       = 'Shots fired at %s.',
    laserTripped    = 'Sensor tripped at %s.',
    lostTool        = 'Your %s is ruined.',
    crewTooSmall    = 'This one needs %d of you. There are %d here.',
    tooCloseToLast  = 'Somewhere too close to here was hit a moment ago.',
    notSetUp        = 'That place is not set up.',
    notThisJob      = 'That is not part of this job.',
    tooFar          = 'Too far away.',
    alreadyDone     = 'Already done.',
    locked          = 'Something else has to happen first.',
    empty           = 'Nothing left in there yet.',
    needItem        = 'You do not have what you need for this.',
    containerEmpty  = 'There is nothing left in there.',
    needBag         = 'You need something to carry this in.',
    unpaired        = 'This point was never paired with another.',
    outOfTime       = 'You took too long.',
    needVehicle     = 'You need to be in a vehicle.',
    tooQuick        = 'That was too quick.',
    walkedAway      = 'You left it.',
    badToken        = 'That attempt is not valid.',
    runOver         = 'That job is over.',
    stageGone       = 'That stage is gone.',
    notRightNow     = 'Not right now.',
    serverSilent    = 'The server did not answer. Check the server console.',
    aimFirst        = 'Aim at them first.',
    youStopped      = 'You stopped.',
    holdFailed      = 'You did not hold it.',
    didNotCount     = 'That did not count.',
    stageFailed     = 'That went wrong.',
    pedFled         = 'They ran for it.',
    runComplete     = 'Clear. Get out of the area.',
    grabsLeft       = '%d more in there.',
    paid            = 'You took $%d.',
    crewShare       = 'Your cut: $%d.',
    stageDone       = 'Done.',
    codeFound       = 'Written down here: %s',
    retryLeft       = 'That slipped. %d left.',
    heardNearby     = 'You hear something being worked on nearby.',
    partnerReady    = 'Someone is on the other one. Go.',
    partnerNeeded   = 'Nobody is on %s yet. You both have to hold at once.',
}
-- ── Defaults for a new robbery ───────────────────────────────────────────────
-- What the builder pre-fills when someone clicks Create. Owners change any of
-- it per robbery; this only decides where they start from.
Config.Defaults = {
    category = 'store',
    radius   = 30.0,

    -- cash | dirty | bank
    payoutAccount = 'cash',

    blip = { sprite = 500, colour = 1, scale = 0.8, showWhen = 'during' },

    gates = {
        policeRequired  = 2,
        policeOnDuty    = true,
        minCrew         = 1,
        maxCrew         = 6,
        locationCooldown = 1800,
        playerCooldown   = 900,
        globalCooldown   = 0,
        proximityMetres  = 0,
        proximitySeconds = 0,
    },

    response = {
        alarm            = 'instant',   -- instant | delayed | silent | none
        alarmDelay       = 30,
        camerasChangeTo  = 'delayed',
        powerChangesTo   = 'silent',
        dispatchOnFail   = true,
        repeatAlert      = 120,
        code             = '10-90',
        title            = 'Store Robbery',
    },
}
