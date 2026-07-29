"use client";

import { useEffect, useMemo, useState } from "react";

type Side = "T" | "CT";
type RoundType = "长枪局" | "半起局" | "ECO";
type Goal = "爆点" | "控图" | "默认" | "反清";

type Point = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind?: "spawn" | "site" | "lane" | "danger";
};

type RadarArea = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: "site" | "lane" | "spawn" | "connector" | "danger" | "water";
  rotate?: number;
};

type RadarPath = {
  id: string;
  d: string;
  kind?: "main" | "site" | "spawn" | "connector" | "danger" | "water";
  width?: number;
};

type RouteWaypoint = {
  id: string;
  x: number;
  y: number;
};

type RouteGraph = {
  nodes: Record<string, [number, number]>;
  edges: [string, string][];
};

type RasterCell = {
  col: number;
  row: number;
};

type RouteMask = {
  size: number;
  walkable: Uint8Array;
};

type ImageRoutePath = {
  label: string;
  color: string;
  points: RouteWaypoint[];
};

type ImageRouteMarker = {
  id: string;
  label: string;
  x: number;
  y: number;
  kind?: Point["kind"];
};

type Route = {
  label: string;
  color: string;
  points: string[];
};

type Tactic = {
  id: string;
  side: Side;
  title: string;
  goal: Goal;
  roundTypes: RoundType[];
  difficulty: "简单" | "中等" | "进阶";
  tempo: "慢控" | "默认" | "提速" | "爆弹";
  summary: string;
  call: string;
  setup: string[];
  utility: string[];
  steps: string[];
  fallback: string;
  routes: Route[];
};

type MapIntel = {
  fingerprint: string;
  tCore: string;
  ctCore: string;
  avoid: string;
  tags: string[];
};

type MapPlan = {
  id: string;
  name: string;
  pool: "现役" | "备用";
  theme: string;
  ctNote: string;
  tNote: string;
  points: Point[];
  areas: RadarArea[];
  paths: RadarPath[];
  tactics: Tactic[];
  intel: MapIntel;
};

type BaseMapPlan = Omit<MapPlan, "areas" | "paths" | "intel">;

const roundTypes: RoundType[] = ["长枪局", "半起局", "ECO"];
const goals: Goal[] = ["爆点", "控图", "默认", "反清"];
const sides: Side[] = ["T", "CT"];
const routeColors = ["#ff7a3d", "#44d7a8", "#7cc9ff", "#f6d65f"];
const rasterGridSize = 128;
const routeMaskCache = new Map<string, Promise<RouteMask | null>>();
const verifiedRadarAnchorsByMap: Record<string, readonly string[]> = {
  mirage: ["t", "ct", "a", "b"],
  inferno: ["t", "ct", "a", "b"],
  nuke: ["t", "ct", "a", "b"],
  ancient: ["t", "ct", "a", "b"],
  anubis: ["t", "ct", "a", "b"],
  dust2: ["t", "ct", "a", "b"],
  cache: ["t", "ct", "a", "b"],
  overpass: ["t", "ct", "a", "b"],
  train: ["t", "ct", "a", "b"],
};

const point = (id: string, label: string, x: number, y: number, kind: Point["kind"] = "lane"): Point => ({ id, label, x, y, kind });
const area = (
  id: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: RadarArea["kind"] = "lane",
  rotate = 0,
): RadarArea => ({ id, label, x, y, w, h, kind, rotate });
const path = (
  id: string,
  d: string,
  kind: RadarPath["kind"] = "main",
  width = 8,
): RadarPath => ({ id, d, kind, width });

const baseMaps: BaseMapPlan[] = [
  {
    id: "mirage",
    name: "Mirage",
    pool: "现役",
    theme: "中路信息决定一切，A 点需要夹击，B 点怕市场回防。",
    tNote: "先问自己：中路有没有拿到窗口/拱门压力。",
    ctNote: "A 区不要只蹲包点，中路信息断了 B 和 A 都会难守。",
    points: [
      point("t", "T 出生点", 87, 36, "spawn"), point("ramp", "A 坡", 20, 50), point("palace", "二楼", 31, 19),
      point("mid", "中路", 50, 48), point("window", "窗口", 47, 34, "danger"), point("connector", "拱门", 47, 45),
      point("short", "短箱", 63, 49), point("apps", "B 二楼", 78, 73), point("market", "超市", 70, 62),
      point("a", "A 包点", 54, 76, "site"), point("b", "B 包点", 23, 28, "site"), point("ct", "警家", 28, 70, "spawn"),
    ],
    tactics: [
      {
        id: "mirage-t-a-split", side: "T", title: "A 区三线夹击", goal: "爆点", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "爆弹",
        summary: "A 坡给烟火，二楼同步出，中路队友压拱门切断回防。",
        call: "A 三线，先静十秒，烟落后二楼和 A 坡一起出。",
        setup: ["2 人 A 坡", "1 人二楼", "2 人中路控窗口和拱门"],
        utility: ["警家烟", "跳台烟", "二楼下火", "A 坡闪两颗"],
        steps: ["中路先逼窗口或拱门退后", "A 坡队友贴近等烟", "二楼出点不单走，听 A 坡闪再动", "下包优先三明治或默认位"],
        fallback: "中路没拿到拱门就不要硬出，A 坡留烟，转 B 二楼夹短箱。",
        routes: [
          { label: "A 坡主攻", color: routeColors[0], points: ["t", "ramp", "a"] },
          { label: "二楼补枪", color: routeColors[1], points: ["t", "palace", "a"] },
          { label: "中路断回防", color: routeColors[2], points: ["t", "mid", "connector"] },
        ],
      },
      {
        id: "mirage-t-mid-b", side: "T", title: "控中转 B 夹击", goal: "控图", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
        summary: "用中路压力逼 CT 交道具，再从短箱和 B 二楼同步压 B。",
        call: "默认控中，窗口别白给，拿短箱后 B 二楼一起夹。",
        setup: ["2 人中路", "1 人断 A 前压", "2 人 B 二楼慢摸"],
        utility: ["窗口烟", "拱门火", "短箱闪", "超市门烟"],
        steps: ["第一时间封窗口拿中路身位", "清拱门和短箱近点", "B 二楼听到短箱到位再爆", "下包后双人守 B 二楼，短箱留一人反绕"],
        fallback: "短箱被火拖住时，保留 B 二楼压力，中路转拱门夹 A。",
        routes: [
          { label: "短箱夹 B", color: routeColors[2], points: ["t", "mid", "short", "b"] },
          { label: "B 二楼同步", color: routeColors[0], points: ["t", "apps", "b"] },
          { label: "A 防前压", color: routeColors[3], points: ["t", "ramp"] },
        ],
      },
      {
        id: "mirage-ct-default", side: "CT", title: "2-1-2 中路默认", goal: "默认", roundTypes: ["长枪局", "半起局"], difficulty: "简单", tempo: "默认",
        summary: "A 两人交叉，中路一人拿信息，B 二楼靠闪反清。",
        call: "默认别送，中路活着报信息，B 二楼要反清先叫闪。",
        setup: ["A 点 2 人", "中路 1 人", "B 点 2 人"],
        utility: ["A 坡火", "中路反清闪", "B 二楼火", "超市回防烟"],
        steps: ["开局 A 坡火拖第一波", "中路只拿信息不硬拼", "B 二楼有脚步就双人闪出", "掉人后马上收缩到包点交叉"],
        fallback: "中路失守时，A 人退 CT，B 人退超市，优先保回防人数。",
        routes: [
          { label: "A 区交叉", color: routeColors[1], points: ["ct", "a", "ramp"] },
          { label: "中路信息", color: routeColors[2], points: ["ct", "window", "mid"] },
          { label: "B 二楼反清", color: routeColors[0], points: ["ct", "market", "apps"] },
        ],
      },
      {
        id: "mirage-ct-a-push", side: "CT", title: "A 坡前顶偷节奏", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "中等", tempo: "提速",
        summary: "用 A 坡闪火换前压空间，赌对节奏能直接拿首杀和枪。",
        call: "A 两个前顶，闪后只打一波，拿到人就退。",
        setup: ["2 人 A 坡前压", "1 人警家补枪", "2 人保中 B"],
        utility: ["A 坡瞬爆闪", "A 坡深火", "警家烟"],
        steps: ["开局火封 A 坡深处", "第二身位补闪出坡", "拿到信息或击杀立刻退包点", "不要一路追到 T 家"],
        fallback: "没见人就留一人二楼下听信息，另一人回警家补中路。",
        routes: [
          { label: "A 坡反清", color: routeColors[0], points: ["ct", "a", "ramp"] },
          { label: "警家补位", color: routeColors[3], points: ["ct", "a"] },
        ],
      },
    ],
  },
  {
    id: "inferno",
    name: "Inferno",
    pool: "现役",
    theme: "香蕉道和二楼是两条生命线，进攻要逼道具，防守要抢信息。",
    tNote: "别五个人堵一个口，香蕉道和二楼至少要有一边拿到空间。",
    ctNote: "B 区道具要分层交，A 区二楼不能长期没人听。",
    points: [
      point("t", "T 出生点", 10, 67, "spawn"), point("banana", "香蕉道", 82, 60), point("logs", "木桶", 78, 54),
      point("b", "B 包点", 49, 22, "site"), point("ct", "CT", 90, 35, "spawn"), point("mid", "中路", 49, 67),
      point("second", "二楼", 37, 48), point("arch", "拱门", 60, 35), point("library", "书房", 55, 28),
      point("a", "A 包点", 81, 69, "site"), point("pit", "大坑", 43, 23, "danger"), point("alt", "侧道", 34, 67),
    ],
    tactics: [
      {
        id: "inferno-t-b-control", side: "T", title: "香蕉道控图爆 B", goal: "控图", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "慢控",
        summary: "先用火烟逼 B 区交道具，第二时间反清木桶后爆 B。",
        call: "香蕉道慢控，别急吃雷，等他们第二波道具没了再爆。",
        setup: ["3 人香蕉道", "1 人中路断前压", "1 人二楼听 A"],
        utility: ["香蕉道深烟", "木桶火", "棺材烟", "警家烟", "双闪出 B"],
        steps: ["第一波别贴太深，等 CT 火雷过去", "反清木桶和沙袋", "棺材警家烟同时落", "包点清新箱和死点"],
        fallback: "香蕉道人数少或道具耗尽，留一人断后，其余从中路转 A 夹拱门。",
        routes: [
          { label: "香蕉主攻", color: routeColors[0], points: ["t", "banana", "logs", "b"] },
          { label: "中路断前压", color: routeColors[2], points: ["t", "mid", "arch"] },
          { label: "二楼听信息", color: routeColors[1], points: ["t", "alt", "second"] },
        ],
      },
      {
        id: "inferno-t-apps-a", side: "T", title: "二楼夹 A", goal: "爆点", roundTypes: ["长枪局"], difficulty: "中等", tempo: "爆弹",
        summary: "二楼清近点后与中路同步，重点解决大坑和书房补枪。",
        call: "二楼清干净，中路等闪，拱门书房一起封。",
        setup: ["2 人二楼", "2 人中路", "1 人香蕉道假压"],
        utility: ["书房烟", "拱门烟", "大坑火", "二楼闪"],
        steps: ["二楼先清锅炉房和阳台近点", "中路烟封书房和拱门", "二楼跳阳台同时中路出", "下包后大坑和短箱交叉"],
        fallback: "二楼被反清掉人，立刻取消夹 A，香蕉道队友卖假动作转 B。",
        routes: [
          { label: "二楼夹击", color: routeColors[1], points: ["t", "alt", "second", "a"] },
          { label: "中路同步", color: routeColors[0], points: ["t", "mid", "arch", "a"] },
          { label: "香蕉假压", color: routeColors[3], points: ["t", "banana"] },
        ],
      },
      {
        id: "inferno-ct-b-layer", side: "CT", title: "B 区分层拖延", goal: "默认", roundTypes: ["长枪局"], difficulty: "简单", tempo: "默认",
        summary: "香蕉道不硬拼，用火烟分三层拖时间，A 区保二楼信息。",
        call: "B 道具分开交，别一秒全扔完，A 二楼听住。",
        setup: ["B 2 人", "A 3 人，其中 1 人二楼信息"],
        utility: ["香蕉道火", "木桶烟", "反清闪", "警家回防烟"],
        steps: ["开局 B 火阻第一波", "第二波烟封木桶", "听到贴近再闪出反清", "B 失守后保警家烟回防"],
        fallback: "香蕉失守不要双人白给，一人棺材一人警家，等 A 回防。",
        routes: [
          { label: "B 道具线", color: routeColors[2], points: ["ct", "b", "logs", "banana"] },
          { label: "A 二楼信息", color: routeColors[1], points: ["ct", "a", "second"] },
        ],
      },
      {
        id: "inferno-ct-banana-push", side: "CT", title: "香蕉道双人反清", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "中等", tempo: "提速",
        summary: "用闪火抢香蕉信息，拿到击杀就后撤，不恋战。",
        call: "B 两个抢香蕉，闪完看一眼就退，A 别前顶。",
        setup: ["2 人香蕉道", "2 人 A 点", "1 人拱门快补"],
        utility: ["香蕉瞬爆闪", "沙袋火", "木桶烟"],
        steps: ["第一人背闪贴木桶", "第二人补枪别站同线", "拿到信息立刻叫 A 收缩", "对面静音时留烟退 B 点"],
        fallback: "反清失败时 A 区不要再冒险，直接保三人回防结构。",
        routes: [
          { label: "B 双人反清", color: routeColors[0], points: ["ct", "b", "logs", "banana"] },
          { label: "拱门快补", color: routeColors[3], points: ["ct", "arch"] },
        ],
      },
    ],
  },
  {
    id: "nuke",
    name: "Nuke",
    pool: "现役",
    theme: "垂直地图，外场烟墙和铁板声音会牵动所有轮转。",
    tNote: "不要只打一层。外场、黄房和铁板要制造纵向压力。",
    ctNote: "信息比枪法重要，外场失守要第一时间叫 B 层轮转。",
    points: [
      point("t", "T 出生点", 19, 54, "spawn"), point("yard", "外场", 50, 64), point("secret", "K1", 68, 73),
      point("garage", "车库", 49, 54, "danger"), point("silo", "红箱", 47, 56), point("hut", "黄房", 61, 40),
      point("squeaky", "铁门", 70, 43), point("a", "A 包点", 58, 48, "site"), point("vents", "管道", 65, 57),
      point("ramp", "铁板", 76, 64), point("b", "B 包点", 58, 58, "site"), point("ct", "CT", 82, 45, "spawn"),
    ],
    tactics: [
      {
        id: "nuke-t-yard-secret", side: "T", title: "外场烟墙下 K1", goal: "控图", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "默认",
        summary: "烟墙隔断车库和大仓，至少两人下 K1 给 B 层压力。",
        call: "外场烟墙，下 K1 两个，黄房别急，听 B 回防。",
        setup: ["3 人外场", "1 人黄房", "1 人铁板断前压"],
        utility: ["外场三颗烟", "红箱火", "K1 闪", "B 下包烟"],
        steps: ["烟墙落下后外场队友贴烟过", "一人留红箱看压出", "K1 两人下层清 B 外围", "黄房队友等 CT 轮转后夹 A 或管道"],
        fallback: "K1 被堵死就留外场压力，黄房铁门提速打 A。",
        routes: [
          { label: "外场下 K1", color: routeColors[0], points: ["t", "yard", "secret", "b"] },
          { label: "黄房牵制", color: routeColors[2], points: ["t", "hut", "a"] },
          { label: "铁板断前压", color: routeColors[1], points: ["t", "ramp"] },
        ],
      },
      {
        id: "nuke-t-a-pop", side: "T", title: "黄房铁门 A 爆", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
        summary: "快速让 CT 没时间站好交叉，重点靠闪和补枪冲破 A 点。",
        call: "A 快，铁门黄房一起，管道有人就补火。",
        setup: ["3 人黄房", "2 人铁门"],
        utility: ["A 点闪", "管道火", "天堂烟"],
        steps: ["黄房第一身位背闪出", "铁门同步开门制造声音", "优先清包点和管道", "下包后黄房与铁门交叉守"],
        fallback: "A 没打进去但管道开了，立刻跳管转 B，不在 A 点干耗。",
        routes: [
          { label: "黄房冲点", color: routeColors[0], points: ["t", "hut", "a"] },
          { label: "铁门同步", color: routeColors[1], points: ["t", "squeaky", "a"] },
        ],
      },
      {
        id: "nuke-ct-yard-read", side: "CT", title: "外场读秒防线", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
        summary: "外场拿到烟墙信息后别硬守，及时告诉 B 层和铁板收缩。",
        call: "外场看烟，烟墙成型就报下 K1，B 先别单摸。",
        setup: ["1 人车库", "1 人外场红箱", "2 人 A", "1 人铁板"],
        utility: ["外场反烟", "红箱火", "铁板烟", "A 点反清闪"],
        steps: ["车库先看外场人数和烟墙", "红箱位不要被单抓", "K1 丢失时 B 层提前架", "A 人别盲目追黄房"],
        fallback: "外场全丢后，车库退 CT，铁板回 B，A 点双人只守进点。",
        routes: [
          { label: "外场信息", color: routeColors[2], points: ["ct", "garage", "yard"] },
          { label: "铁板联动", color: routeColors[1], points: ["ct", "ramp", "b"] },
          { label: "A 点双守", color: routeColors[0], points: ["ct", "a", "hut"] },
        ],
      },
      {
        id: "nuke-ct-ramp-stack", side: "CT", title: "铁板强控", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "中等", tempo: "提速",
        summary: "低经济时用两人铁板赌信息，拿到首杀后缩 B。",
        call: "铁板两人抢，拿到一个就退，不要下追。",
        setup: ["2 人铁板", "2 人 A", "1 人外场保信息"],
        utility: ["铁板烟", "反清闪", "B 口火"],
        steps: ["铁板烟后贴近听脚步", "闪出只打一波", "拿到击杀退 B 或警家", "A 点队友别同时前压"],
        fallback: "没见人就留一人铁板，一人快速回 A，防黄房爆弹。",
        routes: [
          { label: "铁板反清", color: routeColors[0], points: ["ct", "ramp"] },
          { label: "B 层回缩", color: routeColors[3], points: ["ramp", "b"] },
        ],
      },
    ],
  },
  {
    id: "ancient",
    name: "Ancient",
    pool: "现役",
    theme: "中路和洞口控制决定 A/B 夹击速度。",
    tNote: "先拿红房和中路，再决定 A 夹还是 B 坡。",
    ctNote: "中路不能免费给，B 坡需要道具拖时间。",
    points: [
      point("t", "T 出生点", 48.5, 87, "spawn"), point("red", "红房", 33, 69), point("mid", "中路", 50, 56),
      point("donut", "甜甜圈", 40, 50), point("a", "A 包点", 31, 25, "site"), point("cave", "洞口", 65, 55, "danger"),
      point("ramp", "B 坡", 80, 70), point("b", "B 包点", 80, 40, "site"), point("ct", "CT", 51, 17, "spawn"),
      point("lane", "长廊", 24, 54),
    ],
    tactics: [
      {
        id: "ancient-t-mid-a", side: "T", title: "红房控中夹 A", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "慢控",
        summary: "红房和中路拿到后，从甜甜圈与长廊同步打 A。",
        call: "控中别急，甜甜圈到位后长廊再出。",
        setup: ["2 人红房中路", "2 人长廊", "1 人 B 坡牵制"],
        utility: ["中路烟", "甜甜圈火", "A 点警家烟", "长廊闪"],
        steps: ["先清红房近点", "中路拿甜甜圈入口", "长廊队友等闪", "A 点落烟后双线同步"],
        fallback: "甜甜圈没拿到，保留长廊压力转 B 坡爆弹。",
        routes: [
          { label: "中路甜甜圈", color: routeColors[0], points: ["t", "red", "mid", "donut", "a"] },
          { label: "长廊同步", color: routeColors[1], points: ["t", "lane", "a"] },
          { label: "B 坡牵制", color: routeColors[2], points: ["t", "ramp"] },
        ],
      },
      {
        id: "ancient-t-b-ramp", side: "T", title: "B 坡道具爆点", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "爆弹",
        summary: "用闪火清洞口和柱子，快速让 CT 回防来不及到位。",
        call: "B 坡集合，烟火后一起进，洞口先别漏背身。",
        setup: ["4 人 B 坡", "1 人中路断回防"],
        utility: ["洞口火", "B 包点烟", "柱子闪", "警家烟"],
        steps: ["B 坡先用火逼近点", "第一身位清柱子和洞口", "中路队友断 CT 回防", "下包后双人守坡，单人守洞"],
        fallback: "B 坡被烟拖死就慢等烟散，不要一个个钻烟送。",
        routes: [
          { label: "B 坡主攻", color: routeColors[0], points: ["t", "ramp", "b"] },
          { label: "中路断回防", color: routeColors[2], points: ["t", "red", "mid"] },
        ],
      },
      {
        id: "ancient-ct-mid-cave", side: "CT", title: "中路洞口双信息", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
        summary: "中路和洞口互相补信息，B 坡只要拖住就能赢回防。",
        call: "中路别死，洞口听着，B 坡先交火别硬吃。",
        setup: ["1 人中路", "1 人洞口", "1 人 B", "2 人 A"],
        utility: ["中路火", "B 坡烟", "洞口闪", "A 长廊火"],
        steps: ["中路先拿红房动静", "洞口队友听 B 坡脚步", "B 坡压力大就退包点", "A 区根据甜甜圈信息收缩"],
        fallback: "中路被破，A 人退包点，洞口回警家，别继续前压。",
        routes: [
          { label: "中路信息", color: routeColors[2], points: ["ct", "donut", "mid", "red"] },
          { label: "洞口联动", color: routeColors[1], points: ["ct", "cave", "ramp"] },
          { label: "A 长廊拖延", color: routeColors[0], points: ["ct", "a", "lane"] },
        ],
      },
      {
        id: "ancient-ct-b-stack", side: "CT", title: "B 坡三人赌局", goal: "反清", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "提速",
        summary: "低经济时三人 B 坡赌提速，靠闪和交叉拿枪。",
        call: "三 B 抢坡，见人先闪再打，A 两个别动。",
        setup: ["3 人 B 坡/洞口", "2 人 A 收缩"],
        utility: ["B 坡反清闪", "洞口火", "包点烟"],
        steps: ["开局三人贴 B 坡两侧", "第一颗闪后双人peek", "拿到枪立刻退洞或包点", "A 区只收缩不前顶"],
        fallback: "B 没人就一人退中路，一人留洞，一人回警家。",
        routes: [
          { label: "B 坡反清", color: routeColors[0], points: ["ct", "b", "ramp"] },
          { label: "洞口退守", color: routeColors[1], points: ["ramp", "cave", "ct"] },
        ],
      },
    ],
  },
  {
    id: "anubis",
    name: "Anubis",
    pool: "现役",
    theme: "水路和中路能迅速切开两边包点。",
    tNote: "控水路后不要犹豫，A/B 两边都能二次夹击。",
    ctNote: "水路丢了就要主动换空间，不能五个人缩包点。",
    points: [
      point("t", "T 出生点", 58, 93, "spawn"), point("canal", "水路", 41, 60), point("mid", "中路", 50, 50),
      point("bridge", "桥", 68, 29), point("a-main", "A 主", 32, 47), point("a", "A 包点", 31, 50, "site"),
      point("b-main", "B 主", 74, 48), point("b", "B 包点", 76, 28, "site"), point("ct", "CT", 61, 22, "spawn"),
      point("connector", "连接", 62, 57),
    ],
    tactics: [
      {
        id: "anubis-t-water-a", side: "T", title: "水路夹 A", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "慢控",
        summary: "水路拿到后从桥和 A 主双线夹 A，压缩 CT 警家空间。",
        call: "水路先稳，桥到位后 A 主再出。",
        setup: ["2 人水路", "2 人 A 主", "1 人 B 主断信息"],
        utility: ["桥烟", "A 点火", "警家烟", "水路闪"],
        steps: ["水路先清近点", "桥位到位后 A 主补闪", "A 主和桥同步清包点", "下包后水路留人断回防"],
        fallback: "水路没拿下时 B 主队友保留压力，转 B 主爆点。",
        routes: [
          { label: "水路夹击", color: routeColors[0], points: ["t", "canal", "bridge", "a"] },
          { label: "A 主同步", color: routeColors[1], points: ["t", "a-main", "a"] },
          { label: "B 主断信息", color: routeColors[3], points: ["t", "b-main"] },
        ],
      },
      {
        id: "anubis-t-b-pop", side: "T", title: "B 主提速", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
        summary: "用速度打 B 点，水路只负责迟滞回防。",
        call: "B 快，水路别死，B 主两颗闪进点。",
        setup: ["4 人 B 主", "1 人水路断回防"],
        utility: ["B 主闪", "包点火", "警家烟"],
        steps: ["B 主集合别露太早", "闪后第一身位清柱子", "水路队友拖 CT 回防", "包点下包后两人守 B 主"],
        fallback: "B 主被烟封死就等烟散，不要钻烟；水路可转桥偷警家。",
        routes: [
          { label: "B 主爆点", color: routeColors[0], points: ["t", "b-main", "b"] },
          { label: "水路断回防", color: routeColors[2], points: ["t", "canal", "connector"] },
        ],
      },
      {
        id: "anubis-ct-water", side: "CT", title: "水路双人争夺", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "默认",
        summary: "水路不能免费给，双人闪火拿第一波信息后再决定退守。",
        call: "水路两个抢信息，拿到就退，别被桥夹。",
        setup: ["2 人水路", "1 人 A", "1 人 B", "1 人中路补位"],
        utility: ["水路火", "反清闪", "桥烟", "B 主火"],
        steps: ["水路第一波火阻进攻", "队友补闪看人数", "信息足够立刻回桥或警家", "A/B 根据水路压力调人"],
        fallback: "水路失守后中路补桥，A/B 都收缩包点等回防。",
        routes: [
          { label: "水路反清", color: routeColors[0], points: ["ct", "bridge", "canal"] },
          { label: "中路补位", color: routeColors[2], points: ["ct", "mid", "bridge"] },
        ],
      },
      {
        id: "anubis-ct-b-hold", side: "CT", title: "B 区三层防守", goal: "默认", roundTypes: ["长枪局"], difficulty: "简单", tempo: "默认",
        summary: "B 主、包点、警家三层拖延，避免第一波直接崩盘。",
        call: "B 别单干，第一层交道具，第二层等回防。",
        setup: ["2 人 B", "1 人水路", "2 人 A/中路"],
        utility: ["B 主火", "B 点烟", "警家闪", "水路烟"],
        steps: ["开局 B 主火看动静", "第二身位架补枪", "压力大退包点等警家闪", "水路队友优先断后路"],
        fallback: "B 被破后保警家和水路两路回防，不从同一个门挤进去。",
        routes: [
          { label: "B 三层", color: routeColors[1], points: ["ct", "b", "b-main"] },
          { label: "水路断后", color: routeColors[2], points: ["ct", "bridge", "canal"] },
        ],
      },
    ],
  },
  {
    id: "dust2",
    name: "Dust II",
    pool: "现役",
    theme: "A 大、A 小、中门三条线同时牵动回防。",
    tNote: "A 大和 A 小最好同时有压力，B 洞爆点要快。",
    ctNote: "开局 A 大信息很关键，中门不能无声丢。",
    points: [
      point("t", "T 出生点", 39, 91, "spawn"), point("long", "A 大", 18, 46), point("pit", "大坑", 18, 30, "danger"),
      point("short", "A 小", 36, 39), point("mid", "中路", 50, 57), point("doors", "中门", 55, 38),
      point("b-tun", "B 洞", 83, 70), point("b", "B 包点", 21, 12, "site"), point("a", "A 包点", 80, 16, "site"),
      point("ct", "CT", 62, 21, "spawn"), point("car", "A 车", 24, 33),
    ],
    tactics: [
      {
        id: "dust2-t-a-split", side: "T", title: "A 大 A 小夹 A", goal: "爆点", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
        summary: "A 大拿坑位，A 小同步出，警家烟断回防。",
        call: "A 大先拿坑，A 小等烟，两个口一起出。",
        setup: ["2 人 A 大", "2 人 A 小", "1 人中路断 B 回防"],
        utility: ["警家烟", "A 车火", "A 大闪", "A 小闪"],
        steps: ["A 大先抢坑但不要无脑冲包点", "A 小队友清近点", "警家烟落后同步出", "下包后坑和 A 小交叉"],
        fallback: "A 大被压死就保 A 小，转中门夹 B。",
        routes: [
          { label: "A 大主攻", color: routeColors[0], points: ["t", "long", "pit", "a"] },
          { label: "A 小同步", color: routeColors[1], points: ["t", "mid", "short", "a"] },
          { label: "中路断回防", color: routeColors[2], points: ["t", "mid", "doors"] },
        ],
      },
      {
        id: "dust2-t-b-pop", side: "T", title: "B 洞爆点", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
        summary: "短时间多人冲 B，靠闪和补枪打掉近点。",
        call: "B 洞快，第一颗闪后别停，先清车位和平台。",
        setup: ["5 人 B 洞或 4 洞 1 中门"],
        utility: ["B 门烟", "平台火", "B 洞双闪"],
        steps: ["全员贴 B 洞等闪", "第一身位跳出吸枪线", "第二身位补平台和包点", "下包后 B 洞和车位交叉"],
        fallback: "B 洞被火拖住时中路队友摸门，等第二时间夹 B。",
        routes: [
          { label: "B 洞快攻", color: routeColors[0], points: ["t", "b-tun", "b"] },
          { label: "中门夹击", color: routeColors[2], points: ["t", "mid", "doors", "b"] },
        ],
      },
      {
        id: "dust2-ct-long", side: "CT", title: "A 大三人抢信息", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "提速",
        summary: "开局三人 A 大拿信息，拿到后立刻退坑或 A 点。",
        call: "三人抢 A 大，拿信息就退，B 别前压。",
        setup: ["3 人 A 大", "1 人中门", "1 人 B"],
        utility: ["A 大门闪", "蓝箱火", "A 大烟"],
        steps: ["双闪后第一身位过门", "第三人负责补枪不抢第一枪", "看见多人立刻退坑", "中门队友盯 A 小"],
        fallback: "A 大没人时留一人坑，两人回 A 小和中路。",
        routes: [
          { label: "A 大反清", color: routeColors[0], points: ["ct", "a", "long"] },
          { label: "中门信息", color: routeColors[2], points: ["ct", "doors", "mid"] },
        ],
      },
      {
        id: "dust2-ct-b-anchor", side: "CT", title: "B 区保守锚点", goal: "默认", roundTypes: ["长枪局"], difficulty: "简单", tempo: "默认",
        summary: "B 不赌前压，靠道具和中门信息等回防。",
        call: "B 单人别前顶，听洞，等中门报点。",
        setup: ["1 人 B", "1 人中门", "3 人 A 侧"],
        utility: ["B 洞火", "B 门烟", "反清闪"],
        steps: ["B 洞有动静先火", "中门队友帮看夹 B", "B 被爆先活着退车位", "回防别急穿门，等闪"],
        fallback: "B 洞长期安静，中门队友可以补 A 小，B 锚点继续活着听。",
        routes: [
          { label: "B 锚点", color: routeColors[1], points: ["ct", "b", "b-tun"] },
          { label: "中门补位", color: routeColors[2], points: ["ct", "doors"] },
        ],
      },
    ],
  },
  {
    id: "cache",
    name: "Cache",
    pool: "现役",
    theme: "中路拿下后，A/B 两点都会被夹出缺口。",
    tNote: "中路要和 A 主/B 仓形成同步，不要单人孤立控中。",
    ctNote: "中路一丢要主动收缩，包点别被两边同时夹。",
    points: [
      point("t", "T 出生点", 88.7, 58.5, "spawn"), point("a-main", "A 主", 23, 62), point("squeaky", "门房", 41, 45),
      point("mid", "中路", 50, 56), point("vents", "通风管", 53, 46), point("b-main", "B 仓", 79, 65),
      point("a", "A 包点", 32.5, 26, "site"), point("b", "B 包点", 34.5, 79, "site"), point("truck", "车位", 42, 33),
      point("heaven", "二楼", 72, 55), point("ct", "CT", 9.775, 47.3, "spawn"),
    ],
    tactics: [
      {
        id: "cache-t-mid-a", side: "T", title: "中路夹 A", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
        summary: "中路进通风管或车位，与 A 主和门房同步夹 A。",
        call: "先控中，A 主别早露，通风管到位再打。",
        setup: ["2 人中路", "2 人 A 主/门房", "1 人 B 仓断信息"],
        utility: ["中路烟", "白箱火", "车位烟", "A 主闪"],
        steps: ["中路先清沙袋和白箱", "一人进通风管断二楼", "A 主门房等闪同步", "包点先清车位和叉车"],
        fallback: "中路没拿到就门房留人，转 B 仓爆点。",
        routes: [
          { label: "中路夹 A", color: routeColors[0], points: ["t", "mid", "vents", "a"] },
          { label: "A 主同步", color: routeColors[1], points: ["t", "a-main", "a"] },
          { label: "B 仓牵制", color: routeColors[3], points: ["t", "b-main"] },
        ],
      },
      {
        id: "cache-t-b-pop", side: "T", title: "B 仓快爆", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
        summary: "B 仓快速进点，配合中路通风管断二楼。",
        call: "B 快，中路一个进通风管，B 仓别停。",
        setup: ["4 人 B 仓", "1 人中路通风管"],
        utility: ["B 包点烟", "二楼烟", "B 仓双闪"],
        steps: ["B 仓第一时间贴近", "闪后清包点死角", "中路队友进通风管切二楼", "下包后守仓口和二楼"],
        fallback: "B 仓被双雷重创，中路队友保枪线，退回默认等第二时间。",
        routes: [
          { label: "B 仓爆点", color: routeColors[0], points: ["t", "b-main", "b"] },
          { label: "通风管断二楼", color: routeColors[2], points: ["t", "mid", "vents", "b"] },
        ],
      },
      {
        id: "cache-ct-mid", side: "CT", title: "中路双人控图", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
        summary: "中路双人交叉拿信息，A/B 根据中路状态调整站位。",
        call: "中路两个人互相补，丢中就立刻收点。",
        setup: ["2 人中路", "2 人 A", "1 人 B"],
        utility: ["中路烟", "白箱闪", "A 主火", "B 仓火"],
        steps: ["开局中路烟后架白箱", "第二人补通风管", "看到多人控中就叫 A/B 收缩", "不要在中路被单抓"],
        fallback: "中路失守时，A 人退车位，B 人退包点等二楼回防。",
        routes: [
          { label: "中路交叉", color: routeColors[2], points: ["ct", "mid"] },
          { label: "A 主拖延", color: routeColors[0], points: ["ct", "a", "a-main"] },
          { label: "B 仓拖延", color: routeColors[1], points: ["ct", "b", "b-main"] },
        ],
      },
      {
        id: "cache-ct-b-push", side: "CT", title: "B 仓反清偷枪", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
        summary: "低经济用 B 仓双人闪出，赌 T 默认慢控。",
        call: "B 两个反清，打一波就退，别贪家门口。",
        setup: ["2 人 B 仓", "2 人 A", "1 人中路"],
        utility: ["B 仓闪", "B 仓火", "退点烟"],
        steps: ["开局等一秒听脚步", "闪出清 B 仓近点", "拿到枪马上退包点", "中路队友别同步冒险"],
        fallback: "B 仓没人就一人留近点，一人回中路，保持人数。",
        routes: [
          { label: "B 仓反清", color: routeColors[0], points: ["ct", "b", "b-main"] },
          { label: "回点", color: routeColors[3], points: ["b-main", "b"] },
        ],
      },
    ],
  },
  {
    id: "overpass",
    name: "Overpass",
    pool: "备用",
    theme: "A 厕所和 B 短水是信息核心，转点路线很长。",
    tNote: "厕所慢控和下水道夹 B 都要有耐心。",
    ctNote: "前压信息很值钱，但死了会让回防很远。",
    points: [
      point("t", "T 出生点", 66, 93, "spawn"), point("fountain", "喷泉", 40, 73), point("toilets", "厕所", 43, 57),
      point("long", "A 长", 30, 48), point("a", "A 包点", 55, 23, "site"), point("connector", "连接", 51, 52),
      point("water", "短水", 61, 75), point("monster", "怪兽", 77, 82), point("b", "B 包点", 70, 31, "site"),
      point("bank", "银行", 52, 17), point("ct", "CT", 49, 20, "spawn"),
    ],
    tactics: [
      {
        id: "overpass-t-a-control", side: "T", title: "厕所控图打 A", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "慢控",
        summary: "喷泉厕所慢控，清长管和厕所后再决定 A 爆或转 B。",
        call: "厕所慢控，别被前压偷，拿到厕所再打 A。",
        setup: ["3 人厕所", "1 人连接", "1 人怪兽断 B 信息"],
        utility: ["厕所火", "银行烟", "垃圾桶火", "A 点闪"],
        steps: ["喷泉先反清近点", "厕所双人交叉慢推", "银行烟落后清包点", "下包后厕所和长管交叉"],
        fallback: "A 前压太重就留厕所压力，连接下水道转 B。",
        routes: [
          { label: "厕所主线", color: routeColors[0], points: ["t", "fountain", "toilets", "a"] },
          { label: "A 长补位", color: routeColors[1], points: ["t", "long", "a"] },
          { label: "连接转点", color: routeColors[2], points: ["t", "connector"] },
        ],
      },
      {
        id: "overpass-t-b-split", side: "T", title: "短水怪兽夹 B", goal: "爆点", roundTypes: ["半起局", "长枪局"], difficulty: "中等", tempo: "爆弹",
        summary: "短水和怪兽同时进，重点清柱子和水下。",
        call: "B 夹，短水到位再怪兽出，别一条线送。",
        setup: ["2 人短水", "3 人怪兽"],
        utility: ["B 点烟", "柱子火", "水下火", "怪兽双闪"],
        steps: ["短水先清近点", "怪兽等短水报到位", "双线同时清包点", "下包后怪兽和短水各留人"],
        fallback: "短水被反清掉人，怪兽不要硬爆，退连接转 A。",
        routes: [
          { label: "短水夹 B", color: routeColors[1], points: ["t", "connector", "water", "b"] },
          { label: "怪兽主攻", color: routeColors[0], points: ["t", "monster", "b"] },
        ],
      },
      {
        id: "overpass-ct-a-push", side: "CT", title: "厕所前压拿信息", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "进阶", tempo: "提速",
        summary: "A 区双人前压厕所，拿到信息后立刻退银行。",
        call: "A 前压厕所，拿信息退，不要追喷泉。",
        setup: ["2 人厕所", "1 人银行", "2 人 B"],
        utility: ["厕所闪", "喷泉火", "退点烟"],
        steps: ["开局双人贴厕所", "闪后看喷泉人数", "拿到信息后退银行和包点", "B 区根据报点前压短水"],
        fallback: "厕所没人就留一人长管，一人回银行，防连接转点。",
        routes: [
          { label: "厕所前压", color: routeColors[0], points: ["ct", "bank", "toilets", "fountain"] },
          { label: "B 区联动", color: routeColors[2], points: ["ct", "b", "water"] },
        ],
      },
      {
        id: "overpass-ct-b-hold", side: "CT", title: "B 短水双锁", goal: "默认", roundTypes: ["长枪局"], difficulty: "简单", tempo: "默认",
        summary: "B 区双人守短水和怪兽，信息够了再叫 A 回防。",
        call: "B 两个别都看怪兽，短水必须有人听。",
        setup: ["2 人 B", "2 人 A", "1 人连接"],
        utility: ["怪兽烟", "短水火", "反清闪"],
        steps: ["短水先用火拖", "怪兽烟别太早交完", "连接队友听下水道", "B 爆时等闪反清水下"],
        fallback: "短水丢失就退包点双架，不要在水里接三面枪。",
        routes: [
          { label: "短水防线", color: routeColors[1], points: ["ct", "b", "water"] },
          { label: "怪兽防线", color: routeColors[0], points: ["ct", "b", "monster"] },
        ],
      },
    ],
  },
  {
    id: "train",
    name: "Train",
    pool: "备用",
    theme: "外场视野开阔，内场爆弹速度快，回防路线需要提前规划。",
    tNote: "外场烟墙能切割枪线，内场要靠爆弹一口气进。",
    ctNote: "外场别只站一条线，内场至少留反清道具。",
    points: [
      point("t", "T 出生点", 12, 25, "spawn"), point("ivy", "绿通", 24, 20), point("main", "匪口", 40, 60),
      point("ladder", "五道", 40, 45), point("outer", "外场", 54, 52), point("a", "A 包点", 63, 49, "site"),
      point("pop", "六道", 72, 48), point("inner", "内场", 85, 66), point("b", "B 包点", 52, 76, "site"),
      point("ct", "CT", 86, 77, "spawn"), point("heaven", "二楼", 74, 24, "danger"),
    ],
    tactics: [
      {
        id: "train-t-outer-wall", side: "T", title: "外场烟墙夹 A", goal: "爆点", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "爆弹",
        summary: "烟墙切割警家和包车，多线从匪口、绿通、五道夹外场。",
        call: "外场烟墙，绿通五道到位，匪口别先死。",
        setup: ["2 人匪口", "1 人绿通", "1 人五道", "1 人内场断回防"],
        utility: ["外场烟墙", "绿通火", "包车闪", "警家烟"],
        steps: ["烟墙先落，绿通看侧翼", "五道队友卡警家枪线", "匪口双人出清包车", "下包后绿通和五道交叉"],
        fallback: "外场被反烟挡住时，保留绿通，内场队友提速转 B。",
        routes: [
          { label: "匪口主攻", color: routeColors[0], points: ["t", "main", "outer", "a"] },
          { label: "绿通夹击", color: routeColors[1], points: ["t", "ivy", "a"] },
          { label: "五道补枪", color: routeColors[2], points: ["t", "ladder", "outer"] },
        ],
      },
      {
        id: "train-t-inner-pop", side: "T", title: "内场爆弹", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
        summary: "多颗闪和火直接冲内场，目标是快速下包打残局。",
        call: "内场快，火清近点，二楼烟后直接进。",
        setup: ["4 人内场", "1 人外场断前压"],
        utility: ["内场近点火", "二楼烟", "低坡闪"],
        steps: ["内场门口集合不露脚步", "闪后第一身位清近点", "第二身位看二楼和低坡", "下包后双人守内场门"],
        fallback: "被火拖住就等火灭再二次爆，不要残血硬钻。",
        routes: [
          { label: "内场爆点", color: routeColors[0], points: ["t", "inner", "b"] },
          { label: "外场断前压", color: routeColors[2], points: ["t", "main", "outer"] },
        ],
      },
      {
        id: "train-ct-outer-cross", side: "CT", title: "外场多线交叉", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
        summary: "外场至少两条枪线交叉，避免被烟墙一切就全失守。",
        call: "外场别站一排，绿通和五道都报清楚。",
        setup: ["3 人外场", "2 人内场/警家"],
        utility: ["匪口火", "外场反烟", "绿通闪", "内场火"],
        steps: ["匪口先火拖节奏", "一人看绿通，一人看五道", "烟墙成型就退二线", "内场队友不要过早回防"],
        fallback: "外场丢失后保警家和二楼，等内场人一起反清。",
        routes: [
          { label: "外场交叉", color: routeColors[1], points: ["ct", "outer", "main"] },
          { label: "绿通信息", color: routeColors[2], points: ["ct", "ivy"] },
          { label: "内场锚点", color: routeColors[0], points: ["ct", "b", "inner"] },
        ],
      },
      {
        id: "train-ct-inner-stack", side: "CT", title: "内场三人赌防", goal: "反清", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "提速",
        summary: "低经济把人数压到内场，用近距离交叉换枪。",
        call: "三内场赌，外场别白给，听到外场就保枪线回防。",
        setup: ["3 人内场", "2 人外场收缩"],
        utility: ["内场闪", "近点火", "退点烟"],
        steps: ["内场三人站不同高度", "听到脚步先闪不先 peek", "拿到枪后退二楼和低坡", "外场队友保持回防路线"],
        fallback: "内场没人时一人前探拿信息，另两人继续包点，别全部跑外场。",
        routes: [
          { label: "内场赌防", color: routeColors[0], points: ["ct", "b", "inner"] },
          { label: "外场回防", color: routeColors[3], points: ["ct", "outer", "b"] },
        ],
      },
    ],
  },
];

const extraTacticsByMap: Record<string, Tactic[]> = {
  mirage: [
    {
      id: "mirage-t-b-apps-pop", side: "T", title: "B 二楼快爆", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
      summary: "B 二楼集合用闪冲点，中路队友第二时间压短箱断超市。",
      call: "B 快，二楼两颗闪直接出，中路能到短箱就夹。",
      setup: ["4 人 B 二楼", "1 人中路控短箱或断拱门"],
      utility: ["B 二楼瞬爆闪", "超市门烟", "包点火", "短箱闪"],
      steps: ["B 二楼别提前露脚步太久", "第一颗闪后第一身位跳出吸枪线", "第二身位清车位和包点死角", "中路队友到短箱后别追超市，先断回防"],
      fallback: "B 二楼被火拖住时，中路队友别单人送，等火灭后二次爆或转拱门夹 A。",
      routes: [
        { label: "B 二楼快出", color: routeColors[0], points: ["t", "apps", "b"] },
        { label: "中路短箱夹击", color: routeColors[2], points: ["t", "mid", "short", "b"] },
        { label: "A 坡假动静", color: routeColors[3], points: ["t", "ramp"] },
      ],
    },
    {
      id: "mirage-t-late-fake-a", side: "T", title: "默认控中假 B 转 A", goal: "默认", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
      summary: "先用 B 二楼和中路制造压力，逼 CT 调 B，再从 A 坡和二楼收尾。",
      call: "先控中假 B，听他们补 B 后转 A，A 坡别早暴露。",
      setup: ["2 人中路", "1 人 B 二楼做声", "2 人 A 坡/二楼慢摸"],
      utility: ["窗口烟", "短箱火", "B 二楼假闪", "警家烟", "A 点闪"],
      steps: ["开局中路拿窗口和拱门压力", "B 二楼用闪或脚步骗超市补防", "A 坡二楼保持安静等队友回转", "A 烟闪落后双线进点"],
      fallback: "A 坡被反清时不要硬转，保中路和 B 二楼夹 B。",
      routes: [
        { label: "中路假压力", color: routeColors[2], points: ["t", "mid", "short"] },
        { label: "B 二楼牵制", color: routeColors[3], points: ["t", "apps"] },
        { label: "A 区收尾", color: routeColors[0], points: ["t", "ramp", "a"] },
        { label: "二楼补点", color: routeColors[1], points: ["t", "palace", "a"] },
      ],
    },
    {
      id: "mirage-ct-mid-pin", side: "CT", title: "窗口短箱夹中", goal: "反清", roundTypes: ["长枪局"], difficulty: "中等", tempo: "提速",
      summary: "窗口先拿首段信息，短箱队友用闪夹中路，打完立即回结构。",
      call: "中路夹一下，窗口别贪，短箱闪完打一波就退。",
      setup: ["1 人窗口", "1 人短箱", "2 人 A", "1 人 B"],
      utility: ["中路反清闪", "拱门烟", "B 二楼火"],
      steps: ["窗口先看中路人数", "短箱队友等窗口报点后补闪", "两边同时peek只打一波", "拿到优势后窗口退警家，短箱退 B 或超市"],
      fallback: "中路没人时别继续压 T 家，窗口保信息，短箱回 B 二楼。",
      routes: [
        { label: "窗口压中", color: routeColors[2], points: ["ct", "window", "mid"] },
        { label: "短箱夹中", color: routeColors[0], points: ["ct", "market", "short", "mid"] },
      ],
    },
    {
      id: "mirage-ct-b-stack-retake-a", side: "CT", title: "三 B 信息赌防", goal: "默认", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "默认",
      summary: "低经济把人数压 B 和短箱，A 点只拖不拼，赌 B 快攻或中路转 B。",
      call: "三 B 赌一把，A 活着拖，中路听到人就往 B 收。",
      setup: ["3 人 B/短箱", "1 人 A 点", "1 人警家补 A"],
      utility: ["B 二楼火", "超市烟", "短箱闪", "A 坡烟"],
      steps: ["B 二楼先火拖第一波", "短箱别单人前压，等超市闪", "A 人看到爆弹就只拖时间", "B 没人时一人回窗口补中"],
      fallback: "A 被快速爆掉后，不从警家一个个进，等短箱和 CT 两路一起回防。",
      routes: [
        { label: "B 区重防", color: routeColors[1], points: ["ct", "market", "b", "apps"] },
        { label: "短箱联动", color: routeColors[2], points: ["ct", "short", "mid"] },
        { label: "A 点拖延", color: routeColors[3], points: ["ct", "a", "ramp"] },
      ],
    },
  ],
  inferno: [
    {
      id: "inferno-t-arch-wrap", side: "T", title: "拱门书房包夹 A", goal: "默认", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
      summary: "慢清中路后从拱门、书房和二楼形成三向 A 区压力。",
      call: "中路慢清，拱门到书房再出，二楼别自己跳。",
      setup: ["2 人中路控拱门", "2 人二楼", "1 人香蕉道防前压"],
      utility: ["拱门烟", "书房火", "二楼闪", "大坑火"],
      steps: ["中路先逼退近点", "二楼清锅炉房但不急跳", "拱门队友压到书房后同步", "包点优先解决大坑和短箱交叉"],
      fallback: "拱门被烟火封死时，二楼留人控信息，其余转香蕉打 B。",
      routes: [
        { label: "拱门书房", color: routeColors[0], points: ["t", "mid", "arch", "library", "a"] },
        { label: "二楼夹击", color: routeColors[1], points: ["t", "alt", "second", "a"] },
        { label: "香蕉断前压", color: routeColors[3], points: ["t", "banana"] },
      ],
    },
    {
      id: "inferno-t-apps-burst", side: "T", title: "二楼瀑布提速", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
      summary: "半起或 ECO 用二楼快节奏打乱 A 点站位，中路队友同步补枪。",
      call: "二楼快，闪落直接跳，中路跟补别慢。",
      setup: ["3 人二楼", "2 人中路"],
      utility: ["二楼瞬爆闪", "大坑火", "短箱烟"],
      steps: ["二楼队友集合等闪", "第一身位跳阳台不回头", "中路两人同步出短箱", "能下包就下短箱位，没包先捡枪"],
      fallback: "二楼被火卡住时，中路别硬出，退回侧道等第二波闪。",
      routes: [
        { label: "二楼瀑布", color: routeColors[0], points: ["t", "alt", "second", "a"] },
        { label: "中路补枪", color: routeColors[2], points: ["t", "mid", "a"] },
      ],
    },
    {
      id: "inferno-ct-apps-crunch", side: "CT", title: "二楼夹击反清", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "提速",
      summary: "A 区两人用闪同时夹二楼，拿到信息后别继续追匪口。",
      call: "A 夹二楼，闪后清一下，没人就退默认。",
      setup: ["1 人二楼下", "1 人拱门/短箱补闪", "2 人 B", "1 人书房"],
      utility: ["二楼反清闪", "锅炉房火", "退点烟"],
      steps: ["听到二楼动静先叫队友补闪", "第一人清锅炉房，第二人架补枪", "拿到击杀后退大坑或书房", "B 区不要同步前压"],
      fallback: "二楼没人时留一人听，另一人回短箱防中路爆 A。",
      routes: [
        { label: "二楼反清", color: routeColors[0], points: ["ct", "a", "second"] },
        { label: "拱门补闪", color: routeColors[2], points: ["ct", "arch", "second"] },
      ],
    },
    {
      id: "inferno-ct-heavy-b", side: "CT", title: "三 B 香蕉赌防", goal: "默认", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "默认",
      summary: "低经济用三人 B 和香蕉交叉换枪，A 区收缩只保信息。",
      call: "三 B，香蕉有声音就闪打，A 不前顶。",
      setup: ["3 人 B/香蕉", "2 人 A 收缩"],
      utility: ["香蕉道烟", "木桶火", "反清闪", "A 短烟"],
      steps: ["开局三 B 分不同高度", "第一波用火烟拖住", "听到贴近后双闪反清", "拿到枪就退包点打交叉"],
      fallback: "香蕉长期安静时，一人退警家，一人留棺材，一人补拱门。",
      routes: [
        { label: "香蕉赌防", color: routeColors[0], points: ["ct", "b", "logs", "banana"] },
        { label: "A 区收缩", color: routeColors[3], points: ["ct", "a", "pit"] },
      ],
    },
  ],
  nuke: [
    {
      id: "nuke-t-ramp-b", side: "T", title: "铁板转 B 控图", goal: "控图", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "默认",
      summary: "铁板拿下后不要急下，先逼 CT 下层换位，再夹 B 或回 A。",
      call: "铁板控住，别单下 B，等外场或黄房一起动。",
      setup: ["3 人铁板", "1 人外场断信息", "1 人黄房听 A"],
      utility: ["铁板烟", "铁板闪", "B 口火", "下层烟"],
      steps: ["铁板第一波用烟逼退近点", "两人架回缩，一人慢下 B", "外场队友报 K1 是否有人", "确认下层空位后再集体进 B"],
      fallback: "铁板被重防时保留一人牵制，其余从黄房铁门提速打 A。",
      routes: [
        { label: "铁板下层", color: routeColors[0], points: ["t", "ramp", "b"] },
        { label: "外场断信息", color: routeColors[2], points: ["t", "yard", "secret"] },
        { label: "黄房听 A", color: routeColors[3], points: ["t", "hut"] },
      ],
    },
    {
      id: "nuke-t-yard-fake-a", side: "T", title: "外场烟假下 K1 转 A", goal: "默认", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
      summary: "外场烟墙逼下层轮转，黄房和铁门第二时间打 A 空档。",
      call: "外场给烟假下，听他们转 B 后黄房铁门打 A。",
      setup: ["3 人外场做烟墙", "2 人黄房/铁门待命"],
      utility: ["外场烟墙", "车库火", "天堂烟", "管道火", "A 点闪"],
      steps: ["外场烟墙完整落下", "至少一人做下 K1脚步", "黄房铁门等 CT 下层动静", "A 点爆发时优先清管道和包点"],
      fallback: "A 点仍有多人时，黄房别硬冲，顺管道转 B 与外场汇合。",
      routes: [
        { label: "外场假下", color: routeColors[2], points: ["t", "yard", "secret"] },
        { label: "黄房收尾", color: routeColors[0], points: ["t", "hut", "a"] },
        { label: "铁门同步", color: routeColors[1], points: ["t", "squeaky", "a"] },
      ],
    },
    {
      id: "nuke-ct-upper-cross", side: "CT", title: "A 点三线交叉", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "A 点不站一条线，用黄房、铁门、天堂/警家形成交叉拖时间。",
      call: "A 稳住，黄房铁门别都看同一边，外场报烟墙。",
      setup: ["2 人 A", "1 人天堂/警家", "1 人外场", "1 人铁板"],
      utility: ["黄房火", "铁门烟", "A 点反清闪", "外场反烟"],
      steps: ["黄房火拖第一波", "铁门位只打补枪不单拉", "外场烟墙成型立刻报下层", "A 被爆时先活着等天堂闪"],
      fallback: "A 道具被耗光时，警家退后架管道，铁板队友快速补 A。",
      routes: [
        { label: "A 点交叉", color: routeColors[1], points: ["ct", "a", "hut"] },
        { label: "铁门防线", color: routeColors[0], points: ["ct", "a", "squeaky"] },
        { label: "外场信息", color: routeColors[2], points: ["ct", "garage", "yard"] },
      ],
    },
    {
      id: "nuke-ct-yard-push", side: "CT", title: "外场红箱前顶", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "中等", tempo: "提速",
      summary: "低经济或想变奏时抢外场红箱，拿到信息后回车库和警家。",
      call: "外场抢一下，红箱闪后看，见人打一波就回。",
      setup: ["2 人外场", "2 人 A", "1 人铁板"],
      utility: ["红箱闪", "外场火", "退车库烟"],
      steps: ["开局一人红箱一人车库补枪", "闪后只看外场第一波", "拿到击杀立刻退回车库", "A 点不要同步前压黄房"],
      fallback: "外场没人就留车库信息，红箱队友退 A 点，防黄房爆弹。",
      routes: [
        { label: "红箱前顶", color: routeColors[0], points: ["ct", "garage", "silo", "yard"] },
        { label: "铁板守线", color: routeColors[3], points: ["ct", "ramp"] },
      ],
    },
  ],
  ancient: [
    {
      id: "ancient-t-mid-b-split", side: "T", title: "中路洞口夹 B", goal: "控图", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
      summary: "红房控中后压洞口，与 B 坡队友同步夹 B 点。",
      call: "控中到洞口，B 坡等洞口到位再打。",
      setup: ["2 人红房中路", "2 人 B 坡", "1 人长廊断 A 前压"],
      utility: ["中路烟", "洞口火", "B 坡闪", "警家烟"],
      steps: ["红房先清近点", "中路队友压甜甜圈和洞口", "B 坡队友等闪后同步", "下包后洞口和 B 坡各留一人"],
      fallback: "洞口被反清时，B 坡不要硬爆，转甜甜圈夹 A。",
      routes: [
        { label: "中路洞口", color: routeColors[2], points: ["t", "red", "mid", "cave", "b"] },
        { label: "B 坡同步", color: routeColors[0], points: ["t", "ramp", "b"] },
        { label: "长廊断前压", color: routeColors[3], points: ["t", "lane"] },
      ],
    },
    {
      id: "ancient-t-a-tempo", side: "T", title: "长廊甜甜圈快夹 A", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
      summary: "用快节奏压 A，甜甜圈队友只负责切回防，不追深。",
      call: "A 快，长廊先贴，甜甜圈到就一起出。",
      setup: ["3 人长廊", "2 人红房转甜甜圈"],
      utility: ["长廊闪", "A 点烟", "甜甜圈火"],
      steps: ["长廊第一时间贴近等闪", "红房两人快速到甜甜圈", "两线同步清包点", "下包后长廊和甜甜圈交叉"],
      fallback: "长廊被烟拖住时，甜甜圈别单出，转中路等第二波道具。",
      routes: [
        { label: "长廊快出", color: routeColors[0], points: ["t", "lane", "a"] },
        { label: "甜甜圈夹击", color: routeColors[1], points: ["t", "red", "mid", "donut", "a"] },
      ],
    },
    {
      id: "ancient-ct-donut-crunch", side: "CT", title: "甜甜圈反清中路", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "提速",
      summary: "甜甜圈和中路队友用闪反清红房，拿到信息后回 A/B 结构。",
      call: "甜甜圈夹中，闪后一波，没人就退别追红房深处。",
      setup: ["2 人甜甜圈/中路", "1 人洞口", "2 人包点"],
      utility: ["中路反清闪", "红房火", "退点烟"],
      steps: ["甜甜圈先听中路节奏", "队友补闪后同步peek", "拿到击杀或信息立即后撤", "洞口根据中路信息补 B"],
      fallback: "中路没人时甜甜圈留信息，另一人回 A 长廊。",
      routes: [
        { label: "甜甜圈反清", color: routeColors[0], points: ["ct", "donut", "mid", "red"] },
        { label: "洞口补位", color: routeColors[2], points: ["ct", "cave", "ramp"] },
      ],
    },
    {
      id: "ancient-ct-a-retake-shape", side: "CT", title: "A 点回防结构", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "A 点被压时不死守长廊，保警家、甜甜圈和包点三路回防。",
      call: "A 别送，长廊失守就退，甜甜圈和警家一起回。",
      setup: ["2 人 A", "1 人甜甜圈", "1 人洞口", "1 人 B"],
      utility: ["A 长廊火", "甜甜圈烟", "警家闪", "包点火"],
      steps: ["长廊有压力先交火拖", "甜甜圈队友不要被单抓", "A 点退二线等警家闪", "回防时甜甜圈和警家同步"],
      fallback: "A 已被下包时，先清长廊后点，不要所有人从警家挤。",
      routes: [
        { label: "A 点二线", color: routeColors[1], points: ["ct", "a", "lane"] },
        { label: "甜甜圈回防", color: routeColors[2], points: ["ct", "donut", "a"] },
        { label: "洞口守 B", color: routeColors[3], points: ["ct", "cave", "ramp"] },
      ],
    },
  ],
  anubis: [
    {
      id: "anubis-t-mid-b-split", side: "T", title: "中路连接夹 B", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "中路压连接切警家，与 B 主同步打 B，避免只从 B 主单线进。",
      call: "中路到连接再 B，B 主别先送，等夹击。",
      setup: ["2 人中路", "2 人 B 主", "1 人水路断回防"],
      utility: ["中路烟", "连接火", "B 点烟", "B 主闪"],
      steps: ["中路先清桥下和连接", "B 主队友贴近等闪", "连接到位后双线同步", "下包后水路和 B 主守交叉"],
      fallback: "中路失守就不要硬夹 B，B 主保压力，水路转 A。",
      routes: [
        { label: "中路连接", color: routeColors[2], points: ["t", "mid", "connector", "b"] },
        { label: "B 主同步", color: routeColors[0], points: ["t", "b-main", "b"] },
        { label: "水路断回防", color: routeColors[1], points: ["t", "canal", "bridge"] },
      ],
    },
    {
      id: "anubis-t-a-fake-b", side: "T", title: "A 主假压转 B", goal: "默认", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "慢控",
      summary: "A 主交道具骗回防，水路和 B 主第二时间打 B。",
      call: "A 假压别死，等他们补 A 后转水路 B。",
      setup: ["2 人 A 主做压力", "2 人水路", "1 人 B 主慢摸"],
      utility: ["A 主烟火", "水路闪", "B 主烟", "警家烟"],
      steps: ["A 主先用道具制造爆点假象", "水路队友慢慢拿桥", "B 主听到 CT 转点后贴近", "水路和 B 主同步进 B"],
      fallback: "A 主拿到首杀时可以取消假打，直接桥和 A 主夹 A。",
      routes: [
        { label: "A 主假压", color: routeColors[3], points: ["t", "a-main", "a"] },
        { label: "水路转 B", color: routeColors[1], points: ["t", "canal", "connector", "b"] },
        { label: "B 主收尾", color: routeColors[0], points: ["t", "b-main", "b"] },
      ],
    },
    {
      id: "anubis-ct-mid-bridge", side: "CT", title: "中桥双人拿信息", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "默认",
      summary: "中路和桥位联动看水路，避免水路免费切开两点。",
      call: "中桥抢信息，看到水路多人就退，不要站死。",
      setup: ["2 人中路/桥", "1 人 A", "1 人 B", "1 人水路补位"],
      utility: ["中路火", "桥烟", "水路反清闪", "B 主火"],
      steps: ["中路第一波看人数", "桥位队友负责补闪和退路", "水路压力大就叫 A/B 收缩", "拿到信息后不要继续压 T 家"],
      fallback: "中桥丢失时，A/B 都退包点，等警家闪反清。",
      routes: [
        { label: "中桥信息", color: routeColors[2], points: ["ct", "mid", "bridge", "canal"] },
        { label: "B 主拖延", color: routeColors[0], points: ["ct", "b", "b-main"] },
      ],
    },
    {
      id: "anubis-ct-a-main-trap", side: "CT", title: "A 主陷阱交叉", goal: "默认", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "默认",
      summary: "A 主放近后双人交叉换枪，水路队友优先断后路。",
      call: "A 主别早打，放近一点，闪后一起拉。",
      setup: ["2 人 A 主/包点", "1 人水路", "2 人 B/中路"],
      utility: ["A 主近点烟", "包点闪", "水路烟"],
      steps: ["A 主先隐藏脚步", "等 T 贴近后用闪反打", "水路队友看桥防夹击", "拿到枪后退包点交叉"],
      fallback: "A 主没人就留一人听，另一人回桥防中路夹 B。",
      routes: [
        { label: "A 主陷阱", color: routeColors[0], points: ["ct", "a", "a-main"] },
        { label: "水路断后", color: routeColors[2], points: ["ct", "bridge", "canal"] },
      ],
    },
  ],
  dust2: [
    {
      id: "dust2-t-mid-b-split", side: "T", title: "中门夹 B", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "中路队友压门断 CT，B 洞同步进点，解决单线 B 洞太好守的问题。",
      call: "中门到位再 B，洞里别先干拉，等夹击。",
      setup: ["2 人中路", "3 人 B 洞"],
      utility: ["中门烟", "B 门烟", "平台火", "B 洞闪"],
      steps: ["中路先清近点和中门", "B 洞队友贴近但不露太深", "中门烟落后同步进 B", "下包后中门和 B 洞双线守"],
      fallback: "中路被狙架死时，B 洞别硬出，留一人断洞，其余转 A 小。",
      routes: [
        { label: "中门夹 B", color: routeColors[2], points: ["t", "mid", "doors", "b"] },
        { label: "B 洞同步", color: routeColors[0], points: ["t", "b-tun", "b"] },
      ],
    },
    {
      id: "dust2-t-long-contact", side: "T", title: "A 大静音接触", goal: "默认", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "慢控",
      summary: "A 大静音摸坑，A 小第二时间给压力，不靠第一波硬抢。",
      call: "A 大静音，拿坑再叫 A 小，别早交完道具。",
      setup: ["3 人 A 大", "1 人 A 小", "1 人 B 洞断前压"],
      utility: ["A 大门闪", "A 车火", "警家烟", "A 小闪"],
      steps: ["A 大先慢清蓝箱和坑", "A 小队友等大坑到位", "警家烟落后两线出", "下包后坑位优先保命"],
      fallback: "A 大被三人重防时，A 小和 B 洞转中夹 B。",
      routes: [
        { label: "A 大摸坑", color: routeColors[0], points: ["t", "long", "pit", "a"] },
        { label: "A 小后压", color: routeColors[1], points: ["t", "mid", "short", "a"] },
        { label: "B 洞防前压", color: routeColors[3], points: ["t", "b-tun"] },
      ],
    },
    {
      id: "dust2-ct-short-control", side: "CT", title: "A 小主动控图", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "默认",
      summary: "A 小和中门联动拿信息，A 大队友因此可以更稳地站坑或包点。",
      call: "A 小控一下，中门帮看，拿到信息就退 A。",
      setup: ["1 人 A 小", "1 人中门", "2 人 A 大/A 点", "1 人 B"],
      utility: ["A 小闪", "中门烟", "A 大火"],
      steps: ["A 小先用闪拿身位", "中门队友帮看中路夹击", "看到多人中路马上退 A 点", "A 大队友别同时追深"],
      fallback: "A 小被压退时，A 点双人收缩，B 不前压，等中门信息。",
      routes: [
        { label: "A 小控图", color: routeColors[2], points: ["ct", "short", "mid"] },
        { label: "A 大二线", color: routeColors[0], points: ["ct", "a", "long"] },
      ],
    },
    {
      id: "dust2-ct-tunnel-push", side: "CT", title: "B 洞反清偷节奏", goal: "反清", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "提速",
      summary: "低经济双人反清 B 洞，赌 T 默认慢控或 B 洞集合。",
      call: "B 洞抢一波，闪完只打一枪位，拿枪就回。",
      setup: ["2 人 B 洞反清", "1 人中门", "2 人 A"],
      utility: ["B 洞闪", "B 洞火", "回点烟"],
      steps: ["开局等一秒避开第一颗雷", "双闪后一起看洞口", "拿到击杀或枪立刻退 B", "中门队友别同步前顶送"],
      fallback: "B 洞没人就一人留洞口，一人回中门，防 A 快。",
      routes: [
        { label: "B 洞反清", color: routeColors[0], points: ["ct", "b", "b-tun"] },
        { label: "中门补位", color: routeColors[2], points: ["ct", "doors", "mid"] },
      ],
    },
  ],
  cache: [
    {
      id: "cache-t-a-contact", side: "T", title: "A 主门房接触", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
      summary: "A 主和门房近距离同时出，靠补枪冲掉包点第一层。",
      call: "A 主门房一起，别一个个出，车位先清。",
      setup: ["3 人 A 主", "2 人门房"],
      utility: ["A 主闪", "车位火", "包点烟"],
      steps: ["A 主第一时间贴近", "门房同步开门给压力", "第一身位清叉车和车位", "下包后 A 主和门房守交叉"],
      fallback: "门房被压死时，A 主不要硬进，转中路通风管夹 B。",
      routes: [
        { label: "A 主接触", color: routeColors[0], points: ["t", "a-main", "a"] },
        { label: "门房同步", color: routeColors[1], points: ["t", "squeaky", "a"] },
      ],
    },
    {
      id: "cache-t-mid-b-split", side: "T", title: "中路通风管夹 B", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "中路拿通风管切二楼，与 B 仓同步压 B 点。",
      call: "控中进通风管，B 仓等二楼断了再进。",
      setup: ["2 人中路", "2 人 B 仓", "1 人 A 主断前压"],
      utility: ["中路烟", "通风管火", "B 二楼烟", "B 仓闪"],
      steps: ["中路先清白箱和沙袋", "一人进通风管断二楼", "B 仓队友等闪同步", "下包后通风管和仓口交叉"],
      fallback: "中路拿不到时，B 仓保留压力，A 主门房转 A。",
      routes: [
        { label: "通风管夹 B", color: routeColors[2], points: ["t", "mid", "vents", "b"] },
        { label: "B 仓同步", color: routeColors[0], points: ["t", "b-main", "b"] },
        { label: "A 主断前压", color: routeColors[3], points: ["t", "a-main"] },
      ],
    },
    {
      id: "cache-ct-a-main-trap", side: "CT", title: "A 主门房双锁", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "A 主和门房信息互补，避免 A 点被双门同时撕开。",
      call: "A 主和门房互相报，别都看一个口，中路丢了就退车位。",
      setup: ["2 人 A", "2 人中路", "1 人 B"],
      utility: ["A 主火", "门房烟", "车位闪", "中路烟"],
      steps: ["A 主先火拖第一波", "门房位听开门和脚步", "中路失守时 A 人退车位", "A 爆点时等车位闪反打"],
      fallback: "A 主没人时一人回中路补白箱，门房继续听信息。",
      routes: [
        { label: "A 主防线", color: routeColors[0], points: ["ct", "a", "a-main"] },
        { label: "门房信息", color: routeColors[1], points: ["ct", "a", "squeaky"] },
        { label: "中路支援", color: routeColors[2], points: ["ct", "mid"] },
      ],
    },
    {
      id: "cache-ct-mid-vents-pinch", side: "CT", title: "中路通风管夹击", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "中等", tempo: "提速",
      summary: "中路和 B 二楼短时间夹通风管，低经济用近距离换枪。",
      call: "中路夹通风管，B 二楼补枪，打一波就回。",
      setup: ["2 人中路", "1 人 B 二楼/包点", "2 人 A"],
      utility: ["中路闪", "通风管火", "退点烟"],
      steps: ["中路先用闪抢白箱", "B 点队友架通风管出口", "看到 T 控中后同时夹", "拿到优势就退包点结构"],
      fallback: "中路没人时别继续压 T 家，保持 A/B 两点人数。",
      routes: [
        { label: "中路反清", color: routeColors[2], points: ["ct", "mid"] },
        { label: "通风管夹击", color: routeColors[0], points: ["ct", "b", "vents", "mid"] },
      ],
    },
  ],
  overpass: [
    {
      id: "overpass-t-connector-late", side: "T", title: "连接后期转点", goal: "默认", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
      summary: "厕所和连接控住后，根据 CT 前压信息选择 A 收尾或下水道转 B。",
      call: "连接控住别急，听 A/B 哪边少人再决定。",
      setup: ["2 人厕所", "2 人连接/短水", "1 人怪兽断 B 信息"],
      utility: ["厕所火", "连接烟", "短水闪", "银行烟"],
      steps: ["厕所先清近点和长管", "连接队友拿下水道主动权", "怪兽只做压力不硬出", "读到 A 少人就银行烟打 A，否则短水夹 B"],
      fallback: "连接被 CT 控死时，厕所队友不要单打，集合怪兽爆 B。",
      routes: [
        { label: "厕所控图", color: routeColors[0], points: ["t", "fountain", "toilets"] },
        { label: "连接转点", color: routeColors[2], points: ["t", "connector", "water", "b"] },
        { label: "A 收尾", color: routeColors[1], points: ["toilets", "a"] },
      ],
    },
    {
      id: "overpass-t-monster-contact", side: "T", title: "怪兽接触爆 B", goal: "爆点", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "提速",
      summary: "怪兽多人近点接触，短水只负责补枪和清水下。",
      call: "怪兽快，短水到位再冲，柱子水下先清。",
      setup: ["4 人怪兽", "1 人短水"],
      utility: ["怪兽闪", "柱子火", "B 点烟"],
      steps: ["怪兽集合别露太早", "短水队友先到水下附近", "闪后怪兽第一身位冲柱子", "短水同步清水下和后点"],
      fallback: "怪兽被燃烧弹卡住时，短水别单人出，等火灭二次爆。",
      routes: [
        { label: "怪兽主攻", color: routeColors[0], points: ["t", "monster", "b"] },
        { label: "短水补枪", color: routeColors[1], points: ["t", "connector", "water", "b"] },
      ],
    },
    {
      id: "overpass-ct-connector-control", side: "CT", title: "连接主动控图", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "默认",
      summary: "连接位拿到信息后可以支援 A 厕所或 B 短水，别让 T 免费转点。",
      call: "连接拿信息，听到下水道就报，两边别同时前压。",
      setup: ["1 人连接", "2 人 A", "2 人 B"],
      utility: ["连接烟", "下水道火", "短水闪", "厕所闪"],
      steps: ["连接先听下水道动静", "A/B 根据连接信息微调", "T 控连接时先烟退不硬拼", "有机会再叫 B 闪反清短水"],
      fallback: "连接丢失后，A 退银行，B 退包点，等回防别单挑。",
      routes: [
        { label: "连接信息", color: routeColors[2], points: ["ct", "connector", "water"] },
        { label: "A 厕所支援", color: routeColors[0], points: ["ct", "bank", "toilets"] },
      ],
    },
    {
      id: "overpass-ct-long-stack", side: "CT", title: "A 长厕所重防", goal: "默认", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "默认",
      summary: "低经济把人数压 A 长和厕所，B 区用道具拖时间。",
      call: "A 重防，厕所别白给，B 只拖别反清太深。",
      setup: ["3 人 A 长/厕所", "2 人 B 收缩"],
      utility: ["喷泉火", "厕所闪", "A 长烟", "怪兽烟"],
      steps: ["A 长先用火拖喷泉", "厕所队友站交叉不单走", "B 区听到快攻先烟怪兽", "A 没人时一人退银行补 B 回防"],
      fallback: "B 被爆时 A 三人不要一起走银行，留一人长管断后。",
      routes: [
        { label: "A 长重防", color: routeColors[0], points: ["ct", "bank", "a", "long"] },
        { label: "厕所交叉", color: routeColors[1], points: ["ct", "bank", "toilets"] },
        { label: "B 区拖延", color: routeColors[3], points: ["ct", "b", "monster"] },
      ],
    },
  ],
  train: [
    {
      id: "train-t-ladder-inner", side: "T", title: "五道六道夹内场", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "五道和六道切内场二线，内场队友同步打 B。",
      call: "五道到六道，内场等夹击，别一个门硬冲。",
      setup: ["2 人五道/六道", "2 人内场", "1 人外场断前压"],
      utility: ["六道烟", "二楼火", "内场闪"],
      steps: ["五道队友先清近点", "一人压六道切二楼枪线", "内场队友等闪同步", "下包后六道和内场门交叉"],
      fallback: "五道被压死时，内场别硬爆，外场烟墙转 A。",
      routes: [
        { label: "五道六道", color: routeColors[2], points: ["t", "ladder", "pop", "b"] },
        { label: "内场同步", color: routeColors[0], points: ["t", "inner", "b"] },
        { label: "外场断前压", color: routeColors[3], points: ["t", "main", "outer"] },
      ],
    },
    {
      id: "train-t-outer-fake-inner", side: "T", title: "外场假打转内场", goal: "默认", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "慢控",
      summary: "外场烟墙骗 CT 站位外移，内场第二时间爆 B。",
      call: "外场给烟做压力，等他们外场补人后转内场。",
      setup: ["3 人外场做烟墙", "2 人内场待命"],
      utility: ["外场烟墙", "包车闪", "内场火", "二楼烟"],
      steps: ["外场烟墙先完整给出", "匪口队友开枪制造外场压力", "内场两人等待 CT 轮转", "内场烟火落后直接进 B"],
      fallback: "内场被重防时，外场队友保持绿通和匪口，转外场下包。",
      routes: [
        { label: "外场假打", color: routeColors[3], points: ["t", "main", "outer", "a"] },
        { label: "内场收尾", color: routeColors[0], points: ["t", "inner", "b"] },
      ],
    },
    {
      id: "train-ct-popdog-crunch", side: "CT", title: "六道五道反清", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "提速",
      summary: "六道和外场队友同步夹五道，阻止 T 免费切外场。",
      call: "六道夹五道，外场补枪，打一波就退。",
      setup: ["1 人六道", "2 人外场", "2 人内场/警家"],
      utility: ["五道闪", "匪口火", "退点烟"],
      steps: ["六道先听五道脚步", "外场队友给闪后同步夹", "拿到信息就退外场二线", "内场不要同步前压"],
      fallback: "五道没人时六道留信息，外场回包车架枪。",
      routes: [
        { label: "六道反清", color: routeColors[0], points: ["ct", "pop", "ladder"] },
        { label: "外场补枪", color: routeColors[2], points: ["ct", "outer", "ladder"] },
      ],
    },
    {
      id: "train-ct-ivy-push", side: "CT", title: "绿通前顶偷枪", goal: "反清", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "提速",
      summary: "低经济用绿通双人前顶，赌 T 外场默认慢控。",
      call: "绿通两个前顶，拿枪就退，外场别一起送。",
      setup: ["2 人绿通", "2 人外场收缩", "1 人内场"],
      utility: ["绿通闪", "绿通火", "退点烟"],
      steps: ["开局绿通双人贴近", "闪后清第一枪位", "拿到击杀或信息马上退外场", "内场队友保持包点别动"],
      fallback: "绿通没人时一人留近点，一人退警家，防内场快爆。",
      routes: [
        { label: "绿通前顶", color: routeColors[0], points: ["ct", "ivy"] },
        { label: "外场回缩", color: routeColors[3], points: ["ivy", "outer", "ct"] },
      ],
    },
  ],
};

const mapIntelByMap: Record<string, MapIntel> = {
  mirage: {
    fingerprint: "围绕中路做选择题：窗口、拱门、短箱一旦被撬开，A/B 都会被夹。",
    tCore: "T 方先拿中路或制造中路压力，再决定 A 坡/二楼夹 A，或短箱/B 二楼夹 B。",
    ctCore: "CT 要靠中路信息提前换防，A 坡和 B 二楼不能长期只靠单人硬守。",
    avoid: "拿到中路后原地等太久，或者 A 坡、二楼、中路三线不同步。",
    tags: ["中路控图", "A 三线", "B 二楼夹击", "窗口反清"],
  },
  inferno: {
    fingerprint: "香蕉道是节奏阀，二楼和拱门决定 A 区是否能被夹开。",
    tCore: "T 方要先逼 B 道具和 A 二楼信息，第二时间用香蕉/二楼/拱门做取舍。",
    ctCore: "CT 道具必须分层交，香蕉道、二楼、拱门至少一边要有主动信息。",
    avoid: "B 区火烟一秒交完，或 T 方五个人堵香蕉道被雷火耗死。",
    tags: ["香蕉道", "二楼夹 A", "拱门书房", "分层拖延"],
  },
  nuke: {
    fingerprint: "上下层互相牵动：外场烟墙、铁板、黄房声音都会拉动整张图。",
    tCore: "T 方用外场烟墙和铁板制造下层威胁，再反打 A 或顺势打 B。",
    ctCore: "CT 信息要快传：外场烟墙成型、铁板失守、管道打开都会改变回防路线。",
    avoid: "只打一层，或者外场下 K1 后没人能处理黄房/铁门补防。",
    tags: ["外场烟墙", "K1 下层", "铁板转 B", "A/B 垂直欺骗"],
  },
  ancient: {
    fingerprint: "红房、中路、甜甜圈和洞口构成地图发动机，谁控制它们谁能转点。",
    tCore: "T 方用红房控中打开甜甜圈或洞口，再选择 A 长廊夹 A 或 B 坡夹 B。",
    ctCore: "CT 要争中路与洞口信息，B 坡靠道具拖，A 区靠甜甜圈回防。",
    avoid: "中路没处理就单线打 A/B，或者洞口失守后还在包点硬站。",
    tags: ["红房控中", "甜甜圈", "洞口", "B 坡爆弹"],
  },
  anubis: {
    fingerprint: "水路和桥把两边包点连起来，拿到水路就能突然改打方向。",
    tCore: "T 方先控水路/中路，再用 A 主、B 主和连接形成二次夹击。",
    ctCore: "CT 不能免费放水路；一旦水路失守，要主动换空间或收缩等闪反清。",
    avoid: "T 方只从 A 主或 B 主单线干拉，CT 方水路丢了还各守各的。",
    tags: ["水路", "桥", "连接夹击", "A/B 转点"],
  },
  dust2: {
    fingerprint: "A 大、A 小和中门是三条高速通道，回合常由第一波空间决定。",
    tCore: "T 方用 A 大/A 小双线压 A，或中门烟后转 B，长枪局尤其要把中路当转点轴。",
    ctCore: "CT 要用 A 大信息和中门观察提前换防，B 区锚点目标是活着等队友。",
    avoid: "A 大或 B 洞五人无道具硬冲，或者 CT 抢到信息后继续追深送人数。",
    tags: ["A 大", "A 小", "中门", "B 洞快攻"],
  },
  cache: {
    fingerprint: "中路打开后能接通风管打 B，也能压车位打 A，是新版 Cache 的节奏核心。",
    tCore: "T 方围绕中路、A 主/门房、B 仓三点同步，让 CT 不能只靠一个二楼/车位守死。",
    ctCore: "CT 要争中路和通风管信息，A 点车位、B 点二楼必须能互相回补。",
    avoid: "T 方中路没人却强打两边，CT 方中路丢了还站在包点等被夹。",
    tags: ["中路", "通风管", "门房", "B 二楼"],
  },
  overpass: {
    fingerprint: "转点距离长，连接、厕所、短水决定哪边能先到位。",
    tCore: "T 方要用连接和厕所制造回防压力，再选择 A 长收尾或短水/怪兽夹 B。",
    ctCore: "CT 控连接能切断 T 的转点，B 区 Heaven/短水信息决定回防质量。",
    avoid: "T 方怪兽单线爆 B，或 CT 方前压拿到信息后不退被换掉。",
    tags: ["连接", "厕所", "短水", "怪兽"],
  },
  train: {
    fingerprint: "外场多入口、Popdog/五道突袭和内场爆弹共同构成 Train 的节奏。",
    tCore: "T 方用外场烟墙、绿通和五道夹 A，也可以用外场假打拉开内场 B。",
    ctCore: "CT 默认要守住 A Main、Popdog、绿通和连接，连接位负责快速转 B。",
    avoid: "外场所有人站同一条枪线，或 T 方内场爆弹没人处理二楼/回防口。",
    tags: ["外场烟墙", "绿通", "Popdog/五道", "内场爆弹"],
  },
};

const mapAreasByMap: Record<string, RadarArea[]> = {
  mirage: [
    area("t-spawn", "T 出生点", 7, 78, 15, 10, "spawn", -8),
    area("a-ramp-lane", "A 坡长线", 22, 54, 24, 8, "lane", -38),
    area("palace-lane", "二楼通道", 35, 31, 21, 7, "lane", -18),
    area("top-mid", "中路主干", 31, 59, 33, 9, "lane", -16),
    area("window-room", "窗口房", 51, 30, 12, 14, "danger", 0),
    area("connector-room", "拱门", 55, 42, 12, 13, "connector", -12),
    area("catwalk", "短箱", 63, 48, 19, 8, "lane", 10),
    area("b-apps", "B 二楼", 73, 63, 19, 9, "lane", -16),
    area("market-room", "超市", 73, 35, 16, 13, "connector", 0),
    area("a-site", "A 包点", 32, 15, 23, 18, "site", -5),
    area("b-site", "B 包点", 75, 19, 18, 18, "site", 0),
    area("ct-spawn", "警家", 59, 9, 16, 9, "spawn", -8),
  ],
  inferno: [
    area("t-spawn", "T 出生点", 7, 76, 15, 10, "spawn", 8),
    area("banana", "香蕉道", 64, 61, 28, 9, "lane", -28),
    area("logs-car", "木桶/车位", 66, 49, 15, 8, "danger", -16),
    area("b-site", "B 包点", 73, 20, 19, 18, "site", 0),
    area("ct-lane", "警家回防", 53, 12, 28, 9, "spawn", -12),
    area("mid-lane", "中路", 31, 61, 24, 9, "lane", -26),
    area("alt-mid", "侧道", 20, 57, 18, 8, "lane", -18),
    area("apps", "二楼", 21, 35, 20, 8, "lane", -10),
    area("arch", "拱门", 43, 35, 15, 9, "connector", -8),
    area("library", "书房", 50, 22, 13, 10, "connector", 0),
    area("a-site", "A 包点", 29, 18, 22, 17, "site", 0),
    area("pit", "大坑", 20, 22, 13, 12, "danger", -8),
  ],
  nuke: [
    area("t-spawn", "T 出生点", 6, 73, 15, 11, "spawn", 0),
    area("yard", "外场", 27, 54, 33, 12, "lane", -18),
    area("red-silo", "红箱/大仓", 25, 38, 22, 12, "danger", -8),
    area("secret", "K1 下层入口", 52, 68, 17, 10, "connector", 22),
    area("garage", "车库", 42, 37, 16, 13, "connector", 0),
    area("hut", "黄房", 61, 51, 15, 10, "lane", 0),
    area("squeaky", "铁门", 69, 40, 13, 10, "lane", 0),
    area("upper", "A 上层", 59, 22, 22, 18, "site", 0),
    area("vents", "管道", 67, 34, 11, 10, "connector", 0),
    area("ramp", "铁板", 77, 58, 18, 10, "lane", 24),
    area("lower", "B 下层", 56, 78, 24, 14, "site", 0),
    area("ct-spawn", "CT/天堂", 72, 11, 18, 10, "spawn", 0),
  ],
  ancient: [
    area("t-spawn", "T 出生点", 7, 77, 15, 10, "spawn", 0),
    area("red-room", "红房", 34, 62, 20, 10, "lane", 0),
    area("mid", "中路", 43, 48, 23, 10, "lane", -18),
    area("donut", "甜甜圈", 50, 32, 15, 14, "connector", 0),
    area("a-main", "A 长廊", 25, 39, 20, 9, "lane", -18),
    area("a-site", "A 包点", 31, 16, 24, 17, "site", 0),
    area("cave", "洞口", 63, 44, 17, 10, "connector", 0),
    area("b-ramp", "B 坡", 70, 61, 23, 9, "lane", -22),
    area("b-site", "B 包点", 69, 18, 21, 18, "site", 0),
    area("ct-spawn", "CT", 55, 9, 18, 10, "spawn", 0),
    area("temple", "神庙/警家口", 45, 19, 18, 9, "connector", -10),
  ],
  anubis: [
    area("t-spawn", "T 出生点", 7, 78, 15, 10, "spawn", 0),
    area("canal", "水路", 34, 66, 34, 10, "water", -12),
    area("mid", "中路", 42, 47, 24, 10, "lane", -10),
    area("bridge", "桥", 53, 36, 16, 9, "connector", -18),
    area("connector", "连接", 58, 53, 16, 10, "connector", 12),
    area("a-main", "A 主", 23, 41, 20, 9, "lane", -20),
    area("a-site", "A 包点", 21, 17, 20, 18, "site", 0),
    area("b-main", "B 主", 69, 59, 22, 9, "lane", -18),
    area("b-site", "B 包点", 70, 18, 21, 18, "site", 0),
    area("ct-spawn", "警家", 52, 8, 18, 10, "spawn", 0),
    area("heaven", "高台/后点", 60, 18, 15, 9, "danger", 0),
  ],
  dust2: [
    area("t-spawn", "T 出生点", 7, 75, 15, 10, "spawn", 0),
    area("long", "A 大", 19, 47, 23, 9, "lane", -30),
    area("pit", "大坑", 17, 30, 13, 11, "danger", -10),
    area("short", "A 小", 48, 39, 22, 9, "lane", -22),
    area("mid", "中路", 38, 61, 31, 10, "lane", -10),
    area("doors", "中门", 55, 50, 13, 10, "connector", 0),
    area("b-tunnels", "B 洞", 72, 64, 22, 9, "lane", -18),
    area("b-site", "B 包点", 70, 22, 22, 18, "site", 0),
    area("a-site", "A 包点", 27, 16, 23, 17, "site", 0),
    area("ct-spawn", "CT", 57, 13, 18, 10, "spawn", 0),
    area("car", "A 车", 35, 29, 13, 9, "danger", 0),
  ],
  cache: [
    area("t-spawn", "T 出生点", 7, 76, 15, 10, "spawn", 0),
    area("a-main", "A 主", 23, 53, 21, 9, "lane", -20),
    area("squeaky", "门房", 37, 44, 14, 10, "connector", 0),
    area("mid", "中路", 42, 51, 24, 10, "lane", -5),
    area("vents", "通风管", 58, 47, 13, 10, "connector", 0),
    area("b-main", "B 仓", 72, 57, 21, 9, "lane", -18),
    area("a-site", "A 包点", 26, 20, 23, 18, "site", 0),
    area("truck", "车位", 42, 22, 16, 10, "danger", 0),
    area("b-site", "B 包点", 69, 21, 22, 18, "site", 0),
    area("heaven", "B 二楼", 62, 16, 16, 10, "connector", 0),
    area("ct-spawn", "CT/连接", 55, 8, 18, 10, "spawn", 0),
  ],
  overpass: [
    area("t-spawn", "T 出生点", 7, 77, 15, 10, "spawn", 0),
    area("fountain", "喷泉", 29, 58, 22, 10, "lane", -12),
    area("toilets", "厕所", 36, 40, 22, 10, "lane", -12),
    area("long", "A 长", 19, 37, 20, 9, "lane", -18),
    area("a-site", "A 包点", 32, 15, 24, 18, "site", 0),
    area("bank", "银行", 49, 12, 18, 10, "connector", 0),
    area("connector", "连接", 48, 50, 16, 12, "connector", 0),
    area("water", "短水", 60, 58, 24, 10, "water", -10),
    area("monster", "怪兽", 74, 66, 21, 9, "lane", -18),
    area("b-site", "B 包点", 69, 21, 24, 18, "site", 0),
    area("ct-spawn", "CT", 57, 6, 18, 10, "spawn", 0),
  ],
  train: [
    area("t-spawn", "T 出生点", 7, 76, 15, 10, "spawn", 0),
    area("ivy", "绿通", 18, 46, 24, 9, "lane", -22),
    area("a-main", "匪口", 39, 55, 19, 9, "lane", -12),
    area("ladder", "五道", 50, 48, 16, 10, "connector", 0),
    area("outer-yard", "外场", 38, 26, 32, 18, "lane", -4),
    area("a-site", "A 包点", 40, 17, 24, 17, "site", 0),
    area("popdog", "Popdog/六道", 60, 39, 17, 10, "connector", 0),
    area("inner", "内场入口", 70, 51, 22, 9, "lane", -16),
    area("b-site", "B 包点", 70, 21, 22, 18, "site", 0),
    area("heaven", "二楼", 65, 14, 16, 10, "danger", 0),
    area("ct-spawn", "CT/连接", 55, 7, 20, 10, "spawn", 0),
  ],
};

const mapBlueprintsByMap: Record<string, RadarPath[]> = {
  mirage: [
    path("a-site", "M32 23 L42 14 L56 18 L55 31 L44 38 L33 34 Z", "site", 1.2),
    path("b-site", "M73 20 L87 20 L91 33 L82 43 L70 36 Z", "site", 1.2),
    path("t-spawn", "M7 76 L22 73 L25 87 L10 90 Z", "spawn", 1.2),
    path("ct-spawn", "M58 7 L76 7 L78 16 L63 22 Z", "spawn", 1.2),
    path("mid-main", "M17 82 C27 76 34 70 43 64 C51 59 58 52 62 43", "main", 8.8),
    path("a-ramp", "M22 73 C27 62 33 50 38 39 C40 33 43 28 47 23", "main", 9.5),
    path("palace", "M39 34 C43 31 47 28 49 22", "connector", 5.5),
    path("connector", "M62 43 C59 36 56 30 51 24", "connector", 6.5),
    path("catwalk", "M62 43 C69 45 76 42 80 35", "main", 7.4),
    path("b-apps", "M19 82 C37 81 57 73 75 64 C83 60 87 49 82 35", "main", 7.8),
    path("market-ct", "M67 13 C73 19 80 25 82 35", "connector", 6.8),
    path("ct-a", "M67 13 C61 17 55 21 50 25", "connector", 6),
  ],
  inferno: [
    path("a-site", "M28 17 L43 14 L55 23 L49 35 L32 36 L23 28 Z", "site", 1.2),
    path("b-site", "M72 19 L89 18 L93 34 L82 43 L68 35 Z", "site", 1.2),
    path("t-spawn", "M7 75 L22 73 L25 87 L10 90 Z", "spawn", 1.2),
    path("ct-spawn", "M53 8 L74 8 L78 17 L58 23 Z", "spawn", 1.2),
    path("banana", "M16 82 C36 78 53 71 67 61 C77 54 83 44 82 31", "main", 9.2),
    path("car-b", "M70 53 C76 47 80 40 82 31", "danger", 6),
    path("mid", "M16 82 C23 72 30 63 39 58 C45 52 48 43 41 31", "main", 8.6),
    path("second-mid", "M18 67 C24 59 30 51 33 41 C35 34 38 29 42 24", "connector", 6.2),
    path("apps", "M22 58 C22 48 26 40 35 36 C39 34 42 29 42 24", "connector", 5.8),
    path("arch-library", "M41 31 C50 30 58 26 64 18", "connector", 7),
    path("ct-b", "M64 18 C70 20 76 25 82 31", "connector", 7),
  ],
  nuke: [
    path("upper-a", "M59 21 L80 22 L83 39 L69 48 L57 38 Z", "site", 1.2),
    path("lower-b", "M55 75 L80 75 L84 90 L62 94 L51 86 Z", "site", 1.2),
    path("t-spawn", "M6 73 L22 72 L24 85 L8 88 Z", "spawn", 1.2),
    path("ct-spawn", "M71 8 L91 9 L92 19 L74 22 Z", "spawn", 1.2),
    path("yard", "M17 79 C26 68 34 58 46 53 C54 49 61 47 69 42", "main", 10),
    path("red-silo", "M25 39 C33 41 42 42 51 39", "danger", 9),
    path("secret", "M43 55 C50 62 56 71 65 82", "connector", 6.6),
    path("garage-ct", "M52 39 C62 33 73 26 82 15", "connector", 7.4),
    path("hut-a", "M17 79 C36 70 51 61 64 52 C69 47 70 42 70 35", "main", 7.6),
    path("squeaky-a", "M69 50 C75 45 78 39 74 31", "connector", 5.8),
    path("vents", "M70 35 C70 48 68 62 66 82", "connector", 4.8),
    path("ramp-b", "M82 58 C78 67 73 75 66 82", "main", 7.4),
  ],
  ancient: [
    path("a-site", "M31 15 L53 14 L58 28 L49 39 L31 36 L24 25 Z", "site", 1.2),
    path("b-site", "M69 18 L89 17 L93 33 L82 43 L67 35 Z", "site", 1.2),
    path("t-spawn", "M7 77 L23 75 L25 88 L9 90 Z", "spawn", 1.2),
    path("ct-spawn", "M54 7 L74 8 L76 18 L57 20 Z", "spawn", 1.2),
    path("red-mid", "M16 82 C27 72 38 63 48 57 C56 51 61 43 57 36", "main", 8.6),
    path("donut-a", "M57 36 C53 31 50 27 45 23", "connector", 6.4),
    path("a-main", "M18 82 C25 68 31 55 37 44 C40 37 42 30 45 23", "main", 8.4),
    path("cave-b", "M51 57 C61 55 70 53 78 48 C84 43 83 35 80 28", "connector", 6.6),
    path("b-ramp", "M16 82 C35 79 55 72 73 62 C81 56 83 43 80 28", "main", 8.2),
    path("temple", "M63 14 C59 19 54 24 48 30", "connector", 6),
  ],
  anubis: [
    path("a-site", "M20 16 L40 15 L44 30 L34 41 L19 35 Z", "site", 1.2),
    path("b-site", "M69 18 L90 18 L93 35 L81 44 L67 36 Z", "site", 1.2),
    path("t-spawn", "M7 78 L23 76 L25 89 L9 91 Z", "spawn", 1.2),
    path("ct-spawn", "M52 7 L73 8 L76 18 L57 21 Z", "spawn", 1.2),
    path("canal", "M17 83 C30 75 43 70 56 66 C67 63 77 60 87 56", "water", 10),
    path("mid", "M16 83 C28 72 39 60 50 52 C57 47 62 42 65 36", "main", 8.4),
    path("bridge", "M49 52 C57 54 64 55 71 57", "connector", 6.5),
    path("a-main", "M17 83 C23 68 29 54 35 42 C38 35 36 28 32 22", "main", 8),
    path("b-main", "M58 66 C68 61 76 53 80 43 C82 37 80 30 78 25", "main", 8.2),
    path("ct-bridge", "M63 14 C63 23 64 30 65 36", "connector", 6.6),
  ],
  dust2: [
    path("a-site", "M27 15 L49 15 L54 29 L44 42 L28 38 L20 27 Z", "site", 1.2),
    path("b-site", "M70 21 L90 22 L92 38 L80 47 L66 39 Z", "site", 1.2),
    path("t-spawn", "M7 75 L24 74 L26 88 L9 90 Z", "spawn", 1.2),
    path("ct-spawn", "M56 10 L75 10 L78 20 L60 24 Z", "spawn", 1.2),
    path("long", "M16 80 C20 66 25 52 32 42 C36 35 38 29 39 22", "main", 8.8),
    path("pit-long", "M24 36 C28 34 33 31 39 22", "danger", 6.2),
    path("short", "M45 64 C51 56 57 48 64 42 C70 35 70 28 65 20", "main", 8.2),
    path("mid", "M16 80 C31 74 45 67 58 60 C65 56 69 49 70 42", "main", 9.2),
    path("doors", "M57 57 C61 50 64 44 65 37", "connector", 5.8),
    path("tunnels", "M17 80 C37 80 56 75 74 66 C82 61 85 50 80 39", "main", 8.4),
    path("ct-cross", "M66 17 C61 25 56 32 50 38", "connector", 6.8),
  ],
  cache: [
    path("a-site", "M25 19 L48 18 L52 34 L41 43 L24 37 Z", "site", 1.2),
    path("b-site", "M68 20 L90 20 L93 36 L81 46 L66 38 Z", "site", 1.2),
    path("t-spawn", "M7 76 L23 75 L25 89 L9 91 Z", "spawn", 1.2),
    path("ct-spawn", "M54 7 L76 8 L78 18 L58 21 Z", "spawn", 1.2),
    path("a-main", "M16 82 C24 70 31 58 38 49 C42 43 43 35 39 27", "main", 8.6),
    path("squeaky", "M38 49 C43 45 47 40 48 34", "connector", 5.6),
    path("mid", "M16 82 C30 72 43 62 56 55 C65 50 70 43 75 35", "main", 8.8),
    path("vents", "M56 55 C62 50 68 44 74 37", "connector", 6),
    path("b-main", "M17 82 C38 80 58 73 75 63 C83 57 86 46 78 35", "main", 8.4),
    path("truck-ct", "M64 14 C57 21 50 28 44 34", "connector", 6.8),
    path("heaven", "M64 14 C70 18 76 25 78 35", "connector", 6.8),
  ],
  overpass: [
    path("a-site", "M31 14 L55 14 L60 29 L50 40 L31 36 L24 25 Z", "site", 1.2),
    path("b-site", "M68 21 L91 21 L94 38 L82 49 L66 40 Z", "site", 1.2),
    path("t-spawn", "M7 77 L23 75 L25 89 L9 91 Z", "spawn", 1.2),
    path("ct-spawn", "M55 5 L76 6 L78 17 L58 20 Z", "spawn", 1.2),
    path("park-long", "M16 82 C23 69 31 58 40 49 C47 42 51 33 48 23", "main", 8.8),
    path("toilets", "M30 62 C39 57 46 51 52 43", "connector", 7.6),
    path("connector", "M50 56 C52 48 55 40 61 34", "connector", 6.6),
    path("water", "M17 82 C35 76 52 67 67 60 C75 55 80 49 82 40", "water", 10),
    path("monster", "M72 68 C79 62 83 52 82 40", "main", 8.4),
    path("bank", "M66 12 C61 18 56 25 52 32", "connector", 6.4),
  ],
  train: [
    path("outer-a", "M38 16 L67 16 L74 31 L65 46 L39 43 L31 29 Z", "site", 1.2),
    path("inner-b", "M70 20 L91 20 L94 36 L82 46 L67 38 Z", "site", 1.2),
    path("t-spawn", "M7 76 L23 75 L25 89 L9 91 Z", "spawn", 1.2),
    path("ct-spawn", "M54 6 L77 7 L79 18 L58 21 Z", "spawn", 1.2),
    path("ivy", "M16 82 C20 67 26 55 37 46 C45 39 50 31 51 22", "main", 8.2),
    path("a-main", "M16 82 C30 73 43 63 54 55 C60 50 63 43 62 35", "main", 8.8),
    path("ladder", "M52 55 C54 48 56 42 60 36", "connector", 5.6),
    path("outer-lines", "M36 31 L69 31 M36 38 L66 39 M38 24 L64 24", "danger", 2.4),
    path("popdog", "M62 35 C67 40 71 46 75 53", "connector", 6),
    path("inner", "M17 82 C39 80 59 73 76 62 C83 56 86 45 79 35", "main", 8),
    path("ct-outer", "M66 13 C62 20 59 27 58 35", "connector", 6.4),
  ],
};

const researchTacticsByMap: Record<string, Tactic[]> = {
  mirage: [
    {
      id: "mirage-t-window-crack", side: "T", title: "窗口拱门撬中默认", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "慢控",
      summary: "把窗口和拱门当成第一目标，中路拿住后让 CT 无法安心双包点站死。",
      call: "先撬中，窗口拱门清掉再决定，A/B 都别早暴露。",
      setup: ["3 人中路", "1 人 A 坡防前压", "1 人 B 二楼听信息"],
      utility: ["窗口烟", "拱门火", "短箱闪", "A 坡防前压火"],
      steps: ["窗口烟先落再上中路", "拱门火逼 CT 退二线", "拿到中路后不要停在原地", "根据短箱或拱门空间二次夹点"],
      fallback: "中路连续被反清时，保留 B 二楼和 A 坡两端，转成慢摸默认。",
      routes: [
        { label: "三人撬中", color: routeColors[2], points: ["t", "mid", "window"] },
        { label: "拱门压力", color: routeColors[0], points: ["mid", "connector"] },
        { label: "两端听牌", color: routeColors[3], points: ["t", "ramp"] },
      ],
    },
    {
      id: "mirage-t-b-fake-a-pin", side: "T", title: "B 二楼假爆定 A", goal: "默认", roundTypes: ["长枪局", "半起局"], difficulty: "进阶", tempo: "默认",
      summary: "B 二楼先用闪和脚步骗超市补防，中路压拱门后转 A 三线收尾。",
      call: "B 假一下，超市动了就 A，拱门要断住回防。",
      setup: ["1 人 B 二楼假压", "2 人中路", "2 人 A 坡/二楼"],
      utility: ["B 二楼假闪", "超市门烟", "警家烟", "跳台烟"],
      steps: ["B 二楼先制造爆 B 声音", "中路压到拱门但不露太深", "A 坡二楼等回防被牵动", "A 烟落后三线同时出"],
      fallback: "B 假压拿到击杀时直接转真 B，中路队友走短箱补枪。",
      routes: [
        { label: "B 假爆", color: routeColors[3], points: ["t", "apps", "b"] },
        { label: "拱门定人", color: routeColors[2], points: ["t", "mid", "connector"] },
        { label: "A 收尾", color: routeColors[0], points: ["t", "ramp", "a"] },
      ],
    },
    {
      id: "mirage-ct-apps-snap", side: "CT", title: "超市双闪清 B 二楼", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "提速",
      summary: "B 区用超市和包点闪反清二楼，破掉 T 的慢摸默认。",
      call: "B 二楼清一波，超市闪，打一眼就回来。",
      setup: ["2 人 B/超市", "1 人短箱", "2 人 A/中路"],
      utility: ["B 二楼反清闪", "二楼火", "退超市烟"],
      steps: ["开局不急出，先听 B 二楼脚步", "超市队友给高闪", "包点位贴近清二楼第一枪位", "没抓到人立刻回 B 点二线"],
      fallback: "B 二楼没人时短箱保中路信息，B 一人继续锚点。",
      routes: [
        { label: "超市给闪", color: routeColors[2], points: ["ct", "market", "b"] },
        { label: "B 二楼反清", color: routeColors[0], points: ["b", "apps"] },
      ],
    },
    {
      id: "mirage-ct-a-layered-retake", side: "CT", title: "A 区二线回防网", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "A 区不死守一线，警家、跳台方向和二楼下形成回防网。",
      call: "A 被压就退二线，别坡上硬换，等警家闪再清。",
      setup: ["1 人 A 坡信息", "1 人 A 点", "1 人中路快补", "2 人 B/短箱"],
      utility: ["A 坡火", "警家回防烟", "A 点反清闪", "二楼下火"],
      steps: ["A 坡第一波只拿信息", "烟火不足就退包点二线", "中路队友通过拱门补 A", "回防先清二楼下再清包点"],
      fallback: "A 已被下包时优先保警家和拱门两路，不从同一个门挤进去。",
      routes: [
        { label: "A 坡信息", color: routeColors[3], points: ["ct", "a", "ramp"] },
        { label: "拱门补防", color: routeColors[2], points: ["ct", "connector", "a"] },
        { label: "二楼清点", color: routeColors[1], points: ["a", "palace"] },
      ],
    },
  ],
  inferno: [
    {
      id: "inferno-t-bait-banana-to-apps", side: "T", title: "香蕉骗道具转二楼", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "慢控",
      summary: "香蕉道先逼 CT 火烟，等 B 道具变少后不急打，转二楼夹 A。",
      call: "香蕉骗道具，别吃雷，等他们补 B 后二楼夹 A。",
      setup: ["3 人香蕉道做压力", "2 人中路/二楼待命"],
      utility: ["香蕉深烟", "木桶火", "二楼闪", "书房烟"],
      steps: ["香蕉先慢控不贴太深", "逼出 CT 第二波火烟", "留一人香蕉断回防", "二楼和中路同步打 A"],
      fallback: "A 二楼被反清时，香蕉队友立刻转真 B 爆点。",
      routes: [
        { label: "香蕉骗道具", color: routeColors[3], points: ["t", "banana", "logs"] },
        { label: "二楼夹 A", color: routeColors[1], points: ["t", "alt", "second", "a"] },
        { label: "中路同步", color: routeColors[0], points: ["t", "mid", "arch", "a"] },
      ],
    },
    {
      id: "inferno-t-late-b-rehit", side: "T", title: "香蕉回打 B", goal: "控图", roundTypes: ["长枪局", "半起局"], difficulty: "进阶", tempo: "慢控",
      summary: "先默认拉开 CT 站位，最后 35 秒重新集合香蕉道打 B。",
      call: "先默认别死，最后回香蕉，棺材警家烟一起落。",
      setup: ["2 人香蕉慢控", "2 人中路牵制", "1 人二楼听 A"],
      utility: ["香蕉道二次烟", "棺材烟", "警家烟", "水池火"],
      steps: ["前半段只消耗 B 道具", "中路二楼保持 A 压力", "最后阶段重新集合香蕉", "烟火落后双闪进 B"],
      fallback: "香蕉被三人重防时，中路直接拱门书房夹 A。",
      routes: [
        { label: "默认拉扯", color: routeColors[2], points: ["t", "mid", "arch"] },
        { label: "回打香蕉", color: routeColors[0], points: ["t", "banana", "logs", "b"] },
      ],
    },
    {
      id: "inferno-ct-arch-info-push", side: "CT", title: "拱门前顶换信息", goal: "反清", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "A 区从拱门拿中路信息，迫使 T 不能无压力做二楼和香蕉默认。",
      call: "拱门看一眼中路，拿信息就回，不追匪口。",
      setup: ["1 人拱门", "1 人书房/短箱", "1 人二楼听牌", "2 人 B"],
      utility: ["中路闪", "拱门烟", "二楼火"],
      steps: ["开局拱门用闪看中路人数", "二楼队友听锅炉房", "信息足够后退书房", "B 区根据中路人数决定是否反清香蕉"],
      fallback: "拱门被烟封时不要钻烟，A 区退大坑和书房打交叉。",
      routes: [
        { label: "拱门信息", color: routeColors[2], points: ["ct", "arch", "mid"] },
        { label: "二楼听牌", color: routeColors[1], points: ["ct", "a", "second"] },
      ],
    },
    {
      id: "inferno-ct-retake-b-three-a", side: "CT", title: "三 A 保 B 回防", goal: "默认", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "默认",
      summary: "B 区只负责分层拖延，A 区三人保拱门/书房回防路线。",
      call: "B 活着拖，A 三人别乱动，等警家烟闪回。",
      setup: ["1 人 B 锚点", "1 人警家/B 补位", "3 人 A/拱门"],
      utility: ["香蕉火", "B 点烟", "警家回防闪", "书房烟"],
      steps: ["B 锚点第一波只交一层道具", "警家位随时准备补 B", "A 区不因假动作全走", "B 被爆后从警家和香蕉两路回防"],
      fallback: "B 锚点早死时，A 人不要一个个救，等道具齐再成组回防。",
      routes: [
        { label: "B 锚点拖延", color: routeColors[0], points: ["ct", "b", "banana"] },
        { label: "警家回防", color: routeColors[2], points: ["ct", "b"] },
        { label: "A 区保持", color: routeColors[3], points: ["ct", "a", "arch"] },
      ],
    },
  ],
  nuke: [
    {
      id: "nuke-t-vents-drop-b", side: "T", title: "管道偷 B 时机", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "中等", tempo: "提速",
      summary: "黄房铁门制造 A 爆假象，第一波混乱中开管道跳 B。",
      call: "A 声音拉满，管道开了就下 B，铁板断回防。",
      setup: ["3 人黄房/铁门", "1 人管道", "1 人铁板"],
      utility: ["A 点闪", "管道火", "铁板烟", "B 下包烟"],
      steps: ["黄房铁门同时制造上层压力", "管道队友趁 CT 枪线混乱下 B", "铁板队友断下层回防", "B 下包后不要全躲同一侧"],
      fallback: "管道被堵住时别继续送，上层队友立刻改成 A 点强打。",
      routes: [
        { label: "上层假爆", color: routeColors[3], points: ["t", "hut", "a"] },
        { label: "管道下 B", color: routeColors[0], points: ["t", "squeaky", "vents", "b"] },
        { label: "铁板断回防", color: routeColors[2], points: ["t", "ramp", "b"] },
      ],
    },
    {
      id: "nuke-t-secret-wrap-a", side: "T", title: "K1 下层绕 A", goal: "控图", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
      summary: "外场下 K1 后不一定打 B，可以从下层牵动 CT 后绕回 A。",
      call: "下 K1 不急 B，听他们下层补防，黄房二次打 A。",
      setup: ["3 人外场下 K1", "1 人黄房", "1 人铁板"],
      utility: ["外场烟墙", "K1 闪", "天堂烟", "铁门烟"],
      steps: ["外场烟墙安全通过", "K1 队友清下层外围", "黄房队友持续听上层空位", "CT 下层补防后绕回 A 夹上层"],
      fallback: "下层发现空 B 时直接下包，不必执着绕 A。",
      routes: [
        { label: "外场下 K1", color: routeColors[2], points: ["t", "yard", "secret", "b"] },
        { label: "黄房回打 A", color: routeColors[0], points: ["t", "hut", "a"] },
        { label: "铁板牵制", color: routeColors[3], points: ["t", "ramp"] },
      ],
    },
    {
      id: "nuke-ct-secret-early", side: "CT", title: "K1 早卡下层", goal: "反清", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "默认",
      summary: "读到外场烟墙时提前卡 K1，下层队友别让 T 免费落位。",
      call: "外场烟墙成型，K1 先卡，A 别全下去。",
      setup: ["1 人车库/外场", "1 人下层/K1", "2 人 A", "1 人铁板"],
      utility: ["外场反烟", "K1 火", "下层闪", "铁板烟"],
      steps: ["车库第一时间报外场烟数量", "下层队友提前架 K1 出口", "A 点保持双人别被黄房偷", "确定下层人数后再叫铁板补位"],
      fallback: "K1 被突破时不要下层单挑，退 B 点等铁板和 A 回防。",
      routes: [
        { label: "K1 卡点", color: routeColors[2], points: ["ct", "garage", "secret", "b"] },
        { label: "A 点保持", color: routeColors[0], points: ["ct", "a", "hut"] },
        { label: "铁板补防", color: routeColors[3], points: ["ct", "ramp", "b"] },
      ],
    },
    {
      id: "nuke-ct-hut-squeaky-lock", side: "CT", title: "黄房铁门双锁", goal: "默认", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "默认",
      summary: "低经济用上层近距离交叉，等 T 进 A 点后换枪。",
      call: "上层近点双锁，黄房铁门别都先露，等闪一起打。",
      setup: ["2 人 A 近点", "1 人警家/天堂", "1 人外场", "1 人铁板"],
      utility: ["黄房火", "铁门闪", "A 点烟"],
      steps: ["黄房位先隐藏不抢第一枪", "铁门位听开门和脚步", "队友给闪后一起拉", "拿到枪立刻退警家或管道"],
      fallback: "A 没人时一人回外场，一人继续听黄房。",
      routes: [
        { label: "黄房锁点", color: routeColors[0], points: ["ct", "a", "hut"] },
        { label: "铁门锁点", color: routeColors[1], points: ["ct", "a", "squeaky"] },
        { label: "铁板留守", color: routeColors[3], points: ["ct", "ramp"] },
      ],
    },
  ],
  ancient: [
    {
      id: "ancient-t-red-fake-b-pop", side: "T", title: "红房假控中秒 B 坡", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
      summary: "红房道具骗 CT 中路注意力，B 坡四人直接提速进点。",
      call: "红房假控中，B 坡四个快，洞口火先给。",
      setup: ["1 人红房做道具", "4 人 B 坡"],
      utility: ["红房烟", "洞口火", "B 坡双闪", "警家烟"],
      steps: ["红房队友先给中路压力", "B 坡队友贴近等洞口火", "闪后第一身位清柱子", "下包后坡和洞口交叉"],
      fallback: "B 坡被三人重防时，红房队友转甜甜圈，B 坡后撤等夹 A。",
      routes: [
        { label: "红房假控", color: routeColors[3], points: ["t", "red", "mid"] },
        { label: "B 坡快爆", color: routeColors[0], points: ["t", "ramp", "b"] },
        { label: "洞口压制", color: routeColors[2], points: ["ramp", "cave"] },
      ],
    },
    {
      id: "ancient-t-lane-fake-cave-b", side: "T", title: "长廊假 A 转洞口 B", goal: "默认", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
      summary: "长廊给 A 压力逼甜甜圈回防，随后红房队友转洞口夹 B。",
      call: "A 长廊假压，甜甜圈动了就洞口 B。",
      setup: ["2 人长廊做压力", "2 人红房中路", "1 人 B 坡慢摸"],
      utility: ["长廊闪", "A 点假烟", "洞口火", "B 警家烟"],
      steps: ["长廊先清近点不强进", "红房队友拿中路和洞口入口", "B 坡保持安静等夹击", "洞口和 B 坡同步进 B"],
      fallback: "A 长廊拿到首杀时直接改成 A 夹，不必转 B。",
      routes: [
        { label: "长廊假 A", color: routeColors[3], points: ["t", "lane", "a"] },
        { label: "洞口转 B", color: routeColors[2], points: ["t", "red", "mid", "cave", "b"] },
        { label: "B 坡同步", color: routeColors[0], points: ["t", "ramp", "b"] },
      ],
    },
    {
      id: "ancient-ct-cave-control", side: "CT", title: "洞口主动掌控", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "默认",
      summary: "洞口是 B 和中路之间的钥匙，CT 用闪火拿住它就能读到 T 的二次夹击。",
      call: "洞口要有信息，B 坡有声就闪看，拿到就退。",
      setup: ["1 人洞口", "1 人 B 包点", "1 人中路/甜甜圈", "2 人 A"],
      utility: ["洞口火", "B 坡闪", "中路烟", "退点烟"],
      steps: ["洞口先听 B 坡脚步", "B 队友补闪让洞口看一眼", "发现多人后退包点二线", "中路队友准备补洞口或甜甜圈"],
      fallback: "洞口被清掉时 B 不硬接，退包点等 A 回防。",
      routes: [
        { label: "洞口信息", color: routeColors[1], points: ["ct", "cave", "ramp"] },
        { label: "中路补位", color: routeColors[2], points: ["ct", "donut", "mid"] },
      ],
    },
    {
      id: "ancient-ct-lane-trap", side: "CT", title: "A 长廊陷阱", goal: "默认", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "默认",
      summary: "低经济放 T 进长廊近点，再用包点和甜甜圈交叉换枪。",
      call: "A 长廊放近，别早开枪，甜甜圈闪后一起拉。",
      setup: ["2 人 A 长廊/包点", "1 人甜甜圈", "2 人 B/中路"],
      utility: ["长廊近点烟", "甜甜圈闪", "包点火"],
      steps: ["A 长廊先隐藏枪线", "等 T 贴近后叫甜甜圈闪", "包点和长廊同时拉", "拿到枪后退包点不要追红房"],
      fallback: "长廊没人时一人回甜甜圈，一人继续 A 点听。",
      routes: [
        { label: "长廊陷阱", color: routeColors[0], points: ["ct", "a", "lane"] },
        { label: "甜甜圈补闪", color: routeColors[2], points: ["ct", "donut", "a"] },
      ],
    },
  ],
  anubis: [
    {
      id: "anubis-t-water-fake-b-to-a", side: "T", title: "水路假 B 转 A", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "慢控",
      summary: "水路和 B 主先吸引警家注意，再从桥和 A 主二次夹 A。",
      call: "水路假 B，B 主做声，桥到位后转 A。",
      setup: ["2 人水路", "1 人 B 主假压", "2 人 A 主"],
      utility: ["B 主假闪", "桥烟", "A 点火", "警家烟"],
      steps: ["水路先拿桥附近空间", "B 主用脚步或闪骗 B 补防", "A 主队友保持安静", "桥和 A 主同步夹 A"],
      fallback: "B 主假压抓到单人时直接真 B，水路断连接。",
      routes: [
        { label: "水路假 B", color: routeColors[3], points: ["t", "canal", "connector", "b"] },
        { label: "A 主收尾", color: routeColors[0], points: ["t", "a-main", "a"] },
        { label: "桥夹 A", color: routeColors[1], points: ["canal", "bridge", "a"] },
      ],
    },
    {
      id: "anubis-t-bridge-a-pop", side: "T", title: "桥位 A 爆弹", goal: "爆点", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
      summary: "快速抢桥后和 A 主同时进点，利用水路切断 CT 回防。",
      call: "桥快抢，A 主等闪，桥到就一起出。",
      setup: ["3 人 A 主", "2 人水路抢桥"],
      utility: ["桥烟", "A 主闪", "包点火", "警家烟"],
      steps: ["水路队友第一时间抢桥", "A 主队友贴近等桥位报到", "烟火落后两线同步", "下包后水路留人断后路"],
      fallback: "桥被 CT 抢住时，A 主别硬出，转 B 主快爆。",
      routes: [
        { label: "水路抢桥", color: routeColors[1], points: ["t", "canal", "bridge", "a"] },
        { label: "A 主爆点", color: routeColors[0], points: ["t", "a-main", "a"] },
      ],
    },
    {
      id: "anubis-ct-water-trap", side: "CT", title: "水路近点陷阱", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
      summary: "用两人水路近点打掉 T 默认开局，拿到枪后立刻退桥。",
      call: "水路近点蹲一波，闪后一起打，拿枪就退。",
      setup: ["2 人水路/桥", "1 人中路", "1 人 A", "1 人 B"],
      utility: ["水路瞬爆闪", "桥烟", "退点火"],
      steps: ["开局两人水路不同枪线", "中路队友负责防夹", "听到下水后闪出", "拿到优势立刻退桥或警家"],
      fallback: "水路没人时一人留桥，一人补 B 主防快爆。",
      routes: [
        { label: "水路陷阱", color: routeColors[0], points: ["ct", "bridge", "canal"] },
        { label: "中路防夹", color: routeColors[2], points: ["ct", "mid"] },
      ],
    },
    {
      id: "anubis-ct-b-main-crunch", side: "CT", title: "B 主反清后换防", goal: "反清", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "默认",
      summary: "B 主用闪拿信息，确认没人后快速把一人转去水路/中路。",
      call: "B 主看一眼，没人就转水路，B 留一个活着听。",
      setup: ["2 人 B 主/包点", "1 人水路", "2 人 A/中路"],
      utility: ["B 主火", "B 主闪", "水路烟"],
      steps: ["B 主先火拖第一波", "队友补闪看人数", "没人就一人回水路或中路", "B 锚点继续活着听声音"],
      fallback: "B 主反清遇到多人，立刻退包点等警家闪，不追出 B 主。",
      routes: [
        { label: "B 主反清", color: routeColors[0], points: ["ct", "b", "b-main"] },
        { label: "水路换防", color: routeColors[2], points: ["ct", "bridge", "canal"] },
      ],
    },
  ],
  dust2: [
    {
      id: "dust2-t-short-smoke-chain", side: "T", title: "A 小连烟推进", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "用中门烟和 A 小推进烟让队伍安全上小道，再和 A 大形成双线。",
      call: "中门先烟，A 小连烟上去，A 大别早死。",
      setup: ["3 人中路上 A 小", "2 人 A 大"],
      utility: ["中门烟", "A 小推进烟", "A 车火", "警家烟"],
      steps: ["中门烟先切 CT 视野", "A 小队友逐段清近点", "A 大队友拿坑位牵制", "A 小和 A 大同步压包点"],
      fallback: "A 小被烟火挡住时，A 大保坑位，中路转 B 门夹 B。",
      routes: [
        { label: "A 小推进", color: routeColors[2], points: ["t", "mid", "short", "a"] },
        { label: "A 大牵制", color: routeColors[0], points: ["t", "long", "pit", "a"] },
      ],
    },
    {
      id: "dust2-t-long-fake-mid-b", side: "T", title: "A 大假压中门转 B", goal: "默认", roundTypes: ["长枪局", "半起局"], difficulty: "中等", tempo: "慢控",
      summary: "A 大给 CT 烟和脚步压力，中门队友第二时间夹 B。",
      call: "A 大假压，CT 烟给他们看，中门转 B。",
      setup: ["2 人 A 大假压", "2 人中路", "1 人 B 洞"],
      utility: ["A 大 CT 烟", "A 大闪", "中门到 B 烟", "B 洞闪"],
      steps: ["A 大先拿坑或制造脚步", "CT 烟提醒防守方 A 有威胁", "中路队友摸到门口", "B 洞和中门同步夹 B"],
      fallback: "A 大拿到首杀并控坑时可以直接改成 A 大 A 小夹 A。",
      routes: [
        { label: "A 大假压", color: routeColors[3], points: ["t", "long", "pit"] },
        { label: "中门转 B", color: routeColors[2], points: ["t", "mid", "doors", "b"] },
        { label: "B 洞同步", color: routeColors[0], points: ["t", "b-tun", "b"] },
      ],
    },
    {
      id: "dust2-ct-long-reclaim", side: "CT", title: "A 大放坑再反清", goal: "反清", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "不强抢第一波 A 大，等 T 进坑后用包点和车位闪反清。",
      call: "A 大先放，等他们进坑，车位闪反清。",
      setup: ["2 人 A 点/车位", "1 人 A 小", "1 人中门", "1 人 B"],
      utility: ["A 大反清闪", "A 车火", "警家烟"],
      steps: ["开局不和 A 大门硬拼", "A 点队友听坑位脚步", "车位闪后两人同时拉", "拿回 A 大后留一人坑位"],
      fallback: "A 大人数太多时退包点二线，等 A 小和中门回防。",
      routes: [
        { label: "A 大反清", color: routeColors[0], points: ["ct", "a", "car", "long"] },
        { label: "A 小补位", color: routeColors[2], points: ["ct", "short", "a"] },
      ],
    },
    {
      id: "dust2-ct-mid-short-pinch", side: "CT", title: "中门夹 A 小", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "简单", tempo: "提速",
      summary: "中门和 A 小队友短时间夹击，打断 T 的小道默认。",
      call: "中门夹 A 小，闪后一波，没人就回。",
      setup: ["1 人中门", "1 人 A 小", "2 人 A", "1 人 B"],
      utility: ["A 小闪", "中门烟", "退点闪"],
      steps: ["中门先听中路上小道", "A 小队友补闪", "两边同时夹一波", "拿到信息后回 A 点结构"],
      fallback: "中路没人就中门回 B 门，A 小继续听。",
      routes: [
        { label: "中门夹击", color: routeColors[2], points: ["ct", "doors", "mid", "short"] },
        { label: "A 小联动", color: routeColors[0], points: ["ct", "short"] },
      ],
    },
  ],
  cache: [
    {
      id: "cache-t-mid-truck-a", side: "T", title: "中路压车位夹 A", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "中路不是只进通风管，也可以压车位，让 A 主和门房进点更轻松。",
      call: "控中压车位，A 主门房等车位到位再出。",
      setup: ["2 人中路", "2 人 A 主/门房", "1 人 B 仓断信息"],
      utility: ["中路烟", "车位烟", "门房闪", "A 主火"],
      steps: ["中路先清白箱和沙袋", "一人压车位切 A 回防", "A 主门房等闪同步", "包点优先清车位和叉车方向"],
      fallback: "车位压不进去时，中路队友转通风管，B 仓夹 B。",
      routes: [
        { label: "中路压车位", color: routeColors[2], points: ["t", "mid", "truck", "a"] },
        { label: "A 主同步", color: routeColors[0], points: ["t", "a-main", "a"] },
        { label: "门房同步", color: routeColors[1], points: ["t", "squeaky", "a"] },
      ],
    },
    {
      id: "cache-t-b-fake-vents-a", side: "T", title: "B 仓假打通风管转 A", goal: "默认", roundTypes: ["长枪局", "半起局"], difficulty: "进阶", tempo: "慢控",
      summary: "B 仓制造压力逼二楼回防，中路通风管队友转 A 车位。",
      call: "B 仓假，通风管别急跳，听二楼动了转 A。",
      setup: ["2 人 B 仓假压", "2 人中路", "1 人 A 主"],
      utility: ["B 仓假闪", "二楼烟", "中路烟", "A 主闪"],
      steps: ["B 仓用闪和脚步骗防守", "中路拿通风管入口", "A 主队友保持静音", "CT B 二楼动后转车位夹 A"],
      fallback: "B 仓假压换到首杀时，通风管直接跳 B 真打。",
      routes: [
        { label: "B 仓假打", color: routeColors[3], points: ["t", "b-main", "b"] },
        { label: "通风管转 A", color: routeColors[2], points: ["t", "mid", "vents", "truck", "a"] },
        { label: "A 主收尾", color: routeColors[0], points: ["t", "a-main", "a"] },
      ],
    },
    {
      id: "cache-ct-truck-crossfire", side: "CT", title: "A 车位二线交叉", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "A 点用车位和门房信息打二线，不让 T 同时从 A 主和门房撕开。",
      call: "A 车位二线，门房有声先报，等闪反打。",
      setup: ["2 人 A/车位", "2 人中路", "1 人 B"],
      utility: ["A 主火", "门房烟", "车位反清闪", "中路烟"],
      steps: ["A 主先用火拖第一波", "车位队友听门房开门", "中路丢失时 A 退二线", "反清时车位和包点一起拉"],
      fallback: "A 被下包后从车位和警家方向两路回防，不全部走 A 主。",
      routes: [
        { label: "车位交叉", color: routeColors[1], points: ["ct", "truck", "a"] },
        { label: "A 主拖延", color: routeColors[0], points: ["ct", "a", "a-main"] },
        { label: "中路回补", color: routeColors[2], points: ["ct", "mid", "truck"] },
      ],
    },
    {
      id: "cache-ct-heaven-retake-b", side: "CT", title: "B 二楼保回防", goal: "默认", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "默认",
      summary: "B 点不急前顶，保二楼和包点两层，让回防有落脚点。",
      call: "B 二楼别送，包点拖住，等中路回防。",
      setup: ["1 人 B 包点", "1 人 B 二楼", "2 人 A", "1 人中路"],
      utility: ["B 仓火", "二楼烟", "包点闪"],
      steps: ["B 仓第一波用火拖", "二楼队友不单拉仓口", "包点压力大时等二楼闪", "中路队友从通风管或警家回防"],
      fallback: "B 被快速占领时保二楼枪线，等 A 人到位再反清。",
      routes: [
        { label: "B 二楼锚点", color: routeColors[2], points: ["ct", "heaven", "b"] },
        { label: "B 仓拖延", color: routeColors[0], points: ["ct", "b", "b-main"] },
        { label: "中路回防", color: routeColors[1], points: ["ct", "mid", "vents", "b"] },
      ],
    },
  ],
  overpass: [
    {
      id: "overpass-t-toilets-fake-water-b", side: "T", title: "厕所假 A 下水转 B", goal: "默认", roundTypes: ["长枪局"], difficulty: "进阶", tempo: "慢控",
      summary: "厕所给 A 压力让 CT 回银行，下水道队友走短水夹 B。",
      call: "厕所假 A，连接转短水，怪兽等短水到位。",
      setup: ["2 人厕所假压", "2 人连接/短水", "1 人怪兽"],
      utility: ["银行假烟", "厕所火", "短水闪", "怪兽烟"],
      steps: ["厕所先慢清喷泉和近点", "连接队友拿下水道主动权", "怪兽保持不早露", "短水到位后怪兽同步进 B"],
      fallback: "A 厕所拿到首杀时直接银行烟打 A，不必转 B。",
      routes: [
        { label: "厕所假 A", color: routeColors[3], points: ["t", "fountain", "toilets", "a"] },
        { label: "短水转 B", color: routeColors[1], points: ["t", "connector", "water", "b"] },
        { label: "怪兽同步", color: routeColors[0], points: ["t", "monster", "b"] },
      ],
    },
    {
      id: "overpass-t-long-bank-squeeze", side: "T", title: "A 长银行压缩", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "慢控",
      summary: "A 长和厕所一起推进，逼 CT 退银行，给后期下包和防回防位置。",
      call: "A 长厕所一起慢清，银行烟后别急追，先下包。",
      setup: ["2 人 A 长", "2 人厕所", "1 人连接断绕"],
      utility: ["A 长闪", "银行烟", "垃圾桶火", "厕所烟"],
      steps: ["A 长先清近点和侧翼", "厕所队友同步推进", "银行烟落后压缩包点", "连接队友断 B 回防或下水绕后"],
      fallback: "A 长被狙架住时，厕所留压力，连接下水转 B。",
      routes: [
        { label: "A 长推进", color: routeColors[0], points: ["t", "long", "a"] },
        { label: "厕所同步", color: routeColors[1], points: ["t", "fountain", "toilets", "a"] },
        { label: "连接断绕", color: routeColors[2], points: ["t", "connector"] },
      ],
    },
    {
      id: "overpass-ct-water-monster-link", side: "CT", title: "短水怪兽联防", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "B 区不是只看怪兽，短水信息能提前判断是否被夹。",
      call: "B 两边都听，短水不能白给，怪兽烟分层交。",
      setup: ["1 人短水", "1 人怪兽/B 点", "1 人连接", "2 人 A"],
      utility: ["短水火", "怪兽烟", "水下闪", "连接烟"],
      steps: ["短水先看下水道动静", "怪兽位保第一颗烟别太早丢", "连接队友听转点", "B 被夹时等水下闪反清"],
      fallback: "短水失守就退包点和天堂方向，别在水里接三面枪。",
      routes: [
        { label: "短水信息", color: routeColors[1], points: ["ct", "b", "water"] },
        { label: "怪兽防线", color: routeColors[0], points: ["ct", "b", "monster"] },
        { label: "连接补位", color: routeColors[2], points: ["ct", "connector", "water"] },
      ],
    },
    {
      id: "overpass-ct-bank-toilets-pinch", side: "CT", title: "银行厕所夹击", goal: "反清", roundTypes: ["半起局", "ECO"], difficulty: "中等", tempo: "提速",
      summary: "A 区用银行和厕所两人夹喷泉，赌 T 慢控厕所。",
      call: "A 厕所夹一下，银行补闪，拿信息就退。",
      setup: ["2 人厕所/银行", "1 人连接", "2 人 B"],
      utility: ["厕所闪", "喷泉火", "退银行烟"],
      steps: ["厕所位先贴近听脚步", "银行队友给闪后同步拉", "看见多人只打一波", "拿到优势后退银行和包点"],
      fallback: "厕所没人时一人回银行，一人留长管信息。",
      routes: [
        { label: "厕所前压", color: routeColors[0], points: ["ct", "bank", "toilets", "fountain"] },
        { label: "连接留守", color: routeColors[2], points: ["ct", "connector"] },
      ],
    },
  ],
  train: [
    {
      id: "train-t-ivy-slow-a", side: "T", title: "绿通慢夹外场", goal: "控图", roundTypes: ["长枪局"], difficulty: "中等", tempo: "慢控",
      summary: "绿通慢拿侧翼，匪口和五道等绿通到位后再夹外场。",
      call: "绿通慢，五道别先死，绿通到位外场一起出。",
      setup: ["1 人绿通", "2 人匪口", "1 人五道", "1 人内场断回防"],
      utility: ["绿通烟", "外场烟墙", "包车闪", "警家烟"],
      steps: ["绿通先清近点和后点", "匪口不抢第一波干拉", "五道队友等闪", "三线同步压外场下包"],
      fallback: "绿通被重防时，匪口保烟墙，内场队友转 B 爆弹。",
      routes: [
        { label: "绿通慢夹", color: routeColors[1], points: ["t", "ivy", "a"] },
        { label: "匪口同步", color: routeColors[0], points: ["t", "main", "outer", "a"] },
        { label: "五道补枪", color: routeColors[2], points: ["t", "ladder", "outer"] },
      ],
    },
    {
      id: "train-t-inner-fake-outer-a", side: "T", title: "内场假爆转外场", goal: "默认", roundTypes: ["长枪局", "半起局"], difficulty: "进阶", tempo: "默认",
      summary: "内场用闪火骗连接和二楼回防，外场队友烟墙后二次打 A。",
      call: "内场假，等连接转 B，外场烟墙再打 A。",
      setup: ["2 人内场假压", "2 人外场", "1 人绿通"],
      utility: ["内场火", "二楼烟", "外场烟墙", "绿通闪"],
      steps: ["内场先制造爆 B 声音", "外场队友不要早出匪口", "听到连接或二楼回防后烟墙出 A", "绿通负责断侧翼和后路"],
      fallback: "内场假压直接抓到 B 锚点时，外场留人断回防，改真 B。",
      routes: [
        { label: "内场假爆", color: routeColors[3], points: ["t", "inner", "b"] },
        { label: "外场收尾", color: routeColors[0], points: ["t", "main", "outer", "a"] },
        { label: "绿通断后", color: routeColors[1], points: ["t", "ivy", "a"] },
      ],
    },
    {
      id: "train-ct-connector-rotator", side: "CT", title: "连接主旋转", goal: "默认", roundTypes: ["长枪局"], difficulty: "中等", tempo: "默认",
      summary: "连接位承担 A/B 快速换防，外场和内场都不能只靠锚点硬守。",
      call: "连接当旋转位，外场报烟墙，内场有声马上补。",
      setup: ["3 人外场", "1 人连接/警家", "1 人内场"],
      utility: ["匪口火", "连接烟", "内场火", "外场闪"],
      steps: ["外场先分 A Main、五道、绿通信息", "连接位不要早死", "内场有爆弹连接马上补 B", "外场烟墙成型就退二线"],
      fallback: "连接被断时，外场留两人保 A，内场锚点只拖时间。",
      routes: [
        { label: "连接旋转", color: routeColors[2], points: ["ct", "outer", "b"] },
        { label: "外场三线", color: routeColors[1], points: ["ct", "outer", "main"] },
        { label: "内场锚点", color: routeColors[0], points: ["ct", "b", "inner"] },
      ],
    },
    {
      id: "train-ct-outer-four-point", side: "CT", title: "外场四点默认", goal: "默认", roundTypes: ["ECO", "半起局"], difficulty: "简单", tempo: "默认",
      summary: "低经济外场分散站不同枪线，靠交叉和道具延缓外场烟墙。",
      call: "外场四点别站一排，五道绿通都报，内场一人活着听。",
      setup: ["4 人外场/绿通/五道", "1 人内场"],
      utility: ["匪口火", "绿通闪", "五道火", "内场烟"],
      steps: ["匪口先火拖第一波", "绿通位不单独追深", "五道听到脚步先报再打", "内场锚点只负责拖不反清"],
      fallback: "外场没人时连接位转内场补 B，其余保持 A 侧信息。",
      routes: [
        { label: "外场默认", color: routeColors[1], points: ["ct", "outer", "main"] },
        { label: "绿通信息", color: routeColors[2], points: ["ct", "ivy"] },
        { label: "五道信息", color: routeColors[0], points: ["ct", "pop", "ladder"] },
      ],
    },
  ],
};

const maps: MapPlan[] = baseMaps.map((map) => ({
  ...map,
  areas: mapAreasByMap[map.id],
  paths: mapBlueprintsByMap[map.id],
  intel: mapIntelByMap[map.id],
  tactics: [
    ...map.tactics,
    ...(extraTacticsByMap[map.id] ?? []),
    ...(researchTacticsByMap[map.id] ?? []),
  ],
}));

const routeGraphsByMap: Record<string, RouteGraph> = {
  mirage: {
    nodes: {
      "m-tmid": [43, 68],
      "m-topmid": [48, 56],
      "m-ramp-low": [26, 63],
      "m-ramp-high": [21, 42],
      "m-palace-hall": [30, 23],
      "m-a-ct": [44, 24],
      "m-t-b-low": [53, 82],
      "m-t-b-high": [63, 78],
      "m-b-apps": [72, 74],
      "m-b-market": [69, 68],
      "m-market-door": [70, 57],
      "m-ct-market-mid": [70, 42],
      "m-ct-market-high": [69, 28],
      "m-ct-jungle": [61, 20],
      "m-jungle-connector-high": [56, 31],
      "m-jungle-connector-low": [51, 41],
      "m-short-jump": [58, 51],
      "m-short-b-mid": [60, 60],
      "m-short-b-entry": [58, 70],
    },
    edges: [
      ["t", "m-tmid"], ["m-tmid", "m-topmid"], ["m-topmid", "mid"], ["mid", "window"], ["mid", "connector"],
      ["connector", "a"], ["connector", "m-jungle-connector-low"], ["m-jungle-connector-low", "m-jungle-connector-high"], ["m-jungle-connector-high", "m-ct-jungle"], ["m-ct-jungle", "ct"], ["m-ct-jungle", "window"],
      ["t", "m-ramp-low"], ["m-ramp-low", "ramp"], ["ramp", "m-ramp-high"], ["m-ramp-high", "a"],
      ["m-ramp-high", "m-palace-hall"], ["m-palace-hall", "palace"], ["palace", "a"],
      ["mid", "m-short-jump"], ["m-short-jump", "short"], ["short", "m-short-b-mid"], ["m-short-b-mid", "m-short-b-entry"], ["m-short-b-entry", "b"], ["short", "market"],
      ["t", "m-t-b-low"], ["m-t-b-low", "m-t-b-high"], ["m-t-b-high", "m-b-apps"], ["m-b-apps", "apps"], ["apps", "b"], ["apps", "m-b-market"],
      ["m-b-market", "market"], ["market", "b"], ["market", "m-market-door"], ["m-market-door", "m-ct-market-mid"], ["m-ct-market-mid", "m-ct-market-high"], ["m-ct-market-high", "ct"],
    ],
  },
  inferno: {
    nodes: {
      "i-tmid-low": [35, 77],
      "i-mid-low": [45, 68],
      "i-mid-upper": [52, 50],
      "i-arch-turn": [58, 38],
      "i-alt-low": [31, 69],
      "i-apps": [34, 54],
      "i-t-banana-low": [36, 80],
      "i-banana-low": [50, 78],
      "i-banana-mid": [70, 68],
      "i-ct-cross": [63, 23],
      "i-ct-b-turn": [69, 39],
      "i-b-ct-low": [74, 51],
      "i-b-ct": [77, 58],
    },
    edges: [
      ["t", "i-tmid-low"], ["i-tmid-low", "i-mid-low"], ["i-mid-low", "mid"], ["mid", "i-mid-upper"],
      ["i-mid-upper", "arch"], ["arch", "i-arch-turn"], ["i-arch-turn", "library"], ["library", "a"],
      ["a", "pit"], ["a", "second"], ["second", "i-apps"], ["i-apps", "alt"], ["alt", "i-alt-low"], ["i-alt-low", "t"],
      ["t", "i-t-banana-low"], ["i-t-banana-low", "i-banana-low"], ["i-banana-low", "i-banana-mid"], ["i-banana-mid", "banana"], ["banana", "logs"], ["logs", "b"],
      ["ct", "i-ct-cross"], ["i-ct-cross", "library"], ["i-ct-cross", "i-ct-b-turn"], ["i-ct-b-turn", "i-b-ct-low"], ["i-b-ct-low", "i-b-ct"], ["i-b-ct", "logs"], ["i-b-ct", "b"],
    ],
  },
  nuke: {
    nodes: {
      "n-lobby": [32, 54],
      "n-lobby-ramp-mid": [47, 55],
      "n-lobby-ramp": [62, 56],
      "n-yard-left": [42, 60],
      "n-yard-red": [49, 58],
      "n-yard-secret": [60, 69],
      "n-a-door": [65, 47],
      "n-a-main": [60, 45],
      "n-ramp-entry": [73, 57],
      "n-ct-ramp": [83, 55],
      "n-ct-yard": [74, 55],
    },
    edges: [
      ["t", "n-lobby"], ["n-lobby", "n-yard-left"], ["n-yard-left", "yard"], ["yard", "n-yard-red"],
      ["n-yard-red", "silo"], ["n-yard-red", "garage"], ["garage", "n-a-main"], ["n-a-main", "hut"], ["hut", "a"],
      ["hut", "squeaky"], ["squeaky", "n-a-door"], ["n-a-door", "a"], ["a", "vents"],
      ["yard", "n-yard-secret"], ["n-yard-secret", "secret"], ["secret", "b"],
      ["n-lobby", "n-lobby-ramp-mid"], ["n-lobby-ramp-mid", "n-lobby-ramp"], ["n-lobby-ramp", "ramp"], ["ramp", "n-ramp-entry"], ["n-ramp-entry", "b"], ["n-ramp-entry", "vents"],
      ["ct", "n-ct-ramp"], ["n-ct-ramp", "ramp"], ["ct", "n-ct-yard"], ["n-ct-yard", "garage"], ["ct", "squeaky"],
    ],
  },
  ancient: {
    nodes: {
      "a-t-mid": [48, 77],
      "a-red-low": [39, 72],
      "a-mid-cross": [48, 59],
      "a-t-lane": [41, 80],
      "a-lane-low": [31, 68],
      "a-lane-high": [25, 48],
      "a-b-low": [68, 74],
      "a-b-ramp": [78, 64],
      "a-cave-mid": [63, 58],
      "a-ct-a": [44, 20],
      "a-ct-donut": [47, 33],
      "a-ct-b": [63, 29],
    },
    edges: [
      ["t", "a-t-mid"], ["a-t-mid", "a-red-low"], ["a-red-low", "red"], ["red", "mid"], ["mid", "a-mid-cross"],
      ["a-mid-cross", "donut"], ["donut", "a"], ["donut", "a-ct-donut"], ["a-ct-donut", "ct"],
      ["t", "a-t-lane"], ["a-t-lane", "a-lane-low"], ["a-lane-low", "lane"], ["lane", "a-lane-high"], ["a-lane-high", "a"],
      ["t", "a-b-low"], ["a-b-low", "ramp"], ["ramp", "a-b-ramp"], ["a-b-ramp", "b"],
      ["ramp", "cave"], ["cave", "a-cave-mid"], ["a-cave-mid", "mid"], ["cave", "b"],
      ["ct", "a-ct-a"], ["a-ct-a", "a"], ["ct", "a-ct-b"], ["a-ct-b", "b"], ["a-ct-b", "cave"],
    ],
  },
  anubis: {
    nodes: {
      "an-t-canal": [28, 76],
      "an-canal-low": [39, 66],
      "an-t-a-low": [19, 75],
      "an-t-a-high": [23, 65],
      "an-a-main-low": [26, 58],
      "an-a-main-high": [25, 32],
      "an-mid-low": [49, 62],
      "an-mid-high": [52, 43],
      "an-bridge-a": [62, 26],
      "an-a-bridge-cross": [50, 23],
      "an-a-temple": [37, 19],
      "an-b-main-low": [70, 61],
      "an-b-main-high": [77, 40],
      "an-ct-mid": [53, 24],
      "an-b-ct": [68, 23],
    },
    edges: [
      ["t", "an-t-canal"], ["an-t-canal", "an-canal-low"], ["an-canal-low", "canal"],
      ["canal", "an-mid-low"], ["an-mid-low", "mid"], ["mid", "an-mid-high"], ["an-mid-high", "bridge"], ["bridge", "an-bridge-a"],
      ["an-bridge-a", "an-a-bridge-cross"], ["an-a-bridge-cross", "an-a-temple"], ["an-a-temple", "a"], ["bridge", "a-main"], ["a-main", "an-a-main-high"], ["an-a-main-high", "a"],
      ["t", "an-t-a-low"], ["an-t-a-low", "an-t-a-high"], ["an-t-a-high", "an-a-main-low"], ["an-a-main-low", "a-main"], ["t", "an-b-main-low"], ["an-b-main-low", "b-main"],
      ["b-main", "an-b-main-high"], ["an-b-main-high", "b"], ["canal", "connector"], ["connector", "b-main"], ["connector", "mid"],
      ["ct", "an-ct-mid"], ["an-ct-mid", "bridge"], ["an-ct-mid", "mid"], ["ct", "an-b-ct"], ["an-b-ct", "b"],
    ],
  },
  dust2: {
    nodes: {
      "d-long-low": [18, 68],
      "d-long-mid": [18, 52],
      "d-long-a": [17, 23],
      "d-t-mid-low": [38, 79],
      "d-mid-low": [46, 66],
      "d-short-low": [41, 49],
      "d-short-high": [30, 33],
      "d-t-b-low": [36, 88],
      "d-t-b-mid": [50, 86],
      "d-b-tun-low": [60, 82],
      "d-b-tun-high": [78, 72],
      "d-b-upper": [84, 55],
      "d-b-doorside": [84, 38],
      "d-b-entry": [83, 24],
      "d-b-door": [75, 36],
      "d-ct-a-ramp": [50, 24],
      "d-a-ramp": [31, 20],
    },
    edges: [
      ["t", "d-long-low"], ["d-long-low", "d-long-mid"], ["d-long-mid", "long"], ["long", "pit"], ["pit", "d-long-a"], ["d-long-a", "a"], ["a", "car"],
      ["t", "d-t-mid-low"], ["d-t-mid-low", "d-mid-low"], ["d-mid-low", "mid"], ["mid", "d-short-low"], ["d-short-low", "short"], ["short", "d-short-high"], ["d-short-high", "a"],
      ["mid", "doors"], ["doors", "d-b-door"], ["d-b-door", "b"],
      ["t", "d-t-b-low"], ["d-t-b-low", "d-t-b-mid"], ["d-t-b-mid", "d-b-tun-low"], ["d-b-tun-low", "d-b-tun-high"], ["d-b-tun-high", "b-tun"], ["b-tun", "d-b-upper"], ["d-b-upper", "d-b-doorside"], ["d-b-doorside", "d-b-entry"], ["d-b-entry", "b"],
      ["ct", "doors"], ["ct", "d-b-door"], ["ct", "d-ct-a-ramp"], ["d-ct-a-ramp", "d-a-ramp"], ["d-a-ramp", "a"],
    ],
  },
  cache: {
    nodes: {
      "c-t-a": [30, 74],
      "c-a-main-high": [24, 51],
      "c-squeaky-a": [35, 38],
      "c-t-mid": [42, 76],
      "c-mid-cross": [49, 51],
      "c-vents-b": [62, 48],
      "c-t-b": [58, 81],
      "c-b-main-low": [72, 69],
      "c-b-entry": [82, 62],
      "c-ct-mid": [43, 28],
      "c-mid-ct-low": [46, 42],
      "c-ct-heaven": [58, 34],
    },
    edges: [
      ["t", "c-t-a"], ["c-t-a", "a-main"], ["a-main", "c-a-main-high"], ["c-a-main-high", "a"], ["a-main", "squeaky"], ["squeaky", "c-squeaky-a"], ["c-squeaky-a", "a"],
      ["t", "c-t-mid"], ["c-t-mid", "mid"], ["mid", "c-mid-cross"], ["c-mid-cross", "vents"], ["vents", "c-vents-b"], ["c-vents-b", "b"], ["vents", "truck"], ["truck", "a"],
      ["t", "c-t-b"], ["c-t-b", "c-b-main-low"], ["c-b-main-low", "b-main"], ["b-main", "c-b-entry"], ["c-b-entry", "b"], ["b", "heaven"],
      ["ct", "c-ct-mid"], ["c-ct-mid", "truck"], ["c-ct-mid", "c-mid-ct-low"], ["c-mid-ct-low", "mid"], ["ct", "c-ct-heaven"], ["c-ct-heaven", "heaven"],
    ],
  },
  overpass: {
    nodes: {
      "o-t-park": [39, 80],
      "o-park": [39, 70],
      "o-toilets-low": [42, 62],
      "o-toilets-high": [46, 46],
      "o-long-low": [34, 66],
      "o-long-high": [31, 51],
      "o-long-a-mid": [38, 42],
      "o-long-a-entry": [46, 32],
      "o-conn-low": [49, 68],
      "o-water-low": [58, 72],
      "o-water-short-mid": [64, 60],
      "o-monster-low": [71, 80],
      "o-monster-mouth": [78, 68],
      "o-b-ramp": [76, 53],
      "o-b-entry": [74, 41],
      "o-b-short": [68, 47],
      "o-ct-bank": [51, 12],
      "o-ct-conn-high": [51, 24],
      "o-ct-conn-low": [51, 39],
      "o-ct-b": [62, 21],
      "o-b-ct-entry": [68, 31],
    },
    edges: [
      ["t", "o-t-park"], ["o-t-park", "o-park"], ["o-park", "fountain"], ["fountain", "o-toilets-low"], ["o-toilets-low", "toilets"], ["toilets", "o-toilets-high"], ["o-toilets-high", "a"],
      ["t", "o-long-low"], ["o-long-low", "long"], ["long", "o-long-high"], ["o-long-high", "o-long-a-mid"], ["o-long-a-mid", "o-long-a-entry"], ["o-long-a-entry", "a"],
      ["t", "o-conn-low"], ["o-conn-low", "connector"], ["connector", "water"], ["water", "o-water-low"], ["o-water-low", "monster"], ["monster", "o-monster-low"], ["monster", "o-monster-mouth"], ["o-monster-mouth", "o-b-ramp"], ["o-b-ramp", "o-b-entry"], ["o-b-entry", "b"],
      ["water", "o-water-short-mid"], ["o-water-short-mid", "o-b-short"], ["o-b-short", "b"],
      ["ct", "o-ct-bank"], ["o-ct-bank", "bank"], ["bank", "a"], ["ct", "o-ct-conn-high"], ["o-ct-conn-high", "o-ct-conn-low"], ["o-ct-conn-low", "connector"], ["ct", "o-ct-b"], ["o-ct-b", "o-b-ct-entry"], ["o-b-ct-entry", "b"], ["o-b-ct-entry", "o-b-short"],
    ],
  },
  train: {
    nodes: {
      "tr-t-main": [38, 78],
      "tr-main-entry": [40, 66],
      "tr-yard-left": [43, 51],
      "tr-yard-mid": [56, 52],
      "tr-yard-a": [62, 53],
      "tr-t-ivy-low": [30, 70],
      "tr-ivy-mid": [25, 44],
      "tr-ivy-high": [25, 25],
      "tr-ivy-corner": [33, 29],
      "tr-ivy-yard": [42, 42],
      "tr-ct-top": [55, 18],
      "tr-ivy-top-link": [39, 22],
      "tr-pop-low": [70, 56],
      "tr-ladder-pop-mid": [52, 48],
      "tr-pop-entry": [62, 52],
      "tr-heaven-drop": [78, 38],
      "tr-inner-upper": [82, 52],
      "tr-inner-entry": [82, 59],
      "tr-inner-b-mid": [76, 66],
      "tr-inner-b-low": [66, 74],
      "tr-b-entry": [63, 76],
      "tr-ct-outer": [65, 24],
      "tr-ct-outer-mid": [63, 37],
      "tr-ct-outer-low": [59, 46],
    },
    edges: [
      ["t", "tr-t-main"], ["tr-t-main", "main"], ["main", "tr-main-entry"], ["tr-main-entry", "ladder"], ["tr-main-entry", "outer"],
      ["ladder", "tr-yard-left"], ["tr-yard-left", "outer"], ["outer", "tr-yard-mid"], ["tr-yard-mid", "a"], ["a", "tr-yard-a"], ["tr-yard-a", "outer"],
      ["t", "tr-t-ivy-low"], ["tr-t-ivy-low", "tr-ivy-mid"], ["tr-ivy-mid", "ivy"], ["ivy", "tr-ivy-high"], ["tr-ivy-high", "tr-ivy-corner"], ["tr-ivy-corner", "tr-ivy-yard"], ["tr-ivy-yard", "tr-yard-left"], ["tr-ivy-yard", "outer"],
      ["ladder", "tr-ladder-pop-mid"], ["tr-ladder-pop-mid", "tr-pop-entry"], ["tr-pop-entry", "tr-pop-low"], ["tr-pop-low", "pop"], ["pop", "tr-inner-upper"], ["tr-inner-upper", "inner"], ["inner", "tr-inner-entry"], ["tr-inner-entry", "tr-inner-b-mid"], ["tr-inner-b-mid", "tr-inner-b-low"], ["tr-inner-b-low", "b"],
      ["outer", "tr-b-entry"], ["tr-b-entry", "b"], ["ct", "tr-ct-outer"], ["tr-ct-outer", "tr-ct-outer-mid"], ["tr-ct-outer-mid", "tr-ct-outer-low"], ["tr-ct-outer-low", "outer"], ["ct", "tr-ct-top"], ["tr-ct-top", "tr-ivy-top-link"], ["tr-ivy-top-link", "tr-ivy-high"], ["ct", "heaven"], ["heaven", "tr-heaven-drop"], ["tr-heaven-drop", "tr-inner-upper"],
    ],
  },
};

function segmentStyle(from: RouteWaypoint, to: RouteWaypoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`,
  };
}

function distanceBetween(from: RouteWaypoint, to: RouteWaypoint) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function guidedLeg(map: MapPlan, fromId: string, toId: string) {
  const graph = routeGraphsByMap[map.id];
  const pointNodes = Object.fromEntries(map.points.map((item) => [item.id, [item.x, item.y] as [number, number]]));
  const rawNodes = { ...pointNodes, ...(graph?.nodes ?? {}) };
  const nodes = new Map<string, RouteWaypoint>(
    Object.entries(rawNodes).map(([id, [x, y]]) => [id, { id, x, y }]),
  );
  const from = nodes.get(fromId);
  const to = nodes.get(toId);
  if (!from || !to) return [];

  if (!graph) return [from, to];

  const adjacency = new Map<string, { id: string; cost: number }[]>();
  const addEdge = (a: string, b: string) => {
    const start = nodes.get(a);
    const end = nodes.get(b);
    if (!start || !end) return;
    const cost = distanceBetween(start, end);
    adjacency.set(a, [...(adjacency.get(a) ?? []), { id: b, cost }]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), { id: a, cost }]);
  };
  graph.edges.forEach(([a, b]) => addEdge(a, b));

  if (!adjacency.has(fromId) || !adjacency.has(toId)) return [from, to];

  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const unvisited = new Set(nodes.keys());
  nodes.forEach((_, id) => distances.set(id, Number.POSITIVE_INFINITY));
  distances.set(fromId, 0);

  while (unvisited.size) {
    let current = "";
    let best = Number.POSITIVE_INFINITY;
    unvisited.forEach((id) => {
      const value = distances.get(id) ?? Number.POSITIVE_INFINITY;
      if (value < best) {
        best = value;
        current = id;
      }
    });
    if (!current || current === toId) break;
    unvisited.delete(current);
    for (const edge of adjacency.get(current) ?? []) {
      if (!unvisited.has(edge.id)) continue;
      const candidate = (distances.get(current) ?? 0) + edge.cost;
      if (candidate < (distances.get(edge.id) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.id, candidate);
        previous.set(edge.id, current);
      }
    }
  }

  if (!previous.has(toId) && fromId !== toId) return [from, to];

  const ids = [toId];
  while (ids[0] !== fromId) {
    const prior = previous.get(ids[0]);
    if (!prior) return [from, to];
    ids.unshift(prior);
  }
  return ids.map((id) => nodes.get(id)).filter((item): item is RouteWaypoint => Boolean(item));
}

function routeSegments(map: MapPlan, route: Route) {
  const pathPoints = route.points
    .flatMap((id, index, array) => {
      if (index >= array.length - 1) return [];
      const leg = guidedLeg(map, id, array[index + 1]);
      return index === 0 ? leg : leg.slice(1);
    })
    .filter((item, index, array) => index === 0 || item.id !== array[index - 1].id);

  return pathPoints.flatMap((item, index, array) => index < array.length - 1 ? [[item, array[index + 1]] as const] : []);
}

function isWalkableRadarPixel(r: number, g: number, b: number, a: number) {
  if (a < 24) return false;
  if (r + g + b < 110) return false;
  if (r > 185 && g > 185 && b > 185) return false;
  return true;
}

function getRouteMask(mapId: string) {
  if (typeof window === "undefined") return Promise.resolve(null);
  const cached = routeMaskCache.get(mapId);
  if (cached) return cached;

  const promise = new Promise<RouteMask | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = rasterGridSize;
      canvas.height = rasterGridSize;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, rasterGridSize, rasterGridSize);
      const pixels = context.getImageData(0, 0, rasterGridSize, rasterGridSize).data;
      const walkable = new Uint8Array(rasterGridSize * rasterGridSize);
      for (let index = 0; index < walkable.length; index += 1) {
        const pixelIndex = index * 4;
        walkable[index] = isWalkableRadarPixel(
          pixels[pixelIndex],
          pixels[pixelIndex + 1],
          pixels[pixelIndex + 2],
          pixels[pixelIndex + 3],
        ) ? 1 : 0;
      }
      resolve({ size: rasterGridSize, walkable });
    };
    image.onerror = () => resolve(null);
    image.src = `./maps/${mapId}.png`;
  });

  routeMaskCache.set(mapId, promise);
  return promise;
}

function rasterIndex(mask: RouteMask, cell: RasterCell) {
  return cell.row * mask.size + cell.col;
}

function clampCell(value: number, size: number) {
  return Math.max(0, Math.min(size - 1, Math.round(value)));
}

function pointToCell(mask: RouteMask, pointItem: Point) {
  return {
    col: clampCell(pointItem.x / 100 * (mask.size - 1), mask.size),
    row: clampCell(pointItem.y / 100 * (mask.size - 1), mask.size),
  };
}

function cellToWaypoint(mask: RouteMask, id: string, cell: RasterCell): RouteWaypoint {
  return {
    id,
    x: (cell.col + 0.5) / mask.size * 100,
    y: (cell.row + 0.5) / mask.size * 100,
  };
}

function nearestWalkableCell(mask: RouteMask, cell: RasterCell) {
  const startCol = clampCell(cell.col, mask.size);
  const startRow = clampCell(cell.row, mask.size);
  if (mask.walkable[startRow * mask.size + startCol]) return { col: startCol, row: startRow };

  let best: RasterCell | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const maxRadius = Math.ceil(mask.size * 0.18);
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let row = startRow - radius; row <= startRow + radius; row += 1) {
      for (let col = startCol - radius; col <= startCol + radius; col += 1) {
        if (row < 0 || col < 0 || row >= mask.size || col >= mask.size) continue;
        if (Math.abs(row - startRow) !== radius && Math.abs(col - startCol) !== radius) continue;
        if (!mask.walkable[row * mask.size + col]) continue;
        const distance = Math.hypot(col - startCol, row - startRow);
        if (distance < bestDistance) {
          best = { col, row };
          bestDistance = distance;
        }
      }
    }
    if (best) return best;
  }

  return { col: startCol, row: startRow };
}

function hasLineOfSight(mask: RouteMask, from: RasterCell, to: RasterCell) {
  let x0 = from.col;
  let y0 = from.row;
  const x1 = to.col;
  const y1 = to.row;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    if (!mask.walkable[y0 * mask.size + x0]) return false;
    if (x0 === x1 && y0 === y1) return true;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x0 += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y0 += sy;
    }
    if (x0 < 0 || y0 < 0 || x0 >= mask.size || y0 >= mask.size) return false;
  }
}

function simplifyRasterPath(mask: RouteMask, cells: RasterCell[]) {
  if (cells.length <= 2) return cells;
  const simplified = [cells[0]];
  let anchor = 0;
  while (anchor < cells.length - 1) {
    let next = cells.length - 1;
    while (next > anchor + 1 && !hasLineOfSight(mask, cells[anchor], cells[next])) {
      next -= 1;
    }
    simplified.push(cells[next]);
    anchor = next;
  }
  return simplified;
}

function routePenalty(mask: RouteMask, col: number, row: number) {
  let blocked = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nextCol = col + dx;
      const nextRow = row + dy;
      if (nextCol < 0 || nextRow < 0 || nextCol >= mask.size || nextRow >= mask.size) {
        blocked += 1;
        continue;
      }
      if (!mask.walkable[nextRow * mask.size + nextCol]) blocked += 1;
    }
  }
  return blocked * 0.08;
}

function findRasterRoute(mask: RouteMask, from: RasterCell, to: RasterCell) {
  const start = nearestWalkableCell(mask, from);
  const end = nearestWalkableCell(mask, to);
  const startIndex = rasterIndex(mask, start);
  const endIndex = rasterIndex(mask, end);
  if (startIndex === endIndex) return [start, end];

  const total = mask.size * mask.size;
  const costs = new Float32Array(total);
  const scores = new Float32Array(total);
  const previous = new Int32Array(total);
  const visited = new Uint8Array(total);
  const inOpen = new Uint8Array(total);
  costs.fill(Number.POSITIVE_INFINITY);
  scores.fill(Number.POSITIVE_INFINITY);
  previous.fill(-1);

  const open = [startIndex];
  costs[startIndex] = 0;
  scores[startIndex] = Math.hypot(end.col - start.col, end.row - start.row);
  inOpen[startIndex] = 1;

  const neighbors = [
    [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
    [-1, -1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [1, 1, 1.42],
  ] as const;

  while (open.length) {
    let openPosition = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < open.length; index += 1) {
      const score = scores[open[index]];
      if (score < bestScore) {
        bestScore = score;
        openPosition = index;
      }
    }

    const currentIndex = open.splice(openPosition, 1)[0];
    inOpen[currentIndex] = 0;
    if (currentIndex === endIndex) break;
    if (visited[currentIndex]) continue;
    visited[currentIndex] = 1;

    const currentCol = currentIndex % mask.size;
    const currentRow = Math.floor(currentIndex / mask.size);
    for (const [dx, dy, stepCost] of neighbors) {
      const nextCol = currentCol + dx;
      const nextRow = currentRow + dy;
      if (nextCol < 0 || nextRow < 0 || nextCol >= mask.size || nextRow >= mask.size) continue;
      const nextIndex = nextRow * mask.size + nextCol;
      if (visited[nextIndex] || !mask.walkable[nextIndex]) continue;
      const candidate = costs[currentIndex] + stepCost + routePenalty(mask, nextCol, nextRow);
      if (candidate >= costs[nextIndex]) continue;
      previous[nextIndex] = currentIndex;
      costs[nextIndex] = candidate;
      scores[nextIndex] = candidate + Math.hypot(end.col - nextCol, end.row - nextRow);
      if (!inOpen[nextIndex]) {
        open.push(nextIndex);
        inOpen[nextIndex] = 1;
      }
    }
  }

  if (previous[endIndex] === -1) return hasLineOfSight(mask, start, end) ? [start, end] : [start];

  const cells: RasterCell[] = [];
  let current = endIndex;
  while (current !== -1) {
    cells.push({ col: current % mask.size, row: Math.floor(current / mask.size) });
    if (current === startIndex) break;
    current = previous[current];
  }
  return simplifyRasterPath(mask, cells.reverse());
}

function buildImageRoutePlan(map: MapPlan, tactic: Tactic, mask: RouteMask) {
  const pointsById = new Map(map.points.map((item) => [item.id, item]));
  const markers = new Map<string, ImageRouteMarker>();
  const verifiedAnchors = new Set(verifiedRadarAnchorsByMap[map.id] ?? []);
  const routes: ImageRoutePath[] = tactic.routes.map((route, routeIndex) => {
    const routeWaypoints: RouteWaypoint[] = [];
    const anchorIds = route.points.filter((id) => verifiedAnchors.has(id) && pointsById.has(id));

    anchorIds.forEach((id, index) => {
      const pointItem = pointsById.get(id);
      if (!pointItem) return;
      const snapped = nearestWalkableCell(mask, pointToCell(mask, pointItem));
      const marker = { id, x: pointItem.x, y: pointItem.y };
      markers.set(id, { ...marker, label: pointItem.label, kind: pointItem.kind });

      if (index >= anchorIds.length - 1) return;
      const nextPoint = pointsById.get(anchorIds[index + 1]);
      if (!nextPoint) return;
      const nextSnapped = nearestWalkableCell(mask, pointToCell(mask, nextPoint));
      const leg = findRasterRoute(mask, snapped, nextSnapped).map((cell, legIndex, cells) => {
        if (legIndex === 0) {
          return { id: `${route.label}-${routeIndex}-${index}-start`, x: pointItem.x, y: pointItem.y };
        }
        if (legIndex === cells.length - 1) {
          return { id: `${route.label}-${routeIndex}-${index}-end`, x: nextPoint.x, y: nextPoint.y };
        }
        return cellToWaypoint(mask, `${route.label}-${routeIndex}-${index}-${legIndex}`, cell);
      });
      routeWaypoints.push(...(routeWaypoints.length ? leg.slice(1) : leg));
    });

    return { label: route.label, color: route.color, points: routeWaypoints };
  });

  return {
    markers: Array.from(markers.values()),
    routes,
  };
}

function Radar({ map, tactic }: { map: MapPlan; tactic: Tactic }) {
  const [missingMapImages, setMissingMapImages] = useState<Set<string>>(() => new Set());
  const [imageRoutePlan, setImageRoutePlan] = useState<{
    key: string;
    markers: ImageRouteMarker[];
    routes: ImageRoutePath[];
  } | null>(null);
  const hasMapImage = !missingMapImages.has(map.id);
  const activeIds = new Set(tactic.routes.flatMap((route) => route.points));
  const routePlanKey = `${map.id}:${tactic.id}`;
  const activeImageRoutePlan = imageRoutePlan?.key === routePlanKey ? imageRoutePlan : null;

  useEffect(() => {
    let cancelled = false;
    if (!hasMapImage) return () => {
      cancelled = true;
    };

    getRouteMask(map.id).then((mask) => {
      if (cancelled || !mask) return;
      setImageRoutePlan({ key: routePlanKey, ...buildImageRoutePlan(map, tactic, mask) });
    });

    return () => {
      cancelled = true;
    };
  }, [hasMapImage, map, routePlanKey, tactic]);

  const visibleMarkers = hasMapImage
    ? activeImageRoutePlan?.markers ?? []
    : map.points.filter((item) => activeIds.has(item.id));

  return (
    <div className={`radar ${hasMapImage ? "has-map-image" : ""}`} aria-label={`${map.name} 战术雷达示意`}>
      <div className="radar-grid" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        aria-hidden="true"
        className={`radar-image-layer ${hasMapImage ? "is-loaded" : ""}`}
        key={map.id}
        onError={(event) => {
          event.currentTarget.style.display = "none";
          setMissingMapImages((current) => new Set(current).add(map.id));
        }}
        src={`./maps/${map.id}.png`}
      />
      <svg
        aria-hidden="true"
        className={`radar-blueprint ${hasMapImage ? "with-map-image" : ""}`}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <filter id={`map-glow-${map.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="0.7" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="blueprint-shadow">
          {map.paths.map((item) => (
            <path d={item.d} key={`${item.id}-shadow`} strokeWidth={(item.width ?? 8) + 2.8} />
          ))}
        </g>
        <g className="blueprint-lines" filter={`url(#map-glow-${map.id})`}>
          {map.paths.map((item) => (
            <path
              className={`blueprint-path ${item.kind || "main"}`}
              d={item.d}
              key={item.id}
              strokeWidth={item.width ?? 8}
            />
          ))}
        </g>
      </svg>
      <div className="radar-map-name">{map.name}</div>
      <div className="radar-disclaimer">
        {hasMapImage ? "官方锚点 · 路线示意" : "缺少真实地图 · 暂用备用图"}
      </div>
      <div className="map-area-layer" aria-hidden="true">
        {!hasMapImage && map.areas.map((item) => (
          <span
            className={`map-area ${item.kind || "lane"}`}
            key={item.id}
            style={{
              left: `${item.x + item.w / 2}%`,
              top: `${item.y + item.h / 2}%`,
              transform: `translate(-50%, -50%) rotate(${item.rotate ?? 0}deg)`,
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
      {hasMapImage && activeImageRoutePlan ? (
        <svg aria-hidden="true" className="route-svg-layer" preserveAspectRatio="none" viewBox="0 0 100 100">
          {activeImageRoutePlan.routes.map((route) => {
            const routePoints = route.points.map((item) => `${item.x.toFixed(2)},${item.y.toFixed(2)}`).join(" ");
            const endPoint = route.points.at(-1);
            if (route.points.length < 2 || !routePoints || !endPoint) return null;
            return (
              <g key={route.label}>
                <polyline
                  className="route-path"
                  points={routePoints}
                  stroke={route.color}
                />
                <circle
                  className="route-end-dot"
                  cx={endPoint.x}
                  cy={endPoint.y}
                  fill={route.color}
                  r="1.25"
                />
              </g>
            );
          })}
        </svg>
      ) : !hasMapImage ? tactic.routes.map((route) => (
        <div className="route-layer" key={route.label}>
          {routeSegments(map, route).map(([from, to], index, segments) => (
            <span
              className={`route-segment ${index === segments.length - 1 ? "is-terminal" : ""}`}
              key={`${route.label}-${from.id}-${to.id}`}
              style={{ ...segmentStyle(from, to), background: route.color }}
            />
          ))}
        </div>
      )) : null}
      {visibleMarkers.map((item) => (
        <button
          className={`radar-point ${item.kind || "lane"} active ${hasMapImage ? "calibrated" : ""}`}
          key={item.id}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          type="button"
          title={item.label}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function tacticScore(tactic: Tactic, selectedGoal: Goal, selectedRound: RoundType) {
  let score = 0;
  if (tactic.goal === selectedGoal) score += 4;
  if (tactic.roundTypes.includes(selectedRound)) score += 3;
  if (selectedRound === "ECO" && tactic.tempo === "提速") score += 1;
  if (selectedRound === "长枪局" && tactic.tempo !== "提速") score += 1;
  return score;
}

export default function Home() {
  const [mapId, setMapId] = useState("mirage");
  const [side, setSide] = useState<Side>("T");
  const [roundType, setRoundType] = useState<RoundType>("长枪局");
  const [goal, setGoal] = useState<Goal>("爆点");
  const [selectedTacticId, setSelectedTacticId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  const selectedMap = useMemo(() => maps.find((item) => item.id === mapId) || maps[0], [mapId]);
  const recommendations = useMemo(() => {
    return selectedMap.tactics
      .filter((tactic) => tactic.side === side)
      .map((tactic) => ({ tactic, score: tacticScore(tactic, goal, roundType) }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.tactic);
  }, [selectedMap, side, roundType, goal]);
  const selectedTactic = recommendations.find((item) => item.id === selectedTacticId) || recommendations[0];
  const activeDuty = maps.filter((item) => item.pool === "现役").length;
  const tacticCount = maps.reduce((sum, item) => sum + item.tactics.length, 0);

  const randomize = () => {
    const pool = selectedMap.tactics.filter((tactic) => tactic.side === side);
    const exact = pool.filter((tactic) => tactic.goal === goal && tactic.roundTypes.includes(roundType));
    const source = exact.length ? exact : pool;
    setSelectedTacticId(source[Math.floor(Math.random() * source.length)]?.id || null);
  };

  const toggleFavorite = () => {
    setFavorites((current) => current.includes(selectedTactic.id)
      ? current.filter((id) => id !== selectedTactic.id)
      : [...current, selectedTactic.id]);
  };

  return (
    <main className="app-shell">
      <header className="command-bar">
        <a className="brand" href="#planner" aria-label="回到战术推荐器">
          <span>CS</span>
          <div><b>Stratbook</b><small>CS2 临场战术板</small></div>
        </a>
        <nav aria-label="页面导航">
          <a href="#planner">推荐器</a>
          <a href="#radar">雷达</a>
          <a href="#library">地图库</a>
        </nav>
        <div className="live-chip"><i />{activeDuty} 张现役图 · {tacticCount} 套战术</div>
      </header>

      <section className="planner" id="planner">
        <aside className="control-deck">
          <div className="section-label">MATCH INPUT</div>
          <h1>没人指挥时，先拿一套能执行的打法。</h1>
          <p>选地图、阵营和回合状态，它会把适合的战术、站位、路线、道具和口令一起给出来。</p>

          <div className="field-block">
            <span>地图</span>
            <div className="map-grid">
              {maps.map((item) => (
                <button
                  className={item.id === mapId ? "selected" : ""}
                  key={item.id}
                  onClick={() => { setMapId(item.id); setSelectedTacticId(null); }}
                  type="button"
                >
                  <b>{item.name}</b>
                  <small>{item.pool}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field-block">
              <span>阵营</span>
              <div className="segmented">
                {sides.map((item) => (
                  <button className={side === item ? "selected" : ""} key={item} onClick={() => { setSide(item); setSelectedTacticId(null); }} type="button">
                    {item === "T" ? "T 进攻" : "CT 防守"}
                  </button>
                ))}
              </div>
            </div>
            <div className="field-block">
              <span>回合</span>
              <div className="segmented stack">
                {roundTypes.map((item) => (
                  <button className={roundType === item ? "selected" : ""} key={item} onClick={() => { setRoundType(item); setSelectedTacticId(null); }} type="button">{item}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="field-block">
            <span>本回合目标</span>
            <div className="goal-grid">
              {goals.map((item) => (
                <button className={goal === item ? "selected" : ""} key={item} onClick={() => { setGoal(item); setSelectedTacticId(null); }} type="button">{item}</button>
              ))}
            </div>
          </div>

          <button className="random-button" onClick={randomize} type="button">
            <span>换一套可打战术</span>
            <b>↻</b>
          </button>
        </aside>

        <section className="briefing-panel">
          <div className="briefing-top">
            <div>
              <span className="section-label">CALLER BRIEF</span>
              <h2>{selectedMap.name} · {side === "T" ? "进攻方" : "防守方"}</h2>
              <p>{side === "T" ? selectedMap.tNote : selectedMap.ctNote}</p>
            </div>
            <div className={`side-badge side-${side.toLowerCase()}`}>{side}</div>
          </div>

          <div className="map-intel-card">
            <div>
              <span className="section-label">MAP DNA</span>
              <p>{selectedMap.intel.fingerprint}</p>
            </div>
            <div className="intel-grid">
              <section>
                <b>T 核心</b>
                <span>{selectedMap.intel.tCore}</span>
              </section>
              <section>
                <b>CT 核心</b>
                <span>{selectedMap.intel.ctCore}</span>
              </section>
              <section>
                <b>别这样打</b>
                <span>{selectedMap.intel.avoid}</span>
              </section>
            </div>
            <div className="intel-tags" aria-label={`${selectedMap.name} 关键打法标签`}>
              {selectedMap.intel.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          </div>

          <div className="recommendation-list" aria-label="推荐战术">
            {recommendations.map((tactic, index) => (
              <button
                className={selectedTactic.id === tactic.id ? "active" : ""}
                key={tactic.id}
                onClick={() => setSelectedTacticId(tactic.id)}
                type="button"
              >
                <span>0{index + 1}</span>
                <div>
                  <b>{tactic.title}</b>
                  <small>{tactic.tempo} · {tactic.difficulty} · {tactic.goal}</small>
                </div>
              </button>
            ))}
          </div>

          <article className="tactic-card">
            <div className="tactic-title">
              <div>
                <span className="section-label">SELECTED PLAN</span>
                <h3>{selectedTactic.title}</h3>
              </div>
              <button className="favorite-button" onClick={toggleFavorite} type="button" aria-label="收藏当前战术">
                {favorites.includes(selectedTactic.id) ? "★" : "☆"}
              </button>
            </div>
            <p>{selectedTactic.summary}</p>
            <div className="callout-line">“{selectedTactic.call}”</div>
            <div className="meta-row">
              <span>{selectedTactic.goal}</span>
              <span>{selectedTactic.tempo}</span>
              <span>{selectedTactic.roundTypes.join(" / ")}</span>
            </div>
          </article>
        </section>
      </section>

      <section className="radar-section" id="radar">
        <div className="radar-wrap">
          <div>
            <span className="section-label">RADAR BOARD</span>
            <h2>{selectedMap.name} 路线图</h2>
            <p>{selectedMap.theme}</p>
          </div>
          <Radar map={selectedMap} tactic={selectedTactic} />
        </div>
        <aside className="route-legend">
          <span className="section-label">ROUTES</span>
          {selectedTactic.routes.map((route) => (
            <div className="legend-item" key={route.label}>
              <i style={{ background: route.color }} />
              <span>{route.label}</span>
            </div>
          ))}
        </aside>
      </section>

      <section className="execution-grid">
        <article>
          <span className="section-label">SETUP</span>
          <h3>开局站位</h3>
          <ol>{selectedTactic.setup.map((item) => <li key={item}>{item}</li>)}</ol>
        </article>
        <article>
          <span className="section-label">UTILITY</span>
          <h3>道具清单</h3>
          <ol>{selectedTactic.utility.map((item) => <li key={item}>{item}</li>)}</ol>
        </article>
        <article className="wide">
          <span className="section-label">TIMING</span>
          <h3>执行顺序</h3>
          <ol>{selectedTactic.steps.map((item) => <li key={item}>{item}</li>)}</ol>
          <div className="fallback"><b>转点方案</b><span>{selectedTactic.fallback}</span></div>
        </article>
      </section>

      <section className="library" id="library">
        <div className="library-head">
          <span className="section-label">MAP LIBRARY</span>
          <h2>地图战术库</h2>
          <p>调研版覆盖当前现役图和常见备用图；每张图都有专属打法 DNA 与多套进攻、防守方案。</p>
        </div>
        <div className="map-cards">
          {maps.map((item) => {
            const tCount = item.tactics.filter((tactic) => tactic.side === "T").length;
            const ctCount = item.tactics.filter((tactic) => tactic.side === "CT").length;
            return (
              <button className={item.id === mapId ? "selected" : ""} key={item.id} onClick={() => { setMapId(item.id); setSelectedTacticId(null); }} type="button">
                <span>{item.pool}</span>
                <h3>{item.name}</h3>
                <p>{item.theme}</p>
                <small>{tCount} 套进攻 · {ctCount} 套防守</small>
              </button>
            );
          })}
        </div>
      </section>

      <footer>
        <b>CS2 Stratbook</b>
        <span>非官方粉丝工具 · 战术适合路人局快速沟通，具体站位按队友枪位微调。</span>
      </footer>
    </main>
  );
}
