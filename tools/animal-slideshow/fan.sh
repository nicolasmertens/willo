#!/usr/bin/env bash
set -euo pipefail
SP="/private/tmp/claude-501/-Users-nico/704e902b-c061-486b-8ef5-292c7c10714d/scratchpad"
cd "$SP"
C=1120; CX=560; CY=540
D=430; FITH=398           # disc size; head fits within FITH
mkdir -p fan
magick -size ${D}x${D} xc:none -fill white -draw "circle $((D/2)),$((D/2)) $((D/2)),3" -colorspace sRGB PNG32:fan/ring.png

order=(dog lion elephant monkey parrot)
N=${#order[@]}

make_disc() {
  local name="$1" out="$2"
  local bg; bg=$(magick "heads/${name}.png" -format "%[pixel:p{4,4}]" info:)
  # remove connected cream background from the 4 corners -> transparent cutout
  magick "heads/${name}.png" -alpha set -fuzz 16% \
    -fill none -draw "color 4,4 floodfill" -draw "color 763,4 floodfill" \
    -draw "color 4,763 floodfill" -draw "color 763,763 floodfill" \
    -trim +repage -resize ${FITH}x${FITH} fan/_cut.png
  # center cutout on white ring disc
  magick fan/ring.png fan/_cut.png -gravity center -composite -colorspace sRGB PNG32:"$out"
}

magick -size ${C}x${C} radial-gradient:#fff7e6-#ffd9a0 fan/canvas.png
step=150
declare -a posx posy ang
for i in $(seq 0 $((N-1))); do
  posx[$i]=$(python3 -c "print(int($CX + ($i-($N-1)/2.0)*$step))")
  dx=$(python3 -c "print(${posx[$i]}-$CX)")
  posy[$i]=$(python3 -c "print(int($CY + 0.0006*($dx)**2))")
  ang[$i]=$(python3 -c "print(round(($dx)*0.028,1))")
done
IDX_ORDER=$(python3 -c "n=$N;c=(n-1)/2.0;print(' '.join(map(str,sorted(range(n),key=lambda i:-abs(i-c)))))")
for i in $IDX_ORDER; do
  make_disc "${order[$i]}" fan/d_$i.png
  magick fan/d_$i.png -background none -rotate "${ang[$i]}" fan/dr_$i.png
  ox=$(python3 -c "print(int(${posx[$i]} - $D/2))")
  oy=$(python3 -c "print(int(${posy[$i]} - $D/2))")
  magick fan/canvas.png fan/dr_$i.png -geometry +${ox}+${oy} -composite fan/canvas.png
done
magick fan/canvas.png -resize 512x512 -quality 90 fan_hero.jpg
echo "wrote fan_hero.jpg ($(ls -la fan_hero.jpg|awk '{print $5}')B)"
