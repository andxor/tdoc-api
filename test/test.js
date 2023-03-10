'use strict';

const
    tape = require('tape'), // https://github.com/substack/tape
    tapeNock = require('tape-nock'),
    crypto = require('crypto'),
    TDoc = require('../index'),
    cfg = require('../config'),
    tdoc = new TDoc(cfg.url, cfg.user, cfg.pass),
    testMode = (process.argv.length > 2 && process.argv[2] == 'local') ? 'lockdown' : 'record',
    test = tapeNock(tape, {
        fixtures: __dirname + '/nock/',
        mode: testMode,
    });

if (testMode == 'record')
    require('fs').rmSync(__dirname + '/nock/', { recursive: true, force: true });

function sha256(val) {
    return crypto.createHash('sha256').update(val).digest('hex');
}

function fixMultipart(scope) {
    // depending on content, Nock returns it as plaintext or Base64 encoded, accept both
    var separator = /----------------------------[0-9]{24}|2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d(3[0-9]){24}/g;
    scope.filteringRequestBody(function (body, recorded) {
        var sep = separator.exec(recorded);
        if (sep)
            return body.replace(separator, sep[0]);
        return body;
    });
}

test('search', function (t) {
    tdoc.search({
        doctype: 'File',
        limit: 7,
        meta: {$dateIns:{$gte:"2022-09-13",$lt:"2022-09-14"}}
    }).then(function (docs) {
        t.equal(docs.length, 7, 'number of documents found');
        t.deepEqual(docs,
            [297829, 297828, 297827, 297826, 297825, 297824, 297823],
            'documents ids');
    }).catch(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});

test('searchOne', function (t) {
    tdoc.searchOne({
        doctype: 'File',
        meta: {"Numero documento": "Xox1w6eZAx"}
    }).then(function (doc) {
        t.equal(doc.docid, 297884, 'single document');
    }).catch(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});

test('download', function (t) {
    tdoc.documentMeta({
        id: 297884,
    }).then(function (doc) {
        return tdoc.document({
            id: 297884,
        }).then(function (bin) {
            t.ok(bin instanceof Buffer, 'data type');
            t.equal(bin.length, 994, 'data length');
            t.equal(sha256(bin), doc.hash.toLowerCase(), 'data hash');
            return tdoc.parcelXML({
                id: doc.parcel,
            });
        }).then(function (xml) {
            t.ok(xml.indexOf(doc.hash) > 0, 'parcel contains document');
        });
    }).catch(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});

test('error GET', function (t) {
    let e = null;
    tdoc.documentMeta({
        id: 1234567890,
    }).catch(function (e1) {
        e = e1;
    }).finally(function () {
        t.ok(e instanceof Error, 'should throw an Error');
        t.equal(e.code, 231, 'should be a code 231 (document missing) error');
        t.end();
    });
});

test('upload', { after: fixMultipart }, function (t) {
    let e = null;
    tdoc.upload({
        data: Buffer.from('test content'),
        doctype: 'File',
        period: 2023,
        meta: {},
    }).catch(function (e1) {
        e = e1;
    }).finally(function () {
        t.ok(e instanceof Error, 'upload 1 should throw an Error');
        t.equal(e.code, 68, 'upload 1 should give code 68 (missing metadata) error');
    }).then(function () {
        e = null;
        const random = crypto.randomBytes(8).toString('hex');
        return tdoc.upload({
            data: Buffer.from('test content'),
            doctype: 'File',
            period: 2023,
            meta: {
                'Data documento': '2023-03-10',
                'Numero documento': random,
                'Nome file': random + '.txt',
            },
        });
    }).catch(function (e1) {
        e = e1;
    }).finally(function () {
        t.ok(e == null, 'upload 2 should be OK');
        if (e) console.log(e.message);
    }).then(function () {
        e = null;
        return tdoc.upload({
            file: 'does_not_exist.pdf',
            doctype: 'File',
            period: 2023,
            meta: {}
        });
    }).catch(function (e1) {
        e = e1;
    }).finally(function () {
        t.ok(e instanceof Error, 'upload 3 should throw an Error');
        t.ok(e.message.startsWith('ENOENT:'), 'upload 3 should give file missing error');
        t.end();
    });
});
