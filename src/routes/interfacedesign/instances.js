/**
 * Instance Management Routes
 * Handles listing, creating, and managing instances
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { INSTANCES_ROOT, TEMPLATES_ROOT } = require('../../config');

// Valid instance name pattern (URL-safe)
const INSTANCE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Count XML files in a directory
 */
async function countXmlFiles(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    return files.filter(f => f.endsWith('.xml')).length;
  } catch {
    return 0;
  }
}

/**
 * Get InterfaceDesign statistics for a path
 */
async function getInterfaceStats(interfacedesignPath) {
  const stats = {
    hasInterfaces: false,
    functionCount: 0,
    exceptionCount: 0,
    typeCount: 0,
    enumCount: 0
  };

  try {
    await fs.access(interfacedesignPath);

    // Count functions
    const functionsPath = path.join(interfacedesignPath, 'functions');
    stats.functionCount = await countXmlFiles(functionsPath);

    // Count exceptions
    const exceptionsPath = path.join(interfacedesignPath, 'exceptions');
    stats.exceptionCount = await countXmlFiles(exceptionsPath);

    // Count types
    const typesPath = path.join(interfacedesignPath, 'types');
    stats.typeCount = await countXmlFiles(typesPath);

    // Count enums
    const enumsPath = path.join(interfacedesignPath, 'enums');
    stats.enumCount = await countXmlFiles(enumsPath);

    // Only set hasInterfaces to true if at least one XML file exists
    const totalCount = stats.functionCount + stats.exceptionCount + stats.typeCount + stats.enumCount;
    stats.hasInterfaces = totalCount > 0;

  } catch {
    stats.hasInterfaces = false;
  }

  return stats;
}


async function getInstances() {
  try {
    const entries = await fs.readdir(INSTANCES_ROOT, { withFileTypes: true });
    const instances = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && INSTANCE_NAME_PATTERN.test(entry.name)) {
        const instancePath = path.join(INSTANCES_ROOT, entry.name);
        const interfacedesignPath = path.join(instancePath, 'interfacedesign');
        
        // Get interface design stats
        const interfaceStats = await getInterfaceStats(interfacedesignPath);
        
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
          hasInterfaces: interfaceStats.hasInterfaces,
          functionCount: interfaceStats.functionCount,
          exceptionCount: interfaceStats.exceptionCount,
          typeCount: interfaceStats.typeCount,
          enumCount: interfaceStats.enumCount,
          hasTestCases: false
        };
        
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
        
        // Get interface design stats
        const interfaceStats = await getInterfaceStats(interfacedesignPath);
        
        let template = {
          id: entry.name,
          name: entry.name,
          description: '',
          moduleCount: 0,
          testcaseCount: 0,
          hasInterfaces: interfaceStats.hasInterfaces,
          functionCount: interfaceStats.functionCount,
          exceptionCount: interfaceStats.exceptionCount,
          typeCount: interfaceStats.typeCount,
          enumCount: interfaceStats.enumCount,
          hasTestCases: false
        };
        
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