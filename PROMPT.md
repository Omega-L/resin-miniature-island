# 树脂标本 · 微缩海岛 — 一次性项目提示词

> 把下面「任务」整段复制给 coding agent，即可从一个空目录生成完整项目。
> 最终效果预览：`docs/preview.png`

---

## 任务

你是一名资深 three.js / React Three Fiber 创意开发者兼视觉设计师。请在空目录从零实现一个可运行的全屏 3D 场景「树脂标本 · 微缩海岛」，不要使用任何模型/贴图文件（drei Environment 预设除外），全部程序化生成。

### 技术栈

- Vite + React 19 + TypeScript
- three r186
- @react-three/fiber v9
- @react-three/drei
- @react-three/postprocessing + postprocessing
- leva

### 视觉方向

产品摄影感：奶油色无缝背景 `#f0e9df`，编辑式 overlay（左上 eyebrow `RESIN SPECIMEN · NO. 07`、宋体大标题「微缩海岛」、英文副标题、底部提示与右下 meta）。

主体是一块 **10×3×10、圆角半径 0.34 的透明树脂方块**，水体就是方块本身：浅水 `#3ed8c4` 过渡到深水 `#07546d`，顶部是动态水面。方块内有一座偏左后方的大岛，覆盖约 2/3 方块；前右方是海湾和宽阔的白色新月沙滩；一条浅水沙嘴从沙滩伸进潟湖，末端露出水面；水下有珊瑚、海草、鱼群、海星和贝壳。长焦俯视产品镜头，轻微景深、Bloom、暗角，材质通透有厚度，带接触阴影。

### 场景坐标与地形

| 常量 | 值 |
| --- | --- |
| BLOCK_SIZE / HALF | 10 / 5 |
| BOTTOM / TOP | -1.5 / 1.5 |
| WATER_Y | 1.5 |
| SEABED_Y | -1.33 |
| 岛中心 | 约 (-2.05, -2.1) |
| 陆地半径 | 约 4.45 |
| 海湾中心 | 约 (0.6, 0.6) |
| 沙滩台地 | WATER_Y + 0.28 |
| 沙嘴 | (-0.15,1.55) → (1.95,2.65)，宽 0.68→0.34，末端约 WATER_Y+0.22 |

- 用确定性噪声（fbm / ridged）生成海床、陡崖、山峰、海湾、沙滩、沙嘴。
- 按高度/坡度分层着色：湿沙、白沙、岩层、苔藓、草地。
- 烘焙 8-bit 高度图供水面 shader 读取深度与泡沫。
- 实现共享 `beachAmount(x,z,h)` 遮罩，几何、颜色、植被共用：沙滩带 `bayR 1.0–3.35`，shore / lowerSlope 过滤，沙台强制沙色；植被在 `beachAmount > 0.22` 的地方不生成。
- 沙嘴用 `sandSpit` 段距离 + 脊线，末端露出水面，沙色与海滩一致；不要把潟湖底压成沙洲。

### 树脂外壳

- `RoundedBox 10×3×10`，半径 0.34。
- `MeshTransmissionMaterial`：transmission 1、thickness 2.2、ior 1.38、roughness 0.05、attenuation `#7fe4de` / 5.6、emissive 0.2、depthWrite false、layer 1。
- 移除顶盖（三角形平均 y > 1.49 丢弃），让水面成为真正的顶面。
- 轻量档用 `MeshPhysicalMaterial` 透明玻璃（opacity≈0.1、clearcoat、aqua 色）替代 transmission FBO。

### 水面

- GPU 高度场：RGBA16F ping-pong，固定 60Hz 波动方程，阻尼、边界吸收、鼠标高斯凹陷 + 尾迹。
- 指针速度注入涟漪；默认 `rippleStrength 1.25`、`rippleHeight 0.55`，阻尼 0.997、传播 0.3，笔刷范围放大。
- 水面顶点叠加环境涌浪、sim 高度、细碎 chop。
- 片元：深度着色（浅→深）、海岸泡沫、焦散、太阳高光、菲涅尔天空反射、平面反射（512/768，30Hz，luminance mask 只反射暗物体）。
- alpha：浅水 0.52 → 深水 0.84，让海水有体积但不透明到看不见海底。
- 水面边缘用圆角方块 SDF mask；轻量档关闭平面反射。

### 果冻（只作用于水）

- 岛屿、岩石、植被、树脂外壳完全静止。
- 指针驱动欠阻尼弹簧，把 offset 传给水面顶点 shader，做中心鼓起 + 法线倾斜，边缘固定。
- 不要给整组场景做剪切矩阵。
- Leva「软硬 / 晃动幅度」控制水面弹性。
- 相机用 OrbitControls 旋转/缩放，俯仰限制约 20°–38°，初始长焦俯视；鼠标拖拽旋转，水面涟漪仍随指针。

### 海洋生态

全部程序化、实例化，避开沙滩，围绕沙嘴形成视觉焦点：

- 珊瑚：橙/粉/紫/黄分支几何，浅水 0.15–0.9 深度。
- 海草：Plane + 顶点摆动 shader，浅水。
- 小鱼群：10–28 条，绕沙嘴游动，锥体 + 实例矩阵动画，y≈1.2。
- 海星：5 角挤出几何，沙滩/沙嘴，深度 -0.12–0.3。
- 贝壳：压扁小球，沙滩边缘。

核显数量：珊瑚 22 / 海草 50 / 鱼 10 / 海星 8 / 贝壳 12；独显/极致更多。

### 灯光 / 后期 / 镜头

- 环境光 0.22，半球光，主方向光，冷色补光，内部青绿点光。
- drei `Environment preset="studio"`，用 `SilentBoundary + Suspense` 包住，网络失败不影响场景。
- 奶油色接触阴影卡片。
- 镜头 fov 24（竖屏 36），方向 `(0.54,0.71,0.57)`，target `(0,0.7,0)`，长焦距离。
- OrbitControls：阻尼、minPolar 0.35 / maxPolar 0.95、minDistance 14 / maxDistance 58。
- 后期：EffectComposer、ToneMapping NEUTRAL、Bloom（threshold 0.95, mipmapBlur）、Vignette（0.36/0.28）、DepthOfField（高/极致档：worldFocusDistance 33、range 5、bokehScale=dofBlur*2.5、resolutionScale 0.5）、FXAA；极致档加 Noise 颗粒。

### 画质档位 / 性能

Leva 顶部「画质 → 渲染模式」三档。通过 GPU renderer 字符串检测核显（Intel UHD/Iris、Radeon Graphics 等）默认轻量；独显默认完整/极致。

| 档位 | DPR | 玻璃 | 反射 / Bloom / DoF | 地形 / 水面 / 模拟 | 透射 | 植被 | 海洋生物 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 轻量 60 帧 | 0.75 | 轻量玻璃 | 关 / 关 / 关（8-bit 后处理） | 128 / 96 / 128 | 2 / 192 | 700 | 22/50/10/8/12 |
| 完整玻璃 30 帧 | 0.85 | transmission | 核显关 / 关 / 关；独显开 | 160 / 128 / 160 | 2 / 192 | 1000 | 24/50/10/8/12 |
| 极致画质 | 1.5（设备允许） | transmission 6/512 | 开 / 开 / 开 + 颗粒 | 256 / 224 / 256 | 6 / 512 | 2200 | 80/180/28/24/40 |

- 轻量档目标 4K CSS 约 60fps；完整玻璃档核显实测约 46fps；极致档给独显/截图用，核显会明显低于 30。
- DPR 固定，不随帧率动态缩放。
- 平面反射 30Hz；极致档反射 768，其余 512，轻量档关闭。
- 加载遮罩最多 6 秒后强制隐藏。

### 页面 / 交互

- 全屏 Canvas + 左上编辑式 overlay + 底部 hint。
- 移动端 Leva 默认收起、标题不被遮住、竖屏镜头适配；桌面 Leva 展开。
- Leva 分组：
  - 水体：浅水色 / 深水色 / 泡沫色
  - 波浪：浪高 / 涟漪强度 / 涟漪位移
  - 光照：太阳方位 / 太阳高度
  - 潮位
  - 果冻：软硬 / 晃动幅度
  - 景深：对焦距离 / 景深范围 / 虚化强度
  - 后期：泛光 / 曝光
  - 画质：轻量 60 帧 / 完整玻璃 30 帧 / 极致画质

### 验收标准

- `npm run build` 通过。
- 轻量档桌面稳定 60fps；完整玻璃档核显 ≥30fps。
- 无黑屏闪烁。
- 水面果冻只作用于水；岛屿/岩石/树脂静止。
- 相机可旋转/缩放。
- 沙滩宽、沙嘴伸入海、海水更深、海洋生态可见。
- 移动端 30fps+，Leva 不挡标题。

### 明确避坑

- **不要用 TiltShift2**：预乘 alpha 在透明水面/玻璃 + 高虚化时会输出黑屏，只剩边缘高光。
- **不要在运行时用 AdaptiveDpr / PerformanceMonitor 反复改 DPR**：EffectComposer 的 render target 会反复重建，导致整屏闪黑；用固定 DPR + 画质档位切换。
- **不要把果冻应用到整个场景**：只有水面顶点 shader 应该晃。
- **不要把 beach flatten 应用到潟湖底**：会在水下生成一圈沙洲；只在 `shore > 0` 的陆地侧压平。
- **不要让水面过透明**：alpha 至少 0.52 → 0.84，否则海底和海水颜色都会发灰。
- **不要在 4K 核显上同时开 transmission + 平面反射 + Bloom + DoF**：会掉到 20fps 并可能触发黑帧；按档位裁剪。
- **不要让 HDR 加载卡住加载页**：SilentBoundary + 6 秒强制隐藏遮罩。

### 交付结构

```
src/
  components/
    Scene / Terrain / WaterSurface / ResinBlock / MarineLife
    Vegetation / Rocks / Post / CameraRig / Lighting
    StudioFloor / SilentBoundary
  hooks/useWaterHeightField
  lib/ noise / terrain / shaders / quality / sun
  state/JellyRig
  App.tsx / styles.css
docs/preview.png
README.md
```

- 先跑通再调材质；所有随机使用确定性种子。
- 初始化 git 并提交，README 写清运行方式、控制项、技术要点、画质档位。
