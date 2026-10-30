const TZ_OFFSET = 8 * 3600e3; // Beijing, UTC+8
const BIRTH = { y: 2001, m: 8, d: 10 };
const BOOT_HOUR = 9;
const TOKENS_MIN = 200000;
const TOKENS_MAX = 1000000;
const SIZES = ["Solo", "Quartet", "Symphony"];
const EFFORTS = ["Light", "Medium", "High", "Extra high", "Ultra"];

const BENCHMARKS = [
  { group: { zh: "编程", en: "Coding" }, items: [
    { name: "SWE-bench Verified", score: "84.6%", bar: 0.846, desc: { zh: "修复真实 GitHub 仓库里的真实 bug。", en: "Fix real bugs in real GitHub repositories." } },
    { name: "Terminal-Bench 2.0", score: "78.2%", bar: 0.782, desc: { zh: "在终端里把真实的活干完。", en: "Get real work done in a terminal." } },
    { name: "LiveCodeBench", score: "88.9%", bar: 0.889, desc: { zh: "刚出的编程竞赛题，没法靠背答案。", en: "Fresh competitive programming problems, no memorizing." } },
    { name: "Codeforces", score: "2731", bar: 2731 / 4000, desc: { zh: "编程竞赛积分，Elo。", en: "Contest rating, Elo." } },
  ]},
  { group: { zh: "音乐", en: "Music" }, items: [
    { name: "MuChoMusic", score: "94.1%", bar: 0.941, desc: { zh: "听懂一段音乐里在发生什么。", en: "Understand what is going on in a piece of music." } },
    { name: "MMAU (Music)", score: "91.3%", bar: 0.913, desc: { zh: "回答关于录音的专业问题。", en: "Answer expert questions about recorded audio." } },
  ]},
  { group: { zh: "智能体与推理", en: "Agents and reasoning" }, items: [
    { name: "OSWorld", score: "80.4%", bar: 0.804, desc: { zh: "自己用鼠标和键盘在电脑上完成任务。", en: "Operate a computer with mouse and keyboard to finish tasks." } },
    { name: "τ²-bench (Telecom)", score: "89.7%", bar: 0.897, desc: { zh: "扮演客服，用工具帮顾客解决问题。", en: "Act as a support agent and solve customer issues with tools." } },
    { name: "ARC-AGI-2", score: "83.0%", bar: 0.83, desc: { zh: "人一眼能看出规律、AI 很难做对的图形谜题。", en: "Visual pattern puzzles that are easy for humans and hard for AI." } },
  ]},
  { group: { zh: "已知弱项", en: "Known weak spots" }, weak: true, items: [
    { name: "OpenAI-MRCR (8-needle)", score: "11.8%", bar: 0.118, desc: { zh: "在很长的对话里找出某件事第 N 次被提到的地方。", en: "Find the Nth mention of something in a long conversation." } },
    { name: "Graphwalks", score: "17.5%", bar: 0.175, desc: { zh: "在一大段材料里顺着线索一步步找下去。", en: "Follow a chain of clues through a large document." } },
    { name: "MultiChallenge", score: "24.3%", bar: 0.243, desc: { zh: "多轮聊天里一直记得前面提过的要求。", en: "Remember earlier requirements across a multi-turn chat." } },
    { name: "IFEval", score: "39.6%", bar: 0.396, desc: { zh: "严格按指定格式回答。", en: "Follow formatting instructions exactly." } },
    { name: "EQ-Bench 3", score: "702", bar: 702 / 2000, desc: { zh: "处理棘手的人际场景，Elo。", en: "Handle tricky interpersonal situations, Elo." } },
  ]},
];

const STRINGS = {
  zh: {
    toggle: "EN",
    eyebrow: "模型",
    lede: "一个生物推理模型，基于 {age} 年的人生经验训练。擅长写代码和音乐。每年发布四个版本，年龄每满一个季度发布一次。",
    size: "大小", effort: "推理强度", context: "上下文", perDay: "{n} / 天", off: "关闭",
    limitsTitle: "用量限制",
    limitsDesc: "思考、说话、写代码和听音乐共用同一份额度。每天 00:00 到 09:00（UTC+8）停止输出。每日额度由昨晚的睡眠决定。",
    dailyLimit: "每日额度", bootsIn: "{t}后启动", resetsIn: "{t}后重置", left: "剩余 {p}%",
    offline: "离线 · 睡眠中", online: "在线",
    sleepScore: "睡眠评分 {s}", stale: "（今天未记录，沿用 {d} 的）", updated: "{t}前更新",
    configTitle: "当前配置",
    sizeTitle: "模型大小", sizeDesc: "由此刻大脑的清醒程度决定。", clarity: "清醒程度 {v}",
    effortTitle: "推理强度", effortDesc: "由此刻想不想深度思考决定。", desire: "思考欲望 {v}",
    detailsTitle: "模型详情",
    kVersion: "版本", vVersion: "{v}，按年龄每季度发布",
    kNext: "下一版本", vNext: "Haonan-{v}，{d} 发布",
    kTokens: "每日 Token", vTokens: "{a} 到 {b}，由睡眠决定",
    kAvail: "可用时间", vAvail: "09:00 到 24:00，UTC+8",
    kStrengths: "擅长", vStrengths: "代码、音乐、智能体任务",
    kCutoff: "知识截止",
    benchTitle: "基准测试",
    benchDesc: "自测成绩。除特别注明外，均在 Symphony 大小、Ultra 推理强度下测得。",
    benchNote: "弱项均在 23:00 之后测得。Codeforces 和 EQ-Bench 3 的 Elo 进度条分别按 4000 和 2000 换算。",
    footer: "Haonan 不是 OpenAI 的产品。出生于 2001-08-10。",
    dur: (d, h, m) => (d > 0 ? `${d} 天 ${h} 小时` : h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`),
  },
  en: {
    toggle: "中文",
    eyebrow: "Model",
    lede: "A biological reasoning model, trained on {age} years of lived experience. Strong at code and music. Ships four versions a year, one per quarter of age.",
    size: "Size", effort: "Reasoning effort", context: "Context", perDay: "{n} / day", off: "Off",
    limitsTitle: "Plan limits",
    limitsDesc: "Shared across thinking, talking, coding, and listening. Output is disabled from 00:00 to 09:00 (UTC+8). Daily budget is set by last night's sleep.",
    dailyLimit: "Daily limit", bootsIn: "Boots in {t}", resetsIn: "Resets in {t}", left: "{p}% left",
    offline: "Offline · sleeping", online: "Online",
    sleepScore: "Sleep score {s}", stale: " (not logged today, using {d})", updated: "Updated {t} ago",
    configTitle: "Current configuration",
    sizeTitle: "Model size", sizeDesc: "Set by how awake the brain is right now.", clarity: "Clarity {v}",
    effortTitle: "Reasoning effort", effortDesc: "Set by how much it wants to think deeply right now.", desire: "Desire to think {v}",
    detailsTitle: "Model details",
    kVersion: "Version", vVersion: "{v}, released quarterly by age",
    kNext: "Next release", vNext: "Haonan-{v} on {d}",
    kTokens: "Daily tokens", vTokens: "{a} to {b}, set by sleep",
    kAvail: "Availability", vAvail: "09:00 to 24:00, UTC+8",
    kStrengths: "Strengths", vStrengths: "Code, music, agentic tasks",
    kCutoff: "Knowledge cutoff",
    benchTitle: "Benchmarks",
    benchDesc: "Self-reported. Evaluated at Symphony size and Ultra effort unless noted.",
    benchNote: "Weak spots were measured after 23:00. Codeforces Elo and EQ-Bench 3 Elo bars are scaled to 4000 and 2000.",
    footer: "Haonan is not an OpenAI product. Born 2001-08-10.",
    dur: (d, h, m) => (d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`),
  },
};

let lang = (typeof localStorage !== "undefined" && localStorage.getItem("lang")) || "zh";

function t(key, vars = {}) {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (_, k) => vars[k]);
}

// Epoch ms of a Beijing wall-clock time.
function bj(y, m, d, h = 0) {
  return Date.UTC(y, m - 1, d, h) - TZ_OFFSET;
}

function bjParts(now) {
  const t = new Date(now + TZ_OFFSET);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours() };
}

function bjDateString(now) {
  return new Date(now + TZ_OFFSET).toISOString().slice(0, 10);
}

function version(now) {
  const { y } = bjParts(now);
  let last = bj(y, BIRTH.m, BIRTH.d);
  let ly = y;
  if (last > now) { ly = y - 1; last = bj(ly, BIRTH.m, BIRTH.d); }
  const next = bj(ly + 1, BIRTH.m, BIRTH.d);
  const quarter = Math.floor(((now - last) / (next - last)) * 4);
  const major = ly - BIRTH.y;
  const nextRelease = last + ((next - last) * (quarter + 1)) / 4;
  const nextVersion = quarter === 3 ? `${major + 1}.0` : `${major}.${quarter + 1}`;
  return { major, minor: quarter, label: `${major}.${quarter}`, nextRelease, nextVersion };
}

function dailyTotal(sleep) {
  return Math.round(TOKENS_MIN + (TOKENS_MAX - TOKENS_MIN) * clamp01(sleep));
}

function quota(now, total) {
  const { y, m, d, h } = bjParts(now);
  const boot = bj(y, m, d, BOOT_HOUR);
  const end = bj(y, m, d + 1);
  if (h < BOOT_HOUR) {
    return { offline: true, left: 0, fraction: 0, resetAt: boot };
  }
  const fraction = (end - now) / (end - boot);
  return { offline: false, left: Math.round(total * fraction), fraction, resetAt: bj(y, m, d + 1, BOOT_HOUR) };
}

function bucket(value, labels) {
  return labels[Math.min(labels.length - 1, Math.floor(clamp01(value) * labels.length))];
}

function clamp01(x) {
  return Math.max(0, Math.min(1, Number(x) || 0));
}

function formatDuration(ms) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return STRINGS[lang].dur(d, h, m);
}

function formatTokens(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 2 : 0)}M`;
  return `${Math.round(n / 1000)}K`;
}

function $(id) {
  return document.getElementById(id);
}

function renderSeg(el, labels, active) {
  el.innerHTML = labels.map((l) => `<span class="${l === active ? "on" : ""}">${l}</span>`).join("");
}

function renderBenchmarks() {
  $("benchmarks").innerHTML = BENCHMARKS.map((g) => `
    <h3>${g.group[lang]}</h3>
    ${g.items.map((b) => `
      <div class="bench${g.weak ? " weak" : ""}">
        <span class="name">${b.name}</span><span class="score">${b.score}</span>
        <span class="desc">${b.desc[lang]}</span>
        <div class="bar"><div style="width:${(b.bar * 100).toFixed(1)}%"></div></div>
      </div>`).join("")}`).join("");
}

// Fill every element marked with data-i18n="key".
function renderStatic() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  renderBenchmarks();
}

function render(data) {
  const now = Date.now();
  const v = version(now);
  const size = bucket(data.clarity, SIZES);
  const effort = bucket(data.desire, EFFORTS);
  const total = dailyTotal(data.sleep);
  const q = quota(now, total);
  const name = `Haonan-${v.label}-${size}`;

  document.title = `${name} · Usage`;
  $("model-name").textContent = name;
  $("lede").textContent = t("lede", { age: v.major });
  $("pill-size").textContent = size;
  $("pill-effort").textContent = q.offline ? t("off") : effort;
  $("pill-context").textContent = t("perDay", { n: formatTokens(total) });

  $("reset-text").textContent = t(q.offline ? "bootsIn" : "resetsIn", { t: formatDuration(q.resetAt - now) });
  $("left-pct").textContent = t("left", { p: Math.floor(q.fraction * 100) });
  $("left-bar").style.width = `${(q.fraction * 100).toFixed(2)}%`;
  $("left-tokens").textContent = `${q.left.toLocaleString("en-US")} / ${total.toLocaleString("en-US")} tokens`;
  $("status-text").textContent = t(q.offline ? "offline" : "online");

  renderSeg($("seg-size"), SIZES, size);
  renderSeg($("seg-effort"), EFFORTS, effort);
  $("clarity-text").textContent = t("clarity", { v: clamp01(data.clarity).toFixed(2) });
  $("desire-text").textContent = t("desire", { v: clamp01(data.desire).toFixed(2) });

  const stale = data.sleepDate !== bjDateString(now) && !q.offline;
  const updated = new Date(data.updatedAt);
  $("updated-text").textContent =
    t("sleepScore", { s: clamp01(data.sleep).toFixed(2) }) + (stale ? t("stale", { d: data.sleepDate }) : "") +
    " · " + t("updated", { t: formatDuration(now - updated.getTime()) });

  const specs = [
    [t("kVersion"), t("vVersion", { v: v.label })],
    [t("kNext"), t("vNext", { v: v.nextVersion, d: bjDateString(v.nextRelease) })],
    [t("kTokens"), t("vTokens", { a: formatTokens(TOKENS_MIN), b: formatTokens(TOKENS_MAX) })],
    [t("kAvail"), t("vAvail")],
    [t("kStrengths"), t("vStrengths")],
    [t("kCutoff"), bjDateString(now)],
  ];
  $("specs").innerHTML = specs.map(([k, val]) => `<div><span class="k">${k}</span><span>${val}</span></div>`).join("");
}

async function main() {
  renderStatic();
  const res = await fetch(`data.json?t=${Date.now()}`, { cache: "no-store" });
  const data = await res.json();
  render(data);
  setInterval(() => render(data), 1000);
  $("lang-toggle").addEventListener("click", () => {
    lang = lang === "zh" ? "en" : "zh";
    localStorage.setItem("lang", lang);
    renderStatic();
    render(data);
  });
}

if (typeof document !== "undefined") main();
