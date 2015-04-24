/*!
 * node tDoc API wrapper
 * (c) 2014 Lapo Luchini <l.luchini@andxor.it>
 */
/*jshint node: true, strict: true, globalstrict: true, indent: 4, immed: true, undef: true, sub: true */
'use strict';

var util = require('util'),
    fs = require('fs'),
    Q = require('q'),
    restler = require('restler-q'),
    qStat = Q.denodeify(fs.stat);

function TDoc(address, username, password) {
    this.address = address.replace(/\/?$/, '/'); // check that it includes the trailing slash
    this.username = username;
    this.password = password;
}

TDoc.Error = function (method, code, message) {
    // inspired by: http://stackoverflow.com/a/8460753/166524
    this.name = this.constructor.name;
    this.method = method;
    this.code = 0|code;
    this.message = message;
};
TDoc.Error.prototype = Object.create(Error.prototype);
TDoc.Error.prototype.constructor = TDoc.Error;

TDoc.longStack = function (val) {
    Q.longStackSupport = !!val;
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

function GET(me, method, data) {
    return restler.get(me.address + method, {
        username: me.username,
        password: me.password,
        query: data
    }).fail(function (err) {
        throw new TDoc.Error(method, err.status, err.message || 'HTTP ' + err.status);
    }).then(function (data) {
        if (typeof data == 'object' && 'message' in data)
            throw new TDoc.Error(method, data.code, data.message);
        return data;
    });
}

function POST(me, method, data) {
    return restler.post(me.address + method, {
        username: me.username,
        password: me.password,
        data: data
    }).fail(function (err) {
        throw new TDoc.Error(method, err.status, err.message || 'HTTP ' + err.status);
    }).then(function (data) {
        if (typeof data == 'object' && 'message' in data)
            throw new TDoc.Error(method, data.code, data.message);
        return data;
    });
}

function documentPOST(me, method, data) {
    return restler.post(me.address + method, {
        multipart: true,
        username: me.username,
        password: me.password,
        data: data
    }).fail(function (err) {
        throw new TDoc.Error(method, err.status, err.message || 'HTTP ' + err.status);
    }).then(function (data) {
        if (typeof data == 'object' && 'message' in data)
            throw new TDoc.Error(method, data.code, data.message);
        if (typeof data == 'object' && 'document' in data) {
            if ('warning' in data)
                data.document.warning = { message: data.warning.shift(), extra: data.warning };
            data = data.document;
            data.metadata = nameValue2Object(data.metadata);
            return data;
        }
        throw new Error('Unexpected return value: ' + JSON.stringify(data));
    });
}

function parcelPOST(me, method, data) {
    return POST(me, method, data).then(function (data) {
        if (typeof data == 'object' && 'parcel' in data)
            return data.parcel;
        throw new Error('Unexpected return value: ' + JSON.stringify(data));
    });
}

function commonUploadParams(p) {
    var s = {};
    if (p.mimetype)
        s.mimetype = p.mimetype;
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
        s.meta = restler.data('a.json', 'application/json', new Buffer(JSON.stringify(p.meta), 'utf8'));
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

function upload(me, p) {
    if (!p.doctype)
        return Q.reject(new Error('you need to specify ‘doctype’'));
    if (!p.period)
        return Q.reject(new Error('you need to specify ‘period’'));
    if (!p.meta && p.ready)
        return Q.reject(new Error('if the document is ‘ready’ it must contain ‘meta’'));
    var s = commonUploadParams(p);
    s.doctype = p.doctype;
    if (p.file)
        return qStat(p.file)
            .then(function (stat) {
                s.document = restler.file(p.file, null, stat.size, null, s.mimetype);
                return documentPOST(me, 'docs/upload', s);
            });
    else if (p.data) {
        s.document = restler.data('a.bin', s.mimetype, p.data);
        return documentPOST(me, 'docs/upload', s);
    } else if (!p.ready)
        return documentPOST(me, 'docs/upload', s);
    else
        return Q.reject(new Error('if the document is ‘ready’ it must have a content as either ‘file’ or ‘data’'));
}

function update(me, p) {
    var s = commonUploadParams(p);
    if (p.file)
        return qStat(p.file)
            .then(function (stats) {
                s.document = restler.file(p.file, null, stats.size, null, s.mimetype);
                return documentPOST(me, 'docs/update', s);
            });
    else if (p.data) {
        s.document = restler.data('a.bin', s.mimetype, p.data);
        return documentPOST(me, 'docs/update', s);
    } else
        return documentPOST(me, 'docs/update', s);
}

function search(me, p) {
    var data = {
            doctype: p.doctype,
            meta: JSON.stringify(p.meta)
        };
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    if (p.period) data.period = forceNumber(p.period);
    return POST(me, 'docs/search', data).then(function (data) {
        var d = [];
        if (typeof data == 'object' && 'documents' in data)
            d = data.documents.map(forceNumber);
        return d;
    });
}

function documentMeta(me, p) {
    var data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return GET(me, 'docs/' + (0|p.id) + '/meta', data);
}

function searchOne(me, p) {
    return search(me, p).then(function (data) {
        if (data.length != 1)
            throw new Error('One document should be found, not ' + data.length);
        var p2 = { id: data[0] };
        if (p.user) p2.user = p.user;
        if (p.company) p2.company = p.company;
        return documentMeta(me, p2);
    });
}

function parcelCreate(me, p) {
    var data = {
            company: p.company,
            doctype: p.doctype,
            filename: p.filename
        };
    if (p.user) data.user = p.user;
    return parcelPOST(me, 'docs/parcel/create', data);
}

function parcelClose(me, p) {
    var data = {
            parcel: p.id
        };
    if (p.user) data.user = p.user;
    if (p.extra) data.extra = p.extra;
    return parcelPOST(me, 'docs/parcel/close', data);
}

function parcelDelete(me, p) {
    var data = {
            parcel: p.id
        };
    if (p.user) data.user = p.user;
    if (p.error) data.error = p.error;
    if (p.extra) data.extra = p.extra;
    return parcelPOST(me, 'docs/parcel/delete', data);
}

TDoc.prototype.upload = function (p) {
    if (arguments.length > 1 || typeof p !== 'object') // backward compatibility
        p = { ready: 1, file: arguments[0], doctype: arguments[1], period: arguments[2], meta: arguments[3], callback: arguments[4] };
    return upload(this, p).nodeify(p.callback);
};

TDoc.prototype.update = function (p) {
    return update(this, p).nodeify(p.callback);
};

TDoc.prototype.search = function (p) {
    if (arguments.length > 1 || typeof p !== 'object') // backward compatibility
        p = { doctype: arguments[0], period: arguments[1], meta: arguments[2], callback: arguments[3] };
    return search(this, p).nodeify(p.callback);
};

TDoc.prototype.documentMeta = function (p) {
    if (arguments.length > 1 || typeof p !== 'object') // backward compatibility
        p = { id: arguments[0], callback: arguments[1] };
    return documentMeta(this, p).nodeify(p.callback);
};

TDoc.prototype.searchOne = function (p) {
    if (arguments.length > 1 || typeof p !== 'object') // backward compatibility
        p = { doctype: arguments[0], period: arguments[1], meta: arguments[2], callback: arguments[3] };
    return searchOne(this, p).nodeify(p.callback);
};

TDoc.prototype.parcelCreate = function (p) {
    if (arguments.length > 1 || typeof p !== 'object') // backward compatibility
        p = { company: arguments[0], doctype: arguments[1], filename: arguments[2], callback: arguments[3] };
    return parcelCreate(this, p).nodeify(p.callback);
};

TDoc.prototype.parcelClose = function (p) {
    if (arguments.length > 1 || typeof p !== 'object') // backward compatibility
        p = { id: arguments[0], callback: arguments[1] };
    return parcelClose(this, p).nodeify(p.callback);
};

TDoc.prototype.parcelDelete = function (p) {
    if (arguments.length > 1 || typeof p !== 'object') // backward compatibility
        p = { id: arguments[0], callback: arguments[1] };
    return parcelDelete(this, p).nodeify(p.callback);
};

module.exports = TDoc;
