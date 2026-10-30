#!/usr/bin/env bash
# Director's Table: assemble the demo video.
#   demo/build.sh <table_recording.webm|mp4> [intro.mp4] [outro.mp4] [music.mp3] [out.mp4]
# Pass "-" to skip any of the optional parts. Everything is scaled to 1920x1080 @30fps.
# Example:
#   demo/build.sh out/rec.webm clips/conductor_up.mp4 clips/conductor_down.mp4 music.mp3 final.mp4
set -euo pipefail
REC="${1:?recording required}"; INTRO="${2:--}"; OUTRO="${3:--}"; MUSIC="${4:--}"; OUT="${5:-directors-table-demo.mp4}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
VF="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p,setsar=1"

norm() { # $1 in, $2 out; keeps the clip's own sound or adds silence
  if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1" | grep -q .; then
    ffmpeg -v error -y -i "$1" -vf "$VF" -c:v libx264 -crf 18 -preset medium -c:a aac -ar 48000 -ac 2 "$2"
  else
    ffmpeg -v error -y -i "$1" -f lavfi -i anullsrc=r=48000:cl=stereo -shortest -vf "$VF" -c:v libx264 -crf 18 -preset medium -c:a aac "$2"
  fi
}

LIST="$TMP/list.txt"; : > "$LIST"; i=0
for part in "$INTRO" "$REC" "$OUTRO"; do
  [ "$part" = "-" ] && continue
  i=$((i+1)); norm "$part" "$TMP/p$i.mp4"; echo "file '$TMP/p$i.mp4'" >> "$LIST"
done
ffmpeg -v error -y -f concat -safe 0 -i "$LIST" -c copy "$TMP/joined.mp4"

if [ "$MUSIC" != "-" ]; then
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/joined.mp4")
  FO=$(python3 -c "print(max(0,float('$D')-3))")
  # music under the clips' own sound, fade in 1 s, fade out 3 s, loudness normalised
  ffmpeg -v error -y -i "$TMP/joined.mp4" -stream_loop -1 -i "$MUSIC" -filter_complex \
    "[1:a]volume=0.55,afade=t=in:d=1,afade=t=out:st=$FO:d=3[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -t "$D" -movflags +faststart "$OUT"
else
  ffmpeg -v error -y -i "$TMP/joined.mp4" -c copy -movflags +faststart "$OUT"
fi
echo "done: $OUT"
