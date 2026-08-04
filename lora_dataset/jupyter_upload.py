#!/usr/bin/env python3
"""Upload files to RunPod via Jupyter API in chunks."""
import requests, base64, json, os, sys, time

JUPYTER = "https://4mpv7wexfjrzpa-64410b42-8888.proxy.runpod.net"
TOKEN = "s6cvu3fdxu5w3kx4vdub"
HEADERS = {"Authorization": f"token {TOKEN}"}

def upload(local_path, remote_path):
    filesize = os.path.getsize(local_path)
    print(f"Uploading {local_path} ({filesize//1024}KB) -> {remote_path}")
    
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    
    resp = requests.put(
        f"{JUPYTER}/api/contents/{remote_path}",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"type": "file", "format": "base64", "content": content},
        timeout=120
    )
    print(f"  Status: {resp.status_code}")
    return resp.status_code == 201

def upload_multipart(local_path, remote_dir, chunk_size=256*1024):
    """Upload large file in chunks, then cat on remote."""
    filesize = os.path.getsize(local_path)
    print(f"Uploading {local_path} ({filesize//1024}KB) in chunks...")
    
    basename = os.path.basename(local_path)
    parts = []
    
    with open(local_path, "rb") as f:
        idx = 0
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            part_name = f"{basename}.part{idx:03d}"
            parts.append(part_name)
            content = base64.b64encode(chunk).decode()
            
            resp = requests.put(
                f"{JUPYTER}/api/contents/{remote_dir}/{part_name}",
                headers={**HEADERS, "Content-Type": "application/json"},
                json={"type": "file", "format": "base64", "content": content},
                timeout=60
            )
            if resp.status_code != 201:
                print(f"  Part {idx} failed: {resp.status_code} {resp.text[:100]}")
                return False
            
            idx += 1
            sent = idx * chunk_size
            print(f"  Part {idx} ({min(sent, filesize)//1024}KB/{filesize//1024}KB) OK")
    
    # Cat parts together on remote via Jupyter terminal API
    cat_cmd = f"cd /workspace && cat {' '.join(parts)} > {basename} && rm {' '.join(parts)}"
    print(f"  Assembling: {cat_cmd[:80]}...")
    
    # Use Jupyter API to run command
    resp = requests.post(
        f"{JUPYTER}/api/contents/{remote_dir}/assemble.sh",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"type": "file", "format": "text", "content": cat_cmd},
        timeout=30
    )
    
    print(f"  Assembly script uploaded: {resp.status_code}")
    print(f"  Run on remote: bash /workspace/assemble.sh")
    return True

if __name__ == "__main__":
    local = sys.argv[1]
    remote = sys.argv[2] if len(sys.argv) > 2 else "workspace/"
    upload_multipart(local, remote)