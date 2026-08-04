#!/usr/bin/env python3
"""Upload file to RunPod via base64 chunks with verification."""
import paramiko, time, base64, os, sys, re, hashlib

HOST = 'ssh.runpod.io'
USER = '4mpv7wexfjrzpa-64410b42'
KEY = '/home/cyberkitty/.ssh/runpod_key'

def connect():
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
    return ssh, chan

def send_cmd(chan, cmd, wait=1):
    chan.send(cmd.encode() + b'\n')
    time.sleep(wait)
    buf = b''
    while chan.recv_ready():
        buf += chan.recv(65536)
    return buf.decode(errors='replace')

def upload_file(local_path, remote_path):
    filesize = os.path.getsize(local_path)
    print(f"Uploading {local_path} ({filesize//1024}KB)")
    
    ssh, chan = connect()
    
    # Remove old file
    send_cmd(chan, f'rm -f {remote_path}')
    
    # Send in small chunks via printf + base64
    sent = 0
    chunk_size = 2048  # 2KB raw = ~2.7KB base64
    
    with open(local_path, 'rb') as f:
        while True:
            raw = f.read(chunk_size)
            if not raw:
                break
            b64 = base64.b64encode(raw).decode()
            # printf avoids echo escape issues
            send_cmd(chan, f'printf %s "{b64}" | base64 -d >> {remote_path}', wait=0.05)
            sent += len(raw)
            if sent % (512*1024) < chunk_size:
                print(f"  {sent//1024}KB/{filesize//1024}KB ({sent*100//filesize}%)")
    
    # Verify size
    time.sleep(2)
    result = send_cmd(chan, f'wc -c {remote_path}', wait=2)
    result = re.sub(r'\x1b\[[^m]*m', '', result)
    print(f"Remote size: {result.strip()}")
    
    # Check MD5
    local_md5 = hashlib.md5(open(local_path, 'rb').read()).hexdigest()
    result = send_cmd(chan, f'md5sum {remote_path}', wait=3)
    result = re.sub(r'\x1b\[[^m]*m', '', result)
    print(f"Local MD5:  {local_md5}")
    print(f"Remote MD5: {result.strip()}")
    
    ssh.close()

if __name__ == '__main__':
    upload_file(sys.argv[1], sys.argv[2])