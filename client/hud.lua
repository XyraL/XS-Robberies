Hud = { visible = false }

local function objectivesFor(state)
    local location = Locations[state.locationId]
    if not location then return {} end

    local done, unlocked = {}, {}
    for _, id in ipairs(state.done or {}) do done[id] = true end
    for _, id in ipairs(state.unlocked or {}) do unlocked[id] = true end

    local out = {}
    for _, stage in ipairs(location.stages or {}) do
        local def = Stages.Get(stage.type)
        out[#out + 1] = {
            id = stage.id,
            label = stage.label or (def and def.label) or stage.type,
            state = done[stage.id] and 'done' or (unlocked[stage.id] and 'open' or 'locked'),
            optional = (stage.opts or {}).optional == true,
            colour = def and def.colour or nil,
        }
    end
    return out
end

function Hud.Update(state)
    if not state then return end

    Hud.visible = true
    SendNUIMessage({
        action = 'hud',
        data = {
            label = state.label,
            alarm = state.alarm,
            alarmAt = state.alarmAt,
            startedAt = state.startedAt,
            escapeDeadline = state.escapeDeadline,
            serverTime = state.now or 0,
            objectives = objectivesFor(state),
        },
    })
end

function Hud.Hide()
    if not Hud.visible then return end
    Hud.visible = false
    SendNUIMessage({ action = 'hudHide' })
end
