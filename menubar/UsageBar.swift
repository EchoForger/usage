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
struct Summary: Decodable {
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

func fetch(_ done: @escaping (Summary?) -> Void) {
    let request = URLRequest(url: URL(string: base + "/api/summary")!, timeoutInterval: 3)
    URLSession.shared.dataTask(with: request) { data, _, _ in
        done(data.flatMap { try? JSONDecoder().decode(Summary.self, from: $0) })
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

/// 菜单栏上的简略状态：一个圆点（在线为绿，睡眠为灰）加简称和剩余额度。
func statusTitle(_ s: Summary?) -> NSAttributedString {
    let font = NSFont.systemFont(ofSize: 12, weight: .semibold)
    let result = NSMutableAttributedString()
    let online = s.map { !$0.offline } ?? false
    result.append(NSAttributedString(string: "●", attributes: [
        .font: font, .foregroundColor: online ? NSColor.systemGreen : NSColor.systemGray]))
    let text: String
    if let s = s { text = " \(s.size) " + (s.offline ? "睡眠" : "\(Int(s.fraction * 100))%") } else { text = " 未运行" }
    result.append(NSAttributedString(string: text, attributes: [.font: NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium)]))
    return result
}

// MARK: - 菜单里的视图：用 AppKit 自带的控件（NSTextField、NSLevelIndicator、NSStackView）拼出来

let menuWidth: CGFloat = 300

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
    stack.widthAnchor.constraint(equalToConstant: menuWidth - 28).isActive = true  // 占满一行（左右各留 14）
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
    stack.edgeInsets = NSEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
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

func keyValue(_ key: String, _ value: String) -> NSView {
    hstack([fixed(label(key, size: 12, color: .secondaryLabelColor), width: 64), label(value, size: 12)])
}

/// 模型：名称、每日额度进度条，以及当前的睡眠、模型大小、推理强度。
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
    rows.append(keyValue("模型大小", s.size))
    rows.append(keyValue("推理强度", s.offline ? "关闭" : s.effort))
    rows.append(keyValue("昨晚睡眠", "\(sleepLevels[s.sleepIndex]) · \(sleepTokens[s.sleepIndex])"))
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

func textItem(_ text: String, color: NSColor) -> NSMenuItem {
    let item = NSMenuItem()
    item.attributedTitle = NSAttributedString(string: text, attributes: [.font: NSFont.menuFont(ofSize: 0), .foregroundColor: color])
    item.isEnabled = false  // 只是展示；带颜色的富文本在禁用状态下也不会变灰
    return item
}

final class Bar: NSObject {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

    override init() {
        super.init()
        item.button?.image = nil
        item.button?.toolTip = "Haonan 额度与状态"
        refresh()
        Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in self?.refresh() }
    }

    func refresh() {
        fetch { s in DispatchQueue.main.async { self.apply(s) } }
    }

    func apply(_ s: Summary?) {
        item.button?.attributedTitle = statusTitle(s)
        item.menu = makeMenu(s, target: self)
    }

    @objc func openWeb() { NSWorkspace.shared.open(URL(string: base + "/")!) }
    @objc func quit() { NSApp.terminate(nil) }
}

func makeMenu(_ s: Summary?, target: Bar?) -> NSMenu {
    let menu = NSMenu()
    menu.autoenablesItems = false
    if let s = s {
        let model = NSMenuItem()
        model.view = modelView(s)
        menu.addItem(model)
        menu.addItem(.separator())
        let npu = NSMenuItem()
        npu.view = npuView(s)
        menu.addItem(npu)
        menu.addItem(.separator())
        let sync = s.unpushed.map { $0 == 0 ? "已同步到 GitHub" : "\($0) 个版本未推送到 GitHub" } ?? "同步状态未知"
        menu.addItem(textItem("最近更新 \(stamp(s.updatedAt)) · \(sync)", color: s.unpushed == 0 ? .secondaryLabelColor : .systemOrange))
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
    return menu
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)  // 不在 Dock 里显示，只留菜单栏图标
signal(SIGTERM, SIG_IGN)  // 服务退出时 launchd 发 SIGTERM；交给 DispatchSource 正常退出，免得被当成崩溃
let terminator = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
terminator.setEventHandler { exit(0) }
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
                print("菜单栏:" + statusTitle(s).string)
                for item in menu.items {
                    if item.isSeparatorItem { print("----------") }
                    else if let view = item.view { print(texts(in: view).joined(separator: " | ")) }
                    else { print(item.attributedTitle?.string ?? item.title) }
                }
            }
            done.signal()
        }
    }
    while done.wait(timeout: .now()) == .timedOut { RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.05)) }
    exit(0)
}

let bar = Bar()
app.run()
