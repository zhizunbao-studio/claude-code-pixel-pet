#!/usr/bin/env bash
# Installs (or with --uninstall, removes) the Claude Code pixel pet.
#
#   curl -fsSL https://raw.githubusercontent.com/zhizunbao-studio/claude-code-pixel-pet/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/zhizunbao-studio/claude-code-pixel-pet/main/install.sh | bash -s -- --uninstall
#
# It clones the plugin to ~/.claude/mods/pixel-pet and adds two entries to the
# "env" block of ~/.claude/settings.json, keeping a backup of that file.
set -euo pipefail

REPO="${PIXEL_PET_REPO:-https://github.com/zhizunbao-studio/claude-code-pixel-pet.git}"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
DEST="$CLAUDE_DIR/mods/pixel-pet"
SETTINGS="$CLAUDE_DIR/settings.json"

say() { printf '\033[38;5;173m▌\033[0m %s\n' "$*"; }
fail() { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# Edits the env block with whichever JSON-capable runtime is present.
edit_settings() { # $1 = add | remove
  local action="$1"
  local script='
import json, os, sys
path, dest, action = sys.argv[1], sys.argv[2], sys.argv[3]
settings = {}
if os.path.exists(path):
    with open(path) as f:
        text = f.read().strip()
    settings = json.loads(text) if text else {}
env = settings.setdefault("env", {})
dirs = [d for d in env.get("CLAUDE_CODE_PLUGIN_DIRS", "").split(":") if d and d != dest]
if action == "add":
    dirs.append(dest)
    env["CLAUDE_CODE_ENABLE_FUNCTION_HOOKS"] = "1"
if dirs:
    env["CLAUDE_CODE_PLUGIN_DIRS"] = ":".join(dirs)
else:
    env.pop("CLAUDE_CODE_PLUGIN_DIRS", None)
    if action == "remove":
        env.pop("CLAUDE_CODE_ENABLE_FUNCTION_HOOKS", None)
if not env:
    settings.pop("env")
with open(path, "w") as f:
    json.dump(settings, f, ensure_ascii=False, indent=2)
    f.write("\n")
'
  local node_script='
const fs = require("fs")
const [path, dest, action] = process.argv.slice(1)
let settings = {}
if (fs.existsSync(path)) {
  const text = fs.readFileSync(path, "utf8").trim()
  settings = text ? JSON.parse(text) : {}
}
const env = (settings.env ??= {})
const dirs = (env.CLAUDE_CODE_PLUGIN_DIRS ?? "").split(":").filter(d => d && d !== dest)
if (action === "add") {
  dirs.push(dest)
  env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS = "1"
}
if (dirs.length) env.CLAUDE_CODE_PLUGIN_DIRS = dirs.join(":")
else {
  delete env.CLAUDE_CODE_PLUGIN_DIRS
  if (action === "remove") delete env.CLAUDE_CODE_ENABLE_FUNCTION_HOOKS
}
if (!Object.keys(env).length) delete settings.env
fs.writeFileSync(path, JSON.stringify(settings, null, 2) + "\n")
'
  if command -v python3 >/dev/null 2>&1 && python3 -c 'import json' >/dev/null 2>&1; then
    python3 -c "$script" "$SETTINGS" "$DEST" "$action"
  elif command -v node >/dev/null 2>&1; then
    node -e "$node_script" "$SETTINGS" "$DEST" "$action"
  else
    fail "Need python3 or node to edit $SETTINGS. Add the env entries by hand (see README)."
  fi
}

backup_settings() {
  if [ -f "$SETTINGS" ]; then
    local backup
    backup="$SETTINGS.bak-$(date +%Y%m%d%H%M%S)-$$"
    cp "$SETTINGS" "$backup"
    say "Backed up settings to $backup"
  fi
}

install() {
  command -v git >/dev/null 2>&1 || fail "git is required."
  command -v claude >/dev/null 2>&1 || say "Note: the claude command was not found; install Claude Code before using the pet."

  if [ -d "$DEST/.git" ]; then
    say "Updating $DEST"
    git -C "$DEST" pull --ff-only --quiet
  elif [ -e "$DEST" ]; then
    fail "$DEST already exists and is not a git checkout. Move it away and run again."
  else
    say "Downloading to $DEST"
    mkdir -p "$(dirname "$DEST")"
    git clone --quiet --depth 1 "$REPO" "$DEST"
  fi

  mkdir -p "$CLAUDE_DIR"
  backup_settings
  edit_settings add
  say "Added the pet to $SETTINGS"
  say "Done. Open a new Claude Code session (or restart the desktop app) to meet 小克."
}

uninstall() {
  if [ -f "$SETTINGS" ]; then
    backup_settings
    edit_settings remove
    say "Removed the pet from $SETTINGS"
  fi
  if [ -d "$DEST" ]; then
    rm -rf "$DEST"
    say "Deleted $DEST"
  fi
  say "Uninstalled. New sessions start without the pet."
}

case "${1:-}" in
  --uninstall) uninstall ;;
  "") install ;;
  *) fail "Unknown option: $1 (use --uninstall to remove)" ;;
esac
