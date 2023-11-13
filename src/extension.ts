// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { parse } from "@vue/compiler-sfc";

function getAlias() {
  const config = vscode.workspace.getConfiguration("getDepsInVueProject");
  return (config.get("alias") || {}) as Record<string, string>;
}

function getRoot() {
  const config = vscode.workspace.getConfiguration("getDepsInVueProject");
  return config.get("root") as string;
}

function getIgnore() {
  const config = vscode.workspace.getConfiguration("getDepsInVueProject");
  return config.get("ignore") as string;
}

function getIgnoreSuffix() {
  const config = vscode.workspace.getConfiguration("getDepsInVueProject");
  return config.get("ignoreSuffix") as string;
}

function toCamelCase(str: string) {
  return str.replace(/-([a-z])/g, function (g) {
    return g[1].toUpperCase();
  });
}

function extractFileName(filePath: string) {
  const regex = /(?:^|\/|\\)([^\/\\]+)\.\w+$/;
  const matches = regex.exec(filePath);
  return matches ? matches[1] : "";
}

function extractIndexFilePath(path: string) {
  const regex = /^(.+)\/index\..+$/;
  const match = path.match(regex);
  if (match) {
    return match[1];
  } else {
    return path;
  }
}

function extractWithoutSuffixPath(path: string) {
  const ignoreSuffix = getIgnoreSuffix();
  const regex = new RegExp(`^(.+)\.(${ignoreSuffix})$`);
  const match = path.match(regex);
  if (match) {
    return match[1];
  } else {
    return path;
  }
}

function resolveAliasPath(alias: Record<string, string>, currPath: string) {
  // 如果路径是一个别名开头，则替换它
  for (const [key, value] of Object.entries(alias)) {
    if (currPath.startsWith(key)) {
      return path.join(value, currPath.replace(key, ""));
    }
  }
  return currPath;
}

// 解析import
function parseImports(content: string, filePath: string) {
  const arr = [] as { filePath: string; exports: string[] }[];
  if (content) {
    // 正则表达式匹配import语句
    const importRegex =
      /(?:import|export)(\stype)?\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
    let matches;

    while ((matches = importRegex.exec(content)) !== null) {
      const isTypeImport = matches[1] ? "type " : "";
      const exports = matches[2].split(",").map((e) => isTypeImport + e.trim());
      let cPath = matches[3];
      const isRelativePath = /^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[\\\/])/.test(
        cPath
      );
      if (isRelativePath) {
        cPath = path.resolve(path.dirname(filePath), cPath);
      }
      arr.push({
        filePath:
          extractFileName(cPath) === "index"
            ? extractIndexFilePath(cPath)
            : cPath,
        exports,
      });
    }
  }
  return arr;
}

// 解析import后面的依赖地址
function parseComponents(content: string) {
  // 正则表达式匹配非自闭合的Vue组件标签和自闭合的Vue组件标签
  const customComponentTagRegex = /<([A-Z]\w+)(?=\s|\/>|>)/g;

  // 定义HTML的常规标签列表
  const htmlTags = [
    "div",
    "span",
    "a",
    "ul",
    "li",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "img",
    "table",
    "tr",
    "td",
    "input",
    "button",
    "select",
    "option",
  ];

  let match;
  let componentNames: Set<string> = new Set(); // 使用集合来避免重复的组件名

  // 提取组件名
  while ((match = customComponentTagRegex.exec(content)) !== null) {
    // 首字母大写的标签视为自定义组件，排除常规HTML标签
    if (!htmlTags.includes(match[1].toLowerCase())) {
      componentNames.add(toCamelCase(match[1]));
    }
  }

  // 返回数组形式的组件名集合
  return Array.from(componentNames);
}

// 解析单个文件内容
function parseFile(
  type: "components" | "imports",
  graphData: Record<string, any[]>,
  filePath: string
) {
  const content = fs.readFileSync(filePath, "utf8");
  let imports = [] as { filePath: string; exports: string[] }[];
  let components = [] as string[];
  // 这里可以解析文件内容
  if (filePath.includes(".vue")) {
    const { descriptor } = parse(content);
    imports = parseImports(descriptor.scriptSetup?.content || "", filePath);
    components = parseComponents(descriptor.template?.content || "");
  } else {
    imports = parseImports(content, filePath);
  }

  // 建立文件依赖关系

  if (type === "imports") {
    const purePath = extractWithoutSuffixPath(
      extractFileName(filePath) === "index"
        ? extractIndexFilePath(filePath)
        : filePath
    );
    if (!graphData[purePath]) {
      graphData[purePath] = imports;
    } else {
      imports.forEach(
        (i) => !graphData[purePath].includes(i) && graphData[purePath].push(i)
      );
    }
  } else {
    if (filePath.includes(".vue")) {
      // 建立组件依赖关系
      const currComName = toCamelCase(extractFileName(filePath));
      if (!graphData[currComName]) {
        graphData[currComName] = components;
      } else {
        components.forEach(
          (i) =>
            !graphData[currComName].includes(i) &&
            graphData[currComName].push(i)
        );
      }
    }
  }
}

// 递归遍历所有文件
async function walkDirectory(
  type: "components" | "imports",
  graphData: Record<string, any[]>,
  directory: string
) {
  const root = getRoot();
  const ignore = getIgnore();
  const files = await glob(root, {
    ignore,
    cwd: directory,
  });
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      await walkDirectory(type, graphData, fullPath);
    } else {
      parseFile(type, graphData, fullPath);
    }
  }
}

/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param {*} context 上下文
 * @param {*} templatePath 相对于插件根目录的html文件相对路径
 */
function getWebViewContent(
  context: vscode.ExtensionContext,
  templatePath: string,
  panel: any
) {
  const resourcePath = path.join(context.extensionPath, templatePath);
  const dirPath = path.dirname(resourcePath);
  let htmlIndexPath = fs.readFileSync(resourcePath, "utf-8");

  const html = htmlIndexPath.replace(
    /(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g,
    (m, $1, $2) => {
      const absLocalPath = path.resolve(dirPath, $2);
      const webviewUri = panel.webview.asWebviewUri(
        vscode.Uri.file(absLocalPath)
      );
      const replaceHref = $1 + webviewUri.toString() + '"';
      return replaceHref;
    }
  );
  return html;
}

function createView(title: string, context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "graphView", // viewType
    title, // 视图标题
    vscode.ViewColumn.One, // 显示在编辑器的哪个部位
    {
      enableScripts: true, // 启用JS，默认禁用
      retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
    }
  );
  panel.webview.html = getWebViewContent(context, "src/view/index.html", panel);

  return panel;
}
function openComponentsWebView(
  context: vscode.ExtensionContext,
  graphData: any
) {
  const panel = createView("组件依赖关系", context);
  panel.webview.postMessage({ type: "components", data: graphData });
}

function openImportsWebView(context: vscode.ExtensionContext, graphData: any) {
  const panel = createView("文件依赖关系", context);
  panel.webview.postMessage({ type: "imports", data: graphData });
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

async function runCommand(
  type: "components" | "imports",
  context: vscode.ExtensionContext
) {
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const rootPath = folder.uri.fsPath;
      const alias = getAlias();
      const fullAlias = {} as Record<string, string>;
      for (const [key, val] of Object.entries(alias)) {
        fullAlias[key] = path.resolve(rootPath, val);
      }
      const graphData = {} as Record<string, any[]>;
      await walkDirectory(type, graphData, rootPath);
      if (type === "imports") {
        for (const val of Object.values(graphData)) {
          val.forEach((v) => {
            v.filePath = resolveAliasPath(fullAlias, v.filePath);
          });
        }
        openImportsWebView(context, graphData);
      } else {
        openComponentsWebView(context, graphData);
      }
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  let getComDisposable = vscode.commands.registerCommand(
    "extension.GetComponentDeps",
    async () => {
      await runCommand("components", context);
    }
  );
  context.subscriptions.push(getComDisposable);
  let getImportsDisposable = vscode.commands.registerCommand(
    "extension.GetImportDeps",
    async () => {
      await runCommand("imports", context);
    }
  );
  context.subscriptions.push(getImportsDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
