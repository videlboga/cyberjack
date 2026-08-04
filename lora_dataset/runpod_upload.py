#!/usr/bin/env python3
"""Upload file to RunPod via PTY base64 chunks."""
import paramiko, time, sys, os, base64

HOST = 'ssh.runpod.io'
USER = '4mpv7wexfjrzpa-64410b42'
KEY = '/home/cyberkitty/.ssh/runpod_key'

def upload(local_path, remote_path, chunk_size=4096):
    """Upload a file via base64 chunks through PTY."""
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, key_filename=KEY)
    
    chan = ssh.get_transport().open_session()
    chan.get_pty()
    chan.invoke_shell()
    
    # Wait for prompt
    buf = b''
    start = time.time()
    while time.time() - start < 30:
        if chan.recv_ready():
            buf += chan.recv(65536)
            if b'root@' in buf and b'# ' in buf:
                break
        time.sleep(0.2)
    
    # Start base64 decode on remote
    chan.send(f'base64 -d > {remote_path}\n'.encode())
    time.sleep(0.5)
    
    # Read and discard prompt
    while chan.recv_ready():
        chan.recv(65536)
    
    # Send file in base64 chunks
    filesize = os.path.getsize(local_path)
    sent = 0
    with open(local_path, 'rb') as f:
        while True:
            raw = f.read(chunk_size)
            if not raw:
                break
            encoded = base64.b64encode(raw)
            chan.send(encoded)
            sent += len(raw)
            if sent % (1024*1024) < chunk_size:
                print(f"  {sent//1024}KB/{filesize//1024}KB ({sent*100//filesize}%)")
            
            # Drain any output to avoid buffer full
            while chan.recv_ready():
                chan.recv(65536)
            time.sleep(0.01)
    
    # Send EOF (Ctrl-D)
    chan.send(b'\x04')
    time.sleep(2)
    
    # Read result
    while chan.recv_ready():
        chan.recv(65536)
    
    # Verify
    chan.send(f'ls -lh {remote_path}\n'.encode())
    time.sleep(3)
    result = b''
    while chan.recv_ready():
        result += chan.recv(65536)
    
    print(result.decode(errors='replace'))
    ssh.close()

if __name__ == '__main__':
    local = sys.argv[1]
    remote = sys.argv[2]
    upload(local, remote)