Contacts = { access = {} }

local function now()
    return os.time()
end

function Contacts.Grant(citizenid, robberyId, minutes, locationId)
    Contacts.access[citizenid] = Contacts.access[citizenid] or {}
    Contacts.access[citizenid][robberyId] = {
        untilAt = now() + math.floor(minutes * 60),
        locationId = locationId,
    }
end

function Contacts.Allowed(citizenid, location)
    local def = Store.Get(location.robberyId)
    if not Store.NeedsContact(def) then return true end

    local grant = (Contacts.access[citizenid] or {})[location.robberyId]
    if not grant or now() > grant.untilAt then return false end
    if grant.locationId and grant.locationId ~= location.id then return false end
    return true
end

function Contacts.Consume(citizenid, robberyId)
    if citizenid and Contacts.access[citizenid] then
        Contacts.access[citizenid][robberyId] = nil
    end
end

local function placeFor(def, contact, from)
    if Store.Anchor(def).kind == 'model' then return nil end

    local sends = contact.sends or 'any'
    if sends == 'any' then return nil end

    local places = {}
    for _, loc in ipairs(Store.LocationsFor(def.id)) do
        if loc.enabled then places[#places + 1] = loc end
    end
    if #places == 0 then return nil end

    if sends == 'random' then return places[math.random(#places)] end

    local best, bestDist = nil, math.huge
    for _, loc in ipairs(places) do
        local o = loc.origin
        local d = #(from - vector3(o.x or 0.0, o.y or 0.0, o.z or 0.0))
        if d < bestDist then best, bestDist = loc, d end
    end
    return best
end

lib.callback.register('XS-Robberies:talk', function(src, robberyId)
    local def = Store.Get(robberyId)
    if not def or not def.enabled or not Store.NeedsContact(def) then
        return { ok = false, error = T('contactBusy') }
    end

    local contact = def.contact
    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return { ok = false, error = T('notRightNow') } end

    local here = GetEntityCoords(GetPlayerPed(src))
    local at = contact.coords
    if #(here - vector3(at.x or 0.0, at.y or 0.0, at.z or 0.0)) > 6.0 then
        return { ok = false, error = T('tooFar') }
    end

    if Settings.KillSwitch() then return { ok = false, error = T('contactBusy') } end
    if Settings.Blacklisted(citizenid) then return { ok = false, error = T('blacklisted') } end
    if Framework.IsBlockedJob(src) then return { ok = false, error = T('blockedJob') } end

    local gates = def.gates or {}
    if Framework.CountPolice(gates.policeOnDuty ~= false) < (gates.policeRequired or 0) then
        return { ok = false, error = T('contactNoPolice') }
    end

    local key = ('%s:%s'):format(citizenid, def.id)
    local left = Runs.CooldownLeft('contact', key)
    if left > 0 then return { ok = false, error = T('contactCooling', math.ceil(left / 60)) } end

    left = Runs.PlayerCooldownLeft(citizenid, { robberyId = def.id, category = def.category, gates = gates })
    if left > 0 then return { ok = false, error = T('playerCooling', math.ceil(left / 60)) } end

    local truckJob = Store.Spawns(def) ~= nil
    if truckJob then
        if Trucks.ForRobbery(def.id) then return { ok = false, error = T('truckOut') } end
        left = Runs.CooldownLeft('location', 'truck:' .. def.id)
        if left > 0 then return { ok = false, error = T('locationCooling', math.ceil(left / 60)) } end
    end

    local item = contact.item
    if item and item ~= '' and not Inv.Has(src, item) then
        return { ok = false, error = T('contactItem') }
    end

    local fee = math.floor(tonumber(contact.fee) or 0)
    if fee > 0 then
        local account = contact.feeAccount == 'bank' and 'bank' or 'cash'
        if not Framework.RemoveMoney(src, account, fee, 'robbery-contact') then
            return { ok = false, error = T('contactFee', fee) }
        end
    end

    if item and item ~= '' and contact.takeItem then
        Inv.Remove(src, item, 1)
    end

    local minutes = math.max(1, tonumber(contact.window) or 30)

    if truckJob then
        Contacts.Grant(citizenid, def.id, minutes, nil)
        local truck, at = Trucks.Send(src, def, here)

        if not truck then
            Contacts.Consume(citizenid, def.id)
            if fee > 0 then
                Framework.AddMoney(src, contact.feeAccount == 'bank' and 'bank' or 'cash', fee, 'robbery-contact-refund')
            end
            if item and item ~= '' and contact.takeItem then Inv.Add(src, item, 1) end
            return { ok = false, error = at }
        end

        local cooldown = tonumber(contact.cooldown) or 0
        if cooldown > 0 then Runs.Cooldown('contact', key, math.floor(cooldown * 60)) end

        return {
            ok = true,
            robberyId = def.id,
            name = contact.name,
            line = contact.line,
            minutes = minutes,
            truck = truck.id,
            coords = at,
            waypoint = contact.waypoint ~= false,
        }
    end

    local place = placeFor(def, contact, here)

    Contacts.Grant(citizenid, def.id, minutes, place and place.id or nil)

    local cooldown = tonumber(contact.cooldown) or 0
    if cooldown > 0 then Runs.Cooldown('contact', key, math.floor(cooldown * 60)) end

    return {
        ok = true,
        robberyId = def.id,
        name = contact.name,
        line = contact.line,
        minutes = minutes,
        locationId = place and place.id or nil,
        coords = place and place.origin or nil,
        waypoint = contact.waypoint ~= false,
    }
end)

AddEventHandler('playerDropped', function()
    local citizenid = Framework.GetCitizenId(source)
    if citizenid then Contacts.access[citizenid] = nil end
end)
