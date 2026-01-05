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
 *   - <element>Direct text content</element> (fallback)
 * 
 * @param {any} element - The XML element (parsed by xml2js)
 * @returns {Object} - Object with language keys: { de: "...", en: "...", _default: "..." }
 */
function extractMultiLangText(element) {
  if (!element) return { _default: '' };
  
  // If element is a string, return it as default
  if (typeof element === 'string') {
    return { _default: element, de: element, en: element };
  }
  
  // Check for <text xml:lang="..."> structure
  if (element.text) {
    const texts = Array.isArray(element.text) ? element.text : [element.text];
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
    description: typeData.description || '',
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
    description: typeData.description || '',
    baseType: typeData.baseType || '',
    asn1Definition: typeData.asn1Definition || '',
    usage: typeData.usage || '',
    fields,
    fieldCount: fields.length,
    constraints,
    notes,
    rootElement,
    typeKind,
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
  const mermaidPath = filePath.replace('.xml', '.mermaid');
  
  // Read mermaid diagram content
  let mermaidContent = '';
  try {
    mermaidContent = await fs.readFile(mermaidPath, 'utf-8');
  } catch (err) {
    console.warn(`Mermaid file not found: ${mermaidPath}`);
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

  return overview;
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
  loadCategory,
  getOverview
};
