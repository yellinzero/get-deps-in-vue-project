# get-deps-in-vue-project

Based on the VueSFC project, extract the dependencies of all components and files in a given file directory and display them as a directed graph.

基于 VueSFC 项目，用于提取项目中所有组件、文件依赖关系并展示为有向图，便于大家整理项目中的依赖关系，辅助优化项目结构。目前仅支持提取 template 中的组件（即不支持 tsx、jsx 写法的组件）。

## 使用方式

VSCode 执行如下两个指令

```json
[
  // 输出组件的依赖关系
  {
    "command": "extension.GetComponentDeps",
    "title": "Getting component dependencies"
  },
  // 输出文件的依赖关系
  {
    "command": "extension.GetImportDeps",
    "title": "Getting file dependencies"
  }
]
```

## 配置

```json
{
  // default: {}
  // 路径别名，用于跟项目中的别名关联，会把@/xxx的文件路径转变为xxx的绝对路径
  "getDepsInVueProject.alias": {
    "@/": "./src"
  },
  // 根目录，指定用于遍历的路径
  "getDepsInVueProject.root": "**/src/**",
  // 忽略文件夹，支持忽略多个匹配的文件夹
  "getDepsInVueProject.ignore": ["**/node_modules/**"],
  // 忽略文件后缀，如ts项目中在引用文件时可以忽略ts，则此时遍历文件时应该把完整的文件路径去掉ts后缀
  // 以保证引用的路径和遍历得到的路径能否正确匹配
  "getDepsInVueProject.ignoreSuffix": "ts|js|tsx|jsx"
}
```
