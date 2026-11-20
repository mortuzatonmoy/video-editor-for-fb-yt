# Third-party engine notices

- @ffmpeg/ffmpeg 0.12.15: MIT. Source: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.15
- @ffmpeg/core 0.12.10: GPL-2.0-or-later; build includes GPL components including libx264. Source and reproducible build configuration: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10
- FFmpeg: https://ffmpeg.org/legal.html and https://github.com/FFmpeg/FFmpeg
- x264: https://www.videolan.org/developers/x264.html

Pinned package distributions are retrieved from https://registry.npmjs.org/ by prepare.py. The unmodified core WebAssembly is split into chunks for transport, then reassembled byte-for-byte before execution. No codec source is modified. See upstream Dockerfile, build scripts, and library versions for corresponding source and build instructions.

Application source: GPL-3.0-or-later. Copyright (C) 2026 mortuzatonmoy.
This software is provided without warranty. See LICENSE for the full GNU General Public License.
