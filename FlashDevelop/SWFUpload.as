package {
	/*
	* Todo:  
	* 	I've updated the call backs and setting variables.  I've also added a file_status field to the FileItem.
	* I need to update the upload start and complete methods.  I  need to update the internal event handlers.
	* I need to add a method to retrieve the JS file object for any file.  I should look in to using array.splice
	* to remove cancelled files from the array.
	* 
	* I need to update the JS file to match the SWF file.  Add default handlers for the new events.
	*
	* I need to create some "plug-ins" that do UI like v1.0.2 and some handlers to show how to do
	* file validation and queue processing
	* */

	import flash.display.Sprite;
	import flash.net.FileReferenceList;
	import flash.net.FileReference;
	import flash.net.FileFilter;
	import flash.net.URLRequest;
	import flash.net.URLRequestMethod;
	import flash.net.URLVariables;
	import flash.events.*;
	import flash.external.ExternalInterface;
	import flash.system.Security;
	import flash.utils.Timer;

	import FileItem;
	import ExternalCall;

	public class SWFUpload extends Sprite {
		// Cause SWFUpload to start as soon as the movie starts
		public static function main():void
		{
			var SWFUpload:SWFUpload = new SWFUpload();
		}
		
		private const build_number:String = "20071008210000";
		
		// State tracking variables
		private var fileBrowserMany:FileReferenceList = new FileReferenceList();
		private var fileBrowserOne:FileReference = null;	// This isn't set because it can't be reused like the FileReferenceList. It gets setup in the SelectFile method

		private var file_queue:Array = new Array();		// holds a list of all items that are to be uploaded.
		private var current_file_item:FileItem = null;	// the item that is currently being uploaded.

		private var completed_uploads:Number = 0;		// Tracks the uploads that have been completed
		private var queue_errors:Number = 0;			// Tracks files rejected during queueing
		private var upload_errors:Number = 0;			// Tracks files that fail upload
		private var upload_cancelled:Number = 0;		// Tracks number of cancelled files
		private var queued_uploads:Number = 0;			// Tracks the FileItems that are waiting to be uploaded.
		
		private var valid_file_extensions:Array = new Array();// Holds the parsed valid extensions.
		
		// Callbacks
		private var flashReady_Callback:String;
		private var fileDialogStart_Callback:String;
		private var fileQueued_Callback:String;
		private var fileQueueError_Callback:String;
		private var fileDialogComplete_Callback:String;
		
		private var uploadStart_Callback:String;
		private var uploadProgress_Callback:String;
		private var uploadError_Callback:String;
		private var uploadComplete_Callback:String;

		private var fileComplete_Callback:String;
		
		private var debug_Callback:String;
		
		// Values passed in from the HTML
		private var movieName:String;
		private var uploadURL:String;
		private var filePostName:String;
		private var uploadPostObject:Object;
		private var fileTypes:String;
		private var fileTypesDescription:String;
		private var fileSizeLimit:Number;
		private var fileUploadLimit:Number = 0;
		private var fileQueueLimit:Number = 0;
		private var debugEnabled:Boolean;

		// Error code "constants"
		// Queue errors
		private var ERROR_CODE_QUEUE_LIMIT_EXCEEDED:Number 			= -100;
		private var ERROR_CODE_FILE_EXCEEDS_SIZE_LIMIT:Number 		= -110;
		private var ERROR_CODE_ZERO_BYTE_FILE:Number 				= -120;
		private var ERROR_CODE_INVALID_FILETYPE:Number          	= -130;

		// Upload Errors
		private var ERROR_CODE_HTTP_ERROR:Number 					= -200;
		private var ERROR_CODE_MISSING_UPLOAD_URL:Number        	= -210;
		private var ERROR_CODE_IO_ERROR:Number 						= -220;
		private var ERROR_CODE_SECURITY_ERROR:Number 				= -230;
		private var ERROR_CODE_UPLOAD_LIMIT_EXCEEDED:Number			= -240;
		private var ERROR_CODE_UPLOAD_FAILED:Number 				= -250;
		private var ERROR_CODE_SPECIFIED_FILE_ID_NOT_FOUND:Number 	= -260;
		private var ERROR_CODE_FILE_VALIDATION_FAILED:Number		= -270;
		private var ERROR_CODE_FILE_CANCELLED:Number				= -280;
		private var ERROR_CODE_UPLOAD_STOPPED:Number				= -290;

		public function SWFUpload() {
			Security.allowDomain("*");	// Allow uploading to any domain

			// Setup file FileReferenceList events
			this.fileBrowserMany.addEventListener(Event.SELECT, this.Select_Many_Handler);
			this.fileBrowserMany.addEventListener(Event.CANCEL,  this.DialogCancelled_Handler);

			// Get the move name
			this.movieName = root.loaderInfo.parameters.movieName;

			// **Configure the callbacks**
			// The JavaScript tracks all the instances of SWFUpload on a page.  We can access the instance
			// associated with this SWF file using the movieName.  Each callback is accessible by making
			// a call directly to it on our instance.  There is no error handling for undefined callback functions.
			// A developer would have to deliberately remove the default functions,set the variable to null, or remove
			// it from the init function.
			this.flashReady_Callback         = "SWFUpload.instances[\"" + this.movieName + "\"].flashReady";
			this.fileDialogStart_Callback    = "SWFUpload.instances[\"" + this.movieName + "\"].fileDialogStart";
			this.fileQueued_Callback         = "SWFUpload.instances[\"" + this.movieName + "\"].fileQueued";
			this.fileQueueError_Callback     = "SWFUpload.instances[\"" + this.movieName + "\"].fileQueueError";
			this.fileDialogComplete_Callback = "SWFUpload.instances[\"" + this.movieName + "\"].fileDialogComplete";

			this.uploadStart_Callback        = "SWFUpload.instances[\"" + this.movieName + "\"].uploadStart";
			this.uploadProgress_Callback     = "SWFUpload.instances[\"" + this.movieName + "\"].uploadProgress";
			this.uploadError_Callback        = "SWFUpload.instances[\"" + this.movieName + "\"].uploadError";
			this.uploadComplete_Callback     = "SWFUpload.instances[\"" + this.movieName + "\"].uploadComplete";

			this.fileComplete_Callback       = "SWFUpload.instances[\"" + this.movieName + "\"].fileComplete";

			this.debug_Callback              = "SWFUpload.instances[\"" + this.movieName + "\"].debug";

			// Get the Flash Vars
			this.uploadURL = root.loaderInfo.parameters.uploadURL;
			this.filePostName = root.loaderInfo.parameters.filePostName;
			this.fileTypes = root.loaderInfo.parameters.fileTypes;
			this.fileTypesDescription = root.loaderInfo.parameters.fileTypesDescription + " (" + this.fileTypes + ")";
			this.loadPostParams(root.loaderInfo.parameters.params);

			
			if (!this.filePostName) {
				this.filePostName = "Filedata";
			}
			if (!this.fileTypes) {
				this.fileTypes = "*.*";
			}
			if (!this.fileTypesDescription) {
				this.fileTypesDescription = "All Files";
			}
			
			this.LoadFileExensions(this.fileTypes);
			
			try {
				this.debugEnabled = root.loaderInfo.parameters.debugEnabled == "true" ? true : false;
			} catch (ex:Object) {
				this.debugEnabled = false;
			}

			try {
				this.fileSizeLimit = Number(root.loaderInfo.parameters.fileSizeLimit);
				if (this.fileSizeLimit < 0) this.fileSizeLimit = 0;
			} catch (ex:Object) {
				this.fileSizeLimit = 0;
			}

			try {
				this.fileUploadLimit = Number(root.loaderInfo.parameters.fileUploadLimit);
				if (this.fileUploadLimit < 0) this.fileUploadLimit = 0;
			} catch (ex:Object) {
				this.fileUploadLimit = 0;
			}

			try {
				this.fileQueueLimit = Number(root.loaderInfo.parameters.fileQueueLimit);
				if (this.fileQueueLimit < 0) this.fileQueueLimit = 0;
			} catch (ex:Object) {
				this.fileQueueLimit = 0;
			}

			// There is no sense in allowing more files to be queued than is allowed to be uploaded
			if (this.fileQueueLimit > this.fileUploadLimit) this.fileQueueLimit = this.fileUploadLimit;

			try {
				ExternalInterface.addCallback("SelectFile", this.SelectFile);
				ExternalInterface.addCallback("SelectFiles", this.SelectFiles);
				ExternalInterface.addCallback("StartUpload", this.StartUpload);
				ExternalInterface.addCallback("StopUpload", this.StopUpload);
				ExternalInterface.addCallback("CancelUpload", this.CancelUpload);
				
				ExternalInterface.addCallback("GetStats", this.GetStats);
				
				ExternalInterface.addCallback("AddFileParam", this.AddFileParam);
				ExternalInterface.addCallback("RemoveFileParam", this.RemoveFileParam);

				ExternalInterface.addCallback("SetUploadURL", this.SetUploadURL);
				ExternalInterface.addCallback("SetPostParams", this.SetPostParams);
				ExternalInterface.addCallback("SetFileTypes", this.SetFileTypes);
				ExternalInterface.addCallback("SetFileSizeLimit", this.SetFileSizeLimit);
				ExternalInterface.addCallback("SetFileUploadLimit", this.SetFileUploadLimit);
				ExternalInterface.addCallback("SetFileQueueLimit", this.SetFileQueueLimit);
				ExternalInterface.addCallback("SetFilePostName", this.SetFilePostName);
				ExternalInterface.addCallback("SetDebugEnabled", this.SetDebugEnabled);
			} catch (ex:Error) {
				this.Debug("Callbacks where not set.");
			}

			this.Debug("SWFUpload Init Complete");
			this.PrintDebugInfo();

			// Do some feature detection
			if (flash.net.FileReferenceList && flash.net.FileReference && flash.net.URLRequest && flash.external.ExternalInterface && flash.external.ExternalInterface.available) {
				ExternalCall.Simple(this.flashReady_Callback);
			} else {
				this.Debug("Feature Detection Failed");				
			}
		}

		/* *****************************************
		* FileReference Event Handlers
		* *************************************** */
		private function DialogCancelled_Handler(event:Event):void {
			this.Debug("Event: fileDialogComplete: File Dialog window cancelled.");
			ExternalCall.FileDialogComplete(this.fileDialogComplete_Callback, 0);
		}

		private function FileProgress_Handler(event:ProgressEvent):void {
			this.Debug("Event: uploadProgress: File ID: " + this.current_file_item.id + ". Bytes: " + event.bytesLoaded + ". Total: " + event.bytesTotal);
			ExternalCall.UploadProgress(this.uploadProgress_Callback, this.current_file_item.ToJavaScriptObject(), event.bytesLoaded, event.bytesTotal);
		}

		private function ServerData_Handler(event:DataEvent):void {
			this.completed_uploads++;
			this.current_file_item.file_status = FileItem.FILE_STATUS_COMPLETE;

			this.Debug("Event: uploadComplete: File ID: " + this.current_file_item.id + " Data: " + event.data);
			ExternalCall.UploadComplete(this.uploadComplete_Callback, this.current_file_item.ToJavaScriptObject(), event.data);

			this.UploadComplete();
			
		}

		private function HTTPError_Handler(event:HTTPStatusEvent):void {
			this.upload_errors++;
			this.current_file_item.file_status = FileItem.FILE_STATUS_ERROR;

			this.Debug("Event: uploadError: HTTP ERROR : File ID: " + this.current_file_item.id + ". HTTP Status: " + event.status + ".");
			ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_HTTP_ERROR, this.current_file_item.ToJavaScriptObject(), event.status.toString());
			this.UploadComplete();
		}
		
		// Note: Flash Player does not support Uploads that require authentication. Attempting this will trigger an
		// IO Error or it will prompt for a username and password and the crash the browser (FireFox/Opera)
		private function IOError_Handler(event:IOErrorEvent):void {
			this.upload_errors++;
			this.current_file_item.file_status = FileItem.FILE_STATUS_ERROR;

			if(!this.uploadURL.length) {
				this.Debug("Event: uploadError : IO Error : File ID: " + this.current_file_item.id + ". Upload URL string is empty.");
				ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_MISSING_UPLOAD_URL, this.current_file_item.ToJavaScriptObject(), event.text);
			} else {
				this.Debug("Event: uploadError : IO Error : File ID: " + this.current_file_item.id + ". IO Error.");
				ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_IO_ERROR, this.current_file_item.ToJavaScriptObject(), event.text);
			}

			this.UploadComplete();
		}

		private function SecurityError_Handler(event:SecurityErrorEvent):void {
			this.upload_errors++;
			this.current_file_item.file_status = FileItem.FILE_STATUS_ERROR;

			this.Debug("Event: uploadError : Security Error : File Number: " + this.current_file_item.id + ". Error:" + event.text);
			ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_SECURITY_ERROR, this.current_file_item.ToJavaScriptObject(), event.text);

			this.UploadComplete();
		}

		private function Select_Many_Handler(event:Event):void {
			this.Select_Handler(this.fileBrowserMany.fileList);
		}
		private function Select_One_Handler(event:Event):void {
			var fileArray:Array = new Array(1);
			fileArray[0] = this.fileBrowserOne;
			this.Select_Handler(fileArray);
		}
		
		private function Select_Handler(file_reference_list:Array):void {
			this.Debug("Select Handler: Files Selected from Dialog. Processing file list");

			// Determine how many files may be queued
			var queue_slots_remaining:Number = this.fileUploadLimit - (this.completed_uploads + this.queued_uploads);
			queue_slots_remaining = (queue_slots_remaining > this.fileQueueLimit && this.fileQueueLimit > 0) ? this.fileQueueLimit : queue_slots_remaining;

			// Check if the number of files selected is greater than the number allowed to queue up.
			if (file_reference_list.length > queue_slots_remaining && (this.fileUploadLimit != 0 || this.fileQueueLimit > 0)) {
				this.Debug("Event: fileQueueError : Selected Files (" + file_reference_list.length + ") exceeds remaining Queue size (" + queue_slots_remaining + ").");
				ExternalCall.FileQueueError(this.fileQueueError_Callback, this.ERROR_CODE_QUEUE_LIMIT_EXCEEDED, null, queue_slots_remaining.toString());
			} else {
				// Process each selected file
				for (var i:Number = 0; i < file_reference_list.length; i++) {
					var file_item:FileItem = new FileItem(file_reference_list[i], this.movieName);

					// Check the size, if it's within the limit add it to the upload list.
					var size_result:Number = this.CheckFileSize(file_item);
					var is_valid_filetype:Boolean = this.CheckFileType(file_item);
					if(size_result == 0 && is_valid_filetype) {
						this.Debug("Event: fileQueued : File ID: " + file_item.id);
						this.file_queue.push(file_item);
						this.queued_uploads++;
						ExternalCall.FileQueued(this.fileQueued_Callback, file_item.ToJavaScriptObject());
					} 
					else if (!is_valid_filetype) {
						this.Debug("Event: fileQueueError : File not of a valid type.");
						this.queue_errors++;
						ExternalCall.FileQueueError(this.fileQueueError_Callback, this.ERROR_CODE_INVALID_FILETYPE, file_item.ToJavaScriptObject(), "File is not an allowed file type.");
					}
					else if (size_result > 0) {
						this.Debug("Event: fileQueueError : File exceeds size limit.");
						this.queue_errors++;
						ExternalCall.FileQueueError(this.fileQueueError_Callback, this.ERROR_CODE_FILE_EXCEEDS_SIZE_LIMIT, file_item.ToJavaScriptObject(), "File size exceeds allowed limit.");
					} else if (size_result < 0) {
						this.Debug("Event: fileQueueError : File is zero bytes.");
						this.queue_errors++;
						ExternalCall.FileQueueError(this.fileQueueError_Callback, this.ERROR_CODE_ZERO_BYTE_FILE, file_item.ToJavaScriptObject(), "File is zero bytes and cannot be uploaded.");
					} 
				}
			}
			
			this.Debug("Event: fileDialogComplete : Finished adding files");
			ExternalCall.FileDialogComplete(this.fileDialogComplete_Callback, file_reference_list.length);
		}

		
		/* ****************************************************************
			Externally exposed functions
		****************************************************************** */
		// Opens a file browser dialog that allows one file to be selected.
		private function SelectFile():void  {
			this.fileBrowserOne = new FileReference();
			this.fileBrowserOne.addEventListener(Event.SELECT, this.Select_One_Handler);
			this.fileBrowserOne.addEventListener(Event.CANCEL,  this.DialogCancelled_Handler);

			// Default file type settings
			var allowed_file_types:String = "*.*";
			var allowed_file_types_description:String = "All Files";

			// Get the instance settings
			if (this.fileTypes.length > 0) allowed_file_types = this.fileTypes;
			if (this.fileTypesDescription.length > 0)  allowed_file_types_description = this.fileTypesDescription;

			this.Debug("Event: fileDialogStart : Browsing files. Single Select. Allowed file types: " + allowed_file_types);
			ExternalCall.Simple(this.fileDialogStart_Callback);

			this.fileBrowserOne.browse([new FileFilter(allowed_file_types_description, allowed_file_types)]);

		}
		
		// Opens a file browser dialog that allows multiple files to be selected.
		private function SelectFiles():void {
			var allowed_file_types:String = "*.*";
			var allowed_file_types_description:String = "All Files";
			if (this.fileTypes.length > 0) allowed_file_types = this.fileTypes;
			if (this.fileTypesDescription.length > 0)  allowed_file_types_description = this.fileTypesDescription;

			this.Debug("Event: fileDialogStart : Browsing files. Multi Select. Allowed file types: " + allowed_file_types);
			ExternalCall.Simple(this.fileDialogStart_Callback);
			this.fileBrowserMany.browse([new FileFilter(allowed_file_types_description, allowed_file_types)]);
		}


		// Starts uploading.  Checks to see if a file is currently uploading and, if not, starts the upload.
		private function StartUpload(file_id:String = ""):void {
			if (this.current_file_item == null) {
				this.Debug("StartUpload(): Starting Upload: " + (file_id ?  "File ID:" + file_id : "First file in queue"));
				this.StartFile(file_id);
			} else {
				this.Debug("StartUpload(): Upload run already in progress");
			}
		}

		// Cancel the current upload and stops.  Doesn't advance the upload pointer. The current file is requeued at the beginning.
		private function StopUpload():void {
			if (this.current_file_item != null) {
				// Cancel the upload and re-queue the FileItem
				this.current_file_item.file_reference.cancel();

				this.current_file_item.file_status = FileItem.FILE_STATUS_QUEUED;
				
				// Remove the event handlers
				this.current_file_item.file_reference.removeEventListener(ProgressEvent.PROGRESS, this.FileProgress_Handler);
				this.current_file_item.file_reference.removeEventListener(IOErrorEvent.IO_ERROR, this.IOError_Handler);
				this.current_file_item.file_reference.removeEventListener(SecurityErrorEvent.SECURITY_ERROR, this.SecurityError_Handler);
				this.current_file_item.file_reference.removeEventListener(HTTPStatusEvent.HTTP_STATUS, this.HTTPError_Handler);
				this.current_file_item.file_reference.removeEventListener(DataEvent.UPLOAD_COMPLETE_DATA, this.ServerData_Handler);

				this.file_queue.unshift(this.current_file_item);
				var js_object:Object = this.current_file_item.ToJavaScriptObject();
				this.current_file_item = null;
				
				ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_UPLOAD_STOPPED, js_object, "Upload Stopped");
				this.Debug("StopUpload(): upload stopped.");
			} else {
				this.Debug("StopUpload(): Upload run not in progress");
			}
		}

		/* Cancels the upload specified by file_id
		 * If the file is currently uploading it is cancelled and the fileComplete
		 * event gets called.
		 * If the file is not currently uploading then only the uploadCancelled event is fired.
		 * */
		private function CancelUpload(file_id:String):void {
			var file_item:FileItem = null;
			var timer:Timer = null;
			
			// Check the current file item
			if (this.current_file_item != null && (this.current_file_item.id == file_id || !file_id)) {
					this.current_file_item.file_reference.cancel();
					this.current_file_item.file_status = FileItem.FILE_STATUS_CANCELLED;
					this.upload_cancelled++;

					this.Debug("Event: fileCancelled: File ID: " + this.current_file_item.id + ". Cancelling current upload");
					ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_FILE_CANCELLED, this.current_file_item.ToJavaScriptObject(), "File Upload Cancelled.");

					this.UploadComplete(); // <-- this advanced the upload to the next file
			} else if (file_id) {
					// Find the file in the queue
					var file_index:Number = this.FindIndexInFileQueue(file_id);
					if (file_index >= 0) {
						// Remove the file from the queue
						file_item = FileItem(this.file_queue[file_index]);
						file_item.file_status = FileItem.FILE_STATUS_CANCELLED;
						this.file_queue[file_index] = null;
						this.queued_uploads--;
						this.upload_cancelled++;
						

						// Cancel the file (just for good measure) and make the callback
						file_item.file_reference.cancel();

						this.Debug("Event: uploadError : " + file_item.id + ". Cancelling queued upload");
						this.Debug("Event: uploadError : " + file_item.id + ". Cancelling queued upload");
						ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_FILE_CANCELLED, file_item.ToJavaScriptObject(), "File Cancelled");
						timer = new Timer(0, 1);
						timer.addEventListener(TimerEvent.TIMER, function(callback:String, error_code:Number, file_object:Object, message:String):Function { return function():void { ExternalInterface.call(callback, error_code, file_object, message); }; }(this.uploadError_Callback, this.ERROR_CODE_FILE_CANCELLED, file_item.ToJavaScriptObject(), "File Cancelled"));
						timer.start();

						// Get rid of the file object
						file_item = null;
					}
			} else {
				// Get the first file and cancel it
				while (this.file_queue.length > 0 && file_item == null) {
					// Check that File Reference is valid (if not make sure it's deleted and get the next one on the next loop)
					file_item = FileItem(this.file_queue.shift());	// Cast back to a FileItem
					if (typeof(file_item) == "undefined") {
						file_item = null;
						continue;
					}
				}
				
				if (file_item != null) {
					file_item.file_status = FileItem.FILE_STATUS_CANCELLED;
					this.queued_uploads--;
					this.upload_cancelled++;
					

					// Cancel the file (just for good measure) and make the callback
					file_item.file_reference.cancel();

					this.Debug("Event: uploadError : " + file_item.id + ". Cancelling queued upload");
					
					ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_FILE_CANCELLED, file_item.ToJavaScriptObject(), "File Cancelled");

					// Get rid of the file object
					file_item = null;
				}
				
			}

		}
		
		private function GetStats():Object {
			return {	files_queued : this.queued_uploads,
						complete_uploads : this.completed_uploads,
						upload_errors : this.upload_errors,
						upload_cancelled : this.upload_cancelled,
						queue_errors : this.queue_errors
			};
		}

		private function AddFileParam(file_id:String, name:String, value:String):Boolean {
			var file_index:Number = this.FindIndexInFileQueue(file_id);
			if (file_index >= 0) {
				var file_item:FileItem = FileItem(this.file_queue[file_index]);
				
				file_item.AddParam(name, value);
				return true;
			} else {
				return false;
			}
		}
		private function RemoveFileParam(file_id:String, name:String):Boolean {
			var file_index:Number = this.FindIndexInFileQueue(file_id);
			if (file_index >= 0) {
				var file_item:FileItem = FileItem(this.file_queue[file_index]);
				file_item.RemoveParam(name);
				return true;
			} else {
				return false;
			}
		}
		
		private function SetUploadURL(url:String):void {
			if (typeof(url) !== "undefined" && url !== "") {
				this.uploadURL = url;
			}
		}
		
		private function SetPostParams(post_object:Object):void {
			if (typeof(post_object) !== "undefined" && post_object !== null) {
				this.uploadPostObject = post_object;
			}
		}
		
		private function SetFileTypes(types:String, description:String):void {
			this.fileTypes = types;
			this.fileTypesDescription = description;
			
			this.LoadFileExensions(this.fileTypes);
		}

		private function SetFileSizeLimit(bytes:Number):void {
			if (bytes < 0) bytes = 0;
			this.fileSizeLimit = bytes;
		}
		
		private function SetFileUploadLimit(file_upload_limit:Number):void {
			if (file_upload_limit < 0) file_upload_limit = 0;
			this.fileUploadLimit = file_upload_limit;
		}
		
		private function SetFileQueueLimit(file_queue_limit:Number):void {
			if (file_queue_limit < 0) file_queue_limit = 0;
			this.fileQueueLimit = file_queue_limit;
		}
		
		private function SetFilePostName(file_post_name:String):void {
			if (file_post_name != "") {
				this.filePostName = file_post_name;
			}
		}
		
		private function SetDebugEnabled(debug_enabled:Boolean):void {
			this.debugEnabled = debug_enabled;
		}
		
		/* *************************************************************
			File processing and handling functions
		*************************************************************** */
		//
		private function StartFile(file_id:String = ""):void {
			// Only upload a file uploads are being processed.
			//   startFile could be called by a file cancellation even when we aren't currently uploading
			if (this.current_file_item != null) {
				this.Debug("StartFile(): Upload already in progress. Not starting another upload.");
			}

			this.Debug("StartFile: " + (file_id ? "File ID: " + file_id : "First file in queue"));

			// Check the upload limit
			if (this.completed_uploads >= this.fileUploadLimit && this.fileUploadLimit != 0) {
				this.Debug("Event: uploadError : Upload limit reached. No more files can be uploaded.");
				ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_UPLOAD_LIMIT_EXCEEDED, null, "The upload limit has been reached.");
				this.current_file_item = null;
				return;
			}
			
			// Get the next file to upload
			if (!file_id) {
				while (this.file_queue.length > 0 && this.current_file_item == null) {
					// Check that File Reference is valid (if not make sure it's deleted and get the next one on the next loop)
					this.current_file_item = FileItem(this.file_queue.shift());	// Cast back to a FileItem
					if (typeof(this.current_file_item) == "undefined") {
						this.current_file_item = null;
						continue;
					}
				}
			} else {
				var file_index:Number = this.FindIndexInFileQueue(file_id);
				if (file_index >= 0) {
					// Set the file as the current upload and remove it from the queue
					this.current_file_item = FileItem(this.file_queue[file_index]);
					this.file_queue[file_index] = null;
				} else {
					this.Debug("Event: uploadError : File ID not found in queue: " + file_id);
					ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_SPECIFIED_FILE_ID_NOT_FOUND, null, "File ID not queued.");
				}
			}


			// Start the upload if we found an item to upload
			if (this.current_file_item != null) {
				// Build the URLRequest
				var request:URLRequest = this.BuildRequest();
				
				// Begin the upload
				this.Debug("startFile(): File Reference found.  Starting upload to " + request.url + ". File ID: " + this.current_file_item.id);
				try {
					this.Debug("Event: uploadStart : File ID: " + this.current_file_item.id);
					var start_upload:Boolean = ExternalCall.UploadStart(this.uploadStart_Callback, this.current_file_item.ToJavaScriptObject());
					
					// Validate the file
					if (start_upload) {
						// Set the event handlers
						this.current_file_item.file_reference.addEventListener(ProgressEvent.PROGRESS, this.FileProgress_Handler);
						this.current_file_item.file_reference.addEventListener(IOErrorEvent.IO_ERROR, this.IOError_Handler);
						this.current_file_item.file_reference.addEventListener(SecurityErrorEvent.SECURITY_ERROR, this.SecurityError_Handler);
						this.current_file_item.file_reference.addEventListener(HTTPStatusEvent.HTTP_STATUS, this.HTTPError_Handler);
						
						this.current_file_item.file_reference.addEventListener(DataEvent.UPLOAD_COMPLETE_DATA, this.ServerData_Handler);
						
						// Upload the file
						this.current_file_item.file_status = FileItem.FILE_STATUS_IN_PROGRESS;
						this.current_file_item.file_reference.upload(request, this.filePostName, false);
					} else {
						this.Debug("Event: uploadError : Call to uploadStart returned false. Not uploading file.");
						this.upload_errors++;
						this.current_file_item.file_status = FileItem.FILE_STATUS_ERROR;
						ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_FILE_VALIDATION_FAILED, this.current_file_item.ToJavaScriptObject(), "Call to uploadStart return false. Not uploading file.");
						this.UploadComplete();
					}
				}
				catch (ex:Error) {
					this.upload_errors++;
					this.Debug("Event: uploadError(): Upload Failed. Unhandled exception.");
					this.current_file_item.file_status = FileItem.FILE_STATUS_ERROR;
					ExternalCall.UploadError(this.uploadError_Callback, this.ERROR_CODE_UPLOAD_FAILED, this.current_file_item.ToJavaScriptObject(), ex.message);
					this.UploadComplete();
				}
			}
			// Otherwise we've would have looped through all the FileItems. This means the queue is empty)
			else {
				this.Debug("startFile(): No File Reference found.  There are no files left to upload.\nstartFile(): Ending upload run. Completed Uploads: " + this.completed_uploads);
			}
		}


		// Completes the file upload by deleting it's reference, advancing the pointer.
		// Once this event files a new upload can be started.
		private function UploadComplete():void {
			var jsFileObj:Object = this.current_file_item.ToJavaScriptObject();
			this.current_file_item = null;
			this.queued_uploads--;

			this.Debug("Event: fileComplete : File complete.");
			
			// I used a timer here to work around issues that occur when chains get built by Flash calling Javascript and
			// JavaScript then calling Flash and so on.  Using the Timer allows this function to return and the stack to
			// clear.  The Timer gets executed a moment later on a separate "thread".  This should be done any time
			// Flash is going to call Javascript which is going to call back in to Flash.
			// I used some ECMAScript magic here to avoid having to create temporary variables and one shot functions.
			// See the Yahoo JavaScript training videos by Crawford.  They are excellent.
			ExternalCall.FileComplete(this.fileComplete_Callback, jsFileObj);

			this.Debug("Event: Exiting fileComplete : File complete.");
		}


		/* *************************************************************
			Utility Functions
		*************************************************************** */
		// Check the size of the file against the allowed file size. If it is less the return TRUE. If it is too large return FALSE
		private function CheckFileSize(file_item:FileItem):Number {
			if (file_item.file_reference.size == 0) {
				return -1;
			} else if (this.fileSizeLimit != 0 && file_item.file_reference.size > (this.fileSizeLimit * 1000)) {
				return 1;
			} else {
				return 0;
			}
		}
		
		private function CheckFileType(file_item:FileItem):Boolean {
			// If no extensions are defined then a *.* was passed and the check is unnecessary
			if (this.valid_file_extensions.length == 0) {
				return true;				
			}
			
			var fileRef:FileReference = file_item.file_reference;
			var last_dot_index:Number = fileRef.name.lastIndexOf(".");
			var extension:String = "";
			if (last_dot_index >= 0) {
				extension = fileRef.name.substr(last_dot_index + 1).toLowerCase();
			}
			
			var is_valid_filetype:Boolean = false;
			for (var i:Number=0; i < this.valid_file_extensions.length; i++) {
				if (String(this.valid_file_extensions[i]) == extension) {
					is_valid_filetype = true;
					break;
				}
			}
			
			return is_valid_filetype;
		}

		private function BuildRequest():URLRequest {
			// Build the Post values
			var key:String;
			var post:URLVariables = new URLVariables();
			for (key in this.uploadPostObject) {
				this.Debug("Global Post Item: " + key + "=" + this.uploadPostObject[key]);				
				if (this.uploadPostObject.hasOwnProperty(key)) {
					post[key] = this.uploadPostObject[key];
				}
			}
			var file_post:Object = this.current_file_item.GetPostObject();
			for (key in file_post) {
				this.Debug("File Post Item: " + key + "=" + this.uploadPostObject[key]);				
				if (file_post.hasOwnProperty(key)) {
					post[key] = file_post[key];
				}
			}
			
			// Create the request object
			var request:URLRequest = new URLRequest();
			request.method = URLRequestMethod.POST;
			request.url = this.uploadURL;
			request.data = post;
			
			return request;
		}
		
		private function Debug(msg:String):void {
			if (this.debugEnabled) {
				var lines:Array = msg.split("\n");
				for (var i:Number=0; i < lines.length; i++) {
					lines[i] = "SWF DEBUG: " + lines[i];
				}
				try {
					ExternalCall.Debug(this.debug_Callback, lines.join("\n"));
				} catch (ex:Error) {
					// pretend nothing happened
				}
			}
		}

		private function PrintDebugInfo():void {
			var debug_info:String = "\n----- SWF DEBUG OUTPUT ----\n";
			debug_info += "Build Number:           " + this.build_number + "\n";
			debug_info += "movieName:              " + this.movieName + "\n";
			debug_info += "Upload URL:             " + this.uploadURL + "\n";
			debug_info += "File Types String:      " + this.fileTypes + "\n";
			debug_info += "Parsed File Types:      " + this.valid_file_extensions.toString() + "\n";
			debug_info += "File Types Description: " + this.fileTypesDescription + "\n";
			debug_info += "File Size Limit:        " + this.fileSizeLimit + "\n";
			debug_info += "File Upload Limit:      " + this.fileUploadLimit + "\n";
			debug_info += "File Queue Limit:       " + this.fileQueueLimit + "\n";
			debug_info += "Post Params:\n";
			for (var key:String in this.uploadPostObject) {
				debug_info += "                        " + key + "=" + this.uploadPostObject[key] + "\n";
			}
			debug_info += "----- END SWF DEBUG OUTPUT ----\n";

			this.Debug(debug_info);
		}

		private function FindIndexInFileQueue(file_id:String):Number {
			for (var i:Number = 0; i<this.file_queue.length; i++) {
				var item:FileItem = this.file_queue[i];
				if (item != null && item.id == file_id) return i;
			}

			return -1;
		}
		
		// Parse the file extensions in to an array so we can validate them agains
		// the files selected later.
		private function LoadFileExensions(filetypes:String):void {
			var extensions:Array = filetypes.split(";");
			this.valid_file_extensions = new Array();

			for (var i:Number=0; i < extensions.length; i++) {
				var extension:String = String(extensions[i]);
				var dot_index:Number = extension.lastIndexOf(".");
				
				if (dot_index >= 0) {
					extension = extension.substr(dot_index + 1).toLowerCase();
				} else {
					extension = extension.toLowerCase();
				}
				
				// If one of the extensions is * then we allow all files
				if (extension == "*") {
					this.valid_file_extensions = new Array();
					break;
				}
				
				this.valid_file_extensions.push(extension);
			}
		}
		
		private function loadPostParams(param_string:String):void {
			var post_object:Object = {};

			if (param_string != null) {
				var name_value_pairs:Array = param_string.split("&");
				
				for (var i:Number = 0; i < name_value_pairs.length; i++) {
					var name_value:String = String(name_value_pairs[i]);
					var index_of_equals:Number = name_value.indexOf("=");
					if (index_of_equals > 0) {
						post_object[decodeURIComponent(name_value.substring(0, index_of_equals))] = decodeURIComponent(name_value.substr(index_of_equals + 1));
					}
				}
			}
			this.uploadPostObject = post_object;
		}

	}
}