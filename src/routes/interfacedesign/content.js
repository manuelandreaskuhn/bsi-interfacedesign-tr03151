/**
 * InterfaceDesign Content Routes
 * Handles API endpoints for functions, enums, types, and exceptions
 */

const express = require('express');
const path = require('path');
const { getInterfaceDesignPath } = require('./common');
const xmlParser = require('../../utils/interfacedesign/xmlParser');

const router = express.Router();

/**
 * Helper to extract text from multilingual object
 * @param {Object|string} obj - Multilingual object or plain string
 * @param {string} lang - Language code (default 'de')
 * @returns {string} - Text in requested language or fallback
 */
function getText(obj, lang = 'de') {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj._default || obj.de || obj.en || '';
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
    
    // Sort by category (using default text), then by name
    exceptions.sort((a, b) => {
      const catA = getText(a.category);
      const catB = getText(b.category);
      if (catA !== catB) {
        return catA.localeCompare(catB);
      }
      return a.name.localeCompare(b.name);
    });

    // Group by category (using default text as key)
    const grouped = {};
    exceptions.forEach(e => {
      const cat = getText(e.category) || 'Uncategorized';
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
 * GET /:instance/interfacedesign/type/:id
 * Get a single type by ID with full details
 */
router.get('/:instance/interfacedesign/type/:id', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const filePath = path.join(basePath, 'types', `${req.params.id}.xml`);
    const typeData = await xmlParser.parseTypeDetail(filePath);
    
    if (!typeData) {
      return res.status(404).json({ error: 'Type not found' });
    }

    res.json({
      success: true,
      type: typeData
    });
  } catch (error) {
    console.error('Error getting type:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/enum/:id
 * Get a single enum by ID with full details
 */
router.get('/:instance/interfacedesign/enum/:id', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const filePath = path.join(basePath, 'enums', `${req.params.id}.xml`);
    const enumData = await xmlParser.parseEnumDetail(filePath);
    
    if (!enumData) {
      return res.status(404).json({ error: 'Enum not found' });
    }

    res.json({
      success: true,
      enum: enumData
    });
  } catch (error) {
    console.error('Error getting enum:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/exception/:id
 * Get a single exception by ID with full details
 */
router.get('/:instance/interfacedesign/exception/:id', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const filePath = path.join(basePath, 'exceptions', `${req.params.id}.xml`);
    const exception = await xmlParser.parseExceptionDetail(filePath);
    
    if (!exception) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    res.json({
      success: true,
      exception
    });
  } catch (error) {
    console.error('Error getting exception:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/function/:id
 * Get a single function by ID with full details
 */
router.get('/:instance/interfacedesign/function/:id', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const filePath = path.join(basePath, 'functions', `${req.params.id}.xml`);
    const funcData = await xmlParser.parseFunctionDetail(filePath);
    
    if (!funcData) {
      return res.status(404).json({ error: 'Function not found' });
    }

    res.json({
      success: true,
      function: funcData
    });
  } catch (error) {
    console.error('Error getting function:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/processes
 * Get all processes
 */
router.get('/:instance/interfacedesign/processes', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const processes = await xmlParser.loadProcesses(basePath);
    
    // Sort by actor, then by id
    processes.sort((a, b) => {
      if (a.actor !== b.actor) {
        return a.actor.localeCompare(b.actor);
      }
      return a.id.localeCompare(b.id);
    });

    // Group by actor
    const groupedByActor = {};
    processes.forEach(proc => {
      const actor = proc.actor || 'Uncategorized';
      if (!groupedByActor[actor]) {
        groupedByActor[actor] = [];
      }
      groupedByActor[actor].push(proc);
    });

    // Group by diagram type
    const groupedByType = {};
    processes.forEach(proc => {
      const type = proc.diagramType || 'unknown';
      if (!groupedByType[type]) {
        groupedByType[type] = [];
      }
      groupedByType[type].push(proc);
    });

    res.json({
      success: true,
      count: processes.length,
      items: processes,
      groupedByActor,
      groupedByType
    });
  } catch (error) {
    console.error('Error getting processes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/process/:actor/:type/:id
 * Get a single process by actor, type and ID with full details
 */
router.get('/:instance/interfacedesign/process/:actor/:type/:id', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const { actor, type, id } = req.params;
    const filePath = path.join(basePath, 'processes', actor, type, `${id}.xml`);
    const processData = await xmlParser.parseProcessDetail(filePath, actor, type);
    
    if (!processData) {
      return res.status(404).json({ error: 'Process not found' });
    }

    res.json({
      success: true,
      process: processData
    });
  } catch (error) {
    console.error('Error getting process:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Process Chains Routes
// ============================================

/**
 * GET /:instance/interfacedesign/processchains
 * Get all process chains
 */
router.get('/:instance/interfacedesign/processchains', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const chains = await xmlParser.loadProcessChains(basePath);
    
    // Sort by chainId
    chains.sort((a, b) => a.chainId.localeCompare(b.chainId));

    res.json({
      success: true,
      items: chains,
      count: chains.length
    });
  } catch (error) {
    console.error('Error loading process chains:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:instance/interfacedesign/processchain/:id
 * Get a single process chain by ID with full details
 * Searches all process chain folders to find the chain
 */
router.get('/:instance/interfacedesign/processchain/:id', async (req, res) => {
  try {
    const basePath = await getInterfaceDesignPath(req.params.instance);
    if (!basePath) {
      return res.status(404).json({ error: 'InterfaceDesign folder not found' });
    }

    const { id } = req.params;
    
    // First, load all process chains to find the one with matching ID
    const allChains = await xmlParser.loadProcessChains(basePath);
    const chainInfo = allChains.find(c => c.id === id || c.chainId === id);
    
    if (!chainInfo) {
      return res.status(404).json({ error: 'Process chain not found' });
    }

    // Now load the full details using the found file path
    const chainData = await xmlParser.parseProcessChainDetail(chainInfo.filePath);
    
    if (!chainData) {
      return res.status(404).json({ error: 'Process chain not found' });
    }

    // Add folder info
    chainData.folder = chainInfo.folder;

    res.json({
      success: true,
      processChain: chainData
    });
  } catch (error) {
    console.error('Error getting process chain:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
