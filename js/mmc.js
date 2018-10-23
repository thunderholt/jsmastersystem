function Mmc() {
	
	this.systemRam = new Uint8Array(MMC_SYSTEM_RAM_SIZE);
	this.cartridgeRam = new Uint8Array(0x4000);
	this.romBanks = [];
	this.mapperSlots = [];
	this.mapperSlot2IsCartridgeRam = false;
	this.stashedSystemRam = null;

	this.init = function () {

		for (let i = 0; i < MMC_MAX_ROM_BANKS; i++) {
			this.romBanks[i] = new Uint8Array(MMC_ROM_BANK_SIZE);
		}

		for (let i = 0; i < 3; i++) {
			this.mapperSlots[i] = null;
		}

		this.reset();
	}

	this.reset = function () {

		for (let i = 0; i < this.systemRam.length; i++) {
			this.systemRam[i] = 0;
		}

		for (let i = 0; i < this.cartridgeRam.length; i++) {
			this.cartridgeRam[i] = 0;
		}

		for (let i = 0; i < 3; i++) {
			this.mapperSlots[i] = null;
		}

		for (let i = 0; i < this.romBanks.length; i++) {
			var romBank = this.romBanks[i];

			for (let j = 0; j < romBank.length; j++) {
				romBank[j] = 0;
			}
		}

		this.mapperSlot2IsCartridgeRam = false;
		this.stashedSystemRam = null;
	}

	this.loadRomFromBytes = function (romBytes) {

		let byteArray = new Uint8Array(romBytes);    
    	let bankIndex = 0;
    	let bankByteIndex = 0;

    	for (let i = 0; i < byteArray.byteLength; i++) {
      		this.romBanks[bankIndex][bankByteIndex] = byteArray[i];
      		bankByteIndex++;
      		if (bankByteIndex == MMC_ROM_BANK_SIZE) {
      			
      			bankIndex++;
      			if (bankIndex == MMC_MAX_ROM_BANKS) {
					throw 'Too many banks in ROM.';
				}

      			bankByteIndex = 0;
      			this.log('Loading bank ' + bankIndex);
      		}
	    }

	    // Default the mapper slots to banks 1 - 3.
	    for (let i = 0; i < 3; i++) {
			this.mapperSlots[i] = i < this.romBanks.length ? this.romBanks[i] : null;
		}

	    this.log('ROM loaded.');
	}

	this.readByte = function (address) {

		let byte = 0;

		if (address <= 0x03ff) {

			// ROM (unpaged).
			byte = this.romBanks[0][address];

		} else if (address <= 0x3fff) {

			// ROM mapper slot 0.
			let mapperSlot = this.mapperSlots[0];
			byte = mapperSlot != null ? mapperSlot[address] : 0;

		} else if (address <= 0x7fff) {

			// ROM mapper slot 1.
			let mapperSlot = this.mapperSlots[1];
			byte = mapperSlot != null ? mapperSlot[address - 0x4000] : 0;

		} else if (address <= 0xbfff) {

			// ROM/RAM mapper slot 2.
			if (this.mapperSlot2IsCartridgeRam) {

				byte = this.cartridgeRam[address - 0x8000];

			} else {

				let mapperSlot = this.mapperSlots[2];
				byte = mapperSlot != null ? mapperSlot[address - 0x8000] : 0;
			}

		} else if (address <= 0xdfff) {

			// System RAM.
			byte = this.systemRam[address - 0xc000];

		} else if (address <= 0xffff) {

			// System RAM mirror.
			byte = this.systemRam[address - 0xe000];

		} else {

			throw 'Bad read address: ' + address.toString(16);
		}

		return byte;
	}

	this.readWord = function (address) {

		let byte1 = this.readByte(address);
		let byte2 = this.readByte(address + 1);

		return byte1 | byte2 << 8;
	}

	this.writeByte = function (address, byte) {

		if (address < 0x8000) {

			// ROM mapper slots 0 - 1.
			//throw 'Bad write address: ' + address.toString(16);
			console.log('Bad write address: ' + address.toString(16));

		} else if (address <= 0xbfff) {

			// ROM/RAM mapper slot 2.
			if (this.mapperSlot2IsCartridgeRam) {
				this.cartridgeRam[address - 0x8000] = byte;
			}

		} else if (address <= 0xdfff) {

			// System RAM.
			this.systemRam[address - 0xc000] = byte;

		} else if (address <= 0xffff) {

			// System RAM mirror.
			this.systemRam[address - 0xe000] = byte;

			if (address == 0xfffc) {

				this.setMapperControl(byte);

			} else if (address == 0xfffd) {

				this.setMapperSlot(0, byte);

			} else if (address == 0xfffe) {

				this.setMapperSlot(1, byte);
			
			} else if (address == 0xffff) {

				this.setMapperSlot(2, byte);
			}

		} else {

			throw 'Bad write address: ' + address.toString(16);
		}
	}

	this.writeWord = function (address, word) {

		var byte1 = word & 0xFF;
		var byte2 = word >> 8;

		this.writeByte(address, byte1);
		this.writeByte(address + 1, byte2);
	}

	this.setMapperControl = function (byte) {

		// Check bit 0-1: Bank shift.
		let bankShift = byte & 0x03;
		if (bankShift != 0) {

			throw 'Unimplemented ROM bank shift.';
		}

		// Check bit 2: RAM bank select.
		if ((byte & 0x04) > 0) {

			throw 'Unimplemented RAM bank select.';
		}

		// Check bit 3: System RAM override.
		if ((byte & 0x10) > 0) {

			throw 'Unimplemented system RAM override.';
		}

		// Check bit 4: Cartridge RAM enable slot 2).
		this.mapperSlot2IsCartridgeRam = (byte & 0x08) > 0;
	}

	this.setMapperSlot = function (slotIndex, byte) {

		let bankIndex = byte & 0x3f; // Mask off to just first 6 bits.

		this.mapperSlots[slotIndex] = this.romBanks[bankIndex];

		//this.log('Mapper slot ' + slotIndex + ' set to ROM bank ' + byte + '.');
	}

	this.dump = function () {

		let output = '';
		let address = 0;

		while (address < MMC_SYSTEM_RAM_SIZE) {
			output += (0xc000 + address).toString(16).toUpperCase() + ': ';

			for (let j = 0; j < 16; j++) {
			
				let byte = this.systemRam[address];
				output += (byte < 0x0f ? '0' : '') + byte.toString(16).toUpperCase() + ' ';
				address++;
			}

			output += '\n';
		}

		document.getElementById('mem-dump').innerHTML = output;
	}

	this.stash = function () {

		this.stashedSystemRam = this.systemRam.slice();
	}

	this.diffStash = function () {

		if (this.stashedSystemRam != null) {
			for (let i = 0; i < this.systemRam.length; i++) {
				let byteA = this.stashedSystemRam[i];
				let byteB = this.systemRam[i];
				if (byteA != byteB) {
					console.log((0xc000 + i).toString(16) + ': ' + byteA.toString(16) + ' -> ' + byteB.toString(16));
				}
			}
		}
	}

	this.log = function (message) {

		console.log('MMC: ' + message);
	}

	this.init();
}