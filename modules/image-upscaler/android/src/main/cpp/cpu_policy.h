#pragma once

namespace upscaler {

constexpr int resolve_cpu_policy(int requested, int little, int big) {
    return requested == 1 && little > 0 ? 1 : requested == 2 && big > 0 ? 2 : 0;
}

constexpr int resolve_cpu_threads(int requested, int available) {
    return available < 1 ? 1 : requested < 1 || requested > available ? available : requested;
}

}  // namespace upscaler
