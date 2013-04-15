Bootstrapper
============

This extension allows you to dynamically load chrome manifests and
chrome resources from a remote location.  This means you don't need to
rebuild to test your changes.  This is especially useful when
developing chrome code for Firefox for Android, since you don't need
to build and deploy a new APK each development iteration.

This add-on is intended for use **only when developing Firefox chrome
UI**, so that developers can modify `chrome://` URLs locally without
having to build, package, and deploy a new Android APK.

* 10 minute screencast at:

  https://vimeo.com/63865441

* XPI at:

  http://people.mozilla.org/~nalexander/fennec-bootstrapper/fennec-bootstrapper.xpi

* Code at:

  https://github.com/ncalexan/fennec-bootstrapper

How it works
------------

When you install the extension, you provide a URL pointing to a
`chrome.manifest` file (as described at
https://developer.mozilla.org/en-US/docs/Chrome_Registration#Instructions_supported_in_bootstrapped_add_ons).

This chrome manifest is downloaded and registered when the add-on
starts (after being installed, enabled, or when Firefox itself
starts).  When the add-on stops (after being uninstalled or disabled),
the chrome manifest is unregistered.  This means you can dynamically
specify chrome resources.

In addition, the add-on provides a custom `bootstrapper://` protocol
which allows to load remote resources as chrome resources.  This means
you can register a chrome override pointing to a resource that will be
dynamically fetched.  This is not usually possible since it opens a
major security hole: remember that chrome resources are privileged.

How to use it
-------------

1) Set up a web-accessible directory somewhere. This can be on a remote web
   server, a local web server (if your Firefox and development machine
   are on the same network), Dropbox, whatever.

2) Copy the `remote/chrome.manifest` file from the github repo (direct link:
   https://raw.github.com/ncalexan/fennec-bootstrapper/master/remote/chrome.manifest)
   and modify it to reference the chrome resources you wish to
   be pulled dynamically. Set the override URLs to point to your web-accessible
   directory from step 1.

3) Copy your modified chrome.manifest file and your chrome resources to
   the web-accessible directory from step 1.

   Ideally, this will be a "live" working copy so you don't need to
   copy files every time you make a change (e.g. using Dropbox).
   Or you can use ssh to remote port forward a visible end
   point to your local web server.  Or you can use `lsyncd` to
   synchronize your local `remote/` directory with your web server.
   The options are numerous.

4) Download the extension from http://people.mozilla.org/~nalexander/fennec-bootstrapper/fennec-bootstrapper.xpi

5) When prompted, enter the URL to the chrome.manifest file.

6) Restart Firefox.

7) At this point, you should be running bootstrapped files from your web server.

   Make a change to a chrome resource (one made visible by your chrome
   manifest), restart Firefox, and (hopefully) see it appear!

   * Example for Firefox Desktop

     Edit `remote/chrome.manifest` to include the line

     ```
     override chrome://browser/content/aboutRobots.xhtml bootstrapper://http://mozilla.org
     ```

     You should find that `about:robots` takes you to your favourite
     non-profit's home page.

   * Example for Firefox for Android

     Edit `remote/chrome.manifest` to include the line

     ```
     override chrome://browser/content/aboutFeedback.xhtml bootstrapper://http://firefox.com
     ```

     You should find that `about:feedback` takes you to the download
     page for your favourite browser.

8) To download and register a fresh chrome manifest, you can disable
   and re-enable the add-on, re-install the add-on, or restart Firefox
   entirely.

   You can disable the add-on to un-register any chrome changes
   downloaded and registered this session.

The `bootstrapped://` custom protocol
-------------------------------------

Short and sweet: `boostrapped://FOO` is rewritten to be `FOO`.  So,
for example,

```
override chrome://browser/content/browser.js boostrapped://http://mydomain.com/content/browser.js
```

will fetch `browser.js` via HTTP.

Notes
-----

* In some cases, the chrome resources are preprocessed by the build
  system. If this is the case, you must run the preprocessor (or
  some equivalent) on the files yourself before uploading them to
  the web server. For example, the script at
  https://github.com/staktrace/moz-scripts/blob/d557643915527a3c9ce2fa52702c87c1036cae19/jscheck,
  when run with Fennec's browser.js as an argument, will output
  an upload-ready file to ~/tmp/check-this.js (this works as of
  2013-04-15; if you are reading this from the future it may be broken).

* Firefox caches downloaded chrome manifests and resources, so you
  will want to configure the web host serving the files to set
  `Cache-Control: no-cache, no-store` or similar.  If you know how to
  prevent `bootstrapped://` resources reading and writing the cache,
  please get in touch!

* The chrome manifest URL is stored in the
  "extensions.bootstrapper.chromeManifestURL" preference.

* Search for "Bootstrapper" in the console log or Android logcat to
  find status and error messages.

* To generate the icon files use ImageMagick:

```
  convert boot.png -resize 48x48 -flop ./extension/icon.png
  convert boot.png -resize 64x64 -flop ./extension/icon64.png
```

  See https://developer.mozilla.org/en-US/docs/Install_Manifests#iconURL.

* Why a bootstrapped add-on, rather than using the Add-on SDK
  (Jetpack)?  It's all about startup timing.  The `startup()` method
  of each add-on is processed before `browser.js` is loaded, but at
  the moment the Add-on SDK waits for the `session-restore-completed`
  message to fire beforing running your `main()` method.  This means
  `browser.js` is not overridden early enough!  I preferred to write
  my own `bootstrap.js`, and forego the niceties of the Add-on SDK,
  rather than ship a modified Add-on SDK add-on.  (Aside: that's why
  this is all in one big file!)

* Can't you do this with chrome.manifests?  Again, It's all about
  startup timing.  The `bootstrapper://` protocol needs to be
  registered before any chrome overrides using it are processed.  The
  protocol is an XPCOM registration, and you can't register XPCOM
  components in a bootstrapped add-on's chrome manifest, so you either
  give up restartless add-ons (boo!) or you do it in code.  Once
  you're registering the protocol in code, you might as well register
  the chrome manifest too.

Acknowledgements
----------------

* Brian Nicholson (@thebnich)

  Brian solved part of this problem by chrome override-ing a modified
  browser.xul and supplying Javascript that dynamically fetched
  browser.js.

* Nick Alexander (@ncalexan)

  Built on Brian's work to dynamically fetch other chrome resources.

* Mike Kaply

  The non-Jetpack, non-bootstrapped add-on described at
  mike.kaply.com/2011/01/18/writing-a-firefox-protocol-handler
  "bootstrapped" this solution.

* Alexandre Poirot (@ochameau)

  The custom protocol handler registration was shamelessly hacked out
  of Alex's
  https://github.com/ochameau/js-object-tracker/blob/master/lib/chrome-protocol.js.

* Irakli Gozalishvili (@Gozala)

  It was helpful to have Irakli's "API for chrome URI registration"
  from https://gist.github.com/Gozala/3493210.

* Dave Townsend (@Mossop)

  Provided valuable suggestions in his customary role as
  irc.mozilla.org/#jetpack guru.
