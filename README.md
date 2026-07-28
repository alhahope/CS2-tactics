# CS2 Stratbook

一个给 CS2 路人局使用的临场战术推荐网站：选地图、阵营、回合经济和本回合目标后，页面会推荐可直接口播的打法，并给出站位、道具清单、执行顺序、转点方案和示意雷达路线。

## 当前内容

- 9 张地图：Mirage、Inferno、Nuke、Ancient、Anubis、Dust II、Cache、Overpass、Train
- 7 张现役图 + 2 张备用/常见图
- 108 套战术：每张图 6 套 T 进攻、6 套 CT 防守
- 每张图都有独立的“打法 DNA”：进攻核心、防守核心、常见误区和关键区域标签
- 每张图使用第三方整理的真实雷达 PNG 作为底图，并叠加路线高亮、点位提示和 callout 标识
- 路线点位坐标已按当前真实雷达底图重新校准
- 图片缺失时会自动回退到站内 SVG 战术雷达
- 支持按阵营、回合类型、目标筛选和随机换战术

## 本地运行

```bash
npm install
npm run dev
```

打开本地预览地址即可查看。

## 检查与构建

```bash
npm run lint
npm test
```

## GitHub Pages 部署

项目已经包含 `.github/workflows/pages.yml`。推送到 GitHub 后：

1. 打开仓库 Settings → Pages
2. Source 选择 GitHub Actions
3. 推送到 `main` 后自动部署

如果要本地生成 GitHub Pages 静态文件：

```bash
npm run build:pages
```

生成结果在 `out/` 目录。

## 说明

这是非官方粉丝工具。当前版本默认使用第三方整理的真实 CS2 雷达 PNG 作为底图，并在其上叠加本站自己的战术路线与点位；图片来源见 `public/maps/SOURCES.md`。

如果你想替换图片，可以把新的雷达图放到 `public/maps/`，命名为 `mirage.png`、`inferno.png`、`nuke.png`、`ancient.png`、`anubis.png`、`dust2.png`、`cache.png`、`overpass.png`、`train.png`。页面会自动显示这些底图，再叠加战术路线和点位。

战术内容按 2026 年 7 月的 CS2 地图池和公开地图攻略资料整理，并重新写成适合路人局口播执行的简化战术，不照搬职业队完整战术本。

## 调研参考

- Counter-Strike 官方更新：Cache 进入现役图池，替换 Overpass
- CS2Pulse Mirage 中路控制思路
- CS2.APP Inferno Banana Control
- BLAST Dust2 / Train 基础道具与地图打法文章
- xplay Nuke / Train 地图战术与点位文章
- Skin.Land、White.Market、CS2.Ad 等 2026 地图 callout / smoke / utility 资料

后续可以继续加入：

- 每张图更多细分战术
- 投掷物站位截图或动图
- 按 1-5 人排位人数推荐打法
- 收藏保存到浏览器
- 战术搜索和一键复制指挥口令
