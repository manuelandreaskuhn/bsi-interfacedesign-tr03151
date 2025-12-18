/**
 * InterfaceDesign Content Routes
 * Handles API endpoints for functions, enums, types, and exceptions
 */

const express = require('express');
const path = require('path');
const { INSTANCES_ROOT, TEMPLATES_ROOT } = require('../../config');
const xmlParser = require('../../utils/interfacedesign/xmlParser');

const router = express.Router();

/**
 * Get the interfacedesign path for an instance
 * Falls back to template if instance doesn't have interfacedesign folder
 */
async function getInterfaceDesignPath(instance) {
  const fs = require('fs').promises;
  
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

/**
 * GET /:instance/interfacedesign/overview
 * Get overview of all categories with counts
 */
router.get('/:instance/interfacedesign/overview', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const overview = await xmlParser.getOverview(basePath);
    res.json({
      success: true,
      basePath,
      overview
    });
  } catch (error) {
    console.error('Error getting overview:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/functions
 * Get all functions
 */
router.get('/:instance/interfacedesign/functions', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const functions = await xmlParser.loadCategory(basePath, 'functions');
    
    // Sort by category, then by name
    functions.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    // Group by category
    const grouped = {};
    functions.forEach(func => {
      const cat = func.category || 'Uncategorized';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(func);
    });

    res.json({
      success: true,
      count: functions.length,
      items: functions,
      grouped
    });
  } catch (error) {
    console.error('Error getting functions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/enums
 * Get all enums
 */
router.get('/:instance/interfacedesign/enums', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const enums = await xmlParser.loadCategory(basePath, 'enums');
    
    // Sort by name
    enums.sort((a, b) => a.name.localeCompare(b.name));

    // Group by category
    const grouped = {};
    enums.forEach(e => {
      const cat = e.category || 'Uncategorized';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(e);
    });

    res.json({
      success: true,
      count: enums.length,
      items: enums,
      grouped
    });
  } catch (error) {
    console.error('Error getting enums:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/types
 * Get all types
 */
router.get('/:instance/interfacedesign/types', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const types = await xmlParser.loadCategory(basePath, 'types');
    
    // Sort by category, then by name
    types.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    // Group by category
    const grouped = {};
    types.forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(t);
    });

    res.json({
      success: true,
      count: types.length,
      items: types,
      grouped
    });
  } catch (error) {
    console.error('Error getting types:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/exceptions
 * Get all exceptions
 */
router.get('/:instance/interfacedesign/exceptions', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const exceptions = await xmlParser.loadCategory(basePath, 'exceptions');
    
    // Sort by category, then by name
    exceptions.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    // Group by category
    const grouped = {};
    exceptions.forEach(e => {
      const cat = e.category || 'Uncategorized';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(e);
    });

    // Also group by severity
    const bySeverity = {};
    exceptions.forEach(e => {
      const sev = e.severity || 'Medium';
      if (!bySeverity[sev]) {
        bySeverity[sev] = [];
      }
      bySeverity[sev].push(e);
    });

    res.json({
      success: true,
      count: exceptions.length,
      items: exceptions,
      grouped,
      bySeverity
    });
  } catch (error) {
    console.error('Error getting exceptions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/function/:id
 * Get a single function by ID
 */
router.get('/:instance/interfacedesign/function/:id', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const filePath = path.join(basePath, 'functions', `${req.params.id}.xml`);
    const func = await xmlParser.parseFunction(filePath);
    
    if (!func) {
      return res.status(404).json({ error: 'Function not found' });
    }

    // Also parse detailed steps
    const fs = require('fs').promises;
    const content = await fs.readFile(filePath, 'utf-8');
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true, trim: true });
    const fullXml = await parser.parseStringPromise(content);
    
    let detailedSteps = [];
    if (fullXml.function && fullXml.function.detailedSteps && fullXml.function.detailedSteps.step) {
      const steps = Array.isArray(fullXml.function.detailedSteps.step) 
        ? fullXml.function.detailedSteps.step 
        : [fullXml.function.detailedSteps.step];
      detailedSteps = steps.map(s => ({
        number: parseInt(s.number) || 0,
        originalText: s.originalText || '',
        germanText: s.germanText || '',
        pseudocode: s.pseudocode || '',
        errorCases: s.errorCase ? (Array.isArray(s.errorCase) ? s.errorCase : [s.errorCase]) : [],
        successCases: s.successCase ? (Array.isArray(s.successCase) ? s.successCase : [s.successCase]) : []
      }));
    }

    res.json({
      success: true,
      function: {
        ...func,
        detailedSteps
      }
    });
  } catch (error) {
    console.error('Error getting function:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
