#!/usr/bin/env bash
# Generates App Store screenshots using ImageMagick 7 (magick command)
# Portrait:  1242×2688  (iPhone 6.5" screenshots)
# Landscape: 2688×1242  (App Preview clips)
set -e
OUT="/home/runner/workspace/screenshots"
mkdir -p "$OUT"

PW=1242; PH=2688
LW=2688; LH=1242

# Fonts
B="DejaVu-Sans-Bold"
R="DejaVu-Sans"

echo "Generating 10 portrait screenshots + 3 landscape previews..."
echo

# ── 01 LOGIN ──────────────────────────────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#1e3a8a" \
  -fill "#1e40af" -draw "polygon 0,1792 1242,1400 1242,2688 0,2688" \
  -fill white -font "$B" -pointsize 42 \
    -gravity NorthWest -annotate +72+260 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 114 \
    -gravity NorthWest -annotate +65+320 "Who's" \
  -fill white -font "$B" -pointsize 114 \
    -gravity NorthWest -annotate +65+448 "logging in?" \
  -fill "#93c5fd" -font "$R" -pointsize 48 \
    -gravity NorthWest -annotate +68+582 "Select your name to continue" \
  -fill white -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+700 "EMPLOYEES" \
  -fill white -stroke "#cbd5e1" -strokewidth 3 \
    -draw "roundrectangle 50,752 1192,880 20,20" \
  -fill "#111827" -font "$R" -pointsize 54 \
    -gravity NorthWest -annotate +100+784 "Admin" \
  -fill white -stroke "#cbd5e1" -strokewidth 3 \
    -draw "roundrectangle 50,904 1192,1032 20,20" \
  -fill "#111827" -font "$R" -pointsize 54 \
    -gravity NorthWest -annotate +100+936 "Maria Rodriguez" \
  -fill white -stroke "#cbd5e1" -strokewidth 3 \
    -draw "roundrectangle 50,1056 1192,1184 20,20" \
  -fill "#111827" -font "$R" -pointsize 54 \
    -gravity NorthWest -annotate +100+1088 "James Sullivan" \
  -fill white -stroke "#cbd5e1" -strokewidth 3 \
    -draw "roundrectangle 50,1208 1192,1336 20,20" \
  -fill "#111827" -font "$R" -pointsize 54 \
    -gravity NorthWest -annotate +100+1240 "Angela Torres" \
  -fill white -stroke "#cbd5e1" -strokewidth 3 \
    -draw "roundrectangle 50,1360 1192,1488 20,20" \
  -fill "#111827" -font "$R" -pointsize 54 \
    -gravity NorthWest -annotate +100+1392 "Paul Martinez" \
  -fill white -stroke "#cbd5e1" -strokewidth 3 \
    -draw "roundrectangle 50,1512 1192,1640 20,20" \
  -fill "#111827" -font "$R" -pointsize 54 \
    -gravity NorthWest -annotate +100+1544 "Cathy Lopez" \
  -fill "#93c5fd" -font "$R" -pointsize 39 \
    -gravity South -annotate +0+72 "⚙  Admin access" \
  "$OUT/01-login.png"
echo "  ✓  01-login.png"

# ── 02 DASHBOARD ──────────────────────────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Dashboard" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "Week of Jun 16, 2025" \
  -fill "#fff1f2" -stroke "#fecaca" -strokewidth 3 \
    -draw "roundrectangle 50,374 594,552 20,20" \
  -fill "#991b1b" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +80+390 "CRITICAL" \
  -fill "#991b1b" -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +80+428 "3" \
  -fill "#991b1b" -font "$R" -pointsize 36 \
    -gravity NorthWest -annotate +175+466 "critical alerts" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 \
    -draw "roundrectangle 622,374 1192,552 20,20" \
  -fill "#92400e" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +652+390 "WARNING" \
  -fill "#d97706" -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +652+428 "7" \
  -fill "#92400e" -font "$R" -pointsize 36 \
    -gravity NorthWest -annotate +747+466 "warnings" \
  -fill "#6b7280" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+582 "RECENT SUBMISSIONS" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 \
    -draw "roundrectangle 50,624 1192,758 20,20" \
  -fill "#111827" -font "$B" -pointsize 45 \
    -gravity NorthWest -annotate +88+644 "Store 1 Downtown" \
  -fill "#6b7280" -font "$R" -pointsize 38 \
    -gravity NorthWest -annotate +88+700 "Jun 16  ·  23 chemicals  ·  James S." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 \
    -draw "roundrectangle 50,778 1192,912 20,20" \
  -fill "#111827" -font "$B" -pointsize 45 \
    -gravity NorthWest -annotate +88+798 "Store 2 Eastside" \
  -fill "#6b7280" -font "$R" -pointsize 38 \
    -gravity NorthWest -annotate +88+854 "Jun 16  ·  23 chemicals  ·  Maria R." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 \
    -draw "roundrectangle 50,932 1192,1066 20,20" \
  -fill "#111827" -font "$B" -pointsize 45 \
    -gravity NorthWest -annotate +88+952 "Store 3 Northside" \
  -fill "#6b7280" -font "$R" -pointsize 38 \
    -gravity NorthWest -annotate +88+1008 "Jun 16  ·  23 chemicals  ·  Angela T." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 \
    -draw "roundrectangle 50,1086 1192,1220 20,20" \
  -fill "#111827" -font "$B" -pointsize 45 \
    -gravity NorthWest -annotate +88+1106 "Store 4 Westfield" \
  -fill "#6b7280" -font "$R" -pointsize 38 \
    -gravity NorthWest -annotate +88+1162 "Jun 15  ·  23 chemicals  ·  Paul M." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 \
    -draw "roundrectangle 50,1240 1192,1374 20,20" \
  -fill "#111827" -font "$B" -pointsize 45 \
    -gravity NorthWest -annotate +88+1260 "Store 5 Southpark" \
  -fill "#6b7280" -font "$R" -pointsize 38 \
    -gravity NorthWest -annotate +88+1316 "Jun 15  ·  23 chemicals  ·  Cathy L." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 \
    -draw "roundrectangle 50,1394 1192,1528 20,20" \
  -fill "#111827" -font "$B" -pointsize 45 \
    -gravity NorthWest -annotate +88+1414 "Store 6 Lakeside" \
  -fill "#6b7280" -font "$R" -pointsize 38 \
    -gravity NorthWest -annotate +88+1470 "Jun 15  ·  23 chemicals  ·  Mike J." \
  -fill white -draw "rectangle 0,2528 1242,2688" \
  -fill "#e5e7eb" -draw "rectangle 0,2528 1242,2531" \
  -fill "#cc0000" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +100+2568 "Dashboard" \
  -fill "#6b7280" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +370+2568 "Count" \
  -fill "#6b7280" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +640+2568 "Scan" \
  -fill "#6b7280" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +890+2568 "History" \
  "$OUT/02-dashboard.png"
echo "  ✓  02-dashboard.png"

# ── 03 COUNT ENTRY – UNFILLED ─────────────────────────────────────────────────
# Helper: one amber row at y  (using -draw primitives in a single magick run)
# We build the entire image in one command listing all rows
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Count Entry" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "Week of Jun 16, 2025" \
  -fill "#6b7280" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+374 "STORE" \
  -fill white -stroke "#e5e7eb" -strokewidth 3 \
    -draw "roundrectangle 50,418 1192,530 20,20" \
  -fill "#9ca3af" -font "$R" -pointsize 48 \
    -gravity NorthWest -annotate +88+448 "Select your store..." \
  -fill "#6b7280" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+556 "CHEMICALS (0 / 23 filled)" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,598 1192,702 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+614 "Chlorine" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+666 "gallons" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+630 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,714 1192,818 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+730 "pH Plus" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+782 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+746 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,830 1192,934 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+846 "pH Minus" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+898 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+862 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,946 1192,1050 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+962 "Algaecide" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1014 "quarts" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+978 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1062 1192,1166 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1078 "Shock Treatment" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1130 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1094 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1178 1192,1282 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1194 "Stabilizer" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1246 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1210 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1294 1192,1398 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1310 "Clarifier" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1362 "quarts" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1326 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1410 1192,1514 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1426 "DE Powder" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1478 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1442 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1526 1192,1630 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1542 "Muriatic Acid" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1594 "gallons" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1558 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1642 1192,1746 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1658 "Sodium Bicarb" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1710 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1674 "--" \
  -fill "#6b7280" -font "$R" -pointsize 38 \
    -gravity NorthWest -annotate +88+1766 "+ 13 more chemicals to fill..." \
  -fill "#cc0000" -draw "roundrectangle 50,2348 1192,2488 24,24" \
  -fill white -font "$B" -pointsize 54 \
    -gravity NorthWest -annotate +360+2374 "Submit Count" \
  -fill white -draw "rectangle 0,2528 1242,2688" \
  -fill "#e5e7eb" -draw "rectangle 0,2528 1242,2531" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +100+2568 "Dashboard" \
  -fill "#cc0000" -font "$B" -pointsize 33 -gravity NorthWest -annotate +405+2568 "Count" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +640+2568 "Scan" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +890+2568 "History" \
  "$OUT/03-count-unfilled.png"
echo "  ✓  03-count-unfilled.png"

# ── 04 COUNT ENTRY – PARTIALLY FILLED ────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Count Entry" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "Week of Jun 16, 2025" \
  -fill "#6b7280" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+374 "STORE" \
  -fill white -stroke "#e5e7eb" -strokewidth 3 \
    -draw "roundrectangle 50,418 1192,530 20,20" \
  -fill "#111827" -font "$R" -pointsize 48 \
    -gravity NorthWest -annotate +88+448 "Store 1 Downtown" \
  -fill "#e5e7eb" -draw "rectangle 50,540 1192,546" \
  -fill "#cc0000" -draw "rectangle 50,540 $((50 + 1142*7/23)),546" \
  -fill "#6b7280" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+564 "CHEMICALS (7 / 23 filled)" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 50,604 1192,708 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+620 "Chlorine" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+672 "gallons" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,612 1180,700 12,12" \
  -fill "#15803d" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1030+634 "45" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 50,720 1192,824 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+736 "pH Plus" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+788 "lbs" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,728 1180,816 12,12" \
  -fill "#15803d" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1030+750 "30" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 50,836 1192,940 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+852 "pH Minus" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+904 "lbs" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,844 1180,932 12,12" \
  -fill "#15803d" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1030+866 "18" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 50,952 1192,1056 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+968 "Algaecide" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1020 "quarts" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,960 1180,1048 12,12" \
  -fill "#15803d" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1030+982 "12" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 50,1068 1192,1172 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1084 "Shock Treatment" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1136 "lbs" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,1076 1180,1164 12,12" \
  -fill "#15803d" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1030+1098 "50" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 50,1184 1192,1288 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1200 "Stabilizer" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1252 "lbs" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,1192 1180,1280 12,12" \
  -fill "#15803d" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1030+1214 "25" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 50,1300 1192,1404 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1316 "Clarifier" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1368 "quarts" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,1308 1180,1396 12,12" \
  -fill "#15803d" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1030+1330 "8" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1416 1192,1520 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1432 "DE Powder" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1484 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1448 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1532 1192,1636 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1548 "Muriatic Acid" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1600 "gallons" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1564 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1648 1192,1752 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1664 "Sodium Bicarb" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1716 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1048+1680 "--" \
  -fill "#6b7280" -font "$R" -pointsize 38 \
    -gravity NorthWest -annotate +88+1772 "+ 14 more chemicals to fill..." \
  -fill "#cc0000" -draw "roundrectangle 50,2348 1192,2488 24,24" \
  -fill white -font "$B" -pointsize 54 \
    -gravity NorthWest -annotate +360+2374 "Submit Count" \
  -fill white -draw "rectangle 0,2528 1242,2688" \
  -fill "#e5e7eb" -draw "rectangle 0,2528 1242,2531" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +100+2568 "Dashboard" \
  -fill "#cc0000" -font "$B" -pointsize 33 -gravity NorthWest -annotate +405+2568 "Count" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +640+2568 "Scan" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +890+2568 "History" \
  "$OUT/04-count-filled.png"
echo "  ✓  04-count-filled.png"

# ── 05 SCAN SHEET ─────────────────────────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Scan Sheet" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "AI-powered count entry" \
  -fill "#eff3ff" -stroke "#1e40af" -strokewidth 5 \
    -draw "roundrectangle 50,374 1192,920 24,24" \
  -fill "#1e40af" -font "$B" -pointsize 39 \
    -gravity NorthWest -annotate +440+410 "[ PHOTO ]" \
  -fill "#1e40af" -font "$B" -pointsize 120 \
    -gravity NorthWest -annotate +440+456 "+" \
  -fill "#1e3a8a" -font "$B" -pointsize 54 \
    -gravity NorthWest -annotate +280+618 "Tap to take photo" \
  -fill "#6b7280" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +160+690 "or choose from your camera roll" \
  -fill "#1e40af" -font "$R" -pointsize 39 \
    -gravity NorthWest -annotate +90+780 "Point camera at your paper count sheet" \
  -fill "#1e40af" -font "$R" -pointsize 39 \
    -gravity NorthWest -annotate +90+832 "AI reads all 23 chemical quantities" \
  -fill "#6b7280" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+946 "HOW IT WORKS" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,990 1192,1100 16,16" \
  -fill "#1e3a8a" -font "$B" -pointsize 42 -gravity NorthWest -annotate +80+1008 "1." \
  -fill "#111827" -font "$R" -pointsize 42 -gravity NorthWest -annotate +160+1008 "Photograph your count sheet" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1116 1192,1226 16,16" \
  -fill "#1e3a8a" -font "$B" -pointsize 42 -gravity NorthWest -annotate +80+1134 "2." \
  -fill "#111827" -font "$R" -pointsize 42 -gravity NorthWest -annotate +160+1134 "AI reads all 23 chemicals instantly" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1242 1192,1352 16,16" \
  -fill "#1e3a8a" -font "$B" -pointsize 42 -gravity NorthWest -annotate +80+1260 "3." \
  -fill "#111827" -font "$R" -pointsize 42 -gravity NorthWest -annotate +160+1260 "Review, confirm, and submit" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1368 1192,1478 16,16" \
  -fill "#1e3a8a" -font "$B" -pointsize 42 -gravity NorthWest -annotate +80+1386 "4." \
  -fill "#111827" -font "$R" -pointsize 42 -gravity NorthWest -annotate +160+1386 "Automatic alerts if quantities look off" \
  -fill "#1e40af" -draw "roundrectangle 50,2348 1192,2488 24,24" \
  -fill white -font "$B" -pointsize 54 \
    -gravity NorthWest -annotate +390+2374 "Take Photo" \
  -fill white -draw "rectangle 0,2528 1242,2688" \
  -fill "#e5e7eb" -draw "rectangle 0,2528 1242,2531" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +100+2568 "Dashboard" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +405+2568 "Count" \
  -fill "#cc0000" -font "$B" -pointsize 33 -gravity NorthWest -annotate +640+2568 "Scan" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +890+2568 "History" \
  "$OUT/05-scan.png"
echo "  ✓  05-scan.png"

# ── 06 INVENTORY HUB – HISTORY ────────────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Inventory Hub" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "Chemical records" \
  -fill white -draw "rectangle 0,350 1242,440" \
  -fill "#e5e7eb" -draw "rectangle 0,350 1242,353" \
  -fill "#cc0000" -draw "rectangle 0,350 310,440" \
  -fill white -font "$B" -pointsize 36 -gravity NorthWest -annotate +50+369 "History" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +360+369 "On Hand" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +680+369 "Received" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +980+369 "Orders" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,454 1192,574 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+472 "Store 1 Downtown" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+528 "Week of Jun 16  ·  James S." \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1010,468 1178,558 12,12" \
  -fill "#15803d" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1026+490 "23/23" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,590 1192,710 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+608 "Store 2 Eastside" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+664 "Week of Jun 16  ·  Maria R." \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1010,604 1178,694 12,12" \
  -fill "#15803d" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1026+626 "23/23" \
  -fill white -stroke "#fde68a" -strokewidth 2 -draw "roundrectangle 50,726 1192,846 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+744 "Store 3 Northside" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+800 "Week of Jun 16  ·  Angela T." \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 2 -draw "roundrectangle 1010,740 1178,830 12,12" \
  -fill "#d97706" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1026+762 "alert" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,862 1192,982 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+880 "Store 4 Westfield" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+936 "Week of Jun 15  ·  Paul M." \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1010,876 1178,966 12,12" \
  -fill "#15803d" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1026+898 "23/23" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,998 1192,1118 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+1016 "Store 5 Southpark" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1072 "Week of Jun 15  ·  Cathy L." \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1010,1012 1178,1102 12,12" \
  -fill "#15803d" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1026+1034 "23/23" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1134 1192,1254 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+1152 "Store 6 Lakeside" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1208 "Week of Jun 15  ·  Mike J." \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1010,1148 1178,1238 12,12" \
  -fill "#15803d" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1026+1170 "23/23" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1270 1192,1390 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+1288 "Store 7 Central" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1344 "Week of Jun 14  ·  Dana K." \
  -fill "#fff1f2" -stroke "#fecaca" -strokewidth 2 -draw "roundrectangle 1010,1284 1178,1374 12,12" \
  -fill "#991b1b" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1026+1306 "crit" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1406 1192,1526 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+1424 "Store 8 Heights" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1480 "Week of Jun 14  ·  Tom B." \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1010,1420 1178,1510 12,12" \
  -fill "#15803d" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1026+1442 "23/23" \
  -fill white -draw "rectangle 0,2528 1242,2688" \
  -fill "#e5e7eb" -draw "rectangle 0,2528 1242,2531" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +100+2568 "Dashboard" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +405+2568 "Count" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +640+2568 "Scan" \
  -fill "#cc0000" -font "$B" -pointsize 33 -gravity NorthWest -annotate +890+2568 "History" \
  "$OUT/06-history.png"
echo "  ✓  06-history.png"

# ── 07 INVENTORY HUB – ON HAND ────────────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Inventory Hub" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "Current stock on hand" \
  -fill white -draw "rectangle 0,350 1242,440" \
  -fill "#e5e7eb" -draw "rectangle 0,350 1242,353" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +50+369 "History" \
  -fill "#cc0000" -draw "rectangle 310,350 620,440" \
  -fill white -font "$B" -pointsize 36 -gravity NorthWest -annotate +360+369 "On Hand" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +680+369 "Received" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +980+369 "Orders" \
  -fill white -stroke "#e5e7eb" -strokewidth 3 -draw "roundrectangle 50,454 1192,544 16,16" \
  -fill "#111827" -font "$R" -pointsize 48 -gravity NorthWest -annotate +88+468 "Store 1 Downtown" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,558 1192,660 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+572 "Chlorine" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+622 "gallons" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+578 "45" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,672 1192,774 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+686 "pH Plus" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+736 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+692 "30" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,786 1192,888 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+800 "pH Minus" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+850 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+806 "18" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,900 1192,1002 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+914 "Algaecide" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+964 "quarts" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+920 "12" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1014 1192,1116 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1028 "Shock Treatment" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1078 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+1034 "50" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1128 1192,1230 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1142 "Stabilizer" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1192 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+1148 "25" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1242 1192,1344 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1256 "Clarifier" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1306 "quarts" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+1262 "8" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1356 1192,1458 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1370 "DE Powder" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1420 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+1376 "15" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1470 1192,1572 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1484 "Muriatic Acid" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1534 "gallons" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+1490 "6" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1584 1192,1686 16,16" \
  -fill "#111827" -font "$B" -pointsize 42 -gravity NorthWest -annotate +88+1598 "Sodium Bicarb" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1648 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 54 -gravity NorthWest -annotate +1060+1604 "40" \
  -fill "#6b7280" -font "$R" -pointsize 38 -gravity NorthWest -annotate +88+1706 "+ 13 more chemicals" \
  -fill white -draw "rectangle 0,2528 1242,2688" \
  -fill "#e5e7eb" -draw "rectangle 0,2528 1242,2531" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +100+2568 "Dashboard" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +405+2568 "Count" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +640+2568 "Scan" \
  -fill "#cc0000" -font "$B" -pointsize 33 -gravity NorthWest -annotate +890+2568 "History" \
  "$OUT/07-on-hand.png"
echo "  ✓  07-on-hand.png"

# ── 08 INVENTORY HUB – RECEIVED ──────────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Inventory Hub" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "Incoming deliveries" \
  -fill white -draw "rectangle 0,350 1242,440" \
  -fill "#e5e7eb" -draw "rectangle 0,350 1242,353" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +50+369 "History" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +360+369 "On Hand" \
  -fill "#cc0000" -draw "rectangle 620,350 950,440" \
  -fill white -font "$B" -pointsize 36 -gravity NorthWest -annotate +670+369 "Received" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +980+369 "Orders" \
  -fill white -stroke "#e5e7eb" -strokewidth 3 -draw "roundrectangle 50,454 1192,544 16,16" \
  -fill "#111827" -font "$R" -pointsize 48 -gravity NorthWest -annotate +88+468 "All Stores" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,558 1192,690 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+574 "Chlorine" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+632 "Store 1 Downtown  ·  Jun 14" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,570 1178,682 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1018+600 "+50 gal" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,706 1192,838 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+722 "pH Plus" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+780 "Store 3 Northside  ·  Jun 13" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,718 1178,830 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1018+748 "+25 lbs" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,854 1192,986 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+870 "Algaecide" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+928 "Store 2 Eastside  ·  Jun 13" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,866 1178,978 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1018+896 "+12 qt" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1002 1192,1134 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+1018 "Shock Treatment" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1076 "Store 1 Downtown  ·  Jun 12" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 988,1014 1178,1126 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1006+1044 "+100 lbs" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1150 1192,1282 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+1166 "Stabilizer" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1224 "Store 5 Southpark  ·  Jun 11" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,1162 1178,1274 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1018+1192 "+50 lbs" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 50,1298 1192,1430 16,16" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +88+1314 "Muriatic Acid" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +88+1372 "Store 4 Westfield  ·  Jun 11" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1000,1310 1178,1422 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1018+1340 "+10 gal" \
  -fill white -draw "rectangle 0,2528 1242,2688" \
  -fill "#e5e7eb" -draw "rectangle 0,2528 1242,2531" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +100+2568 "Dashboard" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +405+2568 "Count" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +640+2568 "Scan" \
  -fill "#cc0000" -font "$B" -pointsize 33 -gravity NorthWest -annotate +890+2568 "History" \
  "$OUT/08-received.png"
echo "  ✓  08-received.png"

# ── 09 ADMIN PIN ──────────────────────────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Admin Panel" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "Secure management console" \
  -fill white -stroke "#e5e7eb" -strokewidth 3 \
    -draw "roundrectangle 100,380 1142,520 20,20" \
  -fill "#6b7280" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +210+410 "Enter PIN to access admin controls" \
  -fill "#1e3a8a" -draw "circle 352,600 352,550" \
  -fill "#1e3a8a" -draw "circle 502,600 502,550" \
  -fill "#1e3a8a" -draw "circle 652,600 652,550" \
  -fill "#e5e7eb" -draw "circle 802,600 802,550" \
  -fill "#1e3a8a" -draw "roundrectangle 100,680 420,800 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +218+698 "1" \
  -fill "#1e3a8a" -draw "roundrectangle 461,680 781,800 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +579+698 "2" \
  -fill "#1e3a8a" -draw "roundrectangle 822,800 1142,920 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +940+818 "9" \
  -fill "#1e3a8a" -draw "roundrectangle 822,680 1142,800 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +940+698 "3" \
  -fill "#1e3a8a" -draw "roundrectangle 100,820 420,940 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +218+838 "4" \
  -fill "#1e3a8a" -draw "roundrectangle 461,820 781,940 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +579+838 "5" \
  -fill "#1e3a8a" -draw "roundrectangle 100,960 420,1080 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +218+978 "7" \
  -fill "#1e3a8a" -draw "roundrectangle 461,960 781,1080 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +579+978 "8" \
  -fill "#1e3a8a" -draw "roundrectangle 461,1100 781,1220 16,16" \
  -fill white -font "$B" -pointsize 72 -gravity NorthWest -annotate +579+1118 "0" \
  "$OUT/09-admin-pin.png"
echo "  ✓  09-admin-pin.png"

# ── 10 ADMIN ALERTS ───────────────────────────────────────────────────────────
magick -size ${PW}x${PH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 1242,350" \
  -fill "#cc0000" -font "$B" -pointsize 36 \
    -gravity NorthWest -annotate +72+148 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 90 \
    -gravity NorthWest -annotate +65+192 "Admin Panel" \
  -fill "#93c5fd" -font "$R" -pointsize 42 \
    -gravity NorthWest -annotate +68+295 "Chemical alerts" \
  -fill white -draw "rectangle 0,350 1242,440" \
  -fill "#e5e7eb" -draw "rectangle 0,350 1242,353" \
  -fill "#cc0000" -draw "rectangle 0,350 300,440" \
  -fill white -font "$B" -pointsize 36 -gravity NorthWest -annotate +50+368 "Alerts" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +360+368 "Stores" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +680+368 "Products" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +950+368 "Counts" \
  -fill "#fff1f2" -stroke "#fecaca" -strokewidth 3 -draw "roundrectangle 50,454 1192,578 16,16" \
  -fill "#991b1b" -font "$B" -pointsize 33 -gravity NorthWest -annotate +68+468 "CRITICAL" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +68+512 "Chlorine" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +68+558 "Store 1 Downtown  ·  under-dosed  ·  -65%" \
  -fill "#fff1f2" -stroke "#fecaca" -strokewidth 3 -draw "roundrectangle 50,596 1192,720 16,16" \
  -fill "#991b1b" -font "$B" -pointsize 33 -gravity NorthWest -annotate +68+610 "CRITICAL" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +68+654 "pH Plus" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +68+700 "Store 3 Northside  ·  over-dosed  ·  +58%" \
  -fill "#fff1f2" -stroke "#fecaca" -strokewidth 3 -draw "roundrectangle 50,738 1192,862 16,16" \
  -fill "#991b1b" -font "$B" -pointsize 33 -gravity NorthWest -annotate +68+752 "CRITICAL" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +68+796 "Algaecide" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +68+842 "Store 5 Southpark  ·  under-dosed  ·  -72%" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,880 1192,1004 16,16" \
  -fill "#92400e" -font "$B" -pointsize 33 -gravity NorthWest -annotate +68+894 "WARNING" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +68+938 "Shock Treatment" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +68+984 "Store 2 Eastside  ·  over-dosed  ·  +41%" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1022 1192,1146 16,16" \
  -fill "#92400e" -font "$B" -pointsize 33 -gravity NorthWest -annotate +68+1036 "WARNING" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +68+1080 "Stabilizer" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +68+1126 "Store 4 Westfield  ·  under-dosed  ·  -38%" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1164 1192,1288 16,16" \
  -fill "#92400e" -font "$B" -pointsize 33 -gravity NorthWest -annotate +68+1178 "WARNING" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +68+1222 "Muriatic Acid" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +68+1268 "Store 7 Central  ·  over-dosed  ·  +29%" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 50,1306 1192,1430 16,16" \
  -fill "#92400e" -font "$B" -pointsize 33 -gravity NorthWest -annotate +68+1320 "WARNING" \
  -fill "#111827" -font "$B" -pointsize 45 -gravity NorthWest -annotate +68+1364 "DE Powder" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +68+1410 "Store 9 Riverside  ·  under-dosed  ·  -33%" \
  -fill white -draw "rectangle 0,2528 1242,2688" \
  -fill "#e5e7eb" -draw "rectangle 0,2528 1242,2531" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +100+2568 "Dashboard" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +405+2568 "Count" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +640+2568 "Scan" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +890+2568 "History" \
  "$OUT/10-admin-alerts.png"
echo "  ✓  10-admin-alerts.png"

# ── LANDSCAPE PREVIEWS ────────────────────────────────────────────────────────
echo
echo "Generating 3 landscape app previews..."

# P01 DASHBOARD landscape
magick -size ${LW}x${LH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 2688,220" \
  -fill "#cc0000" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +60+52 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 75 \
    -gravity NorthWest -annotate +56+100 "Dashboard" \
  -fill "#93c5fd" -font "$R" -pointsize 36 \
    -gravity NorthWest -annotate +60+183 "Week of Jun 16, 2025" \
  -fill "#fff1f2" -stroke "#fecaca" -strokewidth 3 -draw "roundrectangle 60,238 740,390 20,20" \
  -fill "#991b1b" -font "$B" -pointsize 33 -gravity NorthWest -annotate +90+255 "CRITICAL" \
  -fill "#991b1b" -font "$B" -pointsize 75 -gravity NorthWest -annotate +90+294 "3  critical alerts" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 768,238 1448,390 20,20" \
  -fill "#92400e" -font "$B" -pointsize 33 -gravity NorthWest -annotate +800+255 "WARNING" \
  -fill "#d97706" -font "$B" -pointsize 75 -gravity NorthWest -annotate +800+294 "7  warnings" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +60+418 "RECENT SUBMISSIONS" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,456 1440,556 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+472 "Store 1 Downtown" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+520 "Jun 16  ·  23 chemicals  ·  James S." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,574 1440,674 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+590 "Store 2 Eastside" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+638 "Jun 16  ·  23 chemicals  ·  Maria R." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,692 1440,792 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+708 "Store 3 Northside" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+756 "Jun 16  ·  23 chemicals  ·  Angela T." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,810 1440,910 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+826 "Store 4 Westfield" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+874 "Jun 15  ·  23 chemicals  ·  Paul M." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,928 1440,1028 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+944 "Store 5 Southpark" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+992 "Jun 15  ·  23 chemicals  ·  Cathy L." \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,1046 1440,1146 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+1062 "Store 6 Lakeside" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+1110 "Jun 15  ·  23 chemicals  ·  Mike J." \
  -fill white -draw "rectangle 1480,230 2688,1242" \
  -fill "#e5e7eb" -draw "rectangle 1480,230 1483,1242" \
  -fill "#1e3a8a" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1512+260 "Quick Actions" \
  -fill "#cc0000" -draw "roundrectangle 1500,310 2628,410 16,16" \
  -fill white -font "$B" -pointsize 48 -gravity NorthWest -annotate +1572+328 "New Count Entry" \
  -fill "#1e40af" -draw "roundrectangle 1500,430 2628,530 16,16" \
  -fill white -font "$B" -pointsize 48 -gravity NorthWest -annotate +1572+448 "Scan Count Sheet" \
  -fill "#1e3a8a" -draw "roundrectangle 1500,550 2628,650 16,16" \
  -fill white -font "$B" -pointsize 48 -gravity NorthWest -annotate +1572+568 "View Inventory Hub" \
  -fill "#1e3a8a" -draw "roundrectangle 1500,670 2628,770 16,16" \
  -fill white -font "$B" -pointsize 48 -gravity NorthWest -annotate +1572+688 "Admin Panel" \
  "$OUT/preview-01-dashboard.png"
echo "  ✓  preview-01-dashboard.png"

# P02 COUNT ENTRY landscape
magick -size ${LW}x${LH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 2688,220" \
  -fill "#cc0000" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +60+52 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 75 \
    -gravity NorthWest -annotate +56+100 "Count Entry" \
  -fill "#93c5fd" -font "$R" -pointsize 36 \
    -gravity NorthWest -annotate +60+183 "Store 1 Downtown  ·  Week of Jun 16, 2025" \
  -fill white -stroke "#e5e7eb" -strokewidth 3 -draw "roundrectangle 60,238 1360,318 16,16" \
  -fill "#111827" -font "$R" -pointsize 42 -gravity NorthWest -annotate +96+252 "Store 1 Downtown" \
  -fill "#e5e7eb" -draw "rectangle 60,328 1360,334" \
  -fill "#cc0000" -draw "rectangle 60,328 $((60 + 1300*7/23)),334" \
  -fill "#6b7280" -font "$B" -pointsize 30 -gravity NorthWest -annotate +62+348 "7 / 23 chemicals filled" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 60,382 1360,480 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+394 "Chlorine" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+440 "gallons" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1200,390 1348,472 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1222+408 "45" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 60,492 1360,590 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+504 "pH Plus" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+550 "lbs" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1200,500 1348,582 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1222+518 "30" \
  -fill white -stroke "#86efac" -strokewidth 3 -draw "roundrectangle 60,602 1360,700 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+614 "pH Minus" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+660 "lbs" \
  -fill "#dcfce7" -stroke "#86efac" -strokewidth 2 -draw "roundrectangle 1200,610 1348,692 12,12" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +1222+628 "18" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 60,712 1360,810 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+724 "Algaecide" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+770 "quarts" \
  -fill "#d97706" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1222+736 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 60,822 1360,920 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+834 "Shock Treatment" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+880 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1222+846 "--" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 3 -draw "roundrectangle 60,932 1360,1030 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+944 "Stabilizer" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+990 "lbs" \
  -fill "#d97706" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1222+956 "--" \
  -fill "#cc0000" -draw "roundrectangle 60,1155 1360,1220 20,20" \
  -fill white -font "$B" -pointsize 48 -gravity NorthWest -annotate +440+1168 "Submit Count" \
  -fill white -draw "rectangle 1400,230 2688,1242" \
  -fill "#e5e7eb" -draw "rectangle 1400,230 1403,1242" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1430+255 "REMAINING (16)" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 2 -draw "roundrectangle 1418,300 2668,390 12,12" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1450+312 "DE Powder                 lbs" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 2 -draw "roundrectangle 1418,402 2668,492 12,12" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1450+414 "Muriatic Acid             gal" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 2 -draw "roundrectangle 1418,504 2668,594 12,12" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1450+516 "Sodium Bicarb             lbs" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 2 -draw "roundrectangle 1418,606 2668,696 12,12" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1450+618 "Calcium Hypochlorite      lbs" \
  -fill "#fffbeb" -stroke "#fde68a" -strokewidth 2 -draw "roundrectangle 1418,708 2668,798 12,12" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +1450+720 "Enzyme Cleaner            qt" \
  "$OUT/preview-02-count.png"
echo "  ✓  preview-02-count.png"

# P03 ON HAND landscape
magick -size ${LW}x${LH} xc:"#f9f9f9" \
  -fill "#1e3a8a" -draw "rectangle 0,0 2688,220" \
  -fill "#cc0000" -font "$B" -pointsize 33 \
    -gravity NorthWest -annotate +60+52 "RED CARPET INVENTORY" \
  -fill white -font "$B" -pointsize 75 \
    -gravity NorthWest -annotate +56+100 "Inventory Hub" \
  -fill "#93c5fd" -font "$R" -pointsize 36 \
    -gravity NorthWest -annotate +60+183 "On Hand  ·  Store 1 Downtown" \
  -fill white -draw "rectangle 0,225 2688,300" \
  -fill "#e5e7eb" -draw "rectangle 0,225 2688,228" \
  -fill "#cc0000" -draw "rectangle 0,225 670,300" \
  -fill white -font "$B" -pointsize 36 -gravity NorthWest -annotate +220+244 "History" \
  -fill white -font "$B" -pointsize 36 -gravity NorthWest -annotate +730+244 "On Hand" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +1170+244 "Received" \
  -fill "#6b7280" -font "$B" -pointsize 36 -gravity NorthWest -annotate +1620+244 "Orders" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,318 1340,412 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+332 "Chlorine" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+378 "gallons" \
  -fill "#1e40af" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1200+334 "45" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,424 1340,518 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+438 "pH Plus" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+484 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1200+440 "30" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,530 1340,624 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+544 "pH Minus" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+590 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1200+546 "18" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,636 1340,730 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+650 "Algaecide" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+696 "quarts" \
  -fill "#1e40af" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1200+652 "12" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,742 1340,836 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+756 "Shock Treatment" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+802 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1200+758 "50" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,848 1340,942 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+862 "Stabilizer" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+908 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1200+864 "25" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,954 1340,1048 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+968 "Clarifier" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+1014 "quarts" \
  -fill "#1e40af" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1200+970 "8" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 60,1060 1340,1154 16,16" \
  -fill "#111827" -font "$B" -pointsize 39 -gravity NorthWest -annotate +96+1074 "DE Powder" \
  -fill "#6b7280" -font "$R" -pointsize 33 -gravity NorthWest -annotate +96+1120 "lbs" \
  -fill "#1e40af" -font "$B" -pointsize 48 -gravity NorthWest -annotate +1200+1076 "15" \
  -fill white -draw "rectangle 1380,230 2688,1242" \
  -fill "#e5e7eb" -draw "rectangle 1380,230 1383,1242" \
  -fill "#6b7280" -font "$B" -pointsize 33 -gravity NorthWest -annotate +1412+255 "STORE SUMMARY" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 1400,295 2668,375 16,16" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +1436+310 "Total chemicals tracked" \
  -fill "#1e3a8a" -font "$B" -pointsize 42 -gravity NorthWest -annotate +2500+305 "23" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 1400,387 2668,467 16,16" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +1436+402 "Last count submitted" \
  -fill "#1e3a8a" -font "$B" -pointsize 36 -gravity NorthWest -annotate +2400+402 "Jun 16" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 1400,479 2668,559 16,16" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +1436+494 "Active alerts" \
  -fill "#cc0000" -font "$B" -pointsize 42 -gravity NorthWest -annotate +2520+489 "1" \
  -fill white -stroke "#e5e7eb" -strokewidth 2 -draw "roundrectangle 1400,571 2668,651 16,16" \
  -fill "#6b7280" -font "$R" -pointsize 36 -gravity NorthWest -annotate +1436+586 "Consecutive weeks" \
  -fill "#15803d" -font "$B" -pointsize 42 -gravity NorthWest -annotate +2490+581 "12" \
  "$OUT/preview-03-onhand.png"
echo "  ✓  preview-03-onhand.png"

echo
echo "All done!  Files in: $OUT"
ls -lh "$OUT"/*.png | awk '{print $5, $9}'
