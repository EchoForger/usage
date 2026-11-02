// Usage 菜单栏程序（仿 codex-gateway 的 CodexGatewayBar）：常驻菜单栏，显示当前模型的剩余额度，点开看详情，可一键打开网页。
// 编译: swiftc -O -swift-version 5 UsageBar.swift -o usage-bar（menubar/install.py 会做完整安装）
// 调试: ./usage-bar --dump  把菜单栏文字和菜单内容打印出来，不显示界面
import Cocoa

let port = ProcessInfo.processInfo.environment["USAGE_PORT"] ?? "8765"
let base = "http://127.0.0.1:\(port)"

struct NPU: Decodable {
    let name: String
    let arch: String
    let peakTflops: Double
    let utilization: Double
    let effectiveTflops: Double
}
/// data.json 里已经保存的值（不含还没发布的点击）
struct Saved: Decodable {
    let sleep: Double
    let clarity: Double
    let desire: Double
    let left: Double?
    let leftAt: String?
}
struct Summary: Decodable {
    let saved: Saved
    let model: String
    let size: String
    let effort: String
    let sleepIndex: Int
    let total: Int
    let left: Int
    let fraction: Double
    let offline: Bool
    let now: Double
    let resetAt: Double
    let updatedAt: Double
    let unpushed: Int?  // 本地还没推送到 GitHub 的提交数；取不到时为空
    let npu: NPU
}

/// overrides：还没发布的点击，服务端只用来预览，不会写入。
func fetch(_ overrides: [String: Double] = [:], _ done: @escaping (Summary?) -> Void) {
    var url = URLComponents(string: base + "/api/summary")!
    url.queryItems = overrides.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: String($0.value)) }
    URLSession.shared.dataTask(with: URLRequest(url: url.url!, timeoutInterval: 3)) { data, _, _ in
        done(data.flatMap { try? JSONDecoder().decode(Summary.self, from: $0) })
    }.resume()
}

/// 和网页一样的保存请求：POST /api/update。Host 和 Content-Type 都是服务端校验要求的。
/// wait 为 true 时会等请求结束（退出前用），done 的参数是错误信息，成功为 nil。
func postUpdate(_ body: [String: Any], timeout: TimeInterval = 5, wait: Bool = false,
                _ done: @escaping (String?) -> Void) {
    var request = URLRequest(url: URL(string: base + "/api/update")!, timeoutInterval: timeout)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    let finished = DispatchSemaphore(value: 0)
    URLSession.shared.dataTask(with: request) { data, response, error in
        var message: String?
        if let error = error {
            message = error.localizedDescription
        } else if (response as? HTTPURLResponse)?.statusCode != 200 {
            let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
            message = json?["error"] as? String ?? "HTTP 错误"
        }
        done(message)
        finished.signal()
    }.resume()
    if wait { _ = finished.wait(timeout: .now() + timeout) }
}

struct PushState: Decodable { let state: String; let error: String? }

func fetchPushState(_ done: @escaping (PushState?) -> Void) {
    let request = URLRequest(url: URL(string: base + "/api/status")!, timeoutInterval: 3)
    URLSession.shared.dataTask(with: request) { data, _, _ in
        done(data.flatMap { try? JSONDecoder().decode(PushState.self, from: $0) })
    }.resume()
}

func duration(_ seconds: Double) -> String {
    let t = max(0, Int(seconds.rounded())), d = t / 86400, h = t % 86400 / 3600, m = t % 3600 / 60
    if d > 0 { return "\(d) 天 \(h) 小时" }
    if h > 0 { return "\(h) 小时 \(m) 分" }
    return m > 0 ? "\(m) 分钟" : "\(t) 秒"
}

let sleepLevels = ["很差", "较差", "一般", "不错", "很好"]
let sleepTokens = ["200K", "400K", "600K", "800K", "1M"]

/// 北京时间 yyyy-MM-dd HH:mm:ss，和网页上的版本戳一致
func stamp(_ epoch: Double) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
    formatter.timeZone = TimeZone(secondsFromGMT: 8 * 3600)
    return formatter.string(from: Date(timeIntervalSince1970: epoch))
}

let sizes = ["Solo", "Quartet", "Symph"]
let efforts = ["Light", "Medium", "High", "Extra high", "Ultra"]
let publishDelay = Double(ProcessInfo.processInfo.environment["USAGE_PUBLISH_DELAY"] ?? "") ?? 10  // 最后一次点击后多少秒发布

/// 取第 i 档（共 n 档）的中间值，保证服务端换算回同一档。和网页的 bucketValue 一致。
func bucketValue(_ i: Int, _ n: Int) -> Double { ((Double(i) + 0.5) / Double(n) * 100).rounded() / 100 }

/// 点击后的待发布逻辑，规则和网页一致：每次点击重新开始倒计时，最后一次点击后 publishDelay 秒内没有新点击，
/// 就用倒计时结束的时刻当版本戳，把改动 POST 到 /api/update（服务端提交并推送到 GitHub）。
final class Editor {
    var draft: [String: Double] = [:]  // 点过但还没发布的值
    var leftAtMs: Double = 0  // 点"今日剩余额度"的时刻
    var saved: Saved?
    var deadline: Date?
    var timer: Timer?
    var status: String?
    var busy = false  // 正在保存或推送
    var failed = false
    var onChange: () -> Void = {}

    /// 需要发布的改动：睡眠和剩余额度每次点击都算，其余的要和已保存的值不同才算
    func pending() -> [String: Double] {
        guard let saved = saved else { return draft }
        let current = ["sleep": saved.sleep, "clarity": saved.clarity, "desire": saved.desire]
        return draft.filter { key, value in
            key == "sleep" || key == "left" || abs(value - (current[key] ?? -1)) > 1e-9
        }
    }

    /// 菜单里显示的状态行
    var line: String? {
        if let deadline = deadline {
            return "\(max(0, Int(deadline.timeIntervalSinceNow.rounded(.up)))) 秒后发布版本 \(stamp(deadline.timeIntervalSince1970))"
        }
        return status
    }

    /// 菜单栏文字后面的小标记
    var badge: String {
        if let deadline = deadline { return " · \(max(0, Int(deadline.timeIntervalSinceNow.rounded(.up))))s" }
        return failed ? " · ⚠" : busy ? " · ↑" : ""
    }

    func edit(_ key: String, _ value: Double) {
        draft[key] = value
        if key == "left" { leftAtMs = Date().timeIntervalSince1970 * 1000 }
        status = nil
        failed = false
        timer?.invalidate()
        timer = nil
        deadline = nil
        if pending().isEmpty {
            draft = [:]
        } else {
            deadline = Date().addingTimeInterval(publishDelay)
            timer = Timer.scheduledTimer(withTimeInterval: publishDelay, repeats: false) { [weak self] _ in self?.publish() }
        }
        onChange()
    }

    /// leaving：程序要退出了，不等倒计时，马上发布并等请求结束
    func publish(leaving: Bool = false) {
        timer?.invalidate()
        timer = nil
        let changes = pending()
        let at = leaving ? Date() : (deadline ?? Date())
        deadline = nil
        draft = [:]
        guard !changes.isEmpty else { return onChange() }
        let version = stamp(at.timeIntervalSince1970)
        var body: [String: Any] = changes
        body["at"] = at.timeIntervalSince1970 * 1000
        if changes["left"] != nil { body["leftAt"] = leftAtMs }
        status = "正在保存版本 \(version)…"
        busy = true
        onChange()
        postUpdate(body, timeout: leaving ? 2 : 5, wait: leaving) { error in
            DispatchQueue.main.async {
                if let error = error {
                    self.status = "版本 \(version) 保存失败：\(error)"
                    self.busy = false
                    self.failed = true
                } else {
                    self.status = "版本 \(version) 已保存，正在推送到 GitHub…"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { self.pollPush(version) }
                }
                self.onChange()
            }
        }
    }

    func pollPush(_ version: String) {
        fetchPushState { state in
            DispatchQueue.main.async {
                guard let state = state, state.state != "pushing" else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.pollPush(version) }
                    return
                }
                self.busy = false
                if state.state == "failed" {
                    self.failed = true
                    self.status = "版本 \(version) 已保存到本地，但推送失败：\(state.error ?? "未知错误")"
                } else {
                    let done = "版本 \(version) 已发布，线上页面几分钟内更新。"
                    self.status = done
                    DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                        if self.status == done { self.status = nil; self.onChange() }
                    }
                }
                self.onChange()
            }
        }
    }
}

/// 菜单栏上的简略状态：一个圆点（在线为绿，睡眠为灰）加简称和剩余额度。
func statusTitle(_ s: Summary?, badge: String = "") -> NSAttributedString {
    let font = NSFont.systemFont(ofSize: 12, weight: .semibold)
    let result = NSMutableAttributedString()
    let online = s.map { !$0.offline } ?? false
    result.append(NSAttributedString(string: "●", attributes: [
        .font: font, .foregroundColor: online ? NSColor.systemGreen : NSColor.systemGray]))
    let text: String
    if let s = s { text = " \(s.size) " + (s.offline ? "睡眠" : "\(Int(s.fraction * 100))%") + badge } else { text = " 未运行" }
    result.append(NSAttributedString(string: text, attributes: [.font: NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium)]))
    return result
}

// MARK: - 菜单里的视图：用 AppKit 自带的控件（NSTextField、NSLevelIndicator、NSStackView）拼出来

let menuWidth: CGFloat = 320  // 菜单宽度由最宽的一项决定，其他菜单项的文字都要比这个窄，菜单才不会被撑宽

func label(_ text: String, size: CGFloat = 13, weight: NSFont.Weight = .regular,
           color: NSColor = .labelColor, digits: Bool = false) -> NSTextField {
    let field = NSTextField(labelWithString: text)
    field.font = digits ? .monospacedDigitSystemFont(ofSize: size, weight: weight) : .systemFont(ofSize: size, weight: weight)
    field.textColor = color
    field.alignment = .left
    field.lineBreakMode = .byTruncatingTail
    return field
}

func fixed(_ view: NSView, width: CGFloat) -> NSView {
    view.widthAnchor.constraint(equalToConstant: width).isActive = true
    return view
}

func flexible() -> NSView {
    let view = NSView()
    view.setContentHuggingPriority(NSLayoutConstraint.Priority(1), for: .horizontal)
    return view
}

func hstack(_ views: [NSView]) -> NSStackView {
    let stack = NSStackView(views: views)
    stack.orientation = .horizontal
    stack.alignment = .centerY
    stack.spacing = 8
    stack.widthAnchor.constraint(equalToConstant: menuWidth - 32).isActive = true  // 占满一行（左右各留 16，和普通菜单项的文字对齐）
    return stack
}

/// 进度条。用 NSLevelIndicator 而不是 NSProgressIndicator：后者在菜单这种非 key 窗口里会画成灰色。
func progressBar(_ percent: Double) -> NSLevelIndicator {
    let progress = NSLevelIndicator()
    progress.levelIndicatorStyle = .continuousCapacity
    progress.isEditable = false
    progress.minValue = 0
    progress.maxValue = 100
    progress.doubleValue = max(0, min(100, percent))
    progress.fillColor = .controlAccentColor
    progress.warningFillColor = .controlAccentColor
    progress.criticalFillColor = .controlAccentColor
    progress.setContentHuggingPriority(NSLayoutConstraint.Priority(1), for: .horizontal)
    progress.widthAnchor.constraint(greaterThanOrEqualToConstant: 120).isActive = true
    progress.heightAnchor.constraint(equalToConstant: 10).isActive = true
    return progress
}

func percentLabel(_ percent: Double) -> NSView {
    let field = label(String(format: "%.0f%%", percent), size: 12, weight: .medium, digits: true)
    field.alignment = .right
    return fixed(field, width: 38)
}

func host(_ rows: [NSView]) -> NSView {
    let stack = NSStackView(views: rows)
    stack.orientation = .vertical
    stack.alignment = .leading
    stack.spacing = 4
    stack.edgeInsets = NSEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
    stack.translatesAutoresizingMaskIntoConstraints = false
    let host = NSView(frame: NSRect(x: 0, y: 0, width: menuWidth, height: 10))
    host.addSubview(stack)
    NSLayoutConstraint.activate([
        stack.widthAnchor.constraint(equalToConstant: menuWidth),
        stack.leadingAnchor.constraint(equalTo: host.leadingAnchor),
        stack.topAnchor.constraint(equalTo: host.topAnchor),
    ])
    host.frame.size.height = stack.fittingSize.height  // 菜单项按这个高度留出位置
    return host
}

/// 模型：名称、每日额度进度条。睡眠、模型大小、推理强度在下面的子菜单里，可以直接切换。
func modelView(_ s: Summary) -> NSView {
    let light = label("●", size: 12, weight: .semibold, color: s.offline ? .systemGray : .systemGreen)
    var rows: [NSView] = [hstack([fixed(light, width: 14), label(s.model, weight: .semibold), flexible(),
                                  label(s.offline ? "睡眠中" : "在线", size: 11, weight: .medium, color: .secondaryLabelColor)])]
    rows.append(hstack([fixed(label("今日额度", size: 12, color: .secondaryLabelColor), width: 56),
                        progressBar(s.fraction * 100), percentLabel((s.fraction * 100).rounded(.down))]))
    let reset = "\(duration(s.resetAt - s.now))后" + (s.offline ? "启动" : "重置")
    rows.append(hstack([fixed(NSView(), width: 56),
                        label("\(s.left.formatted()) / \(s.total.formatted()) tokens", size: 11, color: .tertiaryLabelColor)]))
    rows.append(hstack([fixed(NSView(), width: 56), label(reset, size: 11, color: .tertiaryLabelColor)]))
    return host(rows)
}

/// 生物神经处理器：型号、架构、模拟的利用率与有效算力。
func npuView(_ s: Summary) -> NSView {
    let n = s.npu
    var rows: [NSView] = [hstack([label("NPU", size: 12, color: .secondaryLabelColor), label(n.name, weight: .semibold), flexible(),
                                  label(s.offline ? "睡眠" : "在线", size: 11, weight: .medium, color: .secondaryLabelColor)])]
    rows.append(label("\(n.arch) Neural 架构 · 峰值 \(String(format: "%g", n.peakTflops / 1000)) PFLOPS（估算）", size: 11, color: .secondaryLabelColor))
    rows.append(hstack([fixed(label("利用率", size: 12, color: .secondaryLabelColor), width: 56),
                        progressBar(n.utilization * 100), percentLabel((n.utilization * 100).rounded())]))
    rows.append(hstack([fixed(NSView(), width: 56),
                        label("有效算力 \(Int(n.effectiveTflops.rounded())) TFLOPS · 模拟值", size: 11, color: .tertiaryLabelColor)]))
    return host(rows)
}

/// 每行最多 limit 个字符，超出的换行，免得一行太长把整个菜单撑宽
func wrapped(_ text: String, limit: Int = 30) -> String {
    var lines: [String] = [], line = ""
    for ch in text {
        if line.count >= limit { lines.append(line); line = "" }
        line.append(ch)
    }
    return (lines + [line]).joined(separator: "\n")
}

func textItem(_ text: String, color: NSColor) -> NSMenuItem {
    let item = NSMenuItem()
    item.attributedTitle = NSAttributedString(string: wrapped(text), attributes: [.font: NSFont.menuFont(ofSize: 0), .foregroundColor: color])
    item.isEnabled = false  // 只是展示；带颜色的富文本在禁用状态下也不会变灰
    return item
}

final class Bar: NSObject, NSMenuDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let menu = NSMenu()
    let editor = Editor()
    var last: Summary?

    override init() {
        super.init()
        item.button?.image = nil
        item.button?.toolTip = "Haonan 额度与状态"
        menu.delegate = self
        item.menu = menu
        editor.onChange = { [weak self] in self?.refresh() }
        refresh()
        Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in self?.refresh() }
        // 倒计时每秒更新菜单栏上的标记，不需要请求服务端
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            if self?.editor.deadline != nil { self?.updateTitle() }
        }
    }

    /// 带上还没发布的点击去取数据，菜单栏和菜单马上显示点击后的预览
    func refresh() {
        fetch(editor.draft) { s in DispatchQueue.main.async { self.apply(s) } }
    }

    func apply(_ s: Summary?) {
        last = s
        editor.saved = s?.saved
        updateTitle()
    }

    func updateTitle() {
        item.button?.attributedTitle = statusTitle(last, badge: editor.badge)
    }

    // 菜单打开前才重建内容；菜单开着的时候后台刷新不会动它
    func menuNeedsUpdate(_ menu: NSMenu) {
        fillMenu(menu, last, target: self, line: editor.line)
    }

    @objc func choose(_ sender: NSMenuItem) {
        guard let pick = sender.representedObject as? [String: Any],
              let key = pick["key"] as? String, let value = pick["value"] as? Double else { return }
        editor.edit(key, value)
    }
    @objc func openWeb() { NSWorkspace.shared.open(URL(string: base + "/")!) }
    @objc func quit() {
        if editor.deadline != nil { editor.publish(leaving: true) }  // 倒计时没走完的改动先发布
        NSApp.terminate(nil)
    }
}

/// 一个带子菜单的选项：标题里写当前值，子菜单里勾选当前档，点击就是切换。
func choiceItem(_ title: String, key: String, options: [String], values: [Double], selected: Int?,
                target: Bar?, enabled: Bool = true) -> NSMenuItem {
    let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
    let sub = NSMenu()
    for (i, option) in options.enumerated() {
        let entry = NSMenuItem(title: option, action: #selector(Bar.choose(_:)), keyEquivalent: "")
        entry.target = target
        entry.state = i == selected ? .on : .off
        entry.representedObject = ["key": key, "value": values[i]] as [String: Any]
        sub.addItem(entry)
    }
    item.submenu = sub
    item.isEnabled = enabled
    return item
}

func fillMenu(_ menu: NSMenu, _ s: Summary?, target: Bar?, line: String? = nil) {
    menu.removeAllItems()
    menu.autoenablesItems = false
    if let s = s {
        if let line = line { menu.addItem(textItem(line, color: .systemOrange)); menu.addItem(.separator()) }
        let model = NSMenuItem()
        model.view = modelView(s)
        menu.addItem(model)
        menu.addItem(.separator())
        let prefix = String(s.model.dropLast(s.size.count))  // Haonan-25.0-
        let sizeIndex = sizes.firstIndex(of: s.size)
        let effortIndex = efforts.firstIndex(of: s.effort)
        let leftSteps = (0...10).map { Double(10 - $0) / 10 }
        menu.addItem(choiceItem("昨晚睡眠：\(sleepLevels[s.sleepIndex]) · \(sleepTokens[s.sleepIndex])", key: "sleep",
                                options: zip(sleepLevels, sleepTokens).map { "\($0) · \($1)" },
                                values: (0..<5).map { Double($0) / 4 }, selected: s.sleepIndex, target: target))
        menu.addItem(choiceItem("模型大小：\(s.size)", key: "clarity", options: sizes.map { prefix + $0 },
                                values: (0..<sizes.count).map { bucketValue($0, sizes.count) }, selected: sizeIndex, target: target))
        menu.addItem(choiceItem("推理强度：\(s.offline ? "关闭" : s.effort)", key: "desire", options: efforts,
                                values: (0..<efforts.count).map { bucketValue($0, efforts.count) }, selected: effortIndex, target: target))
        menu.addItem(choiceItem(s.offline ? "今日剩余额度（睡眠中不可调）" : "今日剩余额度：\(Int(s.fraction * 100))%", key: "left",
                                options: leftSteps.map { "\(Int($0 * 100))%" }, values: leftSteps,
                                selected: leftSteps.firstIndex { abs($0 - s.fraction) < 0.05 }, target: target, enabled: !s.offline))
        menu.addItem(.separator())
        let npu = NSMenuItem()
        npu.view = npuView(s)
        menu.addItem(npu)
        menu.addItem(.separator())
        let sync = s.unpushed.map { $0 == 0 ? "已同步到 GitHub" : "\($0) 个版本未推送到 GitHub" } ?? "同步状态未知"
        menu.addItem(textItem("最近更新 \(stamp(s.updatedAt))", color: .secondaryLabelColor))
        menu.addItem(textItem(sync, color: s.unpushed == 0 ? .secondaryLabelColor : .systemOrange))
    } else {
        menu.addItem(textItem("服务没有运行（\(base)）", color: .secondaryLabelColor))
    }
    menu.addItem(.separator())
    let web = NSMenuItem(title: "打开网页", action: #selector(Bar.openWeb), keyEquivalent: "o")
    web.target = target
    let quit = NSMenuItem(title: "退出", action: #selector(Bar.quit), keyEquivalent: "q")
    quit.target = target
    menu.addItem(web)
    menu.addItem(quit)
}

func makeMenu(_ s: Summary?, target: Bar?) -> NSMenu {
    let menu = NSMenu()
    fillMenu(menu, s, target: target)
    return menu
}

var barRef: Bar?  // 给 SIGTERM 处理用
let app = NSApplication.shared
app.setActivationPolicy(.accessory)  // 不在 Dock 里显示，只留菜单栏图标
signal(SIGTERM, SIG_IGN)  // 服务退出时 launchd 发 SIGTERM；交给 DispatchSource 正常退出，免得被当成崩溃
let terminator = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
terminator.setEventHandler {
    if barRef?.editor.deadline != nil { barRef?.editor.publish(leaving: true) }  // 倒计时没走完的改动先发出去
    exit(0)
}
terminator.resume()

/// 调试用：--dump 打印菜单文字，--snapshot 路径.png 把菜单里的视图渲染成图片（深色背景）。
func texts(in view: NSView) -> [String] {
    var out: [String] = []
    if let field = view as? NSTextField { out.append(field.stringValue) }
    if let level = view as? NSLevelIndicator { out.append("[进度条 \(Int(level.doubleValue))/\(Int(level.maxValue))]") }
    view.subviews.forEach { out += texts(in: $0) }
    return out
}

func snapshot(_ menu: NSMenu, to path: String) {
    let views = menu.items.compactMap { $0.view }
    let gap: CGFloat = 8, scale: CGFloat = 2
    let height = views.reduce(0) { $0 + $1.frame.height } + CGFloat(views.count + 1) * gap
    let image = NSImage(size: NSSize(width: menuWidth * scale, height: height * scale))
    image.lockFocus()
    NSColor(white: 0.17, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: menuWidth * scale, height: height * scale).fill()
    var y = height - gap
    var windows: [NSWindow] = []
    for view in views {  // 放进屏幕外、非 key 的窗口里再渲染：和菜单里一样处于"非激活"状态
        let window = NSWindow(contentRect: view.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = view
        window.setFrameOrigin(NSPoint(x: -6000, y: -6000))
        window.orderFrontRegardless()
        windows.append(window)
    }
    RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.5))
    for view in views {
        view.appearance = NSAppearance(named: .darkAqua)
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor(white: 0.17, alpha: 1).cgColor
        view.layoutSubtreeIfNeeded()
        y -= view.frame.height
        if let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) {
            view.cacheDisplay(in: view.bounds, to: rep)
            rep.draw(in: NSRect(x: 0, y: y * scale, width: menuWidth * scale, height: view.frame.height * scale))
        }
        y -= gap
    }
    image.unlockFocus()
    if let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) {
        try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
    }
}

let args = CommandLine.arguments
if args.contains("--dump") || args.contains("--snapshot") {
    let done = DispatchSemaphore(value: 0)
    fetch { s in
        DispatchQueue.main.async {
            let menu = makeMenu(s, target: nil)
            if let i = args.firstIndex(of: "--snapshot"), i + 1 < args.count {
                snapshot(menu, to: args[i + 1])
            } else {
                print("菜单栏:" + statusTitle(s).string + "  菜单宽度: \(Int(menu.size.width))（视图宽度 \(Int(menuWidth))）")
                for item in menu.items {
                    if item.isSeparatorItem { print("----------") }
                    else if let view = item.view { print(texts(in: view).joined(separator: " | ")) }
                    else { print(item.attributedTitle?.string ?? item.title) }
                    for option in item.submenu?.items ?? [] { print("    \(option.state == .on ? "✓" : "·") \(option.title)") }
                }
            }
            done.signal()
        }
    }
    while done.wait(timeout: .now()) == .timedOut { RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05)) }
    exit(0)
}

/// 调试用：--click sleep=1 clarity=0.17 desire=0.9 left=0.65  模拟在菜单里点击（键就是 data.json 里的字段），
/// 打印状态行的变化，直到发布完成。配合 USAGE_PUBLISH_DELAY=2 缩短倒计时，USAGE_PORT 指向测试用的服务。
if let i = args.firstIndex(of: "--click") {
    let editor = Editor()
    let loaded = DispatchSemaphore(value: 0)
    fetch { editor.saved = $0?.saved; loaded.signal() }
    while loaded.wait(timeout: .now()) == .timedOut { RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05)) }
    var lastLine = ""
    editor.onChange = {
        let line = (editor.line ?? "-") + (editor.failed ? "  [failed]" : "")
        if line != lastLine { print(line); lastLine = line }
    }
    for pair in args[(i + 1)...] {
        let parts = pair.split(separator: "=")
        if parts.count == 2, let value = Double(parts[1]) { editor.edit(String(parts[0]), value) }
    }
    let end = Date(timeIntervalSinceNow: 30)
    while Date() < end && !(lastLine.contains("已发布") || lastLine.contains("失败")) && (editor.deadline != nil || editor.status != nil) {
        RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.2))
        editor.onChange()
    }
    exit(0)
}

let bar = Bar()
barRef = bar
app.run()
