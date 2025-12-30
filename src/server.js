#!/usr/bin/env node
/**
 * TestCase Manager Server
 * Entry point for the application
 */

const fs = require('fs');
const path = require('path');
const app = require('./app');
const { PORT, INSTANCES_ROOT, TEMPLATES_ROOT, SRC_DIR, PUBLIC_DIR, BASE_DIR, VIRTUELL_DIR } = require('./config');

// ============================================
// Helper: Directory Tree
// ============================================

function getDirectoryTree(dir, prefix = '', isLast = true, directoriesOnly = false) {
  if (!fs.existsSync(dir)) {
    return `${prefix}[NICHT VORHANDEN]\n`;
  }

  let output = '';
  let files = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !e.name.startsWith('.'));

  if (directoriesOnly) {
    files = files.filter(e => e.isDirectory());
  }

  files.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));

  files.forEach((file, index) => {
    const isLastFile = index === files.length - 1;
    const connector = isLastFile ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLastFile ? '    ' : '│   ');

    if (file.isDirectory()) {
      output += `${prefix}${connector}📁 ${file.name}/\n`;
      output += getDirectoryTree(path.join(dir, file.name), nextPrefix, isLastFile, directoriesOnly);
    } else if (!directoriesOnly) {
      output += `${prefix}${connector}📄 ${file.name}\n`;
    }
  });

  return output;
}

// ============================================
// Startup
// ============================================

// Ensure required directories exist
if (!fs.existsSync(INSTANCES_ROOT)) {
  fs.mkdirSync(INSTANCES_ROOT, { recursive: true });
}

// Count instances and templates
let instanceCount = 0;
let templateCount = 0;

try {
  instanceCount = fs.readdirSync(INSTANCES_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
    .length;
} catch {}

try {
  templateCount = fs.readdirSync(TEMPLATES_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
    .length;
} catch {}

// Start server
app.listen(PORT, () => {
  console.log(`
=================================================
TestCase and Interface Design Manager Server
=================================================
Server läuft auf: http://localhost:${PORT}
Instanzen Verzeichnis: ${INSTANCES_ROOT}
Templates Verzeichnis: ${TEMPLATES_ROOT}
  → ${instanceCount} Instanz(en) gefunden
  → ${templateCount} Template(s) gefunden

Verfügbare URLs:
  http://localhost:${PORT}/           - Instanz-Auswahl
  http://localhost:${PORT}/<instance> - Instanz öffnen
  http://localhost:${PORT}/<instance>/interfacedesign - InterfaceDesign öffnen

=================================================
DEBUG: Verzeichnisstrukturen
=================================================

📂 INSTANCES Verzeichnis (${INSTANCES_ROOT}):
${getDirectoryTree(INSTANCES_ROOT, '', true, true)}

📂 SRC Verzeichnis (${SRC_DIR}):
${getDirectoryTree(SRC_DIR)}

📂 PUBLIC Verzeichnis (${PUBLIC_DIR}):
${getDirectoryTree(PUBLIC_DIR)}

📂 TEMPLATES Verzeichnis (${TEMPLATES_ROOT}):
${getDirectoryTree(TEMPLATES_ROOT, '', true, true)}

📂 BASE Verzeichnis: ${BASE_DIR}
📂 Virtuell Verzeichnis: ${VIRTUELL_DIR}
=================================================

Process ID: ${process.pid}
Process Exec Path: ${process.execPath}
Process CWD: ${process.cwd()}
Process PKG: ${process.pkg ? 'Ja' : 'Nein'}
=================================================

`);
});
