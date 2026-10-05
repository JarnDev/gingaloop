cmake_minimum_required(VERSION 3.20)
project(challenge CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT DEFINED TARGET)
  set(TARGET starter)
endif()

find_package(GTest REQUIRED)
file(GLOB TARGET_SOURCES ${CMAKE_SOURCE_DIR}/../${TARGET}/*.cpp)

add_executable(tests test.cpp ${TARGET_SOURCES})
target_include_directories(tests PRIVATE ${CMAKE_SOURCE_DIR}/../${TARGET})
target_compile_options(tests PRIVATE -Wall -Wextra -Wpedantic -Werror -g
                       -fsanitize=address,undefined -fno-sanitize-recover=all)
target_link_options(tests PRIVATE -fsanitize=address,undefined)
target_link_libraries(tests PRIVATE GTest::gtest_main)
