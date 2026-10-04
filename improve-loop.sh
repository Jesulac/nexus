#!/bin/bash
# NEXUS continuous improvement loop - NEVER STOPS
COUNT=0
while true; do
  COUNT=$((COUNT+1))
  TS=$(date '+%Y-%m-%d %H:%M:%S')
  echo ""
  echo "[$TS] === NEXUS continuous improve #$COUNT ==="
  
  # Build
  bash build.sh > /dev/null 2>&1
  
  # Verificar si hay cambios
  if git diff --quiet index.html && git diff --quiet _src/; then
    echo "[$TS] Sin cambios nuevos"
  else
    git add -A
    git -c user.name="Jesulac" -c user.email="jesuspancor@gmail.com" commit -q -m "auto: continuous improve #$COUNT - $TS"
    git push -q origin master
    
    # Verificar URL pública
    sleep 5
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://jesulac.github.io/nexus/")
    echo "[$TS] ✓ Push + verify HTTP $HTTP"
  fi
  
  # Esperar 2 minutos y repetir para siempre
  sleep 120
done
