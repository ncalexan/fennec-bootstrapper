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

* Source:

  https://github.com/thebnich/fennec-bootstrapper

* XPI:

  http://people.mozilla.com/~bnicholson/bootstrapper.xpi

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

1) Modify `remote/chrome.manifest` and populate `remote/` with chrome
   resources.

   You might want to link `remote/content` to
   `mobile/android/chrome/content` or similar.

2) Copy the contents of `remote/` to your web server.

   Ideally, this will be a "live" working copy so you don't need to
   copy files every time you make a change.

   If your Firefox and development machine are on the same network,
   you can serve the `remote/` directory using any web server
   software.  Or you can use ssh to remote port forward a visible end
   point to your local web server.  Or you can use `lsyncd` to
   synchronize your local `remote/` directory with your web server.
   Or Dropbox.

3) Download the extension from http://people.mozilla.com/~bnicholson/bootstrapper.xpi

4) When prompted, enter the URL to a chrome.manifest file
   (e.g., http://people.mozilla.com/~bnicholson/bootstrapped/remote/chrome.manifest).

6) At this point, you should be running bootstrapped files from your web server.

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

7) To download and register a fresh chrome manifest, you can disable
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