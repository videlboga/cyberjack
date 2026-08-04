#!/usr/bin/env python3
"""RunPod SSH helper — interactive PTY mode."""
import paramiko, time, sys, re

HOST = 'ssh.runpod.io'
USER = '4mpv7wexfjrzpa-64410b42'
KEY = '/home/cyberkitty/.ssh/runpod_key'

def run_remote(cmd, timeout=120):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, key_filename=KEY)
    
    chan = ssh.get_transport().open_session()
    chan.get_pty()
    chan.invoke_shell()
    
    # Wait for first prompt
    buf = b''
    start = time.time()
    while time.time() - start < 30:
        if chan.recv_ready():
            buf += chan.recv(65536)
            if b'root@' in buf and b'# ' in buf:
                break
        time.sleep(0.2)
    
    # Send command + marker
    marker = '___CMD_DONE___'
    chan.send(cmd.encode() + b'\n')
    time.sleep(0.3)
    chan.send(f'echo {marker}\n'.encode())
    
    # Read until marker appears
    buf = b''
    start = time.time()
    while time.time() - start < timeout:
        if chan.recv_ready():
            buf += chan.recv(65536)
            if marker.encode() in buf:
                break
        time.sleep(0.1)
    
    ssh.close()
    
    # Parse: strip ANSI codes, extract between command echo and marker
    output = buf.decode(errors='replace')
    output = re.sub(r'\x1b\[[^m]*m', '', output)  # strip ANSI colors
    output = re.sub(r'\x1b\[\?[0-9;]*[a-zA-Z]', '', output)  # strip ANSI escapes
    output = re.sub(r'\x1b\][^\x07]*\x07', '', output)  # strip title sequences
    
    lines = output.split('\n')
    clean = []
    found_cmd = False
    for line in lines:
        line = line.strip('\r')
        if marker in line:
            break
        if cmd in line and not found_cmd:
            found_cmd = True
            continue
        if not found_cmd:
            continue
        if line.strip():
            clean.append(line.strip())
    
    return '\n'.join(clean)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'echo hello'
    result = run_remote(cmd)
    print(result)