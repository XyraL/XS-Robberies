local function line(text)
    print(('^5[robberies]^0 %s'):format(text))
end

local function distanceTo(coords)
    return #(GetEntityCoords(PlayerPedId()) - vector3(coords.x, coords.y, coords.z))
end

local function whyHidden(location, stage)
    if Framework.IsBlockedJob() then
        local job = Framework.GetJob()
        return ('hidden - you are on the %s job'):format(job and job.name or 'blocked')
    end

    if ActiveRun and ActiveRun.locationId ~= location.id then
        return 'hidden - you are already in a run somewhere else'
    end

    local live = PublicRuns[location.id]

    if not live then
        if #(stage.requires or {}) > 0 then
            return ('hidden - waits on %s, and nothing is running here yet')
                :format(table.concat(stage.requires, ', '))
        end
        return 'SHOWING - this one can start the run'
    end

    for _, id in ipairs(live.done or {}) do
        if id == stage.id then return 'hidden - already done in the run happening here' end
    end

    for _, id in ipairs(live.unlocked or {}) do
        if id == stage.id then return 'SHOWING' end
    end

    return ('hidden - waits on %s'):format(table.concat(stage.requires or {}, ', '))
end

RegisterCommand('robberydebug', function()
    local report = lib.callback.await('XS-Robberies:diagnose', false)
    if not report or not report.ok then
        line(('^1%s^0'):format(report and report.error or 'the server did not answer'))
        return
    end

    local coords = GetEntityCoords(PlayerPedId())
    local job = Framework.GetJob()

    print('^5-------------- XS-Robberies --------------^0')
    line(('you are at %.2f, %.2f, %.2f'):format(coords.x, coords.y, coords.z))
    if Framework.IsBlockedJob() then
        line(('job: %s ^1(BLOCKED - no robbery prompt will ever show)^0'):format(job and job.name or 'none'))
        line(('  on duty: %s. Config.BlockedJobsRespectDuty is %s, so %s'):format(
            tostring(job and job.onDuty),
            tostring(Config.BlockedJobsRespectDuty == true),
            Config.BlockedJobsRespectDuty
                and 'clocking off would lift this'
                or 'clocking off will NOT lift this - change job, or set that option true'))
    else
        line(('job: %s'):format(job and job.name or 'none'))
    end
    line(('target backend: %s'):format(Target.name or 'none'))

    print('')
    line('^3server side^0')
    line(('  robberies: %d, of which live: %d'):format(report.robberies, report.live))
    line(('  locations: %d, of which sent to clients: %d'):format(report.locations, report.sent))

    for _, entry in ipairs(report.blocked or {}) do
        line(('  ^1not sent^0: "%s" - %s'):format(entry.label, entry.reason))
    end

    print('')
    line('^3robberies: database vs memory^0')
    for _, entry in ipairs(report.stored or {}) do
        line(('  %-20s db=%s memory=%s rev=%s %s'):format(
            entry.name, tostring(entry.db), tostring(entry.memory), tostring(entry.revision),
            entry.agrees and '' or '^1<- THESE DISAGREE, the save is not sticking^0'))
    end

    line('^3locations in the database^0')
    for _, entry in ipairs(report.storedLocations or {}) do
        line(('  %-20s robbery=%-16s enabled=%s'):format(
            entry.label, entry.robbery_id, tostring(entry.enabled)))
    end

    print('')
    line('^3this client^0')

    local count = 0
    for _ in pairs(Locations) do count = count + 1 end
    line(('  locations received: %d'):format(count))

    if count == 0 then
        line('  ^1nothing to build. If the server says it sent some, restart the resource.^0')
        print('^5----------------------------------------------^0')
        return
    end

    local nearest, nearestDist
    for _, location in pairs(Locations) do
        local dist = distanceTo(location.origin)
        if not nearestDist or dist < nearestDist then
            nearest, nearestDist = location, dist
        end
    end

    for _, location in pairs(Locations) do
        local dist = distanceTo(location.origin)
        local built = Zones and Zones[location.id] ~= nil
        line(('  "%s" - %.1fm away, %d stages, zones %s'):format(
            location.label, dist, #(location.stages or {}),
            built and '^2built^0' or (dist <= (location.radius or 30.0) + 60.0
                and '^1NOT BUILT (should be)^0' or 'not built (too far)')))
    end

    if nearest then
        print('')
        line(('^3nearest: %s^0'):format(nearest.label))

        if #(nearest.stages or {}) == 0 then
            line('  ^1this robbery has no stages placed, so there is nothing to target^0')
        end

        for _, stage in ipairs(nearest.stages or {}) do
            line(('  %-22s %-10s %5.1fm  %s'):format(
                stage.label or stage.id, stage.type, distanceTo(stage.coords), whyHidden(nearest, stage)))
        end
    end

    print('^5----------------------------------------------^0')
end, false)
