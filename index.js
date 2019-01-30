/*!
 * node tDoc API wrapper
 * (c) 2014-2019 Lapo Luchini <l.luchini@andxor.it>
 */
'use strict';

const
    crypto = require('crypto'),
    Q = require('./lib/promise'), // we're currently using Bluebird, but Q is a shorter name
    req = require('superagent'),
    reProto = /^(https?):/,
    reEtag = /^"([0-9A-F]+)[-"]/;

function TDoc(address, username, password) {
    this.address = address.replace(/\/?$/, '/'); // check that it includes the trailing slash
    this.username = username;
    this.password = password;
    const proto = reProto.exec(address);
    if (!proto)
        throw new Error('Unsupported protocol.');
    this.agent = new (require(proto[1])).Agent({
        keepAlive: true, // keep alive connections for reuse
        keepAliveMsecs: 5000, // for up to 5 seconds
        maxSockets: 4, // do not use more than 4 parallel connections
    });
}

TDoc.Promise = Q;

TDoc.Error = function (method, err) {
    // inspired by: http://stackoverflow.com/a/8460753/166524
    if ('captureStackTrace' in Error)
        Error.captureStackTrace(this, this.constructor);
    this.name = 'TDoc.Error';
    this.method = method;
    this.status = 0|err.status;
    try {
        //TODO: does this actually happen?
        if ('code' in err.response.body)
            err = err.response.body;
    } catch (e) {
        // ignore
    }
    this.code = 0|err.code;
    this.message = err.message;
    this.additional = err.additional || [];
};
TDoc.Error.prototype = Object.create(Error.prototype);
TDoc.Error.prototype.constructor = TDoc.Error;

TDoc.longStack = function (val) {
    if (!val)
        console.log('WARNING: long stack traces are always enabled since version 0.2.0');
};

function forceNumber(n) {
    return +n;
}

function nameValue2Object(arr) {
    const o = {};
    arr.forEach(function (e) {
        o[e.name] = e.value;
    });
    return o;
}

function massageDoc(doc) {
    if (Array.isArray(doc.metadata)) { // old format, used up to tDoc r13584
        doc.lotto = +doc.lotto;
        doc.metadata = nameValue2Object(doc.metadata);
    }
    return doc;
}

function massageDoctype(doctypes) {
    doctypes.forEach(function (dt) {
        if (typeof dt.custom == 'string') // tDoc r14171 returns it as a string, but will change in the future
            dt.custom = JSON.parse(dt.custom);
    });
    return doctypes;
}

function GET(me, method, data) {
    return Q.resolve(req
        .get(me.address + method)
        .agent(me.agent)
        .auth(me.username, me.password)
        .query(data)
    ).catch(function (err) {
        throw new TDoc.Error(method, err);
    }).then(function (resp) {
        const data = resp.body;
        if (typeof data == 'object' && 'message' in data)
            throw new TDoc.Error(method, resp);
        if (resp.status >= 400)
            throw new TDoc.Error(method, resp);
        return data;
    });
}

function GETbuffer(me, method, data) {
    return Q.resolve(req
        .get(me.address + method)
        .agent(me.agent)
        .auth(me.username, me.password)
        .buffer(true).parse(req.parse.image) // necessary to have resp.body as a Buffer
        .query(data)
    ).catch(function (err) {
        throw new TDoc.Error(method, err);
    }).then(function (resp) {
        if ('etag' in resp.header) {
            const m = reEtag.exec(resp.header.etag);
            if (m) {
                const declared = m[1];
                const algo = declared.length < 64 ? 'sha1' : 'sha256';
                const calc = crypto.createHash(algo).update(resp.body).digest('hex').toUpperCase();
                if (calc != declared)
                    throw new Error('Hash value mismatch.');
            }
        }
        return resp.body;
    });
}

function POST(me, method, data) {
    return Q.resolve(req
        .post(me.address + method)
        .agent(me.agent)
        .auth(me.username, me.password)
        .type('form')
        .send(data)
    ).catch(function (err) {
        throw new TDoc.Error(method, err);
    }).then(function (resp) {
        const data = resp.body;
        if (typeof data == 'object' && 'message' in data)
            throw new TDoc.Error(method, data.code, data.message);
        return data;
    });
}

function documentPOST(me, method, data, document) {
    const r = req
        .post(me.address + method)
        .agent(me.agent)
        .auth(me.username, me.password)
        .field(data);
    if (document)
        r.attach('document', document);
    return Q.resolve(r
    ).catch(function (err) {
        throw new TDoc.Error(method, err);
    }).then(function (resp) {
        const data = resp.body;
        if (typeof data == 'object' && 'message' in data)
            throw new TDoc.Error(method, data.code, data.message);
        if (typeof data == 'object' && 'document' in data) {
            if ('warning' in data)
                data.document.warning = { message: data.warning.shift(), extra: data.warning };
            return massageDoc(data.document);
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
    const s = {};
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

function upload(me, p) {
    if (!p.doctype)
        return Q.reject(new Error('you need to specify ‘doctype’'));
    if (!p.period)
        return Q.reject(new Error('you need to specify ‘period’'));
    if (!p.meta && p.ready)
        return Q.reject(new Error('if the document is ‘ready’ it must contain ‘meta’'));
    if (p.ready && (!p.file && !p.data))
        return Q.reject(new Error('if the document is ‘ready’ it must have a content as either ‘file’ or ‘data’'));
    const s = commonUploadParams(p);
    s.doctype = p.doctype;
    return documentPOST(me, 'docs/upload', s, p.file || p.data);
}

function update(me, p) {
    const s = commonUploadParams(p);
    return documentPOST(me, 'docs/update', s, p.file || p.data);
}

function updateMeta(me, p) {
    const data = {
        meta: p.meta,
        value: p.value,
    };
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return POST(me, 'docs/' + (0|p.id) + '/meta/update', data).then(massageDoc);
}

function search(me, p) {
    const data = {
        doctype: p.doctype,
        meta: JSON.stringify(p.meta),
    };
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    if (p.period) data.period = forceNumber(p.period);
    if (p.limit) data.limit = forceNumber(p.limit);
    if (p.complete) data.complete = 1;
    return POST(me, 'docs/search', data).then(function (data) {
        if (typeof data == 'object' && 'documents' in data)
            return data.documents;
        throw new Error('malformed response');
    });
}

function document(me, p) {
    const data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return GETbuffer(me, 'docs/' + (0|p.id), data);
}

function documentMeta(me, p) {
    const data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return GET(me, 'docs/' + (0|p.id) + '/meta', data).then(massageDoc);
}

function documentLink(me, p) {
    const data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return GET(me, 'docs/' + (0|p.id) + '/link', data);
}

function documentDelete(me, p) {
    const data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return GET(me, 'docs/' + (0|p.id) + '/delete', data);
}

function searchOne(me, p) {
    p.limit = 2; // we need 1 but limit to 2 to know if search was not unique
    p.complete = 1; // download each metadata directly to avoid one round-trip
    return search(me, p).then(function (data) {
        if (data.length != 1)
            throw new Error('Search result was not a single document');
        return data[0];
    });
}

function parcelCreate(me, p) {
    const data = {
        company: p.company,
        doctype: p.doctype,
        filename: p.filename,
    };
    if (p.user) data.user = p.user;
    return parcelPOST(me, 'docs/parcel/create', data);
}

function parcelClose(me, p) {
    const data = {
        parcel: p.id,
    };
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    if (p.extra) data.extra = p.extra;
    return parcelPOST(me, 'docs/parcel/close', data);
}

function parcelDelete(me, p) {
    const data = {
        parcel: p.id,
    };
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    if (p.error) data.error = p.error;
    if (p.extra) data.extra = p.extra;
    return parcelPOST(me, 'docs/parcel/delete', data);
}

function parcelXML(me, p) {
    const data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return GETbuffer(me, 'docs/parcel/' + p.id + '.xml', data);
}

function companyList(me, p) {
    const data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return GET(me, 'company/list', data);
}

function doctypeList(me, p) {
    const data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    return GET(me, 'doctype/list', data);
}

function doctypeInfo(me, p) {
    const data = {};
    if (p.user) data.user = p.user;
    if (p.company) data.company = p.company;
    if (p.doctype) data.doctype = p.doctype;
    return GET(me, 'doctype', data).then(massageDoctype);
}

// register nodeified versions in the prototype
[
    companyList,
    doctypeInfo,
    doctypeList,
    document,
    documentDelete,
    documentLink,
    documentMeta,
    parcelClose,
    parcelCreate,
    parcelDelete,
    parcelXML,
    search,
    searchOne,
    update,
    updateMeta,
    upload,
].forEach(function (f) {
    TDoc.prototype[f.name] = function (p) {
        if (typeof p != 'object')
            throw new Error('The parameter must be an object.');
        return f(this, p).nodeify(p.callback);
    };
});

module.exports = TDoc;
