/*jshint node: true, strict: true, globalstrict: true, indent: 4, immed: true, undef: true, sub: true */
'use strict';

// local instance, as we enable long stack traces
var Promise = require('bluebird/js/main/promise')();
Promise.prototype.fail = Promise.prototype['catch'];
Promise.longStackTraces();
module.exports = Promise;
