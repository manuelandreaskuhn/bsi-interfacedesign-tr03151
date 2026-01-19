#!/usr/bin/env node
/**
 * Build Static Inline - Single HTML mit Hash-Routing
 * 
 * Features:
 * - Eine HTML-Datei mit allen Daten (~5-10 MB)
 * - Hash-basiertes Routing (#/function/GetDescription)
 * - Alle externen Scripts inline (React, Babel, etc.)
 * - Funktioniert ohne .htaccess oder Server
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

// Konfiguration
const CONFIG = {
  TEMP_DATA_DIR: path.join(__dirname, '../dist-temp/data'),
  PUBLIC_DIR: path.join(__dirname, '../public'),
  OUTPUT_DIR: path.join(__dirname, '../dist'),
  INSTANCES: ['default', 'bsi-tr-03153-03151'],
  
  // CDN URLs zum Inlinen
  CDN_SCRIPTS: {
    react: 'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
    reactDOM: 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
    babel: 'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js',
    // Tailwind Play CDN - folgt Redirects zur eigentlichen Datei
    tailwind: 'https://cdn.tailwindcss.com',
    fontAwesome: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    // Mermaid: Verwende UMD statt ESM (keine Chunks!)
    mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
  },
  
  // Font Awesome Webfonts
  FONT_AWESOME_FONTS: [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-regular-400.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-brands-400.woff2'
  ]
};

/**
 * Download Script von URL mit Redirect-Support
 */
function downloadScript(url) {
  return new Promise((resolve, reject) => {
    const maxRedirects = 5;
    let redirectCount = 0;
    
    function fetch(currentUrl) {
      const protocol = currentUrl.startsWith('https') ? https : http;
      
      console.log(`  Downloading: ${currentUrl}`);
      
      const request = protocol.get(currentUrl, (res) => {
        // Handle Redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            reject(new Error('Too many redirects'));
            return;
          }
          
          let redirectUrl = res.headers.location;
          
          // Handle relative URLs
          if (redirectUrl.startsWith('/')) {
            const urlObj = new URL(currentUrl);
            redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
          }
          
          console.log(`  Redirecting to: ${redirectUrl}`);
          fetch(redirectUrl);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`  Downloaded: ${(data.length / 1024).toFixed(2)} KB`);
          resolve(data);
        });
      });
      
      request.on('error', reject);
    }
    
    fetch(url);
  });
}

/**
 * Download binäre Datei (z.B. Font) als Buffer
 */
function downloadBinary(url) {
  return new Promise((resolve, reject) => {
    const maxRedirects = 5;
    let redirectCount = 0;
    
    function fetch(currentUrl) {
      const protocol = currentUrl.startsWith('https') ? https : http;
      
      console.log(`  Downloading binary: ${currentUrl}`);
      
      const request = protocol.get(currentUrl, (res) => {
        // Handle Redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            reject(new Error('Too many redirects'));
            return;
          }
          
          let redirectUrl = res.headers.location;
          
          if (redirectUrl.startsWith('/')) {
            const urlObj = new URL(currentUrl);
            redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
          }
          
          console.log(`  Redirecting to: ${redirectUrl}`);
          fetch(redirectUrl);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        const chunks = [];
        
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`  Downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
          resolve(buffer);
        });
      });
      
      request.on('error', reject);
    }
    
    fetch(url);
  });
}

/**
 * Lade alle CDN Scripts
 */
async function downloadAllScripts() {
  console.log('\n[Downloading CDN scripts]');
  
  const scripts = {};
  
  for (const [name, url] of Object.entries(CONFIG.CDN_SCRIPTS)) {
    try {
      scripts[name] = await downloadScript(url);
    } catch (err) {
      console.error(`  Failed to download ${name}:`, err.message);
      scripts[name] = `/* Failed to download ${name} from ${url} */`;
    }
  }
  
  // Download Font Awesome Webfonts und konvertiere zu base64
  console.log('\n[Downloading Font Awesome webfonts]');
  const fontData = {};
  
  for (const fontUrl of CONFIG.FONT_AWESOME_FONTS) {
    const fontName = fontUrl.split('/').pop(); // z.B. "fa-solid-900.woff2"
    try {
      const buffer = await downloadBinary(fontUrl);
      const base64 = buffer.toString('base64');
      fontData[fontName] = base64;
      console.log(`  Converted ${fontName} to base64: ${(base64.length / 1024).toFixed(2)} KB`);
    } catch (err) {
      console.warn(`  Failed to download font ${fontName}:`, err.message);
    }
  }
  
  // Passe Font Awesome CSS an um base64 Fonts zu verwenden
  if (Object.keys(fontData).length > 0 && scripts.fontAwesome) {
    console.log('\n[Embedding fonts in CSS]');
    let css = scripts.fontAwesome;
    
    // Ersetze Webfont-URLs mit base64 data URLs
    for (const [fontName, base64Data] of Object.entries(fontData)) {
      const ext = fontName.split('.').pop(); // woff2, woff, ttf
      const mimeType = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : 'font/ttf';
      
      // Ersetze url('../webfonts/FONTNAME') mit data URL
      const urlPattern = new RegExp(`url\\(['"]?\\.\\./webfonts/${fontName.replace('.', '\\.')}['"]?\\)`, 'g');
      const dataUrl = `url('data:${mimeType};base64,${base64Data}')`;
      
      const before = css.length;
      css = css.replace(urlPattern, dataUrl);
      const after = css.length;
      
      if (after > before) {
        console.log(`  Embedded ${fontName} in CSS (+${((after - before) / 1024).toFixed(2)} KB)`);
      }
    }
    
    scripts.fontAwesome = css;
    console.log(`  Final CSS size: ${(css.length / 1024).toFixed(2)} KB)`);
  }
  
  return scripts;
}

/**
 * Liest alle Daten für eine Instance
 */
async function loadInstanceData(instance) {
  console.log(`\n[Loading data for instance: ${instance}]`);
  
  const dataDir = path.join(CONFIG.TEMP_DATA_DIR, instance);
  const data = {};
  
  try {
    const files = await fs.readdir(dataDir);
    
    // 1. Lade Haupt-JSON-Dateien (functions.json, types.json, etc.)
    for (const file of files) {
      if (file.endsWith('.json') && !file.startsWith('_')) {
        const key = file.replace('.json', '');
        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        data[key] = JSON.parse(content);
        console.log(`  Loaded ${key}`);
      }
    }
    
    // 2. Lade Detail-Daten aus Unterverzeichnissen
    const detailCategories = ['functions', 'types', 'enums', 'exceptions', 'processes', 'processchains'];
    
    for (const category of detailCategories) {
      const detailDir = path.join(dataDir, category);
      
      try {
        const stat = await fs.stat(detailDir);
        if (stat.isDirectory()) {
          const detailFiles = await fs.readdir(detailDir);
          const detailItems = [];
          
          for (const detailFile of detailFiles) {
            if (detailFile.endsWith('.json')) {
              const detailContent = await fs.readFile(
                path.join(detailDir, detailFile),
                'utf-8'
              );
              detailItems.push(JSON.parse(detailContent));
            }
          }
          
          if (detailItems.length > 0) {
            const detailKey = `${category}Details`;
            data[detailKey] = { items: detailItems };
            console.log(`  Loaded ${detailItems.length} ${category} details`);
          }
        }
      } catch (err) {
        // Verzeichnis existiert nicht - das ist OK
      }
    }
    
    return data;
    
  } catch (err) {
    console.error(`  Failed to load data:`, err.message);
    return {};
  }
}

/**
 * Erstellt Hash-Routing Override Script
 */
function createHashRoutingScript() {
  return `
  <!-- HASH-BASED ROUTING OVERRIDE -->
  <script>
    console.log('Hash-Based Routing Active');
    
    // Hash-basiertes Routing nutzen statt History API
    window.__USE_HASH_ROUTING__ = true;
    
    // Override updateUrl für Hash-Routing
    window.updateUrl = function(instance, view, itemId, replace, processInfo) {
      // Erstelle Hash-URL
      let hash = '#/';
      
      if (!view || view === 'overview') {
        hash = '#/';
      } else if (itemId) {
        // Detail-Seite
        hash = '#/' + view + '/' + itemId;
      } else {
        // Listen-Seite
        hash = '#/' + view;
      }
      
      console.log('[Hash Routing] Navigating to:', hash);
      
      // Setze Hash (triggert hashchange Event)
      if (replace) {
        window.location.replace(hash);
      } else {
        window.location.hash = hash;
      }
    };
    
    // Verhindere dass React eigenes Routing nutzt
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      console.log('[Hash Routing] Prevented pushState - using hash instead');
      // Ignoriere - wir nutzen Hash-Routing
    };
    
    history.replaceState = function() {
      console.log('[Hash Routing] Prevented replaceState - using hash instead');
      // Ignoriere - wir nutzen Hash-Routing
    };
    
    console.log('[Hash Routing] Override installed');
  </script>
  `;
}

/**
 * Escape JavaScript für sicheres Inline-Einfügen in HTML
 */
function escapeScriptContent(scriptContent) {
  // Das Hauptproblem: Wenn </script> im JS-Code vorkommt, wird das HTML-Tag vorzeitig geschlossen
  // Lösung: Escape den Forward-Slash in </script>
  // Dies ist die Standard-Methode für inline Scripts
  return scriptContent.replace(/<\/script>/gi, '<\\/script>');
}

/**
 * Injiziert Daten und Scripts in HTML
 */
async function injectIntoHtml(template, data, instance, inlinedScripts) {
  console.log('\n[Injecting data and scripts]');
  
  let html = template;
  
  // 1. Markiere zuerst die Positionen mit eindeutigen Platzhaltern
  console.log('  Replacing CDN references with placeholders...');
  
  const PLACEHOLDER_PREFIX = '___INLINE_SCRIPT_';
  const placeholders = {};
  let placeholderIndex = 0;
  
  // Tailwind CSS - matche beide CDN Varianten
  html = html.replace(
    /<script src="https:\/\/(cdn\.tailwindcss\.com|cdn\.jsdelivr\.net\/npm\/tailwindcss@[^"]+)"[^>]*><\/script>/g,
    () => {
      const key = PLACEHOLDER_PREFIX + (placeholderIndex++);
      placeholders[key] = { type: 'tailwind', content: inlinedScripts.tailwind };
      return key;
    }
  );
  
  // React
  html = html.replace(
    /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/react\/[^"]+"><\/script>/g,
    () => {
      const key = PLACEHOLDER_PREFIX + (placeholderIndex++);
      placeholders[key] = { type: 'react', content: inlinedScripts.react };
      return key;
    }
  );
  
  // React-DOM
  html = html.replace(
    /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/react-dom\/[^"]+"><\/script>/g,
    () => {
      const key = PLACEHOLDER_PREFIX + (placeholderIndex++);
      placeholders[key] = { type: 'reactDOM', content: inlinedScripts.reactDOM };
      return key;
    }
  );
  
  // Babel
  html = html.replace(
    /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"><\/script>/g,
    () => {
      const key = PLACEHOLDER_PREFIX + (placeholderIndex++);
      placeholders[key] = { type: 'babel', content: inlinedScripts.babel };
      return key;
    }
  );
  
  // Font Awesome CSS
  html = html.replace(
    /<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]+">/g,
    () => {
      const key = PLACEHOLDER_PREFIX + (placeholderIndex++);
      placeholders[key] = { type: 'css', content: inlinedScripts.fontAwesome };
      return key;
    }
  );
  
  // Mermaid - matche sowohl ESM Module als auch normale Script-Tags
  const mermaidModulePattern = /<script type="module">\s*import mermaid from 'https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@[^']+';[\s\S]*?<\/script>/g;
  const mermaidScriptPattern = /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@[^"]+"><\/script>/g;
  
  html = html.replace(mermaidModulePattern, () => {
    const key = PLACEHOLDER_PREFIX + (placeholderIndex++);
    placeholders[key] = { type: 'mermaid', content: inlinedScripts.mermaid };
    return key;
  });
  
  html = html.replace(mermaidScriptPattern, () => {
    const key = PLACEHOLDER_PREFIX + (placeholderIndex++);
    placeholders[key] = { type: 'mermaid', content: inlinedScripts.mermaid };
    return key;
  });
  
  // 2. Jetzt ersetze die Platzhalter mit dem tatsächlichen Code
  console.log('  Inlining scripts into placeholders...');
  
  for (const [key, data] of Object.entries(placeholders)) {
    let replacement;
    
    if (data.type === 'css') {
      replacement = `<style>\n${data.content}\n</style>`;
    } else if (data.type === 'mermaid') {
      // Mermaid UMD - kein Module mehr, setzt window.mermaid direkt
      replacement = `<script>\n${escapeScriptContent(data.content)}\n// Mermaid UMD setzt window.mermaid automatisch\nif (window.mermaid) {\n  window.mermaid.initialize({ startOnLoad: false });\n}\n</script>`;
    } else {
      replacement = `<script>\n${escapeScriptContent(data.content)}\n</script>`;
    }
    
    // Verwende split/join statt replace um sicherzustellen dass ALLE Vorkommen ersetzt werden
    // (sollte nur eins sein, aber zur Sicherheit)
    const before = html;
    html = html.split(key).join(replacement);
    
    if (html === before) {
      console.warn(`  Warning: Placeholder ${key} not found in HTML!`);
    }
  }
  
  // Prüfe ob noch Platzhalter übrig sind
  if (html.includes(PLACEHOLDER_PREFIX)) {
    console.warn('  Warning: Some placeholders were not replaced!');
    const remaining = html.match(new RegExp(PLACEHOLDER_PREFIX + '\\d+', 'g'));
    if (remaining) {
      console.warn('  Remaining:', remaining);
    }
  }
  
  console.log('  CDN scripts inlined (React, React-DOM, Babel, Tailwind, Font Awesome, Mermaid)');
  
  // 2. Erstelle Daten-Injection Script
  const dataSize = JSON.stringify(data).length;
  console.log(`  Data size: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);
  
  const dataScript = `
  <!-- STATIC BUILD DATA -->
  <script>
    console.log('Static Build - Inline Version');
    console.log('Instance: ${instance}');
    console.log('Build Date: ${new Date().toISOString()}');
    console.log('Data Size: ${(dataSize / 1024 / 1024).toFixed(2)} MB');
    console.log('Routing: Hash-based');
    
    window.__STATIC_BUILD__ = true;
    window.__INSTANCE__ = '${instance}';
    window.__BUILD_DATE__ = '${new Date().toISOString()}';
    window.__PRELOADED_DATA__ = ${JSON.stringify(data)};
    
    // Mock fetch für API-Calls
    (function() {
      const originalFetch = window.fetch;
      
      window.fetch = function(url, options) {
        // Konvertiere URL zu String falls es ein Request-Object ist
        const urlString = typeof url === 'string' ? url : url.url || String(url);
        
        console.log('[Static Build] Fetch call detected:', urlString);
        
        // Prüfe ob es ein API-Call ist
        if (urlString.includes('/api/') || urlString.includes('/interfacedesign/')) {
          console.log('[Static Build] API call intercepted:', urlString);
          
          const urlParts = urlString.split('/');
          const lastPart = urlParts[urlParts.length - 1].split('?')[0]; // Entferne Query-Parameter
          
          // Standard-Endpoints (Listen)
          if (window.__PRELOADED_DATA__[lastPart]) {
            console.log('[Static Build] Serving list data:', lastPart);
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(window.__PRELOADED_DATA__[lastPart])
            });
          }
          
          // Function Details
          const functionMatch = urlString.match(/\\/function\\/([^\\/\\?]+)/);
          if (functionMatch) {
            const functionId = decodeURIComponent(functionMatch[1]);
            console.log('[Static Build] Looking for function:', functionId);
            
            if (window.__PRELOADED_DATA__.functionsDetails && 
                window.__PRELOADED_DATA__.functionsDetails.items) {
              console.log('[Static Build] functionsDetails.items count:', window.__PRELOADED_DATA__.functionsDetails.items.length);
              
              // Suche nach der Function - Beachte Wrapper-Struktur {success, function}
              const wrapper = window.__PRELOADED_DATA__.functionsDetails.items.find(item => {
                // Die Daten können entweder direkt sein oder in item.function verschachtelt
                const func = item.function || item; // Falls wrapper, nutze item.function, sonst item direkt
                const id = func.id;
                const name = func.name;
                
                return id === functionId || name === functionId ||
                       (id && id.toLowerCase() === functionId.toLowerCase()) ||
                       (name && name.toLowerCase() === functionId.toLowerCase());
              });
              
              if (wrapper) {
                // Wenn Wrapper-Struktur, gebe das ganze Wrapper-Object zurück
                // Die App erwartet evtl. {success: true, function: {...}}
                console.log('[Static Build] Found function details');
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: () => Promise.resolve(wrapper)
                });
              }
              
              console.warn('[Static Build] Function not found:', functionId);
              console.warn('[Static Build] Available functions:', 
                window.__PRELOADED_DATA__.functionsDetails.items.slice(0, 5).map(item => {
                  const func = item.function || item;
                  return func.id || func.name;
                })
              );
            }
          }
          
          // Type Details
          const typeMatch = urlString.match(/\\/type\\/([^\\/\\?]+)/);
          if (typeMatch) {
            const typeId = decodeURIComponent(typeMatch[1]);
            console.log('[Static Build] Looking for type:', typeId);
            if (window.__PRELOADED_DATA__.typesDetails && 
                window.__PRELOADED_DATA__.typesDetails.items) {
              const wrapper = window.__PRELOADED_DATA__.typesDetails.items.find(item => {
                const type = item.type || item;
                return type.id === typeId || type.name === typeId;
              });
              if (wrapper) {
                console.log('[Static Build] Found type details');
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: () => Promise.resolve(wrapper)
                });
              }
            }
            console.warn('[Static Build] Type not found:', typeId);
          }
          
          // Enum Details
          const enumMatch = urlString.match(/\\/enum\\/([^\\/\\?]+)/);
          if (enumMatch) {
            const enumId = decodeURIComponent(enumMatch[1]);
            console.log('[Static Build] Looking for enum:', enumId);
            if (window.__PRELOADED_DATA__.enumsDetails && 
                window.__PRELOADED_DATA__.enumsDetails.items) {
              const wrapper = window.__PRELOADED_DATA__.enumsDetails.items.find(item => {
                const enumItem = item.enum || item;
                return enumItem.id === enumId || enumItem.name === enumId;
              });
              if (wrapper) {
                console.log('[Static Build] Found enum details');
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: () => Promise.resolve(wrapper)
                });
              }
            }
            console.warn('[Static Build] Enum not found:', enumId);
          }
          
          // Exception Details
          const exceptionMatch = urlString.match(/\\/exception\\/([^\\/\\?]+)/);
          if (exceptionMatch) {
            const exceptionId = decodeURIComponent(exceptionMatch[1]);
            console.log('[Static Build] Looking for exception:', exceptionId);
            if (window.__PRELOADED_DATA__.exceptionsDetails && 
                window.__PRELOADED_DATA__.exceptionsDetails.items) {
              const wrapper = window.__PRELOADED_DATA__.exceptionsDetails.items.find(item => {
                const exception = item.exception || item;
                return exception.id === exceptionId || exception.name === exceptionId;
              });
              if (wrapper) {
                console.log('[Static Build] Found exception details');
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: () => Promise.resolve(wrapper)
                });
              }
            }
            console.warn('[Static Build] Exception not found:', exceptionId);
          }
          
          // Process-Chain Details
          const processchainMatch = urlString.match(/\\/processchain\\/([^\\/\\?]+)/);
          if (processchainMatch) {
            const chainId = decodeURIComponent(processchainMatch[1]);
            console.log('[Static Build] Looking for process-chain:', chainId);
            if (window.__PRELOADED_DATA__.processchainsDetails && 
                window.__PRELOADED_DATA__.processchainsDetails.items) {
              const wrapper = window.__PRELOADED_DATA__.processchainsDetails.items.find(item => {
                const chain = item.processChain || item;
                return chain.chainId === chainId || chain.id === chainId;
              });
              if (wrapper) {
                console.log('[Static Build] Found process-chain details');
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: () => Promise.resolve(wrapper)
                });
              }
            }
            console.warn('[Static Build] Process-chain not found:', chainId);
          }
          
          // Process Details
          const processMatch = urlString.match(/\\/process\\/([^\\/]+)\\/([^\\/]+)\\/([^\\/\\?]+)/);
          if (processMatch) {
            const actor = decodeURIComponent(processMatch[1]);
            const type = decodeURIComponent(processMatch[2]);
            const id = decodeURIComponent(processMatch[3]);
            console.log('[Static Build] Looking for process:', actor, type, id);
            if (window.__PRELOADED_DATA__.processesDetails && 
                window.__PRELOADED_DATA__.processesDetails.items) {
              const wrapper = window.__PRELOADED_DATA__.processesDetails.items.find(item => {
                const process = item.process || item;
                return process.actor === actor && process.diagramType === type && process.id === id;
              });
              if (wrapper) {
                console.log('[Static Build] Found process details');
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  json: () => Promise.resolve(wrapper)
                });
              }
            }
            console.warn('[Static Build] Process not found:', actor, type, id);
          }
          
          // WICHTIG: Für ALLE /api/ oder /interfacedesign/ Calls die wir nicht kennen
          // NIEMALS den echten fetch aufrufen (würde CORS-Fehler geben)
          // Stattdessen immer ein Mock-Promise zurückgeben
          console.error('[Static Build] BLOCKED unhandled API call (would cause CORS):', urlString);
          console.error('[Static Build] Available data keys:', Object.keys(window.__PRELOADED_DATA__));
          
          // Gebe leere 404-Antwort OHNE echten fetch
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found in Static Build',
            json: () => Promise.resolve({ 
              error: 'Data not found in static build',
              url: urlString,
              message: 'This data was not included in the static build',
              availableKeys: Object.keys(window.__PRELOADED_DATA__)
            }),
            text: () => Promise.resolve(JSON.stringify({ error: 'Not found' }))
          });
        }
        
        // Nicht-API Calls normal durchlassen
        console.log('[Static Build] Non-API call, passing through:', urlString);
        return originalFetch.apply(this, arguments);
      };
      
      console.log('[Static Build] Fetch interceptor installed');
      console.log('[Static Build] Available data:', Object.keys(window.__PRELOADED_DATA__));
    })();
  </script>
  `;
  
  // 3. Finde Einfügepunkt (vor <script type="text/babel">)
  const marker = '<script type="text/babel">';
  const insertPoint = html.indexOf(marker);
  
  if (insertPoint === -1) {
    console.warn('  Could not find <script type="text/babel">');
    return html;
  }
  
  // 4. Füge Scripts ein
  html = html.slice(0, insertPoint) +
         dataScript +
         createHashRoutingScript() +
         html.slice(insertPoint);
  
  console.log('  Data and routing scripts injected');
  
  return html;
}

/**
 * Hauptfunktion
 */
async function buildStaticInline() {
  console.log('================================================================');
  console.log('    BUILD STATIC INLINE: Single File + Hash Routing');
  console.log('================================================================');
  
  const startTime = Date.now();
  
  // 1. Lösche Output
  try {
    await fs.rm(CONFIG.OUTPUT_DIR, { recursive: true, force: true });
    console.log('\nCleaned output directory');
  } catch (err) {}
  
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  
  // 2. Download CDN Scripts
  const inlinedScripts = await downloadAllScripts();
  
  // 3. Lade Template
  console.log('\n[Loading HTML template]');
  const templatePath = path.join(CONFIG.PUBLIC_DIR, 'interfacedesign.html');
  const template = await fs.readFile(templatePath, 'utf-8');
  console.log(`  Loaded (${(template.length / 1024).toFixed(2)} KB)`);
  
  // 4. Für jede Instance
  for (const instance of CONFIG.INSTANCES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing instance: ${instance}`);
    console.log('='.repeat(60));
    
    // 4.1 Lade Daten
    const data = await loadInstanceData(instance);
    
    if (Object.keys(data).length === 0) {
      console.error(`\nNo data found! Did you run 'npm run prebuild'?`);
      continue;
    }
    
    // 4.2 Injiziere in HTML
    const finalHtml = await injectIntoHtml(template, data, instance, inlinedScripts);
    
    // 4.3 Speichere
    const outputPath = path.join(CONFIG.OUTPUT_DIR, instance, 'interfacedesign');
    await fs.mkdir(outputPath, { recursive: true });
    
    const outputFile = path.join(outputPath, 'index.html');
    await fs.writeFile(outputFile, finalHtml, 'utf-8');
    
    const sizeKB = (finalHtml.length / 1024).toFixed(2);
    const sizeMB = (finalHtml.length / 1024 / 1024).toFixed(2);
    
    console.log(`\nSaved: ${path.relative(process.cwd(), outputFile)}`);
    console.log(`   Size: ${sizeKB} KB (${sizeMB} MB)`);
  }
  
  // 5. Kopiere CSS
  console.log('\n[Copying CSS]');
  try {
    const cssSource = path.join(CONFIG.PUBLIC_DIR, 'css');
    const cssDest = path.join(CONFIG.OUTPUT_DIR, 'css');
    
    await fs.mkdir(cssDest, { recursive: true });
    
    const cssFiles = await fs.readdir(cssSource);
    for (const file of cssFiles) {
      await fs.copyFile(
        path.join(cssSource, file),
        path.join(cssDest, file)
      );
    }
    console.log('  CSS copied');
  } catch (err) {
    console.warn('  Could not copy CSS:', err.message);
  }
  
  // 6. Index.html kopieren
  try {
    await fs.copyFile(
      path.join(CONFIG.PUBLIC_DIR, 'index.html'),
      path.join(CONFIG.OUTPUT_DIR, 'index.html')
    );
    console.log('  index.html copied');
  } catch (err) {}
  
  // 7. Build-Info
  const buildInfo = {
    buildDate: new Date().toISOString(),
    buildType: 'inline-single-page',
    routing: 'hash-based',
    instances: CONFIG.INSTANCES
  };
  
  await fs.writeFile(
    path.join(CONFIG.OUTPUT_DIR, 'build-info.json'),
    JSON.stringify(buildInfo, null, 2),
    'utf-8'
  );
  
  // 8. Zusammenfassung
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n================================================================');
  console.log('         BUILD STATIC INLINE COMPLETE');
  console.log('================================================================');
  console.log(`\nStatistics:`);
  console.log(`   Build time: ${duration}s`);
  console.log(`   Output: ${CONFIG.OUTPUT_DIR}`);
  console.log(`   Files: 1 HTML + CSS`);
  console.log(`\nNext steps:`);
  console.log(`   1. Test: npx serve dist -p 8080`);
  console.log(`   2. Open: http://localhost:8080/default/interfacedesign/`);
  console.log(`   3. Navigation uses hash URLs: #/function/GetDescription`);
  console.log(`\nFeatures:`);
  console.log(`   - Single HTML file (~5-10 MB)`);
  console.log(`   - All scripts inlined (React, Babel, Tailwind)`);
  console.log(`   - Hash-based routing (no .htaccess needed)`);
  console.log(`   - Works on any platform`);
  console.log('');
}

// Führe aus
if (require.main === module) {
  buildStaticInline()
    .then(() => {
      console.log('Done!\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      console.error(err.stack);
      process.exit(1);
    });
}

module.exports = { buildStaticInline };
