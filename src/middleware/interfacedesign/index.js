/**
 * InterfaceDesign Middleware Exports
 * Placeholder for InterfaceDesign specific middleware
 */

// TODO: Add InterfaceDesign specific middleware here
// Example:
// const validateDesign = require('./validateDesign');
// const validateInstance = require('./validateInstance');

/**
 * Placeholder: Validate instance middleware
 * Checks if the requested instance exists
 */
const validateInstance = (req, res, next) => {
  // TODO: Implement instance validation for InterfaceDesign
  const { instance } = req.params;
  
  if (!instance) {
    return res.status(400).json({ error: 'Instance parameter required' });
  }
  
  // For now, just pass through
  req.instance = instance;
  next();
};

module.exports = {
  validateInstance
  // TODO: Export additional middleware here
};
