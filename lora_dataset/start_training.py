#!/usr/bin/env python3
"""Start training via Jupyter kernel API."""
import requests, json, time, websocket

JUPYTER = "https://qkvj0fischlq0m-64411f5f-8888.proxy.runpod.net"
TOKEN="s6cv...DERS = {"Authorization": "token " + TOKEN}

# Start kernel
resp = requests.post(JUPYTER + "/api/kernels", headers=HEADERS, json={"name": "python3"}, timeout=30)
print(f"Kernel: {resp.status_code}")
if resp.status_code != 201:
    print(f"Failed: {resp.text[:200]}")
    exit(1)

kernel_id = resp.json()["id"]
print(f"Kernel ID: {kernel_id}")

# Connect websocket
ws_url = f"wss://qkvj0fischlq0m-64411f5f-8888.proxy.runpod.net/api/kernels/{kernel_id}/channels"
ws = websocket.create_connection(ws_url, header=[f"Authorization: token {TOKEN}"], timeout=30)

# Send execute request
msg = {
    "header": {"msg_id": "1", "username": "user", "session": "s1", "msg_type": "execute_request", "version": "5.3"},
    "parent_header": {}, "metadata": {},
    "content": {
        "code": "import subprocess; p=subprocess.Popen(['python3','/workspace/train_lora.py'], stdout=open('/workspace/train.log','w'), stderr=subprocess.STDOUT); print(f'PID={p.pid}')",
        "silent": False, "store_history": True, "user_expressions": {}, "allow_stdin": False
    }
}
ws.send(json.dumps(msg))

# Read response
for _ in range(15):
    try:
        data = json.loads(ws.recv())
        if data.get("msg_type") == "stream":
            print(data["content"]["text"], end="")
        elif data.get("msg_type") == "execute_result":
            print(data["content"]["data"].get("text/plain",""))
        elif data.get("msg_type") == "status" and data["content"].get("execution_state") == "idle":
            break
    except websocket.WebSocketTimeoutException:
        break
    except Exception as e:
        print(f"Error: {e}")
        break

ws.close()
print("\nDone!")