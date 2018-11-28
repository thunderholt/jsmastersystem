function Ioc() {
	
	this.vdp = null;
	this.input = null;
	this.audio = null;

	this.init = function () {

	}

	this.readByte = function (port) {

		let byte = 0;

		if (port >= 0x40 && port <= 0x7f) {

			if (port % 2 == 0) {

				byte = this.vdp.readByteFromVCounterPort();
			
			} else {

				throw 'Unimplemented - H counter/PSG port read.';
			}
		
		} else if (port >= 0x80 && port <= 0xbf) {

			if (port % 2 == 0) {

				byte = this.vdp.readByteFromDataPort();

			} else {

				byte = this.vdp.readByteFromControlPort();
			}
		
		} else if (port >= 0xc0 && port <= 0xff) {

			if (port % 2 == 0) {

				byte = this.input.readByteFromPortAB();

			} else {

				byte = this.input.readByteFromPortBMisc();
			}

		}
		/*} else if (port == 0xdc) {

			byte = this.joypads.readByteFromPortAB();

		} else if (port == 0xdd) {

			byte = this.joypads.readByteFromPortBMisc();

		} */else {

			console.log('Unknown IO port read: ' + port);
			//throw 'Unknown IO port read: ' + port;
		}

		return byte;
	}

	this.writeByte = function (port, byte) {

		if (port >= 0x40 && port <= 0x7f) {

			this.audio.writeByteToPort(byte);
		
		} else if (port >= 0x80 && port <= 0xbf) {

			if (port % 2 == 0) {

				this.vdp.writeByteToDataPort(byte);

			} else {

				this.vdp.writeByteToControlPort(byte);
			}

		} else if (port >= 0xc0 && port <= 0xff) {
		
			// No effect.

		} else {

			console.log('Unknown IO port write: ' + port);
		}
	}

	this.setVdp = function (vdp) {

		this.vdp = vdp;
	}

	this.setInput = function (input) {

		this.input = input;
	}

	this.setAudio = function (audio) {

		this.audio = audio;
	}

	this.log = function (message) {

		console.log('IOC: ' + message);
	}

	this.init();
}