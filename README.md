# dsh-wallpaper-composer

给 DSH Web 界面换壁纸的插件：**整窗一张、按区域各一张、或者把区域自由拼成组合**，每种方式都能单独调暗度和模糊，还带一层可调的「文字保护」保证字看得清。

A wallpaper plugin for the DSH Web UI: one image for the whole window, one per shell area, or your own combo groups — each with its own dim, blur and fit, plus a tunable text-legibility veil.

---

## 功能

- **三种布局**
  - **整体**：一张图铺满整个窗口，不切块
  - **分区域**：聊天区 / 左侧栏 / 右侧栏各挑一张，各调各的
  - **组合**：自由把区域拼成组，每组一张图、一份暗度和模糊；区域只能属于一个组合
- **文字保护**：给聊天区、左右侧栏、顶部栏统一垫一层半透明主题底色，滑杆 0–90%
- **五种铺法**：填满（cover）/ 完整（contain）/ 拉伸 / 平铺 / 居中（原始大小）
- **暗度与模糊**：在离屏 canvas 里合成，不会糊到文字
- **文件夹选择**：直接调系统的选择文件夹对话框
- 配置存浏览器 `localStorage`，图片只从本机读取，不上传

## 安装

### 方式一：让 Agent 装（推荐）

把插件目录交给 DSH 的 `plugin_manager`：

```
plugin_manager action=install_bundle target=<插件目录的绝对路径>
```

### 方式二：手动加进 profile

1. 找到 profile 目录：`<DSH_HOME>/profiles/<profile 名>`（默认 `~/.dsh/profiles/<名字>`）
2. 在它的 `package.json` 里加依赖与 bundle：

```json
{
  "dependencies": { "dsh-wallpaper-composer": "link:<插件目录绝对路径>" },
  "dsh": { "profile": { "bundles": ["...原有 bundles...", "dsh-wallpaper-composer"] } }
}
```

3. 在该目录执行 `pnpm install`
4. **重启 DSH**（bundle 在启动时装配）

## 使用

设置 → 「壁纸」：

1. 点「浏览…」选一个放图片的文件夹，或直接填绝对路径
2. 选布局：整体 / 分区域 / 组合
3. 点缩略图应用给当前目标
4. 按需要调暗度、模糊、铺法
5. 觉得字看不清，把「文字保护」往上拉

## 配置

`cordis.patch.yml` 里只有一个可选项：

```yaml
- insert:
    - id: dsh-wallpaper-composer
      name: dsh-wallpaper-composer
      config:
        defaultDir: ''   # 可选：默认壁纸文件夹，留空则首次使用时自己选
```

## 兼容性

- 验证环境：**DSH Desktop 2.0.18**（dsh `0.2.1-rc.2`）
- 背景挂在 DSH 外壳的列容器上（`frame` / `sidebarCol` / `rightbar` / 对话根容器）。DSH 大版本升级后这些类名可能变化，届时需要改 `client.js` 里的选择器常量。
- 只读取图片和视频文件，不写任何文件。

## 许可

MIT，见 [LICENSE](LICENSE)。
