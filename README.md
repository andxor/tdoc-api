tdoc-api
========

node wrapper around tDoc REST-ful APIs

API
---

All the methods have a single object parameter, used as a way to improve readability and have optional parameters.

All methods return a [Promise/A+](https://promisesaplus.com/) but accept an optional Node-style `callback(err, data)` parameter.

All methods accept a `user` parameter used to specify the user the request is made on the behalf of (to be used if and only if the authentication user is root).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->

- [`upload`](#upload)
- [`update`](#update)
- [`document`](#document)
- [`documentMeta`](#documentmeta)
- [`search`](#search)
- [`searchOne`](#searchone)
- [`parcelCreate`](#parcelcreate)
- [`parcelClose`](#parcelclose)
- [`parcelDelete`](#parceldelete)
- [`documentDelete`](#documentdelete)
- [`companyList`](#companylist)
- [`doctypeList`](#doctypelist)
- [`doctypeInfo`](#doctypeinfo)

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
* `parcel`: an optional parcel identifier (created with [`parcelCreate`](#parcelcreate))
* `meta`: all the metadata to associate to the document (optional if `ready` is false)
* `ready`: if the document is ready for preservation or still incomplete (defaults to `true`)
* `company`: if the user has access to more than one company, use this optional field to specify which one the `doctype` refers to
* `alias` & `pin`: specify those fields when you need to apply a digital signature to the document
* `overwrite`: the document identifier of a (not yet preserved) document to overwrite (optional)

__Returns__

Full document metadata.

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

__Returns__

Full document metadata.

### `document`

Retrieves a Buffer with the content of a document.

__Arguments__

* `id`: the identifier of the document

__Returns__

Full document content.

### `documentMeta`

Retrieves the full metadata of a document.

__Arguments__

* `id`: the identifier of the document

__Returns__

Full document metadata.

### `search`

Search for documents matching some metadata.

__Arguments__

* `doctype`: docType to search
* `period`: (optional) fiscal period to search
* `meta`: any metadata to search for

__Returns__

An array of document identifier.

### `searchOne`

Search for a single document matching some metadata.
Returns full metadata of the searched document.

Warning: it is implemented using `search` and `documentMeta` and thus requires two round trip times.

__Arguments__

* `doctype`: docType to search
* `period`: (optional) fiscal period to search
* `meta`: any metadata to search for

__Returns__

Full document metadata.

### `parcelCreate`

Opens a new parcel to upload one or more documents as a single entity.

__Arguments__

* `doctype`: docType to create the parcel in
* `filename`: the (unique) filename of this parcel

__Returns__

The parcel unique identifier.

### `parcelClose`

Closes the parcel.

__Arguments__

* `id`: the identifier of the parcel
* `extra`: (optional) a string containing the parcel source metadata

__Returns__

All the metadata of the closed parcel.

### `parcelDelete`

Deletes the parcel (and all the documents it contained).

__Arguments__

* `id`: the identifier of the parcel
* `error`: (optional) a string containing the error that required the deletion of the parcel
* `extra`: (optional) a string containing the parcel source metadata

__Returns__

All the metadata of the closed parcel.

### `documentDelete`

Deletes a document.

__Arguments__

* `id`: the identifier of the document

__Returns__

Nothing.

### `companyList`

List of companies the user has access to.

__Arguments__

None.

__Returns__

A JSON object with short company names as keys and long names as values.

### `doctypeList`

List of doctypes the user has access to.

__Arguments__

None.

__Returns__

A JSON object with short company names as keys and an array of doctypes names as values.

### `doctypeInfo`

Full information about a doctype.

__Arguments__

* `doctype`: the doctype (defaults to all of them)

__Returns__

An array of doctype objects.
