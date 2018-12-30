function Vdp() {
	
	var self = this;

	this.cpu = null;
	this.canvas = null;
	this.canvasContext = null;
	this.frameBufferImageData = null;
	this.frameBuffer = null;
	this.frameBufferSize = { width: 0, height: 0 };
	this.colourLookup = [];

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

	this.currentScanlineIndex = 0;
	//this.currentScanlinePixelIndex = 0;
	//this.numberOfCyclesToBurn = 0;
	//this.numberOfCyclesExecutedThisFrame = 0;
	this.controlWord = 0;
	this.controlWordFlag = false;
	this.lineCounter = 0;
	this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_VRAM;
	this.dataPortReadWriteAddress = 0;
	this.vCounter = 0;
	
	// Resolution-specific vars.
	this.vCounterJumpOnScanlineIndex = 219;
	this.vCounterJumpToIndex = 213;
	this.interruptAfterScanlineIndex = 192;
	this.nameTableHeight = 28;
	this.nameTableBaseAddressMask = 0x0e;
	this.nameTableBaseAddressOffset = 0;
	this.visibleScanlineCount = 192;
	this.stopDrawingSpritesWhenLine208IsFound = true;

	this.statusFlags = 0;
	this.readBufferByte = 0;

	this.modeSettings = {
		disableVerticalScrollingForColumns24To31: false,
		disableHorizontalScrollingForRows0To1: false,
		maskColumn0WithOverscanColour: false,
		enableLineInterrupts: false,
		shiftSpritesLeftBy8Pixels: false,
		displayMode: VDP_DISPLAY_MODE_UNKNOWN,
		enableExtendedLineModes: false,
		displayIsMonochrome: false,
		displayEnabled: false,
		frameInterruptEnabled: false,
		lineMode: VDP_LINE_MODE_UNKNOWN,
		useLargeSprites: false,
		spritePixelsAreDoubleSize: false
	}

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
	}

	this.init = function () {

		this.initTileScanLineData();

		this.initColourLookup();

		//this.initFrameBuffer();

		window.addEventListener('resize', function () {
			self.scaleCanvas();			
		});

		this.reset();
	}

	this.initTileScanLineData = function () {

		for (let i = 0; i < 8; i++) {
			this.tileScanLineData.sprites[i] = {
				x: 0,
				tileIndex: 0,
				tilePlane0Byte: 0,
				tilePlane1Byte: 0,
				tilePlane2Byte: 0,
				tilePlane3Byte: 0
			}
		}
	}

	this.initColourLookup = function () {

		for (let colour = 0; colour <= 255; colour++) {
			let r = (colour & 0x03) * 85;
			let g = ((colour & 0x0c) >> 2) * 85;
			let b = ((colour & 0x30) >> 4) * 85;
			let a = 255;

			this.colourLookup[colour] = (a << 24) | (b << 16) | (g << 8) | r;
		}
	}

	this.checkFrameBuffer = function () {

		let requiredFrameBufferWidth = 256;
		let requiredFrameBufferHeight = 192;

		if (this.modeSettings.displayMode == 4 && this.modeSettings.enableExtendedLineModes) {
			if (this.modeSettings.lineMode == VDP_LINE_MODE_224) {
				requiredFrameBufferHeight = 224;
			} else if (this.modeSettings.lineMode == VDP_LINE_MODE_240) {
				requiredFrameBufferHeight = 240;
			}
		}

		if (this.frameBufferSize.width != requiredFrameBufferWidth || 
			this.frameBufferSize.height != requiredFrameBufferHeight) {

			this.frameBufferSize.width = requiredFrameBufferWidth;
			this.frameBufferSize.height = requiredFrameBufferHeight;

			let canvasContainer = document.getElementById('sms-canvas-container');
			canvasContainer.innerHTML = 
				'<canvas ' + 
				'	id="sms-canvas" ' + 
				'	style="image-rendering: pixelated; image-rendering: -moz-crisp-edges;" ' + 
				'	width="' + this.frameBufferSize.width + '" height="' + this.frameBufferSize.height + '">' + 
				'</canvas>';

			this.scaleCanvas();

			this.canvas = document.getElementById('sms-canvas');
			this.canvasContext = this.canvas.getContext('2d');

			this.frameBufferImageData = this.canvasContext.createImageData(
				this.frameBufferSize.width, 
				this.frameBufferSize.height); 

			this.frameBuffer = new Uint32Array(this.frameBufferImageData.data.buffer);
		}
	}

	this.scaleCanvas = function () {

		if (this.frameBufferSize.width > 0 && this.frameBufferSize.height > 0) {
			let canvasContainer = document.getElementById('sms-canvas-container');

			let canvasScaleX = Math.floor(window.innerWidth / this.frameBufferSize.width);
			let canvasScaleY = Math.floor(window.innerHeight / this.frameBufferSize.height);
			let canvasScale = canvasScaleX < canvasScaleY ? canvasScaleX : canvasScaleY;

			canvasContainer.style.width = (this.frameBufferSize.width * canvasScale) + 'px';
			canvasContainer.style.height = (this.frameBufferSize.height * canvasScale) + 'px';
			canvasContainer.style.marginTop = ((window.innerHeight - (this.frameBufferSize.height * canvasScale)) / 2) + 'px';
		}
	}

	this.enterFullscreen = function () {

		let element = document.getElementById("sms-canvas"); 

		if (element.requestFullscreen) {
			element.requestFullscreen();
		} else if (element.mozRequestFullScreen) {
			element.mozRequestFullScreen();
		} else if (element.webkitRequestFullscreen) {
			element.webkitRequestFullscreen();
		} else if (element.msRequestFullscreen) {
			element.msRequestFullscreen();
		}
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

	this.executeScanline = function () {

		let raiseInterrupt = false;

		this.checkFrameBuffer();

		// Update line-mode specific variables.
		this.vCounterJumpOnScanlineIndex = 219;
		this.vCounterJumpToIndex = 213;
		this.interruptAfterScanlineIndex = 192;
		this.nameTableHeight = 28;
		this.nameTableBaseAddressMask = 0x0e;
		this.nameTableBaseAddressOffset = 0;
		this.visibleScanlineCount = 192;
		this.stopDrawingSpritesWhenLine208IsFound = true;

		if (this.modeSettings.displayMode == 4 && this.modeSettings.enableExtendedLineModes) {
			if (this.modeSettings.lineMode == VDP_LINE_MODE_224) {
				this.vCounterJumpOnScanlineIndex = 235;
				this.vCounterJumpToIndex = 229;
				this.interruptAfterScanlineIndex = 224;
				this.nameTableHeight = 32;
				this.nameTableBaseAddressMask = 0x0c;
				this.nameTableBaseAddressOffset = 0x700;
				this.visibleScanlineCount = 224;
				this.stopDrawingSpritesWhenLine208IsFound = false;
			} else if (this.modeSettings.lineMode == VDP_LINE_MODE_240) {
				this.vCounterJumpOnScanlineIndex = 256;
				this.vCounterJumpToIndex = 0;
				this.interruptAfterScanlineIndex = 240;
				this.nameTableHeight = 32;
				this.nameTableBaseAddressMask = 0x0c;
				this.nameTableBaseAddressOffset = 0x700;
				this.visibleScanlineCount = 240;
				this.stopDrawingSpritesWhenLine208IsFound = false;
			}
		}

		// Render the scanline all in one go.
		if (this.modeSettings.displayEnabled &&
			this.currentScanlineIndex < this.visibleScanlineCount) {

			this.generateScanLine();
		}

		// Increment the v-counter. 
		// The v-counter jumps back on certain lines, so that its value still fits into a byte at the end of the frame.
		if (this.currentScanlineIndex == this.vCounterJumpOnScanlineIndex) {
			this.vCounter = this.vCounterJumpToIndex;
		} else {
			this.vCounter++;
			this.vCounter &= 0xff;
		}

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

		// See if we need to raise the frame interrupt.
		// This is a bit odd - the documentation clearly states that the frame
		// status flag is set on scanline 192, so you'd assume that the interrupt
		// would be raised at the same time. However, Zool doesn't work unless you
		// raise the interrupt on the scanline after, which is how MEKA seems to do it.
		if (this.currentScanlineIndex == this.interruptAfterScanlineIndex) {

			// Set the frame-interrupt-pending status flag.
			this.statusFlags |= BIT7;
		}

		if (this.currentScanlineIndex == this.interruptAfterScanlineIndex + 1 && 
			(this.statusFlags & BIT7) && 
			this.modeSettings.frameInterruptEnabled) {

			if (this.modeSettings.frameInterruptEnabled) {
				raiseInterrupt = true;
			}
		}		

		// If we need to raise an interrupt, do it now.
		if (raiseInterrupt) {

			this.cpu.raiseMaskableInterrupt();
		}

		// Increment our internal scanline index.
		this.currentScanlineIndex++;
		if (this.currentScanlineIndex == 262) {
			this.currentScanlineIndex = 0;
		}
	}

	this.presentFrame = function () {

		this.canvasContext.putImageData(this.frameBufferImageData, 0, 0);
	}

	this.setCpu = function (cpu) {

		this.cpu = cpu;
	}

	this.readByteFromVCounterPort = function () {

		return this.vCounter;
	}

	this.readByteFromDataPort = function () {

		this.controlWordFlag = false;

		let byte = this.readBufferByte;

		this.readBufferByte = this.vram[this.dataPortReadWriteAddress];

		this.dataPortReadWriteAddress++;
		this.dataPortReadWriteAddress &= 0x3fff;

		return byte;
	}

	this.writeByteToDataPort = function (byte) {

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

		if (!this.controlWordFlag) {

			this.controlWord = byte;
			this.controlWordFlag = true;
		
		} else {

			this.controlWord |= (byte << 8);
			this.controlWordFlag = false;

			let controlCode = (this.controlWord & 0xc000) >> 14;
			this.dataPortReadWriteAddress = (this.controlWord & 0x3fff);

			if (controlCode == VDP_CONTROL_CODE_READWRITE_VRAM) {

				this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_VRAM;

				this.readBufferByte = this.vram[this.dataPortReadWriteAddress];

				this.dataPortReadWriteAddress++;
				this.dataPortReadWriteAddress &= 0x3fff;
			
			} else if (controlCode == VDP_CONTROL_CODE_ENABLE_DATA_PORT_VRAM_WRITES) {

				this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_VRAM;

			} else if (controlCode == VDP_CONTROL_CODE_WRITE_REGISTER) {

				let registerIndex = (this.controlWord & 0x0f00) >> 8;
				let dataByte = this.controlWord & 0x00ff;

				this.writeByteToRegister(registerIndex, dataByte);

			} else if (controlCode == VDP_CONTROL_CODE_ENABLE_DATA_PORT_CRAM_WRITES) {

				this.dataPortWriteMode = VDP_DATA_PORT_WRITE_MODE_CRAM;
			}
		}
	}

	this.writeByteToRegister = function (registerIndex, byte) {

		if (registerIndex == VDP_REGISTER_INDEX_MODE_CONTROL_1) {

			this.modeSettings.disableVerticalScrollingForColumns24To31 = (byte & 0x80) != 0;
			this.modeSettings.disableHorizontalScrollingForRows0To1 = (byte & 0x40) != 0;
			this.modeSettings.maskColumn0WithOverscanColour = (byte & 0x20) != 0;
			this.modeSettings.enableLineInterrupts = (byte & 0x10) != 0;
			this.modeSettings.shiftSpritesLeftBy8Pixels = (byte & 0x08) != 0;
			this.modeSettings.displayMode = (byte & 0x04) != 0 ? VDP_DISPLAY_MODE_4 : VDP_DISPLAY_MODE_UNKNOWN;
			this.modeSettings.enableExtendedLineModes = (byte & 0x02) != 0;
			this.modeSettings.displayIsMonochrome = (byte & 0x01) != 0;

		} else if (registerIndex == VDP_REGISTER_INDEX_MODE_CONTROL_2) {

			let m1 = (byte & 0x10) != 0;
			let m3 = (byte & 0x08) != 0;

			this.modeSettings.displayEnabled = (byte & 0x40) != 0;
			this.modeSettings.frameInterruptEnabled = (byte & 0x20) != 0;
			this.modeSettings.lineMode = (byte & 0x08) != 0 ? VDP_LINE_MODE_240 : (byte & 0x10) != 0 ? VDP_LINE_MODE_224 : VDP_LINE_MODE_192;
			this.modeSettings.useLargeSprites = (byte & 0x02) != 0;
			this.modeSettings.spritePixelsAreDoubleSize = (byte & 0x01) != 0;
		
		} else if (registerIndex == VDP_REGISTER_INDEX_NAME_TABLE_BASE_ADDRESS) {

			//this.registers.nameTableBaseAddress = (byte & 0x0e) << 10;
			this.registers.nameTableBaseAddress = byte;

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

		if (this.frameBuffer != null) {
			let frameBufferData = this.frameBuffer.data;
			let frameBufferIndex = this.currentScanlineIndex * this.frameBufferSize.width;

			this.resetTileScanLineData()

			for (let x = 0; x < this.frameBufferSize.width; x++) {

				let colour = this.readNextScanLineColour();

				this.frameBuffer[frameBufferIndex] = this.colourLookup[colour];
				frameBufferIndex++;
			}
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

		d.nameTableRow = Math.floor((this.currentScanlineIndex + this.registers.backgroundYScroll) / 8) % this.nameTableHeight;

		d.loadTileData = true;

		// Gather the active sprites for the scanline.
		d.numberOfActiveSprites = 0;

		if (this.modeSettings.shiftSpritesLeftBy8Pixels) {
			throw 'Not implemented: shift sprites left by 8 pixels.';
		}

		if (this.modeSettings.spritePixelsAreDoubleSize) {
			throw 'Not implemented: sprite pixels are double size.'
		}

		for (let i = 0; i < 64; i++) {
			let spriteY = this.vram[this.registers.spriteAttributeTableBaseAddress + i];
			if (spriteY == 0xd0 && this.stopDrawingSpritesWhenLine208IsFound) {
				break;
			}

			// Sprite Y coordinates start from scanline 1.
			spriteY++;

			if (spriteY > 0xd0 && this.stopDrawingSpritesWhenLine208IsFound) {
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
			colour = this.cram[16 + this.registers.overscanColour];
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
			((this.registers.nameTableBaseAddress & this.nameTableBaseAddressMask) << 10) + this.nameTableBaseAddressOffset +
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