local function allowed(src)
    if src == 0 then return true end
    return Framework.IsAdmin and Framework.IsAdmin(src)
end

local function say(src, text)
    if src == 0 then
        print(('^5[robberies]^0 %s'):format(text))
    else
        TriggerClientEvent('chat:addMessage', src, { args = { 'robberies', text } })
        print(('^5[robberies]^0 %s'):format(text))
    end
end

RegisterCommand('robberylist', function(src)
    if not allowed(src) then return end

    local rows = MySQL.query.await('SELECT id, name, enabled, revision FROM xs_robberies') or {}

    say(src, '---- id | name | live | crew | police | revision | locations ----')

    for _, row in ipairs(rows) do
        local def = Store.robberies[row.id]

        local sites, liveSites = 0, 0
        for _, loc in pairs(Store.locations) do
            if loc.robberyId == row.id then
                sites = sites + 1
                if loc.enabled then liveSites = liveSites + 1 end
            end
        end

        local g = (def and def.gates) or {}

        say(src, ('%-18s %-14s live=%-6s crew=%s-%s police=%s rev=%-4s sites=%d(%d on)'):format(
            row.id, row.name,
            tostring(def and def.enabled),
            tostring(g.minCrew or 1), tostring(g.maxCrew or '-'),
            tostring(g.policeRequired or 0),
            tostring(row.revision), sites, liveSites))
    end

    say(src, ('%d robberies. Use /robberylive <id> to switch one on from here.'):format(#rows))
end, false)

RegisterCommand('robberylive', function(src, args)
    if not allowed(src) then return end

    local id = args[1]
    if not id then
        say(src, 'Which one? /robberylive <id>. Run /robberylist for the ids.')
        return
    end

    local def = Store.robberies[id]
    if not def then
        say(src, ('No robbery with the id "%s".'):format(id))
        return
    end

    say(src, ('before: memory=%s'):format(tostring(def.enabled)))

    def.enabled = true
    local ok, err = Store.Save(def, 'console')

    if not ok then
        say(src, ('^1Store.Save refused it: %s^0'):format(tostring(err)))
        return
    end

    local row = MySQL.single.await(
        'SELECT enabled, revision FROM xs_robberies WHERE id = ?', { id })

    if not row then
        say(src, '^1the row vanished after saving^0')
        return
    end

    say(src, ('after:  memory=%s database=%s revision=%s'):format(
        tostring(Store.robberies[id].enabled), tostring(row.enabled), tostring(row.revision)))

    if row.enabled == true or row.enabled == 1 then
        say(src, '^2the write landed. Reloading and resending to everyone.^0')
        Store.Load()
        SyncLocations()

        local reloaded = Store.robberies[id]
        say(src, ('after reload: memory=%s'):format(tostring(reloaded and reloaded.enabled)))
    else
        say(src, '^1the write did NOT land - the database still says it is off^0')
    end
end, false)
