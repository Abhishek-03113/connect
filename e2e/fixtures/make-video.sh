#!/usr/bin/env bash
# Builds an offline stand-in for the demo route's qcamera stream: VP9 + Opus in
# fMP4 HLS (decodable by Playwright's Chromium, which lacks H.264), with the same
# segment layout as the real route (15 x 60s + 24.05s).
set -euo pipefail
cd "$(dirname "$0")"
OUT=video
rm -rf "$OUT" && mkdir -p "$OUT"
ffmpeg -v error \
  -f lavfi -i "testsrc2=size=320x200:rate=10:duration=924.05" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=924.05" \
  -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 60k -g 20 \
  -force_key_frames "expr:gte(t,n_forced*60)" \
  -c:a libopus -b:a 16k \
  -f hls -hls_segment_type fmp4 -hls_time 60 -hls_playlist_type vod \
  -hls_fmp4_init_filename init.mp4 -hls_segment_filename "$OUT/%d.m4s" \
  "$OUT/media.m3u8"
grep EXTINF "$OUT/media.m3u8" | tr '\n' ' '; echo
du -sh "$OUT"
