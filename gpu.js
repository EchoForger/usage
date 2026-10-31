// Biological GPU: the brain as the hardware that runs the Haonan model.
// Generation boundaries come from population brain-network studies (approximate turning
// points at ages 9, 32, 66 and 83). They are product version boundaries, not medical predictions.
// All compute/memory/bandwidth figures are nominal product specs, not measurements.

const HARDWARE = {
  manufacturer: "Haonan",
  brand: "HN",
  family: "HN Neural Processor",
  processorType: "Biological Neural Processing Unit",
  hardwareId: `HN-${BIRTH.y}${String(BIRTH.m).padStart(2, "0")}${String(BIRTH.d).padStart(2, "0")}`,
  serial: `${BIRTH.y}${String(BIRTH.m).padStart(2, "0")}${String(BIRTH.d).padStart(2, "0")}`,
  host: "Haonan Wu",
  // Same for every generation. Biological values are human averages, not personal measurements.
  biological: { neuronsBillion: 86, powerW: 20 },
  generations: [
    { generation: 1, name: "HN-N1", arch: "Genesis", minAge: 0, maxAge: 9, tflops: 150, memoryPB: 0.2, bandwidthTBs: 20, powerW: 12 },
    { generation: 2, name: "HN-N2", arch: "Growth", minAge: 9, maxAge: 32, tflops: 1000, memoryPB: 1, bandwidthTBs: 100, powerW: 20 },
    { generation: 3, name: "HN-N3", arch: "Mature", minAge: 32, maxAge: 66, tflops: 1000, memoryPB: 1, bandwidthTBs: 100, powerW: 20 },
    { generation: 4, name: "HN-N4", arch: "Adaptive", minAge: 66, maxAge: 83, tflops: 800, memoryPB: 0.9, bandwidthTBs: 80, powerW: 20 },
    { generation: 5, name: "HN-N5", arch: "Legacy", minAge: 83, maxAge: Infinity, tflops: 600, memoryPB: 0.8, bandwidthTBs: 60, powerW: 20 },
  ],
};

// Simulated runtime load. Deterministic: only the saved state and the clock matter.
const RUNTIME = {
  sizeLoad: { Solo: 0.35, Quartet: 0.55, Symph: 0.75 },
  effortLoad: { Light: 0, Medium: 0.05, High: 0.1, "Extra high": 0.15, Ultra: 0.2 },
  sleepFactor: (sleep) => 0.7 + 0.3 * clamp01(sleep), // last night's sleep scales usable load
  asleepUtilization: 0.2, // maintenance and memory consolidation keep running while asleep
};

const DAY = 86400e3;

function getCurrentAge(now) {
  return version(now).major;
}

function getGPUGeneration(age) {
  return HARDWARE.generations.find((g) => age >= g.minAge && age < g.maxAge);
}

// Release happens on the birthday (Beijing midnight) at which minAge is reached.
function generationDate(age) {
  return Number.isFinite(age) ? bj(BIRTH.y + age, BIRTH.m, BIRTH.d) : null;
}

function getCurrentGPU(now) {
  return getGPUGeneration(getCurrentAge(now));
}

function getNextGPUUpgrade(now) {
  const gpu = getCurrentGPU(now);
  const next = HARDWARE.generations.find((g) => g.generation === gpu.generation + 1);
  if (!next) return null;
  const age = getCurrentAge(now);
  const nextBirthday = generationDate(age + 1);
  return {
    gpu: next,
    at: generationDate(next.minAge),
    years: next.minAge - (age + 1),
    days: Math.ceil((nextBirthday - now) / DAY),
  };
}

function getGPUHistory(now) {
  const current = getCurrentGPU(now).generation;
  return HARDWARE.generations.map((g) => ({
    ...g,
    status: g.generation < current ? "historical" : g.generation === current ? "current" : "planned",
  }));
}

function getGPUSpecifications(generation) {
  const g = HARDWARE.generations.find((x) => x.generation === generation);
  return {
    ...g,
    pflops: g.tflops / 1000,
    efficiency: g.tflops / g.powerW,
    releaseAt: generationDate(g.minAge),
    endAt: generationDate(g.maxAge),
  };
}

function getGPUUtilization({ offline, size, effort, sleep }) {
  if (offline) return RUNTIME.asleepUtilization;
  const load = RUNTIME.sizeLoad[size] + RUNTIME.effortLoad[effort];
  return Math.min(1, load * RUNTIME.sleepFactor(sleep));
}

function getEffectiveCompute(gpu, utilization) {
  return gpu.tflops * utilization;
}
const GPU_TEXT = {
  zh: {
    stages: ["儿童发育期", "青少年至青年期", "成年期", "老年早期", "老年晚期"],
    intros: [
      "第一代生物神经架构，专注于快速神经发育、连接网络建立以及基础认知能力的形成。",
      "第二代生物神经架构，具备持续发展的神经网络整合能力、自适应连接机制和不断演进的认知功能。",
      "第三代成熟神经架构，具有相对成熟的连接网络、持续积累的经验以及自适应认知处理能力。",
      "第四代适应型神经架构，体现年龄相关的网络重组，以及持续依赖经验的认知加工能力。",
      "第五代生物神经架构，体现晚期生命周期中的网络重组和长期经验驱动的认知处理。",
    ],
    traits: [
      ["大脑快速生长", "神经网络迅速建立", "突触连接快速形成与重组", "感觉系统与运动系统持续成熟", "语言和基础认知能力逐渐建立", "神经可塑性显著"],
      ["神经网络持续组织与优化", "全局网络整合效率的统计趋势变化", "白质与神经连接进一步成熟", "神经回路持续重组", "执行功能和复杂认知能力的发展", "通过学习持续形成知识与技能"],
      ["成年期神经网络组织趋于相对稳定", "持续存在经验依赖的可塑性", "知识和经验继续积累", "神经网络局部化和整合特征发生变化", "不同认知能力的发展轨迹可能不同"],
      ["脑网络结构继续变化", "神经网络整合与模块化特征变化", "认知加工可能更多依赖积累的经验", "大脑持续存在适应性与可塑性", "个体差异显著"],
      ["晚期成年阶段的神经网络变化", "连接组织和局部网络结构可能进一步改变", "长期经验与知识仍可能发挥作用", "神经可塑性并非完全停止", "认知表现存在极大个体差异"],
    ],
  },
  en: {
    stages: ["Childhood development", "Adolescence to young adulthood", "Adulthood", "Early older age", "Later life"],
    intros: [
      "First-generation biological neural architecture focused on rapid neural development, connectivity formation, and foundational cognitive capabilities.",
      "Second-generation biological neural architecture featuring advanced neural integration, adaptive connectivity, and continuously evolving cognitive capabilities.",
      "Third-generation mature neural architecture emphasizing established connectivity, accumulated experience, and adaptive cognitive processing.",
      "Fourth-generation adaptive neural architecture reflecting age-related network reorganization and continued experience-dependent processing.",
      "Fifth-generation biological neural architecture representing later-life neural reorganization and sustained experience-based processing.",
    ],
    traits: [
      ["Rapid brain growth", "Neural networks form quickly", "Synapses form and reorganize rapidly", "Sensory and motor systems keep maturing", "Language and basic cognition emerge", "High neuroplasticity"],
      ["Networks keep organizing and optimizing", "Statistical shifts in global network integration", "White matter and connections mature further", "Circuits keep reorganizing", "Executive function and complex cognition develop", "Knowledge and skills keep forming through learning"],
      ["Adult network organization becomes relatively stable", "Experience-dependent plasticity continues", "Knowledge and experience keep accumulating", "Network segregation and integration change", "Different abilities may follow different trajectories"],
      ["Brain network structure keeps changing", "Integration and modularity shift", "Processing may lean more on accumulated experience", "Adaptivity and plasticity continue", "Large individual differences"],
      ["Late-adulthood network changes", "Connectivity and local structure may change further", "Long-term experience and knowledge can still contribute", "Neuroplasticity does not stop", "Very large individual differences"],
    ],
  },
};
Object.assign(STRINGS.zh, {
  gpuTitle: "GPU", gpuDesc: "生物神经处理器：运行 Haonan 模型的硬件。模型版本按年龄季度更新，GPU 只按大脑生命周期阶段更新，两者互不影响。",
  genLabel: "第 {n} 代生物 NPU", archFull: "{a} Neural 架构",
  kPeak: "峰值算力", kMemory: "存储容量", kBandwidth: "存储带宽", kPower: "功耗", kEfficiency: "能效",
  tagEstimated: "估算", tagSimulated: "模拟", tagBiological: "生物学参考", tagNominal: "名义",
  tipEstimated: "产品化类比的估算值，假设较强，不是测量结果。",
  tipSimulated: "人为设定的虚拟值，没有统一的科学方法能直接换算。",
  tipBiological: "人类平均参考量级，不是个人实测。",
  tipNominal: "网站设定的名义规格，不代表能力随年龄按比例变化。",
  gpuOnline: "在线", gpuSleep: "睡眠",
  kUtil: "利用率", kEffective: "有效算力", kRunning: "运行模型", kNextGen: "下一代架构",
  vNextGen: "{g} · {d}（{y} 年 {days} 天后）", vFinalGen: "最后一代，没有下一代规划",
  sleepNote: "睡眠中：输出暂停，后台仍在进行生命维持和记忆整理等神经活动。",
  runtimeNote: "利用率 =（模型大小负载 + 推理强度负载）×（0.7 + 0.3 × 睡眠评分），睡眠时为后台维护负载。有效算力 = 峰值算力 × 利用率。",
  detailsSummary: "完整规格",
  kManufacturer: "制造商", kModel: "型号", kType: "处理器类型", kArch: "架构", kGeneration: "代际",
  kHardwareId: "硬件 ID", kSerial: "序列号", kMfgDate: "制造日期", kRelease: "发布日期", kHost: "生物宿主",
  kOrigArch: "初始架构", kNeurons: "神经元", kCooling: "散热", kMemArch: "存储架构", kLearning: "学习机制",
  kSignal: "信号传输", kSubstrate: "计算基底",
  vType: "生物神经处理单元", vNeurons: "约 860 亿", vCooling: "脑血流", vMemArch: "分布式神经记忆",
  vLearning: "神经可塑性", vSignal: "电化学信号", vSubstrate: "生物神经网络",
  specNote: "算力、存储和带宽都是产品化的虚拟等效指标，不是医学测量，不能用来推断 IQ，也不代表人脑比某款 GPU 强多少倍。神经元数量和 20 W 功耗是人类平均参考量级。代际边界取自人群脑网络研究中的近似转折年龄（9、32、66、83 岁），是网站定义的版本边界，不代表个人在这些年龄发生变化，也不是真的更换了芯片。",
  tlTitle: "GPU 架构时间轴", tlDesc: "同一颗大脑在不同年龄阶段的架构代际。点击查看每一代的规格，时间轴不按年份比例绘制。",
  stHistorical: "历史", stCurrent: "当前", stPlanned: "规划中",
  ages: "{a}–{b} 岁", agesOpen: "{a} 岁以后", period: "{s} 至 {e}", periodOpen: "{s} 起",
  backToCurrent: "回到当前 {g}", plannedNote: "拟定规格，仅为网站的版本规划，不是对未来能力的预测。",
  compareTitle: "代际对比", kStage: "生物阶段", kAges: "年龄",
});
Object.assign(STRINGS.en, {
  gpuTitle: "GPU", gpuDesc: "Biological Neural Processor: the hardware that runs the Haonan model. The model version follows age quarters; the GPU only follows brain lifecycle stages. Neither changes the other.",
  genLabel: "{o} Generation Biological NPU", archFull: "{a} Neural Architecture",
  kPeak: "Peak Compute", kMemory: "Memory", kBandwidth: "Memory Bandwidth", kPower: "Power", kEfficiency: "Efficiency",
  tagEstimated: "Estimated", tagSimulated: "Simulated", tagBiological: "Biological", tagNominal: "Nominal",
  tipEstimated: "Product-style estimate built on strong assumptions, not a measurement.",
  tipSimulated: "Made-up virtual value; there is no standard way to convert brain activity into it.",
  tipBiological: "Human average reference, not a personal measurement.",
  tipNominal: "Nominal spec set by this site; it does not mean ability scales with age by these ratios.",
  gpuOnline: "Online", gpuSleep: "Sleep",
  kUtil: "Utilization", kEffective: "Effective Compute", kRunning: "Running model", kNextGen: "Next Generation",
  vNextGen: "{g} · {d} (in {y}y {days}d)", vFinalGen: "Final generation, no successor planned",
  sleepNote: "Asleep: output is paused, but life support and memory consolidation keep running.",
  runtimeNote: "Utilization = (model size load + effort load) × (0.7 + 0.3 × sleep score); maintenance load while asleep. Effective compute = peak compute × utilization.",
  detailsSummary: "Full specifications",
  kManufacturer: "Manufacturer", kModel: "Model", kType: "Processor Type", kArch: "Architecture", kGeneration: "Generation",
  kHardwareId: "Hardware ID", kSerial: "Serial Number", kMfgDate: "Manufacturing Date", kRelease: "Release Date", kHost: "Biological Host",
  kOrigArch: "Original Architecture", kNeurons: "Neurons", kCooling: "Cooling", kMemArch: "Memory Architecture", kLearning: "Learning Mechanism",
  kSignal: "Signal Transmission", kSubstrate: "Computing Substrate",
  vType: "Biological Neural Processing Unit", vNeurons: "~86 billion", vCooling: "Cerebral blood flow", vMemArch: "Distributed neural memory",
  vLearning: "Neuroplasticity", vSignal: "Electrochemical", vSubstrate: "Biological neural network",
  specNote: "Compute, memory and bandwidth are virtual product-style equivalents, not medical measurements. They say nothing about IQ and do not mean a brain beats any GPU by some factor. Neuron count and 20 W power are human averages. Generation boundaries use approximate turning-point ages from population brain-network studies (9, 32, 66, 83). They are version boundaries defined by this site, not changes predicted for one person, and no chip is actually replaced.",
  tlTitle: "GPU Architecture Timeline", tlDesc: "Architecture generations of the same brain across life stages. Select one to see its specs. Not drawn to scale.",
  stHistorical: "Historical", stCurrent: "Current", stPlanned: "Planned",
  ages: "Age {a}–{b}", agesOpen: "Age {a}+", period: "{s} to {e}", periodOpen: "From {s}",
  backToCurrent: "Back to current {g}", plannedNote: "Proposed specs. This is the site's version plan, not a prediction of future ability.",
  compareTitle: "Generation comparison", kStage: "Biological stage", kAges: "Age",
});
let gpuKey = ""; // re-render static GPU parts only when this changes
let gpuSelected = null; // generation picked in the timeline; null = current

function tag(kind) {
  return `<span class="tag" title="${t("tip" + kind)}">${t("tag" + kind)}</span>`;
}

function formatPflops(tflops) {
  return `${tflops / 1000} PFLOPS`;
}

function genLabel(n) {
  return t("genLabel", { n, o: ["1st", "2nd", "3rd", "4th", "5th"][n - 1] });
}

function ageRange(g) {
  return Number.isFinite(g.maxAge) ? t("ages", { a: g.minAge, b: g.maxAge }) : t("agesOpen", { a: g.minAge });
}

function periodText(s) {
  const start = bjDateString(s.releaseAt);
  return s.endAt ? t("period", { s: start, e: bjDateString(s.endAt) }) : t("periodOpen", { s: start });
}

function specTiles(s) {
  return [
    [t("kPeak"), formatPflops(s.tflops), "Estimated"],
    [t("kMemory"), `${s.memoryPB} PB`, "Estimated"],
    [t("kBandwidth"), `${s.bandwidthTBs} TB/s`, "Simulated"],
    [t("kPower"), `${s.powerW} W`, "Nominal"],
  ].map(([k, v, kind]) => `<div class="gpu-tile"><span class="k">${k}</span><b>${v}</b>${tag(kind)}</div>`).join("");
}

function renderGPUStatic(now, gpu, name) {
  const s = getGPUSpecifications(gpu.generation);
  const next = getNextGPUUpgrade(now);
  $("gpu-name").textContent = gpu.name;
  $("gpu-arch").textContent = `${t("archFull", { a: gpu.arch })} · ${genLabel(gpu.generation)}`;
  $("gpu-tiles").innerHTML = specTiles(s);
  $("gpu-model").textContent = name;
  $("gpu-next").textContent = next
    ? t("vNextGen", { g: next.gpu.name, d: bjDateString(next.at), y: next.years, days: next.days })
    : t("vFinalGen");
  const first = HARDWARE.generations[0];
  const rows = [
    ["kManufacturer", HARDWARE.manufacturer], ["kModel", gpu.name], ["kType", t("vType")],
    ["kArch", t("archFull", { a: gpu.arch })], ["kGeneration", genLabel(gpu.generation)],
    ["kHardwareId", HARDWARE.hardwareId], ["kSerial", HARDWARE.serial],
    ["kMfgDate", bjDateString(generationDate(0))], ["kRelease", bjDateString(s.releaseAt)],
    ["kNextGen", $("gpu-next").textContent], ["kHost", HARDWARE.host],
    ["kOrigArch", t("archFull", { a: first.arch })],
    ["kNeurons", t("vNeurons"), "Biological"], ["kPeak", formatPflops(s.tflops), "Estimated"],
    ["kMemory", `${s.memoryPB} PB`, "Estimated"], ["kBandwidth", `${s.bandwidthTBs} TB/s`, "Simulated"],
    ["kPower", `${s.powerW} W`, "Nominal"], ["kEfficiency", `${s.efficiency} TFLOPS/W`, "Estimated"],
    ["kSubstrate", t("vSubstrate")], ["kSignal", t("vSignal")], ["kCooling", t("vCooling")],
    ["kMemArch", t("vMemArch")], ["kLearning", t("vLearning")],
  ];
  $("gpu-spec-list").innerHTML = rows.map(([k, v, kind]) =>
    `<div><span class="k">${t(k)}</span><span>${v}${kind ? " " + tag(kind) : ""}</span></div>`).join("");
}
const STATUS_KEY = { historical: "stHistorical", current: "stCurrent", planned: "stPlanned" };

function renderTimeline(now) {
  const history = getGPUHistory(now);
  const current = history.find((g) => g.status === "current");
  const selected = history.find((g) => g.generation === gpuSelected) || current;
  $("gpu-timeline").innerHTML = history.map((g) => {
    const s = getGPUSpecifications(g.generation);
    return `<button type="button" class="tl-node ${g.status}${g === selected ? " selected" : ""}" data-gen="${g.generation}">
      <span class="tl-year">${bjDateString(s.releaseAt).slice(0, 4)}</span>
      <span class="tl-dot"></span>
      <b>${g.name}</b><span class="tl-arch">${g.arch}</span>
      <span class="tl-status">${t(STATUS_KEY[g.status])}</span>
    </button>`;
  }).join("");

  const s = getGPUSpecifications(selected.generation);
  const i = selected.generation - 1;
  $("gpu-gen-detail").innerHTML = `
    <div class="row"><span class="title">${selected.name} · ${t("archFull", { a: selected.arch })}</span>
      <span class="badge ${selected.status}">${t(STATUS_KEY[selected.status])}</span></div>
    <p class="muted small">${genLabel(selected.generation)} · ${ageRange(selected)} · ${periodText(s)} · ${GPU_TEXT[lang].stages[i]}</p>
    <p>${GPU_TEXT[lang].intros[i]}</p>
    <ul class="traits">${GPU_TEXT[lang].traits[i].map((x) => `<li>${x}</li>`).join("")}</ul>
    <div class="gpu-tiles">${specTiles(s)}<div class="gpu-tile"><span class="k">${t("kEfficiency")}</span><b>${s.efficiency} TFLOPS/W</b>${tag("Estimated")}</div></div>
    ${selected.status === "planned" ? `<p class="muted small">${t("plannedNote")}</p>` : ""}
    ${selected !== current ? `<button type="button" class="link" data-gen="${current.generation}">${t("backToCurrent", { g: current.name })}</button>` : ""}`;

  const specs = history.map((g) => getGPUSpecifications(g.generation));
  const row = (label, cells) => `<tr><th>${label}</th>${cells.map((c, j) =>
    `<td class="${history[j].status === "current" ? "current" : ""}">${c}</td>`).join("")}</tr>`;
  $("gpu-compare").innerHTML = `<thead>${row("", history.map((g) => `${g.name}<br><span class="muted">${t(STATUS_KEY[g.status])}</span>`))}</thead><tbody>
    ${row(t("kArch"), history.map((g) => g.arch))}
    ${row(t("kStage"), history.map((g) => GPU_TEXT[lang].stages[g.generation - 1]))}
    ${row(t("kAges"), history.map(ageRange))}
    ${row(t("kPeak"), specs.map((x) => formatPflops(x.tflops)))}
    ${row(t("kMemory"), specs.map((x) => `${x.memoryPB} PB`))}
    ${row(t("kBandwidth"), specs.map((x) => `${x.bandwidthTBs} TB/s`))}
    ${row(t("kPower"), specs.map((x) => `${x.powerW} W`))}
    ${row(t("kEfficiency"), specs.map((x) => `${x.efficiency} TFLOPS/W`))}
  </tbody>`;
}

// Called every second from render(); static parts only redraw when their inputs change.
function renderGPU(data, now, q, size, effort, name) {
  const gpu = getCurrentGPU(now);
  const key = [lang, gpu.generation, name, bjDateString(now), gpuSelected].join("|");
  if (key !== gpuKey) {
    gpuKey = key;
    renderGPUStatic(now, gpu, name);
    renderTimeline(now);
  }
  const util = getGPUUtilization({ offline: q.offline, size, effort, sleep: data.sleep });
  $("gpu-status").textContent = t(q.offline ? "gpuSleep" : "gpuOnline");
  $("gpu-status").classList.toggle("asleep", q.offline);
  $("gpu-util").textContent = `${Math.round(util * 100)}%`;
  $("gpu-util-bar").style.width = `${(util * 100).toFixed(1)}%`;
  $("gpu-effective").textContent = `${Math.round(getEffectiveCompute(gpu, util))} TFLOPS`;
  $("gpu-sleep-note").hidden = !q.offline;
}

function setupGPU() {
  const pick = (e) => {
    const el = e.target.closest("[data-gen]");
    if (!el) return;
    const gen = Number(el.dataset.gen);
    gpuSelected = gen === getCurrentGPU(Date.now()).generation ? null : gen;
    if (draft) render(draft);
  };
  $("gpu-timeline").addEventListener("click", pick);
  $("gpu-gen-detail").addEventListener("click", pick);
}

if (typeof document !== "undefined") setupGPU();
