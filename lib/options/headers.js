/*jshint node:true*/
'use strict';

/**
 * Checks header validity.
 *
 * Header is checked for spec, the name can contain a-z and a dash. The value
 * can be any character. They should be separated by a colon. No spaces before
 * colon.
 *
 * Ex:
 * - `Authorization: Bearer y8s39...`
 * - `X-My-Custom-Header: Custom Value`
 *
 * @param {String} header A string representation of a header.
 */
function isValidHeader(header) {
  return header.match(/^[a-zA-Z-]*:.*/);
}

/**
 * Headers
 */
module.exports = function(proto) {
  /**
   * Adds HTTP/S headers
   *
   * May be called multiple times to append more headers.
   *
   * Note: HTTP headers are added to command options before the input.
   *
   * @method FfmpegCommand#headers
   * @category Headers
   *
   * @param {String|Array} headers A string or array of strings representing HTTP/S headers.
   * @return FfmpegCommand
   */
  proto.headers = function(headers) {
    if (!headers) {
      return this;
    }

    // If headers param is a string...
    if (!Array.isArray(headers) && typeof headers === 'string') {
      // ...map it to an array.
      headers = [headers];
    }

    if (Array.isArray(headers)) {
      // Validate headers...
      for(var i = 0; i < headers.length; i++) {
        // If any new header is not valid, ignore this invocation.
        if (!isValidHeader(headers[i])) {
          return this;
        }
      }

      // If headers are already set...
      if (Array.isArray(this._headers) && this._headers[1]) {
        // append new headers.
        this._headers[1] = this._headers[1] + '\r\n' + headers.join('\r\n');
      } else {
        // Otherwise set initial headers.
        this._headers = ['-headers', headers.join('\r\n')];
      }
    }

    return this;
  }
}
