function Cpu() {

	let self = this;

	////////////////////////////// Members //////////////////////////////

	this.mmc = null;
	this.ioc = null;

	this.registers = { 
		a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0, f: 0, 
		ixh: 0, ixl: 0, iyh: 0, iyl: 0,
		pc: 0, sp: 0xdff0, r: 0 
	};

	this.shadowRegisters = { 
		a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0, f: 0 
	};

	this.opCodeFunctions = [];
	this.bitOpCodeFunctions = [];
	this.extOpCodeFunctions = [];
	this.ixOpCodeFunctions = [];
	this.iyOpCodeFunctions = [];
	this.ixBitOpCodeFunctions = [];
	this.iyBitOpCodeFunctions = [];
	this.parityLookUp = [];
	this.maskableInterruptsEnabled = false;
	this.maskableInterruptWaiting = false;
	this.interruptMode = 0;
	this.xyDisplacement = 0;
	this.isHalted = false;
	this.numberOfCyclesToBurn = 0;
	this.numberOfCyclesExecutedThisFrame = 0;
	this.totalNumberOfCyclesExecuted = 0;
	this.isSteppingThrough = false;

	////////////////////////////// General Methods //////////////////////////////

	this.init = function () {

		this.buildParityLookUp();

		let opCodeFunctionSets = [
			{ name: 'Main', opCodeFunctions: this.opCodeFunctions, implementedCount: 0 },
			{ name: 'Bit', opCodeFunctions: this.bitOpCodeFunctions, implementedCount: 0 },
			{ name: 'Ext', opCodeFunctions: this.extOpCodeFunctions, implementedCount: 0 },
			{ name: 'IX', opCodeFunctions: this.ixOpCodeFunctions, implementedCount: 0 },
			{ name: 'IY', opCodeFunctions: this.iyOpCodeFunctions, implementedCount: 0 },
			{ name: 'IX Bit', opCodeFunctions: this.ixBitOpCodeFunctions, implementedCount: 0 },
			{ name: 'IY Bit', opCodeFunctions: this.iyBitOpCodeFunctions, implementedCount: 0 }
		]

		let dumpMissingOpcodes = false;

		for (let i = 0; i < opCodeFunctionSets.length; i++) {
			var set = opCodeFunctionSets[i];

			for (let j = 0; j <= 0xff; j++) {

				if (set.opCodeFunctions[j] != null) {
					set.implementedCount++;
				}
			}

			this.log(set.implementedCount + '/256 ' + set.name + ' op codes implemented.');

			if (dumpMissingOpcodes) {
				for (let j = 0; j <= 0xff; j++) {

					if (this.opCodeFunctions[j] == null) {
						console.log('Missing ' + set.name + ' op-code: ' + j.toString(16));
					}
				}
			}
		}

		this.reset();
	}

	this.reset = function () {
		
		this.registers.a = 0;
		this.registers.b = 0; 
		this.registers.c = 0; 
		this.registers.d = 0; 
		this.registers.e = 0; 
		this.registers.h = 0; 
		this.registers.l = 0; 
		this.registers.f = 0; 
		this.registers.ixh = 0;
		this.registers.ixl = 0; 
		this.registers.iyh = 0; 
		this.registers.iyl = 0;
		this.registers.pc = 0;
		this.registers.sp = 0xdff0;
		this.registers.r = 0;

		this.shadowRegisters.a = 0; 
		this.shadowRegisters.b = 0; 
		this.shadowRegisters.c = 0; 
		this.shadowRegisters.d = 0; 
		this.shadowRegisters.e = 0; 
		this.shadowRegisters.h = 0; 
		this.shadowRegisters.l = 0; 
		this.shadowRegisters.f = 0; 
		
		this.maskableInterruptsEnabled = false;
		this.maskableInterruptWaiting = false;
		this.interruptMode = 0;
		this.xyDisplacement = 0;
		this.isHalted = false;
		this.numberOfCyclesToBurn = 0;
		this.numberOfCyclesExecutedThisFrame = 0;
		this.totalNumberOfCyclesExecuted = 0;
	}

	this.tick = function () {

		if (this.numberOfCyclesToBurn == 0) {

			if (this.maskableInterruptWaiting) {

				this.handleMaskableInterrupt();
			}

			if (this.isHalted) {

				this.numberOfCyclesToBurn = 1;

			} else {

				//////////////
				/*if (this.registers.pc == 0x0c4b) {
					//this.debugFlag1 = true;
					this.isSteppingThrough = true;
				}

				if (this.debugFlag1 && this.registers.pc == 0x0c47) {
					this.isSteppingThrough = true;
				}*/
				//////////////

				let opCode = this.mmc.readByte(this.registers.pc);

				var opCodeFunction = this.opCodeFunctions[opCode];

				if (opCodeFunction == null) {
					this.crash('Op-code function not found for 0x' + opCode.toString(16));
				}

				if (this.isSteppingThrough) {
					console.log(this.registers.pc.toString(16) + ': Op code: ' + opCode.toString(16));
					this.dump();
					debugger;
				}

				inc_pc();
				inc_r();

				this.numberOfCyclesToBurn = opCodeFunction();
			}
		}

		this.numberOfCyclesToBurn--;
		this.numberOfCyclesExecutedThisFrame++;
		this.totalNumberOfCyclesExecuted++;
	}

	this.startFrame = function () {

		if (this.numberOfCyclesExecutedThisFrame > 0 && 
			this.numberOfCyclesExecutedThisFrame != 59736) {
			//throw 'Incorrect number of CPU clocks executed last frame.';
		}

		this.numberOfCyclesExecutedThisFrame = 0;
	}

	this.raiseMaskableInterrupt = function () {

		if (this.maskableInterruptsEnabled) {

			this.maskableInterruptWaiting = true;
		}
	}

	this.crash = function (reason) {

		this.dump();
		throw reason;
	}

	this.setMmc = function (mmc) {

		this.mmc = mmc;
	}

	this.setIoc = function (ioc) {

		this.ioc = ioc;
	}

	this.handleMaskableInterrupt = function () {

		pushWord(this.registers.pc);
		this.registers.pc = 0x0038;

		this.isHalted = false;
		this.maskableInterruptWaiting = false;
		this.maskableInterruptsEnabled = false;
	}

	this.buildParityLookUp = function () {

		for (let i = 0; i <= 0xff; i++) {
			let bitCount = 0;
			for (let j = 0; j < 8; j++) {
				if ((i & (1 << j)) != 0) {
					bitCount++;
				}
			}

			this.parityLookUp[i] = bitCount % 2 == 0;
		}
	}

	this.log = function (message) {

		console.log('CPU: ' + message);
	}

	this.dump = function () {

		let output = '';
		
		output += 'AF:' + this.registers.a.toString(16) + this.registers.f.toString(16) + ' ';
		output += 'BC:' + this.registers.b.toString(16) + this.registers.c.toString(16) + ' ';
		output += 'DE:' + this.registers.d.toString(16) + this.registers.e.toString(16) + ' ';
		output += 'HL:' + this.registers.h.toString(16) + this.registers.l.toString(16) + ' ';
		output += 'IX:' + get_ix().toString(16) + ' ';
		output += 'IY:' + get_iy().toString(16) + '\n';
		output += 'PC:' + this.registers.pc.toString(16) + ' ';
		output += 'SP:' + this.registers.sp.toString(16) + ' ';;
		output += 'R:' + this.registers.r.toString(16) + ' ';
		output += 'CYC: ' + this.totalNumberOfCyclesExecuted;

		console.log(output.toUpperCase());
	}

	////////////////////////////// Opcode Short-hand Members //////////////////////////////

	let ocf = this.opCodeFunctions; 
	let bocf = this.bitOpCodeFunctions;
	let eocf = this.extOpCodeFunctions; 
	let ixocf = this.ixOpCodeFunctions; 
	let iyocf = this.iyOpCodeFunctions;
	let ixbocf = this.ixBitOpCodeFunctions; 
	let iybocf = this.iyBitOpCodeFunctions;
	let r = this.registers;
	let sr = this.shadowRegisters;

	////////////////////////////// Opcode Helper Methods //////////////////////////////

	function get_af() { return (r.a << 8) + r.f; }
	function get_bc() { return (r.b << 8) + r.c; }
	function get_de() { return (r.d << 8) + r.e; }
	function get_hl() { return (r.h << 8) + r.l; }
	function get_ix() { return (r.ixh << 8) + r.ixl; }
	function get_iy() { return (r.iyh << 8) + r.iyl; }

	function set_af(v) { r.a = v >> 8; r.f = v & 0xff; }
	function set_bc(v) { r.b = v >> 8; r.c = v & 0xff; }
	function set_de(v) { r.d = v >> 8; r.e = v & 0xff; }
	function set_hl(v) { r.h = v >> 8; r.l = v & 0xff; }
	function set_ix(v) { r.ixh = v >> 8; r.ixl = v & 0xff; }
	function set_iy(v) { r.iyh = v >> 8; r.iyl = v & 0xff; }

	function inc_pc() { r.pc++; r.pc &= 0xffff; }
	function inc2_pc() { r.pc += 2; r.pc &= 0xffff; }
	function dec2_pc() { r.pc -= 2; r.pc &= 0xffff; }
	function add_pc_signed(v) { r.pc += convertByteToSigned(v); r.pc &= 0xffff; }

	function inc_sp() { r.sp++; r.sp &= 0xffff; }
	function inc2_sp() { r.sp += 2; r.sp &= 0xffff; }
	function dec_sp() { r.sp--; r.sp &= 0xffff; }
	function dec2_sp() { r.sp -= 2; r.sp &= 0xffff; }

	function inc_r() { r.r++; r.r &= 0xff; }
	function inc2_r() { r.r += 2; r.r &= 0xff; }

	function rb (address) { return self.mmc.readByte(address); }
	function rw (address) { return self.mmc.readWord(address); }
	function wb (address, value) { self.mmc.writeByte(address, value); }
	function ww (address, value) { self.mmc.writeWord(address, value); }

	function pushByte(byte) {

		dec_sp();
		wb(r.sp, byte);
	}

	function pushWord(word) {

		dec2_sp(); 
		ww(r.sp, word);
	}

	function popByte() {

		let byte = rb(r.sp);
		inc_sp();

		return byte;
	}

	function popWord() {

		let word = rw(r.sp);
		inc2_sp();

		return word;
	}

	function convertByteToSigned(byte) {

		if (byte >= 128) {
			byte = -128 + (byte & 0x7F);
		}

		return byte;
	}

	////////////////////////////// Opcode Init //////////////////////////////

	for (let i = 0; i <= 0xff; i++) {
		this.opCodeFunctions[i] = null;
		this.bitOpCodeFunctions[i] = null;
		this.extOpCodeFunctions[i] = null;
		this.ixOpCodeFunctions[i] = null;
		this.iyOpCodeFunctions[i] = null;
		this.ixBitOpCodeFunctions[i] = null;
		this.iyBitOpCodeFunctions[i] = null;
	}

	////////////////////////////// 8 Bit Load Opcodes //////////////////////////////

	// ld a,*
	ocf[0x3e] = function () { r.a = rb(r.pc); inc_pc(); return 7; };
	// ld b,*
	ocf[0x06] = function () { r.b = rb(r.pc); inc_pc(); return 7; };
	// ld c,*
	ocf[0x0e] = function () { r.c = rb(r.pc); inc_pc(); return 7; };
	// ld d,*
	ocf[0x16] = function () { r.d = rb(r.pc); inc_pc(); return 7; };
	// ld e,*
	ocf[0x1e] = function () { r.e = rb(r.pc); inc_pc(); return 7; };
	// ld h,*
	ocf[0x26] = function () { r.h = rb(r.pc); inc_pc(); return 7; };
	// ld l,*
	ocf[0x2e] = function () { r.l = rb(r.pc); inc_pc(); return 7; };

	// ld a,a
	ocf[0x7f] = function () { r.a = r.a; return 4; };
	// ld a,b
	ocf[0x78] = function () { r.a = r.b; return 4; };
	// ld a,c
	ocf[0x79] = function () { r.a = r.c; return 4; };
	// ld a,d
	ocf[0x7a] = function () { r.a = r.d; return 4; };
	// ld a,e
	ocf[0x7b] = function () { r.a = r.e; return 4; };
	// ld a,h
	ocf[0x7c] = function () { r.a = r.h; return 4; };
	// ld a,l
	ocf[0x7d] = function () { r.a = r.l; return 4; };

	// ld b,a
	ocf[0x47] = function () { r.b = r.a; return 4; };
	// ld b,b
	ocf[0x40] = function () { r.b = r.b; return 4; };
	// ld b,c
	ocf[0x41] = function () { r.b = r.c; return 4; };
	// ld b,d
	ocf[0x42] = function () { r.b = r.d; return 4; };
	// ld b,e
	ocf[0x43] = function () { r.b = r.e; return 4; };
	// ld b,h
	ocf[0x44] = function () { r.b = r.h; return 4; };
	// ld b,l
	ocf[0x45] = function () { r.b = r.l; return 4; };

	// ld c,a
	ocf[0x4f] = function () { r.c = r.a; return 4; };
	// ld c,b
	ocf[0x48] = function () { r.c = r.b; return 4; };
	// ld c,c
	ocf[0x49] = function () { r.c = r.c; return 4; };
	// ld c,d
	ocf[0x4a] = function () { r.c = r.d; return 4; };
	// ld c,e
	ocf[0x4b] = function () { r.c = r.e; return 4; };
	// ld c,h
	ocf[0x4c] = function () { r.c = r.h; return 4; };
	// ld c,l
	ocf[0x4d] = function () { r.c = r.l; return 4; };

	// ld d,a
	ocf[0x57] = function () { r.d = r.a; return 4; };
	// ld d,b
	ocf[0x50] = function () { r.d = r.b; return 4; };
	// ld d,c
	ocf[0x51] = function () { r.d = r.c; return 4; };
	// ld d,d
	ocf[0x52] = function () { r.d = r.d; return 4; };
	// ld d,e
	ocf[0x53] = function () { r.d = r.e; return 4; };
	// ld d,h
	ocf[0x54] = function () { r.d = r.h; return 4; };
	// ld d,l
	ocf[0x55] = function () { r.d = r.l; return 4; };

	// ld e,a
	ocf[0x5f] = function () { r.e = r.a; return 4; };
	// ld e,b
	ocf[0x58] = function () { r.e = r.b; return 4; };
	// ld e,c
	ocf[0x59] = function () { r.e = r.c; return 4; };
	// ld e,d
	ocf[0x5a] = function () { r.e = r.d; return 4; };
	// ld e,e
	ocf[0x5b] = function () { r.e = r.e; return 4; };
	// ld e,h
	ocf[0x5c] = function () { r.e = r.h; return 4; };
	// ld e,l
	ocf[0x5d] = function () { r.e = r.l; return 4; };

	// ld h,a
	ocf[0x67] = function () { r.h = r.a; return 4; };
	// ld h,b
	ocf[0x60] = function () { r.h = r.b; return 4; };
	// ld h,c
	ocf[0x61] = function () { r.h = r.c; return 4; };
	// ld h,d
	ocf[0x62] = function () { r.h = r.d; return 4; };
	// ld h,e
	ocf[0x63] = function () { r.h = r.e; return 4; };
	// ld h,h
	ocf[0x64] = function () { r.h = r.h; return 4; };
	// ld h,l
	ocf[0x65] = function () { r.h = r.l; return 4; };

	// ld l,a
	ocf[0x6f] = function () { r.l = r.a; return 4; };
	// ld l,b
	ocf[0x68] = function () { r.l = r.b; return 4; };
	// ld l,c
	ocf[0x69] = function () { r.l = r.c; return 4; };
	// ld l,d
	ocf[0x6a] = function () { r.l = r.d; return 4; };
	// ld l,e
	ocf[0x6b] = function () { r.l = r.e; return 4; };
	// ld l,h
	ocf[0x6c] = function () { r.l = r.h; return 4; };
	// ld l,l
	ocf[0x6d] = function () { r.l = r.l; return 4; };

	// ld a,(**)
	ocf[0x3a] = function () { let address = rw(r.pc); inc2_pc(); r.a = rb(address); return 13; };
	// ld (**),a
	ocf[0x32] = function () { let address = rw(r.pc); inc2_pc(); wb(address, r.a); return 13; };

	// ld a,(hl)
	ocf[0x7e] = function () { r.a = rb(get_hl()); return 7; };
	// ld b,(hl)
	ocf[0x46] = function () { r.b = rb(get_hl()); return 7; };
	// ld c,(hl)
	ocf[0x4e] = function () { r.c = rb(get_hl()); return 7; };
	// ld d,(hl)
	ocf[0x56] = function () { r.d = rb(get_hl()); return 7; };
	// ld e,(hl)
	ocf[0x5e] = function () { r.e = rb(get_hl()); return 7; };
	// ld h,(hl)
	ocf[0x66] = function () { r.h = rb(get_hl()); return 7; };
	// ld l,(hl)
	ocf[0x6e] = function () { r.l = rb(get_hl()); return 7; };

	// ld a,(bc)
	ocf[0x0a] = function () { r.a = rb(get_bc()); return 7; };
	// ld a,(de)
	ocf[0x1a] = function () { r.a = rb(get_de()); return 7; };

	// ld (de),a
	ocf[0x12] = function () { wb(get_de(), r.a); return 7; };
	// ld (bc),a
	ocf[0x02] = function () { wb(get_bc(), r.a); return 7; };

	////////////////////////////// 16 Bit Load Opcodes //////////////////////////////

	// ld bc,**
	ocf[0x01] = function () { set_bc(rw(r.pc)); inc2_pc(); return 10; };
	// ld de,**
	ocf[0x11] = function () { set_de(rw(r.pc)); inc2_pc(); return 10; };
	// ld hl,**
	ocf[0x21] = function () { set_hl(rw(r.pc)); inc2_pc(); return 10; };
	// ld sp,**
	ocf[0x31] = function () { r.sp = rw(r.pc); inc2_pc(); return 10; };
	// ld sp,hl
	ocf[0xf9] = function () { r.sp = get_hl(); return 6; };

	// ld (**),hl
	ocf[0x22] = function () { let address = rw(r.pc); inc2_pc(); ww(address, get_hl()); return 16; };
	// ld (hl),*
	ocf[0x36] = function () { let byte = rb(r.pc); inc_pc(); wb(get_hl(), byte); return 10; };
	// ld hl,(**)
	ocf[0x2a] = function () { let address = rw(r.pc); inc2_pc(); let word = rw(address); set_hl(word); return 16; };
	
	// ld (hl),a
	ocf[0x77] = function () { wb(get_hl(), r.a); return 7; };
	// ld (hl),b
	ocf[0x70] = function () { wb(get_hl(), r.b); return 7; };
	// ld (hl),c
	ocf[0x71] = function () { wb(get_hl(), r.c); return 7; };
	// ld (hl),d
	ocf[0x72] = function () { wb(get_hl(), r.d); return 7; };
	// ld (hl),e
	ocf[0x73] = function () { wb(get_hl(), r.e); return 7; };
	// ld (hl),h
	ocf[0x74] = function () { wb(get_hl(), r.h); return 7; };
	// ld (hl),l
	ocf[0x75] = function () { wb(get_hl(), r.l); return 7; };

	////////////////////////////// 8 Bit ALU Opcodes //////////////////////////////

	// cpl
	ocf[0x2f] = function () { r.a = cpl_8bit(r.a); return 4; }

	// inc a
	ocf[0x3c] = function () { r.a = inc_8bit(r.a); return 4; }
	// inc b
	ocf[0x04] = function () { r.b = inc_8bit(r.b); return 4; }
	// inc c
	ocf[0x0c] = function () { r.c = inc_8bit(r.c); return 4; }
	// inc d
	ocf[0x14] = function () { r.d = inc_8bit(r.d); return 4; }
	// inc e
	ocf[0x1c] = function () { r.e = inc_8bit(r.e); return 4; }
	// inc h
	ocf[0x24] = function () { r.h = inc_8bit(r.h); return 4; }
	// inc l
	ocf[0x2c] = function () { r.l = inc_8bit(r.l); return 4; }
	// inc (hl)
	ocf[0x34] = function () { let address = get_hl(); wb(address, inc_8bit(rb(address))); return 11; }

	// dec a
	ocf[0x3d] = function () { r.a = dec_8bit(r.a); return 4; }
	// dec b
	ocf[0x05] = function () { r.b = dec_8bit(r.b); return 4; }
	// dec c
	ocf[0x0d] = function () { r.c = dec_8bit(r.c); return 4; }
	// dec d
	ocf[0x15] = function () { r.d = dec_8bit(r.d); return 4; }
	// dec e
	ocf[0x1d] = function () { r.e = dec_8bit(r.e); return 4; }
	// dec h
	ocf[0x25] = function () { r.h = dec_8bit(r.h); return 4; }
	// dec l
	ocf[0x2d] = function () { r.l = dec_8bit(r.l); return 4; }
	// dec (hl)
	ocf[0x35] = function () { let address = get_hl(); wb(address, dec_8bit(rb(address))); return 11; }

	// add a,a
	ocf[0x87] = function () { r.a = add_8bit(r.a, r.a); return 4; }
	// add a,b
	ocf[0x80] = function () { r.a = add_8bit(r.a, r.b); return 4; }
	// add a,c
	ocf[0x81] = function () { r.a = add_8bit(r.a, r.c); return 4; }
	// add a,d
	ocf[0x82] = function () { r.a = add_8bit(r.a, r.d); return 4; }
	// add a,e
	ocf[0x83] = function () { r.a = add_8bit(r.a, r.e); return 4; }
	// add a,h
	ocf[0x84] = function () { r.a = add_8bit(r.a, r.h); return 4; }
	// add a,l
	ocf[0x85] = function () { r.a = add_8bit(r.a, r.l); return 4; }
	// add a,(hl)
	ocf[0x86] = function () { let byte = rb(get_hl()); r.a = add_8bit(r.a, byte); return 7; }
	// add a,*
	ocf[0xc6] = function () { let byte = rb(r.pc); inc_pc(); r.a = add_8bit(r.a, byte); return 7; }

	// adc a,a
	ocf[0x8f] = function () { r.a = adc_8bit(r.a, r.a); return 4; }
	// adc a,b
	ocf[0x88] = function () { r.a = adc_8bit(r.a, r.b); return 4; }
	// adc a,c
	ocf[0x89] = function () { r.a = adc_8bit(r.a, r.c); return 4; }
	// adc a,d
	ocf[0x8a] = function () { r.a = adc_8bit(r.a, r.d); return 4; }
	// adc a,e
	ocf[0x8b] = function () { r.a = adc_8bit(r.a, r.e); return 4; }
	// adc a,h
	ocf[0x8c] = function () { r.a = adc_8bit(r.a, r.h); return 4; }
	// adc a,l
	ocf[0x8d] = function () { r.a = adc_8bit(r.a, r.l); return 4; }
	// adc a,(hl)
	ocf[0x8e] = function () { let byte = rb(get_hl()); r.a = adc_8bit(r.a, byte); return 7; }
	// adc a,*
	ocf[0xce] = function () { let byte = rb(r.pc); inc_pc(); r.a = adc_8bit(r.a, byte); return 7; }

	// sub a
	ocf[0x97] = function () { r.a = sub_8bit(r.a, r.a); return 4; }
	// sub b
	ocf[0x90] = function () { r.a = sub_8bit(r.a, r.b); return 4; }
	// sub c
	ocf[0x91] = function () { r.a = sub_8bit(r.a, r.c); return 4; }
	// sub d
	ocf[0x92] = function () { r.a = sub_8bit(r.a, r.d); return 4; }
	// sub e
	ocf[0x93] = function () { r.a = sub_8bit(r.a, r.e); return 4; }
	// sub h
	ocf[0x94] = function () { r.a = sub_8bit(r.a, r.h); return 4; }
	// sub l
	ocf[0x95] = function () { r.a = sub_8bit(r.a, r.l); return 4; }
	// sub (hl)
	ocf[0x96] = function () { let byte = rb(get_hl()); r.a = sub_8bit(r.a, byte); return 7; }
	// sub *
	ocf[0xd6] = function () { let byte = rb(r.pc); inc_pc(); r.a = sub_8bit(r.a, byte); return 7; }

	// sbc a,a
	ocf[0x9f] = function () { r.a = sbc_8bit(r.a, r.a); return 4; }
	// sbc a,b
	ocf[0x98] = function () { r.a = sbc_8bit(r.a, r.b); return 4; }
	// sbc a,c
	ocf[0x99] = function () { r.a = sbc_8bit(r.a, r.c); return 4; }
	// sbc a,d
	ocf[0x9a] = function () { r.a = sbc_8bit(r.a, r.d); return 4; }
	// sbc a,e
	ocf[0x9b] = function () { r.a = sbc_8bit(r.a, r.e); return 4; }
	// sbc a,h
	ocf[0x9c] = function () { r.a = sbc_8bit(r.a, r.h); return 4; }
	// sbc a,l
	ocf[0x9d] = function () { r.a = sbc_8bit(r.a, r.l); return 4; }
	// sbc a,(hl)
	ocf[0x9e] = function () { let byte = rb(get_hl()); r.a = sbc_8bit(r.a, byte); return 7; }
	// sbc a,*
	ocf[0xde] = function () { let byte = rb(r.pc); inc_pc(); r.a = sbc_8bit(r.a, byte); return 7; }

	// cp a
	ocf[0xbf] = function () { sub_8bit(r.a, r.a); return 4; }
	// cp b
	ocf[0xb8] = function () { sub_8bit(r.a, r.b); return 4; }
	// cp c
	ocf[0xb9] = function () { sub_8bit(r.a, r.c); return 4; }
	// cp d
	ocf[0xba] = function () { sub_8bit(r.a, r.d); return 4; }
	// cp e
	ocf[0xbb] = function () { sub_8bit(r.a, r.e); return 4; }
	// cp h
	ocf[0xbc] = function () { sub_8bit(r.a, r.h); return 4; }
	// cp l
	ocf[0xbd] = function () { sub_8bit(r.a, r.l); return 4; }
	// cp (hl)
	ocf[0xbe] = function () { let byte = rb(get_hl()); sub_8bit(r.a, byte); return 7; }
	// cp *
	ocf[0xfe] = function () { let byte = rb(r.pc); inc_pc(); sub_8bit(r.a, byte); return 7; }

	// and a
	ocf[0xa7] = function () { r.a = and_8bit(r.a, r.a); return 4; }	
	// and b
	ocf[0xa0] = function () { r.a = and_8bit(r.a, r.b); return 4; }	
	// and c
	ocf[0xa1] = function () { r.a = and_8bit(r.a, r.c); return 4; }	
	// and d
	ocf[0xa2] = function () { r.a = and_8bit(r.a, r.d); return 4; }	
	// and e
	ocf[0xa3] = function () { r.a = and_8bit(r.a, r.e); return 4; }	
	// and h
	ocf[0xa4] = function () { r.a = and_8bit(r.a, r.h); return 4; }	
	// and l
	ocf[0xa5] = function () { r.a = and_8bit(r.a, r.l); return 4; }	
	// and (hl)
	ocf[0xa6] = function () { let byte = rb(get_hl()); r.a = and_8bit(r.a, byte); return 7; }	
	// and *
	ocf[0xe6] = function () { let byte = rb(r.pc); inc_pc(); r.a = and_8bit(r.a, byte); return 7; }	

	// or a
	ocf[0xb7] = function () { r.a = or_8bit(r.a, r.a); return 4; }
	// or b
	ocf[0xb0] = function () { r.a = or_8bit(r.a, r.b); return 4; }
	// or c
	ocf[0xb1] = function () { r.a = or_8bit(r.a, r.c); return 4; }
	// or d
	ocf[0xb2] = function () { r.a = or_8bit(r.a, r.d); return 4; }
	// or e
	ocf[0xb3] = function () { r.a = or_8bit(r.a, r.e); return 4; }
	// or h
	ocf[0xb4] = function () { r.a = or_8bit(r.a, r.h); return 4; }
	// or l
	ocf[0xb5] = function () { r.a = or_8bit(r.a, r.l); return 4; }
	// or (hl)
	ocf[0xb6] = function () { let byte = rb(get_hl()); r.a = or_8bit(r.a, byte); return 7; }
	// or *
	ocf[0xf6] = function () { let byte = rb(r.pc); inc_pc(); r.a = or_8bit(r.a, byte); return 7; }

	// xor a
	ocf[0xaf] = function () { r.a = xor_8bit(r.a, r.a); return 4; }
	// xor b
	ocf[0xa8] = function () { r.a = xor_8bit(r.a, r.b); return 4; }
	// xor c
	ocf[0xa9] = function () { r.a = xor_8bit(r.a, r.c); return 4; }
	// xor d
	ocf[0xaa] = function () { r.a = xor_8bit(r.a, r.d); return 4; }
	// xor e
	ocf[0xab] = function () { r.a = xor_8bit(r.a, r.e); return 4; }
	// xor h
	ocf[0xac] = function () { r.a = xor_8bit(r.a, r.h); return 4; }
	// xor l
	ocf[0xad] = function () { r.a = xor_8bit(r.a, r.l); return 4; }
	// xor (hl)
	ocf[0xae] = function () { let byte = rb(get_hl()); r.a = xor_8bit(r.a, byte); return 7; }
	// xor *
	ocf[0xee] = function () { let byte = rb(r.pc); inc_pc(); r.a = xor_8bit(r.a, byte); return 7; }

	// cp *
	ocf[0xfe] = function () { let byte = rb(r.pc); inc_pc(); sub_8bit(r.a, byte); return 7; }
	// cp (hl)
	ocf[0xbe] = function () { let byte = rb(get_hl()); sub_8bit(r.a, byte); return 7; }

	// rlca
	ocf[0x07] = function () { r.a = rlca_8bit(r.a); return 4; };
	// rrca
	ocf[0x0f] = function () { r.a = rrca_8bit(r.a); return 4; };
	// rla
	ocf[0x17] = function () { r.a = rla_8bit(r.a); return 4; };
	// rra
	ocf[0x1f] = function () { r.a = rra_8bit(r.a); return 4; };

	// daa
	ocf[0x27] = function () { r.a = daa_8bit(r.a); return 4; };


	////////////////////////////// 16 Bit ALU Opcodes //////////////////////////////

	// inc bc
	ocf[0x03] = function () { set_bc(inc_16bit(get_bc())); return 6; }
	// inc de
	ocf[0x13] = function () { set_de(inc_16bit(get_de())); return 6; }
	// inc hl
	ocf[0x23] = function () { set_hl(inc_16bit(get_hl())); return 6; }
	// inc sp
	ocf[0x33] = function () { r.sp = inc_16bit(r.sp); return 6; }

	// add hl,bc
	ocf[0x09] = function () { set_hl(add_16bit(get_hl(), get_bc())); return 11; }
	// add hl,de
	ocf[0x19] = function () { set_hl(add_16bit(get_hl(), get_de())); return 11; }
	// add hl,hl
	ocf[0x29] = function () { set_hl(add_16bit(get_hl(), get_hl())); return 11; }
	// add hl,sp
	ocf[0x39] = function () { set_hl(add_16bit(get_hl(), r.sp)); return 11; }

	// dec bc
	ocf[0x0b] = function () { set_bc(dec_16bit(get_bc())); return 6; }
	// dec de
	ocf[0x1b] = function () { set_de(dec_16bit(get_de())); return 6; }
	// dec hl
	ocf[0x2b] = function () { set_hl(dec_16bit(get_hl())); return 6; }
	// dec sp
	ocf[0x3b] = function () { r.sp = dec_16bit(r.sp); return 6; }

	////////////////////////////// Jump Opcodes //////////////////////////////

	// djnz *
	ocf[0x10] = function () { return executeDecrementRelativeJump(); };

	// jp **
	ocf[0xc3] = function () { return executeConditionalJump(true); };
	// jp z,**
	ocf[0xca] = function () { return executeConditionalJump((r.f & CPU_FLAG_Z) > 0); };
	// jp nz,**
	ocf[0xc2] = function () { return executeConditionalJump((r.f & CPU_FLAG_Z) == 0); };
	// jp c,**
	ocf[0xda] = function () { return executeConditionalJump((r.f & CPU_FLAG_C) > 0); };
	// jp nc,**
	ocf[0xd2] = function () { return executeConditionalJump((r.f & CPU_FLAG_C) == 0); };
	// jp pe,**
	ocf[0xea] = function () { return executeConditionalJump((r.f & CPU_FLAG_PV) > 0); };
	// jp po,**
	ocf[0xe2] = function () { return executeConditionalJump((r.f & CPU_FLAG_PV) == 0); };
	// jp m,**
	ocf[0xfa] = function () { return executeConditionalJump((r.f & CPU_FLAG_S) > 0); };
	// jp p,**
	ocf[0xf2] = function () { return executeConditionalJump((r.f & CPU_FLAG_S) == 0); };
	// jp (hl)
	ocf[0xe9] = function () { r.pc = get_hl(); return 11; };
	
	// jr *
	ocf[0x18] = function () { return executeConditionalRelativeJump(true); };
	// jr z,*
	ocf[0x28] = function () { return executeConditionalRelativeJump((r.f & CPU_FLAG_Z) > 0); };
	// jr nz,*
	ocf[0x20] = function () { return executeConditionalRelativeJump((r.f & CPU_FLAG_Z) == 0); };
	// jr c,*
	ocf[0x38] = function () { return executeConditionalRelativeJump((r.f & CPU_FLAG_C) > 0); };
	// jr nc,*
	ocf[0x30] = function () { return executeConditionalRelativeJump((r.f & CPU_FLAG_C) == 0); };

	////////////////////////////// Call Opcodes //////////////////////////////

	// call **
	ocf[0xcd] = function () { return executeConditionalCall(true); };
	// call z,**
	ocf[0xcc] = function () { return executeConditionalCall((r.f & CPU_FLAG_Z) > 0); };
	// call nz,**
	ocf[0xc4] = function () { return executeConditionalCall((r.f & CPU_FLAG_Z) == 0); };
	// call c,**
	ocf[0xdc] = function () { return executeConditionalCall((r.f & CPU_FLAG_C) > 0); };
	// call nc,**
	ocf[0xd4] = function () { return executeConditionalCall((r.f & CPU_FLAG_C) == 0); };
	// call pe,**
	ocf[0xec] = function () { return executeConditionalCall((r.f & CPU_FLAG_PV) > 0); };
	// call po,**
	ocf[0xe4] = function () { return executeConditionalCall((r.f & CPU_FLAG_PV) == 0); };
	// call m,**
	ocf[0xfc] = function () { return executeConditionalCall((r.f & CPU_FLAG_S) > 0); };
	// call p,**
	ocf[0xf4] = function () { return executeConditionalCall((r.f & CPU_FLAG_S) == 0); };

	////////////////////////////// Ret Opcodes //////////////////////////////

	// ret
	ocf[0xc9] = function () { r.pc = popWord(); return 10; }
	// ret z
	ocf[0xc8] = function () { return executeConditonalReturn((r.f & CPU_FLAG_Z) > 0); }
	// ret nz
	ocf[0xc0] = function () { return executeConditonalReturn((r.f & CPU_FLAG_Z) == 0); }
	// ret c
	ocf[0xd8] = function () { return executeConditonalReturn((r.f & CPU_FLAG_C) > 0); }
	// ret nc
	ocf[0xd0] = function () { return executeConditonalReturn((r.f & CPU_FLAG_C) == 0); }
	// ret pe
	ocf[0xe8] = function () { return executeConditonalReturn((r.f & CPU_FLAG_PV) > 0); }
	// ret po
	ocf[0xe0] = function () { return executeConditonalReturn((r.f & CPU_FLAG_PV) == 0); }
	// ret m
	ocf[0xf8] = function () { return executeConditonalReturn((r.f & CPU_FLAG_S) > 0); }
	// ret p
	ocf[0xf0] = function () { return executeConditonalReturn((r.f & CPU_FLAG_S) == 0); }

	////////////////////////////// Push Opcodes //////////////////////////////

	// push af
	ocf[0xf5] = function () { pushWord(get_af()); return 11; };
	// push bc
	ocf[0xc5] = function () { pushWord(get_bc()); return 11; };
	// push de
	ocf[0xd5] = function () { pushWord(get_de()); return 11; };
	// push hl
	ocf[0xe5] = function () { pushWord(get_hl()); return 11; };
	
	////////////////////////////// Pop Opcodes //////////////////////////////
	// pop af
	ocf[0xf1] = function () { set_af(popWord()); return 10; };
	// pop bc
	ocf[0xc1] = function () { set_bc(popWord()); return 10; };
	// pop de
	ocf[0xd1] = function () { set_de(popWord()); return 10; };
	// pop hl
	ocf[0xe1] = function () { set_hl(popWord()); return 10; };

	////////////////////////////// Rst Opcodes //////////////////////////////

	// rst 00h
	ocf[0xc7] = function () { pushWord(r.pc); r.pc = 0x00; return 11; };
	// rst 10h
	ocf[0xd7] = function () { pushWord(r.pc); r.pc = 0x10; return 11; };
	// rst 20h
	ocf[0xe7] = function () { pushWord(r.pc); r.pc = 0x20; return 11; };
	// rst 30h
	ocf[0xf7] = function () { pushWord(r.pc); r.pc = 0x30; return 11; };
	// rst 08h
	ocf[0xcf] = function () { pushWord(r.pc); r.pc = 0x08; return 11; };
	// rst 18h
	ocf[0xdf] = function () { pushWord(r.pc); r.pc = 0x18; return 11; };
	// rst 28h
	ocf[0xef] = function () { pushWord(r.pc); r.pc = 0x28; return 11; };
	// rst 38h
	ocf[0xff] = function () { pushWord(r.pc); r.pc = 0x38; return 11; };

	////////////////////////////// Ex Opcodes //////////////////////////////

	// ex af,af'
	ocf[0x08] = function () { return executeExchangeAf(); };
	// exx
	ocf[0xd9] = function () { return executeExchange(); };
	// ex de,hl
	ocf[0xeb] = function () { return executeExchangeDeHl(); };
	// ex (sp),hl
	ocf[0xe3] = function () { return executeExchangeSpHl(); };
	
	////////////////////////////// Misc Opcodes //////////////////////////////

	// nop
	ocf[0x00] = function () { /*debugger;*/ return 4; }
	// halt
	ocf[0x76] = function () { self.isHalted = true; return 4; }
	// out (*),a
	ocf[0xd3] = function () { let byte = rb(r.pc); inc_pc(); self.ioc.writeByte(byte, r.a); return 11; }
	// in a,(*)
	ocf[0xdb] = function () { let byte = rb(r.pc); inc_pc(); r.a = self.ioc.readByte(byte); return 11; }
	// bit
	ocf[0xcb] = function () { let opCode = rb(r.pc); inc_pc(); return executeBitOpCode(opCode); }
	// ext
	ocf[0xed] = function () { let opCode = rb(r.pc); inc_pc(); return executeExtOpCode(opCode); }
	// ix
	ocf[0xdd] = function () { let opCode = rb(r.pc); inc_pc(); return executeIxOpCode(opCode); }
	// iy
	ocf[0xfd] = function () { let opCode = rb(r.pc); inc_pc(); return executeIyOpCode(opCode); }
	// di
	ocf[0xf3] = function () { self.maskableInterruptsEnabled = false; return 4; };
	// ei
	ocf[0xfb] = function () { self.maskableInterruptsEnabled = true; return 4; };
	// scf
	ocf[0x37] = function () { r.f &= 0xc4; r.f |= CPU_FLAG_C; return 4; };
	// ccf
	ocf[0x3f] = function () { return executeCcf(); };

	////////////////////////////// Bit Opcodes //////////////////////////////

	// sla a
	bocf[0x27] = function () { r.a = sla_8bit(r.a); return 8; }
	// sla b
	bocf[0x20] = function () { r.b = sla_8bit(r.b); return 8; }
	// sla c
	bocf[0x21] = function () { r.c = sla_8bit(r.c); return 8; }
	// sla d
	bocf[0x22] = function () { r.d = sla_8bit(r.d); return 8; }
	// sla e
	bocf[0x23] = function () { r.e = sla_8bit(r.e); return 8; }
	// sla h
	bocf[0x24] = function () { r.h = sla_8bit(r.h); return 8; }
	// sla l
	bocf[0x25] = function () { r.l = sla_8bit(r.l); return 8; }
	// sla (hl)
	bocf[0x26] = function () { let address = get_hl(); wb(address, sla_8bit(rb(address))); return 15; }

	// sll a
	bocf[0x37] = function () { r.a = sll_8bit(r.a); return 8; }
	// sll b
	bocf[0x30] = function () { r.b = sll_8bit(r.b); return 8; }
	// sll c
	bocf[0x31] = function () { r.c = sll_8bit(r.c); return 8; }
	// sll d
	bocf[0x32] = function () { r.d = sll_8bit(r.d); return 8; }
	// sll e
	bocf[0x33] = function () { r.e = sll_8bit(r.e); return 8; }
	// sll h
	bocf[0x34] = function () { r.h = sll_8bit(r.h); return 8; }
	// sll l
	bocf[0x35] = function () { r.l = sll_8bit(r.l); return 8; }
	// sll (hl)
	bocf[0x36] = function () { let address = get_hl(); wb(address, sll_8bit(rb(address))); return 15; }

	// sra a
	bocf[0x2f] = function () { r.a = sra_8bit(r.a); return 8; }
	// sra b
	bocf[0x28] = function () { r.b = sra_8bit(r.b); return 8; }
	// sra c
	bocf[0x29] = function () { r.c = sra_8bit(r.c); return 8; }
	// sra d
	bocf[0x2a] = function () { r.d = sra_8bit(r.d); return 8; }
	// sra e
	bocf[0x2b] = function () { r.e = sra_8bit(r.e); return 8; }
	// sra h
	bocf[0x2c] = function () { r.h = sra_8bit(r.h); return 8; }
	// sra l
	bocf[0x2d] = function () { r.l = sra_8bit(r.l); return 8; }
	// sra (hl)
	bocf[0x2e] = function () { let address = get_hl(); wb(address, sra_8bit(rb(address))); return 15; }

	// srl a
	bocf[0x3f] = function () { r.a = srl_8bit(r.a); return 8; }
	// srl b
	bocf[0x38] = function () { r.b = srl_8bit(r.b); return 8; }
	// srl c
	bocf[0x39] = function () { r.c = srl_8bit(r.c); return 8; }
	// srl d
	bocf[0x3a] = function () { r.d = srl_8bit(r.d); return 8; }
	// srl e
	bocf[0x3b] = function () { r.e = srl_8bit(r.e); return 8; }
	// srl h
	bocf[0x3c] = function () { r.h = srl_8bit(r.h); return 8; }
	// srl l
	bocf[0x3d] = function () { r.l = srl_8bit(r.l); return 8; }
	// srl (hl)
	bocf[0x3e] = function () { let address = get_hl(); wb(address, srl_8bit(rb(address))); return 15; }

	// rlc a
	bocf[0x07] = function () { r.a = rlc_8bit(r.a); return 8; }
	// rlc b
	bocf[0x00] = function () { r.b = rlc_8bit(r.b); return 8; }
	// rlc c
	bocf[0x01] = function () { r.c = rlc_8bit(r.c); return 8; }
	// rlc d
	bocf[0x02] = function () { r.d = rlc_8bit(r.d); return 8; }
	// rlc e
	bocf[0x03] = function () { r.e = rlc_8bit(r.e); return 8; }
	// rlc h
	bocf[0x04] = function () { r.h = rlc_8bit(r.h); return 8; }
	// rlc l
	bocf[0x05] = function () { r.l = rlc_8bit(r.l); return 8; }
	// rlc (hl)
	bocf[0x06] = function () { let address = get_hl(); wb(address, rlc_8bit(rb(address))); return 15; }

	// rl a
	bocf[0x17] = function () { r.a = rl_8bit(r.a); return 8; }
	// rl b
	bocf[0x10] = function () { r.b = rl_8bit(r.b); return 8; }
	// rl c
	bocf[0x11] = function () { r.c = rl_8bit(r.c); return 8; }
	// rl d
	bocf[0x12] = function () { r.d = rl_8bit(r.d); return 8; }
	// rl e
	bocf[0x13] = function () { r.e = rl_8bit(r.e); return 8; }
	// rl h
	bocf[0x14] = function () { r.h = rl_8bit(r.h); return 8; }
	// rl l
	bocf[0x15] = function () { r.l = rl_8bit(r.l); return 8; }
	// rl (hl)
	bocf[0x16] = function () { let address = get_hl(); wb(address, rl_8bit(rb(address))); return 15; }

	// rrc a
	bocf[0x0f] = function () { r.a = rrc_8bit(r.a); return 8; }
	// rrc b
	bocf[0x08] = function () { r.b = rrc_8bit(r.b); return 8; }
	// rrc c
	bocf[0x09] = function () { r.c = rrc_8bit(r.c); return 8; }
	// rrc d
	bocf[0x0a] = function () { r.d = rrc_8bit(r.d); return 8; }
	// rrc e
	bocf[0x0b] = function () { r.e = rrc_8bit(r.e); return 8; }
	// rrc h
	bocf[0x0c] = function () { r.h = rrc_8bit(r.h); return 8; }
	// rrc l
	bocf[0x0d] = function () { r.l = rrc_8bit(r.l); return 8; }
	// rrc (hl)
	bocf[0x0e] = function () { let address = get_hl(); wb(address, rrc_8bit(rb(address))); return 15; }

	// rr a
	bocf[0x1f] = function () { r.a = rr_8bit(r.a); return 8; }
	// rr b
	bocf[0x18] = function () { r.b = rr_8bit(r.b); return 8; }
	// rr c
	bocf[0x19] = function () { r.c = rr_8bit(r.c); return 8; }
	// rr d
	bocf[0x1a] = function () { r.d = rr_8bit(r.d); return 8; }
	// rr e
	bocf[0x1b] = function () { r.e = rr_8bit(r.e); return 8; }
	// rr h
	bocf[0x1c] = function () { r.h = rr_8bit(r.h); return 8; }
	// rr l
	bocf[0x1d] = function () { r.l = rr_8bit(r.l); return 8; }
	// rr (hl)
	bocf[0x1e] = function () { let address = get_hl(); wb(address, rr_8bit(rb(address))); return 15; }

	// bit 0,a
	bocf[0x47] = function () { bit_8bit(r.a, BIT0); return 8; }
	// bit 1,a
	bocf[0x4f] = function () { bit_8bit(r.a, BIT1); return 8; }
	// bit 2,a
	bocf[0x57] = function () { bit_8bit(r.a, BIT2); return 8; }
	// bit 3,a
	bocf[0x5f] = function () { bit_8bit(r.a, BIT3); return 8; }
	// bit 4,a
	bocf[0x67] = function () { bit_8bit(r.a, BIT4); return 8; }
	// bit 5,a
	bocf[0x6f] = function () { bit_8bit(r.a, BIT5); return 8; }
	// bit 6,a
	bocf[0x77] = function () { bit_8bit(r.a, BIT6); return 8; }
	// bit 7,a
	bocf[0x7f] = function () { bit_8bit(r.a, BIT7); return 8; }
	
	// bit 0,b
	bocf[0x40] = function () { bit_8bit(r.b, BIT0); return 8; }
	// bit 1,b
	bocf[0x48] = function () { bit_8bit(r.b, BIT1); return 8; }
	// bit 2,b
	bocf[0x50] = function () { bit_8bit(r.b, BIT2); return 8; }
	// bit 3,b
	bocf[0x58] = function () { bit_8bit(r.b, BIT3); return 8; }
	// bit 4,b
	bocf[0x60] = function () { bit_8bit(r.b, BIT4); return 8; }
	// bit 5,b
	bocf[0x68] = function () { bit_8bit(r.b, BIT5); return 8; }
	// bit 6,b
	bocf[0x70] = function () { bit_8bit(r.b, BIT6); return 8; }
	// bit 7,b
	bocf[0x78] = function () { bit_8bit(r.b, BIT7); return 8; }

	// bit 0,c
	bocf[0x41] = function () { bit_8bit(r.c, BIT0); return 8; }
	// bit 1,c
	bocf[0x49] = function () { bit_8bit(r.c, BIT1); return 8; }
	// bit 2,c
	bocf[0x51] = function () { bit_8bit(r.c, BIT2); return 8; }
	// bit 3,c
	bocf[0x59] = function () { bit_8bit(r.c, BIT3); return 8; }
	// bit 4,c
	bocf[0x61] = function () { bit_8bit(r.c, BIT4); return 8; }
	// bit 5,c
	bocf[0x69] = function () { bit_8bit(r.c, BIT5); return 8; }
	// bit 6,c
	bocf[0x71] = function () { bit_8bit(r.c, BIT6); return 8; }
	// bit 7,c
	bocf[0x79] = function () { bit_8bit(r.c, BIT7); return 8; }

	// bit 0,d
	bocf[0x42] = function () { bit_8bit(r.d, BIT0); return 8; }
	// bit 1,d
	bocf[0x4a] = function () { bit_8bit(r.d, BIT1); return 8; }
	// bit 2,d
	bocf[0x52] = function () { bit_8bit(r.d, BIT2); return 8; }
	// bit 3,d
	bocf[0x5a] = function () { bit_8bit(r.d, BIT3); return 8; }
	// bit 4,d
	bocf[0x62] = function () { bit_8bit(r.d, BIT4); return 8; }
	// bit 5,d
	bocf[0x6a] = function () { bit_8bit(r.d, BIT5); return 8; }
	// bit 6,d
	bocf[0x72] = function () { bit_8bit(r.d, BIT6); return 8; }
	// bit 7,d
	bocf[0x7a] = function () { bit_8bit(r.d, BIT7); return 8; }

	// bit 0,e
	bocf[0x43] = function () { bit_8bit(r.e, BIT0); return 8; }
	// bit 1,e
	bocf[0x4b] = function () { bit_8bit(r.e, BIT1); return 8; }
	// bit 2,e
	bocf[0x53] = function () { bit_8bit(r.e, BIT2); return 8; }
	// bit 3,e
	bocf[0x5b] = function () { bit_8bit(r.e, BIT3); return 8; }
	// bit 4,e
	bocf[0x63] = function () { bit_8bit(r.e, BIT4); return 8; }
	// bit 5,e
	bocf[0x6b] = function () { bit_8bit(r.e, BIT5); return 8; }
	// bit 6,e
	bocf[0x73] = function () { bit_8bit(r.e, BIT6); return 8; }
	// bit 7,e
	bocf[0x7b] = function () { bit_8bit(r.e, BIT7); return 8; }

	// bit 0,h
	bocf[0x44] = function () { bit_8bit(r.h, BIT0); return 8; }
	// bit 1,h
	bocf[0x4c] = function () { bit_8bit(r.h, BIT1); return 8; }
	// bit 2,h
	bocf[0x54] = function () { bit_8bit(r.h, BIT2); return 8; }
	// bit 3,h
	bocf[0x5c] = function () { bit_8bit(r.h, BIT3); return 8; }
	// bit 4,h
	bocf[0x64] = function () { bit_8bit(r.h, BIT4); return 8; }
	// bit 5,h
	bocf[0x6c] = function () { bit_8bit(r.h, BIT5); return 8; }
	// bit 6,h
	bocf[0x74] = function () { bit_8bit(r.h, BIT6); return 8; }
	// bit 7,h
	bocf[0x7c] = function () { bit_8bit(r.h, BIT7); return 8; }

	// bit 0,l
	bocf[0x45] = function () { bit_8bit(r.l, BIT0); return 8; }
	// bit 1,l
	bocf[0x4d] = function () { bit_8bit(r.l, BIT1); return 8; }
	// bit 2,l
	bocf[0x55] = function () { bit_8bit(r.l, BIT2); return 8; }
	// bit 3,l
	bocf[0x5d] = function () { bit_8bit(r.l, BIT3); return 8; }
	// bit 4,l
	bocf[0x65] = function () { bit_8bit(r.l, BIT4); return 8; }
	// bit 5,l
	bocf[0x6d] = function () { bit_8bit(r.l, BIT5); return 8; }
	// bit 6,l
	bocf[0x75] = function () { bit_8bit(r.l, BIT6); return 8; }
	// bit 7,l
	bocf[0x7d] = function () { bit_8bit(r.l, BIT7); return 8; }

	// bit 0,(hl)
	bocf[0x46] = function () { let byte = rb(get_hl()); bit_8bit(byte, BIT0); return 12; }
	// bit 1,(hl)
	bocf[0x4e] = function () { let byte = rb(get_hl()); bit_8bit(byte, BIT1); return 12; }
	// bit 2,(hl)
	bocf[0x56] = function () { let byte = rb(get_hl()); bit_8bit(byte, BIT2); return 12; }
	// bit 3,(hl)
	bocf[0x5e] = function () { let byte = rb(get_hl()); bit_8bit(byte, BIT3); return 12; }
	// bit 4,(hl)
	bocf[0x66] = function () { let byte = rb(get_hl()); bit_8bit(byte, BIT4); return 12; }
	// bit 5,(hl)
	bocf[0x6e] = function () { let byte = rb(get_hl()); bit_8bit(byte, BIT5); return 12; }
	// bit 6,(hl)
	bocf[0x76] = function () { let byte = rb(get_hl()); bit_8bit(byte, BIT6); return 12; }
	// bit 7,(hl)
	bocf[0x7e] = function () { let byte = rb(get_hl()); bit_8bit(byte, BIT7); return 12; }

	// set 0,a
	bocf[0xc7] = function () { r.a |= BIT0; return 8; }
	// set 1,a
	bocf[0xcf] = function () { r.a |= BIT1; return 8; }
	// set 2,a
	bocf[0xd7] = function () { r.a |= BIT2; return 8; }
	// set 3,a
	bocf[0xdf] = function () { r.a |= BIT3; return 8; }
	// set 4,a
	bocf[0xe7] = function () { r.a |= BIT4; return 8; }
	// set 5,a
	bocf[0xef] = function () { r.a |= BIT5; return 8; }
	// set 6,a
	bocf[0xf7] = function () { r.a |= BIT6; return 8; }
	// set 7,a
	bocf[0xff] = function () { r.a |= BIT7; return 8; }

	// set 0,b
	bocf[0xc0] = function () { r.b |= BIT0; return 8; }
	// set 1,b
	bocf[0xc8] = function () { r.b |= BIT1; return 8; }
	// set 2,b
	bocf[0xd0] = function () { r.b |= BIT2; return 8; }
	// set 3,b
	bocf[0xd8] = function () { r.b |= BIT3; return 8; }
	// set 4,b
	bocf[0xe0] = function () { r.b |= BIT4; return 8; }
	// set 5,b
	bocf[0xe8] = function () { r.b |= BIT5; return 8; }
	// set 6,b
	bocf[0xf0] = function () { r.b |= BIT6; return 8; }
	// set 7,b
	bocf[0xf8] = function () { r.b |= BIT7; return 8; }

	// set 0,c
	bocf[0xc1] = function () { r.c |= BIT0; return 8; }
	// set 1,c
	bocf[0xc9] = function () { r.c |= BIT1; return 8; }
	// set 2,c
	bocf[0xd1] = function () { r.c |= BIT2; return 8; }
	// set 3,c
	bocf[0xd9] = function () { r.c |= BIT3; return 8; }
	// set 4,c
	bocf[0xe1] = function () { r.c |= BIT4; return 8; }
	// set 5,c
	bocf[0xe9] = function () { r.c |= BIT5; return 8; }
	// set 6,c
	bocf[0xf1] = function () { r.c |= BIT6; return 8; }
	// set 7,c
	bocf[0xf9] = function () { r.c |= BIT7; return 8; }

	// set 0,d
	bocf[0xc2] = function () { r.d |= BIT0; return 8; }
	// set 1,d
	bocf[0xca] = function () { r.d |= BIT1; return 8; }
	// set 2,d
	bocf[0xd2] = function () { r.d |= BIT2; return 8; }
	// set 3,d
	bocf[0xda] = function () { r.d |= BIT3; return 8; }
	// set 4,d
	bocf[0xe2] = function () { r.d |= BIT4; return 8; }
	// set 5,d
	bocf[0xea] = function () { r.d |= BIT5; return 8; }
	// set 6,d
	bocf[0xf2] = function () { r.d |= BIT6; return 8; }
	// set 7,d
	bocf[0xfa] = function () { r.d |= BIT7; return 8; }

	// set 0,e
	bocf[0xc3] = function () { r.e |= BIT0; return 8; }
	// set 1,e
	bocf[0xcb] = function () { r.e |= BIT1; return 8; }
	// set 2,e
	bocf[0xd3] = function () { r.e |= BIT2; return 8; }
	// set 3,e
	bocf[0xdb] = function () { r.e |= BIT3; return 8; }
	// set 4,e
	bocf[0xe3] = function () { r.e |= BIT4; return 8; }
	// set 5,e
	bocf[0xeb] = function () { r.e |= BIT5; return 8; }
	// set 6,e
	bocf[0xf3] = function () { r.e |= BIT6; return 8; }
	// set 7,e
	bocf[0xfb] = function () { r.e |= BIT7; return 8; }

	// set 0,h
	bocf[0xc4] = function () { r.h |= BIT0; return 8; }
	// set 1,h
	bocf[0xcc] = function () { r.h |= BIT1; return 8; }
	// set 2,h
	bocf[0xd4] = function () { r.h |= BIT2; return 8; }
	// set 3,h
	bocf[0xdc] = function () { r.h |= BIT3; return 8; }
	// set 4,h
	bocf[0xe4] = function () { r.h |= BIT4; return 8; }
	// set 5,h
	bocf[0xec] = function () { r.h |= BIT5; return 8; }
	// set 6,h
	bocf[0xf4] = function () { r.h |= BIT6; return 8; }
	// set 7,h
	bocf[0xfc] = function () { r.h |= BIT7; return 8; }

	// set 0,l
	bocf[0xc5] = function () { r.l |= BIT0; return 8; }
	// set 1,l
	bocf[0xcd] = function () { r.l |= BIT1; return 8; }
	// set 2,l
	bocf[0xd5] = function () { r.l |= BIT2; return 8; }
	// set 3,l
	bocf[0xdd] = function () { r.l |= BIT3; return 8; }
	// set 4,l
	bocf[0xe5] = function () { r.l |= BIT4; return 8; }
	// set 5,l
	bocf[0xed] = function () { r.l |= BIT5; return 8; }
	// set 6,l
	bocf[0xf5] = function () { r.l |= BIT6; return 8; }
	// set 7,l
	bocf[0xfd] = function () { r.l |= BIT7; return 8; }

	// set 0,(hl)
	bocf[0xc6] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte |= BIT0); return 15; }
	// set 1,(hl)
	bocf[0xce] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte |= BIT1); return 15; }
	// set 2,(hl)
	bocf[0xd6] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte |= BIT2); return 15; }
	// set 3,(hl)
	bocf[0xde] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte |= BIT3); return 15; }
	// set 4,(hl)
	bocf[0xe6] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte |= BIT4); return 15; }
	// set 5,(hl)
	bocf[0xee] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte |= BIT5); return 15; }
	// set 6,(hl)
	bocf[0xf6] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte |= BIT6); return 15; }
	// set 7,(hl)
	bocf[0xfe] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte |= BIT7); return 15; }

	// res 0,a
	bocf[0x87] = function () { r.a &= NOT_BIT0; return 8; }
	// res 1,a
	bocf[0x8f] = function () { r.a &= NOT_BIT1; return 8; }
	// res 2,a
	bocf[0x97] = function () { r.a &= NOT_BIT2; return 8; }
	// res 3,a
	bocf[0x9f] = function () { r.a &= NOT_BIT3; return 8; }
	// res 4,a
	bocf[0xa7] = function () { r.a &= NOT_BIT4; return 8; }
	// res 5,a
	bocf[0xaf] = function () { r.a &= NOT_BIT5; return 8; }
	// res 6,a
	bocf[0xb7] = function () { r.a &= NOT_BIT6; return 8; }
	// res 7,a
	bocf[0xbf] = function () { r.a &= NOT_BIT7; return 8; }

	// res 0,b
	bocf[0x80] = function () { r.b &= NOT_BIT0; return 8; }
	// res 1,b
	bocf[0x88] = function () { r.b &= NOT_BIT1; return 8; }
	// res 2,b
	bocf[0x90] = function () { r.b &= NOT_BIT2; return 8; }
	// res 3,b
	bocf[0x98] = function () { r.b &= NOT_BIT3; return 8; }
	// res 4,b
	bocf[0xa0] = function () { r.b &= NOT_BIT4; return 8; }
	// res 5,b
	bocf[0xa8] = function () { r.b &= NOT_BIT5; return 8; }
	// res 6,b
	bocf[0xb0] = function () { r.b &= NOT_BIT6; return 8; }
	// res 7,b
	bocf[0xb8] = function () { r.b &= NOT_BIT7; return 8; }

	// res 0,c
	bocf[0x81] = function () { r.c &= NOT_BIT0; return 8; }
	// res 1,c
	bocf[0x89] = function () { r.c &= NOT_BIT1; return 8; }
	// res 2,c
	bocf[0x91] = function () { r.c &= NOT_BIT2; return 8; }
	// res 3,c
	bocf[0x99] = function () { r.c &= NOT_BIT3; return 8; }
	// res 4,c
	bocf[0xa1] = function () { r.c &= NOT_BIT4; return 8; }
	// res 5,c
	bocf[0xa9] = function () { r.c &= NOT_BIT5; return 8; }
	// res 6,c
	bocf[0xb1] = function () { r.c &= NOT_BIT6; return 8; }
	// res 7,c
	bocf[0xb9] = function () { r.c &= NOT_BIT7; return 8; }

	// res 0,d
	bocf[0x82] = function () { r.d &= NOT_BIT0; return 8; }
	// res 1,d
	bocf[0x8a] = function () { r.d &= NOT_BIT1; return 8; }
	// res 2,d
	bocf[0x92] = function () { r.d &= NOT_BIT2; return 8; }
	// res 3,d
	bocf[0x9a] = function () { r.d &= NOT_BIT3; return 8; }
	// res 4,d
	bocf[0xa2] = function () { r.d &= NOT_BIT4; return 8; }
	// res 5,d
	bocf[0xaa] = function () { r.d &= NOT_BIT5; return 8; }
	// res 6,d
	bocf[0xb2] = function () { r.d &= NOT_BIT6; return 8; }
	// res 7,d
	bocf[0xba] = function () { r.d &= NOT_BIT7; return 8; }

	// res 0,e
	bocf[0x83] = function () { r.e &= NOT_BIT0; return 8; }
	// res 1,e
	bocf[0x8b] = function () { r.e &= NOT_BIT1; return 8; }
	// res 2,e
	bocf[0x93] = function () { r.e &= NOT_BIT2; return 8; }
	// res 3,e
	bocf[0x9b] = function () { r.e &= NOT_BIT3; return 8; }
	// res 4,e
	bocf[0xa3] = function () { r.e &= NOT_BIT4; return 8; }
	// res 5,e
	bocf[0xab] = function () { r.e &= NOT_BIT5; return 8; }
	// res 6,e
	bocf[0xb3] = function () { r.e &= NOT_BIT6; return 8; }
	// res 7,e
	bocf[0xbb] = function () { r.e &= NOT_BIT7; return 8; }

	// res 0,h
	bocf[0x84] = function () { r.h &= NOT_BIT0; return 8; }
	// res 1,h
	bocf[0x8c] = function () { r.h &= NOT_BIT1; return 8; }
	// res 2,h
	bocf[0x94] = function () { r.h &= NOT_BIT2; return 8; }
	// res 3,h
	bocf[0x9c] = function () { r.h &= NOT_BIT3; return 8; }
	// res 4,h
	bocf[0xa4] = function () { r.h &= NOT_BIT4; return 8; }
	// res 5,h
	bocf[0xac] = function () { r.h &= NOT_BIT5; return 8; }
	// res 6,h
	bocf[0xb4] = function () { r.h &= NOT_BIT6; return 8; }
	// res 7,h
	bocf[0xbc] = function () { r.h &= NOT_BIT7; return 8; }

	// res 0,l
	bocf[0x85] = function () { r.l &= NOT_BIT0; return 8; }
	// res 1,l
	bocf[0x8d] = function () { r.l &= NOT_BIT1; return 8; }
	// res 2,l
	bocf[0x95] = function () { r.l &= NOT_BIT2; return 8; }
	// res 3,l
	bocf[0x9d] = function () { r.l &= NOT_BIT3; return 8; }
	// res 4,l
	bocf[0xa5] = function () { r.l &= NOT_BIT4; return 8; }
	// res 5,l
	bocf[0xad] = function () { r.l &= NOT_BIT5; return 8; }
	// res 6,l
	bocf[0xb5] = function () { r.l &= NOT_BIT6; return 8; }
	// res 7,l
	bocf[0xbd] = function () { r.l &= NOT_BIT7; return 8; }

	// res 0,(hl)
	bocf[0x86] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte &= NOT_BIT0); return 15; }
	// res 1,(hl)
	bocf[0x8e] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte &= NOT_BIT1); return 15; }
	// res 2,(hl)
	bocf[0x96] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte &= NOT_BIT2); return 15; }
	// res 3,(hl)
	bocf[0x9e] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte &= NOT_BIT3); return 15; }
	// res 4,(hl)
	bocf[0xa6] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte &= NOT_BIT4); return 15; }
	// res 5,(hl)
	bocf[0xae] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte &= NOT_BIT5); return 15; }
	// res 6,(hl)
	bocf[0xb6] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte &= NOT_BIT6); return 15; }
	// res 7,(hl)
	bocf[0xbe] = function () { let address = get_hl(); let byte = rb(address); wb(address, byte &= NOT_BIT7); return 15; }

	////////////////////////////// Ext Opcodes //////////////////////////////

	// im 0
	eocf[0x46] = function () { self.interruptMode = 0; return 8; }
	// im 1
	eocf[0x56] = function () { self.interruptMode = 1; return 8; }
	// im 0
	eocf[0x66] = function () { self.interruptMode = 0; return 8; }
	// im 1
	eocf[0x76] = function () { self.interruptMode = 1; return 8; }

	// ini
	eocf[0xa2] = function () { return executeInIncrement(); }
	// inir
	eocf[0xb2] = function () { return executeInIncrementRepeat(); }

	// outi
	eocf[0xa3] = function () { return executeOutIncrement(); }
	// otir
	eocf[0xb3] = function () { return executeOutIncrementRepeat(); }

	// ind
	eocf[0xaa] = function () { return executeInDecrement(); }
	// indr
	eocf[0xba] = function () { return executeInDecrementRepeat(); }

	// outd
	eocf[0xab] = function () { return executeOutDecrement(); }
	// otdr
	eocf[0xbb] = function () { return executeOutDecrementRepeat(); }
	
	// in a,(c)
	eocf[0x78] = function () { r.a = self.ioc.readByte(r.c); return 12; }
	// in b,(c)
	eocf[0x40] = function () { r.b = self.ioc.readByte(r.c); return 12; }
	// in c,(c)
	eocf[0x48] = function () { r.c = self.ioc.readByte(r.c); return 12; }
	// in d,(c)
	eocf[0x50] = function () { r.d = self.ioc.readByte(r.c); return 12; }
	// in e,(c)
	eocf[0x58] = function () { r.e = self.ioc.readByte(r.c); return 12; }
	// in h,(c)
	eocf[0x60] = function () { r.h = self.ioc.readByte(r.c); return 12; }
	// in l,(c)
	eocf[0x68] = function () { r.l = self.ioc.readByte(r.c); return 12; }

	// out (c),a
	eocf[0x79] = function () { self.ioc.writeByte(r.c, r.a); return 12; }
	// out (c),b
	eocf[0x41] = function () { self.ioc.writeByte(r.c, r.b); return 12; }
	// out (c),c
	eocf[0x49] = function () { self.ioc.writeByte(r.c, r.c); return 12; }
	// out (c),d
	eocf[0x51] = function () { self.ioc.writeByte(r.c, r.d); return 12; }
	// out (c),e
	eocf[0x59] = function () { self.ioc.writeByte(r.c, r.e); return 12; }
	// out (c),h
	eocf[0x61] = function () { self.ioc.writeByte(r.c, r.h); return 12; }
	// out (c),l
	eocf[0x69] = function () { self.ioc.writeByte(r.c, r.l); return 12; }

	// ld (**),bc
	eocf[0x43] = function () { let address = rw(r.pc); inc2_pc(); ww(address, get_bc()); return 20; }
	// ld (**),de
	eocf[0x53] = function () { let address = rw(r.pc); inc2_pc(); ww(address, get_de()); return 20; }
	// ld (**),hl
	eocf[0x63] = function () { let address = rw(r.pc); inc2_pc(); ww(address, get_hl()); return 20; }
	// ld (**),sp
	eocf[0x73] = function () { let address = rw(r.pc); inc2_pc(); ww(address, r.sp); return 20; }

	// ld bc,(**)
	eocf[0x4b] = function () { let address = rw(r.pc); inc2_pc(); let word = rw(address); set_bc(word); return 20; }
	// ld de,(**)
	eocf[0x5b] = function () { let address = rw(r.pc); inc2_pc(); let word = rw(address); set_de(word); return 20; }
	// ld hl,(**)
	eocf[0x6b] = function () { let address = rw(r.pc); inc2_pc(); let word = rw(address); set_hl(word); return 20; }
	// ld sp,(**)
	eocf[0x7b] = function () { let address = rw(r.pc); inc2_pc(); let word = rw(address); r.sp = word; return 20; }

	// ldi
	eocf[0xa0] = function () { return executeLoadIncrement(); }
	// ldir
	eocf[0xb0] = function () { return executeLoadIncrementRepeat(); }
	// ldd
	eocf[0xa8] = function () { return executeLoadDecrement(); }
	// lddr
	eocf[0xb8] = function () { return executeLoadDecrementRepeat(); }

	// adc hl,bc
	eocf[0x4a] = function () { set_hl(adc_16bit(get_hl(), get_bc())); return 15; }
	// adc hl,de
	eocf[0x5a] = function () { set_hl(adc_16bit(get_hl(), get_de())); return 15; }
	// adc hl,hl
	eocf[0x6a] = function () { set_hl(adc_16bit(get_hl(), get_hl())); return 15; }
	// adc hl,sp
	eocf[0x7a] = function () { set_hl(adc_16bit(get_hl(), r.sp)); return 15; }

	// sbc hl,bc
	eocf[0x42] = function () { set_hl(sbc_16bit(get_hl(), get_bc())); return 15; }
	// sbc hl,de
	eocf[0x52] = function () { set_hl(sbc_16bit(get_hl(), get_de())); return 15; }
	// sbc hl,hl
	eocf[0x62] = function () { set_hl(sbc_16bit(get_hl(), get_hl())); return 15; }
	// sbc hl,sp
	eocf[0x72] = function () { set_hl(sbc_16bit(get_hl(), r.sp)); return 15; }

	// retn
	eocf[0x45] = function () { r.pc = popWord(); return 14; }
	// retn
	eocf[0x55] = function () { r.pc = popWord(); return 14; }
	// retn
	eocf[0x65] = function () { r.pc = popWord(); return 14; }
	// retn
	eocf[0x75] = function () { r.pc = popWord(); return 14; }
	// retn
	eocf[0x5d] = function () { r.pc = popWord(); return 14; }
	// retn
	eocf[0x6d] = function () { r.pc = popWord(); return 14; }
	// retn
	eocf[0x7d] = function () { r.pc = popWord(); return 14; }
	// reti
	eocf[0x4d] = function () { r.pc = popWord(); return 14; }

	// cpi
	eocf[0xa1] = function () { return executeCpi(); }
	// cpir
	eocf[0xb1] = function () { return executeCpir(); }

	// cpd
	eocf[0xa9] = function () { return executeCpd(); }
	// cpd
	eocf[0xb9] = function () { return executeCpdr(); }
	
	// rrd
	eocf[0x67] = function () { return executeRrd(); }
	// rld
	eocf[0x6f] = function () { return executeRld(); }

	// neg
	eocf[0x44] = function () { r.a = sub_8bit(0, r.a); return 8; }
	// neg
	eocf[0x45] = function () { r.a = sub_8bit(0, r.a); return 8; }
	// neg
	eocf[0x46] = function () { r.a = sub_8bit(0, r.a); return 8; }
	// neg
	eocf[0x47] = function () { r.a = sub_8bit(0, r.a); return 8; }

	// ld i,a
	eocf[0x47] = function () { r.r = r.a; return 9; }
	// ld a,i
	eocf[0x57] = function () { r.a = r.r; return 9; }
	// ld r,a
	eocf[0x4f] = function () { r.r = r.a; return 9; }
	// ld a,r
	eocf[0x5f] = function () { r.a = r.r; return 9; }

	////////////////////////////// IX Opcodes //////////////////////////////

	// ld ix,**
	ixocf[0x21] = function () { let word = rw(r.pc); inc2_pc(); set_ix(word); return 14; }
	// ld (**),ix
	ixocf[0x22] = function () { let address = rw(r.pc); inc2_pc(); ww(address, get_ix()); return 20; }
	// ld ixh,*
	ixocf[0x26] = function () { let byte = rb(r.pc); inc_pc(); r.ixh = byte; return 11; }
	// ld ixl,*
	ixocf[0x2e] = function () { let byte = rb(r.pc); inc_pc(); r.ixl = byte; return 11; }
	// ld ix,(**)
	ixocf[0x2a] = function () { let address = rw(r.pc); inc2_pc(); let word = rw(address); set_ix(word); return 20; }
	// ld sp,ix
	ixocf[0xf9] = function () { r.sp = get_ix(); return 10; }

	// ld (ix+*),*
	ixocf[0x36] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(r.pc); inc_pc(); wb(address, byte); return 19; }
	// ld (ix+*),a
	ixocf[0x77] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, r.a); return 19; }
	// ld (ix+*),b
	ixocf[0x70] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, r.b); return 19; }
	// ld (ix+*),c
	ixocf[0x71] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, r.c); return 19; }
	// ld (ix+*),d
	ixocf[0x72] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, r.d); return 19; }
	// ld (ix+*),e
	ixocf[0x73] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, r.e); return 19; }
	// ld (ix+*),h
	ixocf[0x74] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, r.h); return 19; }
	// ld (ix+*),l
	ixocf[0x75] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, r.l); return 19; }
	
	// ld a,(ix+*)
	ixocf[0x7e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; r.a = rb(address); return 19; }
	// ld b,(ix+*)
	ixocf[0x46] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; r.b = rb(address); return 19; }
	// ld c,(ix+*)
	ixocf[0x4e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; r.c = rb(address); return 19; }
	// ld d,(ix+*)
	ixocf[0x56] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; r.d = rb(address); return 19; }
	// ld e,(ix+*)
	ixocf[0x5e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; r.e = rb(address); return 19; }
	// ld h,(ix+*)
	ixocf[0x66] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; r.h = rb(address); return 19; }
	// ld l,(ix+*)
	ixocf[0x6e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; r.l = rb(address); return 19; }

	// ld ixl,a
	ixocf[0x6f] = function () { r.ixl = r.a; return 8; }
	// ld ixl,b
	ixocf[0x68] = function () { r.ixl = r.b; return 8; }
	// ld ixl,c
	ixocf[0x69] = function () { r.ixl = r.c; return 8; }
	// ld ixl,d
	ixocf[0x6a] = function () { r.ixl = r.d; return 8; }
	// ld ixl,e
	ixocf[0x6b] = function () { r.ixl = r.e; return 8; }
	// ld ixl,ixh
	ixocf[0x6c] = function () { r.ixl = r.ixh; return 8; }
	// ld ixl,ixl
	ixocf[0x6d] = function () { r.ixl = r.ixl; return 8; }

	// ld ixh,a
	ixocf[0x67] = function () { r.ixh = r.a; return 8; }
	// ld ixh,b
	ixocf[0x60] = function () { r.ixh = r.b; return 8; }
	// ld ixh,c
	ixocf[0x61] = function () { r.ixh = r.c; return 8; }
	// ld ixh,d
	ixocf[0x62] = function () { r.ixh = r.d; return 8; }
	// ld ixh,e
	ixocf[0x63] = function () { r.ixh = r.e; return 8; }
	// ld ixh,ixh
	ixocf[0x64] = function () { r.ixh = r.ixh; return 8; }
	// ld ixh,ixl
	ixocf[0x65] = function () { r.ixh = r.ixl; return 8; }

	// ld a,ixh
	ixocf[0x7c] = function () { r.a = r.ixh; return 8; }
	// ld a,ixl
	ixocf[0x7d] = function () { r.a = r.ixl; return 8; }
	// ld b,ixh
	ixocf[0x44] = function () { r.b = r.ixh; return 8; }
	// ld b,ixl
	ixocf[0x45] = function () { r.b = r.ixl; return 8; }
	// ld c,ixh
	ixocf[0x4c] = function () { r.c = r.ixh; return 8; }
	// ld c,ixl
	ixocf[0x4d] = function () { r.c = r.ixl; return 8; }
	// ld d,ixh
	ixocf[0x54] = function () { r.d = r.ixh; return 8; }
	// ld d,ixl
	ixocf[0x55] = function () { r.d = r.ixl; return 8; }
	// ld e,ixh
	ixocf[0x5c] = function () { r.e = r.ixh; return 8; }
	// ld e,ixl
	ixocf[0x5d] = function () { r.e = r.ixl; return 8; }

	// inc ix
	ixocf[0x23] = function () { set_ix(inc_16bit(get_ix())); return 10; }
	// dec ix
	ixocf[0x2b] = function () { set_ix(dec_16bit(get_ix())); return 10; }

	// inc (ix+*)
	ixocf[0x34] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, inc_8bit(rb(address))); return 23; }		
	// dec (ix+*)
	ixocf[0x35] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; wb(address, dec_8bit(rb(address))); return 23; }

	// inc ixh
	ixocf[0x24] = function () { r.ixh = inc_8bit(r.ixh); return 8; }
	// dec ixh
	ixocf[0x25] = function () { r.ixh = dec_8bit(r.ixh); return 8; }
	// inc ixl
	ixocf[0x2c] = function () { r.ixl = inc_8bit(r.ixl); return 8; }
	// dec ixl
	ixocf[0x2d] = function () { r.ixl = dec_8bit(r.ixl); return 8; }

	// pop ix
	ixocf[0xe1] = function () { set_ix(popWord()); return 14; }

	// push ix
	ixocf[0xe5] = function () { pushWord(get_ix()); return 14; }

	// ix bits
	ixocf[0xcb] = function () { return executeIxBitOpCode(); }

	// add ix,bc
	ixocf[0x09] = function () { set_ix(add_16bit(get_ix(), get_bc())); return 15; }
	// add ix,de
	ixocf[0x19] = function () { set_ix(add_16bit(get_ix(), get_de())); return 15; }
	// add ix,ix
	ixocf[0x29] = function () { set_ix(add_16bit(get_ix(), get_ix())); return 15; }
	// add ix,sp
	ixocf[0x39] = function () { set_ix(add_16bit(get_ix(), r.sp)); return 15; }

	// add a,ixh
	ixocf[0x84] = function () { r.a = add_8bit(r.a, r.ixh); return 8; }
	// add a,ixl
	ixocf[0x85] = function () { r.a = add_8bit(r.a, r.ixl); return 8; }
	// add a,(ix+*)
	ixocf[0x86] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(address); r.a = add_8bit(r.a, byte); return 19; }
	
	// sub ixh
	ixocf[0x94] = function () { r.a = sub_8bit(r.a, r.ixh); return 8; }
	// sub ixl
	ixocf[0x95] = function () { r.a = sub_8bit(r.a, r.ixl); return 8; }
	// sub (ix+*)
	ixocf[0x96] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(address); r.a = sub_8bit(r.a, byte); return 19; }
	
	// and ixh
	ixocf[0xa4] = function () { r.a = and_8bit(r.a, r.ixh); return 8; }
	// and ixl
	ixocf[0xa5] = function () { r.a = and_8bit(r.a, r.ixl); return 8; }
	// and (ix+*)
	ixocf[0xa6] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(address); r.a = and_8bit(r.a, byte); return 19; }
	
	// or ixh
	ixocf[0xb4] = function () { r.a = or_8bit(r.a, r.ixh); return 8; }
	// or ixl
	ixocf[0xb5] = function () { r.a = or_8bit(r.a, r.ixl); return 8; }
	// or (ix+*)
	ixocf[0xb6] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(address); r.a = or_8bit(r.a, byte); return 19; }

	// adc a,(ix+*)
	ixocf[0x8e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(address); r.a = adc_8bit(r.a, byte); return 19; }
	// sbc a,(ix+*)
	ixocf[0x9e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(address); r.a = sbc_8bit(r.a, byte); return 19; }
	// xor (ix+*)
	ixocf[0xae] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(address); r.a = xor_8bit(r.a, byte); return 19; }
	
	// cp ixh
	ixocf[0xbc] = function () { sub_8bit(r.a, r.ixh); return 8; }
	// cp ixl
	ixocf[0xbd] = function () { sub_8bit(r.a, r.ixl); return 8; }
	// cp (ix+*)
	ixocf[0xbe] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_ix() + disp) & 0xffff; let byte = rb(address); sub_8bit(r.a, byte); return 19; }

	// ex (sp),ix
	ixocf[0xe3] = function () { return executeExchangeSpIx(); }

	// jp (ix)
	ixocf[0xe9] = function () { r.pc = get_ix(); return 8; }

	////////////////////////////// IY Opcodes //////////////////////////////

	// ld iy,**
	iyocf[0x21] = function () { let word = rw(r.pc); inc2_pc(); set_iy(word); return 14; }
	// ld (**),iy
	iyocf[0x22] = function () { let address = rw(r.pc); inc2_pc(); ww(address, get_iy()); return 20; }
	// ld iyh,*
	iyocf[0x26] = function () { let byte = rb(r.pc); inc_pc(); r.iyh = byte; return 11; }
	// ld iyl,*
	iyocf[0x2e] = function () { let byte = rb(r.pc); inc_pc(); r.iyl = byte; return 11; }
	// ld iy,(**)
	iyocf[0x2a] = function () { let address = rw(r.pc); inc2_pc(); let word = rw(address); set_iy(word); return 20; }
	// ld sp,ix
	iyocf[0xf9] = function () { r.sp = get_iy(); return 10; }

	// ld (iy+*),*
	iyocf[0x36] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(r.pc); inc_pc(); wb(address, byte); return 19; }
	// ld (iy+*),a
	iyocf[0x77] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, r.a); return 19; }
	// ld (iy+*),b
	iyocf[0x70] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, r.b); return 19; }
	// ld (iy+*),c
	iyocf[0x71] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, r.c); return 19; }
	// ld (iy+*),d
	iyocf[0x72] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, r.d); return 19; }
	// ld (iy+*),e
	iyocf[0x73] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, r.e); return 19; }
	// ld (iy+*),h
	iyocf[0x74] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, r.h); return 19; }
	// ld (iy+*),l
	iyocf[0x75] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, r.l); return 19; }
	
	// ld a,(iy+*)
	iyocf[0x7e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; r.a = rb(address); return 19; }
	// ld b,(iy+*)
	iyocf[0x46] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; r.b = rb(address); return 19; }
	// ld c,(iy+*)
	iyocf[0x4e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; r.c = rb(address); return 19; }
	// ld d,(iy+*)
	iyocf[0x56] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; r.d = rb(address); return 19; }
	// ld e,(iy+*)
	iyocf[0x5e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; r.e = rb(address); return 19; }
	// ld h,(iy+*)
	iyocf[0x66] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; r.h = rb(address); return 19; }
	// ld l,(iy+*)
	iyocf[0x6e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; r.l = rb(address); return 19; }

	// ld iyl,a
	iyocf[0x6f] = function () { r.iyl = r.a; return 8; }
	// ld iyl,b
	iyocf[0x68] = function () { r.iyl = r.b; return 8; }
	// ld iyl,c
	iyocf[0x69] = function () { r.iyl = r.c; return 8; }
	// ld iyl,d
	iyocf[0x6a] = function () { r.iyl = r.d; return 8; }
	// ld iyl,e
	iyocf[0x6b] = function () { r.iyl = r.e; return 8; }
	// ld iyl,iyh
	iyocf[0x6c] = function () { r.iyl = r.iyh; return 8; }
	// ld iyl,iyl
	iyocf[0x6d] = function () { r.iyl = r.iyl; return 8; }

	// ld iyh,a
	iyocf[0x67] = function () { r.iyh = r.a; return 8; }
	// ld iyh,b
	iyocf[0x60] = function () { r.iyh = r.b; return 8; }
	// ld iyh,c
	iyocf[0x61] = function () { r.iyh = r.c; return 8; }
	// ld iyh,d
	iyocf[0x62] = function () { r.iyh = r.d; return 8; }
	// ld iyh,e
	iyocf[0x63] = function () { r.iyh = r.e; return 8; }
	// ld iyh,iyh
	iyocf[0x64] = function () { r.iyh = r.iyh; return 8; }
	// ld iyh,iyl
	iyocf[0x65] = function () { r.iyh = r.iyl; return 8; }

	// ld a,iyh
	iyocf[0x7c] = function () { r.a = r.iyh; return 8; }
	// ld a,iyl
	iyocf[0x7d] = function () { r.a = r.iyl; return 8; }
	// ld b,iyh
	iyocf[0x44] = function () { r.b = r.iyh; return 8; }
	// ld b,iyl
	iyocf[0x45] = function () { r.b = r.iyl; return 8; }
	// ld c,iyh
	iyocf[0x4c] = function () { r.c = r.iyh; return 8; }
	// ld c,iyl
	iyocf[0x4d] = function () { r.c = r.iyl; return 8; }
	// ld d,iyh
	iyocf[0x54] = function () { r.d = r.iyh; return 8; }
	// ld d,iyl
	iyocf[0x55] = function () { r.d = r.iyl; return 8; }
	// ld e,iyh
	iyocf[0x5c] = function () { r.e = r.iyh; return 8; }
	// ld e,iyl
	iyocf[0x5d] = function () { r.e = r.iyl; return 8; }

	// inc iy
	iyocf[0x23] = function () { set_iy(inc_16bit(get_iy())); return 10; }
	// dec iy
	iyocf[0x2b] = function () { set_iy(dec_16bit(get_iy())); return 10; }

	// inc (iy+*)
	iyocf[0x34] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, inc_8bit(rb(address))); return 23; }		
	// dec (iy+*)
	iyocf[0x35] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; wb(address, dec_8bit(rb(address))); return 23; }

	// inc ixh
	iyocf[0x24] = function () { r.iyh = inc_8bit(r.iyh); return 8; }
	// dec ixh
	iyocf[0x25] = function () { r.iyh = dec_8bit(r.iyh); return 8; }
	// inc ixl
	iyocf[0x2c] = function () { r.iyl = inc_8bit(r.iyl); return 8; }
	// dec ixl
	iyocf[0x2d] = function () { r.iyl = dec_8bit(r.iyl); return 8; }

	// pop iy
	iyocf[0xe1] = function () { set_iy(popWord()); return 14; }

	// push iy
	iyocf[0xe5] = function () { pushWord(get_iy()); return 14; }

	// iy bits
	iyocf[0xcb] = function () { return executeIyBitOpCode(); }

	// add iy,bc
	iyocf[0x09] = function () { set_iy(add_16bit(get_iy(), get_bc())); return 15; }
	// add iy,de
	iyocf[0x19] = function () { set_iy(add_16bit(get_iy(), get_de())); return 15; }
	// add iy,iy
	iyocf[0x29] = function () { set_iy(add_16bit(get_iy(), get_iy())); return 15; }
	// add iy,sp
	iyocf[0x39] = function () { set_iy(add_16bit(get_iy(), r.sp)); return 15; }

	// add a,iyh
	iyocf[0x84] = function () { r.a = add_8bit(r.a, r.iyh); return 8; }
	// add a,iyl
	iyocf[0x85] = function () { r.a = add_8bit(r.a, r.iyl); return 8; }
	// add a,(iy+*)
	iyocf[0x86] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(address); r.a = add_8bit(r.a, byte); return 19; }
	
	// sub iyh
	iyocf[0x94] = function () { r.a = sub_8bit(r.a, r.iyh); return 8; }
	// sub iyl
	iyocf[0x95] = function () { r.a = sub_8bit(r.a, r.iyl); return 8; }
	// sub (iy+*)
	iyocf[0x96] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(address); r.a = sub_8bit(r.a, byte); return 19; }
	
	// and iyh
	iyocf[0xa4] = function () { r.a = and_8bit(r.a, r.iyh); return 8; }
	// and iyl
	iyocf[0xa5] = function () { r.a = and_8bit(r.a, r.iyl); return 8; }
	// and (iy+*)
	iyocf[0xa6] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(address); r.a = and_8bit(r.a, byte); return 19; }
	
	// or iyh
	iyocf[0xb4] = function () { r.a = or_8bit(r.a, r.iyh); return 8; }
	// or iyl
	iyocf[0xb5] = function () { r.a = or_8bit(r.a, r.iyl); return 8; }
	// or (iy+*)
	iyocf[0xb6] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(address); r.a = or_8bit(r.a, byte); return 19; }

	// adc a,(iy+*)
	iyocf[0x8e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(address); r.a = adc_8bit(r.a, byte); return 19; }
	// sbc a,(iy+*)
	iyocf[0x9e] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(address); r.a = sbc_8bit(r.a, byte); return 19; }
	// xor (iy+*)
	iyocf[0xae] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(address); r.a = xor_8bit(r.a, byte); return 19; }
	
	// cp ixh
	iyocf[0xbc] = function () { sub_8bit(r.a, r.iyh); return 8; }
	// cp ixl
	iyocf[0xbd] = function () { sub_8bit(r.a, r.iyl); return 8; }
	// cp (iy+*)
	iyocf[0xbe] = function () { let disp = convertByteToSigned(rb(r.pc)); inc_pc(); let address = (get_iy() + disp) & 0xffff; let byte = rb(address); sub_8bit(r.a, byte); return 19; }

	// ex (sp),iy
	iyocf[0xe3] = function () { return executeExchangeSpIy(); }

	// jp (iy)
	iyocf[0xe9] = function () { r.pc = get_iy(); return 8; }

	////////////////////////////// IX Bit Opcodes //////////////////////////////

	// rlc (ix+*),b
	ixbocf[0x00] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; r.b = rlc_8bit(rb(address)); wb(address, r.b); return 23; }
	// rlc (ix+*),c
	ixbocf[0x01] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; r.c = rlc_8bit(rb(address)); wb(address, r.c); return 23; }
	// rlc (ix+*),d
	ixbocf[0x02] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; r.d = rlc_8bit(rb(address)); wb(address, r.d); return 23; }
	// rlc (ix+*)
	ixbocf[0x06] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rlc_8bit(rb(address)); wb(address, byte); return 23; }

	// rrc (ix+*)
	ixbocf[0x0e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rrc_8bit(rb(address)); wb(address, byte); return 23; }

	// rl (ix+*)
	ixbocf[0x16] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rl_8bit(rb(address)); wb(address, byte); return 23; }

	// rr (ix+*)
	ixbocf[0x1e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rr_8bit(rb(address)); wb(address, byte); return 23; }	

	// sla (ix+*)
	ixbocf[0x26] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = sla_8bit(rb(address)); wb(address, byte); return 23; }

	// sra (ix+*)
	ixbocf[0x2e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = sra_8bit(rb(address)); wb(address, byte); return 23; }

	// sll (ix+*)
	ixbocf[0x36] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = sll_8bit(rb(address)); wb(address, byte); return 23; }

	// srl (ix+*)
	ixbocf[0x3e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = srl_8bit(rb(address)); wb(address, byte); return 23; }

	// bit 0,(ix+*)
	ixbocf[0x46] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT0); return 20; }
	// bit 1,(ix+*)
	ixbocf[0x4e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT1); return 20; }
	// bit 2,(ix+*)
	ixbocf[0x56] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT2); return 20; }
	// bit 3,(ix+*)
	ixbocf[0x5e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT3); return 20; }
	// bit 4,(ix+*)
	ixbocf[0x66] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT4); return 20; }
	// bit 5,(ix+*)
	ixbocf[0x6e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT5); return 20; }
	// bit 6,(ix+*)
	ixbocf[0x76] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT6); return 20; }
	// bit 7,(ix+*)
	ixbocf[0x7e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT7); return 20; }

	// res 0,(ix+*)
	ixbocf[0x86] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT0; wb(address, byte); return 23; }
	// res 1,(ix+*)
	ixbocf[0x8e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT1; wb(address, byte); return 23; }
	// res 2,(ix+*)
	ixbocf[0x96] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT2; wb(address, byte); return 23; }
	// res 3,(ix+*)
	ixbocf[0x9e] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT3; wb(address, byte); return 23; }
	// res 4,(ix+*)
	ixbocf[0xa6] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT4; wb(address, byte); return 23; }
	// res 5,(ix+*)
	ixbocf[0xae] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT5; wb(address, byte); return 23; }
	// res 6,(ix+*)
	ixbocf[0xb6] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT6; wb(address, byte); return 23; }
	// res 7,(ix+*)
	ixbocf[0xbe] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT7; wb(address, byte); return 23; }

	// set 0,(ix+*)
	ixbocf[0xc6] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT0; wb(address, byte); return 23; }
	// set 1,(ix+*)
	ixbocf[0xce] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT1; wb(address, byte); return 23; }
	// set 2,(ix+*)
	ixbocf[0xd6] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT2; wb(address, byte); return 23; }
	// set 3,(ix+*)
	ixbocf[0xde] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT3; wb(address, byte); return 23; }
	// set 4,(ix+*)
	ixbocf[0xe6] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT4; wb(address, byte); return 23; }
	// set 5,(ix+*)
	ixbocf[0xee] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT5; wb(address, byte); return 23; }
	// set 6,(ix+*)
	ixbocf[0xf6] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT6; wb(address, byte); return 23; }
	// set 7,(ix+*)
	ixbocf[0xfe] = function () { let address = (get_ix() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT7; wb(address, byte); return 23; }

	////////////////////////////// IY Bit Opcodes //////////////////////////////

	// rlc (iy+*),b
	iybocf[0x00] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; r.b = rlc_8bit(rb(address)); wb(address, r.b); return 23; }
	// rlc (iy+*),c
	iybocf[0x01] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; r.c = rlc_8bit(rb(address)); wb(address, r.c); return 23; }
	// rlc (iy+*),d
	iybocf[0x02] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; r.d = rlc_8bit(rb(address)); wb(address, r.d); return 23; }
	// rlc (ix+*)
	iybocf[0x06] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rlc_8bit(rb(address)); wb(address, byte); return 23; }

	// rrc (iy+*)
	iybocf[0x0e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rrc_8bit(rb(address)); wb(address, byte); return 23; }

	// rl (iy+*)
	iybocf[0x16] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rl_8bit(rb(address)); wb(address, byte); return 23; }

	// rr (iy+*)
	iybocf[0x1e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rr_8bit(rb(address)); wb(address, byte); return 23; }	

	// sla (iy+*)
	iybocf[0x26] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = sla_8bit(rb(address)); wb(address, byte); return 23; }

	// sra (iy+*)
	iybocf[0x2e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = sra_8bit(rb(address)); wb(address, byte); return 23; }

	// sll (iy+*)
	iybocf[0x36] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = sll_8bit(rb(address)); wb(address, byte); return 23; }

	// srl (iy+*)
	iybocf[0x3e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = srl_8bit(rb(address)); wb(address, byte); return 23; }

	// bit 0,(iy+*)
	iybocf[0x46] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT0); return 20; }
	// bit 1,(iy+*)
	iybocf[0x4e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT1); return 20; }
	// bit 2,(iy+*)
	iybocf[0x56] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT2); return 20; }
	// bit 3,(iy+*)
	iybocf[0x5e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT3); return 20; }
	// bit 4,(iy+*)
	iybocf[0x66] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT4); return 20; }
	// bit 5,(iy+*)
	iybocf[0x6e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT5); return 20; }
	// bit 6,(iy+*)
	iybocf[0x76] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT6); return 20; }
	// bit 7,(iy+*)
	iybocf[0x7e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; bit_8bit(rb(address), BIT7); return 20; }

	// res 0,(iy+*)
	iybocf[0x86] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT0; wb(address, byte); return 23; }
	// res 1,(iy+*)
	iybocf[0x8e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT1; wb(address, byte); return 23; }
	// res 2,(iy+*)
	iybocf[0x96] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT2; wb(address, byte); return 23; }
	// res 3,(iy+*)
	iybocf[0x9e] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT3; wb(address, byte); return 23; }
	// res 4,(iy+*)
	iybocf[0xa6] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT4; wb(address, byte); return 23; }
	// res 5,(iy+*)
	iybocf[0xae] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT5; wb(address, byte); return 23; }
	// res 6,(iy+*)
	iybocf[0xb6] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT6; wb(address, byte); return 23; }
	// res 7,(iy+*)
	iybocf[0xbe] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) & NOT_BIT7; wb(address, byte); return 23; }

	// set 0,(iy+*)
	iybocf[0xc6] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT0; wb(address, byte); return 23; }
	// set 1,(iy+*)
	iybocf[0xce] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT1; wb(address, byte); return 23; }
	// set 2,(iy+*)
	iybocf[0xd6] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT2; wb(address, byte); return 23; }
	// set 3,(iy+*)
	iybocf[0xde] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT3; wb(address, byte); return 23; }
	// set 4,(iy+*)
	iybocf[0xe6] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT4; wb(address, byte); return 23; }
	// set 5,(iy+*)
	iybocf[0xee] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT5; wb(address, byte); return 23; }
	// set 6,(iy+*)
	iybocf[0xf6] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT6; wb(address, byte); return 23; }
	// set 7,(iy+*)
	iybocf[0xfe] = function () { let address = (get_iy() + self.xyDisplacement) & 0xffff; let byte = rb(address) | BIT7; wb(address, byte); return 23; }

	////////////////////////////// ALU Functions //////////////////////////////

	function add_16bit(v1, v2) {

		let rawNewValue = v1 + v2;
		let newValue = rawNewValue & 0xffff;

		// Reset the flags.
		r.f &= 0xec;

		// C: set if the result is greater than 0xffff.
		if (rawNewValue > 0xffff) {
			r.f |= CPU_FLAG_C;
		}

		// N: reset.

		// P/V: preserved.

		// F3: preserved.

		// H: Set if the first 4 bits of the high byte addition resulted in a carry.
		if ((v1 & 0x0fff) + (v2 & 0x0fff) > 0x0fff) {
			r.f |= CPU_FLAG_H;
		}

		// F5: preserved

		// Z: preserved.

		// S: preserved.

		return newValue;
	}

	function adc_16bit(v1, v2) {

		let v3 = (r.f & CPU_FLAG_C) ? 1: 0;
		let rawNewValue = v1 + v2 + v3;
		let newValue = rawNewValue & 0xffff;

		// Reset the flags.
		r.f = 0;

		// C: set if the result is greater than 0xffff.
		if (rawNewValue > 0xffff) {
			r.f |= CPU_FLAG_C;
		}

		// N: reset.

		// P/V: Set if the two's compliment addition overflowed.
		if ((v1 & BIT15) == (v2 & BIT15) && (v1 & BIT15) != (newValue & BIT15)) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: preserved.

		// H: Set if the first 4 bits of the high byte addition resulted in a carry.
		if ((v1 & 0x0fff) + (v2 & 0x0fff) + v3 > 0x0fff) {
			r.f |= CPU_FLAG_H;
		}

		// F5: preserved

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT15) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function sbc_16bit(v1, v2) {

		let v3 = (r.f & CPU_FLAG_C) ? 1 : 0;
		let rawNewValue = v1 - v2 - v3;
		let newValue = rawNewValue & 0xffff;

		// Reset the flags.
		r.f = 0;

		// C: Set if the result is negative..		
		if (rawNewValue < 0) {
			r.f |= CPU_FLAG_C;
		}

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Set if the two's compliment subtraction overflowed.
		if ((v1 & BIT15) != (v2 & BIT15) && (v1 & BIT15) != (newValue & BIT15)) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset

		// H: Set if the first 4 bits of the high byte subtraction resulted in a borrow.
		if ((v1 & 0x0fff) - (v2 & 0x0fff) - v3 < 0) {
			r.f |= CPU_FLAG_H;
		}

		// F5: Reset

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (newValue & BIT15) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function inc_16bit(v) {

		v = (v + 1) & 0xffff;

		return v;
	}

	function dec_16bit(v) {

		v = (v - 1) & 0xffff;

		return v;
	}

	function add_8bit(v1, v2) {

		let rawNewValue = v1 + v2;
		let newValue = rawNewValue & 0xff;

		// Reset the flags.
		r.f = 0;

		// C: Set if the result is greater than 0xff.
		if (rawNewValue > 0xff) {
			r.f |= CPU_FLAG_C;
		}

		// N: reset.

		// P/V: Set if the two's compliment addition overflowed.
		if ((v1 & BIT7) == (v2 & BIT7) && (v1 & BIT7) != (newValue & BIT7)) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset

		// H: Set if the first 4 bits of the addition resulted in a carry.
		if ((v1 & 0x0f) + (v2 & 0x0f) > 0x0f) {
			r.f |= CPU_FLAG_H;
		}

		// F5: Reset

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function adc_8bit(v1, v2) {

		let v3 = (r.f & CPU_FLAG_C) ? 1: 0;
		let rawNewValue = v1 + v2 + v3;
		let newValue = rawNewValue & 0xff;

		// Reset the flags.
		r.f = 0;

		// C: Set if the result is greater than 0xff.
		if (rawNewValue > 0xff) {
			r.f |= CPU_FLAG_C;
		}

		// N: reset.

		// P/V: Set if the two's compliment addition overflowed.
		if ((v1 & BIT7) == (v2 & BIT7) && (v1 & BIT7) != (newValue & BIT7)) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset

		// H: Set if the first 4 bits of the addition resulted in a carry.
		if ((v1 & 0x0f) + (v2 & 0x0f) + v3 > 0x0f) {
			r.f |= CPU_FLAG_H;
		}

		// F5: Reset

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;	
	}

	function sub_8bit(v1, v2) {

		let rawNewValue = v1 - v2;
		let newValue = rawNewValue & 0xff;

		// Reset the flags.
		r.f = 0;

		// C: Set if the result is negative..		
		if (rawNewValue < 0) {
			r.f |= CPU_FLAG_C;
		}

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Set if the two's compliment subtraction overflowed.
		if ((v1 & BIT7) != (v2 & BIT7) && (v1 & BIT7) != (newValue & BIT7)) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Set if the first 4 bits of the subtraction resulted in a borrow.
		if ((v1 & 0x0f) - (v2 & 0x0f) < 0) {
			r.f |= CPU_FLAG_H;
		}

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function sbc_8bit(v1, v2) {

		let v3 = (r.f & CPU_FLAG_C) ? 1 : 0;
		let rawNewValue = v1 - v2 - v3;
		let newValue = rawNewValue & 0xff;

		// Reset the flags.
		r.f = 0;

		// C: Set if the result is negative..		
		if (rawNewValue < 0) {
			r.f |= CPU_FLAG_C;
		}

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Set if the two's compliment subtraction overflowed.
		if ((v1 & BIT7) != (v2 & BIT7) && (v1 & BIT7) != (newValue & BIT7)) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset

		// H: Set if the first 4 bits of the subtraction resulted in a borrow.
		if ((v1 & 0x0f) - (v2 & 0x0f) - v3 < 0) {
			r.f |= CPU_FLAG_H;
		}

		// F5: Reset

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function inc_8bit(v) {

		// Increment and mask back to 8 bits.
		let newValue = (v + 1) & 0xff;

		// Reset the flags.
		r.f &= 0x01; 

		// C: Preserved.

		// N: Reset.

		// P/V: Set if the two's compliment addition overflowed.
		if ((v & BIT7) == 0 && (newValue & BIT7)) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Set if the first 4 bits of the addition resulted in a carry.
		if ((v & 0x0f) + 1 > 0x0f) {
			r.f |= CPU_FLAG_H;
		}

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function dec_8bit(v) {

		// Decrement and mask back to 8 bits.
		let newValue = (v - 1) & 0xff;

		// Reset the flags.
		r.f &= 0x01; 

		// C: Preserved.

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Set if the two's compliment subtraction overflowed.
		if ((v & BIT7) && (newValue & BIT7) == 0) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Set if the first 4 bits of the subtraction resulted in a borrow.
		if ((v & 0x0f) - 1 < 0) {
			r.f |= CPU_FLAG_H;
		}

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function and_8bit(v1, v2) {

		let newValue = v1 & v2;

		// Reset the flags.
		r.f = 0;

		// C: Reset.

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset.

		// H: Set.
		r.f |= CPU_FLAG_H;

		// F5: Reset.

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function or_8bit(v1, v2) {

		let newValue = v1 | v2;

		// Reset the flags.
		r.f = 0;

		// C: Reset.

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset.

		// H: Reset.

		// F5: Reset.

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function xor_8bit(v1, v2) {

		let newValue = v1 ^ v2;

		// Reset the flags.
		r.f = 0;

		// C: Reset.

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset.

		// H: Reset.

		// F5: Reset.

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function sla_8bit(v) {

		let newValue = (v << 1) & 0xff;

		// Reset the flags.
		r.f = 0;

		// C: Set if bit 7 of the input is set.
		if (v & BIT7) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function sra_8bit(v) {

		let newValue = (v >> 1) & 0xff;
		if (v & BIT7) {
			newValue |= BIT7;
		}

		// Reset the flags.
		r.f = 0;

		// C: Set if bit 0 of the input is set.
		if (v & BIT0) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	function rl_8bit(v) {

		let bit7Set = (v & BIT7) > 0;

		let newValue = (v << 1) & 0xff;
		if (r.f & CPU_FLAG_C) {
			newValue |= BIT0;
		}

		// Reset the flags.
		r.f = 0x00;

		// C: Set if bit 7 of the input is set.
		if (bit7Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;	
	}

	function rr_8bit(v) {

		let bit0Set = (v & BIT0) > 0;

		let newValue = (v >> 1) & 0xff;
		if (r.f & CPU_FLAG_C) {
			newValue |= BIT7;
		}

		// Reset the flags.
		r.f = 0x00;

		// C: Set if bit 7 of the input is set.
		if (bit0Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;	
	}

	function sll_8bit(v) {

		let bit7Set = (v & BIT7) > 0;

		let newValue = (v << 1) & 0xff;
		newValue |= BIT0;

		// Reset the flags.
		r.f = 0x00;

		// C: Set if bit 7 of the input is set.
		if (bit7Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;	
	}

	function srl_8bit(v) {

		let bit0Set = (v & BIT0) > 0;

		let newValue = (v >> 1) & 0xff;

		// Reset the flags.
		r.f = 0x00;

		// C: Set if bit 7 of the input is set.
		if (bit0Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;	
	}

	function rlc_8bit(v) {

		let bit7Set = (v & BIT7) > 0;

		let newValue = (v << 1) & 0xff;
		if (bit7Set) {
			newValue |= BIT0;
		}

		// Reset the flags.
		r.f = 0x00;

		// C: Set if bit 7 of the input is set.
		if (bit7Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;	
	}

	function rrc_8bit(v) {

		let bit0Set = (v & BIT0) > 0;

		let newValue = (v >> 1) & 0xff;
		if (bit0Set) {
			newValue |= BIT7;
		}

		// Reset the flags.
		r.f = 0x00;

		// C: Set if bit 7 of the input is set.
		if (bit0Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;	
	}

	function rlca_8bit(v) {

		let bit7Set = (v & BIT7) > 0;

		let newValue = (v << 1) & 0xff;
		if (bit7Set) {
			newValue |= BIT0;
		}

		// Reset the flags.
		r.f &= 0xc4;

		// C: Set if bit 7 of the input is set.
		if (bit7Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Preserved.

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Preserved.

		// S: Preserved.

		return newValue;
	}

	function rrca_8bit(v) {

		let bit0Set = (v & BIT0) > 0;

		let newValue = (v >> 1) & 0xff;
		if (bit0Set) {
			newValue |= BIT7;
		}

		// Reset the flags.
		r.f &= 0xc4;

		// C: Set if bit 0 of the input is set.
		if (bit0Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Preserved.

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Preserved.

		// S: Preserved.

		return newValue;
	}

	function rla_8bit(v) {

		let bit7Set = (v & BIT7) > 0;
		let carryFlagSet = (r.f & CPU_FLAG_C) > 0;

		let newValue = (v << 1) & 0xff;
		if (carryFlagSet) {
			newValue |= BIT0;
		}

		// Reset the flags.
		r.f &= 0xc4;

		// C: Set if bit 7 of the input is set.
		if (bit7Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Preserved.

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Preserved.

		// S: Preserved.

		return newValue;
	}

	function rra_8bit(v) {

		let bit0Set = (v & BIT0) > 0;
		let carryFlagSet = (r.f & CPU_FLAG_C) > 0;

		let newValue = (v >> 1) & 0xff;
		if (carryFlagSet) {
			newValue |= BIT7;
		}

		// Reset the flags.
		r.f &= 0xc4;

		// C: Set if bit 0 of the input is set.
		if (bit0Set) {
			r.f |= CPU_FLAG_C;
		}

		// N: Reset.

		// P/V: Preserved.

		// F3: Set if bit 3 of the result is set.
		if (newValue & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (newValue & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Preserved.

		// S: Preserved.

		return newValue;
	}

	function bit_8bit(v, bitMask) {

		let bitSet = (v & bitMask) != 0;

		// Reset the flags.
		r.f &= 0x01;

		// C: Preserved.

		// N: Reset.

		// P/V: Set if bit not set.
		if (!bitSet) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset.

		// H: Set.
		r.f |= CPU_FLAG_H;

		// F5: Reset.

		// Z: Set if bit not set.
		if (!bitSet) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if bit number is 7 and bit 7 is set.
		if (bitMask == BIT7 && (v & BIT7)) {
			r.f |= CPU_FLAG_S;
		}
	}

	function cpl_8bit(v) {

		v ^= 0xff;

		// C: Preserved.

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Preserved.

		// F3: Preserved.

		// H: Set.
		r.f |= CPU_FLAG_H;

		// F5: Preserved.

		// Z: Preserved.

		// S: Preserved.

		return v;
	}

	/*function daa_8bit(v) {

		let newValue = v;

		if ((r.f & CPU_FLAG_N) == 0) {

			// Adjust from addition.
			let lowNibble = newValue & 0x0f;
			if (lowNibble > 9) {
				r.f |= CPU_FLAG_H;
				newValue += 0x06;
			}

			let highNibble = (newValue & 0xf0) >> 4;
			if (highNibble > 9) {
				r.f |= CPU_FLAG_C;
				newValue += 0x60;
			}

		} else {

			// Adjust from subtraction.
			let lowNibble = newValue & 0x0f;
			if (lowNibble > 9) {
				r.f |= CPU_FLAG_H;
				newValue -= 0x06;
			}

			let highNibble = (newValue & 0xf0) >> 4;
			if (highNibble > 9) {
				r.f |= CPU_FLAG_C;
				newValue -= 0x60;
			}
		}

		newValue &= 0xff;

		// Reset the flags.
		r.f &= 0x13;

		// C: Set from high nibble BCD overflow.

		// N: Preserved.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset.

		// H: Set from low nibble BCD overflow.

		// F5: Reset.

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}*/

	function daa_8bit(v) {

		let correctionFactor = 0;
		let carryFlagWasSet = (r.f & CPU_FLAG_C) > 0;
		let halfCarryFlagWasSet = (r.f & CPU_FLAG_H) > 0;
		let subtractionFlagWasSet = (r.f & CPU_FLAG_N) > 0;

		// Reset the flags (preserve N).
		r.f &= 0x02;

		if (v > 0x99 || carryFlagWasSet) {
			correctionFactor |= 0x60;
			r.f |= CPU_FLAG_C;
		}

		if ((v & 0x0f) > 9 || halfCarryFlagWasSet) {
			correctionFactor |= 0x06;
		}

		let newValue = v;

		if (!subtractionFlagWasSet) {
			newValue += correctionFactor;
		} else {
			newValue -= correctionFactor;
		}

		newValue &= 0xff;

		if ((v & BIT4) ^ (newValue & BIT4)) {
			r.f |= CPU_FLAG_H;
		}

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[newValue]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Reset.

		// F5: Reset.

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: Set if the twos-compliment value is negative.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return newValue;
	}

	////////////////////////////// Complex Instruction Functions //////////////////////////////

	function executeBitOpCode(opCode) {

		var opCodeFunction = bocf[opCode];

		if (opCodeFunction == null) {
			self.crash('Bit op-code function not found for 0x' + opCode.toString(16));
		}

		inc_r();

		return opCodeFunction();
	}	

	function executeExtOpCode(opCode) {

		var opCodeFunction = eocf[opCode];

		if (opCodeFunction == null) {
			self.crash('Ext op-code function not found for 0x' + opCode.toString(16));
		}

		inc_r();

		return opCodeFunction();
	}

	function executeIxOpCode(opCode) {

		var opCodeFunction = ixocf[opCode];

		if (opCodeFunction == null) {
			self.crash('IX op-code function not found for 0x' + opCode.toString(16));
		}

		inc_r();

		return opCodeFunction();
	}

	function executeIyOpCode(opCode) {

		var opCodeFunction = iyocf[opCode];

		if (opCodeFunction == null) {
			self.crash('IY op-code function not found for 0x' + opCode.toString(16));
		}

		inc_r();

		return opCodeFunction();
	}

	function executeIxBitOpCode() {

		self.xyDisplacement = convertByteToSigned(rb(r.pc)); 
		inc_pc();

		let opCode = rb(r.pc); 
		inc_pc();

		var opCodeFunction = ixbocf[opCode];

		if (opCodeFunction == null) {
			self.crash('IX bit op-code function not found for 0x' + opCode.toString(16));
		}

		inc2_r();

		return opCodeFunction();
	}

	function executeIyBitOpCode() {

		self.xyDisplacement = convertByteToSigned(rb(r.pc)); 
		inc_pc();

		let opCode = rb(r.pc); 
		inc_pc();

		var opCodeFunction = iybocf[opCode];

		if (opCodeFunction == null) {
			self.crash('IY bit op-code function not found for 0x' + opCode.toString(16));
		}

		inc2_r();

		return opCodeFunction();
	}

	function executeLoadIncrement() {

		let hl = get_hl();
		let de = get_de();
		let bc = get_bc();

		let byte = rb(hl);
		wb(de, byte);

		hl = inc_16bit(hl);
		de = inc_16bit(de);
		bc = dec_16bit(bc);

		set_hl(hl);
		set_de(de);
		set_bc(bc);

		r.f &= 0xc1;

		let testByte = (byte + r.a) & 0xff;

		// C: Preserved.

		// N: Reset.

		// P/V: Set if BC is not 0.
		if (bc > 0) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the test byte is set.
		if (testByte & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 1 of the test byte is set.
		if (testByte & BIT1) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Preserved.

		// S: Preserved.

		return 16;
	}

	function executeLoadIncrementRepeat() {

		let hl = get_hl();
		let de = get_de();
		let bc = get_bc();

		let byte = rb(hl);
		wb(de, byte);

		hl = inc_16bit(hl);
		de = inc_16bit(de);
		bc = dec_16bit(bc);

		set_hl(hl);
		set_de(de);
		set_bc(bc);

		r.f &= 0xc1;

		let testByte = (byte + r.a) & 0xff;

		// C: Preserved.

		// N: Reset.

		// P/V: Set if BC is not 0.
		if (bc > 0) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the test byte is set.
		if (testByte & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 1 of the test byte is set.
		if (testByte & BIT1) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Preserved.

		// S: Preserved.

		if (bc > 0) {
			dec2_pc();
			return 21;
		} else {
			return 16;
		}
	}

	function executeLoadDecrement() {

		let hl = get_hl();
		let de = get_de();
		let bc = get_bc();

		let byte = rb(hl);
		wb(de, byte);

		hl = dec_16bit(hl);
		de = dec_16bit(de);
		bc = dec_16bit(bc);

		set_hl(hl);
		set_de(de);
		set_bc(bc);

		r.f &= 0xc1;

		let testByte = (byte + r.a) & 0xff;

		// C: Preserved.

		// N: Reset.

		// P/V: Set if BC is not 0.
		if (bc > 0) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the test byte is set.
		if (testByte & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 1 of the test byte is set.
		if (testByte & BIT1) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Preserved.

		// S: Preserved.

		return 16;
	}

	function executeLoadDecrementRepeat() {

		let hl = get_hl();
		let de = get_de();
		let bc = get_bc();

		let byte = rb(hl);
		wb(de, byte);

		hl = dec_16bit(hl);
		de = dec_16bit(de);
		bc = dec_16bit(bc);

		set_hl(hl);
		set_de(de);
		set_bc(bc);

		r.f &= 0xc1;

		let testByte = (byte + r.a) & 0xff;

		// C: Preserved.

		// N: Reset.
		if (bc > 0) {
			r.f |= CPU_FLAG_N;
		}

		// P/V: Reset.

		// F3: Set if bit 3 of the test byte is set.
		if (testByte & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 1 of the test byte is set.
		if (testByte & BIT1) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Preserved.

		// S: Preserved.

		if (bc > 0) {
			dec2_pc();
			return 21;
		} else {
			return 16;
		}
	}

	function executeInIncrement() {

		let hl = get_hl();

		let byte = self.ioc.readByte(r.c);
		wb(hl, byte);

		set_hl(inc_16bit(hl));

		r.b = dec_8bit(r.b);

		return 16;
	}

	function executeInIncrementRepeat() {

		inc2_r();

		let hl = get_hl();

		let byte = self.ioc.readByte(r.c);
		wb(hl, byte);

		set_hl(inc_16bit(hl));

		r.b = dec_8bit(r.b);

		if (r.b > 0) {
			dec2_pc();
			return 21;
		} else {
			return 16;
		}
	}

	function executeInDecrement() {

		let hl = get_hl();

		let byte = self.ioc.readByte(r.c);
		wb(hl, byte);

		set_hl(dec_16bit(hl));

		r.b = dec_8bit(r.b);

		return 16;
	}

	function executeInDecrementRepeat() {

		let hl = get_hl();

		let byte = self.ioc.readByte(r.c);
		wb(hl, byte);

		set_hl(dec_16bit(hl));

		r.b = dec_8bit(r.b);

		if (r.b > 0) {
			dec2_pc();
			return 21;
		} else {
			return 16;
		}
	}

	function executeOutIncrement() {

		let hl = get_hl();

		let byte = rb(hl);
		self.ioc.writeByte(r.c, byte);

		set_hl(inc_16bit(hl));

		r.b = dec_8bit(r.b);

		return 16;
	}

	function executeOutIncrementRepeat() {

		inc2_r();

		let hl = get_hl();

		let byte = rb(hl);
		self.ioc.writeByte(r.c, byte);

		set_hl(inc_16bit(hl));

		r.b = dec_8bit(r.b);

		if (r.b > 0) {
			dec2_pc();
			return 21;
		} else {
			return 16;
		}
	}

	function executeOutDecrement() {

		let hl = get_hl();

		let byte = rb(hl);
		self.ioc.writeByte(r.c, byte);

		set_hl(dec_16bit(hl));

		r.b = dec_8bit(r.b);

		return 16;
	}

	function executeOutDecrementRepeat() {

		let hl = get_hl();

		let byte = rb(hl);
		self.ioc.writeByte(r.c, byte);

		set_hl(dec_16bit(hl));

		r.b = dec_8bit(r.b);

		if (r.b > 0) {
			dec2_pc();
			return 21;
		} else {
			return 16;
		}
	}

	function executeConditionalJump(conditionIsTrue) {

		let address = rw(r.pc); 
		inc2_pc(); 

		if (conditionIsTrue) { 
			r.pc = address; 
		}

		return 10;
	}

	function executeConditionalRelativeJump(conditionIsTrue) {

		let offset = rb(r.pc);
		inc_pc();

		if (conditionIsTrue) {

			add_pc_signed(offset);
			return 12;

		} else {

			return 7;
		}
	}

	function executeDecrementRelativeJump() {

		r.b--;
		r.b &= 0xff;

		let offset = rb(r.pc);
		inc_pc();

		if (r.b != 0) {

			add_pc_signed(offset);
			return 13;

		} else {

			return 8;
		}
	}

	function executeConditionalCall(conditionIsTrue) {

		let address = rw(r.pc); 
		inc2_pc(); 

		if (conditionIsTrue) {
			pushWord(r.pc);
			r.pc = address;
			return 17;
		} else {
			return 10;
		}
	}

	function executeConditonalReturn(conditionIsTrue) {

		if (conditionIsTrue) {
			r.pc = popWord(); 
			return 11;
		} else {
			return 5;
		}
	}

	function executeExchangeAf() {

		let tempA = r.a;
		let tempF = r.f;

		r.a = sr.a;
		r.f = sr.f;

		sr.a = tempA;
		sr.f = tempF;

		return 4;
	}

	function executeExchange() {

		let tempB = r.b;
		let tempC = r.c;
		let tempD = r.d;
		let tempE = r.e;
		let tempH = r.h;
		let tempL = r.l;

		r.b = sr.b;
		r.c = sr.c;
		r.d = sr.d;
		r.e = sr.e;
		r.h = sr.h;
		r.l = sr.l;

		sr.b = tempB;
		sr.c = tempC;
		sr.d = tempD;
		sr.e = tempE;
		sr.h = tempH;
		sr.l = tempL;

		return 4;	
	}

	function executeExchangeDeHl() {

		let tempD = r.d;
		let tempE = r.e;

		r.d = r.h;
		r.e = r.l;
		r.h = tempD;
		r.l = tempE;

		return 4;	
	}

	function executeExchangeSpHl() {

		let tempH = r.h;
		let tempL = r.l;

		r.h = rb((r.sp + 1) & 0xffff);
		r.l = rb(r.sp);

		wb(r.sp, tempL);
		wb((r.sp + 1) & 0xffff, tempH);

		return 19;
	}

	function executeExchangeSpIx() {

		let tempIxh = r.ixh;
		let tempIxl = r.ixl;

		r.ixh = rb((r.sp + 1) & 0xffff);
		r.ixl = rb(r.sp);

		wb(r.sp, tempIxl);
		wb((r.sp + 1) & 0xffff, tempIxh);

		return 23;
	}

	function executeExchangeSpIy() {

		let tempIyh = r.iyh;
		let tempIyl = r.iyl;

		r.iyh = rb((r.sp + 1) & 0xffff);
		r.iyl = rb(r.sp);

		wb(r.sp, tempIyl);
		wb((r.sp + 1) & 0xffff, tempIyh);

		return 23;
	}

	function executeCcf() {

		let oldC = r.f & CPU_FLAG_C;

		r.f &= 0xc4;

		if (!oldC) {
			r.f |= CPU_FLAG_C;
		}

		if (oldC) {
			r.f |= CPU_FLAG_H;
		}

		return 4;
	}

	function executeCpd() {

		let hl = get_hl();
		let bc = get_bc();

		let byte = rb(hl);

		hl = dec_16bit(hl);
		bc = dec_16bit(bc)

		set_hl(hl); 
		set_bc(bc); 

		let v1 = r.a;
		let v2 = byte;
		let rawNewValue = v1 - v2;
		let newValue = rawNewValue & 0xff;

		// Reset the flags.
		r.f &= 0x01;

		// H: Set if the first 4 bits of the subtraction resulted in a borrow.
		if ((v1 & 0x0f) - (v2 & 0x0f) < 0) {
			r.f |= CPU_FLAG_H;
		}

		let testByte = (r.a - byte - ((r.f & CPU_FLAG_H) ? 1 : 0)) & 0xff;

		// C: Preserved.

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Set if BC is not 0.
		if (bc != 0) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of (A - (HL) - H) is set.
		if (testByte & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// F5: Set if bit 1 of (A - (HL) - H) is set.
		if (testByte & BIT1) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return 16; 
	}

	function executeCpdr() {

		let hl = get_hl();
		let bc = get_bc();

		let byte = rb(hl);

		hl = dec_16bit(hl);
		bc = dec_16bit(bc)

		set_hl(hl); 
		set_bc(bc); 

		let v1 = r.a;
		let v2 = byte;
		let rawNewValue = v1 - v2;
		let newValue = rawNewValue & 0xff;

		// Reset the flags.
		r.f &= 0x01;

		// H: Set if the first 4 bits of the subtraction resulted in a borrow.
		if ((v1 & 0x0f) - (v2 & 0x0f) < 0) {
			r.f |= CPU_FLAG_H;
		}

		let testByte = (r.a - byte - ((r.f & CPU_FLAG_H) ? 1 : 0)) & 0xff;

		// C: Preserved.

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Set if BC is not 0.
		if (bc != 0) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of (A - (HL) - H) is set.
		if (testByte & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// F5: Set if bit 1 of (A - (HL) - H) is set.
		if (testByte & BIT1) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		if (bc != 0 && (r.f & CPU_FLAG_Z) == 0) {
			dec2_pc();
			return 21;
		} else {
			return 16;
		}
	}

	function executeCpi() {

		let hl = get_hl();
		let bc = get_bc();

		let byte = rb(hl);

		hl = inc_16bit(hl);
		bc = dec_16bit(bc)

		set_hl(hl); 
		set_bc(bc); 

		let v1 = r.a;
		let v2 = byte;
		let rawNewValue = v1 - v2;
		let newValue = rawNewValue & 0xff;

		// Reset the flags.
		r.f &= 0x01;

		// H: Set if the first 4 bits of the subtraction resulted in a borrow.
		if ((v1 & 0x0f) - (v2 & 0x0f) < 0) {
			r.f |= CPU_FLAG_H;
		}

		let testByte = (r.a - byte - ((r.f & CPU_FLAG_H) ? 1 : 0)) & 0xff;

		// C: Preserved.

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Set if BC is not 0.
		if (bc != 0) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of (A - (HL) - H) is set.
		if (testByte & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// F5: Set if bit 1 of (A - (HL) - H) is set.
		if (testByte & BIT1) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return 16; 
	}

	function executeCpir() {

		let hl = get_hl();
		let bc = get_bc();

		let byte = rb(hl);

		hl = inc_16bit(hl);
		bc = dec_16bit(bc)

		set_hl(hl); 
		set_bc(bc); 

		let v1 = r.a;
		let v2 = byte;
		let rawNewValue = v1 - v2;
		let newValue = rawNewValue & 0xff;

		// Reset the flags.
		r.f &= 0x01;

		// H: Set if the first 4 bits of the subtraction resulted in a borrow.
		if ((v1 & 0x0f) - (v2 & 0x0f) < 0) {
			r.f |= CPU_FLAG_H;
		}

		let testByte = (r.a - byte - ((r.f & CPU_FLAG_H) ? 1 : 0)) & 0xff;

		// C: Preserved.

		// N: Set.
		r.f |= CPU_FLAG_N;

		// P/V: Set if BC is not 0.
		if (bc != 0) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of (A - (HL) - H) is set.
		if (testByte & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// F5: Set if bit 1 of (A - (HL) - H) is set.
		if (testByte & BIT1) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (newValue == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (newValue & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		if (bc != 0 && (r.f & CPU_FLAG_Z) == 0) {
			dec2_pc();
			return 21;
		} else {
			return 16;
		}
	}

	function executeRrd() {

		let address = get_hl();
		let byte = rb(address);

		let nibble0 = (r.a & 0x0f);
		let nibble1 = (byte & 0xf0) >> 4;
		let nibble2 = (byte & 0x0f);

		r.a = (r.a & 0xf0) | nibble2;
		byte = (nibble0 << 4) | nibble1;

		wb(address, byte);

		// Reset the flags.
		r.f &= 0x01;

		// C: Preserved.

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[r.a]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (r.a & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (r.a & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (r.a == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (r.a & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return 18;
	}

	function executeRld() {

		let address = get_hl();
		let byte = rb(address);

		let nibble0 = (r.a & 0x0f);
		let nibble1 = (byte & 0xf0) >> 4;
		let nibble2 = (byte & 0x0f);

		r.a = (r.a & 0xf0) | nibble1;
		byte = (nibble2 << 4) | nibble0;

		wb(address, byte);

		// Reset the flags.
		r.f &= 0x01;

		// C: Preserved.

		// N: Reset.

		// P/V: Set if new value has even number of set bits.
		if (self.parityLookUp[r.a]) {
			r.f |= CPU_FLAG_PV;
		}

		// F3: Set if bit 3 of the result is set.
		if (r.a & BIT3) {
			r.f |= CPU_FLAG_F3;
		}

		// H: Reset.

		// F5: Set if bit 5 of the test byte is set.
		if (r.a & BIT5) {
			r.f |= CPU_FLAG_F5;
		}

		// Z: Set if the value is zero.
		if (r.a == 0) {
			r.f |= CPU_FLAG_Z;
		}

		// S: If the twos-compliment value is negative, set the negative flag.
		if (r.a & BIT7) {
			r.f |= CPU_FLAG_S;
		}

		return 18;
	}

	////////////////////////////// Init //////////////////////////////

	this.init();
}