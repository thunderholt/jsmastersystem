function Audio() {

	this.audioContext = null;
	this.toneChannels = [];
	this.masterVolumeMultiplier = 0.1;
	this.latchedChannelIndex = 0;
	this.latchType = AUDIO_LATCHTYPE_TONENOISE;

	this.init = function () {

		this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

		for (let i = 0; i < 3; i++) {

			let toneChannel = {
				volume: 1,
				tone: 0,
				gainNode: this.audioContext.createGain(),
				oscillatorNode: this.audioContext.createOscillator()
			}

			toneChannel.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
			toneChannel.gainNode.connect(this.audioContext.destination);

			toneChannel.oscillatorNode.type = 'square';
			toneChannel.oscillatorNode.frequency.setValueAtTime(0, this.audioContext.currentTime);
			toneChannel.oscillatorNode.connect(toneChannel.gainNode);
			toneChannel.oscillatorNode.start();

			this.toneChannels.push(toneChannel);
		}

		this.reset();
	}

	this.reset = function () {

		for (let i = 0; i < 3; i++) {

			let toneChannel = this.toneChannels[i];
			toneChannel.volume = 1;
			toneChannel.tone = 0;
			toneChannel.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
			toneChannel.oscillatorNode.frequency.setValueAtTime(0, this.audioContext.currentTime);
		}
	}

	this.writeByteToPort = function (byte) {

		if (byte & BIT7) {

			// This is a latch/data byte.
			this.latchedChannelIndex = (byte & 0x60) >> 5;

			if (byte & BIT4) {
				this.latchType = AUDIO_LATCHTYPE_VOLUME;
			} else {
				this.latchType = AUDIO_LATCHTYPE_TONENOISE;
			}

			let data = byte & 0x0f;

			if (this.latchedChannelIndex < 3) {
				let toneChannel = this.toneChannels[this.latchedChannelIndex];
				if (this.latchType == AUDIO_LATCHTYPE_VOLUME) {
					toneChannel.volume = (toneChannel.volume & 0xf0) | data;
				} else {
					toneChannel.tone = (toneChannel.tone & 0xf0) | data;
				}
			}

		} else {

			// This is a data byte.
			if (this.latchedChannelIndex < 3) {
				let toneChannel = this.toneChannels[this.latchedChannelIndex];
				if (this.latchType == AUDIO_LATCHTYPE_VOLUME) {
					toneChannel.volume = (toneChannel.volume & 0xf0) | (byte & 0x0f);
				} else {
					toneChannel.tone = (toneChannel.tone & 0x0f) | ((byte & 0x3f) << 4);
				}
			}
		}
	}

	this.update = function () {

		for (let i = 0; i < 3; i++) {

			let toneChannel = this.toneChannels[i];

			let gain = ((0x0f - toneChannel.volume) / 0x0f) * this.masterVolumeMultiplier;
			let frequency = toneChannel.tone > 0 ? 3579545 / (2 * toneChannel.tone * 16) : 0;

			if (gain > 1) {
				throw 'Bad gain';
			}

			toneChannel.gainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
			toneChannel.oscillatorNode.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
		}
	}
}