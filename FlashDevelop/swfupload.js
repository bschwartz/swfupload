/**
 * SWFUpload 0.8.3 Revision 5.2 by Jacob Roberts, April 2007, linebyline.blogspot.com
 * -------- -------- -------- -------- -------- -------- -------- --------
 * SWFUpload is (c) 2006 Lars Huring and Mammon Media and is released under the MIT License:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * See Changelog.txt for version history
 * 
 * + Added ServerData event callback
 * = Changed upload_params to query_params
 * + Added post_params
 * + Added PreuploadValidation callback
 * + Added automatic cookie transmission to workaround the Flash browser bug
 * ? Added custom file post name setting
 */

/* *********** */
/* Constructor */
/* *********** */

var SWFUpload = function (init_settings) {
    // Remove background flicker in IE (read this: http://misterpixel.blogspot.com/2006/09/forensic-analysis-of-ie6.html)
    // This doesn't have anything to do with SWFUpload but can help your UI behave better
    try {
        document.execCommand('BackgroundImageCache', false, true);
    } catch (ex) {
        this.debugMessage(ex);
    }


    try {
        this.settings = {};
        this.movieName = "SWFUpload_" + SWFUpload.movieCount++;
        this.movieElement = null;

        // Setup global control tracking
        SWFUpload.instances[this.movieName] = this;

        // Load the settings.  Load the Flash movie.
        this.initSettings(init_settings);
        this.loadFlash();

        if (this.debug_enabled)  {
            this.displayDebugInfo();
        }

    } catch (ex) {
        this.debugMessage(ex);
    }
};

/* *************** */
/* Static thingies */
/* *************** */
SWFUpload.instances = {};
SWFUpload.movieCount = 0;
SWFUpload.ERROR_CODE_HTTP_ERROR               = -10;
SWFUpload.ERROR_CODE_MISSING_UPLOAD_TARGET    = -20;
SWFUpload.ERROR_CODE_IO_ERROR                 = -30;
SWFUpload.ERROR_CODE_SECURITY_ERROR           = -40;
SWFUpload.ERROR_CODE_FILE_EXCEEDS_SIZE_LIMIT  = -50;
SWFUpload.ERROR_CODE_ZERO_BYTE_FILE           = -60;
SWFUpload.ERROR_CODE_UPLOAD_LIMIT_EXCEEDED    = -70;
SWFUpload.ERROR_CODE_UPLOAD_FAILED            = -80;
SWFUpload.ERROR_CODE_QUEUE_LIMIT_EXCEEDED     = -90;
SWFUpload.ERROR_CODE_SPECIFIED_FILE_NOT_FOUND = -100;
SWFUpload.ERROR_CODE_INVALID_FILETYPE         = -110;

/* ***************** */
/* Instance Thingies */
/* ***************** */
// init is a private method that ensures that all the object settings are set, getting a default value if one was not assigned.

SWFUpload.prototype.initSettings = function (init_settings) {

    this.addSetting("control_id", this.movieName, "");

    // UI setting
    this.addSetting("ui_function",           init_settings.ui_function,           null);
    this.addSetting("ui_container_id",       init_settings.ui_container_id,       "");
    this.addSetting("degraded_container_id", init_settings.degraded_container_id, "");

    // Upload backend settings
    this.addSetting("upload_target_url", init_settings.upload_target_url, "");
    this.addSetting("file_post_name",    init_settings.file_post_name,    "Filedata");
    this.addSetting("post_params",       init_settings.post_params,       {});

    // Flags
    this.addSetting("begin_upload_on_queue",  init_settings.begin_upload_on_queue,  true);
    this.addSetting("validate_files",         init_settings.validate_files,         false);

    // File Settings
	this.addSetting("file_types",             init_settings.file_types,             "*.gif;*.jpg;*.png");
    this.addSetting("file_types_description", init_settings.file_types_description, "Common Web Image Formats (gif, jpg, png)");
    this.addSetting("file_size_limit",        init_settings.file_size_limit,        "1024");
    this.addSetting("file_upload_limit",      init_settings.file_upload_limit,      "0");
    this.addSetting("file_queue_limit",       init_settings.file_queue_limit,       "0");

    // Flash Settings
    this.addSetting("flash_url",          init_settings.flash_url,          "swfupload.swf");
    this.addSetting("flash_container_id", init_settings.flash_container_id, "");
    this.addSetting("flash_width",        init_settings.flash_width,        "1px");
    this.addSetting("flash_height",       init_settings.flash_height,       "1px");
    this.addSetting("flash_color",        init_settings.flash_color,        "#FFFFFF");

    // Debug Settings
    this.addSetting("debug_enabled", init_settings.debug,  false);
    this.debug_enabled = this.getSetting("debug_enabled");

    // Event Handlers
    this.flashReady      = this.retrieveSetting(init_settings.flash_ready_handler,      this.flashReady);
    this.dialogCancelled = this.retrieveSetting(init_settings.dialog_cancelled_handler, this.dialogCancelled);
    this.fileQueued      = this.retrieveSetting(init_settings.file_queued_handler,      this.fileQueued);
    this.fileValidation  = this.retrieveSetting(init_settings.file_validation_handler,  this.fileValidation);
    this.fileProgress    = this.retrieveSetting(init_settings.file_progress_handler,    this.fileProgress);
    this.fileCancelled   = this.retrieveSetting(init_settings.file_cancelled_handler,   this.fileCancelled);
    this.fileComplete    = this.retrieveSetting(init_settings.file_complete_handler,    this.fileComplete);
    this.queueStopped    = this.retrieveSetting(init_settings.queue_stopped_handler,    this.queueStopped);
    this.queueComplete   = this.retrieveSetting(init_settings.queue_complete_handler,   this.queueComplete);
    this.error           = this.retrieveSetting(init_settings.error_handler,            this.error);
    this.debug           = this.retrieveSetting(init_settings.debug_handler,            this.debug);
};

// loadFlash is a private method that generates the HTML tag for the Flash
// It then adds the flash to the "target" or to the body and stores a
// reference to the flash element in "movieElement".
SWFUpload.prototype.loadFlash = function () {
    var html, container, target_element, flash_container_id;
    html = this.getFlashHTML();

    // Build the DOM nodes to hold the flash;
    container = document.createElement("div");
    container.style.width = this.getSetting("flash_width");
    container.style.height = this.getSetting("flash_height");

    flash_container_id = this.getSetting("flash_container_id");
    if (typeof(flash_container_id) === "string" && flash_container_id !== "") {
        target_element = document.getElementById(flash_container_id);
    }
    // If the target wasn't found use the "BODY" element
    if (typeof(target_element) === "undefined" || target_element === null) {
        target_element = document.getElementsByTagName("body")[0];
    }
    // If all else fails then give up
    if (typeof(target_element) === "undefined" || target_element === null) {
        this.debugMessage('Could not find an element to add the Flash too. Failed to find element for "flash_container_id" or the BODY element.');
        return false;
    }

    target_element.appendChild(container);

    container.innerHTML = html;	// Using innerHTML is non-standard but well supported and is easier than building a DOM object for the embed/object tags

    this.movieElement = document.getElementById(this.movieName);    // Save a reference to the flash node so we can make calls to it.

    // Fix IEs "Flash can't callback when in a form" issue (http://www.extremefx.com.ar/blog/fixing-flash-external-interface-inside-form-on-internet-explorer)
    if (typeof(window[this.movieName]) === "undefined" || window[this.moveName] !== this.movieElement) {
        window[this.movieName] = this.movieElement;
    }
	
};

// Generates the embed/object tags needed to embed the flash in to the document
SWFUpload.prototype.getFlashHTML = function () {
    var html = "";

    // Create Mozilla Embed HTML
    if (navigator.plugins && navigator.mimeTypes && navigator.mimeTypes.length) {
        // Build the basic embed html
        html = '<embed type="application/x-shockwave-flash" src="' + this.getSetting("flash_url") + '" width="' + this.getSetting("flash_width") + '" height="' + this.getSetting("flash_height") + '"';
        html += ' id="' + this.movieName + '" name="' + this.movieName + '" ';
        html += 'bgcolor="' + this.getSetting("flash_color") + '" quality="high" menu="false" flashvars="';

        html += this.getFlashVars();

        html += '" />';

    // Create IE Object HTML
    } else {

        // Build the basic Object tag
        html = '<object id="' + this.movieName + '" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" width="' + this.getSetting("flash_width") + '" height="' + this.getSetting("flash_height") + '">';
        html += '<param name="movie" value="' + this.getSetting("flash_url") + '">';

        html += '<param name="bgcolor" value="' + this.getSetting("flash_color") + '" />';
        html += '<param name="quality" value="high" />';
        html += '<param name="menu" value="false" />';

        html += '<param name="flashvars" value="';

        html += this.getFlashVars();

        html += '" /></object>';
    }

    return html;
};

// This private method builds the parameter string that will be passed
// to flash.
SWFUpload.prototype.getFlashVars = function () {
    // Add the cookies to the backend string
    var upload_target_url = this.getSetting("upload_target_url");
    var param_string = this.buildParamString();

    // Build the parameter string
    var html = "";
    html += "controlID=" + encodeURIComponent(this.getSetting("control_id"));
    html += "&uploadTargetURL=" + encodeURIComponent(upload_target_url);
    html += "&params=" + encodeURIComponent(param_string);
	html += "&filePostName=" + encodeURIComponent(this.getSetting("file_post_name"));
    html += "&beginUploadOnQueue=" + encodeURIComponent(this.getSetting("begin_upload_on_queue"));
    html += "&fileValidation=" + encodeURIComponent(this.getSetting("file_validation"));
    html += "&fileTypes=" + encodeURIComponent(this.getSetting("file_types"));
    html += "&fileTypesDescription=" + encodeURIComponent(this.getSetting("file_types_description"));
    html += "&fileSizeLimit=" + encodeURIComponent(this.getSetting("file_size_limit"));
    html += "&fileUploadLimit=" + encodeURIComponent(this.getSetting("file_upload_limit"));
    html += "&fileQueueLimit=" + encodeURIComponent(this.getSetting("file_queue_limit"));
    html += "&debugEnabled=" + encodeURIComponent(this.getSetting("debug_enabled"));

    return html;
};

SWFUpload.prototype.buildParamString = function () {
    var post_params = this.getSetting("post_params");
    var param_string_pairs = [];
    var i, value, name;

    // Retrieve the user defined parameters
    if (typeof(post_params) === "object") {
        for (name in post_params) {
            if (post_params.hasOwnProperty(name)) {
                if (typeof(post_params[name]) === "string" /*&& upload_params[name] != ""*/) {
                    param_string_pairs.push(encodeURIComponent(name) + "=" + encodeURIComponent(post_params[name]));
                }
            }
        }
    }

    return param_string_pairs.join("&");
};

// This private method "loads" the UI.  If a target was specified then it is assumed that "display: none" was set and
// it does a "display: block" so the UI is shown.  Then if a degraded_target is specified it hides it by setting "display: none"
// If you want SWFUpload to do something else then provide a "ui_function" setting and that will be called instead.
SWFUpload.prototype.showUI = function () {
    var ui_container_id, ui_target, degraded_container_id, degraded_target;
    try {
        ui_container_id = this.getSetting("ui_container_id");

        if (ui_container_id !== "") {
            ui_target = document.getElementById(ui_container_id);
            if (ui_target !== null) {
                ui_target.style.display = "block";

                // Now that the UI has been taken care of hide the degraded UI
                degraded_container_id = this.getSetting("degraded_container_id");
                if (degraded_container_id !== "") {
                    degraded_target = document.getElementById(degraded_container_id);
                    if (degraded_target !== null) {
                        degraded_target.style.display = "none";
                    }
                }
            }
        }

    } catch (ex) {
        this.debugMessage(ex);
    }
};

// Saves a setting.  If the value given is undefined or null then the default_value is used.
SWFUpload.prototype.addSetting = function (name, value, default_value) {
    if (typeof(value) === "undefined" || value === null) {
        this.settings[name] = default_value;
    } else {
        this.settings[name] = value;
    }

    return this.settings[name];
};

// Gets a setting.  Returns null if it wasn't found.
SWFUpload.prototype.getSetting = function (name) {
    if (typeof(this.settings[name]) === "undefined") {
        return "";
    } else {
        return this.settings[name];
    }
};

// Gets a setting, if the setting is undefined then return the default value
// This does not affect or use the interal setting object.
SWFUpload.prototype.retrieveSetting = function (value, default_value) {
    if (typeof(value) === "undefined" || value === null) {
        return default_value;
    } else {
        return value;
    }
};


// This method is used when debugging is enabled.
// It loops through all the settings and displays
// them in the debug Console.
SWFUpload.prototype.displayDebugInfo = function () {
    var key, debug_message = "";

    debug_message += "----- DEBUG OUTPUT ----\nID: " + this.movieElement.id + "\n";

	debug_message += this.outputObject(this.settings);
	
    debug_message += "----- DEBUG OUTPUT END ----\n";
    debug_message += "\n";

    this.debugMessage(debug_message);
};
SWFUpload.prototype.outputObject = function (object, prefix) {
	var output = "";
	
	if (typeof(prefix) !== "string") {
		prefix = "";
	}
	if (typeof(object) !== "object") {
		return "";
	}
	
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            if (typeof(object[key]) === "object") {
				output += (prefix + key + ": { \n" + this.outputObject(object[key], "\t" + prefix) + prefix + "}" + "\n");
			} else {
				output += (prefix + key + ": " + object[key] + "\n");
			}
        }
    }
	
	return output;
};

// Sets the UploadTargetURL. To commit the change you must call UpdateUploadStrings.
SWFUpload.prototype.setUploadTargetURL = function (url) {
    if (typeof(url) === "string") {
        return this.addSetting("upload_target_url", url, "");
    } else {
        return false;
    }
};
// Sets the upload params object. To commit the change you must call UpdateUploadStrings.
SWFUpload.prototype.setPostParams = function (param_object) {
    if (typeof(param_object) === "object") {
        return this.addSetting("post_params", param_object, {});
    } else {
        return false;
    }
};

/* *****************************
    -- Flash control methods --
    Your UI should use these
    to operate SWFUpload
   ***************************** */

SWFUpload.prototype.browse = function () {
    if (typeof(this.movieElement) !== "undefined" && typeof(this.movieElement.Browse) === "function") {
        try {
            this.movieElement.Browse();
        }
        catch (ex) {
            this.debugMessage("Could not call browse: " + ex);
        }
    } else {
        this.debugMessage("Could not find Flash element");
    }

};

// Begins the uploads (if begin_upload_on_queue is disabled)
// The file_id is optional.  If specified only that file will be uploaded.  If not specified SWFUpload will
// begin to process the queue.
SWFUpload.prototype.startUpload = function (file_id) {
    if (typeof(this.movieElement) !== "undefined" && typeof(this.movieElement.StartUpload) === "function") {
        try {
            this.movieElement.StartUpload(file_id);
        }
        catch (ex) {
            this.debugMessage("Could not call StartUpload: " + ex);
        }
    } else {
        this.debugMessage("Could not find Flash element");
    }

};

// Cancels the current uploading item.  If no item is uploading then nothing happens.
SWFUpload.prototype.cancelUpload = function (file_id) {
    if (typeof(this.movieElement) !== "undefined" && typeof(this.movieElement.CancelUpload) === "function") {
        try {
            this.movieElement.CancelUpload(file_id);
        }
        catch (ex) {
            this.debugMessage("Could not call CancelUpload");
        }
    } else {
        this.debugMessage("Could not find Flash element");
    }

};

// Cancels all the files in the queue.  Including any current uploads.
SWFUpload.prototype.cancelQueue = function () {
    if (typeof(this.movieElement) !== "undefined" && typeof(this.movieElement.CancelQueue) === "function") {
        try {
            this.movieElement.CancelQueue();
        }
        catch (ex) {
            this.debugMessage("Could not call CancelQueue");
        }
    } else {
        this.debugMessage("Could not find Flash element");
    }

};

// Stops the current upload.  The file is re-queued.  If nothing is currently uploading then nothing happens.
SWFUpload.prototype.stopUpload = function () {
    if (typeof(this.movieElement) !== "undefined" && typeof(this.movieElement.StopUpload) === "function") {
        try {
            this.movieElement.StopUpload();
        }
        catch (ex) {
            this.debugMessage("Could not call StopUpload");
        }
    } else {
        this.debugMessage("Could not find Flash element");
    }

};

// Updates the upload url and post parameters in the Flash Movie
// This must be called in order for changes made to the upload_target_url and post_params to take effect.
SWFUpload.prototype.setUploadSettings = function () {
    if (typeof(this.movieElement) !== "undefined" && typeof(this.movieElement.SetUploadSettings) === "function") {
        try {
            this.movieElement.SetUploadSettings(this.getSetting("upload_target_url"), this.getSetting("post_params"));
        }
        catch (ex) {
            this.debugMessage("Could not call SetUploadStrings");
        }
    } else {
        this.debugMessage("Could not find Flash element in setUploadSettings");
    }

};

SWFUpload.prototype.addFilePostParam = function (file_id, name, value) {
    if (typeof(this.movieElement) !== "undefined" && typeof(this.movieElement.AddFilePostParam) === "function") {
        try {
            return this.movieElement.AddFilePostParam(file_id, name, value);
        }
        catch (ex) {
            this.debugMessage("Could not call addFileParam");
        }
    } else {
        this.debugMessage("Could not find Flash element");
    }
};

SWFUpload.prototype.removeFilePostParam = function (file_id, name) {
    if (typeof(this.movieElement) !== "undefined" && typeof(this.movieElement.RemoveFilePostParam) === "function") {
        try {
            return this.movieElement.RemoveFilePostParam(file_id, name);
        }
        catch (ex) {
            this.debugMessage("Could not call addFileParam");
        }
    } else {
        this.debugMessage("Could not find Flash element");
    }

};

/* *******************************
    Default Event Handlers
******************************* */
// This is the callback method that the Flash movie will call when it has been loaded and is ready to go.
// Calling this or showUI "manually" bypass the Flash Detection built in to SWFUpload.
// FlashReady should not generally be overwritten. Use a ui_function setting if you want to control the UI loading after the flash has loaded.
SWFUpload.prototype.flashReady = function () {
    var ui_function;
    try {
        this.debugMessage("Flash called back and is ready.");
		
		this.setUploadSettings();	// Send all the parameters

        ui_function = this.getSetting("ui_function");
        if (typeof(ui_function) === "function") {
            ui_function.apply(this);
        } else {
            this.showUI();
        }
    } catch (ex) {
        this.debugMessage(ex);
    }
};

// Called when the user cancels the File browser window.
SWFUpload.prototype.dialogCancelled = function () {
    this.debugMessage("browse Dialog Cancelled.");
};

// Called once for each file the user selects
SWFUpload.prototype.fileQueued = function (file) {
    this.debugMessage("File Queued: " + file.id);
};

// Called before a file is queued if the validateFiles setting is true.  This function
// must return true or false to indicate to flash whether the file should be
// uploaded.
SWFUpload.prototype.fileValidation = function (file) {
    this.debugMessage("File Validation: " + file.id);
	
	return true;
};

// Called during upload as the file progresses
SWFUpload.prototype.fileProgress = function (file, bytes_complete) {
    this.debugMessage("File Progress: " + file.id + ", Bytes: " + bytes_complete);
};

// Called after a file is cancelled
SWFUpload.prototype.fileCancelled = function (file) {
    this.debugMessage("File Cancelled: " + file.id);
};

// Called when a file upload has completed
SWFUpload.prototype.fileComplete = function (file, server_data) {
    this.debugMessage("File Complete: " + file.id);
	if (typeof(server_data) !== "undefined") {
		this.debugMessage("Upload Response Data: " + server_data);
	}
};

// Called when at least 1 file has been uploaded and there are no files remaining in the queue.
SWFUpload.prototype.queueComplete = function (file_upload_count) {
    this.debugMessage("Queue Complete. Files Uploaded:" + file_upload_count);
};

// Called when the upload is stopped.
SWFUpload.prototype.queueStopped = function (file) {
    this.debugMessage("Queue Stopped. File Stopped:" + file.id);
};

// Called by SWFUpload JavaScript and Flash flash functions when debug is enabled
SWFUpload.prototype.debug = function (message) {
    this.debugMessage(message);
};

// Called when an error occurs. Use errcode to determine which error occurred.
SWFUpload.prototype.error = function (errcode, file, msg) {
    try {
        switch (errcode) {
        case SWFUpload.ERROR_CODE_HTTP_ERROR:
            this.debugMessage("Error Code: HTTP Error, File name: " + file.name + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_MISSING_UPLOAD_TARGET:
            this.debugMessage("Error Code: No backend file, File name: " + file.name + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_IO_ERROR:
            this.debugMessage("Error Code: IO Error, File name: " + file.name + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_SECURITY_ERROR:
            this.debugMessage("Error Code: Security Error, File name: " + file.name + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_FILE_EXCEEDS_SIZE_LIMIT:
            this.debugMessage("Error Code: File too big, File name: " + file.name + ", File size: " + file.size + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_ZERO_BYTE_FILE:
            this.debugMessage("Error Code: Zero Byte File, File name: " + file.name + ", File size: " + file.size + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_UPLOAD_LIMIT_EXCEEDED:
            this.debugMessage("Error Code: Upload limit reached, File name: " + file.name + ", File size: " + file.size + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_QUEUE_LIMIT_EXCEEDED:
            this.debugMessage("Error Code: Upload limit reached, File name: " + file.name + ", File size: " + file.size + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_UPLOAD_FAILED:
            this.debugMessage("Error Code: Upload Initialization exception, File name: " + file.name + ", File size: " + file.size + ", Message: " + msg);
            break;
        case SWFUpload.ERROR_CODE_SPECIFIED_FILE_NOT_FOUND:
            this.debugMessage("Error Code: File ID specified for upload was not found, Message: " + msg);
            break;
		case SWFUpload.ERROR_CODE_INVALID_FILETYPE:
			this.debugMessage("Error Code: File extension is not allowed, Message: " + msg);
			break;
        default:
            this.debugMessage("Error Code: Unhandled error occured. Errorcode: " + errcode);
        }
    } catch (ex) {
        this.debugMessage(ex);
    }
};

/* **********************************
    Debug Console
    The debug console is a self contained, in page location
    for debug message to be sent.  The Debug Console adds
    itself to the body if necessary.

    The console is automatically scrolled as messages appear.
   ********************************** */
SWFUpload.prototype.debugMessage = function (message) {
    var exception_message, exception_values;

    if (this.debug_enabled) {
        if (typeof(message) === "object" && typeof(message.name) === "string" && typeof(message.message) === "string") {
            exception_message = "";
            exception_values = [];
            for (var key in message) {
                exception_values.push(key + ": " + message[key]);
            }
            exception_message = exception_values.join("\n");
            exception_values = exception_message.split("\n");
            exception_message = "EXCEPTION: " + exception_values.join("\nEXCEPTION: ");
            SWFUpload.Console.writeLine(exception_message);
        } else {
            SWFUpload.Console.writeLine(message);
        }
    }
};

SWFUpload.Console = {};
SWFUpload.Console.writeLine = function (message) {
    var console, documentForm;

    try {
        console = document.getElementById("SWFUpload_Console");

        if (!console) {
            documentForm = document.createElement("form");
            document.getElementsByTagName("body")[0].appendChild(documentForm);

            console = document.createElement("textarea");
            console.id = "SWFUpload_Console";
            console.style.fontFamily = "monospace";
            console.setAttribute("wrap", "off");
            console.wrap = "off";
            console.style.overflow = "auto";
            console.style.width = "700px";
            console.style.height = "350px";
            console.style.margin = "5px";
            documentForm.appendChild(console);
        }

        console.value += message + "\n";

        console.scrollTop = console.scrollHeight - console.clientHeight;
    } catch (ex) {
        alert("Exception: " + ex.name + " Message: " + ex.message);
    }
};
