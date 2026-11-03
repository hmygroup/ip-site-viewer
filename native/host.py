"""Native messaging host: resuelve un hostname con el resolver del SO (DNS interno incluido)."""
import json
import re
import socket
import struct
import sys

if sys.platform == "win32":
    import msvcrt, os
    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

HOST_RE = re.compile(r"^[A-Za-z0-9._-]{1,253}$")


def read():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    n = struct.unpack("<I", raw)[0]
    return json.loads(sys.stdin.buffer.read(n))


def send(obj):
    data = json.dumps(obj).encode()
    sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
    sys.stdout.buffer.flush()


while True:
    msg = read()
    if msg is None:
        break
    host = str(msg.get("host", ""))
    if not HOST_RE.match(host):
        send({"error": "host no válido"})
        continue
    try:
        ips = sorted({i[4][0] for i in socket.getaddrinfo(host, None)})
        send({"ips": ips})
    except Exception as e:
        send({"error": str(e)})
