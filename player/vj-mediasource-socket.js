import {
	Constants,
} from '../utils'

import BluebirdQueue from '../service/bluebirdQueue'

import Loader from './vj-mediasource-loader';
import Signals from 'signals';
import Q from 'bluebird';
const { ERROR_TYPES, MEDIASOURCE_STATE } = Constants;

let VERBOSE = false;
const LOOP_RESET_MARGIN = 0.3;
const END_OF_BUFFER_DEBOUNCE = 200;
const BUFFER_MARGIN = 4;
const BUFFER_MARGIN_2 = 0.7


class VjMediaSource {
	constructor(options = {}, type = 'video') {
		let _type = type
		let el = document.createElement(_type);
		Object.keys(options.elAttributes).forEach(key => {
			el.setAttribute(key, options.elAttributes[key]);
		})
		el.setAttribute('crossOrigin', 'anonymous');
		el.setAttribute('crossorigin', 'anonymous');
		el.setAttribute('controls', 'true');
		if (!options.paused) {
			el.setAttribute('autoplay', 'true');
		}
		this.options = options;
		this.el = el;
		this._type = type
		if (!MediaSource) {
			throw new Error('NO MEDIASOURCE!');
		}
		//booleans
		this.updatedStarted, this.locked, this.starting = true;

		//playback info
		this.segDuration = 0,
			this.totalDuration = 0,
			this.newVoStarted = false,
			this.requestingNewVo = false,
			this.loopingWhileWaiting = false,
			this.playOffset = 0,
			this.segmentIndex = 0,
			this.totalSegments = 0,
			this.paused = false,
			this.ended = false,
			this.currentCodec = "",
			this.skipCount = 0;
		////-----------------
		//SETUP
		////-----------------
		this._currentVo;
		this.mediaSource;
		this.sourceBuffer;
		this._effects;
		this.currentVideoId;

		this.readySignal = this.options.readySignal
		this.videoPlayingSignal = this.options.videoPlayingSignal
		this.videoPausedSignal = this.options.videoPausedSignal
		this.videoWaitingSignal = this.options.videoWaitingSignal
		this.videoStartedSignal = this.options.videoStartedSignal
		this.videoUpdateStartedSignal = this.options.videoUpdateStartedSignal
		this.videoUpdateEndedSignal = this.options.videoUpdateEndedSignal
		this.segmentAddedSignal = this.options.segmentAddedSignal
		this.timeUpdateSignal = this.options.timeUpdateSignal
		this.endingSignal = this.options.endingSignal
		this.endedSignal = this.options.endedSignal

		this.videoElement = el;

		this.onBufferUpdateStartBound = this.onBufferUpdateStart.bind(this);
		this.onBufferUpdateEndBound = this.onBufferUpdateEnd.bind(this);
		//this.onInitAddedBound = this._onInitAdded.bind(this);
		this.onTimeUpdateBound = this._onTimeUpdate.bind(this);
		this.onSourceOpenBound = this._onSourceOpen.bind(this);
		this.onSourceErrorBound = this._onSourceError.bind(this);

		this.onBufferSourceRemovedBound = this._onBufferSourceRemoved.bind(this);
		this.onBufferErrorBound = this._onBufferError.bind(this);
		this.onBufferSourceEndedBound = this._onBufferSourceEnded.bind(this);
		this.onBufferSourceClosedBound = this._onBufferSourceClosed.bind(this);

		this.videoElement.addEventListener("timeupdate", this.onTimeUpdateBound, false);
		this.videoElement.addEventListener("ended", this._onVideoEnded, false);
		this.videoElement.addEventListener("loadeddata", () => {
			if (VERBOSE) {
				console.log("Loaded data");
			}
		});

		this.videoElement.addEventListener("playing", () => {
			if (VERBOSE) {
				console.log("Playing");
			}
			this._waiting = false
			this.videoPlayingSignal.dispatch(this)
		}, false);

		this.videoElement.addEventListener("waiting", () => {
			if (VERBOSE) {
				console.log("Waiting");
			}
			this._waiting = true
			this.videoWaitingSignal.dispatch(this)
		}, false);
		this.videoElement.addEventListener("pause", () => {
			if (VERBOSE) {
				console.log("Pause");
			}
			this._waiting = true
			this.videoPausedSignal.dispatch(this)
		}, false);

		this.videoElement.addEventListener("loadstart", () => {
			if (VERBOSE) {
				console.log("loadstart");
			}
			this._waiting = false
				//this.videoPlayingSignal.dispatch()
		}, false);

		this.videoElement.addEventListener("suspend", () => {
			if (VERBOSE) {
				console.log("suspend");
			}
			this._waiting = true
		}, false);

		this._newMediaSource().then(() => {
			this.state = MEDIASOURCE_STATE.IDLE
			this.readySignal.dispatch(this);
			this.options.emitter.emit('mediasource:ready', this)
		});

		this.state = MEDIASOURCE_STATE.BUSY
		this._voQueue = new BluebirdQueue({ delay: 2000, concurrency: 1 })
		this._voQueue.start()

		this._debouncedEndOfBuffer = _.debounce(this._onEndOfBuffer.bind(this), END_OF_BUFFER_DEBOUNCE);
	}

	_newMediaSource() {
		return new Q((resolve, reject) => {
			let _self = this
			this.state = MEDIASOURCE_STATE.BUSY
			this.starting = true;
			this.mediaSource = new MediaSource();
			let url = URL.createObjectURL(this.mediaSource);
			this.videoElement.src = url;
			this.mediaSource.addEventListener('error', this.onSourceErrorBound, false);
			this.mediaSource.addEventListener('sourceopen', function() {
				try {
					_self.mediaSource.removeEventListener('sourceopen', arguments[0].callee);
					_self.starting = false;
					this.state = MEDIASOURCE_STATE.IDLE
					resolve()
				} catch (e) {
					_self._onError(new Error(e.toString()), reject)
				}
			}, false);
		})
	}

	_newBufferSouce(codecs) {
		return new Q((resolve, reject) => {
			this._removeSourceBuffer()
				.then(() => {
					this.mediaSource.removeEventListener('sourceopen', this.onSourceOpenBound);
					this.currentCodec = codecs || this.currentCodec;
					/*this.mediaSource.addEventListener('addsourcebuffer', () => {
						console.log("Mediasource");
					})*/
					try {
						this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="' + this.currentCodec + '"');
						this.sourceBuffer.addEventListener('updatestart', this.onBufferUpdateStartBound, false)
						this.sourceBuffer.addEventListener('updateend', this.onBufferUpdateEndBound, false)
						this.sourceBuffer.addEventListener('error', this.onBufferErrorBound, false)
						this.sourceBuffer.addEventListener('sourceclose', this.onBufferSourceCloseBound, false)
						this.sourceBuffer.addEventListener('sourceended', this.onBufferSourceEndedBound, false)
					} catch (e) {
						this._onError(new Error(e.toString()), reject)
					}
					resolve()
				})
		})
	}

	_onSourceError(e) {}

	_onSourceOpen(e) {

	}

	////-----------------
	//VIDEO HANDLERS
	////-----------------

	pause() {
		this.videoElement.pause();
	}

	play() {
		this.videoElement.play();
	}

	_onVideoEnded(e) {
		if (VERBOSE) {
			console.warn('Video Ended');
		}
	}

	_onTimeUpdate() {
		let ct = this.videoElement.currentTime;
		if (ct > this.currentVo.startTime && !this.newVoStarted) {
			this.newVoStarted = true;
			this.videoStartedSignal.dispatch(this);
			this.options.emitter.emit('mediasource:videostarting', this)
		}
		//console.log(ct, this.totalDuration);
		if (ct >= (this.totalDuration - this.options.timeBeforeRequestingNewClip)) {
			if (!this.requestingNewVo) {
				this.requestingNewVo = true;
				if (VERBOSE) {
					console.log(this.currentVo.videoId, "Requesting new vo");
				}
				this.endingSignal.dispatch(this);
				this.options.emitter.emit('mediasource:ending', this)
			}
		}
		if (ct >= this.totalDuration - LOOP_RESET_MARGIN) {
			this.loopingWhileWaiting = true
			if (!this.ended) {
				this.ended = true;
				this._debouncedEndOfBuffer()
			}
		}
		this.timeUpdateSignal.dispatch(this)
	}

	_onEndOfBuffer() {
		this.endedSignal.dispatch(this);
		this.options.emitter.emit('mediasource:ended', this)
		this.ended = false;
	}

	get el() {
		return this.videoElement
	}

	set el(e) {
		this.videoElement = e
	}

	get isPaused() {
		return !this.videoElement.playing
	}

	set currentTime(t) {
		this.videoElement.currentTime = t
	}

	get waiting() {
		return this._waiting
	}

	get type() {
		return this._type
	}

	get currentTime() {
		return this.videoElement.currentTime
	}

	////-----------------
	//API
	////-----------------

	stepBack(amount = 0) {
		let _target = Math.max(this.videoElement.currentTime - amount, this.sourceBufferStart)
		this.videoElement.currentTime = _target
	}

	stepForward(amount = 0) {
		let _target = this.videoElement.currentTime + amount
		if (_target > this.sourceBufferEnd - 1) {
			_target = this.sourceBufferEnd - BUFFER_MARGIN
		}
		this.videoElement.currentTime = _target
	}

	setPlaybackRate(rate) {
		this.videoElement.playbackRate = rate;
	}

	getReadyState() {
		return this.mediaSource.readyState;
	}

	setCurrentVideoId(id) {
		this.currentVideoId = id;
	}

	getCurrentVideoId(id) {
		return this.currentVideoId;
	}

	addVo(currentVo) {
		this._activePromiseChain = new Q((resolve, reject) => {
			if (this._addingSegment) {
				//this._onError(new Error(`Vo being added`), reject)
			}
			this._addingSegment = true

			if (VERBOSE) {
				console.log("CurrentCodec: ", this.currentCodec, "new codec:", currentVo.codecs);
			}

			this._currentVo = currentVo
			if (!this.mediaSource) {
				return this._newMediaSource()
					.then(() => {
						return this._newBufferSouce()
							.then(() => {
								console.log('Created new buffer source!');
								resolve(this._readyToAdd(currentVo))
							})
					})
				this.options.emitter.emit('audio:warn', `The codecs arnt equal`);
			} else {
				if (this.sourceBuffer) {
					if (VERBOSE) {
						this.options.emitter.emit('audio:log', `Sourcebuffer updating: ${this.sourceBuffer.updating}`);
						this.options.emitter.emit('audio:log', `Sourcebuffer mode: ${this.sourceBuffer.mode}`);
					}
					resolve(this._readyToAdd(currentVo));
				} else {
					return this._newBufferSouce(currentVo.codecs)
						.then(() => {
							resolve(this._readyToAdd(currentVo))
						});
					this.options.emitter.emit('audio:warn', `The codecs arnt equal`);
				}
			}
		})
		return this._activePromiseChain
	}

	_readyToAdd(currentVo) {
		this.state = MEDIASOURCE_STATE.BUSY
		this.setCurrentVideoId(currentVo.id);
		if (VERBOSE) {
			console.log("-------------------------------------------------");
			console.log(this._type, this.totalDuration, currentVo.duration);
			console.log("-------------------------------------------------");
		}
		this.mediaSource.duration = this.totalDuration;
		let _readyToAddPromise = this._addSegment(currentVo);
		this._voQueue.add(_readyToAddPromise)
		return _readyToAddPromise
	}

	_onBufferSourceRemoved() {

	}

	get sourceBufferedTimes() {
		if (this.sourceBuffer) {
			return this.sourceBuffer.buffered
		}
		return null
	}

	get sourceBufferStart() {
		if (this.sourceBuffer) {
			return this.sourceBuffer.buffered.start(0)
		}
		return 0
	}

	get sourceBufferEnd() {
		if (this.sourceBuffer) {
			return this.sourceBuffer.buffered.end(0)
		}
		return 0
	}


	////-----------------
	//BUFFER HANDLERS
	////-----------------


	onBufferUpdateStart() {
		this.updatedStarted = true;
		this.requestingNewVo = false;
		this.ended = false;
		this.state = MEDIASOURCE_STATE.BUSY
		this.videoUpdateStartedSignal.dispatch(this)
	}

	onBufferUpdateEnd() {
		this.updatedStarted = false;
		this.state = MEDIASOURCE_STATE.IDLE
		this.videoUpdateEndedSignal.dispatch(this)
		//this._updatedEndPromise.resolve()
		if (VERBOSE) {
			this.options.emitter.emit('audio:log', `Sourcebuffer updated. Is updating: ${this.sourceBuffer.updating}`);
		}
	}

	_onBufferSourceEnded(e) {
		console.log('_onBufferSourceEnded');
	}

	_onBufferError(e) {
		console.log('_onBufferErrorBound');
		console.log(e);
		this.resetMediasource()
			.then(() => {
				this._activePromiseChain._reject()
					//Q.resolve()
					//this._activePromiseChain.resolve(this)
					//console.log(this._activePromiseChain);
					//return this._readyToAdd(this.currentVo)
			}).finally();
	}

	_onBufferSourceClosed(e) {
		console.log('_onBufferSourceClosed');
	}

	_addSegment(currentVo) {
		if (!this.sourceBuffer) {
			return Q.reject('No sourcebuffer')
		}
		this.newVoStarted = false;
		this.currentVo = currentVo;
		this.currentVo.startTime = this.totalDuration;
		this.totalDuration += this.currentVo.duration;

		let off = 0,
			videoId = this.currentVo.videoId;
		if (this.sourceBuffer.buffered.length > 0) {
			off = this.sourceBuffer.buffered.end(this.sourceBuffer.buffered.length - 1);
		}
		return this._trySettingOffset(this.currentVo, off)
			.then(() => {
				return this._addInitReponse(this.currentVo, this.currentVo.indexBuffer)
					.then(() => {
						off = this.sourceBuffer.timestampOffset - this.currentVo['timestampOffset'];
						return this._trySettingOffset(this.currentVo, off)
							.then(() => {
								return this._addResponse(this.currentVo, this.currentVo.videoBuffer)
									.then(() => {
										this._addingSegment = false
										console.log("response added");
										this._saveCurrentTimeToVo(currentVo)
											//snap it back
										if (this.shouldSnapToVoTime) {
											this._setCurrentTimeToVoStartTime(currentVo)
										}
										this.loopingWhileWaiting = false

										//not sure what this is

										//onBufferUpdateEnd

										/*this._updatedEndPromise = new Q((yes, no) => {
										})
										return this._updatedEndPromise*/

										return this
									})
									.catch(err => {
										return err
									})
							})
					})
			})
	}

	get shouldSnapToVoTime() {
		if (this.loopingWhileWaiting) {
			return true
		}
		if (this.currentTime <
			this.sourceBufferEnd - this.currentVo.duration - BUFFER_MARGIN
		) {
			return true
		}
		return false
	}

	_saveCurrentTimeToVo(vo) {
		vo.currentStartTime = this.currentTime
	}

	/*
	to snap it back
	*/
	_setCurrentTimeToVoStartTime(vo) {
		let _dur = vo.duration
		let _end = Math.min(this.totalDuration, this.sourceBufferEnd)
		let _t = _end - _dur
		this.currentTime = _t
	}

	_trySettingOffset(vo, off) {
		return new Q((resolve, reject) => {
			let _i, _self = this

			function _poll() {
				if (!_self.sourceBuffer.updating) {
					clearInterval(_i)
					_self.options.emitter.emit('audio:log', `Sourcebuffer mode: ${_self.sourceBuffer.mode}`);
					try {
						_self.sourceBuffer.timestampOffset = off || 0;
						if (VERBOSE) {
							console.log(`timestampOffset is: ${off}`);
						}
						resolve()
					} catch (e) {
						if (VERBOSE) {
							console.error(`Error _trySettingOffset of: ${off}... ${e.toString()}`);
						}
						_self._onError(new Error(`Failed setting timeoffset`), reject)
					}
				} else {
					if (VERBOSE) {
						console.log(`source buffer updating...`);
					}
				}
			}
			_i = this._getInterval(_poll)
		})
	}

	_addInitReponse(vo, initResp) {
		return new Q((resolve, reject) => {
			let _self = this

			function _onInitAdded() {
				try {
					_self.sourceBuffer.removeEventListener('updateend', _onInitAdded);
					resolve()
				} catch (e) {
					_self._onError(new Error(e.toString()), reject)
				}
				if (VERBOSE) {
					console.log("Init response added: ", vo.videoId || vo.id);
				}
			}

			function _tryAppend() {
				try {
					_self.sourceBuffer.appendBuffer(initResp);
				} catch (e) {
					_self._onError(new Error(e.toString()), reject)
				}
			}

			if (this._canUpdate() && this.sourceBuffer) {
				this.sourceBuffer.removeEventListener('updatestart', this.onBufferUpdateStartBound);
				this.sourceBuffer.removeEventListener('updateend', this.onBufferUpdateEndBound);
				this.sourceBuffer.addEventListener('updateend', _onInitAdded);
				_tryAppend()
			} else {
				console.error(`Cannot update init!`);
			}
		})
	}

	_addResponse(vo, resp) {
		return new Q((resolve, reject) => {
			let _self = this

			if (VERBOSE) {
				console.log(`Got video response. Soundbuffer updating: ${this.sourceBuffer.updating}`);
			}

			function _onResponseAdded() {
				try {
					if (_self.sourceBuffer) {
						if (VERBOSE) {
						console.log("Added segment: ", vo.id, "Total duration:", _self.totalDuration);
					}
						_self.sourceBuffer.removeEventListener('updateend', _onResponseAdded);
						_self.onBufferUpdateEndBound()
						resolve()
					} else {
						_self._onError(new Error(`no source buffer on _onResponseAdded ${vo.videoId || vo.id}`), reject)
					}
				} catch (e) {
					_self._onError(new Error(e.toString()), reject)
				}
			}


			if (this._canUpdate() && this.sourceBuffer) {
				this.sourceBuffer.addEventListener('updateend', _onResponseAdded);
				//this.sourceBuffer.addEventListener('updateend', this.onBufferUpdateEndBound);
				this.sourceBuffer.addEventListener('updatestart', this.onBufferUpdateStartBound);
				try {
					this.sourceBuffer.appendBuffer(resp);
					if (vo.seekValue) {
						let _t = this.videoElement.currentTime + vo.seekValue
						this.videoElement.currentTime = _t
					}
					this.segmentAddedSignal.dispatch(this)
				} catch (e) {
					if (VERBOSE) {
						/*
				DOMException: Failed to execute 'appendBuffer' on 'SourceBuffer': The HTMLMediaElement.error attribute is not null.(…)
						*/
						console.log(e.name);
						console.log(e);
					}
					_self._onError(new Error(e.toString()), reject)
				}
			} else {
				_self._onError(new Error('Cannot update video'), reject)
			}
		})
	}

	_getInterval(func, dur = 100) {
		return setInterval(func, 100)
	}

	//crash

	_canUpdate() {
		return this.mediaSource.readyState === 'open' && !this.sourceBuffer.updating;
	}

	_onError(err, reject) {
		this.requestingNewVo = false;
		this._addingSegment = false;
		this.starting = false;
		err.name = ERROR_TYPES.MEDIASOURCE
		this.state = MEDIASOURCE_STATE.IDLE
		reject(err)
	}

	_removeSourceBuffer() {
		return new Q((resolve, reject) => {
			if (this.sourceBuffer) {
				this.sourceBuffer.removeEventListener('updateend', this.onBufferUpdateEndBound);
				this.sourceBuffer.removeEventListener('updatestart', this.onBufferUpdateStartBound);
				this.sourceBuffer.removeEventListener('error', this.onBufferErrorBound)
				this.sourceBuffer.removeEventListener('sourceclose', this.onBufferSourceCloseBound)
				this.sourceBuffer.removeEventListener('sourceended', this.onBufferSourceEndedBound)
				try {
					this.sourceBuffer.remove(0, this.mediaSource.duration);
				} catch (e) {

				}
				this.mediaSource.removeSourceBuffer(this.mediaSource.sourceBuffers[0]);
				this.sourceBuffer = null
				resolve()
			} else {
				resolve()
			}
		})
	}

	resetMediasource() {
		if (this.starting || !this.mediaSource) {
			return;
		}
		if (VERBOSE) {
			console.warn('Reset buffer source');
		}
		this.state = MEDIASOURCE_STATE.BUSY
		return this._removeSourceBuffer()
			.then(() => {
				this.mediaSource.removeEventListener('error', this.onSourceErrorBound);
				this.mediaSource.removeEventListener('sourceopen', this.onSourceOpenBound);
				this.mediaSource = null;
				this.sourceBuffer = null;
				this.requestingNewVo = false;
				this._addingSegment = false;
				this.enterFrameCounter = 0;
				this.starting = false;
				this.videoElement.currentTime = 0;
				this.totalDuration = this.segDuration = this.playOffset = 0;
				this.state = MEDIASOURCE_STATE.IDLE
				if (VERBOSE) {
					console.warn(`removed media success`);
				}
			});
	}
}

export default VjMediaSource;
