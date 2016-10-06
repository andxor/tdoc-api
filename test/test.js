const
    tape = require('tape'),
    tapeNock = require('tape-nock'),
    crypto = require('crypto'),
    TDoc = require('../index'),
    tdoc = new TDoc('http://127.0.0.1/tdoc/api/', 'l.luchini@andxor.it', 'Andxor01'),
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

test('download', function (t) {
    tdoc.document({
        id: 17275
    }).then(function (doc) {
        t.ok(doc instanceof Buffer, 'type');
        t.equal(doc.length, 887, 'length');
        t.equal(sha256(doc), '13c75efe1f30810589eb35cd9bacf0edb91a989110eac8374344bd9380c9cf32', 'hash');
    }).fail(function (err) {
        t.fail(err);
    }).finally(function () {
        t.end();
    });
});
