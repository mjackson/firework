function getNumChildren(ref, callback) {
  ref.once('value', function (snapshot) {
    callback(snapshot.numChildren());
  }, callback);
}

module.exports = getNumChildren;
