tdoc-api
========

node wrapper around tDoc REST-ful APIs

API
---

<!-- START doctoc generated TOC please keep comment here to allow auto update -->

- [`upload(params)`](#uploadparams)
- [`upload(file, doctype, period, meta, callback)`](#uploadfile-doctype-period-meta-callback)
- [`update(params)`](#updateparams)
- [`documentMeta(id, callback)`](#documentmetaid-callback)
- [`search(doctype, period, meta, callback)`](#searchdoctype-period-meta-callback)
- [`searchOne(doctype, period, meta, callback)`](#searchonedoctype-period-meta-callback)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### `upload(params)`

Upload a document.
Input object is used to have the following named parameters:

* document content (optional if `ready` is false), either:
  * `file`: path of the file to be uploaded
  * `data`: a `Buffer` or `binary` string with raw data
* `mimetype`: the content media type (default to `application/pdf`)
* `doctype`: docType to upload the document into
* `period`: fiscal period the document refers to; use current year for documents that don't have such concept
* `meta`: all the metadata to associate to the document (optional if `ready` is false)
* `ready`: if the document is ready for preservation or still incomplete (defaults to `true`)
* `company`: if the user has access to more than one company, use this optional field to specify which one the `doctype` refers to
* `alias` & `pin`: specify those fields when you need to apply a digital signature to the document
* `overwrite`: the document identifier of a (not yet preserved) document to overwrite (optional)
* `callback(err, data)`: `err` in case of error or `data` will contain full document metadata

### `upload(file, doctype, period, meta, callback)`

Old style of `upload`, kept for retro-compatibility.

### `update(params)`

Update a document.
Input object is used to have the following named parameters:

* `id`: the identifier of the document to update
* document content (optional if `ready` is false), either:
  * `file`: path of the file to be uploaded
  * `data`: a `Buffer` or `binary` string with raw data
* `mimetype`: the content media type (defaults to `application/pdf`)
* `meta`: all the metadata to associate to the document (optional if `ready` is false)
* `ready`: if the document is ready for preservation or still incomplete (defaults to `true`)
* `company`: if the user has access to more than one company, use this optional field to specify which one the `doctype` refers to
* `alias` & `pin`: specify those fields when you need to apply a digital signature to the document
* `overwrite`: the document identifier of a (not yet preserved) document to overwrite (optional)
* `callback(err, data)`: `err` in case of error or `data` will contain full document metadata

### `documentMeta(id, callback)`

Retrieves the full metadata of a document.

* `id`: the identifier of the document
* `callback(err, data)`: `err` in case of error or `data` will contain full document metadata

### `search(doctype, period, meta, callback)`

Search for documents matching some metadata.

* `doctype`: docType to search
* `period`: (optional) fiscal period to search
* `meta`: any metadata to search for
* `callback(err, data)`: `err` in case of error or `data` will be an array of document identifiers

### `searchOne(doctype, period, meta, callback)`

Search for a single document matching some metadata.
Returns full metadata of the searched document.

Warning: it is implemented using `search` and `documentMeta` and thus requires two round trip times.

* `doctype`: docType to search
* `period`: (optional) fiscal period to search
* `meta`: any metadata to search for
* `callback(err, data)`: `err` in case of error or `data` will contain full document metadata
