#!/bin/bash
# NEXUS AUTO-IMPROVE - MEJORA CONTINUA SIN PARAR
COUNT=0
while true; do
  COUNT=$((COUNT+1))
  TS=$(date '+%Y-%m-%d %H:%M:%S')
  echo ""
  echo "[$TS] === NEXUS AUTO-IMPROVE #$COUNT ==="

  IMPROVE=$(($COUNT % 8))
  case $IMPROVE in
    1)
      echo "  -> Microanimacion: feedback tactil"
      cd _src
      sed -i '/@media (hover:none) and (pointer:coarse){/a\  .kcard:active{transform:scale(.97)}\n  .card:active{transform:scale(.97)}' 02-style.css
      ;;
    2)
      echo "  -> Optimizacion: touch targets"
      sed -i 's/min-height:2.1rem/min-height:2.4rem/g' 04-comp.css
      ;;
    3)
      echo "  -> Mejora visual: sombras OLED"
      sed -i 's/box-shadow:var(--glow)/box-shadow:var(--glow),0 2px 8px rgba(0,0,0,.5)/g' 04-comp.css
      ;;
    4)
      echo "  -> Microanimacion: transiciones"
      sed -i 's/transition:all var(--dur-fast)/transition:all var(--dur-fast) cubic-bezier(.22,1,.36,1)/g' 04-comp.css
      ;;
    5)
      echo "  -> Mejora movil: safe area"
      sed -i 's/padding-bottom:calc(4.6rem/padding-bottom:calc(4.6rem + env(safe-area-inset-bottom)/g' 07-tabbar.css
      ;;
    6)
      echo "  -> Optimizacion: rendimiento"
      sed -i 's/will-change:auto/will-change:transform/g' 04-comp.css 2>/dev/null || true
      ;;
    7)
      echo "  -> Mejora visual: contraste"
      sed -i 's/color:var(--txt-3)/color:var(--txt-2)/g' 04-comp.css
      ;;
    *)
      echo "  -> Ajuste: espaciado"
      sed -i 's/gap:.55rem/gap:.6rem/g' 06-responsive.css
      ;;
  esac

  cd ..
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
