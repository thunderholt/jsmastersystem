function Vdp() {
	
	var self = this;

	//this.frameIsComplete = false;
	//this.clockCounter = 0;
	//this.ioc = null;
	this.cpu = null;
	this.canvasContext = null;
	this.frameBuffer = null;
	this.frameBufferSize = { width: 0, height: 0 };
	//this.expectedFrameBufferSize = { width: 0, height: 0 };
	//this.actualFrameBufferSize = { width: 0, height: 0 };
	//this.displayEnabled = false;
	//this.displayMode = VDP_DISPLAY_MODE_UNKNOWN;
	//this.lineMode = VDP_LINE_MODE_192;

	this.registers = {
		nameTableBaseAddress: 0,
		spriteAttributeTableBaseAddress: 0,
		spritePatternGeneratorBaseAddress: 0,
		overscanColour: 0,
		backgroundXScroll: 0,
		backgroundYScroll: 0,
		lineCounter: 0
	}

	this.vram = new Uint8Array(VDP_VRAM_RAM_SIZE);
	this.cram = new Uint8Array(VDP_CRAM_RAM_SIZE);
	//this.registers = [];
	this.currentScanlineIndex = 0;
	this.currentScanlinePixelIndex = 0;
	this.numberOfCyclesToBurn = 0;
	//this.dataPortValue = 0;
	//this.controlPortValue = 0;
	this.controlWord = 0;
	this.controlWordFlag = false;
	//this.lineInterruptPendingFlag = false;
	//this.nameTableBaseAddress = 0;
	//this.spriteAttributeTableBaseAddress = 0;
	//this.spritePatternGeneratorBaseAddress = 0;
	//this.overscanColour = 0;
	//this.backgroundXScroll = 0;
	//this.backgroundYScroll = 0;
	//this.lineCounter = 0;
	this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_VRAM;
	this.dataPortReadWriteAddress = 0;
	this.vCounter = 0;
	this.numberOfCyclesExecutedThisFrame = 0;
	this.statusFlags = 0;
	this.readBufferByte = 0;
	//this.pixel = { r: 0, g: 0, b: 0 }

	this.modeSettings = {
		disableVerticalScrollingForColumns24To31: false,
		disableHorizontalScrollingForRows0To1: false,
		maskColumn0WithOverscanColour: false,
		enableLineInterrupts: false,
		shiftSpritesLeftBy8Pixels: false,
		displayMode: VDP_DISPLAY_MODE_UNKNOWN,
		displayIsMonochrome: false,
		displayEnabled: false,
		frameInterruptEnabled: false,
		lineMode: VDP_LINE_MODE_192,
		useLargeSprites: false,
		spritePixelsAreDoubleSize: false
	}

	//this.currentBackgroundPixelColour = 0;
	/*this.currentTileData = {
		palletteNumber: 0,
		horizontalFlip: false,
		verticalFlip: false,

		tileDataPlane0Byte: 0,
		tileDataPlane1Byte: 0,
		tileDataPlane2Byte: 0,
		tileDataPlane3Byte: 0
	}*/
	this.tileScanLineData = {
		scanLineX: 0,
		counter: 0,

		nameTableRow: 0,
		nameTableColumn: 0,

		palletteNumber: 0,
		horizontalFlip: false,
		verticalFlip: false,
		displayOnTopOfSprite: false,

		tilePlane0Byte: 0,
		tilePlane1Byte: 0,
		tilePlane2Byte: 0,
		tilePlane3Byte: 0,

		loadTileData: false,

		numberOfActiveSprites: 0,
		sprites: []
		//tilePixelCounter: 0
	}

	this.init = function () {

		//this.frameBuffer = system.canvasContext.createImageData(
		//	VDP_FRAMEBUFFER_WIDTH_PIXELS * 3, VDP_FRAMEBUFFER_HEIGHT_PIXELS * 3);

		/*for (let i = 0; i < 10; i++) {
			this.registers[i] = 0;
		}*/

		for (let i = 0; i < 8; i++) {
			this.tileScanLineData.sprites[i] = {
				x: 0,
				tileIndex: 0,
				//tilePixelRow: 0,
				tilePlane0Byte: 0,
				tilePlane1Byte: 0,
				tilePlane2Byte: 0,
				tilePlane3Byte: 0
			}
		}

		this.reset();
	}

	this.reset = function () {

		this.registers.nameTableBaseAddress = 0;
		this.registers.spriteAttributeTableBaseAddress = 0;
		this.registers.spritePatternGeneratorBaseAddress = 0;
		this.registers.overscanColour = 0;
		this.registers.backgroundXScroll = 0;
		this.registers.backgroundYScroll = 0;
		this.registers.lineCounter = 0;

		for (let i = 0; i < this.vram.length; i++) {
			this.vram[i] = 0;
		}

		for (let i = 0; i < this.cram.length; i++) {
			this.cram[i] = 0;
		}

		this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_VRAM;
		this.dataPortReadWriteAddress = 0;
		this.vCounter = 0;
		this.numberOfCyclesExecutedThisFrame = 0;
		this.statusFlags = 0;
		this.readBufferByte = 0;

		this.modeSettings.disableVerticalScrollingForColumns24To31 = false;
		this.modeSettings.disableHorizontalScrollingForRows0To1 = false;
		this.modeSettings.maskColumn0WithOverscanColour = false;
		this.modeSettings.enableLineInterrupts = false;
		this.modeSettings.shiftSpritesLeftBy8Pixels = false;
		this.modeSettings.displayMode = VDP_DISPLAY_MODE_UNKNOWN;
		this.modeSettings.displayIsMonochrome = false;
		this.modeSettings.displayEnabled = false;
		this.modeSettings.frameInterruptEnabled = false;
		this.modeSettings.lineMode = VDP_LINE_MODE_192;
		this.modeSettings.useLargeSprites = false;
		this.modeSettings.spritePixelsAreDoubleSize = false;
	}

	this.tick = function () {

		if (this.numberOfCyclesToBurn == 0) {

			/////////////////////////
			if (this.currentScanlinePixelIndex > 341) {
				throw 'Bad pixel index.';
			}
			/////////////////////////

			let raiseInterrupt = false;

			// Check if we've just started a new scanline.
			if (this.currentScanlinePixelIndex == 0) {
				// FIXME - Is this the correct place on the scanline to increment the V-counter?

				// Increment the v-counter. 
				// The v-counter jumps back after 0xda, so that its value still fits into a byte at 
				// the end of the frame.
				//if (this.vCounter == 0xda) {
				if (this.currentScanlineIndex == 219) {
					this.vCounter = 0xd5;
				} else {
					this.vCounter++;
					this.vCounter &= 0xff;
				}
			}

			// Move onto the next pixel.
			this.currentScanlinePixelIndex++;

			// Check if we've reached the visible end of the scanline.
			if (this.currentScanlinePixelIndex == 256) {

				// FIXME - Is this the correct place on the scanline to raise line counter interrupts?

				// Decrement / reload the line counter.
				if (this.currentScanlineIndex <= 192) {

					this.lineCounter--;
					this.lineCounter &= 0xff;

					// Check if the counter has underflowed.
					if (this.lineCounter == 0xff) {
						this.lineCounter = this.registers.lineCounter;

						if (this.modeSettings.enableLineInterrupts) {
							raiseInterrupt = true;
						}
					}

				} else {

					this.lineCounter = this.registers.lineCounter;
				}
			}

			// Check if we've reached the end of the scanline.
			if (this.currentScanlinePixelIndex == 342) {

				/////////////////////////
				if (this.currentScanlineIndex > 261) {
					throw 'Bad scanline index.';
				}
				/////////////////////////

				// End of scanline reached - pixel wrap counter.
				this.currentScanlinePixelIndex = 0;

				// Render the scanline all in one go.
				if (this.modeSettings.displayEnabled &&
					this.currentScanlineIndex < VDP_VISIBLE_SCANLINE_COUNT_NTSC) {

					this.generateScanLine();
				}

				// FIXME - Is this the correct place on the scanline to raise the frame interrupt?

				// If we've just rendered the last visible scanline, raise the frame interrupt.
				if (this.currentScanlineIndex == 191) {

					// Set the frame-interrupt-pending status flag.
					this.statusFlags |= 0x80;

					if (this.modeSettings.frameInterruptEnabled) {
						raiseInterrupt = true;
					}
				}

				this.currentScanlineIndex++;
			}

			if (raiseInterrupt) {

				/*/////
				if (!this.cpu.isHalted) {
					//throw "Ahhh";
				}
				/////*/

				this.cpu.raiseMaskableInterrupt();
			}

			this.numberOfCyclesToBurn = 2;
		}

		// Burn cycles.
		this.numberOfCyclesToBurn--;
		this.numberOfCyclesExecutedThisFrame++;
	}

	this.startFrame = function () {

		//this.frameIsComplete = false;
		//this.clockCounter = 0;

		//if (this.currentScanlineIndex >= 262) {
		if (this.currentScanlineIndex > 0 && this.currentScanlineIndex != 262) {
			throw 'Wrong number of scanlines, bad VDP timing!';
		}

		//console.log('Num VDP clocks last frame: ' + this.numberOfClocksExecutedThisFrame);

		if (this.numberOfCyclesExecutedThisFrame > 0 && 
		//	this.numberOfCyclesExecutedThisFrame != 178978) {
			this.numberOfCyclesExecutedThisFrame != 179208) {
			throw 'Incorrect number of VDP clocks executed last frame.';
		}

		//this.checkFrameBuffer();
		this.currentScanlineIndex = 0;
		this.currentScanlinePixelIndex = 0;
		//this.vCounter = 0;
		this.numberOfCyclesToBurn = 0;
		this.numberOfCyclesExecutedThisFrame = 0;
	}

	this.presentFrame = function () {

		this.canvasContext.putImageData(this.frameBuffer, 0, 0);
	}

	this.setCanvasContext = function (canvasContext) {

		this.canvasContext = canvasContext;

		this.frameBufferSize.width = 256; // FIXME - constant
		this.frameBufferSize.height = 192; // FIXME - constant

		this.frameBuffer = this.canvasContext.createImageData(
			this.frameBufferSize.width, 
			this.frameBufferSize.height); 
	}

	this.setCpu = function (cpu) {

		this.cpu = cpu;
	}

	this.readByteFromVCounterPort = function () {

		return this.vCounter;
	}

	this.readByteFromDataPort = function () {

		this.controlWordFlag = false;

		//return this.dataPortValue;

		//throw 'Unimp: read data port.'

		let byte = this.readBufferByte;

		this.readBufferByte = this.vram[this.dataPortReadWriteAddress];

		this.dataPortReadWriteAddress++;
		this.dataPortReadWriteAddress &= 0x3fff;

		return byte;
	}

	this.writeByteToDataPort = function (byte) {

		//console.log('Data port write: ' + byte.toString(16) + ' @ ' + this.dataPortReadWriteAddress.toString(16));

		this.controlWordFlag = false;

		if (this.dataPortWriteMode == VDP_DATA_PORT_WRITE_MODE_VRAM) {

			if (this.dataPortReadWriteAddress < VDP_VRAM_RAM_SIZE) {
				this.vram[this.dataPortReadWriteAddress] = byte;
			} else {
				console.log('Attempt to write to illegal VRAM address: ' + this.dataPortReadWriteAddress.toString(16));
			}

		} else {
			
			let cramAddress = this.dataPortReadWriteAddress & 0x1f;

			if (cramAddress < VDP_CRAM_RAM_SIZE) {
				this.cram[cramAddress] = byte;
			} else {
				console.log('Attempt to write to illegal CRAM address: ' + cramAddress.toString(16));
			}
		}

		this.dataPortReadWriteAddress++;
		this.dataPortReadWriteAddress &= 0x3fff;

		this.readBufferByte = byte;
	}

	this.readByteFromControlPort = function () {

		this.controlWordFlag = false;
		//this.lineInterruptPendingFlag = false;

		var currentStatusFlags = this.statusFlags;

		// Clear the flags.
		this.statusFlags &= 0x1f;

		currentStatusFlags |= 0x1f; // Set junk bits to match what MEKA does.

		return currentStatusFlags;
	}

	this.writeByteToControlPort = function (byte) {

		//console.log('Control port write: ' + byte.toString(16));

		//this.controlPortValue = byte;

		if (!this.controlWordFlag) {

			this.controlWord = byte;
			this.controlWordFlag = true;
		
		} else {

			this.controlWord |= (byte << 8);
			this.controlWordFlag = false;

			let controlCode = (this.controlWord & 0xc000) >> 14;
			this.dataPortReadWriteAddress = (this.controlWord & 0x3fff);

			if (controlCode == VDP_CONTROL_CODE_READWRITE_VRAM) {

				//throw 'Unimp: VDP_CONTROL_CODE_READWRITE_VRAM';
				this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_VRAM;

				this.readBufferByte = this.vram[this.dataPortReadWriteAddress];

				this.dataPortReadWriteAddress++;
				this.dataPortReadWriteAddress &= 0x3fff;
			
			} else if (controlCode == VDP_CONTROL_CODE_ENABLE_DATA_PORT_VRAM_WRITES) {

				this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_VRAM;
				//console.log('Data port writes now go to VRAM at: ' + this.dataPortReadWriteAddress.toString(16));

			} else if (controlCode == VDP_CONTROL_CODE_WRITE_REGISTER) {

				let registerIndex = (this.controlWord & 0x0f00) >> 8;
				let dataByte = this.controlWord & 0x00ff;

				this.writeByteToRegister(registerIndex, dataByte);

			} else if (controlCode == VDP_CONTROL_CODE_ENABLE_DATA_PORT_CRAM_WRITES) {

				this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_CRAM;
				//console.log('Data port writes now go to CRAM at: ' + (this.dataPortReadWriteAddress & 0x1f).toString(16));
			}
		}
	}

	this.writeByteToRegister = function (registerIndex, byte) {

		//console.log('Writing ' + byte.toString(16) +' to register ' + registerIndex + '.');

		//this.registers[registerIndex] = byte;

		if (registerIndex == VDP_REGISTER_INDEX_MODE_CONTROL_1) {

			this.modeSettings.disableVerticalScrollingForColumns24To31 = (byte & 0x80) != 0;
			this.modeSettings.disableHorizontalScrollingForRows0To1 = (byte & 0x40) != 0;
			this.modeSettings.maskColumn0WithOverscanColour = (byte & 0x20) != 0;
			this.modeSettings.enableLineInterrupts = (byte & 0x10) != 0;
			this.modeSettings.shiftSpritesLeftBy8Pixels = (byte & 0x08) != 0;
			this.modeSettings.displayMode = (byte & 0x04) != 0 ? VDP_DISPLAY_MODE_4 : VDP_DISPLAY_MODE_UNKNOWN;
			this.modeSettings.displayIsMonochrome = (byte & 0x01) != 0;

		} else if (registerIndex == VDP_REGISTER_INDEX_MODE_CONTROL_2) {

			this.modeSettings.displayEnabled = (byte & 0x40) != 0;
			this.modeSettings.frameInterruptEnabled = (byte & 0x20) != 0;
			//this.modeSettings.lineMode: (byte & 0x10) != 0 && (byte & 0x08) != 0 ? VDP_LINE_MODE_192 : VDP_LINE_MODE_UNKNOWN;
			this.modeSettings.useLargeSprites = (byte & 0x02) != 0;
			this.modeSettings.spritePixelsAreDoubleSize = (byte & 0x01) != 0;
		
		} else if (registerIndex == VDP_REGISTER_INDEX_NAME_TABLE_BASE_ADDRESS) {

			this.registers.nameTableBaseAddress = (byte & 0x0e) << 10;

		} else if (registerIndex == VDP_REGISTER_INDEX_COLOR_TABLE_BASE_ADDRESS) {	

			// No effect.

		} else if (registerIndex == VDP_REGISTER_INDEX_BACKGROUND_PATTERN_GENERATOR_BASE_ADDRESS) {	

			// No effect.

		} else if (registerIndex == VDP_REGISTER_INDEX_SPRITE_ATTRIBUTE_TABLE_BASE_ADDRESS) {
			
			this.registers.spriteAttributeTableBaseAddress = (byte & 0x7e) << 7;

		} else if (registerIndex == VDP_REGISTER_INDEX_SPRITE_PATTERN_GENERATOR_BASE_ADDRESS) {

			this.registers.spritePatternGeneratorBaseAddress = (byte & 0x04) << 11;

		} else if (registerIndex == VDP_REGISTER_INDEX_OVERSCAN_COLOUR) {	

			this.registers.overscanColour = byte & 0x0f;

		} else if (registerIndex == VDP_REGISTER_INDEX_BACKGROUND_X_SCROLL) {

			this.registers.backgroundXScroll = byte;

		} else if (registerIndex == VDP_REGISTER_INDEX_BACKGROUND_Y_SCROLL) {	

			this.registers.backgroundYScroll = byte;

		} else if (registerIndex == VDP_REGISTER_INDEX_LINE_COUNTER) {	

			this.registers.lineCounter = byte;

		} else {

			console.log('Unimplemented register write: ' + registerIndex.toString(16) + ':' + byte.toString(16));
		}
	}

	this.generateScanLine = function () {

		let frameBufferData = this.frameBuffer.data;
		let frameBufferBaseOffset = this.currentScanlineIndex * this.frameBufferSize.width * 4;

		this.resetTileScanLineData()

		for (let x = 0; x < this.frameBufferSize.width; x++) {

			let colour = this.readNextScanLineColour();

			let frameBufferIndex = frameBufferBaseOffset + x * 4;

			frameBufferData[frameBufferIndex] = (colour & 0x03) * 85;
			frameBufferData[++frameBufferIndex] = ((colour & 0x0c) >> 2) * 85;
			frameBufferData[++frameBufferIndex] = ((colour & 0x30) >> 4) * 85;
			frameBufferData[++frameBufferIndex] = 255;
		}
	}

	this.resetTileScanLineData = function () {

		let d = this.tileScanLineData;

		let backgroundXScroll = 
			this.modeSettings.disableHorizontalScrollingForRows0To1 && 
			this.currentScanlineIndex < 16 ? 
			0 : this.registers.backgroundXScroll;

		d.scanLineX = 0;

		d.counter = -(backgroundXScroll % 8) & 0x07;

		d.nameTableColumn = -Math.ceil(backgroundXScroll / 8) & 0x1f;

		d.nameTableRow = Math.floor((this.currentScanlineIndex + this.registers.backgroundYScroll) / 8) % 28;

		d.loadTileData = true;

		// Gather the active sprites for the scanline.
		d.numberOfActiveSprites = 0;

		/*if (this.modeSettings.disableHorizontalScrollingForRows0To1) {
			throw 'Not implemented: disable horizontal scrolling for rows 0 to 1.';
		}*/

		if (this.modeSettings.shiftSpritesLeftBy8Pixels) {
			throw 'Not implemented: shift sprites left by 8 pixels.';
		}

		/*if (this.modeSettings.useLargeSprites) {
			throw 'Not implemented: use large sprites.';
		}*/

		if (this.modeSettings.spritePixelsAreDoubleSize) {
			throw 'Not implemented: sprite pixels are double size.'
		}

		for (let i = 0; i < 64; i++) {
			let spriteY = this.vram[this.registers.spriteAttributeTableBaseAddress + i];
			if (spriteY == 0xd0) {
				break;
			}

			// Sprite Y coordinates start from scanline 1.
			spriteY++;

			if (spriteY > 0xd0) {
				spriteY -= 0x100;
			}

			let spriteHeight = this.modeSettings.useLargeSprites ? 16 : 8; // FIXME
			if (this.currentScanlineIndex >= spriteY && this.currentScanlineIndex < spriteY + spriteHeight) {

				if (d.numberOfActiveSprites == 8) {
					// Set the sprite overflow status flag.
					this.statusFlags |= BIT6;
					break;
				}

				let sprite = d.sprites[d.numberOfActiveSprites];
				
				sprite.x = this.vram[this.registers.spriteAttributeTableBaseAddress + 128 + (i * 2)]; // FIXME - check bit 3 of reg 0.
				sprite.tileIndex = this.vram[this.registers.spriteAttributeTableBaseAddress + 128 + (i * 2) + 1];
				
				let tilePixelRow = this.currentScanlineIndex - spriteY;

				let tileIndex = sprite.tileIndex;
				if (this.modeSettings.useLargeSprites) {
					tileIndex &= 0xfe;
					if (tilePixelRow >= 8) {
						tileIndex++;
						tilePixelRow -= 8;
					}
				} 

				let tileDataBaseAddress = (tileIndex * 32) + (tilePixelRow * 4);
				tileDataBaseAddress += this.registers.spritePatternGeneratorBaseAddress;

				sprite.tilePlane0Byte = this.vram[tileDataBaseAddress];
				sprite.tilePlane1Byte = this.vram[tileDataBaseAddress + 1];
				sprite.tilePlane2Byte = this.vram[tileDataBaseAddress + 2];
				sprite.tilePlane3Byte = this.vram[tileDataBaseAddress + 3];
			
				d.numberOfActiveSprites++;
			}
		}
	}

	this.readNextScanLineColour = function () {

		let d = this.tileScanLineData;

		if (d.loadTileData) {
			this.loadScanLineTileData();
			d.loadTileData = false;
		}

		let tileColourIndex = this.loadScanLineTileColourIndex();
		let spriteColourIndex = this.loadScanLineSpriteColourIndex();

		let colourIndex = spriteColourIndex;
		let useSpritePallette = true;
		if (spriteColourIndex == 0 || (d.displayOnTopOfSprite && tileColourIndex > 0)) {
			colourIndex = tileColourIndex;
			useSpritePallette = false;
		}

		let basePalletteAddress = useSpritePallette ? 16 : d.palletteNumber * 16;
		let colour = this.cram[basePalletteAddress + colourIndex];

		if (this.modeSettings.maskColumn0WithOverscanColour && d.scanLineX < 8) {
			colour = 0; // FIXME - use border colour.
		}

		d.counter++;
		if (d.counter == 8) {
			d.counter = 0;
			d.loadTileData = true;

			d.nameTableColumn++;
			if (d.nameTableColumn == 32) {
				d.nameTableColumn = 0;
			}
		}

		d.scanLineX++;

		return colour;
	}

	this.loadScanLineTileData = function () {

		let d = this.tileScanLineData;

		let nameTableEntryAddress = 
			this.registers.nameTableBaseAddress +
			(d.nameTableRow << 6) +
			(d.nameTableColumn << 1);

		let nameTableEntryLowByte = this.vram[nameTableEntryAddress];
		let nameTableEntryHiByte = this.vram[nameTableEntryAddress + 1];
		let nameTableEntry = nameTableEntryLowByte | (nameTableEntryHiByte << 8);

		d.palletteNumber = (nameTableEntry & 0x800) >> 11;
		d.verticalFlip = (nameTableEntry & 0x400) != 0;
		d.horizontalFlip = (nameTableEntry & 0x200) != 0;
		d.displayOnTopOfSprite = (nameTableEntry & 0x1000) != 0;
		
		let tileIndex = nameTableEntry & 0x1ff;
		let tilePixelRow = (this.currentScanlineIndex + this.registers.backgroundYScroll) % 8;

		if (d.verticalFlip) {
			tilePixelRow = 7 - tilePixelRow;
		}

		let tileDataBaseAddress = (tileIndex * 32) + (tilePixelRow * 4);
		d.tilePlane0Byte = this.vram[tileDataBaseAddress];
		d.tilePlane1Byte = this.vram[tileDataBaseAddress + 1];
		d.tilePlane2Byte = this.vram[tileDataBaseAddress + 2];
		d.tilePlane3Byte = this.vram[tileDataBaseAddress + 3];
	}

	this.loadScanLineSpriteColourIndex = function () {
		
		let d = this.tileScanLineData;

		let spriteColourIndex = 0;

		//for (let i = d.numberOfActiveSprites - 1; i >= 0; i--) {
		for (let i = 0; i < d.numberOfActiveSprites; i++) {

			let sprite = d.sprites[i];
			let spriteWidth = 8; // FIXME

			if (d.scanLineX >= sprite.x && d.scanLineX < sprite.x + spriteWidth) {

				let tilePixelColumn = d.scanLineX - sprite.x;
				let tilePlaneBitNumber = (7 - tilePixelColumn);
				let tilePlaneBitMask = 1 << tilePlaneBitNumber;

				spriteColourIndex = 0;	

				if (sprite.tilePlane0Byte & tilePlaneBitMask) {
					spriteColourIndex |= 1;
				}

				if (sprite.tilePlane1Byte & tilePlaneBitMask) {
					spriteColourIndex |= 2;
				}

				if (sprite.tilePlane2Byte & tilePlaneBitMask) {
					spriteColourIndex |= 4;
				}

				if (sprite.tilePlane3Byte & tilePlaneBitMask) {
					spriteColourIndex |= 8;
				}

				if (spriteColourIndex > 15) {
					throw 'Invalid colour index: ' + spriteColourIndex;
				}

				if (spriteColourIndex > 0) {
					break;
				}
			}
		}

		return spriteColourIndex;
	}

	this.loadScanLineTileColourIndex = function () {

		let d = this.tileScanLineData;

		let tilePlaneBitNumber = d.horizontalFlip ? 
			(0 + d.counter) : (7 - d.counter);
		
		let tilePlaneBitMask = 1 << tilePlaneBitNumber;

		let tileColourIndex = 0;	

		if (d.tilePlane0Byte & tilePlaneBitMask) {
			tileColourIndex |= 1;
		}

		if (d.tilePlane1Byte & tilePlaneBitMask) {
			tileColourIndex |= 2;
		}

		if (d.tilePlane2Byte & tilePlaneBitMask) {
			tileColourIndex |= 4;
		}

		if (d.tilePlane3Byte & tilePlaneBitMask) {
			tileColourIndex |= 8;
		}

		if (tileColourIndex > 15) {
			throw 'Invalid colour index: ' + tileColourIndex;
		}

		return tileColourIndex;
	}

	this.convertByteToSigned = function (byte) {

		if (byte >= 128) {
			byte = -128 + (byte & 0x7F);
		}

		return byte;
	}

	this.init();
}