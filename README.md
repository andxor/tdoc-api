tdoc-api
========

node wrapper around tDoc REST-ful APIs

API
---

### upload(file, doctype, period, meta, callback)

Upload a document.

* `file`: path of the file to be uploaded
* `doctype`: docType to upload the document into
* `period`: fiscal period the document refers to; use current year for documents that don't have such concept
* `meta`: all the metadata to associate to the document
* `callback(err, data)`: method that will be called on termination of the request

### search(doctype, period, meta, callback)

Search for documents matching some metadata.

* `doctype`: docType to search
* `period`: (optional) fiscal period to search
* `meta`: any metadata to search for
* `callback(err, data)`: method that will be called on termination of the request
