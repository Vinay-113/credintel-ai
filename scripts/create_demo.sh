#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROLL_NUMBER="${1:-SE23UCSE186}"
FFMPEG="$ROOT/tmp/video-tool/node_modules/ffmpeg-static/ffmpeg"
WORK="$ROOT/tmp/demo/video"
OUT="$ROOT/submission/$ROLL_NUMBER.mp4"
FONT="/System/Library/Fonts/Supplemental/Arial.ttf"

if [[ ! "$ROLL_NUMBER" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Roll number may contain only letters, numbers, underscore, or hyphen." >&2
  exit 1
fi

mkdir -p "$WORK" "$ROOT/submission"

if [[ ! -x "$FFMPEG" ]]; then
  echo "ffmpeg-static is missing. Run: npm install --prefix tmp/video-tool --no-save ffmpeg-static" >&2
  exit 1
fi

make_segment() {
  local index="$1"
  local image="$2"
  local duration="$3"
  local caption="$4"
  local fade_out
  fade_out=$(awk -v d="$duration" 'BEGIN { printf "%.1f", d - 0.5 }')

  "$FFMPEG" -hide_banner -loglevel error -y \
    -loop 1 -i "$image" -t "$duration" \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x102126,drawbox=x=0:y=628:w=1280:h=92:color=0x102126@0.94:t=fill,drawtext=fontfile='$FONT':text='$caption':fontcolor=white:fontsize=27:x=48:y=655,fade=t=in:st=0:d=0.5,fade=t=out:st=$fade_out:d=0.5,format=yuv420p" \
    -r 30 -an -c:v libx264 -preset medium -crf 18 "$WORK/segment-$index.mp4"
}

make_segment "01" "$ROOT/public/og.png" 5 "CredIntel AI - explainable underwriting for new-to-credit applicants"
make_segment "02" "$ROOT/docs/assets/demo-01-approve.png" 8 "Approve - repayment confidence, fraud risk, latency, and reasons"
make_segment "03" "$ROOT/docs/assets/demo-02-explanation.png" 9 "Trace every recommendation to feature contributions and policy checks"
make_segment "04" "$ROOT/docs/assets/demo-03-review.png" 8 "Review - strong evidence with an affordability policy flag"
make_segment "05" "$ROOT/docs/assets/demo-04-decline.png" 9 "Decline - the fraud evidence that drove the outcome appears first"
make_segment "06" "$ROOT/docs/assets/demo-05-queue.png" 6 "Review queue - risk-ranked cases for human ownership"
make_segment "07" "$ROOT/docs/assets/demo-06-monitoring.png" 7 "Model monitoring - validation, drift, fairness, and governance"
make_segment "08" "$ROOT/docs/assets/demo-07-audit.png" 7 "Audit trail - timestamped evidence across the full decision chain"

printf '%s\n' \
  "file '$WORK/segment-01.mp4'" \
  "file '$WORK/segment-02.mp4'" \
  "file '$WORK/segment-03.mp4'" \
  "file '$WORK/segment-04.mp4'" \
  "file '$WORK/segment-05.mp4'" \
  "file '$WORK/segment-06.mp4'" \
  "file '$WORK/segment-07.mp4'" \
  "file '$WORK/segment-08.mp4'" > "$WORK/concat.txt"

"$FFMPEG" -hide_banner -loglevel error -y -f concat -safe 0 -i "$WORK/concat.txt" \
  -c copy "$WORK/walkthrough-silent.mp4"

say -r 170 -f "$ROOT/docs/demo-narration.txt" -o "$WORK/narration.aiff"

"$FFMPEG" -hide_banner -loglevel error -y \
  -i "$WORK/walkthrough-silent.mp4" -i "$WORK/narration.aiff" \
  -filter_complex "[1:a]loudnorm=I=-18:LRA=8:TP=-2,apad[a]" \
  -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"

echo "Wrote $OUT"
