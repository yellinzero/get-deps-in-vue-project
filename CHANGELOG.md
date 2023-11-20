# Change Log

All notable changes to the "getDepsInVueProject" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.1] - 2023-11-10

- intial, complete component dependency display

## [0.0.2] - 2023-11-13

### Fixed

- 修复文件依赖关系展示错误

### Changed

- 优化ignore配置使其支持字符串数组路径匹配来忽略多个指定文件夹目录
- 完善README

### Added

- 增加getDepsInVueProject.ignoreSuffix配置，此配置在遍历文件时用来忽略指定的文件后缀，以和文件内引入其他文件时使用的省略后缀的路径正确匹配。

## [0.0.3] - 2023-11-20

### Added

- 支持只展示某指定节点的上下游信息