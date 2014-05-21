// MIT licensed
// downloaded on 2014-04-24 from https://github.com/andxor/restler-q/blob/master/lib/restler-q.js
// using a local copy until upstream doesn't use a restler >= 3.2.2

/* jshint node:true, unused:true */
"use strict";

var rest = require('restler');
var Q    = require('q');

function HTTPError(status, message) {
    // inspired by: http://stackoverflow.com/a/8460753/166524
    this.name = this.constructor.name;
    this.status = 0|status;
    this.message = message;
};
HTTPError.prototype = Object.create(Error.prototype);
HTTPError.prototype.constructor = HTTPError;

function wrap(r) {
  var defer = Q.defer();

  r.on('success', function(result, response) {
    if(r.request !== response.req) {
      /* Attempt to deal with https://github.com/danwrong/restler/pull/113 */
      return;
    }

    defer.resolve(result);
  });

  r.on('fail', function(result, response) {
    if(r.request !== response.req) {
      /* Attempt to deal with https://github.com/danwrong/restler/pull/113 */
      return;
    }

    defer.reject(new HTTPError(response.statusCode, result));
  });

  r.on('error', function(err, response) {
    if(response && r.request !== response.req) {
      /* Attempt to deal with https://github.com/danwrong/restler/pull/113 */
      return;
    }

    defer.reject(err);
  });

  r.on('abort', function() {
    defer.reject(new Error('Operation aborted'));
  });

  return defer.promise;
}

function wrapMethod(method) {
  return function() {
    var request = method.apply(rest, arguments);
    return wrap(request);
  };
}

module.exports = ['get','post','put','del','head', 'json', 'postJson'].reduce(function(memo, method) {
  var underlying = rest[method];
  if(underlying) {
    memo[method] = wrapMethod(underlying);
  }
  return memo;
}, {});
module.exports.data = rest.data;
module.exports.file = rest.file;
