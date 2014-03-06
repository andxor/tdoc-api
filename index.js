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
        return data;
    if (resp.statusCode == 200)
        return null;
    if (typeof data == 'object' && 'message' in data)
        return new Error(data.message);
    return new Error('error ' + resp.statusCode);
}

function forceNumber(n) {
    return +n;
}

function nameValue2Object(arr) {
    var o = {};
    arr.forEach(function (e) {
        o[e.name] = e.value;
    });
    return o;
}

function documentPOST(me, method, data, callback) {
    restler.post(me.address + method, {
        multipart: true,
        username: me.username,
        password: me.password,
        data: data
    }).on('complete', function (data, resp) {
        var err = getError(data, resp);
        if (!err && typeof data == 'object' && 'document' in data) {
            data = data.document;
            data.metadata = nameValue2Object(data.metadata);
        }
        callback(err, data);
    });
};

function commonUploadParams(p) {
    var s = {};
    s.doctype = p.doctype;
    s.mimetype = p.mimetype || 'application/pdf';
    if (p.period)
        s.period = forceNumber(p.period);
    if (p.pages)
        s.pages = forceNumber(p.pages);
    if (p.meta)
        s.meta = JSON.stringify(p.meta);
    if (p.alias && p.pin) {
        s.alias = p.alias;
        s.pin = p.pin;
    }
    return s;
}

TDoc.prototype.upload = function (p) {
    if (arguments.length == 5) // backward compatibility
        p = { ready: 1, file: arguments[0], doctype: arguments[1], period: arguments[2], meta: arguments[3], callback: arguments[4] };
    if (!p.period)
        return p.callback(throw new Error('you need to specify ‘period’'));
    if (!p.meta && p.ready)
        return p.callback(throw new Error('if the document is ‘ready’ it must contain ‘meta’'));
    var me = this,
        s = commonUploadParams(p);
    if (p.overwrite)
        s.overwrite = 0|p.overwrite;
    if (p.file)
        fs.stat(p.file, function(err, stats) {
            if (err)
                return p.callback(err);
            s.document = restler.file(p.file, null, stats.size, null, s.mimetype);
            documentPOST(me, 'docs/upload', s, p.callback);
        });
    else if (p.data) {
        s.document = restler.data('a.bin', s.mimetype, p.data);
        documentPOST(me, 'docs/upload', s, p.callback);
    } else if (!p.ready)
        documentPOST(me, 'docs/upload', s, p.callback);
    else
        return p.callback(new Error('if the document is ‘ready’ it must have a content as either ‘file’ or ‘data’'));
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
