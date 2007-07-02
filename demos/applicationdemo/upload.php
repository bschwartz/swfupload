<?php
	$php_session_id = isset($_POST["PHPSESSID"]) ? $_POST["PHPSESSID"] : false;
	$file_id = isset($_POST["file_id"]) ? $_POST["file_id"] : false;
	if ($php_session_id === false || $file_id === false) {
		header("HTTP/1.0 500 Internal Server Error");
		echo "Could not find session or file id";
		exit(0);
	}

	session_id($php_session_id);
	session_start();

	// Get the image and create a thumbnail
	$img = @imagecreatefromjpeg($_FILES["Filedata"]["tmp_name"]);
	if (!$img) {
		header("HTTP/1.0 500 Internal Server Error");
		echo "could not create image handle";
		exit(0);
	}

	$width = imageSX($img);
	$height = imageSY($img);

	if (!$width || !$height) {
		header("HTTP/1.0 500 Internal Server Error");
		echo "Invalid width or height";
		exit(0);
	}

	// Build the thumbnail
	$target_width = 100;
	$target_height = 100;
	$target_ratio = $target_width / $target_height;

	$img_ratio = $width / $height;

	if ($target_ratio > $img_ratio) {
		$new_height = $target_height;
		$new_width = $img_ratio * $target_height;
	} else {
		$new_height = $target_width / $img_ratio;
		$new_width = $target_width;
	}

	if ($new_height > $target_height) {
		$new_height = $target_height;
	}
	if ($new_width > $target_width) {
		$new_height = $target_width;
	}

	$new_img = ImageCreateTrueColor(100, 100);
	if (!@imagefilledrectangle($new_img, 0, 0, $target_width-1, $target_height-1, 0)) {	// Fill the image black
		header("HTTP/1.0 500 Internal Server Error");
		echo "Could not fill new image";
		exit(0);
	}

	if (!@imagecopyresampled($new_img, $img, ($target_width-$new_width)/2, ($target_height-$new_height)/2, 0, 0, $new_width, $new_height, $width, $height)) {
		header("HTTP/1.0 500 Internal Server Error");
		echo "Could not resize image";
		exit(0);
	}

	if (!isset($_SESSION["file_info"])) {
		$_SESSION["file_info"] = array();
	}

	// Use a output buffering to load the image into a variable
	ob_start();
	imagejpeg($new_img);
	$imagevariable = ob_get_contents();
	ob_end_clean();

	$_SESSION["file_info"][$file_id] = $imagevariable;

?>
<p>Thumbnail Upload Page</p>