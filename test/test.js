const
    tape = require('tape'), // https://github.com/substack/tape
    tapeNock = require('tape-nock'),
    crypto = require('crypto'),
    TDoc = require('../index'),
    tdoc = new TDoc('http://127.0.0.1/tdoc/api/', 'l.luchini@andxor.it', 'Password1'),
    testMode = (process.argv.length > 2 && process.argv[2] == 'local') ? 'lockdown' : 'record',
    test = tapeNock(tape, {
        fixtures: __dirname + '/nock/',
        mode: testMode
    });

function sha256(val) {
    return crypto.createHash('sha256').update(val).digest('hex');
}

test('search', function (t) {
    tdoc.search({
        doctype: 'File',
        limit: 7,
        meta: {$dateIns:{$gte:123456,$lte:"2016-06-28"}}
    }).then(function (docs) {
        t.equal(docs.length, 7, 'number of documents found');
        t.deepEqual(docs,
            [19533, 17279, 17277, 17275, 10564, 10562, 10560],
            'documents ids');
    }).fail(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});

test('searchOne', function (t) {
    tdoc.searchOne({
        doctype: 'File',
        meta: {$dateIns:{$gte:"2015-09-23",$lte:"2015-09-24"}}
    }).then(function (doc) {
        t.equal(doc.docid, 10560, 'single document');
    }).fail(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});

test('download', function (t) {
    tdoc.documentMeta({
        id: 17275
    }).then(function (doc) {
        return tdoc.document({
            id: 17275
        }).then(function (bin) {
            t.ok(bin instanceof Buffer, 'data type');
            t.equal(bin.length, 887, 'data length');
            t.equal(sha256(bin), doc.hash.toLowerCase(), 'data hash');
            return tdoc.parcelXML({
                id: doc.parcel
            });
        }).then(function (xml) {
            t.ok(xml.indexOf(doc.hash) > 0, 'parcel contains document');
        });
    }).fail(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});

test('error GET', function (t) {
    let e = null;
    tdoc.documentMeta({
        id: 1234567890
    }).catch(function (e1) {
        e = e1;
    }).finally(function () {
        t.ok(e instanceof Error, 'should throw an Error');
        t.equal(e.code, 231, 'should be a code 231 (document missing) error');
        t.end();
    });
});

//TODO 'error POST'
