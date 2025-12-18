/**
 * Common utilities for InterfaceDesign Routes
 */

const fs = require('fs').promises;
const path = require('path');
const { INSTANCES_ROOT, TEMPLATES_ROOT } = require('../../config');

/**
 * Get the interfacedesign path for an instance
 * Falls back to template if instance doesn't have interfacedesign folder
 */
async function getInterfaceDesignPath(instance) {
  // First try instance path
  const instancePath = path.join(INSTANCES_ROOT, instance, 'interfacedesign');
  try {
    await fs.access(instancePath);
    const files = await fs.readdir(instancePath);
    if (files.length > 0) {
      return instancePath;
    }
  } catch (err) {
    // Instance path doesn't exist or is empty
  }

  // Fall back to template path
  const templatePath = path.join(TEMPLATES_ROOT, 'bsi-tr-03153-03151', 'interfacedesign');
  try {
    await fs.access(templatePath);
    return templatePath;
  } catch (err) {
    return null;
  }
}

module.exports = {
  getInterfaceDesignPath
};
