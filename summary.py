"""Status summary for the menu bar app. Mirrors the page's logic in app.js and gpu.js
(version, daily quota, size/effort buckets, NPU generation and simulated utilization).
Keep the constants here in sync with those files."""
from datetime import datetime, timedelta

import brain

BJ = brain.BJ
BIRTH = datetime(2001, 8, 10, tzinfo=BJ)
BOOT_HOUR = 9
TOKENS_MIN, TOKENS_MAX = 200_000, 1_000_000
SIZES = ["Solo", "Quartet", "Symph"]
EFFORTS = ["Light", "Medium", "High", "Extra high", "Ultra"]
SIZE_LOAD = {"Solo": 0.35, "Quartet": 0.55, "Symph": 0.75}
EFFORT_LOAD = {"Light": 0, "Medium": 0.05, "High": 0.1, "Extra high": 0.15, "Ultra": 0.2}
ASLEEP_UTILIZATION = 0.2
# (name, architecture, generation, minAge, peak TFLOPS)
NPUS = [("HN-N1", "Genesis", 1, 0, 150), ("HN-N2", "Growth", 2, 9, 1000), ("HN-N3", "Mature", 3, 32, 1000),
        ("HN-N4", "Adaptive", 4, 66, 800), ("HN-N5", "Legacy", 5, 83, 600)]


def clamp01(x):
    return max(0.0, min(1.0, float(x or 0)))


def bucket(value, labels):
    return labels[min(len(labels) - 1, int(clamp01(value) * len(labels)))]


def version(now):
    year = now.year if now >= datetime(now.year, BIRTH.month, BIRTH.day, tzinfo=BJ) else now.year - 1
    last = datetime(year, BIRTH.month, BIRTH.day, tzinfo=BJ)
    nxt = datetime(year + 1, BIRTH.month, BIRTH.day, tzinfo=BJ)
    quarter = int((now - last) / (nxt - last) * 4)
    return year - BIRTH.year, quarter


def quota(now, total, left, left_at):
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    boot = midnight + timedelta(hours=BOOT_HOUR)
    end = midnight + timedelta(days=1)
    if now < boot:
        return True, 0.0, boot
    fraction = (end - now) / (end - boot)
    if left is not None and left_at:
        at = datetime.fromisoformat(left_at)
        if boot <= at < end:
            fraction = clamp01(left) * min(1.0, (end - now) / (end - at))
    return False, fraction, end + timedelta(hours=BOOT_HOUR)


def summary(now=None, overrides=None):
    """overrides: unsaved sleep/clarity/desire/left values to preview (the menu bar's pending clicks).
    Nothing is written; `saved` always reports what is in data.json."""
    now = now or datetime.now(BJ)
    data = brain.read()
    saved = {k: data.get(k) for k in ("sleep", "clarity", "desire", "left", "leftAt")}
    for key in ("sleep", "clarity", "desire", "left"):
        if overrides and key in overrides:
            data[key] = clamp01(float(overrides[key]))
            if key == "left":
                data["leftAt"] = now.isoformat()
    major, quarter = version(now)
    size = bucket(data["clarity"], SIZES)
    effort = bucket(data["desire"], EFFORTS)
    sleep = clamp01(data["sleep"])
    total = int(TOKENS_MIN + (TOKENS_MAX - TOKENS_MIN) * sleep + 0.5)
    offline, fraction, reset_at = quota(now, total, data.get("left"), data.get("leftAt"))
    name, arch, generation, _, tflops = [n for n in NPUS if n[3] <= major][-1]
    if offline:
        utilization = ASLEEP_UTILIZATION
    else:
        utilization = min(1.0, (SIZE_LOAD[size] + EFFORT_LOAD[effort]) * (0.7 + 0.3 * sleep))
    return {
        "model": f"Haonan-{major}.{quarter}-{size}", "size": size, "effort": effort,
        "sleepIndex": int(sleep * 4 + 0.5), "total": total, "left": int(total * fraction + 0.5),
        "fraction": fraction, "offline": offline,
        "now": now.timestamp(), "resetAt": reset_at.timestamp(),
        "updatedAt": datetime.fromisoformat(data["updatedAt"]).timestamp(),
        "unpushed": brain.unpushed(), "saved": saved,
        "npu": {"name": name, "arch": arch, "generation": generation, "peakTflops": tflops,
                "utilization": utilization, "effectiveTflops": tflops * utilization},
    }
