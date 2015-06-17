/* jshint node:true, unused:true */
"use strict";

var rest = require('restler');
var Q    = require('q');

function wrap(r, spread) {
  var defer = Q.defer();

  r.on('success', function(result, response) {
    defer.resolve(result);
  });

  r.on('fail', function(err, response) {
    if (!(err instanceof Error))
      err = new Error(err);
    err.status = response.statusCode;
    defer.reject(err);
  });

  r.on('error', function(err, response) {
    if (!(err instanceof Error))
      err = new Error(err);
    err.status = response.statusCode;
    defer.reject(err);
  });

  r.on('abort', function() {
    defer.reject(new Error('Operation aborted'));
  });

  return defer.promise;
}

function wrapMethod(method, spread) {
  return function() {
    var request = method.apply(rest, arguments);
    return wrap(request, spread);
  };
}


module.exports = ['get','post','put','del','head', 'json', 'postJson'].reduce(function(memo, method) {
  var underlying = rest[method];
  if(underlying)
    memo[method] = wrapMethod(underlying);
  return memo;
}, {
  file: rest.file,
  data: rest.data
});
