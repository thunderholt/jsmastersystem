function Ioc() {
	
	//this.portReaders = [];
	//this.portWriters = [];

	this.vdp = null;
	this.joypads = null;
	this.audio = null;

	this.init = function () {

		/*for (let i = 0; i < 0xff; i++) {
			this.portReaders[i] = null;
			this.portWriters[i] = null;
		}*/
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

				byte = this.joypads.readByteFromPortAB();

			} else {

				byte = this.joypads.readByteFromPortBMisc();
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
			//throw 'Unknown IO port write: ' + port;
		}

		/*let portWriter = this.portWriters[port];

		if (portWriter == null) {
			throw 'Attempt to write byte to unbound port: 0x' + port.toString(16);
		}

		portWriter(byte);*/

		//console.log('Writing ' + byte.toString(16) + ' to port ' + port.toString(16) + '.');
	}

	this.setVdp = function (vdp) {

		this.vdp = vdp;
	}

	this.setJoypads = function (joypads) {

		this.joypads = joypads;
	}

	this.setAudio = function (audio) {

		this.audio = audio;
	}

	/*this.bindPort = function (portNumber, name, reader, writer) {

		this.portReaders[portNumber] = reader;
		this.portWriters[portNumber] = writer;

		this.log('Bound port 0x' + portNumber.toString(16) + ': ' + name + '.');
	}*/

	this.log = function (message) {

		console.log('IOC: ' + message);
	}

	this.init();
}