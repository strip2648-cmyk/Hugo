'use strict';

/* HUGO v7 host layer: Windows + WSL + Linux detection, shells and real OS control. Zero keys. */
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const config = require('../lib/config').load();
const { InputError, BlockedError, UnsupportedError } = require('../lib/errors');
let cache = null;
const DESTRUCTIVE = [
  /rm\s+-[a-z]*r[a-z]*f?\s+\/(?:\s|$)/i, /\bmkfs\b/i, /\bdd\s+if=/i, /\bformat\s+[a-z]:/i, /\bdiskpart\b/i, /\bshutdown\b/i,
  /\breboot\b/i, /\bpoweroff\b/i, /reg\s+delete/i, /Remove-Item[^\n]*-Recurse[^\n]*-Force/i, /del\s+\/[a-z]*[fs]/i,
  /rd\s+\/s/i, /git\s+push[^\n]*--force/i, /drop\s+(?:database|table)/i, /\btruncate\s+table\b/i, /:\(\)\s*\{.*\};\s*:/,
  /chmod\s+-R\s+777\s+\//i, />\s*\/dev\/sd[a-z]/i, /Stop-Computer/i, /Restart-Computer/i,
];
function isDestructive(command) {
  const hits = DESTRUCTIVE.filter((p) => p.test(String(command || ''))).map((p) => p.source);
  return { destructive: hits.length > 0, patterns: hits };
}
function decodeMaybeUtf16(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer || ''), 'utf8');
  const text = buf.toString('utf8');
  return /\u0000/.test(text) ? buf.toString('utf16le') : text;
}
function tryRun(bin, args, timeout = 8000) {
  try {
    const out = execFileSync(bin, args, { encoding: 'buffer', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, stdout: decodeMaybeUtf16(out), stderr: '' };
  } catch (error) {
    return { ok: false, stdout: error.stdout ? decodeMaybeUtf16(error.stdout) : '', stderr: error.stderr ? decodeMaybeUtf16(error.stderr) : String(error.message) };
  }
}
function isWsl() {
  if (process.platform !== 'linux') return false;
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try { return /microsoft|wsl/i.test(fs.readFileSync('/proc/version', 'utf8')); } catch { return false; }
}
function which(command) {
  if (process.platform === 'win32') { const r = tryRun('cmd.exe', ['/d', '/s', '/c', 'where ' + String(command)], 6000); return r.ok ? r.stdout.split(/\r?\n/)[0].trim() : null; }
  const r = tryRun('sh', ['-c', 'command -v ' + String(command)], 6000);
  return r.ok ? r.stdout.trim() : null;
}
function chromeCandidates() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const list = [path.join(pf, 'Google/Chrome/Application/chrome.exe'), path.join(pf86, 'Google/Chrome/Application/chrome.exe')];
    if (local) list.push(path.join(local, 'Google/Chrome/Application/chrome.exe'));
    return list.concat([path.join(pf, 'Microsoft/Edge/Application/msedge.exe'), path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'), path.join(pf, 'BraveSoftware/Brave-Browser/Application/brave.exe')]);
  }
  if (process.platform === 'darwin') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/opt/google/chrome/chrome', '/usr/bin/microsoft-edge'];
}
function detectChrome() {
  const candidates = chromeCandidates();
  const found = candidates.filter((e) => e && fs.existsSync(e));
  const fromPath = found.length ? null : which('google-chrome') || which('chromium') || which('chrome') || which('msedge');
  const home = os.homedir();
  const profiles = [];
  if (process.platform === 'win32') profiles.push(path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'Google/Chrome/User Data'));
  else if (process.platform === 'darwin') profiles.push(path.join(home, 'Library/Application Support/Google/Chrome'));
  else profiles.push(path.join(home, '.config/google-chrome'), path.join(home, '.config/chromium'), path.join(home, 'snap/chromium/common/chromium'));
  if (isWsl()) for (const u of [process.env.USER, process.env.LOGNAME].filter(Boolean)) profiles.push('/mnt/c/Users/' + u + '/AppData/Local/Google/Chrome/User Data');
  return { binary: found[0] || fromPath || null, candidates, all_found: found, profile_dir: profiles.find((e) => e && fs.existsSync(e)) || null, profile_candidates: profiles };
}
function detectWsl() {
  if (process.platform === 'win32') {
    const r = tryRun('wsl.exe', ['-l', '-q'], 10000);
    if (!r.ok) return { available: false, distros: [], default: null, note: 'wsl.exe -l -q failed: ' + String(r.stderr || '').split('\n')[0] };
    const distros = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return { available: distros.length > 0, distros, default: distros[0] || null };
  }
  if (isWsl()) return { available: true, distros: [process.env.WSL_DISTRO_NAME || 'wsl'], default: process.env.WSL_DISTRO_NAME || 'wsl', inside_wsl: true };
  return { available: false, distros: [], default: null, note: 'not Windows and not inside WSL; bash is used directly' };
}
function detectPowerShell() {
  for (const bin of (process.platform === 'win32' ? ['pwsh.exe', 'powershell.exe'] : ['pwsh'])) {
    const r = tryRun(bin, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], 12000);
    if (r.ok && r.stdout.trim()) return { available: true, binary: bin, version: r.stdout.trim().split(/\r?\n/).pop() };
  }
  return { available: false, binary: null, note: 'PowerShell is Windows-only (or pwsh)' };
}
function detectComponents() {
  const out = {};
  for (const name of ['bash', 'sh', 'git', 'curl', 'python3', 'python', 'node', 'npm', 'tesseract', 'espeak', 'espeak-ng', 'spd-say', 'xdg-open', 'scrot', 'import', 'notify-send', 'xclip', 'playerctl']) out[name] = Boolean(which(name));
  out.powershell = detectPowerShell().available;
  out.wsl = detectWsl().available;
  return out;
}
function detect(options = {}) {
  if (cache && options.refresh !== true) return cache;
  const wsl = detectWsl(); const chrome = detectChrome(); const powershell = detectPowerShell();
  const report = {
    at: new Date().toISOString(), platform: process.platform, arch: process.arch,
    is_windows: process.platform === 'win32', is_wsl: isWsl(), is_linux: process.platform === 'linux', is_mac: process.platform === 'darwin',
    hostname: os.hostname(), node: process.version, home: os.homedir(), tmp: os.tmpdir(), user: process.env.USER || process.env.USERNAME || null,
    wsl, powershell, chrome, components: detectComponents(),
  };
  report.kind = report.is_windows ? 'windows' : (report.is_wsl ? 'wsl' : (report.is_mac ? 'mac' : 'linux'));
  report.shell = report.is_windows ? 'powershell' : 'bash';
  report.summary = ['систем ' + report.kind, 'chrome ' + (chrome.binary || 'не е најден'), 'профил ' + (chrome.profile_dir || 'не е најден'), 'powershell ' + (powershell.available ? powershell.binary : 'не'), 'wsl ' + (wsl.available ? (wsl.inside_wsl ? 'во ' + wsl.default : (wsl.distros || []).join(', ')) : 'не')].join(' | ');
  cache = report;
  return report;
}
/* shells */
function assertAllowedCommand(command, options = {}) {
  const verdict = isDestructive(command);
  if (verdict.destructive && options.confirm !== true && !(config.host && config.host.allow_destructive_shell === true)) {
    throw new BlockedError('деструктивна команда бара изрична потврда', { command: String(command).slice(0, 300), patterns: verdict.patterns, hint: 'повтори со {"confirm": true}' });
  }
  return verdict;
}
function run(bin, args, options = {}) {
  const started = Date.now();
  const timeout = options.timeout_ms || (config.host && config.host.shell_timeout_ms) || 60000;
  try {
    const out = execFileSync(bin, args, { cwd: options.cwd || process.cwd(), timeout, maxBuffer: options.max_buffer || 8388608, encoding: 'buffer', input: options.input, env: { ...process.env, ...(options.env || {}) }, windowsHide: true });
    return { bin, ok: true, code: 0, stdout: decodeMaybeUtf16(out), stderr: '', ms: Date.now() - started };
  } catch (error) {
    return { bin, ok: false, code: error.status == null ? 1 : error.status, stdout: error.stdout ? decodeMaybeUtf16(error.stdout) : '', stderr: error.stderr ? decodeMaybeUtf16(error.stderr) : String(error.message), ms: Date.now() - started };
  }
}
function shell(command, options = {}) {
  assertAllowedCommand(command, options);
  if (process.platform === 'win32' && options.kind !== 'bash') return run('cmd.exe', ['/d', '/s', '/c', String(command)], options);
  return run('/bin/bash', ['-lc', String(command)], options);
}
function powershellBinary() {
  const info = detectPowerShell();
  if (!info.available) throw new UnsupportedError('PowerShell не е достапен тука', { platform: process.platform, note: info.note });
  return info.binary;
}
function powershell(script, options = {}) {
  const prefix = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $ProgressPreference="SilentlyContinue"; $ErrorActionPreference=' + (options.ignore_errors ? '"Continue"' : '"Stop"') + '; ';
  const encoded = Buffer.from(prefix + String(script), 'utf16le').toString('base64');
  return run(powershellBinary(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], options);
}
function powershellJson(script, options = {}) {
  const result = powershell('& { ' + String(script) + ' } | ConvertTo-Json -Depth 8 -Compress', options);
  if (!result.ok) return { ...result, value: null };
  const text = String(result.stdout || '').trim();
  if (!text) return { ...result, value: null };
  try { return { ...result, value: JSON.parse(text) }; } catch (error) { return { ...result, value: null, parse_error: error.message }; }
}
function wslExec(distro, script, options = {}) {
  if (process.platform !== 'win32') {
    if (isWsl()) return run('/bin/bash', ['-lc', String(script)], options);
    throw new UnsupportedError('WSL е достапен само на Windows (или стартувај HUGO внатре во WSL)');
  }
  const args = [];
  if (distro) args.push('-d', String(distro));
  args.push('--', 'bash', '-lc', String(script));
  const result = run('wsl.exe', args, options);
  if (!result.ok && /no installed distributions|WSL_E_DISTRO_NOT_FOUND/i.test(result.stderr || '')) return { ...result, hint: 'изврши „wsl --install“ еднаш од PowerShell како администратор' };
  return result;
}
function bash(script, options = {}) {
  if (process.platform === 'win32' && !isWsl()) return wslExec(null, script, options);
  return run('/bin/bash', ['-lc', String(script)], options);
}
/* paths */
function isWindowsPath(value) { return /^[a-zA-Z]:[\\/]/.test(String(value)) || /^\\\\/.test(String(value)); }
function toWslPath(winPath) {
  const m = String(winPath).match(/^([a-zA-Z]):[\\/](.*)$/);
  return m ? '/mnt/' + m[1].toLowerCase() + '/' + m[2].replace(/\\/g, '/') : String(winPath).replace(/\\/g, '/');
}
function toWindowsPath(unixPath) {
  const m = String(unixPath).match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  return m ? m[1].toUpperCase() + ':\\' + m[2].replace(/\//g, '\\') : String(unixPath);
}
function expand(input) {
  let value = String(input == null ? '' : input).trim();
  if (value === '~') value = os.homedir();
  else if (value.startsWith('~/') || value.startsWith('~\\')) value = path.join(os.homedir(), value.slice(2));
  value = value.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, name) => {
    const key = Object.keys(process.env).find((e) => e.toLowerCase() === String(name).toLowerCase());
    return key ? process.env[key] : m;
  });
  return value.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (m, name) => (process.env[name] === undefined ? m : process.env[name]));
}
function baseDir() {
  const configured = config.files && config.files.base_dir;
  return configured && configured !== 'auto' ? expand(configured) : os.homedir();
}
function resolvePath(input, options = {}) {
  if (!input || typeof input !== 'string') throw new InputError('патеката е задолжителна');
  const value = expand(input);
  const isWin = isWindowsPath(value);
  if (isWsl() && isWin) return path.normalize(toWslPath(value));
  if (!path.isAbsolute(value) && !isWin) return path.normalize(path.resolve(options.base || baseDir(), value));
  return path.normalize(value);
}
function globToRegExp(glob) {
  const esc = String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/\\\\]*').replace(/\?/g, '.').replace(/\u0000/g, '.*');
  return new RegExp('^' + esc + '$', 'i');
}
function assertAllowed(target) {
  const resolved = path.normalize(target);
  const normalized = resolved.replace(/\\/g, '/');
  for (const pattern of (config.files && config.files.deny) || []) {
    const test = expand(String(pattern)).replace(/\\/g, '/');
    if ([normalized, normalized.replace(/^[a-zA-Z]:\//, '')].some((c) => globToRegExp(test).test(c))) throw new BlockedError('патеката е блокирана од HUGO deny листата: ' + resolved, { path: resolved, pattern: test });
  }
  const roots = ((config.files && config.files.allow_roots) || ['~']).map((e) => path.normalize(expand(e)));
  if (!roots.some((root) => resolved === root || resolved.startsWith(root.endsWith(path.sep) ? root : root + path.sep))) {
    throw new BlockedError('патеката е надвор од дозволените корени (промени files.allow_roots): ' + resolved, { path: resolved, roots });
  }
  return resolved;
}
function describe(target) {
  const resolved = path.normalize(target);
  return { path: resolved, windows_path: toWindowsPath(resolved), wsl_path: toWslPath(resolved), base: baseDir(), home: os.homedir() };
}
function trashDir() {
  const configured = (config.files && config.files.trash_dir) || '.hugo/trash';
  const target = path.isAbsolute(configured) ? configured : path.join(config.root, configured);
  fs.mkdirSync(target, { recursive: true });
  return target;
}
/* OS control */
function needWindows(what) {
  if (process.platform !== 'win32') throw new UnsupportedError(what + ' е само за Windows (стартувај HUGO од PowerShell/CMD, не од WSL)', { platform: process.platform });
}
function arr(value) { return Array.isArray(value) ? value : (value ? [value] : []); }
function processes(options = {}) {
  needWindows('листа процеси');
  const result = powershellJson('Get-Process | Select-Object Id,ProcessName,@{n="CPU";e={[math]::Round($_.CPU,2)}},@{n="RAM_MB";e={[math]::Round($_.WorkingSet64/1MB,1)}},MainWindowTitle | Sort-Object -Property RAM_MB -Descending', { timeout_ms: options.timeout_ms || 30000 });
  if (!result.ok) return { ok: false, error: String(result.stderr || '').split('\n')[0], processes: [] };
  let rows = arr(result.value);
  if (options.filter) {
    const needle = String(options.filter).toLowerCase();
    rows = rows.filter((row) => String(row.ProcessName || '').toLowerCase().includes(needle) || String(row.MainWindowTitle || '').toLowerCase().includes(needle));
  }
  return { ok: true, total: rows.length, processes: rows.slice(0, Number(options.limit || 50)) };
}
function killProcess(target, options = {}) {
  needWindows('затворање процес');
  if (!target) throw new InputError('потребен е pid или име на процес');
  const selector = /^\d+$/.test(String(target)) ? '-Id ' + Number(target) : '-Name "' + String(target).replace(/"/g, '') + '"';
  const result = powershellJson('& { Stop-Process ' + selector + (options.force === false ? '' : ' -Force') + ' -ErrorAction Stop; "killed" }');
  return { ok: result.ok, killed: result.ok, target: String(target), stderr: String(result.stderr || '').trim() };
}
function windows() {
  needWindows('листа прозорци');
  const result = powershellJson('Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object Id,ProcessName,MainWindowTitle', { timeout_ms: 30000 });
  return { ok: result.ok, windows: arr(result.value) };
}
function focusWindow(titlePart) {
  needWindows('фокус на прозорец');
  const needle = String(titlePart || '').replace(/"/g, '');
  const script = '$sig = "[DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd);"; $t = Add-Type -MemberDefinition $sig -Name HugoFocus -Namespace Hugo -PassThru; $p = Get-Process | Where-Object { $_.MainWindowTitle -like "*' + needle + '*" } | Select-Object -First 1; if (-not $p) { "not-found" } else { $t::SetForegroundWindow($p.MainWindowHandle) | Out-Null; $p.MainWindowTitle }';
  const result = powershellJson(script);
  return { ok: result.ok, focused: Boolean(result.ok && result.value && result.value !== 'not-found'), title: result.value || null };
}
function open(target) {
  const raw = String(target || '').trim();
  if (!raw) throw new InputError('целта е задолжителна');
  if (process.platform === 'win32') {
    const isUrl = /^https?:\/\//i.test(raw);
    const cleaned = (!isUrl && (isWindowsPath(raw) || raw.startsWith('.') || raw.startsWith('/'))) ? expand(raw) : raw;
    const result = powershellJson('& { Start-Process "' + cleaned.replace(/"/g, '') + '"; "started" }');
    return { ok: result.ok, launched: result.ok, target: cleaned, kind: isUrl ? 'url' : 'path', stderr: String(result.stderr || '').trim() };
  }
  const opener = which('xdg-open') || which('open');
  if (!opener) throw new UnsupportedError('нема отворач (инсталирај xdg-open)');
  const result = run(opener, [raw], { timeout_ms: 15000 });
  return { ok: result.ok, launched: result.ok, target: raw, via: opener };
}
function startApp(name) {
  needWindows('стартување апликација');
  const raw = String(name || '').trim();
  if (!raw) throw new InputError('името на апликацијата е задолжително');
  const known = { notepad: 'notepad.exe', calc: 'calc.exe', explorer: 'explorer.exe', cmd: 'cmd.exe', powershell: 'powershell.exe', taskmgr: 'taskmgr.exe', paint: 'mspaint.exe', word: 'winword.exe', excel: 'excel.exe', chrome: 'chrome.exe' };
  const targetName = known[raw.toLowerCase()] || raw;
  const result = powershellJson('& { Start-Process "' + targetName.replace(/"/g, '') + '"; "started" }');
  return { ok: result.ok, started: result.ok, target: targetName };
}
function clipGet() {
  if (process.platform === 'win32') {
    const result = powershell('Get-Clipboard -Raw');
    return { ok: result.ok, text: result.ok ? result.stdout.replace(/\r?\n$/, '') : null, stderr: String(result.stderr || '').trim() };
  }
  for (const [bin, args] of [['xclip', ['-selection', 'clipboard', '-o']], ['xsel', ['-b', '-o']], ['pbpaste', []]]) {
    if (!which(bin)) continue;
    const result = run(bin, args, { timeout_ms: 8000 });
    if (result.ok) return { ok: true, text: result.stdout, via: bin };
  }
  return { ok: false, text: null, note: 'нема алатка за clipboard (инсталирај xclip)' };
}
function clipSet(text) {
  const value = String(text == null ? '' : text);
  if (process.platform === 'win32') {
    const encoded = Buffer.from(value, 'utf16le').toString('base64');
    const result = powershell('Set-Clipboard -Value ([System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("' + encoded + '"))); "ok"');
    return { ok: result.ok, chars: value.length };
  }
  for (const [bin, args] of [['xclip', ['-selection', 'clipboard']], ['xsel', ['-b', '-i']], ['pbcopy', []]]) {
    if (!which(bin)) continue;
    const result = run(bin, args, { input: value, timeout_ms: 8000 });
    if (result.ok) return { ok: true, chars: value.length, via: bin };
  }
  return { ok: false, note: 'нема алатка за clipboard' };
}
function screenshot(target) {
  const dir = target || path.join(config.root, config.browser.screenshot_dir || '.hugo/screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'host-' + Date.now() + '.png');
  if (process.platform === 'win32') {
    const escaped = file.replace(/\\/g, '\\\\');
    const script = 'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height; $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size); $bmp.Save("' + escaped + '", [System.Drawing.Imaging.ImageFormat]::Png); "saved"';
    const result = powershell(script, { timeout_ms: 45000 });
    return { ok: result.ok && fs.existsSync(file), file, bytes: fs.existsSync(file) ? fs.statSync(file).size : 0, stderr: String(result.stderr || '').trim() };
  }
  for (const [bin, args] of [['import', ['-window', 'root', file]], ['scrot', [file]], ['gnome-screenshot', ['-f', file]], ['screencapture', ['-x', file]]]) {
    if (!which(bin)) continue;
    const result = run(bin, args, { timeout_ms: 45000 });
    if (result.ok && fs.existsSync(file)) return { ok: true, file, bytes: fs.statSync(file).size, via: bin };
  }
  return { ok: false, file: null, note: 'нема алатка за екран; во Chrome користи browser_screenshot' };
}
function sendKey(code) {
  if (process.platform === 'win32') return powershell('(New-Object -ComObject WScript.Shell).SendKeys([char]' + code + '); "sent"').ok;
  if (which('pactl')) return run('pactl', ['set-sink-volume', '@DEFAULT_SINK@', { 175: '+5%', 174: '-5%', 173: 'toggle' }[code]]).ok;
  return false;
}
function volume(options = {}) {
  if (options.mute !== undefined || options.action === 'mute') return { ok: sendKey(173), action: 'mute' };
  if (options.delta === 'up' || options.delta > 0 || options.action === 'up') return { ok: sendKey(175), action: 'up' };
  if (options.delta === 'down' || options.delta < 0 || options.action === 'down') return { ok: sendKey(174), action: 'down' };
  return { ok: false, note: 'нема акција; користи yt_volume во Chrome или media_key' };
}
function say(text, options = {}) {
  const message = String(text || '').trim();
  if (!message) throw new InputError('текстот е задолжителен');
  if (process.platform === 'win32') {
    const encoded = Buffer.from(message, 'utf16le').toString('base64');
    const voice = options.voice ? '; $s.SelectVoice("' + String(options.voice).replace(/"/g, '') + '")' : '';
    const script = 'Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer' + voice + '; $s.Speak([System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("' + encoded + '"))); "spoken"';
    const result = powershell(script, { timeout_ms: 60000 });
    return { ok: result.ok, spoken: result.ok, engine: 'windows-sapi', chars: message.length, stderr: String(result.stderr || '').trim() };
  }
  if (process.platform === 'darwin') { const r = run('say', [message], { timeout_ms: 60000 }); return { ok: r.ok, spoken: r.ok, engine: 'macos-say' }; }
  for (const bin of ['espeak-ng', 'espeak', 'spd-say']) {
    if (!which(bin)) continue;
    const r = run(bin, [message], { timeout_ms: 60000 });
    if (r.ok) return { ok: true, spoken: true, engine: bin };
  }
  return { ok: false, spoken: false, note: 'нема локален TTS; HUGO користи говор во Chrome' };
}
function notify(title, text) {
  const heading = String(title || 'HUGO');
  const body = String(text || '');
  if (process.platform === 'win32') {
    const encoded = Buffer.from(body, 'utf16le').toString('base64');
    const head = Buffer.from(heading, 'utf16le').toString('base64');
    const script = 'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(6000, [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("' + head + '")), [System.Text.Encoding]::Unicode.GetString([Convert]::FromBase64String("' + encoded + '")), [System.Windows.Forms.ToolTipIcon]::Info); Start-Sleep -Seconds 6; $n.Dispose(); "shown"';
    const result = powershell('& { ' + script + ' }', { timeout_ms: 30000 });
    return { ok: result.ok, shown: result.ok, title: heading };
  }
  if (which('notify-send')) { const r = run('notify-send', [heading, body], { timeout_ms: 10000 }); return { ok: r.ok, shown: r.ok }; }
  if (process.platform === 'darwin') { const r = run('osascript', ['-e', 'display notification "' + body.replace(/"/g, "'") + '" with title "' + heading.replace(/"/g, "'") + '"']); return { ok: r.ok, shown: r.ok }; }
  return { ok: false, shown: false, note: 'нема алатка за нотификации' };
}
function mediaKey(key) {
  const map = { playpause: 179, next: 176, prev: 177, stop: 178, mute: 173, volup: 175, voldown: 174 };
  const code = map[String(key || '').toLowerCase()];
  if (!code) throw new InputError('непознато медиумско копче: ' + key);
  if (process.platform === 'win32') return { ok: powershell('(New-Object -ComObject WScript.Shell).SendKeys([char]' + code + '); "sent"').ok, key, code };
  if (which('playerctl')) {
    const cmd = { playpause: 'play-pause', next: 'next', prev: 'previous', stop: 'stop' }[String(key).toLowerCase()];
    if (cmd) { const r = run('playerctl', [cmd]); return { ok: r.ok, key, via: 'playerctl' }; }
  }
  return { ok: false, key, note: 'медиумските копчиња бараат Chrome (yt_* алатките) или playerctl' };
}
function wslList() {
  const info = detectWsl();
  return { available: info.available, inside_wsl: Boolean(info.inside_wsl), distros: info.distros || [], default: info.default || null, note: info.note || null };
}
function wslRun(distro, command, options = {}) {
  const script = String(command || '').trim();
  if (!script) throw new InputError('командата е задолжителна');
  const cwd = options.cwd ? 'cd ' + JSON.stringify(toWslPath(options.cwd)) + ' && ' : '';
  const result = wslExec(distro || null, cwd + script, { timeout_ms: options.timeout_ms || 60000, confirm: options.confirm });
  return { ok: result.ok, distro: distro || wslList().default, command: script, stdout: String(result.stdout || '').trim(), stderr: String(result.stderr || '').trim(), code: result.code, ms: result.ms, hint: result.hint || null };
}
function wslInfo(distro) {
  const target = distro || wslList().default;
  if (!target) return { available: false, note: 'нема WSL дистрибуција' };
  const probe = wslRun(target, 'uname -a; echo ---; (command -v node || echo no-node); (command -v python3 || echo no-python3); (command -v git || echo no-git)', { timeout_ms: 20000 });
  return { available: probe.ok, distro: target, home: String((wslRun(target, 'echo $HOME', { timeout_ms: 15000 }).stdout || '')).trim(), probe: probe.stdout, stderr: probe.stderr };
}
function wslRead(distro, file, options = {}) {
  const wslPath = toWslPath(file);
  const result = wslRun(distro, 'head -c ' + Number(options.max_bytes || 500000) + ' ' + JSON.stringify(wslPath), { timeout_ms: 30000 });
  return { ok: result.ok, path: wslPath, content: result.stdout, bytes: Buffer.byteLength(result.stdout || ''), stderr: result.stderr };
}
function wslWrite(distro, file, content) {
  const wslPath = toWslPath(file);
  const encoded = Buffer.from(String(content == null ? '' : content), 'utf8').toString('base64');
  const result = wslRun(distro, 'mkdir -p "$(dirname ' + JSON.stringify(wslPath) + ')" && printf %s ' + JSON.stringify(encoded) + ' | base64 -d > ' + JSON.stringify(wslPath) + ' && wc -c < ' + JSON.stringify(wslPath), { timeout_ms: 60000 });
  return { ok: result.ok, path: wslPath, bytes: Number(String(result.stdout || '0').trim()) || 0, stderr: result.stderr };
}
module.exports = {
  detect, resetCache: () => { cache = null; }, isWsl, detectWsl, detectPowerShell, which, isDestructive,
  run, shell, bash, powershell, powershellJson, powershellBinary, wslExec,
  toWslPath, toWindowsPath, isWindowsPath, expand, baseDir, resolvePath, assertAllowed, describe, trashDir, globToRegExp,
  processes, killProcess, windows, focusWindow, open, startApp, clipGet, clipSet, screenshot, volume, say, notify, mediaKey,
  wslList, wslRun, wslInfo, wslRead, wslWrite, needWindows,
};
