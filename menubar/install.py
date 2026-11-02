#!/usr/bin/env python3
"""Build and register the Usage menu bar app (same approach as codex-gateway's `install.py menubar`).

  python3 menubar/install.py            compile, sign, register and start it
  python3 menubar/install.py uninstall  stop and remove the launchd job

The app has no RunAtLoad/KeepAlive: server.py starts it with `launchctl kickstart` and stops it
on exit, so it lives and dies with the com.wuhaonan.usage service.
"""
import os
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LABEL = "com.wuhaonan.usage-menubar"
PLIST = Path.home() / "Library/LaunchAgents" / f"{LABEL}.plist"
SRC = HERE / "UsageBar.swift"
APP = HERE / "UsageBar.app"
BIN = APP / "Contents/MacOS/usage-bar"
DOMAIN = f"gui/{os.getuid()}"
PORT = os.environ.get("USAGE_PORT", "8765")


def install():
    if not shutil.which("swiftc"):
        sys.exit("swiftc not found; install Xcode or the command line tools: xcode-select --install")
    BIN.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["swiftc", "-O", "-swift-version", "5", str(SRC), "-o", str(BIN)], check=True)
    (APP / "Contents/Info.plist").write_bytes(plistlib.dumps({
        "CFBundleIdentifier": LABEL, "CFBundleName": "Usage", "CFBundleDisplayName": "Usage",
        "CFBundleExecutable": BIN.name, "CFBundlePackageType": "APPL", "CFBundleVersion": "1",
        "CFBundleShortVersionString": "1.0", "LSUIElement": True}))  # LSUIElement: no Dock icon
    subprocess.run(["codesign", "--force", "--sign", "-", str(APP)], check=True)
    PLIST.write_bytes(plistlib.dumps({
        "Label": LABEL, "ProgramArguments": [str(BIN)],
        "ThrottleInterval": 1,  # allow quick restarts: launchd would otherwise delay a start within 10s of the last exit
        "EnvironmentVariables": {"USAGE_PORT": PORT},
        "StandardErrorPath": str(Path.home() / "Library/Logs/usage-menubar.err.log"),
    }))
    subprocess.run(["launchctl", "bootout", f"{DOMAIN}/{LABEL}"], capture_output=True)
    subprocess.run(["launchctl", "bootstrap", DOMAIN, str(PLIST)], check=True)
    subprocess.run(["launchctl", "kickstart", "-k", f"{DOMAIN}/{LABEL}"], check=True)
    print("Menu bar app is running. It now starts and quits together with the com.wuhaonan.usage service.")


def uninstall():
    subprocess.run(["launchctl", "bootout", f"{DOMAIN}/{LABEL}"], capture_output=True)
    PLIST.unlink(missing_ok=True)
    shutil.rmtree(APP, ignore_errors=True)
    print("Menu bar app removed.")


if __name__ == "__main__":
    uninstall() if sys.argv[1:] == ["uninstall"] else install()
