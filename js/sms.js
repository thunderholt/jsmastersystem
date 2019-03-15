function Sms() {

	var self = this;

	this.cpu = new Cpu();
	this.mmc = new Mmc();
	this.ioc = new Ioc();
	this.vdp = new Vdp();
	this.input = new Input();
	this.audio = new Audio();
	this.util = new Util();

	this.isRunning = false;
	this.totalFramesRendered = 0;
	this.averageFrameDuration = 0;
	this.totalFrameDuration = 0;
	this.numberOfFrameRateDrops = 0;

	this.init = function () {

		this.cpu.setMmc(this.mmc);
		this.cpu.setIoc(this.ioc);

		this.vdp.setCpu(this.cpu);

		this.ioc.setVdp(this.vdp);
		this.ioc.setInput(this.input);
		this.ioc.setAudio(this.audio);

		this.vdp.init();
		this.input.init();

		this.mainLoop();
	}

	this.openMenu = function () {

		let menu = document.getElementById('menu');
		menu.style.display = 'block';
	}

	this.hideMenu = function () {

		let menu = document.getElementById('menu');
		menu.style.display = 'none';
	}

	this.loadRom = function (source) {

		this.hideMenu();

		this.isRunning = false;
		this.cpu.reset();
		this.vdp.reset();
		this.mmc.reset();
		this.audio.reset();
		this.input.reset();

		if (source == 'file') {

			var romFileInput = document.getElementById('romFileInput');

			if (romFileInput.files.length > 0) {
				let file = romFileInput.files[0];

				let reader = new FileReader();	
				reader.onload = function (e) {
					let romBytes = new Uint8Array(e.currentTarget.result);
					self.loadRomFromBytes(romBytes);
				}
				reader.readAsArrayBuffer(file);
			}

		} else {

			var request = new XMLHttpRequest();
			request.open('GET', '/roms/' + source, true);
			request.responseType = 'arraybuffer';

			request.onload = function (e) {
				var arrayBuffer = request.response;
				if (arrayBuffer != null) {
					let romBytes = new Uint8Array(arrayBuffer);
					self.loadRomFromBytes(romBytes);
				}
			};

			request.send(null);
		}
	}

	this.loadRomFromBytes = function (romBytes) {

		this.isRunning = false;
		this.mmc.loadRomFromBytes(romBytes);
		this.isRunning = true;
	}

	this.mainLoop = function () {

		if (self.isRunning) {
			self.runFrame();	
		}

		requestAnimationFrame(self.mainLoop);
	}

	this.runFrame = function () {

		let startFrameTime = performance.now();

		this.input.update();

		let numberOfScanlines = 262; // FIXME - Load 262 from VDP.
		let numberOfCpuCyclesPerFrame = SMS_CORE_CLOCK_CYCLES_PER_FRAME / 15;
		let numberOfCpuCyclesPerScanline = numberOfCpuCyclesPerFrame / numberOfScanlines;

		for (let i = 0; i < numberOfScanlines; i++) {

			this.cpu.tick(numberOfCpuCyclesPerScanline);
			this.vdp.executeScanline();
		}

		this.vdp.presentFrame();
		this.audio.update();

		let endFrameTime = performance.now();
		let frameDuration = endFrameTime - startFrameTime;
		this.totalFrameDuration += frameDuration;

		this.totalFramesRendered++;
		this.averageFrameDuration = this.totalFrameDuration / this.totalFramesRendered;

		if (frameDuration > 16) {
			this.numberOfFrameRateDrops++;
		}

		let frameDurationOutput = document.getElementById('frameDuration');
		if (frameDurationOutput != null) {
			frameDurationOutput.innerHTML = '' + (Math.round(this.averageFrameDuration * 100, 2) / 100) + 'ms (' + this.numberOfFrameRateDrops + ' drops)';
		}
	}

	this.init();
}