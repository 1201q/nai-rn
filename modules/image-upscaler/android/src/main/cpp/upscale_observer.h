#pragma once
#include <algorithm>
namespace ncnn { class Mat; }
namespace upscaler {
// Optional UI observer. Only final-pass loops publish tiles and completed rows.
struct Observer {
    void* userdata = nullptr;
    bool (*on_tile)(void*, int, int, int, int, int, int) = nullptr;
    void (*on_row)(void*, const ncnn::Mat&, int) = nullptr;
    bool tile(int x, int y, int columns, int rows, int tw, int th, int w, int h) const {
        return !on_tile || on_tile(userdata, x * tw, y * th,
            std::min(tw, w - x * tw), std::min(th, h - y * th), y * columns + x, columns * rows);
    }
    void row(const ncnn::Mat& output, int completed_y) const {
        if (on_row) on_row(userdata, output, completed_y);
    }
};
}
