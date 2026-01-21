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
 * Extract multilingual text from an XML element
 * Supports: 
 *   - <element><text xml:lang="de">...</text><text xml:lang="en">...</text></element>
 *   - <element><shortCommand xml:lang="de">...</shortCommand><shortCommand xml:lang="en">...</shortCommand></element>
 *   - <element>Direct text content</element> (fallback)
 * 
 * @param {any} element - The XML element (parsed by xml2js)
 * @param {string} childElementName - Optional: name of child element to extract (e.g., 'text', 'shortCommand')
 * @returns {Object} - Object with language keys: { de: "...", en: "...", _default: "..." }
 */
function extractMultiLangText(element, childElementName = 'text') {
  if (!element) return { _default: '' };
  
  // If element is a string, return it as default
  if (typeof element === 'string') {
    return { _default: element, de: element, en: element };
  }
  
  // Check for child element structure (e.g., <text xml:lang="..."> or <shortCommand xml:lang="...">)
  const childElement = element[childElementName];
  if (childElement) {
    const texts = Array.isArray(childElement) ? childElement : [childElement];
    const result = { _default: '' };
    
    texts.forEach(t => {
      if (typeof t === 'string') {
        // Plain text without lang attribute
        result._default = t;
      } else if (t) {
        // Extract language from xml:lang attribute (xml2js merges attrs)
        const lang = t['xml:lang'] || t.lang || t['$']?.['xml:lang'] || t['$']?.lang;
        const content = t._ || t['#text'] || (typeof t === 'string' ? t : '');
        
        if (lang) {
          result[lang] = content;
          if (!result._default) result._default = content;
        } else if (content) {
          result._default = content;
        }
      }
    });
    
    // Set fallbacks: if one language is missing, use the other
    if (!result.de && result.en) result.de = result.en;
    if (!result.en && result.de) result.en = result.de;
    if (!result._default) result._default = result.de || result.en || '';
    
    return result;
  }
  
  // Fallback: element is direct text content or has _ property
  const directText = element._ || element['#text'] || 
                     (typeof element === 'object' ? '' : String(element));
  return { _default: directText, de: directText, en: directText };
}

/**
 * Helper to get text for a specific language with fallback
 * @param {Object} multiLangObj - Object from extractMultiLangText
 * @param {string} lang - Language code ('de' or 'en')
 * @returns {string} - Text in requested language or fallback
 */
function getTextForLang(multiLangObj, lang = 'de') {
  if (!multiLangObj) return '';
  if (typeof multiLangObj === 'string') return multiLangObj;
  return multiLangObj[lang] || multiLangObj._default || multiLangObj.de || multiLangObj.en || '';
}

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
  
  // Extract parameters with multilingual support
  let parameters = [];
  if (func.parameters && func.parameters.parameter) {
    const params = Array.isArray(func.parameters.parameter) 
      ? func.parameters.parameter 
      : [func.parameters.parameter];
    parameters = params.map(p => ({
      name: p.n || p.name || '',
      type: p.type || '',
      description: extractMultiLangText(p.description),
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
    description: extractMultiLangText(func.description),
    parameters,
    parameterCount: parameters.length,
    returnValue: func.returnValue ? {
      type: func.returnValue.type || 'void',
      description: extractMultiLangText(func.returnValue.description)
    } : { type: 'void', description: { _default: '' } },
    exceptions,
    exceptionCount: exceptions.length,
    stepCount,
    hasSystemLog: !!func.systemLog,
    filePath
  };
}

/**
 * Parse a function XML file with full details
 * @param {string} filePath - Path to function XML file
 * @returns {Promise<Object>} - Full function data
 */
async function parseFunctionDetail(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.function) return null;

  const func = xml.function;
  
  // Extract parameters with full details and multilingual support
  let parameters = [];
  if (func.parameters && func.parameters.parameter) {
    const params = Array.isArray(func.parameters.parameter) 
      ? func.parameters.parameter 
      : [func.parameters.parameter];
    parameters = params.map(p => ({
      name: p.n || p.name || '',
      type: p.type || '',
      description: extractMultiLangText(p.description),
      direction: p.direction || 'INPUT',
      required: p.required === 'true' || p.required === true,
      defaultValue: p.defaultValue || ''
    }));
  }

  // Extract exceptions
  let exceptions = [];
  if (func.exceptions && func.exceptions.exception) {
    exceptions = Array.isArray(func.exceptions.exception) 
      ? func.exceptions.exception 
      : [func.exceptions.exception];
  }

  // Extract detailed steps with all information and multilingual support
  let detailedSteps = [];
  if (func.detailedSteps && func.detailedSteps.step) {
    const steps = Array.isArray(func.detailedSteps.step) 
      ? func.detailedSteps.step 
      : [func.detailedSteps.step];
    
    detailedSteps = steps.map(s => {
      // Extract standardStep information
      let standardStep = null;
      if (s.standardStep) {
        standardStep = {
          number: parseInt(s.standardStep.number) || null,
          shortCommand: extractMultiLangText(s.standardStep, 'shortCommand')
        };
      }
      
      // Extract error cases with multilingual support
      let errorCases = [];
      if (s.errorCase) {
        const cases = Array.isArray(s.errorCase) ? s.errorCase : [s.errorCase];
        errorCases = cases.map(ec => ({
          exception: ec.exception || '',
          trigger: extractMultiLangText(ec.trigger),
          action: extractMultiLangText(ec.action)
        }));
      }
      
      // Extract success cases with multilingual support
      let successCases = [];
      if (s.successCase) {
        const cases = Array.isArray(s.successCase) ? s.successCase : [s.successCase];
        successCases = cases.map(sc => ({
          condition: extractMultiLangText(sc.condition),
          action: extractMultiLangText(sc.action)
        }));
      }
      
      // Support both new format (description with xml:lang) and old format (originalText/germanText)
      let description = extractMultiLangText(s.description);
      // Fallback to old format if new format is empty
      if (!description._default && (s.originalText || s.germanText)) {
        description = {
          _default: s.germanText || s.originalText || '',
          en: s.originalText || s.germanText || '',
          de: s.germanText || s.originalText || ''
        };
      }
      
      return {
        number: parseInt(s.number) || 0,
        standardStep: standardStep,
        description: description,
        pseudocode: extractMultiLangText(s.pseudocode),
        // Keep old format fields for backwards compatibility
        originalText: s.originalText || '',
        germanText: s.germanText || '',
        errorCases,
        successCases
      };
    });
    
    // Sort by step number
    detailedSteps.sort((a, b) => a.number - b.number);
  }

  // Extract notes
  let notes = [];
  if (func.note) {
    const noteList = Array.isArray(func.note) ? func.note : [func.note];
    notes = noteList.map(n => {
      if (typeof n === 'string') return { text: n, type: '' };
      return { text: n._ || n, type: n.type || '' };
    });
  }

  // Helper function to parse log fields with multilingual support
  const parseLogFields = (structure) => {
    if (!structure || !structure.field) return [];
    const fields = Array.isArray(structure.field) ? structure.field : [structure.field];
    return fields.map(f => ({
      name: f.n || f.name || '',
      type: f.type || '',
      tag: f.tag || '',
      required: f.required === 'true' || f.required === true,
      defaultValue: f.defaultValue || '',
      description: extractMultiLangText(f.description),
      note: f.note || '',
      origin: f.origin || ''
    }));
  };

  // Extract system log info with full details
  let systemLog = null;
  if (func.systemLog) {
    systemLog = {
      logType: func.systemLog.logType || 'system',
      requirement: func.systemLog.requirement || '',
      asn1Structure: func.systemLog.asn1Structure ? {
        logMessage: func.systemLog.asn1Structure.logMessage || '',
        systemLogMessage: func.systemLog.asn1Structure.systemLogMessage || ''
      } : null,
      fields: parseLogFields(func.systemLog.structure)
    };
  }

  // Extract transaction log info with full details
  let transactionLog = null;
  if (func.transactionLog) {
    transactionLog = {
      logType: func.transactionLog.logType || 'transaction-log',
      requirement: func.transactionLog.requirement || '',
      asn1Structure: func.transactionLog.asn1Structure ? {
        logMessage: func.transactionLog.asn1Structure.logMessage || '',
        transactionLogMessage: func.transactionLog.asn1Structure.transactionLogMessage || ''
      } : null,
      fields: parseLogFields(func.transactionLog.structure)
    };
  }

  // Extract overloads (function overloading)
  let overloads = [];
  if (func.overloads && func.overloads.overload) {
    const overloadList = Array.isArray(func.overloads.overload) ? func.overloads.overload : [func.overloads.overload];
    overloads = overloadList.map(overload => ({
      id: overload.id || '',
      signature: overload.signature || '',
      description: extractMultiLangText(overload.description),
      parameters: overload.parameters ? (overload.parameters.param ? (Array.isArray(overload.parameters.param) ? overload.parameters.param : [overload.parameters.param]) : []) : [],
      note: overload.note ? extractMultiLangText(overload.note) : null
    }));
  }

  // Extract mutual exclusions
  let mutualExclusions = [];
  if (func.mutualExclusions && func.mutualExclusions.exclusion) {
    const exclusionList = Array.isArray(func.mutualExclusions.exclusion) ? func.mutualExclusions.exclusion : [func.mutualExclusions.exclusion];
    mutualExclusions = exclusionList.map(ex => extractMultiLangText(ex));
  }

  return {
    id: func.id || func.n || path.basename(filePath, '.xml'),
    name: func.n || func.name || '',
    category: func.category || 'Uncategorized',
    description: extractMultiLangText(func.description),
    parameters,
    parameterCount: parameters.length,
    returnValue: func.returnValue ? {
      type: func.returnValue.type || 'void',
      description: extractMultiLangText(func.returnValue.description)
    } : { type: 'void', description: { _default: '' } },
    exceptions,
    exceptionCount: exceptions.length,
    detailedSteps,
    stepCount: detailedSteps.length,
    precondition: func.precondition || '',
    postcondition: func.postcondition || '',
    notes,
    overloads,
    overloadCount: overloads.length,
    mutualExclusions,
    systemLog,
    transactionLog,
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
 * Parse an enum XML file with full details
 * @param {string} filePath - Path to enum XML file
 * @returns {Promise<Object>} - Full enum data
 */
async function parseEnumDetail(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.enum) return null;

  const enumData = xml.enum;

  // Extract values with all details
  let values = [];
  if (enumData.values && enumData.values.value) {
    const vals = Array.isArray(enumData.values.value) 
      ? enumData.values.value 
      : [enumData.values.value];
    values = vals.map(v => ({
      name: v.n || v.name || '',
      numericValue: v.numericValue !== undefined ? parseInt(v.numericValue) : undefined,
      hexValue: v.hexValue || '',
      description: v.description || '',
      germanText: v.germanText || '',
      usage: v.usage || '',
      deprecated: v.deprecated === 'true' || v.deprecated === true,
      since: v.since || ''
    }));
  }

  // Extract type info
  let typeInfo = null;
  if (enumData.typeInfo) {
    typeInfo = {
      asn1Type: enumData.typeInfo.asn1Type || '',
      javaType: enumData.typeInfo.javaType || '',
      cType: enumData.typeInfo.cType || '',
      encoding: enumData.typeInfo.encoding || ''
    };
  }

  // Extract constraints
  let constraints = [];
  if (enumData.constraints && enumData.constraints.constraint) {
    const cons = Array.isArray(enumData.constraints.constraint)
      ? enumData.constraints.constraint
      : [enumData.constraints.constraint];
    constraints = cons.map(c => ({
      type: c.type || '',
      description: c.description || ''
    }));
  }

  // Extract related enumerations
  let relatedEnumerations = [];
  if (enumData.relatedEnumerations && enumData.relatedEnumerations.enumeration) {
    relatedEnumerations = Array.isArray(enumData.relatedEnumerations.enumeration)
      ? enumData.relatedEnumerations.enumeration
      : [enumData.relatedEnumerations.enumeration];
  }

  // Extract notes
  let notes = [];
  if (enumData.note) {
    notes = Array.isArray(enumData.note) ? enumData.note : [enumData.note];
  }

  return {
    id: enumData.id || enumData.n || path.basename(filePath, '.xml'),
    name: enumData.n || enumData.name || '',
    category: enumData.category || 'Uncategorized',
    description: enumData.description || '',
    germanText: enumData.germanText || '',
    values,
    valueCount: values.length,
    typeInfo,
    constraints,
    usageContext: enumData.usageContext || '',
    relatedEnumerations,
    notes,
    version: enumData.version || '',
    lastModified: enumData.lastModified || '',
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
    description: extractMultiLangText(typeData.description),
    fields,
    fieldCount: fields.length,
    rootElement: Object.keys(xml)[0],
    filePath
  };
}

/**
 * Parse a type XML file with full details
 * @param {string} filePath - Path to type XML file
 * @returns {Promise<Object>} - Full type data
 */
async function parseTypeDetail(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml) return null;

  // Types can have different root elements
  const typeData = xml.type || xml.resultType || xml.eventData || Object.values(xml)[0];
  if (!typeData) return null;

  // Extract fields with all details
  let fields = [];
  if (typeData.fields && typeData.fields.field) {
    const flds = Array.isArray(typeData.fields.field) 
      ? typeData.fields.field 
      : [typeData.fields.field];
    fields = flds.map(f => ({
      name: f.n || f.name || '',
      type: f.type || '',
      description: f.description || '',
      optional: f.optional === 'true' || f.optional === true,
      required: f.required === 'true' || f.required === true,
      getter: f.getter || '',
      setter: f.setter || '',
      defaultValue: f.defaultValue || f.default || ''
    }));
  }

  // Extract constraints
  let constraints = [];
  if (typeData.constraints && typeData.constraints.constraint) {
    const cons = Array.isArray(typeData.constraints.constraint)
      ? typeData.constraints.constraint
      : [typeData.constraints.constraint];
    constraints = cons.map(c => ({
      type: c.type || '',
      description: c.description || ''
    }));
  }

  // Extract notes
  let notes = [];
  if (typeData.note) {
    notes = Array.isArray(typeData.note) ? typeData.note : [typeData.note];
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

  // Determine type kind
  const rootElement = Object.keys(xml)[0];
  let typeKind = 'complex';
  if (rootElement === 'resultType') {
    typeKind = 'result';
  } else if (typeData.baseType) {
    typeKind = 'simple';
  } else if (name.endsWith('EventData')) {
    typeKind = 'eventData';
  }

  return {
    id: typeData.id || name,
    name: name,
    category: typeData.category || category,
    description: extractMultiLangText(typeData.description),
    baseType: typeData.baseType || '',
    asn1Definition: typeData.asn1Definition || '',
    usage: typeData.usage || '',
    fields,
    fieldCount: fields.length,
    constraints,
    notes,
    rootElement,
    typeKind,
    source: typeData.source || '',
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
    category: extractMultiLangText(exc.category),
    severity: exc.severity || 'Medium',
    description: extractMultiLangText(exc.description),
    javadoc: exc.javadoc ? {
      summary: extractMultiLangText(exc.javadoc.summary)
    } : null,
    specification: exc.specification ? {
      source: exc.specification.source || '',
      requirement: extractMultiLangText(exc.specification.requirement)
    } : null,
    thrownBy,
    thrownByCount: thrownBy.length,
    filePath
  };
}

/**
 * Parse an exception XML file with full details
 * @param {string} filePath - Path to exception XML file
 * @returns {Promise<Object>} - Full exception data
 */
async function parseExceptionDetail(filePath) {
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

  // Extract related exceptions (can be just names or objects with descriptions)
  let relatedExceptions = [];
  if (exc.relatedExceptions && exc.relatedExceptions.exception) {
    const relExc = Array.isArray(exc.relatedExceptions.exception)
      ? exc.relatedExceptions.exception
      : [exc.relatedExceptions.exception];
    relatedExceptions = relExc.map(e => {
      if (typeof e === 'string') {
        const parts = e.split(' - ');
        return {
          name: parts[0].trim(),
          description: extractMultiLangText(parts[1] ? parts[1].trim() : '')
        };
      }
      return {
        name: e.name || e.n || e,
        description: extractMultiLangText(e.description)
      };
    });
  }

  // Extract trigger conditions with all fields (multilingual)
  let triggerConditions = [];
  if (exc.triggerConditions && exc.triggerConditions.condition) {
    const conditions = Array.isArray(exc.triggerConditions.condition)
      ? exc.triggerConditions.condition
      : [exc.triggerConditions.condition];
    triggerConditions = conditions.map(c => ({
      scenario: extractMultiLangText(c.scenario),
      description: extractMultiLangText(c.description),
      trigger: extractMultiLangText(c.trigger),
      action: extractMultiLangText(c.action)
    }));
  }

  // Extract notes (can be under exc.note or exc.notes.note) - multilingual
  let notes = [];
  if (exc.note) {
    const noteArr = Array.isArray(exc.note) ? exc.note : [exc.note];
    notes = noteArr.map(n => extractMultiLangText(n));
  } else if (exc.notes && exc.notes.note) {
    const noteArr = Array.isArray(exc.notes.note) ? exc.notes.note : [exc.notes.note];
    notes = noteArr.map(n => extractMultiLangText(n));
  }

  // Extract javadoc with constructors (multilingual)
  let javadoc = null;
  if (exc.javadoc) {
    let throws = [];
    if (exc.javadoc.throws) {
      throws = Array.isArray(exc.javadoc.throws) ? exc.javadoc.throws : [exc.javadoc.throws];
    }
    
    // Extract constructors
    let constructors = [];
    if (exc.javadoc.constructors && exc.javadoc.constructors.constructor) {
      const cons = Array.isArray(exc.javadoc.constructors.constructor)
        ? exc.javadoc.constructors.constructor
        : [exc.javadoc.constructors.constructor];
      constructors = cons
        .filter(c => c !== null && c !== undefined && c.signature)
        .map(c => {
          // Extract parameters
          let params = [];
          if (c.parameter) {
            const pars = Array.isArray(c.parameter) ? c.parameter : [c.parameter];
            params = pars.map(p => ({
              name: (p.$ && p.$.name) || p.name || '',
              description: extractMultiLangText(p._ || p.description || p)
            }));
          }
          return {
            signature: c.signature || '',
            description: extractMultiLangText(c.description),
            parameters: params
          };
        });
    }
    
    javadoc = {
      summary: extractMultiLangText(exc.javadoc.summary),
      description: extractMultiLangText(exc.javadoc.description),
      throws,
      constructors,
      since: exc.javadoc.since || '',
      author: exc.javadoc.author || ''
    };
  }

  // Extract specification (multilingual for requirement and applicability)
  let specification = null;
  if (exc.specification) {
    let references = [];
    if (exc.specification.reference) {
      references = Array.isArray(exc.specification.reference) 
        ? exc.specification.reference 
        : [exc.specification.reference];
    }
    specification = {
      source: exc.specification.source || '',
      section: exc.specification.section || '',
      requirement: extractMultiLangText(exc.specification.requirement),
      applicability: extractMultiLangText(exc.specification.applicability),
      references
    };
  }

  // Extract recovery (multilingual)
  let recovery = null;
  if (exc.recovery) {
    if (typeof exc.recovery === 'string') {
      recovery = { description: extractMultiLangText(exc.recovery) };
    } else {
      // Extract steps if present (multilingual)
      let steps = [];
      if (exc.recovery.step) {
        const stepArr = Array.isArray(exc.recovery.step) ? exc.recovery.step : [exc.recovery.step];
        steps = stepArr.map(s => extractMultiLangText(s));
      }
      recovery = {
        description: extractMultiLangText(exc.recovery.description),
        action: extractMultiLangText(exc.recovery.action),
        alternativePath: extractMultiLangText(exc.recovery.alternativePath),
        steps
      };
    }
  }

  // Extract execution sequence (steps with number and name attributes) - multilingual description
  let executionSequence = [];
  if (exc.executionSequence && exc.executionSequence.step) {
    const steps = Array.isArray(exc.executionSequence.step) 
      ? exc.executionSequence.step 
      : [exc.executionSequence.step];
    executionSequence = steps.map(s => ({
      number: s.number || '',
      name: s.name || '',
      description: extractMultiLangText(s._ || s)
    }));
  }

  // Extract postconditionality (state elements - multilingual)
  let postconditionality = [];
  if (exc.postconditionality && exc.postconditionality.state) {
    const states = Array.isArray(exc.postconditionality.state)
      ? exc.postconditionality.state
      : [exc.postconditionality.state];
    postconditionality = states.map(s => {
      if (typeof s === 'string') {
        return { name: '', description: extractMultiLangText(s) };
      }
      return {
        name: s.name || '',
        description: extractMultiLangText(s._ || s.description || s)
      };
    });
  }

  // Extract usage scenarios (multilingual)
  let usage = [];
  if (exc.usage && exc.usage.scenario) {
    const scenarios = Array.isArray(exc.usage.scenario)
      ? exc.usage.scenario
      : [exc.usage.scenario];
    usage = scenarios.map(s => {
      // Safely extract string values - supports both plain strings and xml:lang structure
      const getStringValue = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        // Check for xml:lang structure (same as extractMultiLangText but returns string)
        if (val.text) {
          const texts = Array.isArray(val.text) ? val.text : [val.text];
          for (const t of texts) {
            if (typeof t === 'string') return t;
            if (t && (t._ || t['#text'])) return t._ || t['#text'];
          }
          return '';
        }
        return val._ || val['#text'] || String(val);
      };
      
      return {
        name: s.name || '', // name stays technical/single-language
        description: extractMultiLangText(s.description),
        example: getStringValue(s.example), // code example stays single-language
        relatedFunctions: getStringValue(s.relatedFunctions), // function names - same in all languages
        errorContext: extractMultiLangText(s.errorContext)
      };
    });
  }

  // Extract implementation context notes (multilingual)
  let implementationContext = [];
  if (exc.implementationContext && exc.implementationContext.note) {
    const noteArr = Array.isArray(exc.implementationContext.note)
      ? exc.implementationContext.note
      : [exc.implementationContext.note];
    implementationContext = noteArr.map(n => extractMultiLangText(n));
  }

  return {
    id: exc.id || exc.n || path.basename(filePath, '.xml'),
    name: exc.n || exc.name || '',
    category: extractMultiLangText(exc.category),
    subcategory: extractMultiLangText(exc.subcategory),
    severity: exc.severity || 'Medium',
    description: extractMultiLangText(exc.description),
    javadoc,
    specification,
    thrownBy,
    thrownByCount: thrownBy.length,
    relatedExceptions,
    triggerConditions,
    executionSequence,
    postconditionality,
    recovery,
    usage,
    implementationContext,
    example: exc.example || '',
    notes,
    filePath
  };
}

/**
 * Parse a process XML file and extract relevant data
 * @param {string} filePath - Path to process XML file
 * @param {string} actor - Actor name (from folder structure)
 * @param {string} diagramType - Diagram type (flow or sequenz)
 * @returns {Promise<Object>} - Process data
 */
async function parseProcess(filePath, actor, diagramType) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.process) return null;

  const proc = xml.process;
  const baseName = path.basename(filePath, '.xml');
  
  // Extract interface functions
  let interfaceFunctions = [];
  if (proc.interfaceFunctions && proc.interfaceFunctions.function) {
    interfaceFunctions = Array.isArray(proc.interfaceFunctions.function)
      ? proc.interfaceFunctions.function
      : [proc.interfaceFunctions.function];
  }

  // Extract actors from XML
  let actors = [];
  if (proc.actors && proc.actors.actor) {
    const actorList = Array.isArray(proc.actors.actor) ? proc.actors.actor : [proc.actors.actor];
    actors = actorList.map(a => extractMultiLangText(a));
  }

  // Extract exceptions
  let exceptions = [];
  if (proc.possibleExceptions && proc.possibleExceptions.exception) {
    exceptions = Array.isArray(proc.possibleExceptions.exception)
      ? proc.possibleExceptions.exception
      : [proc.possibleExceptions.exception];
  }

  return {
    id: baseName, // Use filename as unique identifier for API calls
    processId: proc.processId || baseName, // Original processId from XML for display
    name: extractMultiLangText(proc.processName),
    description: extractMultiLangText(proc.description),
    actor, // Folder-based actor (who executes this process)
    diagramType, // flow or sequenz
    actors, // All participants
    interfaceFunctions,
    functionCount: interfaceFunctions.length,
    exceptionCount: exceptions.length,
    baseName,
    filePath
  };
}

/**
 * Parse a process XML file with full details
 * @param {string} filePath - Path to process XML file
 * @param {string} actor - Actor name (from folder structure)
 * @param {string} diagramType - Diagram type (flow or sequenz)
 * @returns {Promise<Object>} - Full process data with mermaid content
 */
async function parseProcessDetail(filePath, actor, diagramType) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.process) return null;

  const proc = xml.process;
  const baseName = path.basename(filePath, '.xml');
  const dirPath = path.dirname(filePath);
  
  // Read mermaid diagram content for both languages
  let mermaidContent = {
    de: '',
    en: ''
  };
  
  // Try language-specific files first (_de.mermaid, _en.mermaid)
  try {
    mermaidContent.de = await fs.readFile(path.join(dirPath, `${baseName}_de.mermaid`), 'utf-8');
  } catch (err) {
    // Try fallback to old format without language suffix
    try {
      mermaidContent.de = await fs.readFile(path.join(dirPath, `${baseName}.mermaid`), 'utf-8');
    } catch (err2) {
      console.warn(`German mermaid file not found for: ${baseName}`);
    }
  }
  
  try {
    mermaidContent.en = await fs.readFile(path.join(dirPath, `${baseName}_en.mermaid`), 'utf-8');
  } catch (err) {
    // Fallback to German version if English not available
    if (mermaidContent.de) {
      mermaidContent.en = mermaidContent.de;
    }
  }

  // Extract actors
  let actors = [];
  if (proc.actors && proc.actors.actor) {
    const actorList = Array.isArray(proc.actors.actor) ? proc.actors.actor : [proc.actors.actor];
    actors = actorList.map(a => extractMultiLangText(a));
  }

  // Extract used objects
  let usedObjects = [];
  if (proc.usedObjects && proc.usedObjects.object) {
    const objList = Array.isArray(proc.usedObjects.object) ? proc.usedObjects.object : [proc.usedObjects.object];
    usedObjects = objList.map(o => extractMultiLangText(o));
  }

  // Extract interface functions
  let interfaceFunctions = [];
  if (proc.interfaceFunctions && proc.interfaceFunctions.function) {
    interfaceFunctions = Array.isArray(proc.interfaceFunctions.function)
      ? proc.interfaceFunctions.function
      : [proc.interfaceFunctions.function];
  }

  // Extract input parameters
  let inputParameters = [];
  if (proc.inputParameters && proc.inputParameters.parameter) {
    const params = Array.isArray(proc.inputParameters.parameter)
      ? proc.inputParameters.parameter
      : [proc.inputParameters.parameter];
    inputParameters = params.map(p => ({
      name: p.name || p.n || '',
      type: p.type || '',
      description: extractMultiLangText(p.description)
    }));
  }

  // Extract output parameters
  let outputParameters = [];
  if (proc.outputParameters && proc.outputParameters.parameter) {
    const params = Array.isArray(proc.outputParameters.parameter)
      ? proc.outputParameters.parameter
      : [proc.outputParameters.parameter];
    outputParameters = params.map(p => ({
      name: p.name || p.n || '',
      type: p.type || '',
      description: extractMultiLangText(p.description)
    }));
  }

  // Extract used data objects
  let usedDataObjects = [];
  if (proc.usedDataObjects && proc.usedDataObjects.dataObject) {
    usedDataObjects = Array.isArray(proc.usedDataObjects.dataObject)
      ? proc.usedDataObjects.dataObject
      : [proc.usedDataObjects.dataObject];
  }

  // Extract exceptions
  let exceptions = [];
  if (proc.possibleExceptions && proc.possibleExceptions.exception) {
    exceptions = Array.isArray(proc.possibleExceptions.exception)
      ? proc.possibleExceptions.exception
      : [proc.possibleExceptions.exception];
  }

  // Extract references
  let references = [];
  if (proc.references && proc.references.reference) {
    references = Array.isArray(proc.references.reference)
      ? proc.references.reference
      : [proc.references.reference];
  }

  // Extract notes
  const notes = extractMultiLangText(proc.notes);

  return {
    id: baseName, // Use filename as unique identifier for API calls
    processId: proc.processId || baseName, // Original processId from XML for display
    name: extractMultiLangText(proc.processName),
    description: extractMultiLangText(proc.description),
    actor,
    diagramType,
    actors,
    usedObjects,
    interfaceFunctions,
    inputParameters,
    outputParameters,
    usedDataObjects,
    exceptions,
    references,
    notes,
    mermaidContent,
    baseName,
    filePath
  };
}

/**
 * Load all processes from the processes directory
 * Structure: processes/{actor}/{diagramType}/{processName}.xml/.mermaid
 * @param {string} basePath - Base path for interfacedesign
 * @returns {Promise<Array>} - Array of parsed processes
 */
async function loadProcesses(basePath) {
  const processesPath = path.join(basePath, 'processes');
  const processes = [];

  try {
    // Check if processes folder exists
    const exists = await fs.access(processesPath).then(() => true).catch(() => false);
    if (!exists) return [];

    // Read actor folders
    const actorFolders = await fs.readdir(processesPath, { withFileTypes: true });
    
    for (const actorDir of actorFolders) {
      if (!actorDir.isDirectory()) continue;
      const actor = actorDir.name;
      const actorPath = path.join(processesPath, actor);

      // Read diagram type folders (flow, sequenz)
      const diagramTypeFolders = await fs.readdir(actorPath, { withFileTypes: true });
      
      for (const typeDir of diagramTypeFolders) {
        if (!typeDir.isDirectory()) continue;
        const diagramType = typeDir.name;
        const typePath = path.join(actorPath, diagramType);

        // Read XML files in this folder
        const files = await getXmlFilesFromDir(typePath);
        
        for (const file of files) {
          const process = await parseProcess(file.path, actor, diagramType);
          if (process) {
            processes.push(process);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading processes:', error.message);
  }

  return processes;
}

/**
 * Get process overview with counts
 * @param {string} basePath - Base path for interfacedesign
 * @returns {Promise<Object>} - Overview with counts by actor and diagram type
 */
async function getProcessesOverview(basePath) {
  const processes = await loadProcesses(basePath);
  
  const overview = {
    count: processes.length,
    byActor: {},
    byDiagramType: {}
  };

  processes.forEach(proc => {
    // Count by actor
    if (!overview.byActor[proc.actor]) {
      overview.byActor[proc.actor] = 0;
    }
    overview.byActor[proc.actor]++;

    // Count by diagram type
    if (!overview.byDiagramType[proc.diagramType]) {
      overview.byDiagramType[proc.diagramType] = 0;
    }
    overview.byDiagramType[proc.diagramType]++;
  });

  return overview;
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
    exceptions: { count: 0, categories: {} },
    processes: { count: 0, categories: {} }
  };

  for (const category of categories) {
    const items = await loadCategory(basePath, category);
    overview[category].count = items.length;
    
    // Group by category/subcategory (use default text for grouping key)
    items.forEach(item => {
      const cat = getTextForLang(item.category, 'de') || 'Uncategorized';
      if (!overview[category].categories[cat]) {
        overview[category].categories[cat] = 0;
      }
      overview[category].categories[cat]++;
    });
  }

  // Add processes overview
  const processesOverview = await getProcessesOverview(basePath);
  overview.processes.count = processesOverview.count;
  overview.processes.categories = processesOverview.byActor;
  overview.processes.byDiagramType = processesOverview.byDiagramType;

  // Add process chains overview
  const processChainsOverview = await getProcessChainsOverview(basePath);
  overview.processchains = {
    count: processChainsOverview.count,
    categories: {}
  };

  return overview;
}

// ============================================
// Process Chain Parsing Functions
// ============================================

/**
 * Parse a process chain XML file and extract basic data
 * @param {string} filePath - Path to process chain XML file
 * @returns {Promise<Object>} - Process chain data
 */
async function parseProcessChain(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.processChain) return null;

  const chain = xml.processChain;
  const baseName = path.basename(filePath, '.xml');
  
  // Extract involved processes (use 'name' or 'n' for compatibility)
  let involvedProcesses = [];
  if (chain.involvedProcesses && chain.involvedProcesses.process) {
    const processes = Array.isArray(chain.involvedProcesses.process)
      ? chain.involvedProcesses.process
      : [chain.involvedProcesses.process];
    involvedProcesses = processes.map(p => ({
      id: p.id,
      name: extractMultiLangText(p.name || p.n)
    }));
  }

  // Extract steps (use 'name' or 'n' for compatibility)
  let steps = [];
  if (chain.steps && chain.steps.step) {
    const stepList = Array.isArray(chain.steps.step) ? chain.steps.step : [chain.steps.step];
    steps = stepList.map(s => ({
      stepNumber: s.stepNumber,
      name: extractMultiLangText(s.name || s.n)
    }));
  }

  return {
    id: baseName,
    chainId: chain.chainId || baseName,
    name: extractMultiLangText(chain.name || chain.n),
    description: extractMultiLangText(chain.description),
    processCount: involvedProcesses.length,
    stepCount: steps.length,
    involvedProcesses,
    baseName,
    filePath
  };
}

/**
 * Parse a process chain XML file with full details
 * @param {string} filePath - Path to process chain XML file
 * @returns {Promise<Object>} - Full process chain data with mermaid content
 */
async function parseProcessChainDetail(filePath) {
  const xml = await parseXmlFile(filePath);
  if (!xml || !xml.processChain) return null;

  const chain = xml.processChain;
  const baseName = path.basename(filePath, '.xml');
  const dirPath = path.dirname(filePath);
  
  // Read mermaid content for both languages
  let mermaidContent = {
    de: null,
    en: null
  };
  
  // Try language-specific files first (_de.mermaid, _en.mermaid)
  try {
    mermaidContent.de = await fs.readFile(path.join(dirPath, `${baseName}_de.mermaid`), 'utf-8');
  } catch (err) {
    // Try fallback to old format without language suffix
    try {
      mermaidContent.de = await fs.readFile(path.join(dirPath, `${baseName}.mermaid`), 'utf-8');
    } catch (err2) {
      // Mermaid file doesn't exist
    }
  }
  
  try {
    mermaidContent.en = await fs.readFile(path.join(dirPath, `${baseName}_en.mermaid`), 'utf-8');
  } catch (err) {
    // Fallback to German version if English not available
    if (mermaidContent.de) {
      mermaidContent.en = mermaidContent.de;
    }
  }

  // Extract involved processes (use 'name' or 'n' for compatibility)
  let involvedProcesses = [];
  if (chain.involvedProcesses && chain.involvedProcesses.process) {
    const processes = Array.isArray(chain.involvedProcesses.process)
      ? chain.involvedProcesses.process
      : [chain.involvedProcesses.process];
    involvedProcesses = processes.map(p => ({
      id: p.id,
      name: extractMultiLangText(p.name || p.n)
    }));
  }

  // Extract prerequisites
  let prerequisites = [];
  if (chain.prerequisites && chain.prerequisites.prerequisite) {
    const prereqList = Array.isArray(chain.prerequisites.prerequisite)
      ? chain.prerequisites.prerequisite
      : [chain.prerequisites.prerequisite];
    prerequisites = prereqList.map(p => extractMultiLangText(p));
  }

  // Extract actors
  let actors = [];
  if (chain.actors && chain.actors.actor) {
    const actorList = Array.isArray(chain.actors.actor) ? chain.actors.actor : [chain.actors.actor];
    actors = actorList.map(a => extractMultiLangText(a));
  }

  // Extract steps with full details (use 'name' or 'n' for compatibility)
  let steps = [];
  if (chain.steps && chain.steps.step) {
    const stepList = Array.isArray(chain.steps.step) ? chain.steps.step : [chain.steps.step];
    steps = stepList.map(s => {
      // Function name can be in 'name' or 'n' element, and it's a direct string
      let functionData = null;
      if (s.function) {
        const funcName = s.function.name || s.function.n;
        // funcName could be a string or an object with text content
        const funcNameStr = typeof funcName === 'string' ? funcName : 
                           (funcName?._ || funcName?.['#text'] || funcName);
        
        functionData = {
          name: funcNameStr,
          linkedProcess: s.function.linkedProcess ? {
            id: s.function.linkedProcess.id,
            name: extractMultiLangText(s.function.linkedProcess.name || s.function.linkedProcess.n)
          } : null
        };
      }
      
      return {
        stepNumber: s.stepNumber,
        name: extractMultiLangText(s.name || s.n),
        description: extractMultiLangText(s.description),
        function: functionData,
        critical: s.critical === 'true' || s.critical === true,
        optional: s.optional === 'true' || s.optional === true,
        frequency: s.frequency || null
      };
    });
  }

  // Extract variants (use 'name' or 'n' for compatibility)
  let variants = [];
  if (chain.variants && chain.variants.variant) {
    const variantList = Array.isArray(chain.variants.variant)
      ? chain.variants.variant
      : [chain.variants.variant];
    variants = variantList.map(v => ({
      name: extractMultiLangText(v.name || v.n),
      description: extractMultiLangText(v.description)
    }));
  }

  // Extract outcome (supports both PK01-style and PK08-style)
  let outcome = null;
  if (chain.outcome) {
    outcome = {
      // PK01-style
      minimumLogMessages: chain.outcome.minimumLogMessages || null,
      logTypes: [],
      storedData: [],
      // PK08-style  
      state: chain.outcome.state ? extractMultiLangText(chain.outcome.state) : null,
      logMessages: [],
      // PK09-style: processData structure
      processData: null,
      // artifacts (common across all styles)
      artifacts: []
    };
    
    // PK01-style: logTypes
    if (chain.outcome.logTypes && chain.outcome.logTypes.logType) {
      const logTypeList = Array.isArray(chain.outcome.logTypes.logType)
        ? chain.outcome.logTypes.logType
        : [chain.outcome.logTypes.logType];
      outcome.logTypes = logTypeList.map(lt => extractMultiLangText(lt));
    }
    
    // PK01-style: storedData
    if (chain.outcome.storedData && chain.outcome.storedData.dataItem) {
      const dataItemList = Array.isArray(chain.outcome.storedData.dataItem)
        ? chain.outcome.storedData.dataItem
        : [chain.outcome.storedData.dataItem];
      outcome.storedData = dataItemList.map(di => extractMultiLangText(di));
    }
    
    // PK08-style: logMessages
    if (chain.outcome.logMessages && chain.outcome.logMessages.logMessage) {
      const logMsgList = Array.isArray(chain.outcome.logMessages.logMessage)
        ? chain.outcome.logMessages.logMessage
        : [chain.outcome.logMessages.logMessage];
      outcome.logMessages = logMsgList.map(lm => extractMultiLangText(lm));
    }
    
    // PK09-style: processData with format, separator, and fields
    if (chain.outcome.processData) {
      outcome.processData = {
        format: chain.outcome.processData.format 
          ? extractMultiLangText(chain.outcome.processData.format) 
          : null,
        separator: chain.outcome.processData.separator || null,
        fields: []
      };
      
      // Extract fields
      if (chain.outcome.processData.field) {
        const fieldList = Array.isArray(chain.outcome.processData.field)
          ? chain.outcome.processData.field
          : [chain.outcome.processData.field];
        outcome.processData.fields = fieldList.map(f => ({
          name: f.name || '',
          description: extractMultiLangText(f.description)
        }));
      }
    }
    
    // Extract artifacts (common across all styles)
    if (chain.outcome.artifacts && chain.outcome.artifacts.artifact) {
      const artifactList = Array.isArray(chain.outcome.artifacts.artifact)
        ? chain.outcome.artifacts.artifact
        : [chain.outcome.artifacts.artifact];
      outcome.artifacts = artifactList.map(a => extractMultiLangText(a));
    }
  }

  // Extract important notes (can appear multiple times in XML, collect all)
  let importantNotes = [];
  if (chain.importantNotes) {
    const noteSections = Array.isArray(chain.importantNotes) 
      ? chain.importantNotes 
      : [chain.importantNotes];
    
    noteSections.forEach(section => {
      if (section.note) {
        const noteList = Array.isArray(section.note) ? section.note : [section.note];
        noteList.forEach(n => {
          importantNotes.push(extractMultiLangText(n));
        });
      }
    });
  }

  // Extract use cases (supports both simple text and structured name+description)
  let useCases = [];
  if (chain.useCases && chain.useCases.useCase) {
    const useCaseList = Array.isArray(chain.useCases.useCase)
      ? chain.useCases.useCase
      : [chain.useCases.useCase];
    useCases = useCaseList.map(uc => {
      // Check if it's structured with name and description
      if (uc.name || uc.description) {
        return {
          name: extractMultiLangText(uc.name),
          description: extractMultiLangText(uc.description)
        };
      }
      // Otherwise it's simple text
      return extractMultiLangText(uc);
    });
  }

  // Extract usage scenario
  const usageScenario = chain.usageScenario ? extractMultiLangText(chain.usageScenario) : null;

  // Extract references
  let references = [];
  if (chain.references && chain.references.reference) {
    references = Array.isArray(chain.references.reference)
      ? chain.references.reference
      : [chain.references.reference];
  }

  return {
    id: baseName,
    chainId: chain.chainId || baseName,
    name: extractMultiLangText(chain.name || chain.n),
    description: extractMultiLangText(chain.description),
    involvedProcesses,
    prerequisites,
    actors,
    steps,
    variants,
    outcome,
    importantNotes,
    useCases,
    usageScenario,
    references,
    mermaidContent,
    baseName,
    filePath
  };
}

/**
 * Check if an XML file is a process chain (has processChain as root element)
 * @param {string} filePath - Path to XML file
 * @returns {Promise<boolean>} - True if it's a process chain
 */
async function isProcessChainFile(filePath) {
  try {
    const xml = await parseXmlFile(filePath);
    return xml && xml.processChain !== undefined;
  } catch (err) {
    return false;
  }
}

/**
 * Check if a folder is a process chain folder (no flow/sequenz subfolders)
 * @param {string} folderPath - Path to folder
 * @returns {Promise<boolean>} - True if it's a process chain folder
 */
async function isProcessChainFolder(folderPath) {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const subfolders = entries.filter(e => e.isDirectory()).map(e => e.name);
    
    // If it has 'flow' or 'sequenz' subfolders, it's a regular process folder
    const hasFlowOrSequenz = subfolders.includes('flow') || subfolders.includes('sequenz');
    return !hasFlowOrSequenz;
  } catch (err) {
    return false;
  }
}

/**
 * Load all process chains from the processes folder
 * Process chains are identified by:
 * 1. Being in a folder without 'flow' or 'sequenz' subfolders
 * 2. Having 'processChain' as root XML element
 * @param {string} basePath - Base path of interfacedesign folder
 * @returns {Promise<Array>} - Array of process chain data
 */
async function loadProcessChains(basePath) {
  const processesPath = path.join(basePath, 'processes');
  const chains = [];

  try {
    // Get all subdirectories in processes folder
    const entries = await fs.readdir(processesPath, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const folder of folders) {
      const folderPath = path.join(processesPath, folder);
      
      // Check if this folder is a process chain folder (no flow/sequenz subfolders)
      if (await isProcessChainFolder(folderPath)) {
        // Get all XML files in this folder
        const files = await fs.readdir(folderPath);
        const xmlFiles = files.filter(f => f.endsWith('.xml'));

        for (const file of xmlFiles) {
          const filePath = path.join(folderPath, file);
          
          // Check if the XML file has processChain as root element
          if (await isProcessChainFile(filePath)) {
            const chainData = await parseProcessChain(filePath);
            if (chainData) {
              // Add folder name for reference
              chainData.folder = folder;
              chains.push(chainData);
            }
          }
        }
      }
    }
  } catch (err) {
    // processes folder doesn't exist or other error
    console.error('Error loading process chains:', err);
  }

  return chains;
}

/**
 * Get process chains overview statistics
 * @param {string} basePath - Base path of interfacedesign folder
 * @returns {Promise<Object>} - Overview statistics
 */
async function getProcessChainsOverview(basePath) {
  const chains = await loadProcessChains(basePath);
  return {
    count: chains.length
  };
}

// ============================================
// Process Map Parsing Functions
// ============================================

/**
 * Parse the process map XML file
 * @param {string} basePath - Base path of interfacedesign folder
 * @returns {Promise<Object>} - Process map data
 */
async function parseProcessMap(basePath) {
  const mapPath = path.join(basePath, 'processes', 'map.xml');
  
  try {
    const xml = await parseXmlFile(mapPath);
    if (!xml || !xml.processMap) return null;

    const map = xml.processMap;

    // Parse metadata
    const metadata = {
      title: extractMultiLangText(map.metadata?.title),
      version: map.metadata?.version || '',
      date: map.metadata?.date || '',
      description: extractMultiLangText(map.metadata?.description),
      standards: []
    };
    
    if (map.metadata?.standards?.standard) {
      metadata.standards = Array.isArray(map.metadata.standards.standard)
        ? map.metadata.standards.standard
        : [map.metadata.standards.standard];
    }

    // Parse main categories
    const categories = [];
    if (map.mainCategories?.category) {
      const catList = Array.isArray(map.mainCategories.category)
        ? map.mainCategories.category
        : [map.mainCategories.category];
      
      for (const cat of catList) {
        const category = {
          id: cat.id,
          name: extractMultiLangText(cat.n || cat.name),
          description: extractMultiLangText(cat.description),
          icon: cat.icon || '',
          color: cat.color || '#888888',
          subCategories: []
        };

        // Parse subcategories
        if (cat.subCategories?.subCategory) {
          const subCatList = Array.isArray(cat.subCategories.subCategory)
            ? cat.subCategories.subCategory
            : [cat.subCategories.subCategory];
          
          for (const subCat of subCatList) {
            const subCategory = {
              id: subCat.id,
              name: extractMultiLangText(subCat.n || subCat.name),
              processes: [],
              processChains: []
            };

            // Parse processes in subcategory
            if (subCat.processes?.process) {
              const procList = Array.isArray(subCat.processes.process)
                ? subCat.processes.process
                : [subCat.processes.process];
              
              subCategory.processes = procList.map(p => ({
                id: p.id,
                name: extractMultiLangText(p.n || p.name),
                mandatory: p.mandatory === 'true' || p.mandatory === true,
                critical: p.critical === 'true' || p.critical === true,
                frequency: p.frequency ? extractMultiLangText(p.frequency) : null
              }));
            }

            // Parse process chains in subcategory
            if (subCat.processChains?.processChain) {
              const chainList = Array.isArray(subCat.processChains.processChain)
                ? subCat.processChains.processChain
                : [subCat.processChains.processChain];
              
              subCategory.processChains = chainList.map(pc => ({
                id: pc.id,
                name: extractMultiLangText(pc.n || pc.name)
              }));
            }

            category.subCategories.push(subCategory);
          }
        }

        categories.push(category);
      }
    }

    // Parse critical processes
    const criticalProcesses = [];
    if (map.criticalProcesses?.process) {
      const critList = Array.isArray(map.criticalProcesses.process)
        ? map.criticalProcesses.process
        : [map.criticalProcesses.process];
      
      criticalProcesses.push(...critList.map(p => ({
        id: p.id,
        name: extractMultiLangText(p.n || p.name),
        reason: extractMultiLangText(p.reason),
        severity: extractMultiLangText(p.severity)
      })));
    }

    // Parse navigation
    const navigation = {
      startingPoints: [],
      learningPaths: []
    };

    if (map.navigation?.recommendedStartingPoints?.startingPoint) {
      const spList = Array.isArray(map.navigation.recommendedStartingPoints.startingPoint)
        ? map.navigation.recommendedStartingPoints.startingPoint
        : [map.navigation.recommendedStartingPoints.startingPoint];
      
      navigation.startingPoints = spList.map(sp => ({
        role: extractMultiLangText(sp.role),
        start: sp.start,
        description: extractMultiLangText(sp.description)
      }));
    }

    if (map.navigation?.learningPaths?.learningPath) {
      const lpList = Array.isArray(map.navigation.learningPaths.learningPath)
        ? map.navigation.learningPaths.learningPath
        : [map.navigation.learningPaths.learningPath];
      
      navigation.learningPaths = lpList.map(lp => {
        const steps = [];
        if (lp.steps?.step) {
          const stepList = Array.isArray(lp.steps.step) ? lp.steps.step : [lp.steps.step];
          steps.push(...stepList.map(s => ({
            id: s.id,
            description: extractMultiLangText(s.description)
          })));
        }
        
        return {
          name: extractMultiLangText(lp.n || lp.name),
          targetAudience: extractMultiLangText(lp.targetAudience),
          steps
        };
      });
    }

    return {
      metadata,
      categories,
      criticalProcesses,
      navigation
    };
  } catch (err) {
    console.error('Error parsing process map:', err);
    return null;
  }
}

module.exports = {
  parseXmlFile,
  getXmlFilesFromDir,
  parseFunction,
  parseFunctionDetail,
  parseEnum,
  parseEnumDetail,
  parseType,
  parseTypeDetail,
  parseException,
  parseExceptionDetail,
  parseProcess,
  parseProcessDetail,
  loadProcesses,
  getProcessesOverview,
  parseProcessChain,
  parseProcessChainDetail,
  loadProcessChains,
  getProcessChainsOverview,
  loadCategory,
  getOverview,
  parseProcessMap
};
