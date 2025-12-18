#!/usr/bin/env node
/**
 * InterfaceDesign Manager Server
 * 
 * This file exists for backwards compatibility.
 * The actual server code is in src/server.js
 * 
 * Usage:
 *   node server.js      -> Works (loads src/server.js)
 *   npm start           -> Recommended (uses src/server.js directly)
 * 
 * Note: TestCases module is maintained in a separate repository
 */

// Load the modular server
require('./src/server.js');
