# 地图图片与锚点来源

当前页面默认使用 `MurkyYT/cs2-map-icons` 整理的 CS2 雷达 PNG 作为底图，并在其上叠加本站自己的战术路线示意。

## 使用的图片

以下文件均来自 `MurkyYT/cs2-map-icons` 的 `images/radars/de_*_radar_psd.png`：

- `mirage.png`
- `inferno.png`
- `nuke.png`
- `ancient.png`
- `anubis.png`
- `dust2.png`
- `cache.png`
- `overpass.png`
- `train.png`

## 锚点校准

真实底图模式下，只把 T 出生点、CT 出生点、A 包点、B 包点作为可视化锚点。大部分锚点来自同仓库 `data/radar_info/de_*.txt` 的 overview 数据。

Anubis 的 `radar_info` 文件只提供了 T/CT 出生点；A/B 包点按同一张雷达图上的橙色包点标识做了目视校准。其他中间点位仍用于战术文字说明，但不会在真实底图上当作精确坐标显示。

## 来源链接

- https://github.com/MurkyYT/cs2-map-icons
- https://github.com/mwridgway/CS2Callouts

## 备注

`MurkyYT/cs2-map-icons` 的 README 标注地图 icons、radars、thumbnails 和 overview data 为 Valve Corporation 财产，该仓库只是提供公开资源的自动访问。

本站是非官方、非商业粉丝工具；如果你要商业使用、二次分发或做正式公开产品，请重新确认所有图片资源授权。
