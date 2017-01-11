import Q from 'bluebird';
import Signals from 'signals';

import {
	Utils,
	Constants
} from '../../utils'

const { ERROR_TYPES, BEHAVIORS } = Constants;


import ServerService from '../../service/serverService';

import { VideoLoop, Shuffle, MusicVideo, Preload } from './extentions'

const EXT_MAP = {
	loop: VideoLoop,
	shuffle: Shuffle,
	musicVideo: MusicVideo,
	preload: Preload
}

let VIDEO_VO = {
	refIndex: 0,
	currentRefDuration: 0,
	watchedRefs: [],
	timelineTotal: 0,
	refLength: undefined
}
let TIMELINE_VO = {}

class ControllerBase {

	constructor(socket, options = {}) {
		let { emitter } = options
		this._options = options
		this.mediaSources = []
		this._readyCheck = {
			ready: false
		}
		this._ServerService = ServerService
		this._SocketService = socket
		this._addVoSignal = new Signals()
		this._voAddedSignal = new Signals()
		this.behaviorSignal = new Signals()
		this._onBehaviorBound = this._onBehavior.bind(this)

		this._emitVoBound = this._onMediaSourceReady.bind(this)
		this._nextVideoBound = this._nextVideo.bind(this)
		this._previousVideoBound = this._previousVideo.bind(this)
		this._nextSegmentBound = this._nextSegment.bind(this)
		this._previousSegmentBound = this._previousSegment.bind(this)
		this._onEndingSignalBound = this._onEndingSignal.bind(this)
		this._onVideoUpdateStartedSignalBound = this._onVideoUpdateStartedSignal.bind(this)
		this._onVideoUpdateEndedSignalBound = this._onVideoUpdateEndedSignal.bind(this)
		this._onEndedSignalBound = this._onEndedSignal.bind(this)
		this._onTimeupdateSignalBound = this._onTimeupdateSignal.bind(this)
		this._onVideoPlayingSignalBound = this._onVideoPlayingSignal.bind(this)
		this._onVideoPausedSignalBound = this._onVideoPausedSignal.bind(this)
		this._onVideoWaitingSignalBound = this._onVideoWaitingSignal.bind(this)

		this._extensions = new Map()
		this._playedVideoVos = new Map()

		this._ServerService.setServerBase(this._options.serverBase)

		emitter.on(`${options.id}:controller:video:previous:video`, this._previousVideoBound)
		emitter.on(`${options.id}:controller:video:next:video`, this._nextVideoBound)
		emitter.on(`${options.id}:controller:video:previous:segment`, this._previousSegmentBound)
		emitter.on(`${options.id}:controller:video:next:segment`, this._nextSegmentBound)

		this._createExtensions(options)
		this._tryStart()
	}

	//************
	//INIT
	//************

	init() {
		this._initListeners()
	}

	update() {
		if (this.videoCanvas) {
			this.videoCanvas.update()
		}
	}

	_tryStart() {
		let _r = _.every(_.values(this._readyCheck), Boolean);
		if (_r) {
			if (!this._options.paused && !this._options.noAutoStart) {
				return this.addVo()
			}
		}
	}

	_initListeners() {
		this.mediaSources.forEach(ms => {
			ms.readySignal.addOnce(this._emitVoBound)
			ms.endingSignal.add(this._onEndingSignalBound)
			ms.videoUpdateStartedSignal.add(this._onVideoUpdateStartedSignalBound)
			ms.videoUpdateEndedSignal.add(this._onVideoUpdateEndedSignalBound)
			ms.endedSignal.add(this._onEndedSignalBound)
			ms.timeUpdateSignal.add(this._onTimeupdateSignalBound)
			ms.videoPlayingSignal.add(this._onVideoPlayingSignalBound)
			ms.videoPausedSignal.add(this._onVideoPausedSignalBound)
			ms.videoWaitingSignal.add(this._onVideoWaitingSignalBound)

			this._addMediaSourceToExtensions(ms)
		})
	}

	_createExtensions(options) {
		let extensions = options.extensions || []
		extensions.map(id => {
			this._extensions.set(id, new EXT_MAP[id](this, options))
		})
	}

	_addMediaSourceToExtensions(mediaSource) {
		for (let [id, ext] of this._extensions) {
			ext.addMediaSource(mediaSource)
		}
	}

	addVo() {
			//in base
			let _isPaused = this._checkIfPaused()

			if(_isPaused){
				return Q.resolve()
			}

			return Q.map(this.mediaSources, mediaSource => {
				return this._getMediaSourceVo(mediaSource)
			}, { concurrency: 1 })
		}
		//*****************
		//OVERRIDES
		//*****************
		/*
		Override this
		*/
	_getMediaSourceVo(mediaSource) {

	}

	_onBehavior(type) {
		switch (type) {
			case BEHAVIORS.VIDEO_PASSED_DURATION:
				break;
		}
	}

	_onVideoUpdateStartedSignal(mediaSource) {

	}

	_onVideoUpdateEndedSignal(mediaSource) {

	}

	//************
	//INIT
	//************
	get socket() {
		return this._SocketService.socket
	}

	get addVoSignal() {
		return this._addVoSignal
	}

	get voAddedSignal() {
		return this._voAddedSignal
	}

	get options() {
		return this._options
	}

	get emitter() {
		return this._options.emitter
	}

	//*******
	//PLAYER
	//*******

	nextVideo() {
		this._nextVideo()
	}

	_nextVideo() {
		this._setNextVideoId()
		this._loadNextSegmentAndSkip()
	}

	_previousVideo() {
		this._setPreviousVideoId()
		this._loadNextSegmentAndSkip()
	}

	_nextSegment() {
		let _videoVo = this.currentVideoVo
		this._nextVideoVoSegment(_videoVo)
	}

	_previousSegment() {
		let _videoVo = this.currentVideoVo
		this._previousVideoVoSegment(_videoVo)
	}


	_loadNextSegmentAndSkip() {
	/*	this.addVo()
		.then(mediasources => {
				mediasources[0].stepForward(mediasources[0].currentVo.startTime)
			}).finally()*/
			/*this._loadNextSegment()
				.then((addedResult = {}) => {
					this._mediaSource.stepForward(addedResult.duration)
				}).finally()*/
	}

	_nextVideoVoSegment(videoVo) {
		let _s = videoVo.segIndex++
			_s = (_s > videoVo.refLength - 1) ? 0 : _s
		this._loadNextSegmentAndSkip()
	}

	_previousVideoVoSegment(videoVo) {
		//it moved
		let _s = videoVo.segIndex -= 2
		_s = (_s < 0) ? videoVo.refLength - 1 : _s
		this._loadNextSegmentAndSkip()
	}

	_isMediaSourceMaster(ms) {
		return (this.mediaSources.indexOf(ms) === 0)
	}

	_setPlayedVideoVo(uuid, videoVo) {
		this._playedVideoVos.set(uuid, videoVo)
	}

	_getPlayedVideoVo(uuid) {
		return this._playedVideoVos.get(uuid)
	}

	//**************
	//SIGNALS
	//**************

	_onEndingSignal(mediaSource) {
		console.log('ending');
		if (this._isMediaSourceMaster(mediaSource)) {
			this.addVo().finally()
		}
		//this._checkVideoPlaybackPostion(mediaSource)
		//this._loadNextSegment(mediaSource).finally()
	}

	_onEndedSignal(mediaSource) {
		/*if (this._isMediaSourceMaster(mediaSource)) {
			this.addVo().finally()
		}*/
	}

	/*
	Sync
	*/
	_onTimeupdateSignal(mediaSource) {
		//video, or aidio if just audio
		return
		if (this.mediaSources.indexOf(mediaSource) === 0) {
			let _ms = this.mediaSources[1]
			if (_ms) {
				let _diff = Math.abs(_ms.currentTime - mediaSource.currentTime)
				if (_diff > 1) {
					_ms.currentTime = mediaSource.currentTime
				}
			}
		}
		/*let _l = this.mediaSources.length
		if (_l > 1) {
			let _i = this.mediaSources.indexOf(mediaSource)
			let _other = (_i + 1)
			_other = (_other >= _l) ? 0 : _other;
			let _ms = this.mediaSources[_other]
				//sync 1 sec off
			let _diff = Math.abs(_ms.currentTime - mediaSource.currentTime)
			if (_diff > 1) {
				let _t = Math.min(_ms.currentTime, mediaSource.currentTime)
				_ms.currentTime = _t
				mediaSource.currentTime = _t
			}
		}*/
	}

	_onVideoPlayingSignal(mediaSource) {
		/*let _ms = this._getOtherMediaSource(mediaSource)
		if (mediaSource !== _ms) {
			_ms.play()
		}*/
	}

	_onVideoPausedSignal(mediaSource) {
		/*let _ms = this._getOtherMediaSource(mediaSource)
		if (mediaSource !== _ms) {
			_ms.pause()
		}*/
	}

	_onVideoWaitingSignal(mediaSource) {
		let _ms = this._getOtherMediaSource(mediaSource)
		if (mediaSource !== _ms) {
			_ms.pause()
		}
	}

	_getOtherMediaSource(mediaSource) {
		let _i = this.mediaSources.indexOf(mediaSource)
		let _other = (_i + 1)
		_other = (_other >= this.mediaSources.length) ? 0 : _other;
		return this.mediaSources[_other]
	}

	nextVideoById(id) {
		this.currentVideoId = id
		return this._loadNextSegment()
			//this._loadNextSegmentAndSkip()
	}

	_onMediaSourceReady(mediaSource) {

	}


	//*********************
	//API
	/*
	Maybe override this in other controller
	*/
	//*********************

	unshiftNewVideo(value) {

	}

	pause() {
		this._isPaused = true
	}

	seek(val) {
		console.log(val);
	}

	resume() {
		this._isPaused = false
	}

	_checkIfPaused(ms) {
		return this._isPaused
	}
}

export default ControllerBase;
