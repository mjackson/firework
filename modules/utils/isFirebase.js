var isFunction = require('./isFunction');

function isFirebase(object) {
  // Note: Would be better if we could get a Firebase.isFirebase function in the SDK.
  return object && isFunction(object.set) && isFunction(object.child);
}

module.exports = isFirebase;
