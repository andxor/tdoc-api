/* jshint node:true, unused:true */
"use strict";

var restler = require('restler'),
    Promise = require('./promise'),
    tomcatError = /<h1>(.*)<\/h1>/;

function improveErr(err, status) {
    if (typeof err == 'string') {
        // extract Tomcat error (if possible)
        var m = tomcatError.exec(err);
        if (m)
            err = m[1];
        else
            err = 'HTTP ' + status;
        // use a real error
        err = new Error(err);
    } else if (!(err instanceof Error)) {
        var e = new Error(err.message || 'Unknown error');
        e.data = err;
        err = e;
    }
    err.status = status;
    return err;
}

function wrap(r) {
    return new Promise(function (resolve, reject) {
        r.on('success', function(result /*,response*/) {
            resolve(result);
        }).on('fail', function (err, response) { // 4xx status
            err = improveErr(err, response.statusCode);
            reject(err);
        }).on('error', function (err, response) {
            err = improveErr(err, response.statusCode);
            reject(err);
        }).on('abort', function () {
            reject(new Error('Operation aborted'));
        }).on('timeout', function (ms) {
            reject(new Error('Operation timeout: ' + ms));
        });
    });
}

function wrapMethod(method) {
    return function() {
        var request = method.apply(restler, arguments);
        return wrap(request);
    };
}


module.exports = ['get','post','put','del','head', 'json', 'postJson'].reduce(function(memo, method) {
    var underlying = restler[method];
    if (underlying)
        memo[method] = wrapMethod(underlying);
    return memo;
}, {
    file: restler.file,
    data: restler.data
});
