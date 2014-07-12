function mergeProperties(target, properties) {
  for (var property in properties) {
    if (properties.hasOwnProperty(property))
      target[property] = properties[property];
  }

  return target;
}

module.exports = mergeProperties;
