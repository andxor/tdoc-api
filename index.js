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

function getError(data, resp) {
    if (data instanceof Error)
        return data.message;
    if (resp.statusCode == 200)
        return null;
    if (typeof data == 'object' && 'message' in data)
        return data.message;
    return 'error ' + resp.statusCode;
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
            var err = getError(data, resp);
            callback(err, data);
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
        username: me.username,
        password: me.password,
        data: data
    }).on('complete', function (data, resp) {
        var err = getError(data, resp),
            d = [];
        if (!err && typeof data == 'object' && 'documents' in data)
            d = data.documents.map(forceNumber);
        callback(err, d);
    });
};

module.exports = TDoc;
