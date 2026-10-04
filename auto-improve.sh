#!/bin/bash
COUNT=0
while true; do
  COUNT=$((COUNT+1))
  TS=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$TS] === NEXUS AUTO-IMPROVE #$COUNT ==="
  bash build.sh > /dev/null 2>&1
  if ! git diff --quiet index.html _src/; then
    git add -A
    git -c user.name="Jesulac" -c user.email="jesuspancor@gmail.com" commit -q -m "auto: mejora continua #$COUNT - $TS"
    git push -q origin master
    sleep 3
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://jesulac.github.io/nexus/")
    echo "[$TS] OK mejora #$COUNT - HTTP $HTTP"
  else
    echo "[$TS] Sin cambios"
  fi
  sleep 120
done
