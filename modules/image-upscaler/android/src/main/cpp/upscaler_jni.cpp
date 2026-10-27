#include <jni.h>
#include <android/bitmap.h>

#include <atomic>
#include <mutex>
#include <string>
#include <vector>
#include <sched.h>

#include "cpu.h"
#include "gpu.h"

#include "realcugan.h"
#include "waifu2x.h"
#include "tile_policy.h"
#include "cpu_policy.h"

namespace {

std::mutex cpu_policy_mutex;

// ncnn changes OpenMP worker affinity as well as the calling thread. Restore the
// prior ncnn policy, OpenMP thread count and caller affinity on every exit path.
class CpuPolicyScope {
public:
    CpuPolicyScope(bool enabled, int policy) : enabled_(enabled) {
        if (!enabled_) return;
        lock_ = std::unique_lock<std::mutex>(cpu_policy_mutex);
        previous_policy_ = ncnn::get_cpu_powersave();
        previous_threads_ = ncnn::get_omp_num_threads();
        saved_affinity_ = sched_getaffinity(0, sizeof(affinity_), &affinity_) == 0;
        ok_ = ncnn::set_cpu_powersave(policy) == 0;
    }
    ~CpuPolicyScope() {
        if (!enabled_) return;
        ncnn::set_cpu_powersave(previous_policy_);
        ncnn::set_omp_num_threads(previous_threads_);
        if (saved_affinity_) sched_setaffinity(0, sizeof(affinity_), &affinity_);
    }
    bool ok() const { return ok_; }

private:
    bool enabled_;
    bool ok_ = true;
    bool saved_affinity_ = false;
    int previous_policy_ = 0;
    int previous_threads_ = 1;
    cpu_set_t affinity_;
    std::unique_lock<std::mutex> lock_;
};

int default_gpu_index() {
    static std::once_flag gpu_once;
    std::call_once(gpu_once, [] { ncnn::create_gpu_instance(); });
    return ncnn::get_gpu_count() > 0 ? ncnn::get_default_gpu_index() : -1;
}

std::string to_string(JNIEnv* env, jstring value) {
    const char* chars = env->GetStringUTFChars(value, nullptr);
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

// Prepadding and tile size policy follow the upstream main.cpp of each project
// (realcugan models-se / models-pro, waifu2x models-cunet).
int prepadding(bool realcugan, int scale, int noise) {
    if (realcugan) return scale == 2 ? 18 : scale == 3 ? 14 : 19;
    return noise != -1 && scale == 1 ? 28 : 18;
}

int auto_tile_size(bool realcugan, int scale, int gpuid) {
    if (gpuid == -1) return 400;
    uint32_t heap_budget = ncnn::get_gpu_device(gpuid)->get_heap_budget();
    if (realcugan) {
        // Heap budget needed for tile 400 / 300 / 200 / 100, per scale 2 / 3 / 4.
        static const uint32_t budgets[3][4] = {
            {1300, 800, 400, 200}, {3300, 1900, 950, 320}, {1690, 980, 530, 240}};
        const uint32_t* budget = budgets[scale - 2];
        if (heap_budget > budget[0]) return 400;
        if (heap_budget > budget[1]) return 300;
        if (heap_budget > budget[2]) return 200;
        if (heap_budget > budget[3]) return 100;
        return 32;
    }
    if (heap_budget > 2600) return 400;
    if (heap_budget > 740) return 200;
    if (heap_budget > 250) return 100;
    return 32;
}

std::atomic<bool> cancelled(false);

struct ProgressTarget {
    JNIEnv* env;
    jclass clazz;
    jmethodID method;
};

// The engines run their tile loops on the calling thread, so env is valid here.
bool report_progress(void* userdata, int done, int total) {
    if (cancelled) return false;
    auto* target = (ProgressTarget*) userdata;
    target->env->CallStaticVoidMethod(target->clazz, target->method, done, total);
    return true;
}

}  // namespace

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_imageupscaler_NativeUpscaler_cancel(JNIEnv*, jclass) {
    cancelled = true;
}

extern "C" JNIEXPORT jlong JNICALL
Java_expo_modules_imageupscaler_NativeUpscaler_gpuHeapBudget(JNIEnv*, jclass) {
    const int gpuid = default_gpu_index();
    return gpuid == -1 ? -1 : (jlong) ncnn::get_gpu_device(gpuid)->get_heap_budget();
}

extern "C" JNIEXPORT jintArray JNICALL
Java_expo_modules_imageupscaler_NativeUpscaler_cpuInfo(JNIEnv* env, jclass) {
    const jint counts[3] = {
        ncnn::get_cpu_thread_affinity_mask(0).num_enabled(),
        ncnn::get_cpu_thread_affinity_mask(1).num_enabled(),
        ncnn::get_cpu_thread_affinity_mask(2).num_enabled()};
    jintArray result = env->NewIntArray(3);
    env->SetIntArrayRegion(result, 0, 3, counts);
    return result;
}

// Returns [usedGpu, tileSize, cpuThreads, cpuPolicy], an empty array when cancelled,
// or null when a bitmap could not be locked.
extern "C" JNIEXPORT jintArray JNICALL
Java_expo_modules_imageupscaler_NativeUpscaler_upscale(
        JNIEnv* env, jclass clazz, jboolean realcugan, jstring paramPath, jstring modelPath,
        jint scale, jint noise, jint tileSize, jboolean ttaMode, jint syncGap,
        jboolean limitGpuPerformance,
        jboolean useGpu, jint cpuThreads, jint cpuPolicy,
        jobject inBitmap, jobject outBitmap) {
    cancelled = false;

    const std::string param = to_string(env, paramPath);
    const std::string model = to_string(env, modelPath);

    const int gpuid = useGpu == JNI_TRUE ? default_gpu_index() : -1;
    const int policy = upscaler::resolve_cpu_policy(cpuPolicy,
        ncnn::get_cpu_thread_affinity_mask(1).num_enabled(),
        ncnn::get_cpu_thread_affinity_mask(2).num_enabled());
    const int available_threads = ncnn::get_cpu_thread_affinity_mask(policy).num_enabled();
    const int threads = gpuid == -1 ? upscaler::resolve_cpu_threads(cpuThreads, available_threads) : 1;
    CpuPolicyScope cpu_scope(gpuid == -1, policy);
    if (!cpu_scope.ok()) {
        env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), "CPU_POLICY_UNAVAILABLE");
        return nullptr;
    }
    const int resolved_tile = tileSize > 0 ? tileSize : auto_tile_size(realcugan, scale, gpuid);
    const int tile = upscaler::limit_gpu_tile_size(resolved_tile, gpuid != -1, limitGpuPerformance == JNI_TRUE);

    AndroidBitmapInfo info;
    void* inPixels = nullptr;
    void* outPixels = nullptr;
    if (AndroidBitmap_getInfo(env, inBitmap, &info) < 0 ||
        AndroidBitmap_lockPixels(env, inBitmap, &inPixels) < 0) {
        return nullptr;
    }
    const int w = (int) info.width;
    const int h = (int) info.height;

    // The engines take packed RGB; alpha is dropped and the result is opaque.
    std::vector<unsigned char> rgb((size_t) w * h * 3);
    for (int y = 0; y < h; y++) {
        const unsigned char* src = (const unsigned char*) inPixels + (size_t) y * info.stride;
        unsigned char* dst = rgb.data() + (size_t) y * w * 3;
        for (int x = 0; x < w; x++) {
            dst[x * 3] = src[x * 4];
            dst[x * 3 + 1] = src[x * 4 + 1];
            dst[x * 3 + 2] = src[x * 4 + 2];
        }
    }
    AndroidBitmap_unlockPixels(env, inBitmap);

    ProgressTarget target = {env, clazz, env->GetStaticMethodID(clazz, "onProgress", "(II)V")};

    ncnn::Mat in(w, h, (void*) rgb.data(), (size_t) 3, 3);
    ncnn::Mat out(w * scale, h * scale, (size_t) 3, 3);

    if (realcugan) {
        RealCUGAN upscaler(gpuid, ttaMode == JNI_TRUE, threads);
        upscaler.load(param, model);
        upscaler.noise = noise;
        upscaler.scale = scale;
        upscaler.tilesize = tile;
        upscaler.prepadding = prepadding(realcugan, scale, noise);
        upscaler.syncgap = syncGap;
        upscaler.progress = report_progress;
        upscaler.progress_userdata = &target;
        upscaler.process(in, out);
    } else {
        Waifu2x upscaler(gpuid, ttaMode == JNI_TRUE, threads);
        upscaler.load(param, model);
        upscaler.noise = noise;
        upscaler.scale = scale;
        upscaler.tilesize = tile;
        upscaler.prepadding = prepadding(realcugan, scale, noise);
        upscaler.progress = report_progress;
        upscaler.progress_userdata = &target;
        upscaler.process(in, out);
    }

    if (cancelled) return env->NewIntArray(0);

    AndroidBitmapInfo outInfo;
    if (AndroidBitmap_getInfo(env, outBitmap, &outInfo) < 0 ||
        AndroidBitmap_lockPixels(env, outBitmap, &outPixels) < 0) {
        return nullptr;
    }
    const unsigned char* result = (const unsigned char*) out.data;
    for (int y = 0; y < out.h; y++) {
        const unsigned char* src = result + (size_t) y * out.w * 3;
        unsigned char* dst = (unsigned char*) outPixels + (size_t) y * outInfo.stride;
        for (int x = 0; x < out.w; x++) {
            dst[x * 4] = src[x * 3];
            dst[x * 4 + 1] = src[x * 3 + 1];
            dst[x * 4 + 2] = src[x * 3 + 2];
            dst[x * 4 + 3] = 255;
        }
    }
    AndroidBitmap_unlockPixels(env, outBitmap);

    const jint values[4] = {gpuid == -1 ? 0 : 1, tile, gpuid == -1 ? threads : 0, gpuid == -1 ? policy : 0};
    jintArray array = env->NewIntArray(4);
    env->SetIntArrayRegion(array, 0, 4, values);
    return array;
}
