# Short video editor for FB/YT

**Cutroom** is a browser video editor for removing unwanted sections, combining multiple videos, and exporting an MP4 for Facebook or YouTube. Video files are processed locally in a Web Worker; there is no video upload server and no watermark.

[Open the hosted editor](https://tonmoy-short-video-editor.humble-bell-8288.chatgpt.site) (owner's ChatGPT sign-in required). The source repository is public; the hosted workspace is private.

## Use it

1. Add one or more videos. MP4 (H.264/AAC) and WebM are the most predictable inputs; MOV support depends on your browser's codecs.
2. Select a clip in the timeline. Scrub to an unwanted section's start and click **Set start**, then set its end and click **Set end**.
3. Click **Remove section**. Both remaining sides stay in the timeline. Repeat as needed.
4. Use **Earlier**, **Later**, **Split at playhead**, **Delete**, **Undo**, and **Redo** to arrange your edit.
5. Choose a format and click **Export MP4**. Download the file. Change the format and export again for your other platform.

বাংলা: ভিডিও যোগ করুন → অপ্রয়োজনীয় অংশের শুরু ও শেষ ঠিক করুন → Remove section → Facebook বা YouTube-এর মাপ বাছুন → Export MP4 → Download।

| Preset | Ratio | 1080 setting | 720 setting |
|---|---|---|---|
| Facebook Reels / YouTube Shorts | 9:16 | 1080×1920 | 720×1280 |
| Facebook Feed | 4:5 | 1080×1350 | 720×900 |
| YouTube landscape | 16:9 | 1920×1080 | 1280×720 |
| Square | 1:1 | 1080×1080 | 720×720 |

**Fit** preserves the whole picture and adds black bars when needed. **Fill** crops centrally. Original audio is preserved and normalized to stereo AAC at 48 kHz; silent sources receive a silent audio track so they can be joined reliably. Outputs use H.264, AAC, 30 fps, and MP4 fast-start metadata.

## Run locally

Requires Python 3. Node 20+ is only needed for tests.

```sh
python prepare.py
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8765 in desktop Chrome or Edge. Do not open index.html with file://, because module workers require an HTTP origin. `prepare.py` downloads pinned official npm packages (@ffmpeg/ffmpeg 0.12.15 and @ffmpeg/core 0.12.10) and reconstructs the static browser runtime. Generated engine assets are omitted from the GitHub source snapshot; run the preparation command first. This requires network access once. The WASM file is split into 8 MB assets to accommodate static hosting per-file size limits.

## Test

```sh
node --test tests/editor.test.mjs
node tests/codec-test.mjs
```

The integration test runs the actual browser WASM codec against synthetic red/blue video and audio fixtures, removes a middle section, joins different orientations and a silent source, checks H.264/AAC streams, dimensions and duration, and decodes the exported MP4.

## Limits and privacy

- Keep this tab open during export. The first export loads about 32 MB of engine assets. Encoding is CPU/memory intensive and can take several minutes; 720p is the faster default.
- The workspace limits source files to 500 MB total. A device may run out of memory below that limit; choose smaller videos if export fails.
- Edits live in memory. Refreshing or closing the page loses the edit. Original files are never modified. Downloads must be saved before leaving.
- No accounts, tracking, upload endpoint, or automatic Facebook/YouTube posting. You manually upload the downloaded MP4 to each platform.
- Browser preview must be able to decode the source. Exotic codecs, DRM, HDR/color-managed mastering, and frame-perfect professional editing are outside this tool's scope.
- Google Fonts is used for typography; it receives ordinary font requests, never video data.

## Dependencies

The FFmpeg JavaScript wrapper is MIT licensed. The bundled ffmpeg.wasm core contains FFmpeg and libx264 and is GPL-licensed. See [THIRD_PARTY.md](THIRD_PARTY.md) for source and build references. The application source is licensed under GPL-3.0-or-later for compatibility with the distributed engine.
