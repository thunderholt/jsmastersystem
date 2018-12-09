function Input() {

	let self = this;

	this.portAB = 0xff;
	this.portBMisc = 0xff;
	this.keystates = [];
	this.onscreenGamepadButtons = [];
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

		this.initJoypad1();
		this.initJoypad2();
		this.initOnscreenGamepad();
		
		this.reset();
	}

	this.initJoypad1 = function () {

		let joypad1 = {
			portBitMappings: {},
			keyMappings: {},
			gamepadIndex: -1,
			gamepadButtonMappings: {},
			useOnscreenGamepad: true
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
	}

	this.initJoypad2 = function () {

		let joypad2 = {
			portBitMappings: {},
			keyMappings: {},
			gamepadIndex: -1,
			gamepadButtonMappings: {},
			useOnscreenGamepad: false
		}

		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_UP] = { port: INPUT_PORT_AB, bit: BIT6 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_DOWN] = { port: INPUT_PORT_AB, bit: BIT7 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_LEFT] = { port: INPUT_PORT_BMISC, bit: BIT1 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_RIGHT] = { port: INPUT_PORT_BMISC, bit: BIT2 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_TRIGGER_LEFT] = { port: INPUT_PORT_BMISC, bit: BIT3 };
		joypad2.portBitMappings[INPUT_JOYPAD_BUTTON_TRIGGER_RIGHT] = { port: INPUT_PORT_BMISC, bit: BIT4 };

		this.joypads.push(joypad2);
	}

	this.initOnscreenGamepad = function () {

		// Init the on-screen gamepad buttons.
		for (let i = 0; i < INPUT_BUTTON_COUNT; i++) {
			this.onscreenGamepadButtons.push({
				rect: { left: 0, top: 0, right: 0, bottom: 0 },
				state: INPUT_BUTTONSTATE_UP
			});
		}

		// Load the on-screen gamepad buttons rects from the DOM, and
		// make sure we reload the rects if the window is resized or if the
		// orientation changes.
		this.reloadOnscreenGamepadButtonRects();

		window.addEventListener('resize', function () {
			self.reloadOnscreenGamepadButtonRects();			
		});

		window.addEventListener('orientationchange', function () {
			self.reloadOnscreenGamepadButtonRects();			
		});

		// If a touch event happens, update the on-screen gamepad button states.
		window.addEventListener('touchstart', function (e) {
			self.handleOnscreenGamepadTouchEvent(e);
		}, false);

		window.addEventListener('touchend', function (e) {
			self.handleOnscreenGamepadTouchEvent(e);
		}, false);

		window.addEventListener('touchmove', function (e) {
			self.handleOnscreenGamepadTouchEvent(e);
		}, false);
	}

	this.reloadOnscreenGamepadButtonRects = function () {

		let onscreenGamepadElement = document.querySelector('[data-role="onscreen-gamepad"]');
		let onscreenGamepadButtonElements = onscreenGamepadElement.querySelectorAll('[data-role="onscreen-gamepad-button"]');

		for (let i = 0; i < onscreenGamepadButtonElements.length; i++) {
			let buttonElement = onscreenGamepadButtonElements[i];
			let buttonElementRect = buttonElement.getBoundingClientRect();
			let buttonIndex = parseInt(buttonElement.getAttribute('data-button-index'));


			this.onscreenGamepadButtons[buttonIndex].rect.left = buttonElementRect.left;
			this.onscreenGamepadButtons[buttonIndex].rect.top = buttonElementRect.top;
			this.onscreenGamepadButtons[buttonIndex].rect.right = buttonElementRect.right;
			this.onscreenGamepadButtons[buttonIndex].rect.bottom = buttonElementRect.bottom;
		}
	}

	this.handleOnscreenGamepadTouchEvent = function (e) {

		for (let i = 0; i < this.onscreenGamepadButtons.length; i++) {
			this.onscreenGamepadButtons[i].state = INPUT_BUTTONSTATE_UP;
		}

		for (let touchIndex = 0; touchIndex < e.touches.length; touchIndex++) {
			let touch = e.touches[touchIndex];

			for (let i = 0; i < this.onscreenGamepadButtons.length; i++) {
				let onscreenGamepadButton = this.onscreenGamepadButtons[i]; 
				if (touch.clientX >= onscreenGamepadButton.rect.left &&
					touch.clientX <= onscreenGamepadButton.rect.right &&
					touch.clientY >= onscreenGamepadButton.rect.top &&
					touch.clientY <= onscreenGamepadButton.rect.bottom) {

					onscreenGamepadButton.state = INPUT_BUTTONSTATE_DOWN;
				}
			}
		}
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

				// See if the gamepad button is down.
				if (joypad.gamepadIndex != -1) {
					let gamepad = navigator.getGamepads()[joypad.gamepadIndex];
					if (gamepad != null && gamepad.buttons[gamepadButtonIndex].pressed) {
						buttonIsDown = true;
					}
				}

				// See if the on-screen gamepad button is down.
				if (joypad.useOnscreenGamepad && self.onscreenGamepadButtons[buttonIndex].state == INPUT_BUTTONSTATE_DOWN) {
					buttonIsDown = true;
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