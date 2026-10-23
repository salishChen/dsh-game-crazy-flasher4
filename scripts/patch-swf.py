"""Compile only our bridge with FFDec, then insert its DoAction at original frame 6.

The intermediate frame-21 replacement is a compiler carrier, never the shipped game.
Original action tags, visuals, sound and game logic remain byte-for-byte intact.
"""
import argparse, hashlib, pathlib, struct, subprocess, tempfile, zlib, json

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPECTED = '4f41e62500fd6542f6e497bf71089db8a62e2d089504bbab1dc0b6f82b15f736'

def unpack(data):
    if data[:3] != b'CWS' or data[3] != 8:
        raise ValueError('Expected the supplied Flash 8 CWS')
    raw = zlib.decompress(data[8:])
    if len(raw) + 8 != struct.unpack_from('<I', data, 4)[0]:
        raise ValueError('SWF size mismatch')
    return raw

def tags(raw):
    pos = (5 + 4 * (raw[0] >> 3) + 7) // 8 + 4
    frame = 1
    while pos < len(raw):
        start = pos
        h, = struct.unpack_from('<H', raw, pos); pos += 2
        kind, size = h >> 6, h & 63
        if size == 63:
            size, = struct.unpack_from('<I', raw, pos); pos += 4
        end = pos + size
        yield frame, kind, start, end, raw[pos:end]
        pos = end
        if kind == 1: frame += 1

def main():
    p = argparse.ArgumentParser(); p.add_argument('--java', default='java'); p.add_argument('--ffdec', required=True)
    args = p.parse_args()
    original = (ROOT/'assets/original.swf').read_bytes()
    digest = hashlib.sha256(original).hexdigest()
    if digest != EXPECTED: raise ValueError('Unknown source SWF; audit a new patch before building')
    raw = unpack(original)
    with tempfile.TemporaryDirectory(prefix='cf4-compile-') as tmp:
        carrier = pathlib.Path(tmp)/'carrier.swf'
        result = subprocess.run([args.java,'-jar',args.ffdec,'-replace',str(ROOT/'assets/original.swf'),str(carrier),r'\frame_21\DoAction',str(ROOT/'src/bridge.as')],capture_output=True)
        if result.returncode or not carrier.exists():
            raise RuntimeError((result.stdout+result.stderr).decode('utf8',errors='replace'))
        compiled = [(s,e,payload) for f,k,s,e,payload in tags(unpack(carrier.read_bytes())) if f==21 and k==12]
        if len(compiled)!=1 or b'cf4Restore' not in compiled[0][2]: raise ValueError('Bridge compiler output missing')
        payload = compiled[0][2]
    tag = struct.pack('<HI', (12 << 6) | 63, len(payload)) + payload
    insertion = next(s for f,k,s,e,p in tags(raw) if f==6 and k==1)
    patched = raw[:insertion]+tag+raw[insertion:]
    output = b'CWS'+original[3:4]+struct.pack('<I',len(patched)+8)+zlib.compress(patched,9)
    (ROOT/'assets/game.swf').write_bytes(output)
    (ROOT/'assets/patch-info.json').write_text(json.dumps({'sourceSha256':digest,'patchedSha256':hashlib.sha256(output).hexdigest(),'bridgeSha256':hashlib.sha256((ROOT/'src/bridge.as').read_bytes()).hexdigest(),'originalTagsUnchanged':True,'insertedFrame':6,'insertedActionBytes':len(payload)},indent=2)+'\n',encoding='utf8')
    original_tags=[raw[s:e] for f,k,s,e,p in tags(raw)]
    patched_tags=[patched[s:e] for f,k,s,e,p in tags(patched)]
    patched_tags.remove(tag)
    if patched_tags!=original_tags: raise ValueError('Unexpected original-tag modification')
    print('Patched SWF:',len(output),'bytes; every original tag verified unchanged')

if __name__=='__main__': main()
