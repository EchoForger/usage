// Draws a 9:16 share card (2160x3840 JPEG) of the current status with Canvas 2D.
const SHARE_W = 540;
const SHARE_H = 960;
const SHARE_SCALE = 4; // 540x960 layout units -> 2160x3840 pixels
const SHARE_BENCH = ["SWE-bench Verified", "MuChoMusic", "ARC-AGI-2", "OpenAI-MRCR (8-needle)"];
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif';

function shareColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    bg: v("--bg"), fg: v("--fg"), muted: v("--muted"), card: v("--card"), border: v("--border"),
    track: v("--track"), fill: v("--fill"), weak: v("--weak"), blue: "#2f6bd6", purple: "#a46cf0",
  };
}

function text(ctx, str, x, y, { size = 16, weight = 400, color, align = "left" } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

function pill(ctx, x, y, h, w, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function card(ctx, c, y, h) {
  ctx.beginPath();
  ctx.roundRect(36, y, SHARE_W - 72, h, 24);
  ctx.fillStyle = c.card;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.border;
  ctx.stroke();
}

function drawShare(ctx, data, now) {
  const c = shareColors();
  const v = version(now);
  const size = bucket(data.clarity, SIZES);
  const effort = bucket(data.desire, EFFORTS);
  const total = dailyTotal(data.sleep);
  const q = quota(now, total, data.left, data.leftAt);
  const name = `Haonan-${v.label}-${size}`;
  const L = 60; // inner left edge
  const R = SHARE_W - 60; // inner right edge

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // Header
  text(ctx, t("eyebrow"), L - 24, 80, { size: 15, color: c.muted });
  text(ctx, name, L - 24, 128, { size: 42, weight: 600, color: c.fg });
  text(ctx, t("tagline"), L - 24, 162, { size: 16, color: c.muted });
  const pills = [
    [t("size"), size],
    [t("effort"), q.offline ? t("off") : effort],
    [t("context"), t("perDay", { n: formatTokens(total) })],
  ];
  // Shrink the pill text if the row would not fit between the margins.
  const pillWidth = (fs) => pills.reduce((sum, [label, value]) => {
    ctx.font = `400 ${fs}px ${FONT}`;
    const w1 = ctx.measureText(`${label} · `).width;
    ctx.font = `500 ${fs}px ${FONT}`;
    return sum + w1 + ctx.measureText(value).width + 24 + 8;
  }, -8);
  let fs = 13;
  while (fs > 10 && pillWidth(fs) > SHARE_W - 72) fs -= 0.5;
  let px = L - 24;
  for (const [label, value] of pills) {
    ctx.font = `400 ${fs}px ${FONT}`;
    const w1 = ctx.measureText(`${label} · `).width;
    ctx.font = `500 ${fs}px ${FONT}`;
    const w = w1 + ctx.measureText(value).width + 24;
    ctx.beginPath();
    ctx.roundRect(px, 182, w, 30, 15);
    ctx.strokeStyle = c.border;
    ctx.stroke();
    text(ctx, `${label} · `, px + 12, 202, { size: fs, color: c.muted });
    text(ctx, value, px + 12 + w1, 202, { size: fs, weight: 500, color: c.fg });
    px += w + 8;
  }

  // Daily limit
  card(ctx, c, 236, 196);
  text(ctx, t("dailyLimit"), L, 276, { size: 18, weight: 500, color: c.fg });
  text(ctx, t(q.offline ? "offline" : "online"), R, 276, { size: 14, color: c.muted, align: "right" });
  const pct = `${Math.floor(q.fraction * 100)}%`;
  const pw = text(ctx, pct, L, 348, { size: 60, weight: 600, color: c.fg });
  text(ctx, lang === "zh" ? "剩余" : "left", L + pw + 10, 348, { size: 18, color: c.muted });
  pill(ctx, L, 368, 12, R - L, 6, c.track);
  if (q.fraction > 0) pill(ctx, L, 368, 12, Math.max(12, (R - L) * q.fraction), 6, c.fill);
  text(ctx, `${q.left.toLocaleString("en-US")} / ${total.toLocaleString("en-US")} tokens`, L, 408, { size: 13, color: c.muted });
  text(ctx, t(q.offline ? "bootsIn" : "resetsIn", { t: formatDuration(q.resetAt - now) }), R, 408,
    { size: 13, color: c.muted, align: "right" });

  // Reasoning effort
  card(ctx, c, 448, 192);
  text(ctx, t("effortTitle"), L, 488, { size: 18, weight: 500, color: c.fg });
  const ultra = effort === "Ultra";
  text(ctx, effort, SHARE_W / 2, 536, { size: 30, weight: 500, color: ultra ? c.purple : c.blue, align: "center" });
  text(ctx, name, SHARE_W / 2, 564, { size: 15, color: c.muted, align: "center" });
  drawEffortTrack(ctx, c, L, 584, R - L, EFFORTS.indexOf(effort), ultra);

  // Benchmarks
  const items = BENCHMARKS.flatMap((g) => g.items.map((b) => ({ ...b, weak: g.weak })))
    .filter((b) => SHARE_BENCH.includes(b.name));
  card(ctx, c, 656, 76 + items.length * 44);
  text(ctx, t("shareBench"), L, 696, { size: 18, weight: 500, color: c.fg });
  items.forEach((b, i) => {
    const y = 736 + i * 44;
    text(ctx, b.name, L, y, { size: 14, color: c.fg });
    text(ctx, b.score, R, y, { size: 14, weight: 500, color: c.fg, align: "right" });
    pill(ctx, L, y + 10, 5, R - L, 2.5, c.track);
    pill(ctx, L, y + 10, 5, (R - L) * b.bar, 2.5, b.weak ? c.weak : c.fill);
  });

  // Footer
  const stamp = new Date(now + TZ_OFFSET).toISOString().slice(0, 16).replace("T", " ");
  text(ctx, `${stamp} UTC+8`, L - 24, SHARE_H - 36, { size: 12, color: c.muted });
  text(ctx, "echoforger.github.io/usage", SHARE_W - 36, SHARE_H - 36, { size: 12, color: c.muted, align: "right" });
}

function drawEffortTrack(ctx, c, x, y, w, index, ultra) {
  const h = 32;
  const r = 20; // knob radius
  const cx = x + r + ((w - 2 * r) * index) / (EFFORTS.length - 1);
  pill(ctx, x, y, h, w, h / 2, c.track);
  if (ultra) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    ["#5f7cf2", "#8d5ce6", "#b077f2", "#7a66ee"].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
    pill(ctx, x, y, h, w, h / 2, g);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.clip();
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.random();
      ctx.beginPath();
      ctx.arc(x + Math.random() * w, y + 4 + Math.random() * (h - 8), 0.5 + Math.random() * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.restore();
  } else {
    pill(ctx, x, y, h, cx - x + r, h / 2, c.blue);
    for (let i = 0; i < EFFORTS.length; i++) {
      ctx.beginPath();
      ctx.arc(x + r + ((w - 2 * r) * i) / (EFFORTS.length - 1), y + h / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(150, 150, 150, .55)";
      ctx.fill();
    }
  }
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, .25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(cx, y + h / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
}

function shareCanvas(data, now = Date.now()) {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W * SHARE_SCALE;
  canvas.height = SHARE_H * SHARE_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SHARE_SCALE, SHARE_SCALE);
  drawShare(ctx, data, now);
  return canvas;
}

async function exportImage() {
  const button = $("export-button");
  button.disabled = true;
  button.textContent = t("exporting");
  try {
    const canvas = shareCanvas(draft);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 1));
    const v = version(Date.now());
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Haonan-${v.label}-${bucket(draft.clarity, SIZES)}-${bjDateString(Date.now())}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    button.disabled = false;
    button.textContent = t("export");
  }
}

if (typeof document !== "undefined") $("export-button").addEventListener("click", exportImage);
