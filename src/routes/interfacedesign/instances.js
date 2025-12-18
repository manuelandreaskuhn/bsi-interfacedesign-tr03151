/**
 * Instance Management Routes
 * Handles listing, creating, and managing instances
 */

const fs = require('fs').promises;
const path = require('path');
const { INSTANCES_ROOT, TEMPLATES_ROOT } = require('../../config');

// Valid instance name pattern (URL-safe)
const INSTANCE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;


async function getInstances() {
  try {
    const entries = await fs.readdir(INSTANCES_ROOT, { withFileTypes: true });
    const instances = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && INSTANCE_NAME_PATTERN.test(entry.name)) {
        const instancePath = path.join(INSTANCES_ROOT, entry.name);
        const interfacedesignPath = path.join(instancePath, 'interfacedesign');
        
        let info = {
          id: entry.name,
          name: entry.name,
          path: interfacedesignPath,
          hasProfiles: false,
          profilesCompleted: false,
          activeProfileCount: 0,
          activeProfiles: [],
          profileFilterMode: 'OR',
          moduleCount: 0,
          testcaseCount: 0,
          filteredTestcaseCount: 0,
          hasInterfaces: true,
          hasTestCases: false
        };

        // TODO Check for interfaces
        
        instances.push(info);
      }
    }
    return instances;
  } catch (error) {
    console.error('Error listing instances:', error);
    throw error;
  }
}


async function getTemplates() {
  try {
    const entries = await fs.readdir(TEMPLATES_ROOT, { withFileTypes: true });
    const templates = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
        const templatePath = path.join(TEMPLATES_ROOT, entry.name);
        const interfacedesignPath = path.join(templatePath, 'interfacedesign');
        
        let template = {
          id: entry.name,
          name: entry.name,
          description: '',
          moduleCount: 0,
          testcaseCount: 0,
          hasInterfaces: true,
          hasTestCases: false
        };
        
        // Todo Check for Interfaces
        
        templates.push(template);
      }
    }
    return templates;
  } catch (error) {
    console.error('Error listing templates:', error);
    throw error;
  }
}


module.exports = {
  getInstances,
  getTemplates
}