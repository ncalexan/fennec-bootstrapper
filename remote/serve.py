#!/usr/bin/env python
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

"""
Serve preprocessed content over HTTP.

Preprocessor definitions are taken from user-specified `config.status`
file (usually, `$(OBJDIR)/config.status`).
"""

from __future__ import print_function

import argparse
import errno
import logging
import os
import shutil
import sys

from BaseHTTPServer import HTTPServer
from PreprocessingHTTPServer import PreprocessingHTTPRequestHandler
from Preprocessor import Preprocessor


def make_preprocessor(config_status):
    pp = Preprocessor()
    pp.setLineEndings("lf")
    pp.setMarker("#")
    pp.do_filter("substitution")

    # Might need 'substs' too.
    defines = {}
    for k, v in config_status['defines']:
        if v:
            defines[k] = v
    pp.context.update(defines)

    return pp


def serve(directory, port, preprocessor, verbose=True):
    server_address = ('', port)
    httpd = HTTPServer(server_address,
                       PreprocessingHTTPRequestHandler)
    httpd.preprocessor = preprocessor
    httpd.basepath = directory

    sa = httpd.socket.getsockname()

    if verbose:
        print("Serving HTTP on", sa[0], "port", sa[1], "...")

    httpd.serve_forever()


if __name__ == '__main__':
    # parse command line arguments
    parser = argparse.ArgumentParser(description="Serve a directory, preprocessing files.")
    parser.add_argument("-v", "--verbose", dest="verbose", action="store_true", default=True, help="verbose output")
    parser.add_argument("-q", "--quite", dest="verbose", action="store_false", help="quiet output")
    parser.add_argument("-p", "--port", dest="port", type=int, default=8000, help="port number to bind to (default: 8000)")
    parser.add_argument("-o", "--objdir", dest="objdir", default='.', help="objdir to look for config.status in")
    parser.add_argument("-d", "--directory", dest="directory", help="directory to serve (default: $(TOPSRCDIR) from config.status)")

    cmdargs = parser.parse_args(sys.argv[1:])

    configstatus = os.path.abspath(os.path.expanduser("%s/config.status" % cmdargs.objdir))
    gs = {}
    gs['__file__'] = configstatus
    execfile(configstatus, gs)

    if cmdargs.verbose:
        print("Read config.status from %s" % configstatus)

    preprocessor = make_preprocessor(gs)

    directory = cmdargs.directory
    if not directory:
        directory = gs['topsrcdir']

    if cmdargs.verbose:
        print("Preprocessing content from %s" % directory)

    serve(directory, cmdargs.port, preprocessor, verbose=cmdargs.verbose)
