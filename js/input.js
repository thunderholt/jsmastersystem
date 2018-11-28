function Input() {

	let self = this;

	this.portAB = 0xff;
	this.portBMisc = 0xff;
	this.keystates = [];
	this.joypads = [];

	this.init = function () {

		for (let i = 0; i < 0xff; i++) {
			this.keystates[i] = INPUT_KEYSTATE_UP;
		}

		window.addEventListener('keydown', function (e) {
			self.handleKeyDownEvent(e);
			e.preventDefault();
		}, false);

		window.addEventListener('keyup', function (e) {
			self.handleKeyUpEvent(e);
			e.preventDefault();
		}, false);

		window.addEventListener('gamepadconnected', function(e) {

			self.joypads[0].gamepadIndex = e.gamepad.index;

			console.log(
				'Gamepad connected at index %d: %s. %d buttons, %d axes.',
				e.gamepad.index, e.gamepad.id, e.gamepad.buttons.length, e.gamepad.axes.length);
		});

		// Setup joypad 1.
		let joypad1 = {
			portBitMappings: {},
			keyMappings: {},
			gamepadIndex: -1,
			gamepadButtonMappings: {}
		}

		joypad1.portBitMappings[INPUT_JOYPAD_BUTTON_UP] = { port: INPUT_PORT_AB, bit: BIT0 };
		joypad1.portBitMappings[INPUT_JOYPAD_BUTTON_DOWN] = { port: INPUT_PORT_AB, bit: BIT1 };
		joypad1.portBitMappings[INPUT_JOYPAD_BUTTON_LEFT] = { port: INPUT_PORT_AB, bit: BIT2 };
		joypad1.portBitMappings[INPUT_JOYPAD_BUTTON_RIGHT] = { port: INPUT_PORT_AB, bit: BIT3 };
		joypad1.portBitMappings[INPUT_JOYPAD_BUTTON_TRIGGER_LEFT] = { port: INPUT_PORT_AB, bit: BIT4 };
		joypad1.portBitMappings[INPUT_JOYPAD_BUTTON_TRIGGER_RIGHT] = { port: INPUT_PORT_AB, bit: BIT5 };

		joypad1.keyMappings[INPUT_JOYPAD_BUTTON_UP] = INPUT_KEYCODE_UP;
		joypad1.keyMappings[INPUT_JOYPAD_BUTTON_DOWN] = INPUT_KEYCODE_DOWN;
		joypad1.keyMappings[INPUT_JOYPAD_BUTTON_LEFT] = INPUT_KEYCODE_LEFT;
		joypad1.keyMappings[INPUT_JOYPAD_BUTTON_RIGHT] = INPUT_KEYCODE_RIGHT;
		joypad1.keyMappings[INPUT_JOYPAD_BUTTON_TRIGGER_LEFT] = INPUT_KEYCODE_Z;
		joypad1.keyMappings[INPUT_JOYPAD_BUTTON_TRIGGER_RIGHT] = INPUT_KEYCODE_X;

		joypad1.gamepadButtonMappings[INPUT_JOYPAD_BUTTON_UP] = 12;
		joypad1.gamepadButtonMappings[INPUT_JOYPAD_BUTTON_DOWN] = 13;
		joypad1.gamepadButtonMappings[INPUT_JOYPAD_BUTTON_LEFT] = 14;
		joypad1.gamepadButtonMappings[INPUT_JOYPAD_BUTTON_RIGHT] = 15;
		joypad1.gamepadButtonMappings[INPUT_JOYPAD_BUTTON_TRIGGER_LEFT] = 0;
		joypad1.gamepadButtonMappings[INPUT_JOYPAD_BUTTON_TRIGGER_RIGHT] = 1;

		this.joypads.push(joypad1);

		// Setup joypad 2.
		let joypad2 = {
			portBitMappings: {},
			keyMappings: {},
			gamepadIndex: -1,
			gamepadButtonMappings: {}
		}

		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_UP] = { port: INPUT_PORT_AB, bit: BIT6 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_DOWN] = { port: INPUT_PORT_AB, bit: BIT7 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_LEFT] = { port: INPUT_PORT_BMISC, bit: BIT1 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_RIGHT] = { port: INPUT_PORT_BMISC, bit: BIT2 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_TRIGGER_LEFT] = { port: INPUT_PORT_BMISC, bit: BIT3 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_TRIGGER_RIGHT] = { port: INPUT_PORT_BMISC, bit: BIT4 };

		this.joypads.push(joypad2);

		this.reset();
	}

	this.reset = function () {

		this.portAB = 0xff;
		this.portBMisc = 0xff;
	}

	this.readByteFromPortAB = function () {

		return this.portAB;
	}

	this.readByteFromPortBMisc = function () {
		
		return this.portBMisc;
	}

	this.handleKeyDownEvent = function (e) {

		var keyCode = e.which;
		if (keyCode == null) {
			keyCode = e.keyCode;
		}

		this.keystates[keyCode] = INPUT_KEYSTATE_DOWN;
	}

	this.handleKeyUpEvent = function (e) {

		var keyCode = e.which;
		if (keyCode == null) {
			keyCode = e.keyCode;
		}

		this.keystates[keyCode] = INPUT_KEYSTATE_UP;
	}

	this.update = function () {

		for (let joypadIndex = 0; joypadIndex < 2; joypadIndex++) {

			let joypad = this.joypads[joypadIndex];

			for (let buttonIndex = 0; buttonIndex < INPUT_BUTTON_COUNT; buttonIndex++) {

				let portBitMapping = joypad.portBitMappings[buttonIndex];

				let keyCode = joypad.keyMappings[buttonIndex];
				let gamepadButtonIndex = joypad.gamepadButtonMappings[buttonIndex];
				let buttonIsDown = false;

				// See if the keyboard key is down.
				if (keyCode != null && this.keystates[keyCode] == INPUT_KEYSTATE_DOWN) {
					buttonIsDown = true;
				}

				// See if the joypad button is down.
				if (joypad.gamepadIndex != -1) {
					let gamepad = navigator.getGamepads()[joypad.gamepadIndex];
					if (gamepad != null && gamepad.buttons[gamepadButtonIndex].pressed) {
						buttonIsDown = true;
					}
				}

				// Toggle the port bit accordingly.
				if (buttonIsDown) {
					this.unsetPortBit(portBitMapping.port, portBitMapping.bit);
				} else {
					this.setPortBit(portBitMapping.port, portBitMapping.bit);
				}
			}
		}
	}

	this.setPortBit = function (port, bitNumber) {

		if (port == INPUT_PORT_AB) {
			this.portAB |= bitNumber;
		} else if (port == INPUT_PORT_BMISC) {
			this.portBMisc |= bitNumber;
		}
	}

	this.unsetPortBit = function (port, bitNumber) {

		if (port == INPUT_PORT_AB) {
			this.portAB &= 0xff ^ bitNumber;
		} else if (port == INPUT_PORT_BMISC) {
			this.portBMisc &= 0xff ^ bitNumber;
		}
	}
}