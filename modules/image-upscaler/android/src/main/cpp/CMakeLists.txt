cmake_minimum_required(VERSION 3.22.1)
project(image-upscaler CXX)

set(CMAKE_CXX_STANDARD 17)

# ncnn prebuilt (static, Vulkan). Downloaded once into the module build dir, which is gitignored.
set(NCNN_NAME ncnn-20260526-android-vulkan)
set(NCNN_SHA256 26909c92eed35afed4a966b5e9e503fcb0a529691ea3f910ec2c94a4fff52804)
set(NCNN_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../../../build/ncnn-prebuilt)
file(MAKE_DIRECTORY ${NCNN_ROOT})
# ABI별 configure가 동시에 돌아도 한 번만 받는다.
file(LOCK ${NCNN_ROOT} DIRECTORY GUARD FILE)
if(NOT EXISTS ${NCNN_ROOT}/${NCNN_NAME}.extracted)
  file(DOWNLOAD
    https://github.com/Tencent/ncnn/releases/download/20260526/${NCNN_NAME}.zip
    ${NCNN_ROOT}/${NCNN_NAME}.zip
    EXPECTED_HASH SHA256=${NCNN_SHA256})
  file(ARCHIVE_EXTRACT INPUT ${NCNN_ROOT}/${NCNN_NAME}.zip DESTINATION ${NCNN_ROOT})
  file(REMOVE ${NCNN_ROOT}/${NCNN_NAME}.zip)
  file(WRITE ${NCNN_ROOT}/${NCNN_NAME}.extracted "")
endif()
file(LOCK ${NCNN_ROOT} DIRECTORY RELEASE)

set(ncnn_DIR ${NCNN_ROOT}/${NCNN_NAME}/${ANDROID_ABI}/lib/cmake/ncnn)
find_package(ncnn REQUIRED)

# Upstream sources include "<name>.comp.hex.h" generated from the .comp shaders.
set(SHADER_HEADERS)
macro(upscaler_add_shader SHADER_SRC)
  get_filename_component(SHADER_SRC_NAME_WE ${SHADER_SRC} NAME_WE)
  set(SHADER_COMP_HEADER ${CMAKE_CURRENT_BINARY_DIR}/${SHADER_SRC_NAME_WE}.comp.hex.h)
  add_custom_command(
    OUTPUT ${SHADER_COMP_HEADER}
    COMMAND ${CMAKE_COMMAND}
      -DSHADER_SRC=${CMAKE_CURRENT_SOURCE_DIR}/${SHADER_SRC}
      -DSHADER_COMP_HEADER=${SHADER_COMP_HEADER}
      -P ${CMAKE_CURRENT_SOURCE_DIR}/generate_shader_comp_header.cmake
    DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/${SHADER_SRC}
    VERBATIM)
  list(APPEND SHADER_HEADERS ${SHADER_COMP_HEADER})
endmacro()

upscaler_add_shader(realcugan/realcugan_preproc.comp)
upscaler_add_shader(realcugan/realcugan_postproc.comp)
upscaler_add_shader(realcugan/realcugan_4x_postproc.comp)
upscaler_add_shader(realcugan/realcugan_preproc_tta.comp)
upscaler_add_shader(realcugan/realcugan_postproc_tta.comp)
upscaler_add_shader(realcugan/realcugan_4x_postproc_tta.comp)
upscaler_add_shader(waifu2x/waifu2x_preproc.comp)
upscaler_add_shader(waifu2x/waifu2x_postproc.comp)
upscaler_add_shader(waifu2x/waifu2x_preproc_tta.comp)
upscaler_add_shader(waifu2x/waifu2x_postproc_tta.comp)

add_library(image-upscaler SHARED
  upscaler_jni.cpp
  realcugan/realcugan.cpp
  waifu2x/waifu2x.cpp
  ${SHADER_HEADERS})

target_include_directories(image-upscaler PRIVATE
  ${CMAKE_CURRENT_BINARY_DIR}
  realcugan
  waifu2x)

target_link_libraries(image-upscaler ncnn jnigraphics log)
# Google Play 16KB page size (NDK r27 does not align by default).
target_link_options(image-upscaler PRIVATE "-Wl,-z,max-page-size=16384")
