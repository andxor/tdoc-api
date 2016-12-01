/*jshint node: true, strict: true, globalstrict: true, indent: 4, immed: true, undef: true, sub: true */
'use strict';

// local instance, as we enable debug features
var Promise = require('bluebird').getNewLibraryCopy();
Promise.prototype.fail = Promise.prototype['catch'];
Promise.config({
    warnings: true,
    longStackTraces: true,
    cancellation: false,
    monitoring: false,
});
module.exports = Promise;
