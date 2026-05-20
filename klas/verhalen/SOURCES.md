# Sources & Public Domain Justification

All assets in this bundle are in the U.S. public domain (works published before 1929).

## audio.mp3

- **Title**: "The Lion And The Mouse" (Aesop's Fables, Vol. 01, track 19)
- **Narrator**: Robert Garrison (LibriVox reader #439)
- **Duration**: 107.29 seconds (1:47)
- **Format**: MPEG ADTS Layer III v2, 64 kbps, 24 kHz, joint stereo
- **LibriVox project page**: https://librivox.org/aesops-fables-volume-1-fables-1-25/
- **Direct download (Archive.org)**: https://www.archive.org/download/aesop_fables_volume_one_librivox/fables_01_19_aesop_64kb.mp3
- **License**: Public domain. LibriVox explicitly dedicates all of its recordings to the public domain. From librivox.org: "All LibriVox recordings are in the Public Domain in the USA and available as free downloads on the internet."
- **Reader page**: https://librivox.org/reader/439

## page-01.jpg through page-05.jpg

All five page illustrations are derived from a **single full-page color plate** by **Milo Winter (1888-1956)** in *The Aesop for Children* (Rand McNally, 1919), public domain in the U.S. (published before 1929).

- **Primary source for high-resolution plate**:
  - Internet Archive scan: https://archive.org/details/aesopforchildren0000milo
  - Direct PDF: https://archive.org/download/aesopforchildren0000milo/aesopforchildren0000milo.pdf
  - Rights declared on IA item metadata: "Public domain in the USA"
  - Plate appears on PDF page 25 (book page 23), opposite the fable text "THE LION AND THE MOUSE"
- **Cross-reference (text + thumbnail)**:
  - Project Gutenberg ebook #19994: https://www.gutenberg.org/ebooks/19994
  - HTML zip with thumbnail plate as `images/i014_th.jpg`: https://www.gutenberg.org/cache/epub/19994/pg19994-h.zip

### Per-page derivation

The original plate (page 25 of the PDF) was rendered with `pdftoppm -r 600` to 4640x6072px, then cropped to extract just the illustrated area (4380x2900px). Each `page-NN.jpg` is a different crop of that same single plate, resized to 1600px on the long edge with `magick ... -resize '1600x1600>' -quality 85`. No content was added, recolored, or altered beyond cropping and JPEG re-encoding.

- `page-01.jpg` — full plate (establishing illustration)
- `page-02.jpg` — bottom-left crop (mouse on the forest path)
- `page-03.jpg` — center-top crop (lion's head)
- `page-04.jpg` — right-side crop (lion caught in net)
- `page-05.jpg` — wide left-and-down crop (mouse gnawing rope while lion looks on)

### Public-domain justification for the Milo Winter plate

*The Aesop for Children* was first published in 1919 by Rand McNally & Co., Chicago, with Milo Winter as illustrator. Under U.S. copyright law, all works published in the United States before January 1, 1929 entered the public domain (see 17 U.S.C. and the Sonny Bono Copyright Term Extension Act). The work has been freely redistributed by Project Gutenberg (ebook 19994) and the Internet Archive precisely on that basis. The Internet Archive item's metadata explicitly carries the rights statement "Public domain in the USA."

## Tools used

- `curl` — file download
- `pdftoppm` (poppler) — render PDF page to 600 DPI JPEG
- `pdftotext` — locate fable in PDF
- `magick` (ImageMagick 7) — crop and resize
- `sips` — verify pixel dimensions
- `ffprobe` — verify audio duration and codec
