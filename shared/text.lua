function T(key, ...)
    local line = (Config.Text or {})[key]
    if not line then return key end
    if select('#', ...) > 0 then return line:format(...) end
    return line
end
