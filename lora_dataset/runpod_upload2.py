#!/usr/bin/env python3
"""Upload file to RunPod via base64 echo chunks + cat assembly."""
import paramiko, time, base64, os, sys

HOST = 'ssh.runpod.io'
USER = '4mpv7wexfjrzpa-64410b42'
KEY = '/home/cyberkitty/.ssh/runpod_key'

def upload(local_path, remote_path):
    filesize = os.path.getsize(local_path)
    print(f"Uploading {local_path} ({filesize//1024}KB) to {remote_path}")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, key_filename=KEY)
    
    chan = ssh.get_transport().open_session()
    chan.get_pty()
    chan.invoke_shell()
    
    # Wait for prompt
    buf = b''
    for _ in range(100):
        if chan.recv_ready():
            buf += chan.recv(65536)
            if b'root@' in buf and b'# ' in buf:
                break
        time.sleep(0.2)
    
    # Remove old file
    chan.send(f'rm -f {remote_path}\n'.encode())
    time.sleep(0.5)
    while chan.recv_ready():
        chan.recv(65536)
    
    # Send file in base64 chunks, append each to remote file
    sent = 0
    chunk_raw = 3072  # small enough for echo command line
    
    with open(local_path, 'rb') as f:
        while True:
            raw = f.read(chunk_raw)
            if not raw:
                break
            b64 = base64.b64encode(raw).decode()
            # Use printf to avoid echo escape issues, append to file
            cmd = f'printf %s "{b64}" | base64 -d >> {remote_path}\n'
            chan.send(cmd.encode())
            sent += len(raw)
            
            # Drain output
            time.sleep(0.01)
            while chan.recv_ready():
                chan.recv(65536)
            
            if sent % (512*1024) < chunk_raw:
                print(f"  {sent//1024}KB/{filesize//1024}KB ({sent*100//filesize}%)")
    
    # Wait and verify
    time.sleep(2)
    while chan.recv_ready():
        chan.recv(65536)
    
    chan.send(f'wc -c {remote_path}\n'.encode())
    time.sleep(3)
    buf = b''
    while chan.recv_ready():
        buf += chan.recv(65536)
    
    import re
    output = re.sub(r'\x1b\[[^m]*m', '', buf.decode(errors='replace'))
    print(f"Remote: {output.strip()}")
    ssh.close()

if __name__ == '__main__':
    upload(sys.argv[1], sys.argv[2])