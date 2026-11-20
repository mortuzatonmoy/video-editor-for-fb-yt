"""Download pinned official npm distributions; no package manager required."""
import io, json, tarfile, urllib.request
from pathlib import Path
root = Path(__file__).parent
vendor = root / 'dist/vendor'
vendor.mkdir(parents=True, exist_ok=True)
for package, version in [('ffmpeg', '0.12.15'), ('core', '0.12.10')]:
    url = f'https://registry.npmjs.org/@ffmpeg/{package}/-/{package}-{version}.tgz'
    archive = tarfile.open(fileobj=io.BytesIO(urllib.request.urlopen(url).read()), mode='r:gz')
    for member in archive.getmembers():
        path = member.name
        if not member.isfile(): continue
        if path.startswith('package/dist/esm/') and path.endswith('.js'):
            target = vendor / package / Path(path).name
        elif package == 'core' and path == 'package/dist/esm/ffmpeg-core.wasm':
            data = archive.extractfile(member).read()
            parts = []
            for i, offset in enumerate(range(0, len(data), 8*1024*1024)):
                target = vendor / f'core-{i}.bin'
                target.write_bytes(data[offset:offset+8*1024*1024])
                parts.append(target.name)
            (vendor/'core-parts.json').write_text(json.dumps(parts))
            continue
        elif 'LICENSE' in Path(path).name.upper():
            target = vendor / f'{package}-{Path(path).name}'
        else: continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.extractfile(member).read())
print('Pinned FFmpeg browser engine prepared.')
