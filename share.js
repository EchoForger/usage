// Draws a 3:4 portrait share card (2160x2880 JPEG) of the current status with Canvas 2D.
const SHARE_W = 540;
const SHARE_H = 720;
const SHARE_SCALE = 4; // 540x720 layout units -> 2160x2880 pixels
const MIN_FIT = 0.8; // the layout is shrunk by at most this much to fit the height
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

function card(ctx, c, y, h, W) {
  ctx.beginPath();
  ctx.roundRect(36, y, W - 72, h, 24);
  ctx.fillStyle = c.card;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.border;
  ctx.stroke();
}

// W x H is the layout space. It is wider and taller than the canvas when the content needs shrinking
// to fit (see shareCanvas). Returns the bottom edge of the content, above the footer.
function drawShare(ctx, data, now, W = SHARE_W, H = SHARE_H) {
  const c = shareColors();
  const v = version(now);
  const size = bucket(data.clarity, SIZES);
  const effort = bucket(data.desire, EFFORTS);
  const total = dailyTotal(data.sleep);
  const q = quota(now, total, data.left, data.leftAt);
  const name = `Haonan-${v.label}-${size}`;
  const L = 60; // inner left edge of cards
  const R = W - 60; // inner right edge of cards
  const X = L - 24; // left edge of text outside cards

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // Header: same text as the page header. y is a cursor so wrapped paragraphs push content down.
  text(ctx, t("eyebrow"), X, 46, { size: 14, color: c.muted });
  text(ctx, name, X, 86, { size: 40, weight: 600, color: c.fg });
  let y = 114;
  y += (wrapText(ctx, t("lede", { age: v.major }), X, y, W - 72, 20, { size: 14.5, color: c.muted }) - 1) * 20;

  // Plan limits: daily limit plus the sleep level that set it
  y += 36;
  text(ctx, t("limitsTitle"), X, y, { size: 20, weight: 500, color: c.fg });
  let T = y + 14;
  card(ctx, c, T, 218, W);
  text(ctx, t("dailyLimit"), L, T + 30, { size: 16, weight: 500, color: c.fg });
  text(ctx, t(q.offline ? "bootsIn" : "resetsIn", { t: formatDuration(q.resetAt - now) }), L, T + 54, { size: 14, color: c.muted });
  text(ctx, t("left", { p: Math.floor(q.fraction * 100) }), R, T + 54, { size: 14, color: c.muted, align: "right" });
  pill(ctx, L, T + 64, 10, R - L, 5, c.track);
  if (q.fraction > 0) pill(ctx, L, T + 64, 10, Math.max(10, (R - L) * q.fraction), 5, c.fill);
  text(ctx, `${q.left.toLocaleString("en-US")} / ${total.toLocaleString("en-US")} tokens`, L, T + 92, { size: 12, color: c.muted });
  text(ctx, t(q.offline ? "offline" : "online"), R, T + 92, { size: 12, color: c.muted, align: "right" });
  ctx.fillStyle = c.border;
  ctx.fillRect(L, T + 108, R - L, 1);
  text(ctx, t("sleepTitle"), L, T + 134, { size: 16, weight: 500, color: c.fg });
  text(ctx, t("sleepDesc"), L, T + 152, { size: 12, color: c.muted });
  drawSeg(ctx, c, L, T + 162, R - L,
    SLEEP_STOPS.map((s, i) => `${STRINGS[lang].sleepLevels[i]} · ${formatTokens(dailyTotal(s))}`),
    Math.round(clamp01(data.sleep) * (SLEEP_STOPS.length - 1)));
  y = T + 218;

  // Current configuration: model size and reasoning effort
  y += 32;
  text(ctx, t("configTitle"), X, y, { size: 20, weight: 500, color: c.fg });
  T = y + 14;
  card(ctx, c, T, 246, W);
  text(ctx, t("sizeTitle"), L, T + 30, { size: 16, weight: 500, color: c.fg });
  text(ctx, t("sizeDesc"), L, T + 48, { size: 12, color: c.muted });
  drawSeg(ctx, c, L, T + 58, R - L, SIZES.map((s) => `Haonan-${v.label}-${s}`), SIZES.indexOf(size));
  text(ctx, t("effortTitle"), L, T + 124, { size: 16, weight: 500, color: c.fg });
  text(ctx, t("effortDesc"), L, T + 142, { size: 12, color: c.muted });
  const ultra = effort === "Ultra";
  text(ctx, effort, W / 2, T + 176, { size: 24, weight: 500, color: ultra ? c.purple : c.blue, align: "center" });
  drawEffortTrack(ctx, c, L, T + 190, R - L, EFFORTS.indexOf(effort), ultra);
  y = T + 246;

  // NPU: the chip the model runs on
  T = y + 16;
  drawNPU(ctx, c, T, L, R, now, q, W);
  y = T + 74;

  // Footer
  text(ctx, `${formatStamp(now).slice(0, 16)} UTC+8`, X, H - 22, { size: 12, color: c.muted });
  text(ctx, "echoforger.github.io/usage", W - 36, H - 22, { size: 12, color: c.muted, align: "right" });
  return y;
}

function tagWidth(ctx, label) {
  ctx.font = `400 10px ${FONT}`;
  return ctx.measureText(label).width + 10;
}

// Small outlined label, like the page's Estimated/Simulated tags.
function drawTag(ctx, c, label, x, baseline) {
  const w = tagWidth(ctx, label);
  ctx.beginPath();
  ctx.roundRect(x, baseline - 11, w, 15, 4);
  ctx.strokeStyle = c.border;
  ctx.stroke();
  text(ctx, label, x + 5, baseline, { size: 10, color: c.muted });
}

function drawNPU(ctx, c, T, L, R, now, q, W) {
  const gpu = getCurrentGPU(now);
  card(ctx, c, T, 74, W);
  text(ctx, t("npuName"), L, T + 28, { size: 13, color: c.muted });
  const status = t(q.offline ? "gpuSleep" : "gpuOnline");
  ctx.font = `500 12px ${FONT}`;
  const sw = ctx.measureText(status).width + 20;
  pill(ctx, R - sw, T + 14, 22, sw, 11, q.offline ? c.seg : c.blue);
  text(ctx, status, R - sw / 2, T + 29, { size: 12, weight: 500, color: q.offline ? c.muted : "#fff", align: "center" });
  const nw = text(ctx, gpu.name, L, T + 58, { size: 22, weight: 600, color: c.fg });
  const aw = text(ctx, `${t("archFull", { a: gpu.arch })} · ${formatPflops(gpu.tflops)}`, L + nw + 10, T + 58, { size: 12, color: c.muted });
  drawTag(ctx, c, t("tagEstimated"), L + nw + 10 + aw + 6, T + 57);
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

// The card is always 3:4. Content is laid out in a space of width SHARE_W / fit; when the content (a long
// English intro, say) would not fit the height, fit drops below 1 and everything is drawn slightly smaller.
function shareCanvas(data, now = Date.now()) {
  const probe = document.createElement("canvas").getContext("2d");
  const FOOTER = 44; // footer text plus the gap above it
  let fit = 1;
  for (let i = 0; i < 4; i++) {
    const bottom = drawShare(probe, data, now, SHARE_W / fit, SHARE_H / fit);
    const next = Math.max(MIN_FIT, Math.min(1, SHARE_H / (bottom + FOOTER)));
    if (Math.abs(next - fit) < 0.002) break;
    fit = next;
  }
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W * SHARE_SCALE;
  canvas.height = SHARE_H * SHARE_SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SHARE_SCALE * fit, SHARE_SCALE * fit);
  drawShare(ctx, data, now, SHARE_W / fit, SHARE_H / fit);
  canvas.fit = fit;
  return canvas;
}

async function exportImage() {
  const button = $("export-button");
  button.disabled = true;
  button.textContent = t("exporting");
  try {
    const v = version(Date.now());
    await download(shareCanvas(draft), `Haonan-${v.label}-${bucket(draft.clarity, SIZES)}-${bjDateString(Date.now())}.jpg`);
  } finally {
    button.disabled = false;
    button.textContent = t("export");
  }
}

// Full-page export: copy every element's computed style inline, wrap the page in an SVG
// foreignObject and rasterize it at 2x, so the image matches what this window shows.
const PAGE_SCALE = 2;

function inlineStyles(src, dst) {
  const cs = getComputedStyle(src);
  let css = "";
  for (let i = 0; i < cs.length; i++) css += `${cs[i]}:${cs.getPropertyValue(cs[i])};`;
  dst.setAttribute("style", css);
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i]);
}

async function pageCanvas() {
  const w = document.documentElement.clientWidth;
  const h = document.documentElement.scrollHeight;
  const clone = document.body.cloneNode(true);
  // Finish running transitions so bars and the effort knob are captured at their final values.
  document.documentElement.classList.add("capturing");
  inlineStyles(document.body, clone);
  document.documentElement.classList.remove("capturing");
  const root = document.createElement("div");
  root.setAttribute("style", `${clone.getAttribute("style")}width:${w}px;height:${h}px;margin:0;`);
  root.append(...clone.childNodes);
  root.querySelectorAll(".top-actions, #toast, script").forEach((el) => el.remove());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * PAGE_SCALE}" height="${h * PAGE_SCALE}" viewBox="0 0 ${w} ${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">${new XMLSerializer().serializeToString(root)}</foreignObject></svg>`;
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w * PAGE_SCALE;
  canvas.height = h * PAGE_SCALE;
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function download(canvas, filename) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 1));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function exportPage() {
  const button = $("export-page-button");
  button.disabled = true;
  button.textContent = t("exporting");
  try {
    const v = version(Date.now());
    await download(await pageCanvas(), `Haonan-${v.label}-${bucket(draft.clarity, SIZES)}-page-${bjDateString(Date.now())}.jpg`);
  } finally {
    button.disabled = false;
    button.textContent = t("exportPage");
  }
}

// ?export=share|page renders the image on load and leaves it in <body data-export="data:image/jpeg;base64,...">.
// server.py loads the page in headless Chrome this way so the menu bar app can copy the same image to the clipboard.
// sleep/clarity/desire/left in the query preview unsaved values.
async function autoExport() {
  const params = new URLSearchParams(location.search);
  const kind = params.get("export");
  if (!kind) return;
  while (!draft) await new Promise((r) => setTimeout(r, 50));
  for (const key of ["sleep", "clarity", "desire", "left"]) {
    if (params.has(key)) draft[key] = clamp01(params.get(key));
  }
  if (params.has("left")) draft.leftAt = new Date().toISOString();
  render(draft);
  await new Promise((r) => setTimeout(r, 300));
  try {
    const canvas = kind === "page" ? await pageCanvas() : shareCanvas(draft);
    document.body.setAttribute("data-export", canvas.toDataURL("image/jpeg", 1));
  } catch (e) {
    document.body.setAttribute("data-export", "ERROR " + e.message);
  }
}

if (typeof document !== "undefined") {
  $("export-button").addEventListener("click", exportImage);
  $("export-page-button").addEventListener("click", exportPage);
  autoExport();
}
