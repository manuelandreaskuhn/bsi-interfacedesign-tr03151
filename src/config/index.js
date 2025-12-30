/**
 * Application Configuration
 * Handles paths for both development and PKG-packaged environments
 */

const path = require('path');
const fsSync = require('fs');

getBaseDir = () => {
  if (process.pkg) {
    // PKG environment
    return path.dirname(process.execPath);
  } else {
    // Development environment
    return path.resolve(__dirname, '..', '..');
  }
};

getVirtuellDir = () => {
  if (process.pkg) {
    // PKG environment
    return __dirname.replace(/src[\/\\]config$/, '');
  } else {
    // Development environment
    return path.resolve(__dirname, '..', '..');
  }
};

getSrcDir = () => {
  if (process.pkg) {
    // PKG environment
    return __dirname.replace(/[\/\\]config$/, '');
  } else {
    // Development environment
    return path.resolve(__dirname, '..');
  }
};



// Development: / - PKG: /
const BASE_DIR = getBaseDir();
// Development: / - PKG: /snapshot/<folder>/
const VIRTUELL_DIR = getVirtuellDir();
// Development: src/ - PKG: /snapshot/<folder>/src/
const SRC_DIR = getSrcDir();

const PUBLIC_DIR = path.join(VIRTUELL_DIR, 'public');
const INSTANCES_ROOT = path.join(BASE_DIR, 'instances');
const TEMPLATES_ROOT = path.join(VIRTUELL_DIR, 'templates');

// Report templates - check BASE_DIR first (for portable), then SRC_DIR
const REPORT_TEMPLATES_DIR = fsSync.existsSync(path.join(BASE_DIR, 'report-templates'))
  ? path.join(BASE_DIR, 'report-templates')
  : path.join(VIRTUELL_DIR, 'report-templates');

// Server configuration
const PORT = process.env.PORT || 3001;

// File upload settings
const UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/csv', 'text/xml',
    'application/json',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed'
  ]
};

// Status colors for exports
const STATUS_COLORS = {
  primary: '#2563eb',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#ca8a04',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  purple: '#9333ea'
};

module.exports = {
  BASE_DIR,
  VIRTUELL_DIR,
  SRC_DIR,
  PUBLIC_DIR,
  INSTANCES_ROOT,
  TEMPLATES_ROOT,
  REPORT_TEMPLATES_DIR,
  PORT,
  UPLOAD_CONFIG,
  STATUS_COLORS
};
