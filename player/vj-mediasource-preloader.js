import Signals from 'signals';
import Q from 'bluebird';

class VjMediaSourcePreloader {
    constructor() {
        this._preloading = false;
    }


    preload(vo) {
        if (this._preloading) {
            return;
        }
        this._preloading = true


		let formData = new FormData();
		formData.append('url', this.currentVo.url);
		formData.append('byteRange', this.currentVo.byteRange);
		formData.append('byteLength', this.currentVo.byteLength);

		let xhr = new XMLHttpRequest();
		xhr.open('POST', process.env.SERVER_BASE + 'getVideo', true);
		xhr.responseType = 'arraybuffer';
		xhr.send(formData);
		xhr.addEventListener("readystatechange", () => {
			if (xhr.readyState == xhr.DONE) {
				this.segResp = new Uint8Array(xhr.response);
				let off = 0;
				if (this.sourceBuffer.buffered.length > 0) {
					off = this.sourceBuffer.buffered.end(this.sourceBuffer.buffered.length - 1);
				}
				this._trySettingOffset(off);
			}
		});
	}

	_trySettingOffset(off) {
		try {
			this.sourceBuffer.timestampOffset = off || 0;
			this._makeInitialRequest(this.currentVo);
		} catch (e) {
			if (VERBOSE) {
				console.log("Error _trySettingOffset");
			}
			this._resetMediasource();
		}
	}

	_makeInitialRequest() {
		let xhr = new XMLHttpRequest();
		let formData = new FormData();
		formData.append('url', this.currentVo.url);
		formData.append('indexRange', this.currentVo.indexRange);
		formData.append('indexLength', this.currentVo.indexLength);
		xhr.open('POST', process.env.SERVER_BASE + 'getVideoIndex', true);
		xhr.send(formData);
		xhr.responseType = 'arraybuffer';
		try {
			xhr.addEventListener("readystatechange", () => {
				if (xhr.readyState == xhr.DONE) { // wait for video to load
					console.log("Addit init");
					this._addInitReponse(new Uint8Array(xhr.response));
				}
			}, false);
		} catch (e) {
			log(e);
		}
	}

	_addInitReponse(initResp) {
		if (this.mediaSource.readyState === 'open' && this.sourceBuffer) {
			this.sourceBuffer.removeEventListener('updatestart', this.onBufferUpdateStartBound);
			this.sourceBuffer.removeEventListener('updateend', this.onBufferUpdateEndBound);
			this.sourceBuffer.addEventListener('updateend', this.onInitAddedBound);
			try {
				if (VERBOSE) {
					console.log("Init response added: ", this.currentVideoId);
				}
				this.sourceBuffer.appendBuffer(initResp);
			} catch (e) {
				if (VERBOSE) {
					console.log(e);
				}
				this._resetMediasource();
			}
		}
	}

	_onInitAdded() {
		if (this.mediaSource.readyState === 'open' && this.sourceBuffer) {
			this.sourceBuffer.removeEventListener('updateend', this.onInitAddedBound);
			this.sourceBuffer.addEventListener('updateend', this.onBufferUpdateEndBound);
			this.sourceBuffer.addEventListener('updatestart', this.onBufferUpdateStartBound);
			let off = this.sourceBuffer.timestampOffset - this.currentVo['timestampOffset'];
			try {
				this.sourceBuffer.timestampOffset = off;
			} catch (e) {
				this._resetMediasource();
			}
			//this.sourceBuffer.timestampOffset = this.sourceBuffer.timestampOffset - currentVo['timestampOffset'];
			try {
				if (VERBOSE) {
					console.log("Added segment: ", this.currentVideoId, "Total duration:", this.totalDuration);
				}
				this.sourceBuffer.appendBuffer(this.segResp);
			} catch (e) {
				if (VERBOSE) {
					console.log(e);
				}
				this._resetMediasource();
			}
		}
	}

}

export default VjMediaSourcePreloader
