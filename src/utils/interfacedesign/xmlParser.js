/**
 * XML Parser Utilities for InterfaceDesign Module
 * Parses function, enum, type, and exception XML files
 */

const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');

// XML Parser with options
const parser = new xml2js.Parser({
  explicitArray: false,
  mergeAttrs: true,
  trim: true
});

/**
 * Parse a single XML file
 * @param {string} filePath - Path to XML file
 * @returns {Promise<Object>} - Parsed XML object
 */
async function parseXmlFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const result = await parser.parseStringPromise(content);
    return result;
  } catch (error) {
    console.error(`Error parsing XML file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Get all XML files from a directory
 * @param {string} dirPath - Directory path
 * @returns {Promise<Array>} - Array of file paths
 */
async function getXmlFilesFromDir(dirPath) {
  try {
    const exists = await fs.access(dirPath).then(() => true).catch(() => false);
    if (!exists) return [];

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.xml'))
      .map(entry => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        baseName: entry.name.replace('.xml', '')
      }));
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
    return [];
  }
}

/**
 * Parse a function XML file and extract relevant data
 * @param {string} filePath - Path to function XML file
 * @returns {Promise<Object>} - Function data
 */
async function parseFunction(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.function) return null;

  const func = xml.function;
  
  // Extract parameters
  let parameters = [];
  if (func.parameters && func.parameters.parameter) {
    const params = Array.isArray(func.parameters.parameter) 
      ? func.parameters.parameter 
      : [func.parameters.parameter];
    parameters = params.map(p => ({
      name: p.n || p.name || '',
      type: p.type || '',
      description: p.description || '',
      direction: p.direction || 'INPUT',
      required: p.required === 'true' || p.required === true
    }));
  }

  // Extract exceptions
  let exceptions = [];
  if (func.exceptions && func.exceptions.exception) {
    exceptions = Array.isArray(func.exceptions.exception) 
      ? func.exceptions.exception 
      : [func.exceptions.exception];
  }

  // Extract detailed steps count
  let stepCount = 0;
  if (func.detailedSteps && func.detailedSteps.step) {
    const steps = Array.isArray(func.detailedSteps.step) 
      ? func.detailedSteps.step 
      : [func.detailedSteps.step];
    stepCount = steps.length;
  }

  return {
    id: func.id || func.n || path.basename(filePath, '.xml'),
    name: func.n || func.name || '',
    category: func.category || 'Uncategorized',
    description: func.description || '',
    parameters,
    parameterCount: parameters.length,
    returnValue: func.returnValue ? {
      type: func.returnValue.type || 'void',
      description: func.returnValue.description || ''
    } : { type: 'void', description: '' },
    exceptions,
    exceptionCount: exceptions.length,
    stepCount,
    hasSystemLog: !!func.systemLog,
    filePath
  };
}

/**
 * Parse an enum XML file and extract relevant data
 * @param {string} filePath - Path to enum XML file
 * @returns {Promise<Object>} - Enum data
 */
async function parseEnum(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.enum) return null;

  const enumData = xml.enum;

  // Extract values
  let values = [];
  if (enumData.values && enumData.values.value) {
    const vals = Array.isArray(enumData.values.value) 
      ? enumData.values.value 
      : [enumData.values.value];
    values = vals.map(v => ({
      name: v.n || v.name || '',
      numericValue: v.numericValue,
      hexValue: v.hexValue,
      description: v.description || ''
    }));
  }

  return {
    id: enumData.id || enumData.n || path.basename(filePath, '.xml'),
    name: enumData.n || enumData.name || '',
    category: enumData.category || 'Uncategorized',
    description: enumData.description || '',
    values,
    valueCount: values.length,
    filePath
  };
}

/**
 * Parse a type XML file and extract relevant data
 * @param {string} filePath - Path to type XML file
 * @returns {Promise<Object>} - Type data
 */
async function parseType(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml) return null;

  // Types can have different root elements
  const typeData = xml.type || xml.resultType || xml.eventData || Object.values(xml)[0];
  if (!typeData) return null;

  // Extract fields
  let fields = [];
  if (typeData.fields && typeData.fields.field) {
    const flds = Array.isArray(typeData.fields.field) 
      ? typeData.fields.field 
      : [typeData.fields.field];
    fields = flds.map(f => ({
      name: f.n || f.name || '',
      type: f.type || '',
      description: f.description || '',
      required: f.required === 'true' || f.required === true
    }));
  }

  // Determine category based on name
  let category = 'Uncategorized';
  const name = typeData.n || typeData.name || path.basename(filePath, '.xml');
  if (name.endsWith('EventData')) {
    category = 'EventData';
  } else if (name.endsWith('Result')) {
    category = 'Result';
  } else if (name.endsWith('Set')) {
    category = 'Set';
  }

  return {
    id: typeData.id || name,
    name: name,
    category: typeData.category || category,
    description: typeData.description || '',
    fields,
    fieldCount: fields.length,
    rootElement: Object.keys(xml)[0],
    filePath
  };
}

/**
 * Parse an exception XML file and extract relevant data
 * @param {string} filePath - Path to exception XML file
 * @returns {Promise<Object>} - Exception data
 */
async function parseException(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.exception) return null;

  const exc = xml.exception;

  // Extract functions that throw this exception
  let thrownBy = [];
  if (exc.thrownBy && exc.thrownBy.function) {
    thrownBy = Array.isArray(exc.thrownBy.function) 
      ? exc.thrownBy.function 
      : [exc.thrownBy.function];
  }

  return {
    id: exc.id || exc.n || path.basename(filePath, '.xml'),
    name: exc.n || exc.name || '',
    category: exc.category || 'Uncategorized',
    severity: exc.severity || 'Medium',
    description: exc.description || '',
    javadoc: exc.javadoc ? {
      summary: exc.javadoc.summary || ''
    } : null,
    specification: exc.specification ? {
      source: exc.specification.source || '',
      requirement: exc.specification.requirement || ''
    } : null,
    thrownBy,
    thrownByCount: thrownBy.length,
    filePath
  };
}

/**
 * Load all items from a category directory
 * @param {string} basePath - Base path for interfacedesign
 * @param {string} category - Category name (functions, enums, types, exceptions)
 * @returns {Promise<Array>} - Array of parsed items
 */
async function loadCategory(basePath, category) {
  const categoryPath = path.join(basePath, category);
  const files = await getXmlFilesFromDir(categoryPath);
  
  const parseFunc = {
    functions: parseFunction,
    enums: parseEnum,
    types: parseType,
    exceptions: parseException
  }[category];

  if (!parseFunc) {
    console.error(`Unknown category: ${category}`);
    return [];
  }

  const items = await Promise.all(
    files.map(file => parseFunc(file.path))
  );

  return items.filter(item => item !== null);
}

/**
 * Get overview of all categories
 * @param {string} basePath - Base path for interfacedesign
 * @returns {Promise<Object>} - Overview with counts and category info
 */
async function getOverview(basePath) {
  const categories = ['functions', 'enums', 'types', 'exceptions'];
  const overview = {
    functions: { count: 0, categories: {} },
    enums: { count: 0, categories: {} },
    types: { count: 0, categories: {} },
    exceptions: { count: 0, categories: {} }
  };

  for (const category of categories) {
    const items = await loadCategory(basePath, category);
    overview[category].count = items.length;
    
    // Group by category/subcategory
    items.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!overview[category].categories[cat]) {
        overview[category].categories[cat] = 0;
      }
      overview[category].categories[cat]++;
    });
  }

  return overview;
}

module.exports = {
  parseXmlFile,
  getXmlFilesFromDir,
  parseFunction,
  parseEnum,
  parseType,
  parseException,
  loadCategory,
  getOverview
};
