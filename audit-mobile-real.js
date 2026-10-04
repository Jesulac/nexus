// Auditoría móvil real de NEXUS OLED
const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const br = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: false,
    defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true }
  });
  const pg = await br.newPage();
  await pg.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15');
  
  const url = 'file:///' + path.resolve('index.html').replace(/\/g, '/');
  console.log('🔍 Abriendo:', url);
  await pg.goto(url, { waitUntil: 'networkidle0' });
  await pg.waitForTimeout(2000);

  console.log('\n=== AUDITORÍA MÓVIL REAL ===\n');

  // 1. Errores JS
  const errs = await pg.evaluate(() => window.__errors || []);
  console.log('1. Errores JS:', errs.length === 0 ? '✓ sin errores' : `✗ ${errs.length} errores`);
  if (errs.length) errs.slice(0,3).forEach(e => console.log('   -', e));

  // 2. Topbar visible y limpia
  const topbar = await pg.$eval('.topbar', el => ({
    visible: el.offsetHeight > 0,
    height: el.offsetHeight,
    bg: getComputedStyle(el).background,
    blur: getComputedStyle(el).backdropFilter
  }));
  console.log('2. Topbar:', topbar.visible ? '✓ visible' : '✗ oculta', 
    `${topbar.height}px`, topbar.blur.includes('blur') ? 'con blur' : 'sin blur');

  // 3. Barra inferior fija
  const tabbar = await pg.$eval('#tabbar', el => ({
    visible: el.offsetHeight > 0,
    position: getComputedStyle(el).position,
    bottom: getComputedStyle(el).bottom,
    buttons: el.querySelectorAll('button').length,
    height: el.offsetHeight
  }));
  console.log('3. Barra inferior:', tabbar.visible ? '✓ visible' : '✗ oculta',
    `${tabbar.position} bottom:${tabbar.bottom}`, `${tabbar.buttons} botones`, `${tabbar.height}px`);

  // 4. Vista principal sin cortes
  const view = await pg.$eval('.view', el => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      top: rect.top,
      bottom: rect.bottom,
      padding: style.padding,
      overflow: style.overflow,
      scrollable: el.scrollHeight > el.clientHeight
    };
  });
  console.log('4. Vista principal:', 
    `top:${Math.round(view.top)} bottom:${Math.round(view.bottom)}`,
    view.overflow, view.scrollable ? 'scrollable' : 'no-scroll');

  // 5. Menú drawer funcional
  await pg.click('.nav-toggle');
  await pg.waitForTimeout(400);
  const drawer = await pg.evaluate(() => {
    const sidebar = document.querySelector('.sidebar');
    const scrim = document.querySelector('.nav-scrim');
    const transform = getComputedStyle(sidebar).transform;
    return {
      open: document.body.classList.contains('nav-open'),
      transform: transform,
      scrimOpacity: getComputedStyle(scrim).opacity,
      items: sidebar.querySelectorAll('.nav-item').length
    };
  });
  console.log('5. Drawer:', drawer.open ? '✓ abierto' : '✗ cerrado',
    drawer.transform !== 'none' ? 'con transform' : 'sin transform',
    `${drawer.items} items`, `scrim:${drawer.scrimOpacity}`);

  // 6. Paleta de colores OLED
  const colors = await pg.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      bg: root.getPropertyValue('--bg').trim(),
      txt: root.getPropertyValue('--txt').trim(),
      panel: root.getPropertyValue('--panel').trim(),
      accent: root.getPropertyValue('--accent').trim()
    };
  });
  console.log('6. Paleta OLED:',
    colors.bg === '#000' || colors.bg === '#000000' ? '✓ negro puro' : `✗ ${colors.bg}`,
    colors.txt === '#fff' || colors.txt === '#ffffff' ? '✓ blanco' : `✗ ${colors.txt}`,
    colors.accent ? `✗ tiene accent:${colors.accent}` : '✓ sin accent');

  // 7. Tamaños táctiles
  await pg.click('.nav-scrim');
  await pg.waitForTimeout(300);
  const buttons = await pg.$$eval('button:not([hidden])', els => 
    els.slice(0, 10).map(el => ({
      text: el.textContent.trim().slice(0, 20),
      w: el.offsetWidth,
      h: el.offsetHeight,
      ok: el.offsetHeight >= 44 && el.offsetWidth >= 44
    }))
  );
  const failedBtns = buttons.filter(b => !b.ok);
  console.log('7. Botones táctiles:', 
    failedBtns.length === 0 ? '✓ todos ≥44px' : `✗ ${failedBtns.length} muy pequeños`);
  if (failedBtns.length) failedBtns.slice(0,3).forEach(b => 
    console.log(`   - "${b.text}": ${b.w}×${b.h}px`));

  // 8. Inputs sin zoom
  const inputs = await pg.$$eval('input[type="text"], textarea', els =>
    els.map(el => ({
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      ok: parseFloat(getComputedStyle(el).fontSize) >= 16
    }))
  );
  const failedInputs = inputs.filter(i => !i.ok);
  console.log('8. Inputs sin zoom iOS:', 
    failedInputs.length === 0 ? '✓ todos ≥16px' : `✗ ${failedInputs.length} muy pequeños`);

  // 9. Contraste visual
  const cards = await pg.$$eval('.card', els => 
    els.slice(0, 5).map(el => {
      const style = getComputedStyle(el);
      return {
        bg: style.background,
        border: style.border,
        visible: el.offsetHeight > 0
      };
    })
  );
  console.log('9. Tarjetas:', cards.length, 'visibles',
    cards.every(c => c.border.includes('rgba')) ? '✓ con bordes' : '✗ sin bordes');

  // 10. Navegación bottom bar
  const navWorks = await pg.evaluate(async () => {
    const btns = [...document.querySelectorAll('#tabbar button')];
    if (btns.length < 5) return { ok: false, reason: `solo ${btns.length} botones` };
    
    const results = [];
    for (let btn of btns.slice(0, 3)) {
      const text = btn.textContent.trim();
      btn.click();
      await new Promise(r => setTimeout(r, 200));
      const title = document.querySelector('#pageTitle')?.textContent;
      results.push({ btn: text, title });
    }
    return { ok: true, nav: results };
  });
  console.log('10. Navegación bottom:', navWorks.ok ? '✓ funciona' : '✗ no funciona');
  if (navWorks.nav) navWorks.nav.forEach(n => 
    console.log(`   - ${n.btn} → ${n.title}`));

  console.log('\n=== RESUMEN ===');
  console.log('✓ = correcto | ✗ = problema detectado');
  console.log('\nEl navegador quedará abierto 10s para inspección manual...');
  
  await pg.waitForTimeout(10000);
  await br.close();
})();
