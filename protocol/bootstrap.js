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

function getSynchronous(uri, file) {
  let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
        .createInstance(Ci.nsIXMLHttpRequest);
  // For the sake of simplicity, don't tie this request to any UI.
  xhr.mozBackgroundRequest = true;

  xhr.open("GET", uri.spec, false);
  xhr.channel.loadFlags |= Ci.nsIRequest.LOAD_BYPASS_CACHE;

  // prevent the "not well-formed" errors for local XHRs
  xhr.overrideMimeType("text/plain");

  // Synchronous!
  xhr.send(null);

  if (xhr.readyState == 4 && (xhr.status == 200 || (xhr.status == 0 && xhr.responseText))) {
    let data = xhr.responseText;
    dump("data: '" + data + "' length: " + data.length);

    if (!file.exists()) {
      file.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt('0666', 8));
    }

    let stream = FileUtils.openFileOutputStream(file);
    stream.write(data, data.length);
    stream.flush();
    stream.close();

    dump("wrote chrome manifest to " + file.path);
  } else {
    throw new Error("XHR synchronous get returned status " + xhr.status);
  }
}

/* File */

function getChromeManifestFile() {
  let file = FileUtils.getFile("ProfLD", ["bootstrapper-chrome-manifest", "chrome.manifest"]);
  return file;
}

/* Bootstrap Interface */

function startup(aData, aReason) {
  Services.console.logStringMessage("");
  Services.console.reset();

  dump("startup");

  let path = Services.prefs.getCharPref("extensions.bootstrapper.bootstrapURL");
  if (path.indexOf("://") == -1) {
    path = "http://" + path;
  }

  let theURI = Services.io.newURI(path, null, null);

  try {
    let file = getChromeManifestFile();
    getSynchronous(theURI, file);

    // Protocol must be registered before manifest.
    registerProtocol();
    registerChromeManifest(file.parent);
    Services.prefs.setBoolPref("nglayout.debug.disable_xul_cache", 1);

    dump("startup success");
  } catch (e) {
    dump("startup failure");
    Cu.reportError(e);
  }
}

function shutdown (aData, aReason) {
  dump("shutdown");

  try {
    let file = getChromeManifestFile();
    unregisterChromeManifest(file.parent);
    // Protocol should be unregistered after manifest.
    unregisterProtocol();
    Services.prefs.setBoolPref("nglayout.debug.disable_xul_cache", 0);

    dump("shutdown success");
  } catch (e) {
    dump("shutdown failure");
    Cu.reportError(e);
  }
}

function install (aData, aReason) {
  dump("install");

  let value = "";
  try {
    value = Services.prefs.getCharPref("extensions.bootstrapper.bootstrapURL");
  } catch (e) {}

  let obj = { value: value };
  if (Services.prompt.prompt(null, "Enter chrome.manifest URL", "URL to download and install as chrome.manifest.", obj, null, {})) {
    Services.prefs.setCharPref("extensions.bootstrapper.bootstrapURL", obj.value);
  }
}

function uninstall (aData, aReason) {
  dump("uninstall");
}
