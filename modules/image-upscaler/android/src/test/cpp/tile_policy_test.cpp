// Compile with a C++17 compiler and -fsyntax-only; assertions exercise the same
// policy used by JNI without requiring Android bitmaps or a Vulkan device.
#include "../../main/cpp/tile_policy.h"

using upscaler::limit_gpu_tile_size;

static_assert(limit_gpu_tile_size(400, true, true) == 100, "cap manual/high-budget automatic GPU tiles");
static_assert(limit_gpu_tile_size(300, true, true) == 100, "cap intermediate automatic GPU tiles");
static_assert(limit_gpu_tile_size(200, true, true) == 100, "cap manual GPU tiles at 200");
static_assert(limit_gpu_tile_size(100, true, true) == 100, "preserve tiles at the limit");
static_assert(limit_gpu_tile_size(32, true, true) == 32, "never increase low-budget automatic GPU tiles");
static_assert(limit_gpu_tile_size(400, true, false) == 400, "disabled limit preserves requested tiles");
static_assert(limit_gpu_tile_size(400, false, true) == 400, "CPU fallback ignores GPU limiting");
