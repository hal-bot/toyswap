#!/usr/bin/env bash
# generate-dashboard.sh
#
# Runs all test suites and generates a single HTML testing dashboard.
#
# Usage:
#   ./generate-dashboard.sh            # Run all tests, generate dashboard
#   ./generate-dashboard.sh --skip-run # Generate dashboard from existing reports (skip test execution)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD="$ROOT_DIR/test-dashboard.html"
SKIP_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-run) SKIP_RUN=true ;;
  esac
done

# ── Colours for terminal ──────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Step 1: Run tests (unless --skip-run) ─────────────────────────────────────

if [ "$SKIP_RUN" = false ]; then
  echo -e "${CYAN}═══ Running Backend Unit Tests + Coverage ═══${NC}"
  (cd "$ROOT_DIR/backend" && ./mvnw -B test -q 2>&1) || true

  echo -e "${CYAN}═══ Running PIT Mutation Tests ═══${NC}"
  (cd "$ROOT_DIR" && cd backend && ./mvnw -B org.pitest:pitest-maven:mutationCoverage -q 2>&1) || true

  echo -e "${CYAN}═══ Running Frontend Unit Tests + Coverage ═══${NC}"
  (cd "$ROOT_DIR/frontend" && npx vitest run --reporter=json --outputFile=test-results.json --coverage 2>&1) || true

  echo -e "${CYAN}═══ Running Playwright E2E Tests ═══${NC}"
  (cd "$ROOT_DIR/frontend" && npx playwright test --reporter=json 2>/dev/null > playwright-results.json) || true
else
  echo -e "${YELLOW}Skipping test execution (--skip-run). Using existing reports.${NC}"
fi

# ── Step 2: Parse Backend Surefire XML ────────────────────────────────────────

echo -e "${CYAN}═══ Parsing test results ═══${NC}"

# Find surefire reports — prefer backend/target, fall back to root target
SUREFIRE_DIR="$ROOT_DIR/backend/target/surefire-reports"
if [ ! -d "$SUREFIRE_DIR" ]; then
  SUREFIRE_DIR="$ROOT_DIR/target/surefire-reports"
fi

BACKEND_JSON=$(SUREFIRE_DIR="$SUREFIRE_DIR" python3 << 'PYEOF'
import xml.etree.ElementTree as ET
import json, glob, os

surefire_dir = os.environ.get("SUREFIRE_DIR", "")
results = []
total_tests = 0
total_failures = 0
total_errors = 0
total_skipped = 0
total_time = 0.0

for xml_file in sorted(glob.glob(os.path.join(surefire_dir, "TEST-*.xml"))):
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        suite_name = root.get("name", os.path.basename(xml_file))
        tests = int(root.get("tests", 0))
        failures = int(root.get("failures", 0))
        errors = int(root.get("errors", 0))
        skipped = int(root.get("skipped", 0))
        time = float(root.get("time", 0))

        total_tests += tests
        total_failures += failures
        total_errors += errors
        total_skipped += skipped
        total_time += time

        # Extract individual test cases
        test_cases = []
        for tc in root.findall(".//testcase"):
            tc_name = tc.get("name", "unknown")
            tc_time = float(tc.get("time", 0))
            status = "passed"
            message = ""
            if tc.find("failure") is not None:
                status = "failed"
                message = tc.find("failure").get("message", "")
            elif tc.find("error") is not None:
                status = "error"
                message = tc.find("error").get("message", "")
            elif tc.find("skipped") is not None:
                status = "skipped"
            test_cases.append({"name": tc_name, "status": status, "time": round(tc_time, 3), "message": message})

        short_name = suite_name.split(".")[-1] if "." in suite_name else suite_name
        results.append({
            "suite": short_name,
            "fullName": suite_name,
            "tests": tests,
            "failures": failures,
            "errors": errors,
            "skipped": skipped,
            "time": round(time, 3),
            "testCases": test_cases
        })
    except Exception as e:
        pass

output = {
    "suites": results,
    "totals": {
        "tests": total_tests,
        "passed": total_tests - total_failures - total_errors - total_skipped,
        "failures": total_failures,
        "errors": total_errors,
        "skipped": total_skipped,
        "time": round(total_time, 3)
    }
}
print(json.dumps(output))
PYEOF
)

# ── Step 3: Parse PIT Mutation XML ────────────────────────────────────────────

PIT_DIR="$ROOT_DIR/backend/target/pit-reports"
if [ ! -f "$PIT_DIR/mutations.xml" ]; then
  PIT_DIR="$ROOT_DIR/target/pit-reports"
fi

MUTATION_JSON=$(PIT_DIR="$PIT_DIR" python3 << 'PYEOF'
import xml.etree.ElementTree as ET
import json, os
from collections import defaultdict

pit_file = os.path.join(os.environ.get("PIT_DIR", ""), "mutations.xml")
by_class = defaultdict(lambda: {"killed": 0, "survived": 0, "noCoverage": 0, "other": 0})
total = {"killed": 0, "survived": 0, "noCoverage": 0, "other": 0}
survived_details = []

if os.path.exists(pit_file):
    try:
        tree = ET.parse(pit_file)
        for m in tree.findall(".//mutation"):
            status = m.get("status", "UNKNOWN")
            cls = m.findtext("mutatedClass", "unknown")
            short_cls = cls.split(".")[-1] if "." in cls else cls
            method = m.findtext("mutatedMethod", "")
            desc = m.findtext("description", "")
            line = m.findtext("lineNumber", "")

            if status == "KILLED":
                by_class[short_cls]["killed"] += 1
                total["killed"] += 1
            elif status == "SURVIVED":
                by_class[short_cls]["survived"] += 1
                total["survived"] += 1
                survived_details.append({
                    "class": short_cls,
                    "method": method,
                    "line": line,
                    "description": desc
                })
            elif status == "NO_COVERAGE":
                by_class[short_cls]["noCoverage"] += 1
                total["noCoverage"] += 1
            else:
                by_class[short_cls]["other"] += 1
                total["other"] += 1
    except Exception:
        pass

total_mutations = sum(total.values())
mutation_score = round(total["killed"] / total_mutations * 100, 1) if total_mutations > 0 else 0

classes = []
for cls, counts in sorted(by_class.items()):
    cls_total = sum(counts.values())
    cls_score = round(counts["killed"] / cls_total * 100, 1) if cls_total > 0 else 0
    classes.append({"class": cls, **counts, "total": cls_total, "score": cls_score})

print(json.dumps({
    "total": total,
    "totalMutations": total_mutations,
    "mutationScore": mutation_score,
    "classes": classes,
    "survived": survived_details
}))
PYEOF
)

# ── Step 4: Parse Frontend Vitest JSON ────────────────────────────────────────

VITEST_FILE="$ROOT_DIR/frontend/test-results.json"

FRONTEND_JSON=$(VITEST_FILE="$VITEST_FILE" python3 << 'PYEOF'
import json, os

vitest_file = os.environ.get("VITEST_FILE", "")
output = {"suites": [], "totals": {"tests": 0, "passed": 0, "failed": 0, "skipped": 0, "time": 0}}

if os.path.exists(vitest_file):
    try:
        with open(vitest_file) as f:
            data = json.load(f)

        total_tests = 0
        total_passed = 0
        total_failed = 0
        total_skipped = 0
        total_time = 0.0

        for tf in data.get("testResults", []):
            suite_name = os.path.basename(tf.get("name", "unknown"))
            suite_time = tf.get("endTime", 0) - tf.get("startTime", 0)
            test_cases = []

            for tc in tf.get("assertionResults", []):
                status = tc.get("status", "unknown")
                tc_name = tc.get("fullName", tc.get("title", "unknown"))
                # Vitest uses "passed", "failed", "pending"
                if status == "pending":
                    status = "skipped"
                test_cases.append({"name": tc_name, "status": status})

                total_tests += 1
                if status == "passed":
                    total_passed += 1
                elif status == "failed":
                    total_failed += 1
                else:
                    total_skipped += 1

            total_time += suite_time

            output["suites"].append({
                "suite": suite_name,
                "tests": len(test_cases),
                "time": round(suite_time / 1000, 3),
                "testCases": test_cases
            })

        output["totals"] = {
            "tests": total_tests,
            "passed": total_passed,
            "failed": total_failed,
            "skipped": total_skipped,
            "time": round(total_time / 1000, 3)
        }
    except Exception:
        pass

print(json.dumps(output))
PYEOF
)

# ── Step 5: Parse Playwright JSON ─────────────────────────────────────────────

PLAYWRIGHT_FILE="$ROOT_DIR/frontend/playwright-results.json"

E2E_JSON=$(PLAYWRIGHT_FILE="$PLAYWRIGHT_FILE" python3 << 'PYEOF'
import json, os

pw_file = os.environ.get("PLAYWRIGHT_FILE", "")
output = {"suites": [], "totals": {"tests": 0, "passed": 0, "failed": 0, "skipped": 0, "time": 0}}

if os.path.exists(pw_file):
    try:
        with open(pw_file) as f:
            data = json.load(f)

        counters = {"tests": 0, "passed": 0, "failed": 0, "skipped": 0, "time": 0.0}

        def extract_tests(suite, file_name=""):
            tests = []
            fn = suite.get("file", file_name) or file_name

            for spec in suite.get("specs", []):
                for test in spec.get("tests", []):
                    for result in test.get("results", []):
                        status = result.get("status", "unknown")
                        duration = result.get("duration", 0) / 1000
                        name = spec.get("title", "unknown")
                        counters["tests"] += 1
                        counters["time"] += duration
                        if status == "passed" or status == "expected":
                            counters["passed"] += 1
                            status = "passed"
                        elif status == "skipped":
                            counters["skipped"] += 1
                        else:
                            counters["failed"] += 1
                            status = "failed"
                        tests.append({"name": name, "status": status, "time": round(duration, 3)})

            for child in suite.get("suites", []):
                tests.extend(extract_tests(child, fn))
            return tests

        for suite in data.get("suites", []):
            file_name = os.path.basename(suite.get("file", suite.get("title", "unknown")))
            test_cases = extract_tests(suite, file_name)
            if test_cases:
                output["suites"].append({
                    "suite": file_name,
                    "tests": len(test_cases),
                    "testCases": test_cases
                })

        output["totals"] = {
            "tests": counters["tests"],
            "passed": counters["passed"],
            "failed": counters["failed"],
            "skipped": counters["skipped"],
            "time": round(counters["time"], 3)
        }
    except Exception:
        pass

print(json.dumps(output))
PYEOF
)

# ── Step 6: Parse JaCoCo Coverage XML ─────────────────────────────────────────

JACOCO_FILE="$ROOT_DIR/backend/target/site/jacoco/jacoco.xml"

BACKEND_COV_JSON=$(JACOCO_FILE="$JACOCO_FILE" python3 << 'PYEOF'
import xml.etree.ElementTree as ET
import json, os

jacoco_file = os.environ.get("JACOCO_FILE", "")
output = {"packages": [], "totals": {"instruction": 0, "branch": 0, "line": 0, "method": 0, "class": 0}}

if os.path.exists(jacoco_file):
    try:
        tree = ET.parse(jacoco_file)
        root = tree.getroot()

        def parse_counters(element):
            counters = {}
            for c in element.findall("counter"):
                ctype = c.get("type", "").lower()
                missed = int(c.get("missed", 0))
                covered = int(c.get("covered", 0))
                total = missed + covered
                pct = round(covered / total * 100, 1) if total > 0 else 0
                counters[ctype] = {"covered": covered, "missed": missed, "total": total, "pct": pct}
            return counters

        # Overall totals
        overall = parse_counters(root)
        for key in ["instruction", "branch", "line", "method", "class"]:
            if key in overall:
                output["totals"][key] = overall[key]["pct"]

        # Per-package breakdown
        for pkg in root.findall("package"):
            pkg_name = pkg.get("name", "").replace("/", ".")
            counters = parse_counters(pkg)
            classes = []
            for cls in pkg.findall("class"):
                cls_name = cls.get("name", "").split("/")[-1]
                cls_counters = parse_counters(cls)
                classes.append({
                    "name": cls_name,
                    "line": cls_counters.get("line", {}).get("pct", 0),
                    "branch": cls_counters.get("branch", {}).get("pct", 0),
                    "method": cls_counters.get("method", {}).get("pct", 0),
                    "lineCov": cls_counters.get("line", {}).get("covered", 0),
                    "lineTotal": cls_counters.get("line", {}).get("total", 0),
                })
            output["packages"].append({
                "name": pkg_name,
                "line": counters.get("line", {}).get("pct", 0),
                "branch": counters.get("branch", {}).get("pct", 0),
                "method": counters.get("method", {}).get("pct", 0),
                "classes": classes,
            })
    except Exception:
        pass

print(json.dumps(output))
PYEOF
)

# ── Step 7: Parse Frontend Vitest Coverage ────────────────────────────────────

VITEST_COV_FILE="$ROOT_DIR/frontend/coverage/coverage-summary.json"

FRONTEND_COV_JSON=$(VITEST_COV_FILE="$VITEST_COV_FILE" python3 << 'PYEOF'
import json, os

cov_file = os.environ.get("VITEST_COV_FILE", "")
output = {"files": [], "totals": {"lines": 0, "branches": 0, "functions": 0, "statements": 0}}

if os.path.exists(cov_file):
    try:
        with open(cov_file) as f:
            data = json.load(f)

        # Overall totals
        total = data.get("total", {})
        for key in ["lines", "branches", "functions", "statements"]:
            if key in total:
                output["totals"][key] = total[key].get("pct", 0)

        # Per-file breakdown
        for filepath, metrics in sorted(data.items()):
            if filepath == "total":
                continue
            # Make path relative to src/
            short = filepath
            idx = filepath.find("src/")
            if idx >= 0:
                short = filepath[idx:]
            output["files"].append({
                "file": short,
                "lines": metrics.get("lines", {}).get("pct", 0),
                "branches": metrics.get("branches", {}).get("pct", 0),
                "functions": metrics.get("functions", {}).get("pct", 0),
                "statements": metrics.get("statements", {}).get("pct", 0),
            })
    except Exception:
        pass

print(json.dumps(output))
PYEOF
)

# ── Step 8: Get timestamp ────────────────────────────────────────────────────

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# ── Step 9: Generate HTML Dashboard ──────────────────────────────────────────

echo -e "${CYAN}═══ Generating dashboard ═══${NC}"

export SUREFIRE_DIR PIT_DIR VITEST_FILE PLAYWRIGHT_FILE

python3 - "$BACKEND_JSON" "$MUTATION_JSON" "$FRONTEND_JSON" "$E2E_JSON" "$TIMESTAMP" "$DASHBOARD" "$BACKEND_COV_JSON" "$FRONTEND_COV_JSON" << 'HTMLGEN'
import json, sys, html

backend = json.loads(sys.argv[1])
mutation = json.loads(sys.argv[2])
frontend = json.loads(sys.argv[3])
e2e = json.loads(sys.argv[4])
timestamp = sys.argv[5]
output_file = sys.argv[6]
backend_cov = json.loads(sys.argv[7])
frontend_cov = json.loads(sys.argv[8])

def status_icon(status):
    if status == "passed": return "✅"
    if status == "failed": return "❌"
    if status == "error": return "💥"
    if status == "skipped": return "⏭️"
    return "❓"

def score_colour(score):
    if score >= 80: return "#4caf50"
    if score >= 60: return "#ff9800"
    return "#f44336"

def pct_bar(value, max_val, colour="#4caf50"):
    pct = (value / max_val * 100) if max_val > 0 else 0
    return f'<div class="bar-bg"><div class="bar-fill" style="width:{pct:.1f}%;background:{colour}"></div></div>'

# Summary numbers
be_totals = backend["totals"]
fe_totals = frontend["totals"]
e2e_totals = e2e["totals"]
mut_score = mutation["mutationScore"]
mut_total = mutation["totalMutations"]
mut_killed = mutation["total"]["killed"]
mut_survived = mutation["total"]["survived"]

all_tests = be_totals["tests"] + fe_totals["tests"] + e2e_totals["tests"]
all_passed = be_totals["passed"] + fe_totals["passed"] + e2e_totals["passed"]
all_failed = be_totals["failures"] + be_totals.get("errors", 0) + fe_totals["failed"] + e2e_totals["failed"]

overall_status = "ALL PASSING" if all_failed == 0 else f"{all_failed} FAILING"
overall_colour = "#4caf50" if all_failed == 0 else "#f44336"

# Build test detail rows
def build_suite_rows(suites, section_id):
    rows = []
    for i, s in enumerate(suites):
        suite_pass = sum(1 for t in s.get("testCases", []) if t["status"] == "passed")
        suite_fail = s.get("tests", 0) - suite_pass
        icon = "✅" if suite_fail == 0 else "❌"
        time_str = f'{s.get("time", 0):.3f}s' if "time" in s else ""
        rows.append(f'''
          <tr class="suite-header" onclick="toggleSuite('{section_id}_{i}')">
            <td>{icon} {html.escape(s["suite"])}</td>
            <td class="num">{s["tests"]}</td>
            <td class="num pass">{suite_pass}</td>
            <td class="num fail">{suite_fail}</td>
            <td class="num">{time_str}</td>
          </tr>''')
        for tc in s.get("testCases", []):
            tc_time = f'{tc["time"]:.3f}s' if "time" in tc else ""
            rows.append(f'''
          <tr class="test-row hidden" data-suite="{section_id}_{i}">
            <td style="padding-left:2.5rem">{status_icon(tc["status"])} {html.escape(tc["name"])}</td>
            <td colspan="3"></td>
            <td class="num">{tc_time}</td>
          </tr>''')
    return "\n".join(rows)

be_rows = build_suite_rows(backend["suites"], "be")
fe_rows = build_suite_rows(frontend["suites"], "fe")
e2e_rows = build_suite_rows(e2e["suites"], "e2e")

# Mutation class rows
mut_class_rows = []
for c in mutation["classes"]:
    colour = score_colour(c["score"])
    mut_class_rows.append(f'''
      <tr>
        <td>{html.escape(c["class"])}</td>
        <td class="num">{c["total"]}</td>
        <td class="num pass">{c["killed"]}</td>
        <td class="num fail">{c["survived"]}</td>
        <td class="num">{c["noCoverage"]}</td>
        <td class="num" style="color:{colour};font-weight:700">{c["score"]}%</td>
      </tr>''')
mut_class_html = "\n".join(mut_class_rows)

# Survived mutation details
survived_rows = []
for s in mutation["survived"]:
    survived_rows.append(f'''
      <tr>
        <td>{html.escape(s["class"])}</td>
        <td>{html.escape(s["method"])}</td>
        <td class="num">{s["line"]}</td>
        <td>{html.escape(s["description"])}</td>
      </tr>''')
survived_html = "\n".join(survived_rows) if survived_rows else '<tr><td colspan="4" class="empty">No surviving mutations 🎉</td></tr>'

# Backend coverage rows
be_cov_totals = backend_cov["totals"]
be_cov_line = be_cov_totals.get("line", 0)
be_cov_branch = be_cov_totals.get("branch", 0)

be_cov_rows = []
for pkg in backend_cov.get("packages", []):
    be_cov_rows.append(f'''
      <tr class="suite-header" onclick="toggleSuite('cov_be_{html.escape(pkg["name"])}')">
        <td style="font-weight:600">{html.escape(pkg["name"])}</td>
        <td class="num" style="color:{score_colour(pkg["line"])};font-weight:700">{pkg["line"]}%</td>
        <td class="num" style="color:{score_colour(pkg["branch"])};font-weight:700">{pkg["branch"]}%</td>
        <td class="num" style="color:{score_colour(pkg["method"])};font-weight:700">{pkg["method"]}%</td>
      </tr>''')
    for cls in pkg.get("classes", []):
        be_cov_rows.append(f'''
      <tr class="test-row hidden" data-suite="cov_be_{html.escape(pkg["name"])}">
        <td style="padding-left:2.5rem">{html.escape(cls["name"])}</td>
        <td class="num" style="color:{score_colour(cls["line"])}">{cls["line"]}%  <span style="color:#999;font-size:0.8em">({cls["lineCov"]}/{cls["lineTotal"]})</span></td>
        <td class="num" style="color:{score_colour(cls["branch"])}">{cls["branch"]}%</td>
        <td class="num" style="color:{score_colour(cls["method"])}">{cls["method"]}%</td>
      </tr>''')
be_cov_html = "\n".join(be_cov_rows) if be_cov_rows else '<tr><td colspan="4" class="empty">No JaCoCo data found</td></tr>'

# Frontend coverage rows
fe_cov_totals = frontend_cov["totals"]
fe_cov_line = fe_cov_totals.get("lines", 0)
fe_cov_branch = fe_cov_totals.get("branches", 0)

fe_cov_rows = []
for f_entry in frontend_cov.get("files", []):
    fe_cov_rows.append(f'''
      <tr>
        <td>{html.escape(f_entry["file"])}</td>
        <td class="num" style="color:{score_colour(f_entry["lines"])};font-weight:700">{f_entry["lines"]}%</td>
        <td class="num" style="color:{score_colour(f_entry["branches"])};font-weight:700">{f_entry["branches"]}%</td>
        <td class="num" style="color:{score_colour(f_entry["functions"])};font-weight:700">{f_entry["functions"]}%</td>
        <td class="num" style="color:{score_colour(f_entry["statements"])};font-weight:700">{f_entry["statements"]}%</td>
      </tr>''')
fe_cov_html = "\n".join(fe_cov_rows) if fe_cov_rows else '<tr><td colspan="5" class="empty">No Vitest coverage data found</td></tr>'

dashboard_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ToySwap Test Dashboard</title>
<style>
  :root {{
    --bg: #fef9ef;
    --card-bg: #ffffff;
    --border: #e8d5b7;
    --text: #3e2723;
    --heading: #e65100;
    --subheading: #5d4037;
    --green: #4caf50;
    --red: #f44336;
    --orange: #ff9800;
    --blue: #2196f3;
    --purple: #9c27b0;
    --font-body: 'Segoe UI', system-ui, -apple-system, sans-serif;
    --font-heading: 'Fredoka One', 'Segoe UI', sans-serif;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: var(--font-body);
    background: var(--bg);
    color: var(--text);
    padding: 1rem 2rem 3rem;
  }}
  @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');

  .header {{
    text-align: center;
    padding: 1.5rem 0 1rem;
  }}
  .header h1 {{
    font-family: var(--font-heading);
    font-size: 2.4rem;
    color: var(--heading);
  }}
  .header h1 .flip {{ display: inline-block; transform: scaleX(-1); }}
  .timestamp {{ color: #999; font-size: 0.85rem; margin-top: 0.3rem; }}

  /* Summary cards */
  .summary {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
    margin: 1.5rem 0;
  }}
  .card {{
    background: var(--card-bg);
    border: 2px solid var(--border);
    border-radius: 16px;
    padding: 1.2rem;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }}
  .card h3 {{
    font-family: var(--font-heading);
    font-size: 0.95rem;
    color: var(--subheading);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }}
  .card .big-num {{
    font-size: 2.8rem;
    font-weight: 800;
    line-height: 1.1;
  }}
  .card .sub {{ font-size: 0.85rem; color: #888; margin-top: 0.2rem; }}

  /* Status pill */
  .status-pill {{
    display: inline-block;
    padding: 0.4rem 1.2rem;
    border-radius: 999px;
    color: white;
    font-weight: 700;
    font-size: 1.1rem;
    margin: 0.5rem 0;
  }}

  /* Section */
  .section {{
    background: var(--card-bg);
    border: 2px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    margin: 1.5rem 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }}
  .section h2 {{
    font-family: var(--font-heading);
    color: var(--heading);
    font-size: 1.4rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid var(--border);
    padding-bottom: 0.5rem;
  }}

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }}
  th {{
    text-align: left;
    padding: 0.6rem 0.8rem;
    background: #fdf0db;
    border-bottom: 2px solid var(--border);
    font-weight: 700;
    color: var(--subheading);
  }}
  td {{
    padding: 0.5rem 0.8rem;
    border-bottom: 1px solid #f0e6d2;
  }}
  .num {{ text-align: center; }}
  .pass {{ color: var(--green); }}
  .fail {{ color: var(--red); }}
  .empty {{ text-align: center; color: #999; font-style: italic; padding: 1rem; }}

  .suite-header {{
    cursor: pointer;
    background: #fefaf3;
    font-weight: 600;
  }}
  .suite-header:hover {{ background: #fdf0db; }}
  .test-row {{ background: #fff; }}
  .hidden {{ display: none; }}

  /* Progress bars */
  .bar-bg {{
    background: #f0e6d2;
    border-radius: 10px;
    height: 12px;
    overflow: hidden;
    margin-top: 0.4rem;
  }}
  .bar-fill {{
    height: 100%;
    border-radius: 10px;
    transition: width 0.5s ease;
  }}

  /* Mutation score gauge */
  .gauge-container {{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 1rem 0;
  }}
  .gauge {{
    position: relative;
    width: 140px;
    height: 140px;
  }}
  .gauge svg {{
    transform: rotate(-90deg);
  }}
  .gauge-label {{
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.8rem;
    font-weight: 800;
  }}
  .gauge-stats {{ text-align: left; font-size: 0.95rem; line-height: 1.8; }}

  /* Responsive */
  @media (max-width: 700px) {{
    body {{ padding: 0.5rem; }}
    .summary {{ grid-template-columns: 1fr 1fr; }}
  }}
</style>
</head>
<body>

<div class="header">
  <h1>T<span class="flip">o</span>ySwap Test Dashboard 🧪</h1>
  <div class="timestamp">Generated: {timestamp}</div>
  <div class="status-pill" style="background:{overall_colour}">{overall_status}</div>
</div>

<!-- Summary Cards -->
<div class="summary">
  <div class="card">
    <h3>Total Tests</h3>
    <div class="big-num" style="color:var(--blue)">{all_tests}</div>
    <div class="sub">{all_passed} passed &middot; {all_failed} failed</div>
  </div>
  <div class="card">
    <h3>Backend Unit</h3>
    <div class="big-num" style="color:{"var(--green)" if be_totals["failures"]+be_totals.get("errors",0)==0 else "var(--red)"}">{be_totals["tests"]}</div>
    <div class="sub">{be_totals["passed"]} passed &middot; {be_totals["failures"]} failed &middot; {be_totals["time"]}s</div>
  </div>
  <div class="card">
    <h3>Frontend Unit</h3>
    <div class="big-num" style="color:{"var(--green)" if fe_totals["failed"]==0 else "var(--red)"}">{fe_totals["tests"]}</div>
    <div class="sub">{fe_totals["passed"]} passed &middot; {fe_totals["failed"]} failed &middot; {fe_totals["time"]}s</div>
  </div>
  <div class="card">
    <h3>E2E Tests</h3>
    <div class="big-num" style="color:{"var(--green)" if e2e_totals["failed"]==0 else "var(--red)"}">{e2e_totals["tests"]}</div>
    <div class="sub">{e2e_totals["passed"]} passed &middot; {e2e_totals["failed"]} failed &middot; {e2e_totals["time"]}s</div>
  </div>
  <div class="card">
    <h3>Mutation Score</h3>
    <div class="big-num" style="color:{score_colour(mut_score)}">{mut_score}%</div>
    <div class="sub">{mut_killed}/{mut_total} killed &middot; {mut_survived} survived</div>
  </div>
  <div class="card">
    <h3>Backend Coverage</h3>
    <div class="big-num" style="color:{score_colour(be_cov_line)}">{be_cov_line}%</div>
    <div class="sub">Line &middot; {be_cov_branch}% branch</div>
  </div>
  <div class="card">
    <h3>Frontend Coverage</h3>
    <div class="big-num" style="color:{score_colour(fe_cov_line)}">{fe_cov_line}%</div>
    <div class="sub">Line &middot; {fe_cov_branch}% branch</div>
  </div>
</div>

<!-- Mutation Testing Detail -->
<div class="section">
  <h2>🧬 Mutation Testing (PIT)</h2>

  <div class="gauge-container">
    <div class="gauge">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="58" fill="none" stroke="#f0e6d2" stroke-width="14"/>
        <circle cx="70" cy="70" r="58" fill="none" stroke="{score_colour(mut_score)}" stroke-width="14"
                stroke-dasharray="{364.4 * mut_score / 100} {364.4 * (100 - mut_score) / 100}"
                stroke-linecap="round"/>
      </svg>
      <div class="gauge-label" style="color:{score_colour(mut_score)}">{mut_score}%</div>
    </div>
    <div class="gauge-stats">
      <div>🎯 <strong>{mut_killed}</strong> killed</div>
      <div>🐛 <strong>{mut_survived}</strong> survived</div>
      <div>📊 <strong>{mut_total}</strong> total mutations</div>
    </div>
  </div>

  <h3 style="margin:1rem 0 0.5rem;color:var(--subheading)">By Class</h3>
  <table>
    <thead><tr><th>Class</th><th class="num">Total</th><th class="num">Killed</th><th class="num">Survived</th><th class="num">No Coverage</th><th class="num">Score</th></tr></thead>
    <tbody>{mut_class_html}</tbody>
  </table>

  <details style="margin-top:1rem">
    <summary style="cursor:pointer;font-weight:700;color:var(--subheading)">🐛 Surviving Mutations ({len(mutation["survived"])})</summary>
    <table style="margin-top:0.5rem">
      <thead><tr><th>Class</th><th>Method</th><th class="num">Line</th><th>Description</th></tr></thead>
      <tbody>{survived_html}</tbody>
    </table>
  </details>
</div>

<!-- Backend Code Coverage -->
<div class="section">
  <h2>📊 Backend Code Coverage (JaCoCo)</h2>
  <div class="gauge-container">
    <div class="gauge">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="58" fill="none" stroke="#f0e6d2" stroke-width="14"/>
        <circle cx="70" cy="70" r="58" fill="none" stroke="{score_colour(be_cov_line)}" stroke-width="14"
                stroke-dasharray="{364.4 * be_cov_line / 100} {364.4 * (100 - be_cov_line) / 100}"
                stroke-linecap="round"/>
      </svg>
      <div class="gauge-label" style="color:{score_colour(be_cov_line)}">{be_cov_line}%</div>
    </div>
    <div class="gauge-stats">
      <div>📏 <strong>{be_cov_line}%</strong> line coverage</div>
      <div>🔀 <strong>{be_cov_branch}%</strong> branch coverage</div>
      <div>🏗️ <strong>{be_cov_totals.get("method", 0)}%</strong> method coverage</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Package / Class</th><th class="num">Line</th><th class="num">Branch</th><th class="num">Method</th></tr></thead>
    <tbody>{be_cov_html}</tbody>
  </table>
</div>

<!-- Frontend Code Coverage -->
<div class="section">
  <h2>📊 Frontend Code Coverage (Vitest / V8)</h2>
  <div class="gauge-container">
    <div class="gauge">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="58" fill="none" stroke="#f0e6d2" stroke-width="14"/>
        <circle cx="70" cy="70" r="58" fill="none" stroke="{score_colour(fe_cov_line)}" stroke-width="14"
                stroke-dasharray="{364.4 * fe_cov_line / 100} {364.4 * (100 - fe_cov_line) / 100}"
                stroke-linecap="round"/>
      </svg>
      <div class="gauge-label" style="color:{score_colour(fe_cov_line)}">{fe_cov_line}%</div>
    </div>
    <div class="gauge-stats">
      <div>📏 <strong>{fe_cov_line}%</strong> line coverage</div>
      <div>🔀 <strong>{fe_cov_branch}%</strong> branch coverage</div>
      <div>⚙️ <strong>{fe_cov_totals.get("functions", 0)}%</strong> function coverage</div>
      <div>📝 <strong>{fe_cov_totals.get("statements", 0)}%</strong> statement coverage</div>
    </div>
  </div>
  <table>
    <thead><tr><th>File</th><th class="num">Lines</th><th class="num">Branches</th><th class="num">Functions</th><th class="num">Statements</th></tr></thead>
    <tbody>{fe_cov_html}</tbody>
  </table>
</div>

<!-- Backend Unit Tests -->
<div class="section">
  <h2>☕ Backend Unit Tests (JUnit / Surefire)</h2>
  <table>
    <thead><tr><th>Suite</th><th class="num">Tests</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Time</th></tr></thead>
    <tbody>{be_rows}</tbody>
    <tfoot>
      <tr style="font-weight:700;background:#fdf0db">
        <td>Total</td>
        <td class="num">{be_totals["tests"]}</td>
        <td class="num pass">{be_totals["passed"]}</td>
        <td class="num fail">{be_totals["failures"] + be_totals.get("errors", 0)}</td>
        <td class="num">{be_totals["time"]}s</td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- Frontend Unit Tests -->
<div class="section">
  <h2>⚛️ Frontend Unit Tests (Vitest / React Testing Library)</h2>
  <table>
    <thead><tr><th>Suite</th><th class="num">Tests</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Time</th></tr></thead>
    <tbody>{fe_rows}</tbody>
    <tfoot>
      <tr style="font-weight:700;background:#fdf0db">
        <td>Total</td>
        <td class="num">{fe_totals["tests"]}</td>
        <td class="num pass">{fe_totals["passed"]}</td>
        <td class="num fail">{fe_totals["failed"]}</td>
        <td class="num">{fe_totals["time"]}s</td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- E2E Tests -->
<div class="section">
  <h2>🎭 E2E Tests (Playwright)</h2>
  <table>
    <thead><tr><th>Suite</th><th class="num">Tests</th><th class="num">Passed</th><th class="num">Failed</th><th class="num">Time</th></tr></thead>
    <tbody>{e2e_rows}</tbody>
    <tfoot>
      <tr style="font-weight:700;background:#fdf0db">
        <td>Total</td>
        <td class="num">{e2e_totals["tests"]}</td>
        <td class="num pass">{e2e_totals["passed"]}</td>
        <td class="num fail">{e2e_totals["failed"]}</td>
        <td class="num">{e2e_totals["time"]}s</td>
      </tr>
    </tfoot>
  </table>
</div>

<div style="text-align:center;color:#999;font-size:0.8rem;margin-top:2rem">
  ToySwap Test Dashboard &middot; Generated by generate-dashboard.sh
</div>

<script>
function toggleSuite(id) {{
  document.querySelectorAll('[data-suite="' + id + '"]').forEach(function(row) {{
    row.classList.toggle('hidden');
  }});
}}
</script>
</body>
</html>'''

with open(output_file, "w") as f:
    f.write(dashboard_html)

print(f"Dashboard written to {output_file}")
HTMLGEN

echo ""
echo -e "${GREEN}═══ Dashboard generated! ═══${NC}"
echo -e "Open: ${YELLOW}$DASHBOARD${NC}"
echo -e "  or: ${YELLOW}open $DASHBOARD${NC}"
