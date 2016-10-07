import Q from 'bluebird';
import _ from 'lodash';
import Signals from 'signals';

import {
	JsonLoader,
	Utils,
	Emitter,
	Constants
} from '../../utils'

import Loader from '../vj-mediasource-loader';
import ControllerBase from './vj-controller-base';

const { ERROR_TYPES } = Constants;
let VIDEO_VO = {
	refIndex: 0,
	currentRefDuration: 0,
	watchedRefs: [],
	timelineTotal: 0,
	refLength: undefined
}

import { VideoLoop, Shuffle } from './extentions'

const EXT_MAP = {
	loop: VideoLoop,
	shuffle: Shuffle
}

import VjUtils from '../vj-utils';

class VideoController extends ControllerBase {

	constructor(options) {
		super(options)
		this._jsonsUrls = this._options.jsonUrls
		this.init()
	}

	init() {
		this._loadJsons(this._jsonsUrls).then(jsons => {
			this._mpds = jsons
			console.log(this._mpds);
			if (this._options.shufflePlaylist) {
				this._mpds.forEach(data => {
					Utils.shuffle(data.sidx.references)
				})
			}
			this._readyCheck.ready = true
			Emitter.emit('user:ready', this)
			this._tryStart()
		})
		this._initListeners()
	}

	_initListeners() {
		this.mediaSources.forEach(ms => {
			ms.endingSignal.add(this._onEndingSignalBound)
			ms.timeUpdateSignal.add(this._onTimeupdateSignalBound)
			ms.videoPlayingSignal.add(this._onVideoPlayingSignalBound)
			ms.videoPausedSignal.add(this._onVideoPausedSignalBound)
		})
	}

	update() {
		if (this.videoCanvas) {
			this.videoCanvas.update()
		}
	}


	/*addVo() {
		return Q.map(this.mediaSources, mediaSource => {
			return this._loadNextSegment(mediaSource)
		}).finally()
	}*/

	_getMediaSourceVo(mediaSource) {

		let _currentVideo = this.currentVideo
		let _videoVo = this.currentVideoVo
		let _references = _currentVideo.sidx.references
		let _ref = _references[_videoVo.refIndex]
		_videoVo.refLength = _references.length

		this._chooseVoRefIndex(_videoVo)

		let _vo = VjUtils.combineRefsIndexs(
			_currentVideo,
			_videoVo,
			this._options);

		return Loader.indexRange(_vo, _vo.indexUrl)
			.then(buffer => {
				_vo.indexBuffer = buffer
				return Loader.range(_vo, _vo.rangeUrl)
					.then(buffer => {
						_vo.videoBuffer = buffer

						//override this method
						this._onIndexAndBufferSuccess(_vo)

						return mediaSource.addVo(_vo)
							.then(mediaSource => {
								this.voAddedSignal.dispatch(mediaSource)
								return mediaSource
							})
							.catch(err => {
								console.log(err);
							})
					})
			})
	}

	/*
	Override this to get a copy of the vo as it its passed
	*/
	_onIndexAndBufferSuccess(vo){
	}

	_chooseVoRefIndex(videoVo) {
		_videoVo.refIndex = (_videoVo.refIndex + 1) > (_references.length - 1) ? 0 : (_videoVo.refIndex + 1)
	}

	nextVideoById(id) {
		this.currentVideoId = id
		return this._loadNextSegment().finally()
	}

	_setNextVideoId() {
		let _c = this.currentVideoIndex
		_c++
		if (_c > this._mpds.length - 1) {
			_c = 0
		}
		this.currentVideoIndex = _c
	}

	_createMpds(jsons) {
		return jsons.map(videoJson => {
			console.log(videoJson);
			let _s = videoJson.split('/')
			let id = _s[_s.length - 1]
			return {
				id: id,
				sidx: videoJson
			}
		})
	}

	_loadJsons(jsons) {
		return JsonLoader.load(jsons)
	}

	_getPlayedVideoVo(videoId) {
		if (!this._playedVideoVos[videoId]) {
			this._playedVideoVos[videoId] = _.clone(VIDEO_VO)
		}
		return this._playedVideoVos[videoId]
	}

	_setRandomVideoIndex() {
		this.currentVideoIndex = Utils.getRandomNumberRange(this._mpds.length - 1)
		return this.currentVideoIndex
	}

	set currentVideoIndex(i) {
		this._currentVideoIndex = i
	}

	get currentVideoIndex() {
		return this._currentVideoIndex || 0
	}

	set currentVideoId(id) {
		this._currentVideoId = id
		this.currentVideoIndex = this._mpds.indexOf(_.find(this._mpds, { id: id }))
	}

	get currentVideo() {
		return this._mpds[this.currentVideoIndex]
	}

	get currentVideoId() {
		return this._mpds[this.currentVideoIndex].id
	}

	get currentVideoVo() {
		return this._getPlayedVideoVo(this.currentVideoId)
	}

	get options() {
		return this._options
	}

	_getRandomVideoId() {
		return this._mpds[Math.floor(Math.random() * this._mpds.length - 1)]
	}

	get voAddedSignal() {
		return this._voAddedSignal
	}
}

export default VideoController;
