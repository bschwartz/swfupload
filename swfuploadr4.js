

/**
 * SWFUpload 0.8.3 Revision 4 by Jacob Roberts, April 2007, linebyline.blogspot.com
 *
 * = Cleaned up code.  Added comments. Reorganized. Added more try..catches. Removed old unused methods.
 * - Removed the 'create_ui' setting.  The UI is now completely up to the developer.
 * + Added upload_backend_cookies setting. Can set a string, or array of cookie names. These values will be
 *    passed as part of the upload_backend url
 *
 * = Changed QueueComplete event to only fire if at least one file has been successfully uploaded.
 * + Added "Stop Upload" feature.
 * = Revised the FLA file to clean things up, better handle errors, etc.
 * = Fixed a bug where cancelling the first upload would cause the remaining uploads to fire before calling
 *    "startUpload". This change is in the FLA.
 *
 * + Fixed a bug in the upload.swf that prevented further file processing after an error is returned.
 * + Added uploadLimit variable.  Only complete uploads are counted. Once the limit is reached the flash
 *      movie will not upload any more files. (The ability to select or queue many files is not affected
 *      by the upload limit)
 * + Added cancelQueue and cancelUpload methods.
 * + Added ID property to the FileObj in the upload.swf
 * + Added Upload and Queue settings
 * + Added methods for generating the flash HTML and inserting it into the DOM.
 * - Removed SWFObject
 * + Updated the upload.swf and added the "flashReady" event.  This will only call back
 *		for Flash 8 and above.  With this we don't need a flash version detect script.
 *		The script initializes the Flash then waits for the Callback to init the UI.
 * + Added seperate ui_target, degraded_target, create_ui settings. This allows fine control
 *  	over what parts of the GUI the script displays and hides
 * 
 * + Changed from a Static Class to an Instance (changed code/class structure)
 * + Added "flash_version" setting.  When set to zero the version check is skipped
 * + Added Debug Console.  The Instance class can't do document.write.
 * = De-obfuscated SWFObject a bit
 * - Removed standalone mode.
 * + Added "ui_target" setting. When non-blank the link is added.
 * + Added "flash_target" setting.  When blank the flash is appended to the <body> tag
 *		= This fixes ASP.Net not allowing the flash to be added to the Form
 * + Added error checking to the callSWF method
 *
 *
 * -------- -------- -------- -------- -------- -------- -------- --------
 * SWFUpload 0.7: Flash upload dialog - http://profandesign.se/swfupload/
 *
 * SWFUpload is (c) 2006 Lars Huring and Mammon Media and is released under the MIT License:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * VERSION HISTORY
 * 0.5 - First release
 *
 * 0.6 - 2006-11-24
 * - Got rid of flash overlay
 * - SWF size reduced to 840b
 * - CSS-only styling of button
 * - Add upload to links etc.
 *
 * 0.7 - 2006-11-27
 * - Added filesize param and check in SWF
 *
 * 0.7.1 - 2006-12-01
 * - Added link_mode param for standalone links
 * if set to "standalone", createElement("a") won't run.
 * - Added link_text param if css isn't needed.
 * - Renamed cssClass to css_class for consistency
 *
 */

/* *********** */
/* Constructor */
/* *********** */
	function SWFUpload(settings) {
		// Remove background flicker in IE
		try {
		  document.execCommand('BackgroundImageCache', false, true);
		} catch(e) {}

		try {
			// Generate the tags ID
			this.movieName = "SWFUpload_" + SWFUpload.movieCount++;

			// Load the settings.  Load the Flash movie.
			this.init(settings);
			this.loadFlash();
			
			if (this.debug) this.DisplayDebugInfo();

			// Now nothing happens until Flash calls back to our flash_ready handler
		catch (ex) {
		
		}
	}

/* *************** */
/* Static thingies */
/* *************** */

	SWFUpload.movieCount = 0;

	// Default error handling.
	SWFUpload.handleErrors = function(errcode, file, msg) {
		try {
			switch(errcode) {
				
				case -10:	// HTTP error
					Console.Writeln("Error Code: HTTP Error, File name: " + file.name + ", Message: " + msg);
					break;
				
				case -20:	// No backend file specified
					Console.Writeln("Error Code: No backend file, File name: " + file.name + ", Message: " + msg);
					break;
				
				case -30:	// IOError
					Console.Writeln("Error Code: IO Error, File name: " + file.name + ", Message: " + msg);
					break;
				
				case -40:	// Security error
					Console.Writeln("Error Code: Security Error, File name: " + file.name + ", Message: " + msg);
					break;

				case -50:	// Filesize too big
					Console.Writeln("Error Code: File too big, File name: " + file.name + ", File size: " + file.size + ", Message: " + msg);
					break;
			
				case -60:	// Upload limit reached
					Console.Writeln("Error Code: Upload limit reached, File name: " + file.name + ", File size: " + file.size + ", Message: " + msg);
					break;
				case -70:	// Upload Initialization exception
					Console.Writeln("Error Code: Upload Initialization exception, File name: " + file.name + ", File size: " + file.size + ", Message: " + msg);
			}
		} catch (ex) {}
	};
	
	
/* ***************** */
/* Instance Thingies */
/* ***************** */
	// init is a private method that ensures that all the object settings are set or get a default value
	SWFUpload.prototype.init = function(settings) {
		this.settings = [];

		// UI setting
		this.addSetting("ui_target", settings["ui_target"], "");
		this.addSetting("degraded_target", settings["degraded_target"], "");
		this.addSetting("link_css_class", settings["link_css_class"], "SWFUploadLink")
		this.addSetting("link_text", settings["link_text"], "Upload File");

		// Upload backend settings
		this.addSetting("upload_backend", settings["upload_backend"], "");
		this.addSetting("upload_backend_cookies", settings["upload_backend_cookies"], "");
		
		// Event handlers
		this.addSetting("upload_ready_callback", settings["upload_ready_callback"], "");
		this.addSetting("upload_start_callback", settings["upload_start_callback"], "");
		this.addSetting("upload_complete_callback", settings["upload_complete_callback"],  "");
		this.addSetting("upload_progress_callback", settings["upload_progress_callback"],  "");
		this.addSetting("upload_dialog_cancel_callback", settings["upload_dialog_cancel_callback"],  "");
		this.addSetting("upload_error_callback", settings["upload_error_callback"], "SWFUpload.handleErrors");
		this.addSetting("upload_queue_complete_callback", settings["upload_queue_complete_callback"],  "");
		this.addSetting("upload_cancel_callback", settings["upload_cancel_callback"],  "");
		
		// Upload settings
		this.addSetting("begin_uploads_immediately", settings["begin_uploads_immediately"], true);
		this.addSetting("allowed_filetypes", settings["allowed_filetypes"], "*.gif;*.jpg;*.png");
		this.addSetting("allowed_filesize", settings["allowed_filesize"], "1000");
		this.addSetting("upload_limit", settings["upload_limit"], "1000");

		// Flash Settings
		this.addSetting("flash_path", settings["flash_path"], "upload.swf");
		this.addSetting("flash_target", settings["flash_target"], "");
		this.addSetting("flash_width", settings["flash_width"], "1px");
		this.addSetting("flash_height", settings["flash_height"], "1px");
		this.addSetting("flash_color", settings["flash_color"], "#000000");
		
		// Debug Settings
		this.addSetting("debug", settings["debug"],  false);
		if (this.getSetting("debug")) {
			this.addSetting("debug_callback", settings["debug_callback"],  "Console.Writeln");
		} else {
			this.addSetting("debug_callback", "",  "");
		}

		this.debug = this.getSetting("debug");
		
	};

	// loadFlash is a private method that generates the HTML tag for the Flash
	// It then adds the flash to the "target" or to the body and stores a 
	// reference to the flash element in "movieElement".
	SWFUpload.prototype.loadFlash = function() {
		var html = "";
		// Create Mozilla Embed HTML
		if (navigator.plugins && navigator.mimeTypes && navigator.mimeTypes.length) {
			// Build the basic embed html
			html = '<embed type="application/x-shockwave-flash" src="' + this.getSetting("flash_path") + '" width="' + this.getSetting("flash_width") + '" height="' + this.getSetting("flash_height") + '"';
			html += ' id="' + this.movieName + '" name="' + this.movieName + '" ';
			html += 'bgcolor="' + this.getSetting["flash_color"] + '" quality="high" wmode="transparent" menu="false" flashvars="';
			
			html += this._getFlashVars();
			
			html += '" />';
		
		// Create IE Object HTML
		} else {
		
			// Build the basic Object tag
			html = '<object id="' + this.movieName + '" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" width="' + this.getSetting("flash_width") + '" height="' + this.getSetting("flash_height") + '">';
			html += '<param name="movie" value="' + this.getSetting("flash_path") + '" />';
			
			html += '<param name="bgcolor" value="#000000" />';
			html += '<param name="quality" value="high" />';
			html += '<param name="wmode" value="transparent" />';
			html += '<param name="menu" value="false" />';
			
			html += '<param name="flashvars" value="'
			
			html += this._getFlashVars();
			
			html += '" /></object>';
		}
		
		
		// Build the DOM nodes to hold the flash;
		var container = document.createElement("div");
		container.style.width = "0px";
		container.style.height = "0px";
		container.style.position = "absolute";
		container.style.top = "0px";
		container.style.left = "0px";

		var target_element;
		var flash_target_id = this.getSetting("flash_target");
		if (flash_target_id != "") {
			target_element = document.getElementById(flash_target_id);
		}
		if (typeof(target_element) == "undefined" || target_element == null) {
			target_element = document.getElementsByTagName("body")[0];
		}
		if (typeof(target_element) == "undefined" || target_element == null) {
			return false;
		}
		
		target_element.appendChild(container);

		container.innerHTML = html;
			
		this.movieElement = document.getElementById(this.movieName);

	};

	// This private method builds the parameter string that will be passed
	// to flash.
	SWFUpload.prototype._getFlashVars = function() {
		// Add the cookies to the backend string
		var upload_backend = this.getSetting("upload_backend");
		var upload_cookies = this.getSetting("upload_backend_cookies");
		if (upload_backend != null && upload_backend != "" && upload_cookies != null && typeof(upload_cookies) != "undefined" && (upload_cookies instanceof Array || upload_cookies instanceof String)) {
			var url_separator = "?";
			if (upload_backend.indexOf("?") != -1) {
				url_separator = "&";
			}
			
			if (upload_cookies instanceOf Array) {
				var upload_cookie_pairs = new Array();
				for (var i=0; i < upload_cookies.length; i++) {
					var value = Cookie.Get(upload_cookies[i]);
					if (value != "") {
						upload_cookie_pairs.push(upload_cookies[i] + "=" + encodeURIComponent(value));
					}
				}
				
				upload_backend += url_separator + upload_cookie_pairs.join("&");
			} else {
				var value = Cookie.Get(upload_cookies);
				if (value != "") {
					upload_backend += url_separator + upload_cookies + "=" + encodeURIComponent(value);
				}
			}
		}
		
		// Build the parameter string		
		var html = "";
		html += "uploadBackend=" + encodeURIComponent(this.getSetting("upload_backend"));
		html += "&uploadReadyCallback=" + this.getSetting("upload_ready_callback");
		html += "&uploadStartCallback=" + this.getSetting("upload_start_callback");
		html += "&uploadProgressCallback=" + this.getSetting("upload_progress_callback");
		html += "&uploadCompleteCallback=" + this.getSetting("upload_complete_callback");
		html += "&uploadDialogCancelCallback=" + this.getSetting("upload_dialog_cancel_callback");
		html += "&uploadErrorCallback=" + this.getSetting("upload_error_callback");
		html += "&uploadCancelCallback=" + this.getSetting("upload_cancel_callback");
		html += "&uploadQueueCompleteCallback=" + this.getSetting("upload_queue_complete_callback");
		html += "&debugCallback=" + this.getSetting("debug_callback");
		html += "&beginUploadsImmediately=" + this.getSetting("begin_uploads_immediately");
		html += "&allowedFiletypes=" + this.getSetting("allowed_filetypes");
		html += "&allowedFilesize=" + this.getSetting("allowed_filesize");
		html += "&uploadLimit=" + this.getSetting("upload_limit");
		
		return html;
	}
	
	// This is the callback method that the Flash movie will call when it has been loaded and is ready to go.
	// The user shouldn't be able to do any file uploading until after this gets called.
	SWFUpload.prototype.flashReady = function() {
		try {
			if (this.debug) Console.Writeln("Flash called back and is ready.");

			this.showUI();
		} catch (ex) {}
	};
	
	
	// This private method "loads" the UI.  If a target was specified then it is assumed that "display: none" was set and
	// it does a "display: block" so the UI is shown.  Then if a degraded_target is specified it hides it by setting "display: none"
	SWFUpload.prototype.showUI = function() {
		try {

			if(this.getSetting("ui_target") != "") {
				var ui_target = document.getElementById(this.getSetting("ui_target"));
				if (ui_target != null) {
					ui_target.style.display = "block";
				}
			}
			
			if(this.getSetting("degraded_target") != "") {
				var degraded_target = document.getElementById(this.getSetting("degraded_target"));
				if (degraded_target != null) {
					degraded_target.style.display = "none";
				}
			}
			
		} catch (e) { }
	};
	
	// Saves a setting.  If the value given is undefined or null then the default_value is used.
	SWFUpload.prototype.addSetting = function(name, value, default_value) {
		if (typeof(value) == "undefined" || value == null) {
			this.settings[name] = default_value;
		} else {
			this.settings[name] = value;
		}

		return this.settings[name];
	};
	
	// Gets a setting.  Returns null if it wasn't found.
	SWFUpload.prototype.getSetting = function(name) {
		if (typeof(this.settings[name]) == "undefined") {
			return null;
		} else {
			return this.settings[name];
		}
	};


	// This method is used when debugging is enabled.
	// It loops through all the settings and displays
	// them in the debug Console.
	SWFUpload.prototype.DisplayDebugInfo = function() {
		var debug_message = "----- DEBUG OUTPUT ----\n";
		
		debug_message += "ID: " + this.movieElement.id + "\n";
		
		// It's bad to use the for..in with an associative array, but oh well
		for (var key in this.settings) {
			debug_message += key + ": " + this.settings[key] + "\n";
		}
		
		debug_message += "----- DEBUG OUTPUT END ----\n";
		debug_message += "\n";
		
		Console.Writeln(debug_message);
	};


	/* *****************************
	    -- Flash control methods --
	    Your UI should use these
	    to operate SWFUpload
	   ***************************** */

	SWFUpload.prototype.callSWF = function() {
		if (this.movieElement != null) {
			try {
				this.movieElement.uploadFile();
			}
			catch (e) {
				if (this.debug) {
					Console.Writeln("Could not call uploadImage");
				}
			}
		} else { 
			if (this.debug) {
				Console.Writeln("Could not find Flash element");
			}
		}
    };
    
    SWFUpload.prototype.startUpload = function() {
		if (this.movieElement != null) {
			try {
				this.movieElement.startUpload();
			}
			catch (e) {
				if (this.debug) {
					Console.Writeln("Could not call uploadImage");
				}
			}
		} else { 
			if (this.debug) {
				Console.Writeln("Could not find Flash element");
			}
		}
    }
    
	SWFUpload.prototype.cancelUpload = function(file_id) {
		if (this.movieElement != null) {
			try {
				this.movieElement.cancelUpload(file_id);
			}
			catch (e) {
				if (this.debug) {
					Console.Writeln("Could not call cancelUpload");
				}
			}
		} else { 
			if (this.debug) {
				Console.Writeln("Could not find Flash element");
			}
		}
    };
	SWFUpload.prototype.cancelQueue = function() {
		if (this.movieElement != null) {
			try {
				this.movieElement.cancelQueue();
			}
			catch (e) {
				if (this.debug) {
					Console.Writeln("Could not call cancelQueue");
				}
			}
		} else { 
			if (this.debug) {
				Console.Writeln("Could not find Flash element");
			}
		}
    };

	SWFUpload.prototype.stopUpload = function() {
		if (this.movieElement != null) {
			try {
				this.movieElement.stopUpload();
			}
			catch (e) {
				if (this.debug) {
					Console.Writeln("Could not call stopUpload");
				}
			}
		} else { 
			if (this.debug) {
				Console.Writeln("Could not find Flash element");
			}
		}
    };
	





/* **********************************
	Cookies
   ********************************** */
if (typeof Cookie == "undefined") {
	var Cookie = new Object();
}


// Gets a cookie (http://www.w3schools.com/js/js_cookies.asp)
Cookie.Get = function(c_name)
{
	try {
		if (document.cookie.length > 0)
		{
			c_start=document.cookie.indexOf(c_name + "=");
			if (c_start != -1)
			{ 
				c_start = c_start + c_name.length + 1;
				c_end = document.cookie.indexOf(";", c_start);
				if (c_end == -1) c_end = document.cookie.length;
				
				return unescape(document.cookie.substring(c_start, c_end));
			} 
		}
	} catch (ex) { }

	return "";
}


/* **********************************
	Debug Console
   ********************************** */

if (typeof Console == "undefined") {
	var Console = new Object();
}

Console.Writeln = function(value) {
	try {
		var console = document.getElementById("SWFUpload_Console");
		
		if (!console) {
			var documentForm = document.getElementsByTagName("form")[0];
			
			if (!documentForm) {
				documentForm = document.createElement("form");
				document.getElementsByTagName("body")[0].appendChild(documentForm);
			}
			
			console = document.createElement("textarea");
			console.id = "SWFUpload_Console";
			console.style.width = "500px";
			console.style.height = "350px";
			documentForm.appendChild(console);
		}
		
		console.value += value + "\n";
		
		console.scrollTop = console.scrollHeight - console.clientHeight;
	} catch (ex) {}
}

