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

TDoc.Error = function (method, code, message) {
    // as seen in: http://stackoverflow.com/a/8460753/166524
    this.constructor.prototype.__proto__ = Error.prototype;
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.method = method;
    this.code = 0|code;
    this.message = message;
};

function getError(method, data, resp) {
    if (data instanceof Error)
        return data;
    if (resp.statusCode == 200)
        return null;
    if (typeof data == 'object' && 'message' in data)
        return new TDoc.Error(method, data.code, data.message);
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
        var err = getError(method, data, resp);
        if (!err && typeof data == 'object' && 'document' in data) {
            if ('warning' in data)
                data.document.warning = { message: data.warning.shift(), extra: data.warning };
            data = data.document;
            data.metadata = nameValue2Object(data.metadata);
        }
        callback(err, data);
    });
}

function commonUploadParams(p) {
    var s = {};
    s.mimetype = p.mimetype || 'application/pdf';
    if (p.user)
        s.user = p.user;
    if (p.company)
        s.company = p.company;
    if (p.period)
        s.period = forceNumber(p.period);
    if (p.parcel) // upload only
        s.parcel = p.parcel;
    if (p.pages)
        s.pages = forceNumber(p.pages);
    if (p.meta)
        s.meta = JSON.stringify(p.meta);
    if (p.alias && p.pin) {
        s.alias = p.alias;
        s.pin = p.pin;
    }
    if (p.overwrite) // upload only
        s.overwrite = 0|p.overwrite;
    if (p.id) // update only
        s.id = 0|p.id;
    if ('ready' in p) // as missing value is truthy
        s.ready = p.ready ? 1 : 0;
    return s;
}

TDoc.prototype.upload = function (p) {
    if (arguments.length > 1) // backward compatibility
        p = { ready: 1, file: arguments[0], doctype: arguments[1], period: arguments[2], meta: arguments[3], callback: arguments[4] };
    if (!p.doctype)
        return p.callback(new Error('you need to specify ‘doctype’'));
    if (!p.period)
        return p.callback(new Error('you need to specify ‘period’'));
    if (!p.meta && p.ready)
        return p.callback(new Error('if the document is ‘ready’ it must contain ‘meta’'));
    var me = this,
        s = commonUploadParams(p);
    s.doctype = p.doctype;
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

TDoc.prototype.update = function (p) {
    var me = this,
        s = commonUploadParams(p);
    if (p.file)
        fs.stat(p.file, function(err, stats) {
            if (err)
                return p.callback(err);
            s.document = restler.file(p.file, null, stats.size, null, s.mimetype);
            documentPOST(me, 'docs/update', s, p.callback);
        });
    else if (p.data) {
        s.document = restler.data('a.bin', s.mimetype, p.data);
        documentPOST(me, 'docs/update', s, p.callback);
    } else
        documentPOST(me, 'docs/update', s, p.callback);
};

TDoc.prototype.search = function (p) {
    if (arguments.length > 1) // backward compatibility
        p = { doctype: arguments[0], period: arguments[1], meta: arguments[2], callback: arguments[3] };
    var me = this,
        data = {
            doctype: p.doctype,
            meta: JSON.stringify(p.meta)
        };
    if (p.user) data.user = p.user;
    if (p.period) data.period = forceNumber(p.period);
    restler.post(me.address + 'docs/search', {
        username: me.username,
        password: me.password,
        data: data
    }).on('complete', function (data, resp) {
        var err = getError('search', data, resp),
            d = [];
        if (!err && typeof data == 'object' && 'documents' in data)
            d = data.documents.map(forceNumber);
        p.callback(err, d);
    });
};

TDoc.prototype.documentMeta = function (p) {
    if (arguments.length > 1) // backward compatibility
        p = { id: arguments[0], callback: arguments[1] };
    var me = this,
        data = {};
    if (p.user) data.user = p.user;
    restler.get(me.address + 'docs/' + (0|p.id) + '/meta', {
        username: me.username,
        password: me.password,
        query: data
    }).on('complete', function (data, resp) {
        var err = getError('documentMeta', data, resp);
        p.callback(err, data);
    });
};

TDoc.prototype.searchOne = function (p) {
    if (arguments.length > 1) // backward compatibility
        p = { doctype: arguments[0], period: arguments[1], meta: arguments[2], callback: arguments[3] };
    var me = this,
        p2 = Object.create(p); // search has the same parameters of searchOne, we just change the callback
    p2.callback = function (err, data) {
        if (err)
            return p.callback(err, data);
        if (data.length != 1)
            return p.callback(new Error('One document should be found, not ' + data.length));
        var p3 = {
            id: data[0],
            callback: p.callback
        };
        if (p.user) p3.user = p.user;
        me.documentMeta(p3);
    };
    this.search(p2);
};

TDoc.prototype.parcelCreate = function (p) {
    if (arguments.length > 1) // backward compatibility
        p = { company: arguments[0], doctype: arguments[1], filename: arguments[2], callback: arguments[3] };
    var me = this,
        data = {
            company: p.company,
            doctype: p.doctype,
            filename: p.filename
        };
    if (p.user) data.user = p.user;
    restler.post(me.address + 'docs/parcel/create', {
        username: me.username,
        password: me.password,
        data: data
    }).on('complete', function (data, resp) {
        var err = getError('parcelCreate', data, resp),
            d = [];
        if (!err && typeof data == 'object' && 'parcel' in data)
            d = data.parcel;
        p.callback(err, d);
    });
};

TDoc.prototype.parcelClose = function (p) {
    if (arguments.length > 1) // backward compatibility
        p = { id: arguments[0], callback: arguments[1] };
    var me = this,
        data = {
            parcel: p.id
        };
    if (p.user) data.user = p.user;
    restler.post(me.address + 'docs/parcel/close', {
        username: me.username,
        password: me.password,
        data: data
    }).on('complete', function (data, resp) {
        var err = getError('parcelClose', data, resp),
            d = [];
        if (!err && typeof data == 'object' && 'parcel' in data)
            d = data.parcel;
        p.callback(err, d);
    });
};

TDoc.prototype.parcelDelete = function (p) {
    if (arguments.length > 1) // backward compatibility
        p = { id: arguments[0], callback: arguments[1] };
    var me = this,
        data = {
            parcel: p.id
        };
    if (p.user) data.user = p.user;
    restler.post(me.address + 'docs/parcel/delete', {
        username: me.username,
        password: me.password,
        data: data
    }).on('complete', function (data, resp) {
        var err = getError('parcelDeelte', data, resp),
            d = [];
        if (!err && typeof data == 'object' && 'parcel' in data)
            d = data.parcel;
        p.callback(err, d);
    });
};

module.exports = TDoc;
