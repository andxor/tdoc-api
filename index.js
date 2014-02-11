/*!
 * node tDoc API wrapper
 * (c) 2014 Lapo Luchini <l.luchini@andxor.it>
 */
/*jshint node: true, strict: true, globalstrict: true, indent: 4, immed: true, undef: true, sub: true */
'use strict';

var util = require('util'),
    fs = require('fs'),
    restler = require('restler');

function TDoc(address, username, password) {
    this.address = address.replace(/\/?$/, '/'); // check that it includes the trailing slash
    this.username = username;
    this.password = password;
}

function forceNumber(n) {
    return +n;
}

TDoc.prototype.upload = function (file, doctype, period, meta, callback) {
    var me = this;
    fs.stat(file, function(err, stats) {
        if (err)
            return callback(err);
        restler.post(me.address + 'docs/upload', {
            multipart: true,
            username: me.username,
            password: me.password,
            data: {
                doctype: doctype,
                period: forceNumber(period),
                document: restler.file(file, null, stats.size, null, 'application/pdf'),
                meta: JSON.stringify(meta)
            }
        }).on('complete', function (data, resp) {
            if (resp.statusCode == 200)
                callback(null, data);
            else
                callback('message' in data ? data.message : 'error ' + resp.statusCode);
        });
    });
};

TDoc.prototype.search = function (doctype, period, meta, callback) {
    var me = this,
        data = {
            doctype: doctype,
            meta: JSON.stringify(meta)
        };
    if (period) data.period = forceNumber(period);
    restler.post(me.address + 'docs/search', {
        multipart: true,
        username: me.username,
        password: me.password,
        data: data
    }).on('complete', function (data, resp) {
        if (resp.statusCode != 200)
            return callback('message' in data ? data.message : 'error ' + resp.statusCode);
        // massage data
        var d = [];
        if ('documents' in data)
            d = data.documents.map(forceNumber);
        callback(null, d);
    });
};

module.exports = TDoc;
