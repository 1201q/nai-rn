// Android executable smoke test. Link with the same engines and ncnn as the app.
// Usage: cpu_engine_smoke MODEL_DIR SCALE NOISE [TILE TTA SYNC_GAP WIDTH HEIGHT]
// MODEL_DIR must end in realcugan-se, realcugan-pro, or waifu2x-cunet.
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "../../main/cpp/realcugan/realcugan.h"
#include "../../main/cpp/waifu2x/waifu2x.h"

int main(int argc, char** argv) {
    if (argc < 4) return 2;
    const std::string directory = argv[1];
    const bool realcugan = directory.find("waifu2x-cunet") == std::string::npos;
    const int scale = std::atoi(argv[2]);
    const int noise = std::atoi(argv[3]);
    const int tile = argc > 4 ? std::atoi(argv[4]) : 100;
    const bool tta = argc > 5 && std::atoi(argv[5]) != 0;
    const int syncgap = argc > 6 ? std::atoi(argv[6]) : 0;
    const int width = argc > 7 ? std::atoi(argv[7]) : 32;
    const int height = argc > 8 ? std::atoi(argv[8]) : 32;
    if ((realcugan ? scale < 2 || scale > 4 : scale < 1 || scale > 2) ||
        noise < -1 || noise > 3 || tile < 32 || syncgap < 0 || syncgap > 3 ||
        width < 1 || height < 1 || width > 512 || height > 512) return 2;

    std::string name;
    if (realcugan) {
        name = "up" + std::to_string(scale) + "x-";
        name += noise == -1 ? "conservative" : noise == 0 ? "no-denoise" :
            "denoise" + std::to_string(noise) + "x";
    } else {
        name = noise == -1 ? "scale2.0x_model" : "noise" + std::to_string(noise) +
            (scale == 1 ? "_model" : "_scale2.0x_model");
    }
    const std::string param = directory + "/" + name + ".param";
    const std::string model = directory + "/" + name + ".bin";
    // Engine load() currently ignores errors, so reject missing fixtures first.
    for (const auto& path : {param, model}) {
        FILE* file = std::fopen(path.c_str(), "rb");
        if (!file) return 3;
        std::fclose(file);
    }

    std::vector<unsigned char> pixels((size_t)width * height * 3);
    for (size_t i = 0; i < pixels.size(); ++i) pixels[i] = (i * 17 + i / 11) % 256;
    ncnn::Mat input(width, height, pixels.data(), (size_t)3, 3);
    ncnn::Mat output(width * scale, height * scale, (size_t)3, 3);
    if (output.empty()) return 4;
    int result;
    // Intentionally never create a Vulkan instance: CPU load must work alone.
    if (realcugan) {
        RealCUGAN engine(-1, tta, 1);
        if (engine.load(param, model) != 0) return 5;
        engine.scale = scale;
        engine.noise = noise;
        engine.tilesize = tile;
        engine.prepadding = scale == 2 ? 18 : scale == 3 ? 14 : 19;
        engine.syncgap = syncgap;
        result = engine.process(input, output);
    } else {
        Waifu2x engine(-1, tta, 1);
        if (engine.load(param, model) != 0) return 5;
        engine.scale = scale;
        engine.noise = noise;
        engine.tilesize = tile;
        engine.prepadding = noise != -1 && scale == 1 ? 28 : 18;
        result = engine.process(input, output);
    }
    if (result != 0 || output.empty() || output.w != width * scale ||
        output.h != height * scale) return 6;
    unsigned long long checksum = 0;
    const auto* data = (const unsigned char*)output.data;
    for (size_t i = 0; i < (size_t)output.w * output.h * 3; ++i) checksum += data[i];
    if (checksum == 0) return 7;
    std::printf("PASS %s scale=%d noise=%d tile=%d tta=%d sync=%d input=%dx%d checksum=%llu\n",
        directory.c_str(), scale, noise, tile, tta, syncgap, width, height, checksum);
    return 0;
}
