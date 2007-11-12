import flash.net.FileReference;

class FileItem
{
	private static var file_id_sequence:Number = 0;		// tracks the file id sequence

	private var postObject:Object;
	public var file_reference:FileReference;
	public var id:String;
	public var file_status:Number = 0;
	
	public static var FILE_STATUS_QUEUED:Number		= -1;
	public static var FILE_STATUS_IN_PROGRESS:Number	= -2;
	public static var FILE_STATUS_ERROR:Number			= -3;
	public static var FILE_STATUS_SUCCESS:Number		= -4;
	public static var FILE_STATUS_CANCELLED:Number		= -5;
	
	public function FileItem(file_reference:FileReference, control_id:String)
	{
		this.postObject = {};
		this.file_reference = file_reference;
		this.id = control_id + "_" + (FileItem.file_id_sequence++);
		this.file_status = FileItem.FILE_STATUS_QUEUED;
		
	}
	
	public function AddParam(name:String, value:String):Void {
		this.postObject[name] = value;
	}
	
	public function RemoveParam(name:String):Void {
		delete this.postObject[name];
	}
	
	public function GetPostObject():Object {
		return this.postObject;
	}
	
	// Create the simply file object that is passed to the browser
	public function ToJavaScriptObject():Object {
		var file_object:Object = {
			id: this.id,
			name: this.file_reference.name,
			size: this.file_reference.size,
			type: this.file_reference.type,
			creationdate: this.file_reference.creationDate,
			modificationdate: this.file_reference.modificationDate,
			filestatus : this.file_status
		};
		file_object.post = this.GetPostObject();			
	
		return file_object;
	}
	
	public function toString():String {
		return "FileItem - ID: " + this.id;
	}
}