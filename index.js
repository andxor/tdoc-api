/*!
 * node tDoc API wrapper
 * (c) 2014-2019 Lapo Luchini <l.luchini@andxor.it>
 */
'use strict';

const
    crypto = require('crypto'),
    zlib = require('zlib'),
    req = require('superagent'),
    CMS = require('@lapo/extractcms'),
    reProto = /^(https?):/,
    reEtag = /^"([0-9A-F]+)[-"]/;

function gunzip(data) {
    return new Promise((resolve, reject) => {
        zlib.gunzip(data, (error, result) => {
            if(!error) resolve(result);
            else reject(error);
        });
    });
}

function forceNumber(n) {
    return +n;
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


class TDoc {
    #address;
    #username;
    #password;
    #agent;
    #token;

    constructor(address, username, password) {
        this.#address = address.replace(/\/?$/, '/'); // check that it includes the trailing slash
        this.#username = username;
        this.#password = password;
        const proto = reProto.exec(address);
        if (!proto)
            throw new TDocError('Unsupported protocol.');
        this.#agent = new (require(proto[1])).Agent({
            keepAlive: true, // keep alive connections for reuse
            keepAliveMsecs: 5000, // for up to 5 seconds
            maxSockets: 4, // do not use more than 4 parallel connections
        });
    }

    async #addAuth(req) {
        if (!this.token)
            this.token = this.#login({ verifyIP: true });
        const jwt = await this.token;
        if (jwt)
            req.set('Authorization', 'Bearer ' + jwt);
        else
            req.auth(this.#username, this.#password);
    }

    async #loginAndGET(method, data, wantBuffer) {
        const request = req
            .get(this.#address + method)
            .agent(this.#agent);
        if (wantBuffer)
            request.buffer(true).parse(req.parse.image); // necessary to have resp.body as a Buffer
        await this.#addAuth(request);
        try {
            return await request.query(data);
        } catch(err) {
            throw new TDocError(method, err);
        }
    }

    async #GET(method, data) {
        const request = req
            .get(this.#address + method)
            .agent(this.#agent);
        await this.#addAuth(request);
        try {
            const resp = await request.query(data);
            data = resp.body;
            if (typeof data == 'object' && 'message' in data)
                throw new TDocError(method, resp);
            if (resp.status >= 400)
                throw new TDocError(method, resp);
            return data;
        } catch(err) {
            if ( err.response && err.response.body ) {
                const errCode = err.response.body.code;
                const errMessage = err.response.body.message;
                if (errCode == 338 /* Basic Authentication disabled  */) {
                    return this.#loginAndGET(this, method, data, false);
                } else if ( errCode == 337 /* Token expired */ ) {
                    return this.#loginAndGET(this, method, data, false);
                }
            }
            throw new TDocError(method, err);
        }
    }

    async #basicGET(method, data) {
        try {
            const resp = await req
                .get(this.#address + method)
                .agent(this.#agent)
                .auth(this.#username, this.#password)
                .query(data);
            data = resp.body;
            if (typeof data == 'object' && 'message' in data)
                throw new TDocError(method, resp);
            if (resp.status >= 400)
                throw new TDocError(method, resp);
            return data;
        } catch(err) {
            throw new TDocError(method, err);
        }
    }

    async #GETbuffer(method, data) {
        const request = req
            .get(this.#address + method)
            .agent(this.#agent)
            .buffer(true).parse(req.parse.image); // necessary to have resp.body as a Buffer
        await this.#addAuth(request);
        try {
            const resp = await request.query(data);
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
        } catch(err) {
            if ( err.response && err.response.body ) {
                const errBody = JSON.parse(err.response.body.toString('utf-8'));
                const errCode = errBody.code;
                if (errCode == 338 /* Basic Authentication disabled  */) {
                    return this.#loginAndGET(this, method, data, true);
                } else if ( errCode == 337 /* Token expired */ ) {
                    return this.#loginAndGET(this, method, data, true);
                }
            }
            throw new TDocError(method, err);
        }
    }

    async #loginAndPOST(method, data) {
        const request = req
            .post(this.#address + method)
            .agent(this.#agent)
            .type('form');
        await this.#addAuth(request);
        try {
            return await request.send(data);
        } catch(err) {
            throw new TDocError(method, err);
        }
    }

    async #POST(method, data) {
        const request = req
            .post(this.#address + method)
            .agent(this.#agent)
            .type('form');
        await this.#addAuth(request);
        try {
            const resp = await request.send(data);
            data = resp.body;
            if (typeof data == 'object' && 'message' in data)
                throw new TDocError(method, data.code, data.message);
            return data;
        } catch(err) {
            if ( err.response && err.response.body ) {
                const errCode = err.response.body.code;
                const errMessage = err.response.body.message;
                if (errCode == 338 /* Basic Authentication disabled  */) {
                    return this.#loginAndPOST(this, method, data);
                } else if ( errCode == 337 /* Token expired */ ) {
                    return this.#loginAndPOST(this, method, data);
                }
            }
            throw new TDocError(method, err);
        }
    }

    async #documentPOST(method, data, document) {
        const request = req
            .post(this.#address + method)
            .agent(this.#agent)
            .auth(this.#username, this.#password)
            .field(data);
        await this.#addAuth(request);
        if (document)
            request.attach('document', document);
        try {
            const resp = await request;
            data = resp.body;
            if (typeof data == 'object' && 'message' in data)
                throw new TDocError(method, data.code, data.message);
            if (typeof data == 'object' && 'document' in data) {
                if ('warning' in data)
                    data.document.warning = { message: data.warning.shift(), extra: data.warning };
                return massageDoc(data.document);
            }
            throw new Error('Unexpected return value (document): ' + JSON.stringify(data));
        } catch(err) {
            throw new TDocError(method, err);
        }
    }

    async #parcelPOST(method, data) {
        const resp = this.#POST(this, method, data);
        if (typeof resp == 'object' && 'parcel' in resp)
            return resp.parcel;
        throw new Error('Unexpected return value (parcel): ' + JSON.stringify(resp));
    }

    async #login(p) {
        const data = {};
        if (p.company) data.company = p.company;
        if (p.verifyIP) data.verifyIP = true;
        try {
            const resp = await this.#basicGET('login', data);
            if (typeof resp == 'object' && 'jwt' in resp)
                return resp.jwt;
            throw new Error('Unexpected return value (login): ' + JSON.stringify(resp));
        } catch(err) {
            if (err.message.includes('Not Found')) {
                this.token = null;
            } else
                throw new Error(err);
        }
    }

    async upload(p) {
        if (!p.doctype)
            throw new Error('you need to specify ‘doctype’');
        if (!p.period)
            throw new Error('you need to specify ‘period’');
        if (!p.meta && p.ready)
            throw new Error('if the document is ‘ready’ it must contain ‘meta’');
        if (p.ready && (!p.file && !p.data))
            throw new Error('if the document is ‘ready’ it must have a content as either ‘file’ or ‘data’');
        const s = commonUploadParams(p);
        s.doctype = p.doctype;
        return await this.#documentPOST('docs/upload', s, p.file || p.data);
    }

    async update(p) {
        const s = commonUploadParams(p);
        return await this.#documentPOST('docs/update', s, p.file || p.data);
    }

    async updateMeta(p) {
        const data = {
            meta: p.meta,
            value: p.value,
        };
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        const resp = await this.#POST('docs/' + (0|p.id) + '/meta/update', data);
        return massageDoc(resp);
    }

    async search(p) {
        const data = {
            doctype: p.doctype,
            meta: JSON.stringify(p.meta),
        };
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        if (p.period) data.period = forceNumber(p.period);
        if (p.limit) data.limit = forceNumber(p.limit);
        if (p.complete) data.complete = 1;
        const resp = await this.#POST('docs/search', data);
        if (typeof resp == 'object' && 'documents' in resp)
            return resp.documents;
        throw new Error('malformed response');
    }

    async document(p) {
        const data = {};
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        return await this.#GETbuffer('docs/' + (0|p.id), data);
    }

    async documentMeta(p) {
        const data = {};
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        const resp = await this.#GET('docs/' + (0|p.id) + '/meta', data);
        return massageDoc(resp);
    }

    async documentLink(p) {
        const data = {};
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        return await this.#GET('docs/' + (0|p.id) + '/link', data);
    }

    async documentDelete(p) {
        const data = {};
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        return await this.#GET('docs/' + (0|p.id) + '/delete', data);
    }

    async searchOne(p) {
        p.limit = 2; // we need 1 but limit to 2 to know if search was not unique
        p.complete = 1; // download each metadata directly to avoid one round-trip
        const data = await this.search(p);
        if (data.length != 1)
            throw new Error('Search result was not a single document');
        return data[0];
    }

    async parcelCreate(p) {
        const data = {
            company: p.company,
            doctype: p.doctype,
            filename: p.filename,
        };
        if (p.user) data.user = p.user;
        return await this.#parcelPOST('docs/parcel/create', data);
    }

    async parcelClose(p) {
        const data = {
            parcel: p.id,
        };
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        if (p.extra) data.extra = p.extra;
        return await this.#parcelPOST('docs/parcel/close', data);
    }

    async parcelDelete(p) {
        const data = {
            parcel: p.id,
        };
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        if (p.error) data.error = p.error;
        if (p.extra) data.extra = p.extra;
        return await this.#parcelPOST('docs/parcel/delete', data);
    }

    async parcelXML(p) {
        const data = {};
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        let xml = await this.#GETbuffer('docs/parcel/' + p.id + '.xml', data);
        if (xml[0] != 0x30)
            return xml; // old format, pure XML
        // new format, signed and gzipped
        xml = CMS.extract(xml);
        return gunzip(xml);
    }

    async companyList(p) {
        const data = {};
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        return await this.#GET('company/list', data);
    }

    async doctypeList(p) {
        const data = {};
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        return await this.#GET('doctype/list', data);
    }

    async doctypeInfo(p) {
        const data = {};
        if (p.user) data.user = p.user;
        if (p.company) data.company = p.company;
        if (p.doctype) data.doctype = p.doctype;
        const resp = await this.#GET('doctype', data);
        return massageDoctype(resp);
    }

}

class TDocError extends Error {
    constructor(method, err) {
        super(err.message);
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
        this.additional = err.additional || [];
    }
}

module.exports = TDoc;
