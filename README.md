# bsi-interfacedesign-tr03151
BSI Interface Design Viewer für die TR 03151

## Installation

### Voraussetzungen
- Node.js >= 22.0.0 (für Entwicklung und Verwendung des Servers)
- npm (wird mit Node.js installiert)

### Schritt 1: Repository klonen
```bash
git clone https://github.com/your-org/bsi-interfacedesign-tr03151.git
cd bsi-interfacedesign-tr03151
```

### Schritt 2: Abhängigkeiten installieren
```bash
npm install
```

## Server starten

### Entwicklungsmodus
```bash
npm run dev
```

Der Server läuft dann auf `http://localhost:3000` (oder dem konfigurierten Port).

### Produktionsmodus
```bash
npm start
```

## Standalone/Portable Version bauen

Die Anwendung kann mit [pkg](https://github.com/yao-pkg/pkg) in ausführbare Dateien für verschiedene Plattformen umgewandelt werden.

### Voraussetzungen für das Bauen
- Node.js >= 22.0.0
- `@yao-pkg/pkg` wird als devDependency bereitgestellt

### Alle Plattformen bauen
```bash
npm run build:all
```

Dies erstellt ausführbare Dateien für Windows, Linux und macOS in der `dist/` Verzeichnis.

### Plattformspezifische Builds

**Windows (x64):**
```bash
npm run build:win
```

**Linux (x64):**
```bash
npm run build:linux
```

**macOS (x64):**
```bash
npm run build:mac
```

### Build-Ausgabe
Die erstellten ausführbaren Dateien befinden sich im `dist/` Verzeichnis:
- Windows: `dist/tr-03153-03151-testcase-and-interfacedesign-manager-win.exe`
- Linux: `dist/tr-03153-03151-testcase-and-interfacedesign-manager-linux`
- macOS: `dist/tr-03153-03151-testcase-and-interfacedesign-manager-macos`

Diese Dateien sind vollständig standalone und erfordern keine Node.js-Installation auf dem Zielsystem.
