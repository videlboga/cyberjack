#!/bin/bash
export SUBJECT=$(sqlite3 cyberjack.sqlite "SELECT id FROM subjects LIMIT 1;")
if [ -z "$SUBJECT" ]; then
  SUBJECT="12345"
  curl -s -X POST -H 'Content-Type: application/json' -d '{"subjectId":"12345"}' http://localhost:3000/api/init > /dev/null
fi
echo "Subject: $SUBJECT"

echo "Looping..."
for i in {1..3}; do
  curl -s -X POST -H 'Content-Type: application/json' -d "{\"subjectId\":\"$SUBJECT\", \"actionId\":\"slap\", \"pointId\":\"leg\"}" http://localhost:3000/api/action > curl_out_$i.json
done
echo "Chat history for subject: $SUBJECT"
sqlite3 cyberjack.sqlite "SELECT role, content FROM chat_memory WHERE subject_id='$SUBJECT' ORDER BY id DESC LIMIT 5"
