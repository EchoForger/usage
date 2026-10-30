const TZ_OFFSET = 8 * 3600e3; // Beijing, UTC+8
const BIRTH = { y: 2001, m: 8, d: 10 };
const BOOT_HOUR = 9;
const TOKENS_MIN = 200000;
const TOKENS_MAX = 1000000;
const SIZES = ["Solo", "Quartet", "Symphony"];
const EFFORTS = ["Light", "Medium", "High", "Extra high", "Ultra"];

const BENCHMARKS = [
  { group: "Coding", items: [
    { name: "SWE-bench Verified", desc: "Fix real bugs in real GitHub repositories.", score: "84.6%", bar: 0.846 },
    { name: "Terminal-Bench 2.0", desc: "Get real work done in a terminal.", score: "78.2%", bar: 0.782 },
    { name: "LiveCodeBench", desc: "Fresh competitive programming problems, no memorizing.", score: "88.9%", bar: 0.889 },
    { name: "Codeforces", desc: "Contest rating, Elo.", score: "2731", bar: 2731 / 4000 },
  ]},
  { group: "Music", items: [
    { name: "MuChoMusic", desc: "Understand what is going on in a piece of music.", score: "94.1%", bar: 0.941 },
    { name: "MMAU (Music)", desc: "Answer expert questions about recorded audio.", score: "91.3%", bar: 0.913 },
  ]},
  { group: "Agents and reasoning", items: [
    { name: "OSWorld", desc: "Operate a computer with mouse and keyboard to finish tasks.", score: "80.4%", bar: 0.804 },
    { name: "τ²-bench (Telecom)", desc: "Act as a support agent and solve customer issues with tools.", score: "89.7%", bar: 0.897 },
    { name: "ARC-AGI-2", desc: "Visual pattern puzzles that are easy for humans and hard for AI.", score: "83.0%", bar: 0.83 },
  ]},
  { group: "Known weak spots", weak: true, items: [
    { name: "OpenAI-MRCR (8-needle)", desc: "Find the Nth mention of something in a long conversation.", score: "11.8%", bar: 0.118 },
    { name: "Graphwalks", desc: "Follow a chain of clues through a large document.", score: "17.5%", bar: 0.175 },
    { name: "MultiChallenge", desc: "Remember earlier requirements across a multi-turn chat.", score: "24.3%", bar: 0.243 },
    { name: "IFEval", desc: "Follow formatting instructions exactly.", score: "39.6%", bar: 0.396 },
    { name: "EQ-Bench 3", desc: "Handle tricky interpersonal situations, Elo.", score: "702", bar: 702 / 2000 },
  ]},
];

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
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m}m`;
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
    <h3>${g.group}</h3>
    ${g.items.map((b) => `
      <div class="bench${g.weak ? " weak" : ""}">
        <span class="name">${b.name}</span><span class="score">${b.score}</span>
        <span class="desc">${b.desc}</span>
        <div class="bar"><div style="width:${(b.bar * 100).toFixed(1)}%"></div></div>
      </div>`).join("")}`).join("");
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
  $("age-years").textContent = v.major;
  $("pill-size").textContent = size;
  $("pill-effort").textContent = q.offline ? "Off" : effort;
  $("pill-context").textContent = `${formatTokens(total)} / day`;

  $("reset-text").textContent = q.offline
    ? `Boots in ${formatDuration(q.resetAt - now)}`
    : `Resets in ${formatDuration(q.resetAt - now)}`;
  $("left-pct").textContent = `${Math.floor(q.fraction * 100)}% left`;
  $("left-bar").style.width = `${(q.fraction * 100).toFixed(2)}%`;
  $("left-tokens").textContent = `${q.left.toLocaleString("en-US")} / ${total.toLocaleString("en-US")} tokens`;
  $("status-text").textContent = q.offline ? "Offline · sleeping" : "Online";

  renderSeg($("seg-size"), SIZES, size);
  renderSeg($("seg-effort"), EFFORTS, effort);
  $("clarity-text").textContent = `Clarity ${clamp01(data.clarity).toFixed(2)}`;
  $("desire-text").textContent = `Desire to think ${clamp01(data.desire).toFixed(2)}`;

  const stale = data.sleepDate !== bjDateString(now) && !q.offline;
  const updated = new Date(data.updatedAt);
  $("updated-text").textContent =
    `Sleep score ${clamp01(data.sleep).toFixed(2)}${stale ? " (not logged today, using " + data.sleepDate + ")" : ""}` +
    ` · Updated ${formatDuration(now - updated.getTime())} ago`;

  const specs = [
    ["Version", `${v.label}, released quarterly by age`],
    ["Next release", `Haonan-${v.nextVersion} on ${bjDateString(v.nextRelease)}`],
    ["Daily tokens", `${formatTokens(TOKENS_MIN)} to ${formatTokens(TOKENS_MAX)}, set by sleep`],
    ["Availability", "09:00 to 24:00, UTC+8"],
    ["Strengths", "Code, music, agentic tasks"],
    ["Knowledge cutoff", bjDateString(now)],
  ];
  $("specs").innerHTML = specs.map(([k, val]) => `<div><span class="k">${k}</span><span>${val}</span></div>`).join("");
}

async function main() {
  renderBenchmarks();
  const res = await fetch(`data.json?t=${Date.now()}`, { cache: "no-store" });
  const data = await res.json();
  render(data);
  setInterval(() => render(data), 1000);
}

if (typeof document !== "undefined") main();
