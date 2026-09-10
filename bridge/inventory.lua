Inv = { name = nil }

if not Config then return end

local IS_SERVER = IsDuplicityVersion()

local DETECT_ORDER = {
    'ox_inventory', 'qb-inventory', 'qs-inventory',
    'codem-inventory', 'core_inventory', 'ps-inventory',
}

do
    local forced = Config.Bridges and Config.Bridges.inventory or 'auto'
    if forced ~= 'auto' then
        Inv.name = forced
    else
        for _, r in ipairs(DETECT_ORDER) do
            if GetResourceState(r) == 'started' then Inv.name = r break end
        end
    end

    if not Inv.name then
        print('^1[XS-Robberies]^0 No supported inventory found. Start one of: ' .. table.concat(DETECT_ORDER, ', '))
    end
end

if IS_SERVER then
    function Inv.Count(src, item)
        if not item or item == '' then return 0 end

        if Inv.name == 'ox_inventory' then
            return exports.ox_inventory:Search(src, 'count', item) or 0
        end

        local player = Framework.GetPlayer(src)
        if not player then return 0 end

        if Inv.name == 'qs-inventory' then
            return exports['qs-inventory']:GetItemTotalAmount(src, item) or 0
        end

        local slot = player.Functions.GetItemByName(item)
        return slot and slot.amount or 0
    end

    function Inv.Has(src, item, count)
        if not item or item == '' then return true end
        return Inv.Count(src, item) >= (count or 1)
    end

    function Inv.Add(src, item, count, metadata)
        if not item or item == '' then return false end
        count = count or 1

        if Inv.name == 'ox_inventory' then
            return exports.ox_inventory:AddItem(src, item, count, metadata) and true or false
        end

        local player = Framework.GetPlayer(src)
        if not player then return false end
        return player.Functions.AddItem(item, count, nil, metadata) and true or false
    end

    function Inv.Remove(src, item, count)
        if not item or item == '' then return true end
        count = count or 1

        if Inv.name == 'ox_inventory' then
            return exports.ox_inventory:RemoveItem(src, item, count) and true or false
        end

        local player = Framework.GetPlayer(src)
        if not player then return false end
        return player.Functions.RemoveItem(item, count) and true or false
    end

    function Inv.Damage(src, item, percent)
        if not item or item == '' or (percent or 0) <= 0 then return end

        if Inv.name ~= 'ox_inventory' then
            return
        end

        local slots = exports.ox_inventory:Search(src, 'slots', item)
        local slot = slots and slots[1]
        if not slot then return end

        local metadata = slot.metadata or {}
        local left = (metadata.durability or 100) - percent

        if left <= 0 then
            exports.ox_inventory:RemoveItem(src, item, 1, nil, slot.slot)
            return
        end

        metadata.durability = left
        exports.ox_inventory:SetMetadata(src, slot.slot, metadata)
    end

    function Inv.Items()
        local out = {}

        if Inv.name == 'ox_inventory' then
            for name, data in pairs(exports.ox_inventory:Items() or {}) do
                out[#out + 1] = { name = name, label = data.label or name }
            end
        elseif Framework.name == 'qbox' then
            for name, data in pairs(exports.qbx_core:GetItems() or {}) do
                out[#out + 1] = { name = name, label = data.label or name }
            end
        elseif Framework.core then
            for name, data in pairs(Framework.core.Shared.Items or {}) do
                out[#out + 1] = { name = name, label = data.label or name }
            end
        end

        table.sort(out, function(a, b) return a.label < b.label end)
        return out
    end

    function Inv.Exists(item)
        if not item or item == '' then return true end
        for _, entry in ipairs(Inv.Items()) do
            if entry.name == item then return true end
        end
        return false
    end
end

if Config.Debug then
    print(('^2[XS-Robberies]^0 inventory bridge loaded (%s) on %s'):format(
        Inv.name or 'none', IS_SERVER and 'server' or 'client'))
end
