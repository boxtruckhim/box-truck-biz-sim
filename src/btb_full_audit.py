#!/usr/bin/env python3
"""
Box Truck Boss — Full Ecosystem Correlation Audit
Covers:  App.jsx · RoadReady.jsx · DOTInspection.jsx · BreakdownCinematic.jsx
         HOSPuzzle.jsx · HOSRuleEngine.js · HOSScenarios.js
         HOSScenarioGenerator.js · iapPacks.js · main.jsx
         + HOSRuleEngine_test.js (test runner)
"""
import subprocess, re, sys, os, json

FILES = [
    'App.jsx', 'RoadReady.jsx', 'DOTInspection.jsx', 'BreakdownCinematic.jsx',
    'HOSPuzzle.jsx', 'HOSRuleEngine.js', 'HOSRuleEngine_test.js',
    'HOSScenarios.js', 'HOSScenarioGenerator.js',
    'iapPacks.js', 'main.jsx',
]

src = {}
for f in FILES:
    try:
        with open(f) as fh: src[f] = fh.read()
    except FileNotFoundError as e:
        print(f"ERROR: {e}"); sys.exit(1)

passes = 0; fails = 0; warnings = 0
findings = []

def ck(name, ok, detail='', severity='FAIL'):
    """severity: PASS / FAIL / WARN / INFO"""
    global passes, fails, warnings
    if ok:
        passes += 1
        sym = '✓'
    elif severity == 'WARN':
        warnings += 1
        findings.append(('WARN', name, detail))
        sym = '⚠'
    else:
        fails += 1
        findings.append(('FAIL', name, detail))
        sym = '✗'
    pad = name.ljust(60)
    print(f"  {sym} {pad} {detail}" if detail else f"  {sym} {name}")

def section(title):
    print(f"\n── {title} {'─'*max(0, 70-len(title))}")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 1 · esbuild EXIT:0 (already verified above, re-run for record)║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("1. esbuild EXIT:0 — every file")
for f in FILES:
    ldr = '--loader:.jsx=jsx' if f.endswith('.jsx') else ''
    r = subprocess.run(
        f"./node_modules/.bin/esbuild --bundle=false {ldr} --format=esm --target=es2020 {f} --outfile=/tmp/check.js",
        shell=True, capture_output=True, text=True
    )
    ok = r.returncode == 0
    err = r.stderr.split('\n')[0][:80] if not ok else ''
    ck(f"esbuild:{f}", ok, err)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 2 · Defect ID severity convention (B-1 fixed via Option 2)    ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("2. Defect ID ↔ severity contract (B-1 Option 2 — richer payload)")

# Phase 4.0M B-1 fix: RoadReady emits {id, severity} objects, not bare strings.
# Verify both emit sites are using the new payload shape.
rr_emit_pattern = re.compile(r"defectsFound:\s+foundDefects\.map\(d => \(\{ id: d\.id, severity: d\.severity \}\)\)")
rr_emits_handle_finish = bool(rr_emit_pattern.search(src['RoadReady.jsx']))
ck("RoadReady handleFinish emits {id, severity} payload", rr_emits_handle_finish)

# handleRunCancelChoice emit
rr_emit2_pattern = re.compile(r"defectsFound:\s+foundDefects\.map\(d => \(\{ id: d\.id, severity: d\.severity \}\)\)")
matches = rr_emit2_pattern.findall(src['RoadReady.jsx'])
ck("RoadReady has 2 emit sites with {id, severity} shape (handleFinish + handleRunCancelChoice)",
   len(matches) >= 2,
   f"found {len(matches)} sites")

# App.jsx reads severity from the new shape
app_reads_severity = bool(re.search(r"d\.severity === 'OOS'", src['App.jsx']))
ck("App.jsx THS calc reads d.severity from new payload", app_reads_severity)

# Legacy heuristic must be gone
legacy_heuristic = bool(re.search(r"id\.startsWith\('oos_'\)", src['App.jsx']))
ck("App.jsx legacy oos_ heuristic eliminated",
   not legacy_heuristic,
   "STILL PRESENT" if legacy_heuristic else "absent")

# App.jsx unwrap layer — IDs persisted as strings
app_unwraps = bool(re.search(r"const unwrap = \(arr\) =>", src['App.jsx']))
ck("App.jsx unwraps payload to plain ID strings at persistence boundary",
   app_unwraps,
   "see handleRoadReadyPreTripComplete")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 3 · Component prop contracts vs App.jsx wiring               ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("3. Component import/export contract")

# Each .jsx exports default + (optional) named
for fname in ['RoadReady.jsx', 'DOTInspection.jsx', 'HOSPuzzle.jsx', 'BreakdownCinematic.jsx']:
    s = src[fname]
    has_default = bool(re.search(r'^export default \w+\s*;?', s, re.M))
    ck(f"{fname} has default export", has_default)

# App.jsx imports
imports = {
    'RoadReady':              r"import RoadReady,\s*{\s*RoadReadyTerminalOffice\s*}\s*from\s*'\./RoadReady'",
    'DOTInspection':          r"import\s+DOTInspection\s*(?:,\s*\{[^}]+\})?\s*from\s*'\./DOTInspection'",
    'HOSPuzzle':              r"import\s+HOSPuzzle\s*(?:,\s*\{[^}]+\})?\s*from\s*'\./HOSPuzzle'",
    'BreakdownCinematic':     r"import\s+BreakdownCinematic\s*from\s*'\./BreakdownCinematic'",
}
for name, pat in imports.items():
    found = bool(re.search(pat, src['App.jsx']))
    ck(f"App.jsx imports {name}", found)

# Verify HOSRuleEngine import paths are consistent
hospz_engine_import = re.search(r"from\s+'\./HOSRuleEngine\.(js|mjs)'", src['HOSPuzzle.jsx'])
test_engine_import  = re.search(r"from\s+'\./HOSRuleEngine\.(js|mjs)'", src['HOSRuleEngine_test.js'])
hospz_ext = hospz_engine_import.group(1) if hospz_engine_import else None
test_ext  = test_engine_import.group(1)  if test_engine_import  else None
ck("HOSPuzzle imports HOSRuleEngine.js",
   hospz_ext == 'js',
   f"got .{hospz_ext}" if hospz_ext != 'js' else '')
ck("Test file imports HOSRuleEngine.js (matches actual filename)",
   test_ext == 'js',
   f"got .{test_ext} but actual file is .js — RENAME or FIX IMPORT" if test_ext != 'js' else '')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 4 · Shared truckData schema across components                ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("4. truckData schema consistency")
# The fields buildTruckData() in App.jsx writes:
expected_truckData_keys = ['make','model','year','mileage','brakeType','hasLiftgate',
                            'hasAirHorn','lastDVIR','isMaintained','criticalWarnings']
for k in expected_truckData_keys:
    in_app = bool(re.search(rf"\b{k}\b\s*:", src['App.jsx']))
    ck(f"truckData.{k} written by App.jsx", in_app)

# Check what each consumer reads
for fname, cname in [('RoadReady.jsx','RoadReady'), ('DOTInspection.jsx','DOTInspection')]:
    for k in expected_truckData_keys:
        # Only flag fields the component is contractually required to read
        # Per Master Build Plan §4 + DOTInspection prop signature comments:
        # - RoadReady reads: make, model, year, mileage, brakeType, hasLiftgate, hasAirHorn, isMaintained, criticalWarnings
        # - DOTInspection reads: brakeType, hasAirHorn (others are pass-through, schema consistency)
        contracted = {
            'RoadReady': {'make','model','year','mileage','brakeType','hasLiftgate','hasAirHorn','isMaintained','criticalWarnings'},
            'DOTInspection': {'brakeType','hasAirHorn'},
        }
        if k not in contracted.get(cname, set()):
            continue
        # Match: truckData.field, truckData?.field, or destructured { field } from truckData
        pat = rf"truckData\??\.{k}\b|truckData\s*=\s*\{{[^}}]*\b{k}\b"
        consumed = bool(re.search(pat, src[fname]))
        ck(f"{cname} reads truckData.{k} (contracted)", consumed,
           '' if consumed else f"truckData.{k} expected but not consumed")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 5 · DVIR chain — RoadReady → App.jsx → DOTInspection         ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("5. DVIR chain integrity")

# RoadReady writes preTripDefectsFound via setPreTripDefectsFound prop
rr_writes_dvir = bool(re.search(r"setPreTripDefectsFound\s*\(", src['RoadReady.jsx']))
ck("RoadReady calls setPreTripDefectsFound on finish", rr_writes_dvir)

# App.jsx persists both Found + Missed
app_persists_found  = bool(re.search(r"setPreTripDefectsFound\s*\(", src['App.jsx']))
app_persists_missed = bool(re.search(r"setPreTripDefectsMissed\s*\(", src['App.jsx']))
ck("App.jsx setPreTripDefectsFound (state setter exists)",  app_persists_found)
ck("App.jsx setPreTripDefectsMissed (state setter exists)", app_persists_missed)

# DOTInspection consumes both
dot_reads_found  = bool(re.search(r"\bpreTripDefectsFound\b",  src['DOTInspection.jsx']))
dot_reads_missed = bool(re.search(r"\bpreTripDefectsMissed\b", src['DOTInspection.jsx']))
ck("DOTInspection reads preTripDefectsFound",  dot_reads_found)
ck("DOTInspection reads preTripDefectsMissed", dot_reads_missed)

# runCancelChoice flow
rr_emits_choice = bool(re.search(r"runCancelChoice\s*:", src['RoadReady.jsx']))
app_persists_choice = bool(re.search(r"setRunCancelChoice\s*\(", src['App.jsx']))
dot_reads_choice = bool(re.search(r"\brunCancelChoice\b", src['DOTInspection.jsx']))
ck("RoadReady emits runCancelChoice in onComplete payload", rr_emits_choice)
ck("App.jsx persists runCancelChoice via setRunCancelChoice", app_persists_choice)
ck("DOTInspection reads runCancelChoice (knowingly escalation)", dot_reads_choice)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 6 · runCancelChoice value enum consistency                    ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("6. runCancelChoice enum (park / cancel_repair / run_pm / run_hope)")
rc_values = ['park','cancel_repair','run_pm','run_hope']
for v in rc_values:
    rr_uses = f"'{v}'" in src['RoadReady.jsx']
    ck(f"RoadReady uses runCancelChoice='{v}'", rr_uses)
for v in rc_values:
    app_uses = f"'{v}'" in src['App.jsx']
    ck(f"App.jsx handles runCancelChoice='{v}'", app_uses)
for v in rc_values:
    dot_uses = f"'{v}'" in src['DOTInspection.jsx']
    ck(f"DOTInspection handles runCancelChoice='{v}'", dot_uses,
       '' if dot_uses else "may not need all 4 values" if v in ('cancel_repair','park') else f"missing handling", severity='WARN')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 7 · BreakdownCinematic variants ↔ App.jsx callsites           ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("7. BreakdownCinematic variant enum")
bc_variants = re.findall(r"variant\s*===\s*'(\w+)'|variant:\s*'(\w+)'", src['BreakdownCinematic.jsx'])
bc_variants = sorted(set(v for tup in bc_variants for v in tup if v))
ck("BreakdownCinematic exposes variants",
   len(bc_variants) >= 5,
   f"found: {bc_variants[:10]}")

# Calibration script declares the canonical 5
calib_variants = re.findall(r"variantHits\s*=\s*\{([^}]+)\}", src.get('calibration_per_truck.js', '')) if 'calibration_per_truck.js' in src else None
# Already loaded? It's not in FILES list — load explicitly
try:
    with open('calibration_per_truck.js') as fh:
        calib_src = fh.read()
    canonical = sorted(set(re.findall(r"variantHits\.([a-z_]+)", calib_src)))
    canonical += [m.group(1) for m in re.finditer(r"variant:\s*'(\w+)'", calib_src)]
    canonical = sorted(set(canonical))
    ck("Calibration script lists 5 canonical variants",
       set(canonical) >= {'tire','brake','engine','electrical','overheat'},
       f"canonical from calibration: {canonical}")
    ck("BreakdownCinematic supports all canonical variants",
       all(v in bc_variants for v in ['tire','brake','engine','electrical','overheat']),
       f"missing: {[v for v in ['tire','brake','engine','electrical','overheat'] if v not in bc_variants]}")
except FileNotFoundError:
    pass

# App.jsx triggers cinematic with variant prop
app_triggers_bc = re.findall(r"variant=['\"](\w+)['\"]", src['App.jsx'])
ck("App.jsx triggers BreakdownCinematic with variant",
   len(app_triggers_bc) > 0,
   f"App.jsx variant strings used: {sorted(set(app_triggers_bc))[:10]}")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 8 · Difficulty / gameDifficulty propagation                  ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("8. gameDifficulty prop propagation (Phase 4.0k-2.6)")
# App.jsx defines DIFFICULTY_MODES
defines = bool(re.search(r"const DIFFICULTY_MODES\s*=", src['App.jsx']))
ck("App.jsx defines DIFFICULTY_MODES", defines)

# Each component consumes gameDifficulty?
for fname in ['RoadReady.jsx', 'DOTInspection.jsx', 'HOSPuzzle.jsx', 'BreakdownCinematic.jsx']:
    # Count real identifier uses (exclude comment-only mentions). A line that
    # starts with `//` or `*` (after whitespace) and mentions gameDifficulty
    # is just documentation, not consumption.
    real_uses = []
    for line in src[fname].split('\n'):
        if 'gameDifficulty' not in line:
            continue
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue
        real_uses.append(line)
    consumed = len(real_uses) > 0
    passed_in_app = bool(re.search(rf"<{fname[:-4]}[^>]*gameDifficulty", src['App.jsx']))
    if passed_in_app and not consumed:
        ck(f"{fname[:-4]} consumes gameDifficulty",
           False,
           "App.jsx PASSES it but component IGNORES it (drift)",
           severity='WARN')
    elif passed_in_app and consumed:
        ck(f"{fname[:-4]} consumes gameDifficulty (passed and consumed)", True)
    elif not passed_in_app and not consumed:
        ck(f"{fname[:-4]} gameDifficulty not threaded", True, "neither passed nor consumed (consistent)")
    else:
        ck(f"{fname[:-4]} gameDifficulty status",
           True,
           "passed_in_app=False, consumed=False (mentions are comments only)" if not consumed else "")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 9 · Storage / save schema isolation                           ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("9. Save schema isolation (no game writes localStorage in delivery context)")
for fname in ['RoadReady.jsx', 'DOTInspection.jsx', 'BreakdownCinematic.jsx']:
    has_ls = bool(re.search(r"\blocalStorage\b|\bsessionStorage\b", src[fname]))
    ck(f"{fname} contains no localStorage/sessionStorage", not has_ls)
# HOSPuzzle: practice-mode only (file header line 18: "No localStorage in delivery context")
# Verify the only localStorage usage is gated to PRACTICE_KEY (practice scoreboard).
hp_ls_lines = re.findall(r".*localStorage.*", src['HOSPuzzle.jsx'])
def _is_practice_or_comment(line):
    stripped = line.strip()
    if 'PRACTICE_KEY' in line:
        return True
    # Comment markers: //, /*, *, *  (JSDoc-style multi-line block comments)
    if stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
        return True
    return False
hp_practice_only = all(_is_practice_or_comment(line) for line in hp_ls_lines)
ck("HOSPuzzle localStorage usage is practice-mode-only (PRACTICE_KEY)",
   hp_practice_only,
   f"{len(hp_ls_lines)} usages, all gated to PRACTICE_KEY or in comments" if hp_practice_only else "non-PRACTICE_KEY usage detected — investigate")
# App.jsx is allowed to use localStorage (it owns persistence)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 10 · console.* discipline                                     ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("10. console.* discipline (warn/error allowed; log must be tagged or gated)")
for fname in FILES:
    if fname in ('main.jsx', 'HOSRuleEngine_test.js', 'calibration_per_truck.js'):
        n = len(re.findall(r"\bconsole\.\w+\b", src[fname]))
        ck(f"{fname} console.* (informational)", True, f"{n} (allowed)")
        continue
    s = src[fname]
    err_warn = len(re.findall(r"\bconsole\.(error|warn)\b", s))
    log_calls = list(re.finditer(r"\bconsole\.(log|info|debug)\b", s))
    # Each log call must be either: (a) inside `if (debugMode)`, (b) tagged with [SUBSYSTEM]
    # in its first arg, (c) inside a try/catch (rare but legitimate for diagnostic logging)
    untagged_logs = []
    for m in log_calls:
        # Look at the call's first argument for a [TAG] marker
        line_end = s.find('\n', m.start())
        call_line = s[m.start():line_end]
        is_tagged = bool(re.search(r"console\.\w+\(\s*['\"`]\s*\[", call_line))
        # Look 60 chars back for debugMode gate
        ctx = s[max(0, m.start() - 60):m.start()]
        is_gated = bool(re.search(r"if\s*\(\s*debugMode\s*\)\s*$", ctx))
        if not (is_tagged or is_gated):
            line_no = s[:m.start()].count('\n') + 1
            untagged_logs.append(line_no)
    detail = f"warn/error={err_warn} (always OK), log/info/debug={len(log_calls)} ({len(log_calls)-len(untagged_logs)} tagged or gated, {len(untagged_logs)} untagged)"
    ck(f"{fname} console.* discipline",
       len(untagged_logs) == 0,
       detail + (f" — untagged at lines {untagged_logs[:5]}" if untagged_logs else ""))

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 11 · Timer cleanup discipline (ghost prevention)              ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("11. setTimeout/setInterval cleanup discipline")
for fname in ['RoadReady.jsx', 'DOTInspection.jsx', 'HOSPuzzle.jsx', 'BreakdownCinematic.jsx']:
    s = src[fname]
    timeouts = len(re.findall(r"\bsetTimeout\b", s))
    intervals = len(re.findall(r"\bsetInterval\b", s))
    clears = len(re.findall(r"\bclearTimeout\b|\bclearInterval\b", s))
    rafs = len(re.findall(r"\brequestAnimationFrame\b", s))
    cancels = len(re.findall(r"\bcancelAnimationFrame\b", s))
    ratio = (clears + cancels) / max(1, timeouts + intervals + rafs)
    ck(f"{fname} timer cleanup ratio",
       ratio > 0.0 or (timeouts + intervals + rafs == 0),
       f"timeouts={timeouts} intervals={intervals} raf={rafs} clears={clears} cancels={cancels} ratio={ratio:.2f}",
       severity='WARN' if ratio < 0.3 and (timeouts+intervals+rafs) > 0 else 'PASS')

# Specific known issue: RoadReady ghost timers (B-2 fixed)
rr_ghost_warn = bool(re.search(r"^\s+setTimeout\(\(\) => setAbWarnFlash\(false\), 2700\);?$", src['RoadReady.jsx'], re.M))
rr_ghost_alarm = bool(re.search(r"^\s+setTimeout\(\(\) => RR_SND\.lowAirAlarm\(\), 400\);", src['RoadReady.jsx'], re.M))
rr_warn_ref = bool(re.search(r"abWarnFlashTimeoutRef\.current = setTimeout", src['RoadReady.jsx']))
rr_alarm_ref = bool(re.search(r"abLowAirCueTimeoutRef\.current = setTimeout", src['RoadReady.jsx']))
ck("RoadReady B-2 abWarnFlash now ref-tracked (not a ghost timer)",
   rr_warn_ref and not rr_ghost_warn,
   "still present" if rr_ghost_warn else "ref-tracked")
ck("RoadReady B-2 lowAirAlarm now ref-tracked (not a ghost timer)",
   rr_alarm_ref and not rr_ghost_alarm,
   "still present" if rr_ghost_alarm else "ref-tracked")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 12 · React.memo wrapping discipline                           ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("12. React.memo wrapper on top-level components")
for fname in ['RoadReady.jsx', 'DOTInspection.jsx', 'HOSPuzzle.jsx', 'BreakdownCinematic.jsx']:
    # Patterns: React.memo(function Name) | memo(function Name) |
    #          export default React.memo(Name) | export default memo(Name)
    has_memo = bool(re.search(
        r"React\.memo\s*\(\s*(function\s+\w+|\w+\s*\))|memo\s*\(\s*(function\s+\w+|\w+\s*\))",
        src[fname]
    ))
    ck(f"{fname} wraps top-level in React.memo", has_memo)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 13 · WebkitTapHighlightColor discipline                       ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("13. WebkitTapHighlightColor on interactive elements")
for fname in ['RoadReady.jsx', 'DOTInspection.jsx', 'HOSPuzzle.jsx', 'BreakdownCinematic.jsx']:
    onclicks = len(re.findall(r"\bonClick\b", src[fname]))
    onpointers = len(re.findall(r"\bonPointer\w+\b", src[fname]))
    tap_clears = len(re.findall(r"WebkitTapHighlightColor", src[fname]))
    interactions = onclicks + onpointers
    ck(f"{fname} WebkitTapHighlightColor coverage",
       tap_clears > 0,
       f"interactions={interactions}, tap-clears={tap_clears}",
       severity='WARN' if interactions > 5 and tap_clears == 0 else 'PASS')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 14 · FMCSA citations consistency                              ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("14. FMCSA CFR citations cross-file")
cfrs = ['392.7','393.9','393.41','393.51','393.60','393.75','393.95','393.106','396.11','395.3']
for cfr in cfrs:
    files_with = [f for f in FILES if cfr in src[f]]
    if files_with:
        ck(f"49 CFR {cfr} cited", True, f"in {files_with}")

# Penalty figures
penalties = {
    '$1,270': 'DVIR-missing/day max',
    '$12,700': 'falsification',
    '$19,277': 'OOS operation (driver max)',
    '$19,933': 'OOS operation (carrier max)',
}
for amount, label in penalties.items():
    files_with = [f for f in FILES if amount in src[f]]
    ck(f"Penalty {amount} ({label})",
       len(files_with) > 0,
       f"in {files_with}" if files_with else "not cited anywhere",
       severity='INFO' if files_with else 'WARN')

# 2025 CVSA Roadcheck stats
stats = ['18.1%', '21.4%', '41%']
for s in stats:
    files_with = [f for f in FILES if s in src[f]]
    ck(f"CVSA stat {s}",
       len(files_with) > 0,
       f"in {files_with}" if files_with else "not cited",
       severity='INFO' if files_with else 'WARN')

# 2026 CSA category
files_dobs = [f for f in FILES if 'Driver Observed' in src[f]]
ck("2026 CSA 'Driver Observed' category mentioned",
   len(files_dobs) > 0,
   f"in {files_dobs}" if files_dobs else "not mentioned",
   severity='INFO' if files_dobs else 'WARN')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 15 · Hours-of-Service shared constants                        ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("15. HOS shared constants (49 CFR 395.3)")
hos_constants = {
    '11-hour driving limit': r'\b(?:660|11\s*[-]?\s*hour|11h)\b',
    '14-hour on-duty window': r'\b(?:840|14\s*[-]?\s*hour|14h)\b',
    '30-min break': r'\b(?:30\s*[-]?\s*min|480)\b',
    '60/70-hour weekly': r'\b(?:60.*70|3600|4200)\b',
    '34-hour restart': r'\b(?:34\s*[-]?\s*hour|2040)\b',
    '150 air mile': r'150\s*air\s*mile',
}
for label, pat in hos_constants.items():
    matches = []
    for f in ['HOSRuleEngine.js', 'HOSPuzzle.jsx', 'HOSScenarios.js', 'App.jsx', 'RoadReady.jsx']:
        if re.search(pat, src[f], re.I):
            matches.append(f)
    ck(f"HOS constant: {label}",
       len(matches) > 0,
       f"in {matches}")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 16 · DVIR severity tier consistency                           ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("16. Severity tier vocabulary across files")
sev_tiers = ['OOS', 'Warning', 'Critical']
for tier in sev_tiers:
    files_with = [f for f in FILES if re.search(rf"['\"]?\b{tier}\b['\"]?", src[f])]
    ck(f"Severity tier '{tier}' used",
       len(files_with) >= 2,
       f"in {files_with[:6]}",
       severity='INFO')

# Check that the THS_CONFIG.DELTA distinguishes OOS vs Warning misses
ths_delta_oos = bool(re.search(r"OOS_MISSED", src['App.jsx']))
ths_delta_warn = bool(re.search(r"WARN_MISSED", src['App.jsx']))
ck("App.jsx THS_CONFIG.DELTA.OOS_MISSED_MIN exists",  ths_delta_oos)
ck("App.jsx THS_CONFIG.DELTA.WARN_MISSED_MIN exists", ths_delta_warn)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 17 · onComplete payload field shapes                         ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("17. onComplete payload field consistency")
# RoadReady emits these fields:
rr_fields = ['outcome', 'cashEarned', 'csaImpact', 'defectsFound', 'defectsMissed', 'runCancelChoice', 'reputationImpact']
for field in rr_fields:
    rr_emits = bool(re.search(rf"\b{field}\s*[:=]", src['RoadReady.jsx']))
    app_handles = bool(re.search(rf"\b{field}\b", src['App.jsx']))
    if rr_emits and app_handles:
        ck(f"RoadReady→App: {field}", True)
    elif rr_emits and not app_handles:
        ck(f"RoadReady→App: {field}", False, "RoadReady emits but App.jsx doesn't read")
    elif not rr_emits and app_handles:
        ck(f"RoadReady→App: {field}", False, "App.jsx reads but RoadReady doesn't emit",
           severity='WARN')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 18 · Outcome enum consistency                                 ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("18. outcome enum values")
outcomes = ['clean', 'defect_found', 'defect_missed', 'incomplete']
for o in outcomes:
    rr_uses = f"'{o}'" in src['RoadReady.jsx']
    ck(f"RoadReady emits outcome='{o}'",
       rr_uses,
       '' if rr_uses else "(may be unused channel)",
       severity='WARN' if not rr_uses and o == 'incomplete' else 'PASS')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 19 · Layer 2 / RoadReadyTerminalOffice surfaces              ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("19. RoadReady Layer 2 / Terminal Office")
layer2_built = bool(re.search(r"const DIAGNOSIS_POOL\s*=", src['RoadReady.jsx']))
ck("RoadReady Layer 2 DIAGNOSIS_POOL exists", layer2_built)

# Build Plan v2 §2.2 said it was stubbed — verify count
diag_entries = len(re.findall(r"id:\s*'diag_(?:smell|sound)_", src['RoadReady.jsx']))
ck("RoadReady Layer 2 entries (Build Plan claims 'stubbed')",
   diag_entries >= 12,
   f"actual count: {diag_entries} entries (Build Plan v2 §2.2 doc is stale)",
   severity='INFO')

tier_selector_built = bool(re.search(r"const TIER_ORDER\s*=\s*\['guided'", src['RoadReady.jsx'])) \
                       and bool(re.search(r"const TIER_REPRESENTATIVE_LEVEL", src['RoadReady.jsx'])) \
                       and bool(re.search(r"if \(view === 'practice'\)", src['RoadReady.jsx']))
ck("RoadReadyTerminalOffice tier picker built (C-1)",
   tier_selector_built,
   "Tier picker missing — RoadReadyTerminalOffice still shows 'Coming Soon' only" if not tier_selector_built else "Picker + practice mount + tier mapping all present")

# Verify the old COMING-SOON-only stub is gone
old_stub_present = bool(re.search(r"TERMINAL OFFICE · EXPERT CHALLENGE", src['RoadReady.jsx']))
ck("Old TerminalOffice stub copy removed (no 'EXPERT CHALLENGE' badge)",
   not old_stub_present,
   "Old badge still present" if old_stub_present else "removed")

# Verify Layer 3 'Coming Soon' is preserved as footer
layer3_footer = bool(re.search(r"DOT inspection roleplay · Coming soon", src['RoadReady.jsx']))
ck("Layer 3 'Coming Soon' preserved as footer (Phase 2 stub intact)",
   layer3_footer)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 20 · BreakdownCinematic costs vs calibration                  ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("20. Breakdown calibration alignment")
# calibration_per_truck.js targets MAX_MAJOR_REPAIRS_PER_YEAR = 4
calib_max = bool(re.search(r"MAX_MAJOR_REPAIRS_PER_YEAR\s*=\s*4", src.get('App.jsx', '')))
ck("App.jsx defines MAX_MAJOR_REPAIRS_PER_YEAR = 4 (calibration target)",
   calib_max,
   "matches calibration_per_truck.js comment" if calib_max else "calibration script assumes this — VERIFY",
   severity='WARN' if not calib_max else 'PASS')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 21 · BreakdownCinematic prop forwarding (B-5 fix)             ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("21. BreakdownCinematic prop forwarding (B-5)")
# Find the JSX render site
bc_render_match = re.search(r"<BreakdownCinematic\b([\s\S]*?)/>", src['App.jsx'])
if bc_render_match:
    bc_jsx = bc_render_match.group(1)
    expected_props = ['variant', 'truckId', 'truckData', 'costs', 'formatCurrency',
                      'playSFX', 'isReoccurrence', 'level', 'prestigeLevel',
                      'currentDay', 'cash', 'csaScore', 'preTripWarningDays',
                      'addNotification', 'onResolve', 'onClose']
    for p in expected_props:
        passed = bool(re.search(rf"\b{p}\s*=", bc_jsx))
        ck(f"App.jsx → BC: {p} forwarded", passed)
else:
    ck("App.jsx → BC: render site located", False)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 22 · DVIR chain translation map (B-7 fix)                     ║
# ╚═══════════════════════════════════════════════════════════════════════╝
section("22. DVIR chain RR→DOT translation map (B-7)")
has_map = bool(re.search(r"const RR_TO_DOT_DEFECT_MAP\s*=\s*\{", src['DOTInspection.jsx']))
ck("DOTInspection defines RR_TO_DOT_DEFECT_MAP", has_map)
has_helper = bool(re.search(r"function rrIdToDotId\(", src['DOTInspection.jsx']))
ck("DOTInspection defines rrIdToDotId() helper", has_helper)
# All 4 lookup sites use the helper
helper_uses = len(re.findall(r"rrIdToDotId\(", src['DOTInspection.jsx']))
ck("Translation helper used at all expected sites (≥4)",
   helper_uses >= 4,
   f"{helper_uses} call sites")
# Verify B-7 Part B pool extensions
for new_id in ['docs_dvir_unsigned', 'docs_medical_card', 'safety_extinguisher', 'suspension_leaf_broken']:
    in_pool = bool(re.search(rf"id:\s*'{new_id}'", src['DOTInspection.jsx']))
    ck(f"DOT pool extended with '{new_id}'", in_pool)
# Verify these new IDs are in the map
for rr_id, dot_id in [('prev_dvir', 'docs_dvir_unsigned'),
                      ('med_card', 'docs_medical_card'),
                      ('fire_ext', 'safety_extinguisher'),
                      ('region_1776109026005', 'suspension_leaf_broken')]:
    in_map = bool(re.search(rf"'{rr_id}':\s*'{dot_id}'", src['DOTInspection.jsx']))
    ck(f"Map row: {rr_id} → {dot_id}", in_map)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 23 · Constant-scope guard                                      ║
# ╚═══════════════════════════════════════════════════════════════════════╝
# Phase 4.0M Hotfix 4 — catch SCREAMING_SNAKE_CASE constants declared inside
# .forEach()/.map()/.filter() callbacks but referenced outside the callback.
# This is exactly the class of bug that hit MAX_MAJOR_REPAIRS_PER_YEAR:
# declared inside processRepairs's per-truck forEach, referenced from endDay's
# deferred-repair recurrence engine in a sibling scope. The endDay try/catch
# silently swallowed the ReferenceError, killing the sim before the wrap-up
# effect could fire — which is why the debrief never appeared.
section("23. Constant scope guard (callback-nested SCREAMING_SNAKE_CASE)")
def find_enclosing_callback_range(lines, decl_idx):
    """Return (open_idx, close_idx) of the nearest enclosing forEach/map/filter
    callback whose body brace-balances ENCLOSES decl_idx, or None."""
    # Walk backward looking for `.forEach((...) => {` or `.map((...) => {` etc.
    for j in range(decl_idx - 1, max(-1, decl_idx - 200), -1):
        s = lines[j]
        if not re.search(r'\.(?:forEach|map|filter|reduce|some|every)\(.*=>\s*\{', s):
            continue
        # Found one. Now brace-walk forward from j to find its matching close.
        depth = 0
        # Count open braces on this line starting AFTER the => {
        # We approximate by counting all { and } on each line from j forward.
        first = True
        for k in range(j, len(lines)):
            opens = lines[k].count('{')
            closes = lines[k].count('}')
            if first:
                # The first { we find on or after the arrow opens this scope.
                # Use a simpler approximation: from line j, depth starts at 0,
                # we add opens-closes per line, look for first time depth returns to 0.
                first = False
            depth += opens - closes
            if depth <= 0 and k > j:
                # Closed
                if j <= decl_idx <= k:
                    return (j, k)
                break
    return None

app_lines = src['App.jsx'].split('\n')
nested_decls = []
for i, line in enumerate(app_lines):
    m = re.match(r'^\s+const ([A-Z][A-Z0-9_]{3,})\s*=', line)
    if not m: continue
    ident = m.group(1)
    cb = find_enclosing_callback_range(app_lines, i)
    if not cb: continue
    cb_open, cb_close = cb
    # Find uses outside [cb_open, cb_close].
    use_lines_outside = []
    for k, useline in enumerate(app_lines):
        if cb_open <= k <= cb_close: continue  # inside the callback - safe
        if k == i: continue
        if re.search(rf'\b{ident}\b', useline):
            use_lines_outside.append(k + 1)
    if use_lines_outside:
        nested_decls.append((ident, i + 1, cb_open + 1, use_lines_outside[:3]))

if nested_decls:
    for ident, dln, cbln, uses in nested_decls[:5]:
        ck(f"App.jsx {ident} declared inside callback at L{cbln} but used at L{uses}",
           False, f"likely ReferenceError when reached", severity='FAIL')
else:
    ck("No SCREAMING_SNAKE_CASE constants nested inside callback closures with external uses", True)

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 24 · EOD_WORKFLOW invariants                                   ║
# ╚═══════════════════════════════════════════════════════════════════════╝
# Phase 4.0M Hotfix 5 — End-of-day workflow has a single source of truth
# at module scope (EOD_WORKFLOW). These checks ensure:
#   (a) The constant exists and is frozen.
#   (b) eodCompare and eodTypeOf helpers exist.
#   (c) Debrief is the highest phase (5) — guarantees it drains last from
#       the day's mid-flight items (Phase 1-3 fire BEFORE it).
#   (d) No orphan POPUP_PRIORITY maps remain in App.jsx (would mean someone
#       added a new ordering site and forgot to use eodCompare).
#   (e) No queue.unshift sites remain (drainer is priority-aware now —
#       insertion order shouldn't matter; unshift was a workaround from
#       the FIFO era).
section("24. EOD_WORKFLOW invariants")
app_src = src['App.jsx']

# (a) Constant exists & is frozen
ck("EOD_WORKFLOW declared at module scope",
   bool(re.search(r'^const EOD_WORKFLOW\s*=\s*Object\.freeze\(\[', app_src, re.M)))
ck("EOD_LOOKUP declared", "const EOD_LOOKUP = Object.freeze(" in app_src)

# (b) Helper functions exist
ck("eodTypeOf helper exists", bool(re.search(r'function eodTypeOf\b', app_src)))
ck("eodCompare helper exists", bool(re.search(r'function eodCompare\b', app_src)))

# (c) Debrief at phase 5 (last)
m_debrief = re.search(r"\{\s*type:\s*'debrief'\s*,\s*phase:\s*(\d+)", app_src)
ck("Debrief is at phase 5 (last)",
   m_debrief is not None and m_debrief.group(1) == '5',
   f"actual phase: {m_debrief.group(1) if m_debrief else 'NOT FOUND'}",
   severity='FAIL')

# (d) No inline POPUP_PRIORITY maps (other than EOD_WORKFLOW itself)
priority_map_sites = re.findall(r'^\s+const POPUP_PRIORITY\s*=', app_src, re.M)
ck("No inline POPUP_PRIORITY maps in App.jsx",
   len(priority_map_sites) == 0,
   f"{len(priority_map_sites)} stragglers found")
priority_drain_sites = re.findall(r'^\s+const POPUP_DRAIN_PRIORITY\s*=', app_src, re.M)
ck("No POPUP_DRAIN_PRIORITY constant in App.jsx",
   len(priority_drain_sites) == 0,
   f"{len(priority_drain_sites)} stragglers found")

# (e) No deferredPopupsRef.current.unshift sites
unshift_count = len(re.findall(r'deferredPopupsRef\.current\.unshift\b', app_src))
ck("No deferredPopupsRef.current.unshift sites (drainer is priority-aware)",
   unshift_count == 0,
   f"{unshift_count} unshift sites still present")

# (f) Every push site uses a known type from EOD_WORKFLOW
known_types = set(m.group(1) for m in re.finditer(
    r"\{\s*type:\s*'([a-zA-Z][a-zA-Z0-9_]*)'", app_src
) if "phase:" in app_src[m.start():m.start()+200])
# Re-derive cleanly from the EOD_WORKFLOW block specifically
m_block = re.search(r'const EOD_WORKFLOW\s*=\s*Object\.freeze\(\[(.*?)\]\)', app_src, re.S)
if m_block:
    known_types = set(re.findall(r"type:\s*'([a-zA-Z][a-zA-Z0-9_]*)'", m_block.group(1)))
else:
    known_types = set()
push_types = set()
for m in re.finditer(r"deferredPopupsRef\.current\.push\((.+?)\)", app_src):
    arg = m.group(1).strip()
    # 'pnl' or 'digest' or 'mcCertificate' or { type: 'foo', ...
    sm = re.match(r"^'([a-zA-Z_][a-zA-Z0-9_]*)'", arg) or re.match(
        r"^\{\s*type:\s*'([a-zA-Z_][a-zA-Z0-9_]*)'", arg)
    if sm:
        push_types.add(sm.group(1))
unknown_pushes = push_types - known_types
ck("All deferredPopupsRef.current.push types are in EOD_WORKFLOW",
   len(unknown_pushes) == 0,
   f"unknown push types: {sorted(unknown_pushes)}")

# (g) Drainer's switch covers every type in EOD_WORKFLOW
# Find the advancePostDebriefQueue function block
adv_match = re.search(
    r'const advancePostDebriefQueue\s*=\s*\(\)\s*=>\s*\{(.+?)^\s*\};\s*$',
    app_src, re.M | re.S
)
if adv_match:
    drainer_body = adv_match.group(1)
    case_types = set(re.findall(r"case\s+'([a-zA-Z_][a-zA-Z0-9_]*)':", drainer_body))
    missing_cases = known_types - case_types
    # Allow 'weatherResume' and 'storyEvent' to be optional if not handled,
    # but verify SAFETY+PEOPLE+MILESTONE+FINANCIAL+DEBRIEF are all present.
    critical_types = {'crisis', 'dotInspection', 'breakdown', 'driverLifeEvent',
                      'driverEvent', 'scenario', 'pnl', 'tax', 'digest', 'debrief'}
    missing_critical = critical_types - case_types
    ck("Drainer's switch handles all critical EOD_WORKFLOW types",
       len(missing_critical) == 0,
       f"missing cases: {sorted(missing_critical)}")
else:
    ck("Drainer function found for case-coverage check", False,
       "advancePostDebriefQueue regex didn't match", severity='WARN')

# (h) Sim's `blocked` check excludes items the drainer would skip mid-sim.
# The deadlock pattern: queue contains a deferred-tagged item, drainer
# skips it, but `blocked` still sees queue.length>0 → sim hangs forever.
# The fix is to compute a drainable subset that excludes deferred and
# debrief items.
# Find the sim-effect's blocked computation by looking for the canonical
# pattern (currentBreakdownEvent !== null || activeInspection !== null ||
# ...). Then verify it doesn't reference raw deferredPopupsRef.length.
blocked_block = re.search(
    r'const blocked\s*=\s*([^;]+);',
    app_src, re.S
)
if blocked_block:
    bb_body = blocked_block.group(1)
    uses_raw_length = 'deferredPopupsRef.current.length' in bb_body
    uses_drainable = 'drainableQueueLength' in bb_body
    ck("Sim's `blocked` check uses drainableQueueLength (no deadlock on deferred items)",
       uses_drainable and not uses_raw_length,
       f"raw_length_ref={uses_raw_length} drainable_ref={uses_drainable}")
else:
    ck("Sim `blocked` block found", False,
       "regex didn't match — sim effect refactored?", severity='WARN')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 25 · Closure-safe resolver pattern                             ║
# ╚═══════════════════════════════════════════════════════════════════════╝
# Phase 4.0M Hotfix 5b — auto-resolve paths during sim must pass the event
# data explicitly to bypass stale closure reads. Any resolver called via
# `setTimeout(() => resolveX(choice, next.data), 0)` from the drainer
# during sim must accept a second `providedEvent` parameter and use it
# instead of reading state.
#
# This was the actual cause of "the simulation is still getting stuck
# somewhere": resolvers were reading state from closures that hadn't
# re-rendered yet, hitting their `if (!state) return` early exit, and
# leaving isProcessingQueueRef stuck true forever. Watchdog (also added
# in 5b) would eventually unstick, but the resolver should be correct
# in the first place.
section("25. Closure-safe resolver pattern")
resolvers = [
    ('resolveCrisis',          'activeCrisis'),
    ('resolveDriverLifeEvent', 'driverLifeEvent'),
    ('resolveDriverEvent',     'activeDriverEvent'),
    ('makeChoice',             'currentScenario'),
    ('handleWeighStation',     'overweightTruck'),
]
for fname, state_name in resolvers:
    # Find the function body
    fn_match = re.search(
        rf'const {fname}\s*=\s*\(([^)]*)\)\s*=>\s*\{{(.+?)^\s*\}};',
        app_src, re.M | re.S
    )
    if not fn_match:
        ck(f"{fname} found", False, "regex match failed", severity='WARN')
        continue
    params = fn_match.group(1).strip()
    body = fn_match.group(2)
    # Must accept a second argument (provided* something).
    has_provided_param = bool(re.search(r',\s*provided[A-Z]', params))
    ck(f"{fname} accepts providedEvent argument", has_provided_param,
       f"params: ({params})")

# Also verify drainer auto-resolve sites pass next.data.
# Strip comments first so doc-comment examples don't false-trigger.
def strip_js_comments(s):
    # Remove /* ... */ block comments
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    # Remove // line comments (preserve newlines for line numbering)
    s = re.sub(r'//[^\n]*', '', s)
    return s
app_src_nocomments = strip_js_comments(app_src)
auto_resolve_calls = re.findall(
    r'setTimeout\(\s*\(\s*\)\s*=>\s*(resolveCrisis|resolveDriverLifeEvent|'
    r'resolveDriverEvent|makeChoice|handleWeighStation)\s*\(([^)]*)\)\s*,\s*0\s*\)',
    app_src_nocomments
)
unsafe_sites = [(fn, args) for fn, args in auto_resolve_calls if 'next.data' not in args]
ck(f"All drainer auto-resolve sites pass next.data",
   len(unsafe_sites) == 0,
   f"unsafe sites: {unsafe_sites[:3]}")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 26 · playSFX call/case coverage (Phase 4.0M Hotfix 6)          ║
# ╚═══════════════════════════════════════════════════════════════════════╝
# Every playSFX('foo') call site must have a defined `case 'foo':` in BOTH
# the Web Audio fallback switch AND the Tone.js primary switch. Otherwise
# the call silently does nothing on devices using that branch.
#
# This was the root cause of three pre-Hotfix-6 bugs: playSFX('alert'),
# playSFX('cash'), and playSFX('weatherAlert') were called but had no case
# in one or both branches, producing silent failures.
#
# Allowed: a case can fall through (e.g. case 'cash': case 'cashIn':) so a
# call to 'cash' is valid even though only the 'cashIn' body fires.
section("26. playSFX call/case coverage")
app_src_nc = strip_js_comments(app_src)
# Find all playSFX('foo') call sites
sfx_calls = set(re.findall(r"playSFX\(\s*'([a-zA-Z][a-zA-Z0-9]*)'\s*\)", app_src_nc))
# Find all case 'foo' definitions in the file (across both branches)
sfx_cases = set(re.findall(r"case\s+'([a-zA-Z][a-zA-Z0-9]*)'\s*:", app_src_nc))
missing = sfx_calls - sfx_cases
ck("Every playSFX call has a matching case",
   len(missing) == 0,
   f"orphan calls (no case anywhere): {sorted(missing)}" if missing else f"all {len(sfx_calls)} unique calls covered")
# Stronger check: every call has a case in BOTH branches. We split the
# playSFX function body at the boundary between the fallback and Tone.js
# switches. The fallback switch body is between
# `if (!sfxSynthsRef.current && sfxFallbackCtxRef.current)` and the comment
# marker that ends the fallback (look for `}, []);` end of useCallback —
# but actually both switches live inside the same function. Easier: find
# the two `switch (type)` (or `switch(type)`) occurrences.
switch_starts = [m.start() for m in re.finditer(r'switch\s*\(\s*type\s*\)', app_src_nc)]
if len(switch_starts) >= 2:
    # First switch is fallback, second is Tone.js
    fb_body = app_src_nc[switch_starts[0]:switch_starts[1]]
    tone_body = app_src_nc[switch_starts[1]:switch_starts[1] + 30000]  # ~30k chars covers the switch
    fb_cases = set(re.findall(r"case\s+'([a-zA-Z][a-zA-Z0-9]*)'\s*:", fb_body))
    tone_cases = set(re.findall(r"case\s+'([a-zA-Z][a-zA-Z0-9]*)'\s*:", tone_body))
    only_in_fb = sfx_calls - fb_cases - {'playSFX'}  # exclude bookkeeping
    only_in_tone = sfx_calls - tone_cases - {'playSFX'}
    ck("Fallback switch covers all calls", len(only_in_fb) == 0,
       f"missing in fallback: {sorted(only_in_fb)}" if only_in_fb else "")
    ck("Tone.js switch covers all calls", len(only_in_tone) == 0,
       f"missing in Tone.js: {sorted(only_in_tone)}" if only_in_tone else "")
else:
    ck("Two switch (type) blocks found", False,
       f"got {len(switch_starts)}; playSFX architecture changed?",
       severity='WARN')

# Also: the offending ambient loops (engineIdle/highway/loadingDock) should
# NOT have any active playAmbient call sites with `loop: true`. Stripped
# during Hotfix 6.
loop_calls = re.findall(r"playAmbient\(\s*'(engineIdle|highway|loadingDock)'\s*,\s*\{[^}]*loop\s*:\s*true",
                        app_src_nc)
ck("No surviving sim/loadboard ambient loops", len(loop_calls) == 0,
   f"loops still active: {loop_calls}" if loop_calls else "")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 28 · SFX sample wire-up integrity (Phase 4.0M Hotfix 6)        ║
# ╚═══════════════════════════════════════════════════════════════════════╝
# When sourced samples are wired in, three things must hold:
#  (a) Every key in SFX_SAMPLES must have a matching synth case in BOTH
#      switches as fallback — if the sample fails, the synth must fire.
#  (b) The sample-first logic must run BEFORE the fallback/Tone.js
#      branches in playSFX (otherwise samples never play on devices that
#      use Tone.js).
#  (c) The sample cache must be a useRef (not local state) so it survives
#      the playSFX useCallback recreations when sfxVolume changes.
section("28. SFX sample wire-up integrity")

# Extract SFX_SAMPLES keys
samples_match = re.search(r'const SFX_SAMPLES\s*=\s*\{([^}]+)\}', app_src)
if samples_match:
    sample_keys = set(re.findall(r"^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:", samples_match.group(1), re.M))
    ck("SFX_SAMPLES map found", len(sample_keys) > 0,
       f"{len(sample_keys)} sample keys: {sorted(sample_keys)}")

    # (a) Every sample key has a synth case in both branches
    if 'fb_cases' in dir() and 'tone_cases' in dir():
        # Section 26 already computed these
        missing_fb = sample_keys - fb_cases
        missing_tone = sample_keys - tone_cases
        ck("All sample keys have fallback synth cases", len(missing_fb) == 0,
           f"missing in fallback synth: {sorted(missing_fb)}" if missing_fb else "")
        ck("All sample keys have Tone.js synth cases", len(missing_tone) == 0,
           f"missing in Tone.js synth: {sorted(missing_tone)}" if missing_tone else "")
    else:
        ck("Sample/synth case correlation check", False,
           "Section 26 didn't run — re-order audit?", severity='WARN')
else:
    ck("SFX_SAMPLES map present", False,
       "no SFX_SAMPLES const found — sample wire-up missing?",
       severity='WARN')

# (b) Sample logic runs before fallback/Tone.js branches
playsfx_start = app_src.find('const playSFX = useCallback')
if playsfx_start > 0:
    body = app_src[playsfx_start:playsfx_start + 5000]
    sample_idx = body.find('SFX_SAMPLES[type]')
    fallback_idx = body.find('Web Audio API Fallback')
    tone_idx = body.find('sfxSynthsRef.current')
    if sample_idx > 0 and fallback_idx > 0:
        ck("Sample logic runs before fallback path",
           sample_idx < fallback_idx,
           f"sample @{sample_idx}, fallback @{fallback_idx}")
    if sample_idx > 0 and tone_idx > 0:
        # tone_idx finds the FIRST occurrence which is in the early-return,
        # then the actual Tone.js branch. We want sample logic before BOTH.
        ck("Sample logic precedes synth dispatch",
           sample_idx < tone_idx,
           f"sample @{sample_idx}")

# (c) Sample cache is a useRef
ck("Sample cache uses useRef",
   bool(re.search(r'sfxSampleCacheRef\s*=\s*useRef\(\{\}\)', app_src)),
   "sfxSampleCacheRef must be useRef so it persists across playSFX recreations")
ck("Failed-sample tracking uses useRef",
   bool(re.search(r'sfxSampleFailedRef\s*=\s*useRef\(', app_src)),
   "sfxSampleFailedRef must be useRef")

# Note on regression coverage (continued):
# A previous bug (L50435 `bonus.label` ReferenceError when opening the level
# panel at P6+) was a JSX panel that referenced a per-render local without
# wrapping the render block in an IIFE that bound it. Static regex scanning
# cannot reliably detect this — JS function/block scoping and hoisting are
# beyond what a single-file regex pass can model. ESLint with the
# `no-undef` rule and a JSX-aware parser would catch it; running the dev
# build (Vite + React) would catch it too. The pragmatic guard is the dev
# build itself, not this audit script.

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 26 · playSFX call coverage                                     ║
# ╚═══════════════════════════════════════════════════════════════════════╝
# Phase 4.0M Hotfix 6 — every playSFX('xxx') call must have a defined case
# in the switch statement, OR it silently produces no sound. This is how
# the alert/cash/weatherAlert typo bugs slipped in originally.
#
# Since there are TWO switch branches (Tone.js primary + Web Audio fallback),
# each call site needs coverage in BOTH. This check finds:
#   - Calls with no case in either branch (= silent on all devices)
#   - Calls with a case in only one branch (= silent on some devices)
section("26. playSFX call coverage")

# Extract all playSFX('xxx') call sites
sfx_calls = set(re.findall(r"playSFX\('([a-zA-Z][a-zA-Z0-9]*)'\)", app_src))

# Extract case definitions from both branches.
# Detect a case body by looking for 'case 'name':' that's followed (within
# a few lines) by playTone/playChord/playNoise (fallback branch) or S.xxx
# (Tone.js branch). Fall-through aliases (e.g. case 'cash': case 'cashIn':)
# are also matched.
case_defs = set()
for m in re.finditer(r"case '([a-zA-Z][a-zA-Z0-9]*)':", app_src):
    case_defs.add(m.group(1))

missing = sfx_calls - case_defs
ck(f"All playSFX call sites have a defined case",
   len(missing) == 0,
   f"silent-fail sites: {sorted(missing)[:5]}")

# Also report unused defined cases (informational warning, not failure)
unused_cases = case_defs - sfx_calls
# Filter to only cases that look SFX-related (membrane/synth/pluck/etc.
# patterns) to exclude unrelated switches in the file
sfx_case_pattern = re.compile(
    r"case '([a-zA-Z][a-zA-Z0-9]*)':[^\n]*\n(?:[^\n]*\n){0,3}"
    r"[^\n]*(playTone|playChord|playNoise|S\.\w+\.trigger)",
    re.M
)
real_sfx_cases = set(m.group(1) for m in sfx_case_pattern.finditer(app_src))
truly_unused = real_sfx_cases - sfx_calls
ck(f"Orphaned SFX cases tracked (informational)",
   True,  # always pass; this is just informational
   f"{len(truly_unused)} cases defined but never called: "
   f"{sorted(truly_unused)[:8]}{'...' if len(truly_unused) > 8 else ''}",
   severity='INFO')

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SECTION 27 · Ambient loop discipline (Phase 4.0M Hotfix 6)            ║
# ╚═══════════════════════════════════════════════════════════════════════╝
# Phase 4.0M Hotfix 6 — three ambients were KILLED because they looped
# during sim/loadboard and became grating: engineIdle, highway, loadingDock.
# This check catches any future re-introduction of those loops.
section("27. Ambient loop discipline")
loops_to_avoid = ['engineIdle', 'highway', 'loadingDock']
for loop_name in loops_to_avoid:
    pattern = rf"playAmbient\('{loop_name}'"
    found = re.findall(pattern, app_src_nocomments)
    ck(f"No playAmbient('{loop_name}') calls (killed in Hotfix 6)",
       len(found) == 0,
       f"{len(found)} re-introductions detected")

# ╔═══════════════════════════════════════════════════════════════════════╗
# ║ SUMMARY                                                                ║
# ╚═══════════════════════════════════════════════════════════════════════╝
print("\n" + "═"*72)
print(f"  RESULTS  ·  {passes} pass  ·  {fails} fail  ·  {warnings} warn")
print("═"*72)
if fails > 0 or warnings > 0:
    print("\n  FINDINGS:")
    for sev, name, detail in findings:
        print(f"    [{sev}] {name}{(': ' + detail) if detail else ''}")
print()
sys.exit(0 if fails == 0 else 1)
