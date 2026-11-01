#pragma once

namespace upscaler {

// Apply after resolving automatic/manual tile size. Smaller automatic tiles and
// all CPU tiles keep their original size.
constexpr int limit_gpu_tile_size(int resolved_tile, bool use_gpu, bool limit_enabled) {
    return use_gpu && limit_enabled && resolved_tile > 100 ? 100 : resolved_tile;
}

}  // namespace upscaler
