function Util() {
	
	this.loadBytesFromUrl = function (url, callback) {

		var request = new XMLHttpRequest();
		request.open('GET', url, true);
		request.responseType = 'arraybuffer';

		request.onload = function (e) {
	  		var arrayBuffer = request.response;
	  		callback(arrayBuffer);
		};

		request.send(null);
	}
}