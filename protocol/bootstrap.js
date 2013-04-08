// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let Cc = Components.classes;
let Ci = Components.interfaces;
let Cu = Components.utils;
let Cm = Components.manager;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js");

let LOG_TAG = "protocol/bootstrap.js";

function dump(msg) {
  Services.console.logStringMessage(LOG_TAG + " :: " + msg);
}

/* Bootstrapper protocol. */

let principal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);

function BootstrapperProtocol() {
}

BootstrapperProtocol.prototype = {
  scheme: "bootstrapper",

  protocolFlags: Ci.nsIProtocolHandler.URI_NORELATIVE |
                 Ci.nsIProtocolHandler.URI_NOAUTH |
                 Ci.nsIProtocolHandler.URI_IS_LOCAL_RESOURCE |
                 Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE,
                 // Ci.nsIProtocolHandler.URI_NON_PERSISTABLE, // Unfortunately, this flag doesn't prevent caching.

  newURI: function(aSpec, aOriginCharset, aBaseURI)
  {
    dump("newURI: " + aSpec);
    let uri = Cc["@mozilla.org/network/simple-uri;1"].createInstance(Ci.nsIURI);
    uri.spec = aSpec;
    return uri;
  },

  newChannel: function(aURI)
  {
    let url = aURI.spec.split("bootstrapper://")[1];
    let uri = Services.io.newURI(url, null, null);

    dump("newChannel: " + aURI.spec + " -> " + uri.spec);

    let channel = Services.io.newChannelFromURI(uri, null).QueryInterface(Ci.nsIHttpChannel);

    // Unfortunately, these loadFlags are not respected, possibly since they come before open().
    // channel.loadFlags |= Ci.nsIRequest.LOAD_BYPASS_CACHE;
    // channel.loadFlags |= Ci.nsIRequest.INHIBIT_CACHING;
    // channel.loadFlags |= Ci.nsIRequest.INHIBIT_PERSISTENT_CACHING;

    channel.owner = principal;
    channel.loadFlags &= ~Ci.nsIChannel.LOAD_REPLACE;
    channel.originalURI = aURI;

    return channel;
  },

  classDescription: "Fennec Bootstrapper Protocol Handler",
  contractID: "@mozilla.org/network/protocol;1?name=" + "bootstrapper",
  classID: Components.ID('{8df794d2-9ff0-4da2-bf2c-cfeb81126b65}'),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIProtocolHandler]),

  factory: { createInstance: function (aOuter, aIID) {
    return (new BootstrapperProtocol()).QueryInterface(aIID);
  } },
};

if (XPCOMUtils.generateNSGetFactory)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([BootstrapperProtocol]);
else
  var NSGetModule = XPCOMUtils.generateNSGetModule([BootstrapperProtocol]);

/* Protocol registration */

/**
 * Register the chrome protocol.
 */
function registerProtocol(value) {
  let manager = Cm.QueryInterface(Ci.nsIComponentRegistrar);
  let proto = BootstrapperProtocol.prototype;
  manager.registerFactory(proto.classID, proto.classDescription, proto.contractID, proto.factory);

  dump("registered bootstrapper:// protocol");
}

/**
 * Unregister the chrome protocol.
 */
function unregisterProtocol(value) {
  let manager = Cm.QueryInterface(Ci.nsIComponentRegistrar);
  let proto = BootstrapperProtocol.prototype;
  manager.unregisterFactory(proto.classID, proto.factory);

  dump("unregistered bootstrapper:// protocol");
}

/* Chrome manifest registration */

/**
 * Register a chrome manifest file.
 *
 * @param directory
 *        {nsIFile} Directory containing `chrome.manifest`.
 */
function registerChromeManifest(directory) {
  Cm.addBootstrappedManifestLocation(directory);

  dump("registered chrome manifest from directory " + directory.path);
}

/**
 * Unregister a chrome manifest file.
 *
 * @param directory
 *        {nsIFile} Directory containing `chrome.manifest`.
 */
function unregisterChromeManifest(directory) {
  Cm.removeBootstrappedManifestLocation(directory);

  dump("unregistered chrome manifest from directory " + directory.path);
}

/* Downloading */

/**
 * Download and write the contents of a URI to a file.
 *
 * @param uri
 *        {nsIURI} URI to download.
 * @param file
 *        {nsIFile} file to write.
 *
 * @return Promise<nsIFile> file written.
 */
function download(uri, file) {
  let deferred = Promise.defer();

  try {
    let persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);

    persist.persistFlags |= Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    persist.persistFlags |= Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE;

    persist.progressListener = {
      onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) { },
      onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) { },
      onSecurityChange: function(aWebProgress, aRequest, aState) { },
      onStatusChange:   function(aWebProgress, aRequest, aStatus, aMessage) { },

      onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
        if (!(aStateFlags & Ci.nsIWebProgressListener.STATE_STOP))
          return;

        if (Components.isSuccessCode(aStatus)) {
          deferred.resolve(file);
        } else {
          // XXX what type is the returned promise?
          deferred.reject(aStatus);
        }
      },
    };

    // This happens before any window is created, so this is the rare
    // case where there is no privacy context.
    let privacyContext = null;

    persist.saveURI(uri, null, null, null, null, file, privacyContext);
  } catch (e) {
    // XXX what type is the returned promise?
    deferred.reject(e);
  }

  dump("downloaded uri " + uri.spec + " to file " + file.path);
  return deferred.promise;
}

function get(uri, file) {
  let deferred = Promise.defer();

  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
        .createInstance(Ci.nsIXMLHttpRequest);
  // For the sake of simplicity, don't tie this request to any UI.
  xhr.mozBackgroundRequest = true;

  try {
    xhr.open("GET", uri.spec, false);
    xhr.channel.loadFlags |= Ci.nsIRequest.LOAD_BYPASS_CACHE;

    // prevent the "not well-formed" errors for local XHRs
    xhr.overrideMimeType("text/plain");

    xhr.send(null);
  } catch (e) {
    deferred.reject(e);
  }

  if (xhr.readyState == 4 && (xhr.status == 200 || (xhr.status == 0 && xhr.responseText))) {
    let stream = FileUtils.openSafeFileOutputStream(file);
    stream.write(xhr.responseText, xhr.responseText.length);
    stream.flush();
    stream.close();

    deferred.resolve(file);
  } else {
    deferred.reject(xhr.status);
  }

  return deferred.promise;
}

/* File */

function getChromeManifestFile() {
  let file = FileUtils.getFile("ProfLD", ["bootstrapper-chrome-manifest", "chrome.manifest"]);

  return Promise.resolve(file);
}

/* Bootstrap Interface */

function startup(aData, aReason) {
  Services.console.reset();

  dump("startup");

  let src = "http://ec2-23-22-189-235.compute-1.amazonaws.com:6001/chrome.manifest";
  let theURI = Services.io.newURI(src, null, null);

  getChromeManifestFile()
    .then(function (file) {
      return get(theURI, file);
    })
    .then(function(file) {
       // Protocol must be registered before manifest.
      registerProtocol();
      return Promise.resolve(file);
    })
    .then(function (file) {
      registerChromeManifest(file.parent);
      return Promise.resolve(file);
    })
    .then(function success(value) {
      dump("startup success: " + value);
    }, function failure(reason) {
      dump("startup failure: " + reason);
    });
}

function shutdown (aData, aReason) {
  dump("shutdown");

  getChromeManifestFile()
    .then(function (file) {
      unregisterChromeManifest(file.parent);
      return Promise.resolve(file);
    })
    .then(function(file) {
       // Protocol should be unregistered after manifest.
      unregisterProtocol();
      return Promise.resolve(file);
    })
    .then(function success(value) {
      dump("shutdown success: " + value);
    }, function failure(reason) {
      dump("shutdown failure: " + reason);
    });
}

function install (aData, aReason) {
  dump("install");
}

function uninstall (aData, aReason) {
  dump("uninstall");
}
