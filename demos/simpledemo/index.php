<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" >
<head>
    <title>SWFUpload v2.1.0 Simple Demo</title>

	<link href="../css/default.css" rel="stylesheet" type="text/css" />
	<script type="text/javascript" src="../swfupload/swfupload.js"></script>
	<script type="text/javascript" src="js/swfupload.queue.js"></script>
	<script type="text/javascript" src="js/fileprogress.js"></script>
	<script type="text/javascript" src="js/handlers.js"></script>
	<script type="text/javascript">
		var swfu;

		window.onload = function() {
			var settings = {
				flash_url : "../swfupload/swfupload_f9.swf",
				upload_url: "../simpledemo/upload.php",	// Relative to the SWF file
				post_params: {"PHPSESSID" : "<?php echo session_id(); ?>"},
				file_size_limit : "100 MB",
				file_types : "*.*",
				file_types_description : "All Files",
				file_upload_limit : 100,
				file_queue_limit : 0,
				custom_settings : {
					progressTarget : "fsUploadProgress",
					cancelButtonId : "btnCancel"
				},
				debug: false,

				// The event handler functions are defined in handlers.js
				file_queued_handler : fileQueued,
				file_queue_error_handler : fileQueueError,
				file_dialog_complete_handler : fileDialogComplete,
				upload_start_handler : uploadStart,
				upload_progress_handler : uploadProgress,
				upload_error_handler : uploadError,
				upload_success_handler : uploadSuccess,
				upload_complete_handler : uploadComplete,
				queue_complete_handler : queueComplete	// Queue plugin event
			};

			swfu = new SWFUpload(settings);
	     };
	</script>

</head>
<body>
	<div class="title"><a class="likeParent" href="../index.php">SWFUpload v2.1.0 Simple Demo</a></div>
	<form id="form1" action="index.php" method="post" enctype="multipart/form-data">
		<div>This page demonstrates a simple usage of SWFUpload.  It uses the Queue Plugin to simplify uploading or cancelling all queued files.</div>
		<div class="content">
			<fieldset class="flash" id="fsUploadProgress">
				<legend>Upload Queue</legend>
			</fieldset>
			<div id="divStatus">0 Files Uploaded</div>
			<div>
				<input type="button" value="Upload file (Max 100 MB)" onclick="swfu.selectFiles()" style="font-size: 8pt;" />
				<input id="btnCancel" type="button" value="Cancel All Uploads" onclick="swfu.cancelQueue();" disabled="disabled" style="font-size: 8pt;" /><br />
			</div>
		</div>
	</form>
</body>
</html>