#!/usr/bin/env bash
# CTA — пакетное кодирование фоновых видео-паттернов (CI-версия)
# Использование: ./encode-bg-patterns.sh [SRC_DIR] [OUT_DIR]
set -euo pipefail

SRC_DIR="${1:-./source}"
OUT_DIR="${2:-./out}"
OUT_WEBM="$OUT_DIR/webm"
OUT_MP4="$OUT_DIR/mp4"

MAX_HEIGHT="${MAX_HEIGHT:-1440}"
VP9_CRF="${VP9_CRF:-30}"
X264_CRF="${X264_CRF:-18}"
GOP="${GOP:-240}"
DEBAND_MP4="${DEBAND_MP4:-0}"

mkdir -p "$OUT_WEBM" "$OUT_MP4"
shopt -s nullglob nocaseglob

for f in "$SRC_DIR"/*.{mp4,mov,mkv,webm,avi,m4v}; do
  name="$(basename "${f%.*}")"
  # чистим имя от пробелов для веб-путей
  safe="$(echo "$name" | tr ' ' '-' | tr -cd '[:alnum:]._-')"
  echo "════ $name → $safe ════"

  h="$(ffprobe -v error -select_streams v:0 \
      -show_entries stream=height -of csv=p=0 "$f")"
  if (( h > MAX_HEIGHT )); then
    VF_BASE="scale=-2:${MAX_HEIGHT}:flags=lanczos"
  else
    VF_BASE="null"
  fi

  VF_MP4="$VF_BASE"
  if (( DEBAND_MP4 )); then
    VF_MP4="${VF_BASE},gradfun=1.2:16"
  fi

  # WebM / VP9 Profile 2 (10-bit) — 2-pass, против бандинга
  ffmpeg -hide_banner -loglevel warning -y -i "$f" -vf "$VF_BASE" \
    -c:v libvpx-vp9 -profile:v 2 -pix_fmt yuv420p10le \
    -b:v 0 -crf "$VP9_CRF" \
    -deadline good -cpu-used 4 -row-mt 1 -tile-columns 2 -threads 0 \
    -g "$GOP" -an -sn -dn -map_metadata -1 \
    -pass 1 -passlogfile "/tmp/${safe}_vp9" -f null /dev/null

  ffmpeg -hide_banner -loglevel warning -y -i "$f" -vf "$VF_BASE" \
    -c:v libvpx-vp9 -profile:v 2 -pix_fmt yuv420p10le \
    -b:v 0 -crf "$VP9_CRF" \
    -deadline good -cpu-used 2 -row-mt 1 -tile-columns 2 -threads 0 \
    -g "$GOP" -an -sn -dn -map_metadata -1 \
    -pass 2 -passlogfile "/tmp/${safe}_vp9" \
    -cues_to_front 1 \
    "$OUT_WEBM/${safe}.webm"

  # MP4 / H.264 High (8-bit) — фолбэк, faststart
  ffmpeg -hide_banner -loglevel warning -y -i "$f" -vf "$VF_MP4" \
    -c:v libx264 -preset slow -crf "$X264_CRF" \
    -profile:v high -level 4.2 -pix_fmt yuv420p \
    -x264-params "aq-mode=3:aq-strength=0.9" \
    -g "$GOP" -an -sn -dn -map_metadata -1 \
    -movflags +faststart \
    "$OUT_MP4/${safe}.mp4"

  rm -f "/tmp/${safe}_vp9-0.log"

  s_src=$(du -h "$f" | cut -f1)
  s_webm=$(du -h "$OUT_WEBM/${safe}.webm" | cut -f1)
  s_mp4=$(du -h "$OUT_MP4/${safe}.mp4" | cut -f1)
  echo "  src: $s_src → webm: $s_webm | mp4: $s_mp4"
done

echo "── Итог ──"
du -sh "$OUT_WEBM" "$OUT_MP4"
