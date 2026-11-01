#include "../../main/cpp/cpu_policy.h"

using upscaler::resolve_cpu_policy;
using upscaler::resolve_cpu_threads;

static_assert(resolve_cpu_policy(0, 4, 4) == 0, "select all cores");
static_assert(resolve_cpu_policy(1, 4, 4) == 1, "select little cores");
static_assert(resolve_cpu_policy(2, 4, 4) == 2, "select big cores");
static_assert(resolve_cpu_policy(1, 0, 8) == 0, "missing little cluster falls back to all");
static_assert(resolve_cpu_policy(2, 0, 0) == 0, "missing big cluster falls back to all");
static_assert(resolve_cpu_threads(0, 8) == 8, "automatic uses selected core count");
static_assert(resolve_cpu_threads(8, 4) == 4, "clamp when switching to smaller cluster");
static_assert(resolve_cpu_threads(2, 4) == 2, "preserve explicit smaller count");
static_assert(resolve_cpu_threads(0, 0) == 1, "at least one worker");
