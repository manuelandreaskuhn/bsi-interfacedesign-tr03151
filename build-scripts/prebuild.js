#!/usr/bin/env node
/**
 * Prebuild Script
 * Startet temporär den Express-Server und sammelt alle API-Daten
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Konfiguration
const CONFIG = {
  PORT: 3001,
  INSTANCES: ['default', 'bsi-tr-03153-03151'], // Oder automatisch scannen
  OUTPUT_DIR: path.join(__dirname, '../dist-temp/data'),
  ENDPOINTS: [
    'overview',
    'functions',
    'types',
    'enums',
    'exceptions',
    'processes',
    'processchains',
    'processmap'
  ]
};

/**
 * HTTP GET Request Helper
 */
function fetchFromServer(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            console.error(`Failed to parse JSON from ${url}`);
            resolve(null);
          }
        } else {
          console.warn(`${url} returned ${res.statusCode}`);
          resolve(null);
        }
      });
    });
    
    request.on('error', (err) => {
      console.error(`Request failed: ${url}`, err.message);
      resolve(null);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Sammelt alle Daten für eine Instance
 */
async function fetchInstanceData(instance, port) {
  console.log(`\nProcessing instance: ${instance}`);
  
  const outputDir = path.join(CONFIG.OUTPUT_DIR, instance);
  await fs.mkdir(outputDir, { recursive: true });
  
  const collectedData = {};
  
  // Sammle Haupt-Endpoints
  for (const endpoint of CONFIG.ENDPOINTS) {
    const url = `http://localhost:${port}/api/${instance}/interfacedesign/${endpoint}`;
    console.log(`Fetching /${endpoint}...`);
    
    try {
      const data = await fetchFromServer(url);
      
      if (data) {
        collectedData[endpoint] = data;
        
        // Speichere als separate JSON-Datei
        await fs.writeFile(
          path.join(outputDir, `${endpoint}.json`),
          JSON.stringify(data, null, 2),
          'utf-8'
        );
        
        console.log(`Saved (${JSON.stringify(data).length} bytes)`);
        
        // Sammle Detail-Daten wenn verfügbar
        if (data.items && Array.isArray(data.items)) {
          await fetchDetailData(instance, endpoint, data.items, outputDir, port);
        }
      } else {
        console.log(`No data returned`);
      }
      
    } catch (err) {
      console.error(`Error fetching ${endpoint}:`, err.message);
    }
    
    // Kleine Pause zwischen Requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Sammle Process-Chain Details (speziell)
  if (collectedData.processchains && collectedData.processchains.items) {
    await fetchProcessChainDetails(instance, collectedData.processchains.items, outputDir, port);
  }
  
  // Sammle Process Details (speziell)  
  if (collectedData.processes && collectedData.processes.items) {
    await fetchProcessDetails(instance, collectedData.processes.items, outputDir, port);
  }
  
  return collectedData;
}

/**
 * Sammelt Detail-Daten für einzelne Items
 */
async function fetchDetailData(instance, category, items, outputDir, port) {
  // Verzeichnis für Details erstellen
  const detailDir = path.join(outputDir, category);
  await fs.mkdir(detailDir, { recursive: true });
  
  // Mapping von Plural zu Singular für API-Endpoints
  const singularMap = {
    'functions': 'function',
    'types': 'type',
    'enums': 'enum',
    'exceptions': 'exception',
    'processes': 'process',
    'processchains': 'processchain'
  };
  
  const singular = singularMap[category];
  if (!singular) {
    console.log(`No detail endpoint for ${category}`);
    return;
  }
  
  console.log(`Fetching details for ${items.length} ${category}...`);
  
  let successCount = 0;
  
  for (const item of items) {
    const itemId = item.id || item.name || item.chainId;
    if (!itemId) continue;
    
    try {
      let url;
      
      // Spezialfall für Processes (haben actor/type/id Struktur)
      if (category === 'processes' && item.actor && item.diagramType) {
        url = `http://localhost:${port}/api/${instance}/interfacedesign/process/${item.actor}/${item.diagramType}/${itemId}`;
      } else {
        url = `http://localhost:${port}/api/${instance}/interfacedesign/${singular}/${itemId}`;
      }
      
      const detail = await fetchFromServer(url);
      
      if (detail) {
        const filename = `${itemId}.json`;
        await fs.writeFile(
          path.join(detailDir, filename),
          JSON.stringify(detail, null, 2),
          'utf-8'
        );
        successCount++;
      }
      
    } catch (err) {
      console.error(`Failed to fetch ${itemId}:`, err.message);
    }
    
    // Kleine Pause zwischen Requests
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`Saved ${successCount}/${items.length} detail files`);
}

/**
 * Sammelt Process-Chain Details
 */
async function fetchProcessChainDetails(instance, items, outputDir, port) {
  console.log(`Fetching process chain details...`);
  
  const detailDir = path.join(outputDir, 'processchains');
  await fs.mkdir(detailDir, { recursive: true });
  
  let successCount = 0;
  
  for (const item of items) {
    const chainId = item.chainId || item.id;
    if (!chainId) continue;
    
    try {
      const url = `http://localhost:${port}/api/${instance}/interfacedesign/processchain/${chainId}`;
      const detail = await fetchFromServer(url);
      
      if (detail) {
        await fs.writeFile(
          path.join(detailDir, `${chainId}.json`),
          JSON.stringify(detail, null, 2),
          'utf-8'
        );
        successCount++;
        console.log(`${chainId}`);
      }
      
    } catch (err) {
      console.error(`Failed to fetch ${chainId}:`, err.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`Saved ${successCount}/${items.length} process chain details`);
}

/**
 * Sammelt Process Details
 */
async function fetchProcessDetails(instance, items, outputDir, port) {
  console.log(`Fetching process details...`);
  
  const detailDir = path.join(outputDir, 'processes');
  await fs.mkdir(detailDir, { recursive: true });
  
  let successCount = 0;
  
  for (const item of items) {
    const processId = item.id;
    if (!processId || !item.actor || !item.diagramType) continue;
    
    try {
      const url = `http://localhost:${port}/api/${instance}/interfacedesign/process/${item.actor}/${item.diagramType}/${processId}`;
      const detail = await fetchFromServer(url);
      
      if (detail) {
        // Filename: actor-type-id.json
        const filename = `${item.actor}-${item.diagramType}-${processId}.json`;
        await fs.writeFile(
          path.join(detailDir, filename),
          JSON.stringify(detail, null, 2),
          'utf-8'
        );
        successCount++;
        console.log(`${filename}`);
      }
      
    } catch (err) {
      console.error(`Failed to fetch ${processId}:`, err.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`Saved ${successCount}/${items.length} process details`);
}

/**
 * Hauptfunktion
 */
async function prebuild() { 
  // 1. Lösche alten Output
  try {
    await fs.rm(CONFIG.OUTPUT_DIR, { recursive: true, force: true });
    console.log('Cleaned old output directory');
  } catch (err) {
    // Ignorieren wenn Verzeichnis nicht existiert
  }
  
  await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  
  // 2. Starte temporären Server
  console.log(`\nStarting temporary server on port ${CONFIG.PORT}...`);
  
  const app = require('../src/app');
  const server = app.listen(CONFIG.PORT);
  
  // Warte bis Server bereit ist
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('Server started\n');
  
  try {
    // 3. Sammle Daten für alle Instances
    const allData = {};
    
    for (const instance of CONFIG.INSTANCES) {
      allData[instance] = await fetchInstanceData(instance, CONFIG.PORT);
    }
    
    // 4. Speichere kombinierte Daten
    const summaryFile = path.join(CONFIG.OUTPUT_DIR, '_summary.json');
    await fs.writeFile(
      summaryFile,
      JSON.stringify({
        buildDate: new Date().toISOString(),
        instances: CONFIG.INSTANCES,
        data: allData
      }, null, 2),
      'utf-8'
    );    
  } catch (err) {
    console.error('\nPrebuild failed:', err);
    throw err;
    
  } finally {
    // 5. Server stoppen
    console.log('Stopping temporary server...');
    server.close();
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('Server stopped\n');
  }
}

// Führe Script aus
if (require.main === module) {
  prebuild()
    .then(() => {
      console.log('Done!\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { prebuild };
