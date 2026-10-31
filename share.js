// Draws a 9:16 share card (2160x3840 JPEG) of the current status with Canvas 2D.
const SHARE_W = 540;
const SHARE_H = 960;
const SHARE_SCALE = 4; // 540x960 layout units -> 2160x3840 pixels
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif';

function shareColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    bg: v("--bg"), fg: v("--fg"), muted: v("--muted"), card: v("--card"), border: v("--border"),
    track: v("--track"), fill: v("--fill"), seg: v("--seg"), accent: v("--accent"), accentFg: v("--accent-fg"), blue: "#2f6bd6", purple: "#a46cf0",
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

// Segmented control like the page: all options visible, the current one highlighted.
function drawSeg(ctx, c, x, y, w, labels, active) {
  const h = 36;
  const gap = 4;
  pill(ctx, x, y, h, w, h / 2, c.seg);
  const sw = (w - gap * (labels.length + 1)) / labels.length;
  labels.forEach((label, i) => {
    const sx = x + gap + i * (sw + gap);
    if (i === active) pill(ctx, sx, y + gap, h - 2 * gap, sw, (h - 2 * gap) / 2, c.accent);
    let fs = 13;
    ctx.font = `500 ${fs}px ${FONT}`;
    while (fs > 9 && ctx.measureText(label).width > sw - 8) ctx.font = `500 ${(fs -= 0.5)}px ${FONT}`;
    text(ctx, label, sx + sw / 2, y + h / 2 + fs * 0.36, {
      size: fs, weight: i === active ? 500 : 400, color: i === active ? c.accentFg : c.muted, align: "center",
    });
  });
}

// Wraps by character so it works for Chinese as well as English.
function wrapText(ctx, str, x, y, maxWidth, lineHeight, opts) {
  ctx.font = `${opts.weight || 400} ${opts.size}px ${FONT}`;
  const lines = [];
  let line = "";
  for (const ch of str) {
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      // Prefer breaking English at the last space.
      const cut = /\s/.test(ch) ? -1 : line.lastIndexOf(" ");
      if (cut > 0 && /[A-Za-z]/.test(ch)) {
        lines.push(line.slice(0, cut));
        line = line.slice(cut + 1);
      } else {
        lines.push(line);
        line = "";
      }
      if (/\s/.test(ch)) continue;
    }
    line += ch;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => text(ctx, l, x, y + i * lineHeight, opts));
  return lines.length;
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

  // Header: same text as the page header
  text(ctx, t("eyebrow"), L - 24, 58, { size: 14, color: c.muted });
  text(ctx, name, L - 24, 100, { size: 40, weight: 600, color: c.fg });
  const ledeLines = wrapText(ctx, t("lede", { age: v.major }), L - 24, 130, SHARE_W - 72, 21, { size: 14.5, color: c.muted });
  // Layout below assumes two-line paragraphs; shift everything down for extra lines.
  ctx.save();
  ctx.translate(0, Math.max(0, ledeLines - 2) * 21);
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
    ctx.roundRect(px, 170, w, 30, 15);
    ctx.strokeStyle = c.border;
    ctx.stroke();
    text(ctx, `${label} · `, px + 12, 190, { size: fs, color: c.muted });
    text(ctx, value, px + 12 + w1, 190, { size: fs, weight: 500, color: c.fg });
    px += w + 8;
  }

  // Plan limits: daily limit plus the sleep level that set it
  text(ctx, t("limitsTitle"), L - 24, 242, { size: 20, weight: 500, color: c.fg });
  const descLines = wrapText(ctx, t("limitsDesc"), L - 24, 266, SHARE_W - 72, 19, { size: 13, color: c.muted });
  ctx.translate(0, Math.max(0, descLines - 2) * 19);
  card(ctx, c, 298, 232);
  text(ctx, t("dailyLimit"), L, 330, { size: 16, weight: 500, color: c.fg });
  text(ctx, t(q.offline ? "bootsIn" : "resetsIn", { t: formatDuration(q.resetAt - now) }), L, 356, { size: 14, color: c.muted });
  text(ctx, t("left", { p: Math.floor(q.fraction * 100) }), R, 356, { size: 14, color: c.muted, align: "right" });
  pill(ctx, L, 368, 10, R - L, 5, c.track);
  if (q.fraction > 0) pill(ctx, L, 368, 10, Math.max(10, (R - L) * q.fraction), 5, c.fill);
  text(ctx, `${q.left.toLocaleString("en-US")} / ${total.toLocaleString("en-US")} tokens`, L, 396, { size: 12, color: c.muted });
  text(ctx, t(q.offline ? "offline" : "online"), R, 396, { size: 12, color: c.muted, align: "right" });
  ctx.fillStyle = c.border;
  ctx.fillRect(L, 414, R - L, 1);
  text(ctx, t("sleepTitle"), L, 444, { size: 16, weight: 500, color: c.fg });
  text(ctx, t("sleepDesc"), L, 464, { size: 12, color: c.muted });
  drawSeg(ctx, c, L, 476, R - L,
    SLEEP_STOPS.map((s, i) => `${STRINGS[lang].sleepLevels[i]} · ${formatTokens(dailyTotal(s))}`),
    Math.round(clamp01(data.sleep) * (SLEEP_STOPS.length - 1)));

  // Current configuration: model size and reasoning effort
  text(ctx, t("configTitle"), L - 24, 572, { size: 20, weight: 500, color: c.fg });
  card(ctx, c, 588, 292);
  text(ctx, t("sizeTitle"), L, 620, { size: 16, weight: 500, color: c.fg });
  text(ctx, t("sizeDesc"), L, 640, { size: 12, color: c.muted });
  drawSeg(ctx, c, L, 652, R - L, SIZES.map((s) => `Haonan-${v.label}-${s}`), SIZES.indexOf(size));
  text(ctx, t("effortTitle"), L, 722, { size: 16, weight: 500, color: c.fg });
  text(ctx, t("effortDesc"), L, 742, { size: 12, color: c.muted });
  const ultra = effort === "Ultra";
  text(ctx, effort, SHARE_W / 2, 780, { size: 26, weight: 500, color: ultra ? c.purple : c.blue, align: "center" });
  text(ctx, name, SHARE_W / 2, 804, { size: 14, color: c.muted, align: "center" });
  drawEffortTrack(ctx, c, L, 820, R - L, EFFORTS.indexOf(effort), ultra);
  ctx.restore();

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
