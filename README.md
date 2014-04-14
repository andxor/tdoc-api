tdoc-api
========

node wrapper around tDoc REST-ful APIs

API
---

All the methods have a single object parameter, used to have optional parameters.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->

- [`upload`](#upload)
- [`update`](#update)
- [`documentMeta`](#documentmeta)
- [`search`](#search)
- [`searchOne`](#searchone)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### `upload`

Upload a document.

__Arguments__

* document content (optional if `ready` is false), either:
  * `file`: path of the file to be uploaded
  * `data`: a `Buffer` or `binary` string with raw data
* `mimetype`: the content media type (defaults to `application/pdf`)
* `doctype`: docType to upload the document into
* `period`: fiscal period the document refers to; use current year for documents that don't have such concept
* `meta`: all the metadata to associate to the document (optional if `ready` is false)
* `ready`: if the document is ready for preservation or still incomplete (defaults to `true`)
* `company`: if the user has access to more than one company, use this optional field to specify which one the `doctype` refers to
* `alias` & `pin`: specify those fields when you need to apply a digital signature to the document
* `overwrite`: the document identifier of a (not yet preserved) document to overwrite (optional)
* `user`: (optional) the user the upload is made on the behalf of (to be used if and only if the authentication user is root)
* `callback(err, data)`: `err` in case of error or `data` will contain full document metadata

### `update`

Update a document.

__Arguments__

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
* `user`: (optional) the user the upload is made on the behalf of (to be used if and only if the authentication user is root)
* `callback(err, data)`: `err` in case of error or `data` will contain full document metadata

### `documentMeta`

Retrieves the full metadata of a document.

__Arguments__

* `id`: the identifier of the document
* `user`: (optional) the user the upload is made on the behalf of (to be used if and only if the authentication user is root)
* `callback(err, data)`: `err` in case of error or `data` will contain full document metadata

### `search`

Search for documents matching some metadata.

__Arguments__

* `doctype`: docType to search
* `period`: (optional) fiscal period to search
* `meta`: any metadata to search for
* `user`: (optional) the user the upload is made on the behalf of (to be used if and only if the authentication user is root)
* `callback(err, data)`: `err` in case of error or `data` will be an array of document identifiers

### `searchOne`

Search for a single document matching some metadata.
Returns full metadata of the searched document.

Warning: it is implemented using `search` and `documentMeta` and thus requires two round trip times.

__Arguments__

* `doctype`: docType to search
* `period`: (optional) fiscal period to search
* `meta`: any metadata to search for
* `user`: (optional) the user the upload is made on the behalf of (to be used if and only if the authentication user is root)
* `callback(err, data)`: `err` in case of error or `data` will contain full document metadata
