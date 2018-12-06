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
	//this.totalCyclesExecuted = 0;
	this.totalFramesRendered = 0;
	this.averageFrameDuration = 0;
	this.totalFrameDuration = 0;
	this.numberOfFrameRateDrops = 0;
	this.canvas = null;
	this.canvasContext = null;

	this.init = function () {

		this.canvas = document.getElementById('sms-canvas');
		this.canvasContext = this.canvas.getContext('2d');

		this.cpu.setMmc(this.mmc);
		this.cpu.setIoc(this.ioc);

		this.vdp.setCanvasContext(this.canvasContext);
		this.vdp.setCpu(this.cpu);

		this.ioc.setVdp(this.vdp);
		this.ioc.setInput(this.input);
		this.ioc.setAudio(this.audio);

		this.vdp.init();
		this.input.init();

		this.mainLoop();
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

	this.loadRom = function () {

		this.isRunning = false;
		this.cpu.reset();
		this.vdp.reset();
		this.mmc.reset();
		this.audio.reset();
		this.input.reset();

		var romFileInput = document.getElementById('romFileInput');

		if (romFileInput.files.length > 0) {
			let file = romFileInput.files[0];

			let reader = new FileReader();	
			reader.onload = function (e) {
				self.loadRomFromBytes(e.currentTarget.result);
			}
			reader.readAsArrayBuffer(file);
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

		this.cpu.startFrame();
		this.vdp.startFrame();

		for (let i = 0; i < SMS_CORE_CLOCK_CYCLES_PER_FRAME / 5; i++) {

			if (i % 3 == 0) {
				this.cpu.tick();
			}

			this.vdp.tick();

			/*if (i % 15 == 0) {
				this.cpu.tick();
			}

			if (i % 5 == 0) {
				this.vdp.tick();
			}*/

			//this.totalCyclesExecuted++;
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

		document.getElementById('frameDuration').innerHTML = '' + (Math.round(this.averageFrameDuration * 100, 2) / 100) + 'ms (' + this.numberOfFrameRateDrops + ' drops)';
	}

	this.init();
}