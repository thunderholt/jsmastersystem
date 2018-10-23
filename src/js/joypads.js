function Joypads() {

	let self = this;

	this.portAB = 0xff;
	this.portBMisc = 0xff;
	this.gamepad = null;
	this.keystates = [];

	this.init = function () {

		for (let i = 0; i < 0xff; i++) {
			this.keystates[i] = KEYSTATE_UP;
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
			self.gamepad = navigator.getGamepads()[e.gamepad.index];
			console.log(
				'Gamepad connected at index %d: %s. %d buttons, %d axes.',
				self.gamepad.index, self.gamepad.id, self.gamepad.buttons.length, self.gamepad.axes.length);
		});

		this.reset();
	}

	this.reset = function () {

		this.portAB = 0xff;
		this.portBMisc = 0xff;
	}

	this.update = function () {

		this.handleButtonUp(JOYPADS_A_LEFT);
		this.handleButtonUp(JOYPADS_A_UP);
		this.handleButtonUp(JOYPADS_A_RIGHT);
		this.handleButtonUp(JOYPADS_A_DOWN);
		this.handleButtonUp(JOYPADS_A_TRIGGER_LEFT);
		this.handleButtonUp(JOYPADS_A_TRIGGER_RIGHT);

		if (this.keystates[37] == KEYSTATE_DOWN) {
			this.handleButtonDown(JOYPADS_A_LEFT);
		}

		if (this.keystates[38] == KEYSTATE_DOWN) {
			this.handleButtonDown(JOYPADS_A_UP);
		}

		if (this.keystates[39] == KEYSTATE_DOWN) {
			this.handleButtonDown(JOYPADS_A_RIGHT);
		}

		if (this.keystates[40] == KEYSTATE_DOWN) {
			this.handleButtonDown(JOYPADS_A_DOWN);
		}

		if (this.keystates[90] == KEYSTATE_DOWN) {
			this.handleButtonDown(JOYPADS_A_TRIGGER_LEFT);
		}

		if (this.keystates[88] == KEYSTATE_DOWN) {
			this.handleButtonDown(JOYPADS_A_TRIGGER_RIGHT);
		}

		this.gamepad = navigator.getGamepads()[0];

		if (this.gamepad != null) {
			if (this.gamepad.buttons[0].pressed) {
				this.handleButtonDown(JOYPADS_A_TRIGGER_LEFT);
			}

			if (this.gamepad.buttons[1].pressed) {
				this.handleButtonDown(JOYPADS_A_TRIGGER_RIGHT);
			}

			if (this.gamepad.buttons[12].pressed) {
				this.handleButtonDown(JOYPADS_A_UP);
			}

			if (this.gamepad.buttons[13].pressed) {
				this.handleButtonDown(JOYPADS_A_DOWN);
			}

			if (this.gamepad.buttons[14].pressed) {
				this.handleButtonDown(JOYPADS_A_LEFT);
			}

			if (this.gamepad.buttons[15].pressed) {
				this.handleButtonDown(JOYPADS_A_RIGHT);
			}
		}

		/*if (self.gamepad != null) {
			if (self.gamepad.buttons[0].pressed) {
				this.handleButtonDown(JOYPADS_A_TRIGGER_LEFT);
			} else {
				this.handleButtonUp(JOYPADS_A_TRIGGER_LEFT);
			}

			if (self.gamepad.buttons[1].pressed) {
				this.handleButtonDown(JOYPADS_A_TRIGGER_RIGHT);
			} else {
				this.handleButtonUp(JOYPADS_A_TRIGGER_RIGHT);
			}

			if (self.gamepad.buttons[12].pressed) {
				this.handleButtonDown(JOYPADS_A_UP);
			} else {
				this.handleButtonUp(JOYPADS_A_UP);
			}

			if (self.gamepad.buttons[13].pressed) {
				this.handleButtonDown(JOYPADS_A_DOWN);
			} else {
				this.handleButtonUp(JOYPADS_A_DOWN);
			}

			if (self.gamepad.buttons[14].pressed) {
				this.handleButtonDown(JOYPADS_A_LEFT);
			} else {
				this.handleButtonUp(JOYPADS_A_LEFT);
			}

			if (self.gamepad.buttons[15].pressed) {
				this.handleButtonDown(JOYPADS_A_RIGHT);
			} else {
				this.handleButtonUp(JOYPADS_A_RIGHT);
			}
		}*/
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

		this.keystates[keyCode] = KEYSTATE_DOWN;

		/*if (keyCode == 37) {
			this.portAB ^= JOYPADS_A_LEFT;
		} else if (keyCode == 38) {
			this.portAB ^= JOYPADS_A_UP;
		} else if (keyCode == 39) {
			this.portAB ^= JOYPADS_A_RIGHT;
		} else if (keyCode == 40) {
			this.portAB ^= JOYPADS_A_DOWN;
		} else if (keyCode == 90) {
			this.portAB ^= JOYPADS_A_TRIGGER_LEFT;
		} else if (keyCode == 88) {
			this.portAB ^= JOYPADS_A_TRIGGER_RIGHT;
		}*/

		/*if (keyCode == 37) {
			this.handleButtonDown(JOYPADS_A_LEFT);
		} else if (keyCode == 38) {
			this.handleButtonDown(JOYPADS_A_UP);
		} else if (keyCode == 39) {
			this.handleButtonDown(JOYPADS_A_RIGHT);
		} else if (keyCode == 40) {
			this.handleButtonDown(JOYPADS_A_DOWN);
		} else if (keyCode == 90) {
			this.handleButtonDown(JOYPADS_A_TRIGGER_LEFT);
		} else if (keyCode == 88) {
			this.handleButtonDown(JOYPADS_A_TRIGGER_RIGHT);
		}*/
	}

	this.handleKeyUpEvent = function (e) {

		var keyCode = e.which;
		if (keyCode == null) {
			keyCode = e.keyCode;
		}

		this.keystates[keyCode] = KEYSTATE_UP;

		/*if (keyCode == 37) {
			this.portAB |= JOYPADS_A_LEFT;
		} else if (keyCode == 38) {
			this.portAB |= JOYPADS_A_UP;
		} else if (keyCode == 39) {
			this.portAB |= JOYPADS_A_RIGHT;
		} else if (keyCode == 40) {
			this.portAB |= JOYPADS_A_DOWN;
		} else if (keyCode == 90) {
			this.portAB |= JOYPADS_A_TRIGGER_LEFT;
		} else if (keyCode == 88) {
			this.portAB |= JOYPADS_A_TRIGGER_RIGHT;
		}*/

		/*if (keyCode == 37) {
			this.handleButtonUp(JOYPADS_A_LEFT);
		} else if (keyCode == 38) {
			this.handleButtonUp(JOYPADS_A_UP);
		} else if (keyCode == 39) {
			this.handleButtonUp(JOYPADS_A_RIGHT);
		} else if (keyCode == 40) {
			this.handleButtonUp(JOYPADS_A_DOWN);
		} else if (keyCode == 90) {
			this.handleButtonUp(JOYPADS_A_TRIGGER_LEFT);
		} else if (keyCode == 88) {
			this.handleButtonUp(JOYPADS_A_TRIGGER_RIGHT);
		}*/
	}

	this.handleButtonDown = function (button) {

		this.portAB &= 0xff ^ button;
	}

	this.handleButtonUp = function (button) {

		this.portAB |= button;
	}
}