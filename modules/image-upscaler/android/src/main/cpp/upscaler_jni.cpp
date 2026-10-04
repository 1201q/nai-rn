#include <jni.h>
#include <android/bitmap.h>

#include <mutex>
#include <string>
#include <vector>

#include "cpu.h"
#include "gpu.h"

#include "realcugan.h"
#include "waifu2x.h"

namespace {

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

}  // namespace

// Returns [usedGpu, tileSize], or null when a bitmap could not be locked.
extern "C" JNIEXPORT jintArray JNICALL
Java_expo_modules_imageupscaler_NativeUpscaler_upscale(
        JNIEnv* env, jclass, jboolean realcugan, jstring paramPath, jstring modelPath,
        jint scale, jint noise, jint tileSize, jobject inBitmap, jobject outBitmap) {
    static std::once_flag gpu_once;
    std::call_once(gpu_once, [] { ncnn::create_gpu_instance(); });

    const std::string param = to_string(env, paramPath);
    const std::string model = to_string(env, modelPath);

    const int gpuid = ncnn::get_gpu_count() > 0 ? ncnn::get_default_gpu_index() : -1;
    const int threads = gpuid == -1 ? ncnn::get_big_cpu_count() : 1;
    const int tile = tileSize > 0 ? tileSize : auto_tile_size(realcugan, scale, gpuid);

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

    ncnn::Mat in(w, h, (void*) rgb.data(), (size_t) 3, 3);
    ncnn::Mat out(w * scale, h * scale, (size_t) 3, 3);

    if (realcugan) {
        RealCUGAN upscaler(gpuid, false, threads);
        upscaler.load(param, model);
        upscaler.noise = noise;
        upscaler.scale = scale;
        upscaler.tilesize = tile;
        upscaler.prepadding = prepadding(realcugan, scale, noise);
        upscaler.syncgap = 3;
        upscaler.process(in, out);
    } else {
        Waifu2x upscaler(gpuid, false, threads);
        upscaler.load(param, model);
        upscaler.noise = noise;
        upscaler.scale = scale;
        upscaler.tilesize = tile;
        upscaler.prepadding = prepadding(realcugan, scale, noise);
        upscaler.process(in, out);
    }

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

    const jint values[2] = {gpuid == -1 ? 0 : 1, tile};
    jintArray array = env->NewIntArray(2);
    env->SetIntArrayRegion(array, 0, 2, values);
    return array;
}
