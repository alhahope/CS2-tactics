# 地图图片与路线点校准来源

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

## 路线点校准

真实底图模式下，战术路线实际用到的点位会参与地图连线。T/CT 出生点和 A/B 包点优先参考同仓库 `data/radar_info/de_*.txt` 的 overview 数据，并用雷达图上的出生区/包点框做视觉复核。

中间路线点参考 `TotalCS` 的同朝向 callout 标注图逐图目视校准，再落到本站使用的 `MurkyYT/cs2-map-icons` 雷达底图坐标系。Nuke 因为上下层叠图问题，A/B 包点保留 overview 的综合雷达位置，中间点按当前综合雷达通道校准。

## 来源链接

- https://github.com/MurkyYT/cs2-map-icons
- https://github.com/mwridgway/CS2Callouts
- https://totalcsgo.com/callouts

## 备注

`MurkyYT/cs2-map-icons` 的 README 标注地图 icons、radars、thumbnails 和 overview data 为 Valve Corporation 财产，该仓库只是提供公开资源的自动访问。

本站是非官方、非商业粉丝工具；如果你要商业使用、二次分发或做正式公开产品，请重新确认所有图片资源授权。
