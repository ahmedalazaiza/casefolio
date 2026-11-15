B=http://localhost:3100; O="origin: http://localhost:3000"
P='{"name":"Probe","email":"probe@example.com","topic":"Exports","subject":"security probe","message":"security probe message body please ignore this ticket"}'
echo "A) same spoofed IP x12:"; s=""; for i in $(seq 1 12); do s="$s $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/help/contact -H 'content-type: application/json' -H "$O" -H 'cf-connecting-ip: 203.0.113.7' -d "$P")"; done; echo "$s"
echo "B) rotating spoofed IP x30:"; s=""; for i in $(seq 1 30); do s="$s $(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/help/contact -H 'content-type: application/json' -H "$O" -H "cf-connecting-ip: 198.51.100.$i" -d "$P")"; done; echo "$s"
echo "$s" | grep -q 429 && echo "PASS limiter engaged under rotation" || echo "FAIL limiter bypassed by rotating cf-connecting-ip (30/30 accepted)"
