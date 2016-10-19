import Q from 'bluebird';
import _ from 'lodash';


import ControllerBase from './vj-controller-base';
import VideoVoUtils from './vj-controller-youtube-videovo-utils';
import UserEvents from './vj-controller-user-events';
import YoutubeVideoSocket from './vj-controller-youtube-video-socket';
import YoutubeVideoApi from './vj-controller-youtube-api';
import VideoPlaylist from './vj-controller-youtube-video-playlist';

import {
	Utils,
	Constants,
	Cache
} from '../../utils'

const { ERROR_TYPES, CONTROLLER_STATE } = Constants;

let TIMELINE_VO = {}

const VERBOSE = true

import VjUtils from '../vj-utils';

class VideoController extends ControllerBase {

	constructor(socketService, options) {
		super(socketService, options)
			//this.mediaSource = mediaSource
		this._options = options
		this._playlists = this._options.playlists


		this._videoVoUtils = new VideoVoUtils(this)
		this._userEvents = new UserEvents(this)
		this._videoSocket = new YoutubeVideoSocket(this)
		this._videoApi = new YoutubeVideoApi(this)
		this._videoPlaylist = new VideoPlaylist(this)

		this.state = CONTROLLER_STATE.IDLE
	}

	init() {
		super.init()
		this._getPlaylistVideoIds()
			.then(() => {
				this._readyCheck.ready = true
				return this._tryStart()
			})
			.catch(err => {
				console.log(err);
			})
	}

	_getSidxQualityOptions(quality) {
		return {
			resolution: quality.resolution
		}
	}

	_getMediaSourceVo(mediaSource) {

		let _uuid = this._getUUID(mediaSource.type, this.currentVideoId)
		let _videoVo = this._videoVoUtils.getVideoVo(_uuid)

		this.state = CONTROLLER_STATE.BUSY
		console.log(`_getMediaSourceVo ${this.currentVideoId} at ${_videoVo.currentRefIndexs.toString()}`);

		if (_videoVo.preloadPromise) {

			if (!_videoVo.preloadPromise.isFulfilled()) {
				return _videoVo.preloadPromise
					.then(mediaSourceVo => {
						//was deleted
						if (!_videoVo.preloadPromise) {

						} else {
							delete _videoVo.preloadPromise
							return this._doRangeRequestAndAdd(mediaSource, mediaSourceVo, _videoVo)
						}
					})
			}
			let manifest = Cache.getSidxManifest(_videoVo.uuid)
			let _mediaSourceVo = this._createMediaSourceVo(manifest, _videoVo, this._options)
			return this._doRangeRequestAndAdd(mediaSource, _mediaSourceVo, _videoVo)

		} else {

			return this._getSidxManifest(
					mediaSource,
					this.currentVideoId,
					_uuid
				).then(manifest => {
					this._onManifestReceived(mediaSource, _videoVo, manifest)

						//we make a new object
					let _mediaSourceVo = this._createMediaSourceVo(manifest, _videoVo, this._options)

					return this._getIndexBuffer(
						_videoVo.uuid,
						_mediaSourceVo.url,
						_mediaSourceVo.indexRange
					).then(buffer => {
						_mediaSourceVo.indexBuffer = buffer
						if (VERBOSE) console.log("Got index buffer");
						return this._doRangeRequestAndAdd(mediaSource, _mediaSourceVo, _videoVo)
					})
				})
				.catch(err => {
					//do something before
					return this._onMediaSourceError(err, mediaSource)
				})
		}
	}

	_getSidxManifest(mediaSource, videoId, uuid) {
		return this._videoSocket.getManifest(mediaSource, videoId, uuid)
	}

	_getIndexBuffer(uuid, url, range, options) {
		return this._videoSocket.getIndexBuffer(uuid, url, range, options)
	}

	_getRangeBuffer(uuid, url, range, options) {
		return this._videoSocket.getRangeBuffer(uuid, url, range, options)
	}

	_doRangeRequest(mediaSource, mediaSourceVo, videoVo) {
		return this._getRangeBuffer(
			videoVo.uuid,
			mediaSourceVo.url,
			mediaSourceVo.byteRange, {
				youtubeDl: true,
				end: this._videoVoUtils.isAtLastRef(videoVo),
				uuid: videoVo.uuid,
				duration: mediaSourceVo.duration
			}
		).then(buffer => {
			mediaSourceVo.videoBuffer = buffer
			if (VERBOSE) console.log("Got video buffer");

			/*var buf = new ArrayBuffer(mediaSourceVo.indexBuffer.length)
			var bufView = new Uint8Array(buf);
			bufView.set(mediaSourceVo.indexBuffer)

			let i = Math.floor(Math.random() * 4)
			this._SocketService.addVideo({
			  indexBuffer: buf,
			  rangeBuffer: mediaSourceVo.videoBuffer,
			  saveName: mediaSourceVo.videoId,
			  duration:mediaSourceVo.duration,
			  saveGroup: (i === 0)
			})*/

			//override this method
			this._onIndexAndBufferSuccess(mediaSourceVo)

			//this is important
			this._videoVoUtils.addRefToWatchedVideoVo(videoVo)

			return mediaSourceVo

			/*this._saveIndexRange(mediaSourceVo)*/
			/*this._addToRequested(mediaSourceVo)*/
		})
	}

	_addVo(mediaSource, mediaSourceVo, videoVo) {
		return mediaSource.addVo(mediaSourceVo)
			.then(mediaSource => {
				this.userEvents.voAdded(videoVo, mediaSourceVo)
				this.state = CONTROLLER_STATE.IDLE
				this._videoVoUtils.mediaSouceVoPlayed(videoVo, mediaSourceVo)
				this.voAddedSignal.dispatch(mediaSource)
				this._onSegmentAdded(mediaSource)
				mediaSourceVo = null
				return mediaSource
			})
			.catch(err => {
				return this._onMediaSourceError(err, mediaSource)
			})
	}

	_doRangeRequestAndAdd(mediaSource, mediaSourceVo, videoVo) {
		return this._doRangeRequest(mediaSource, mediaSourceVo, videoVo)
			.then(mediaSourceVo => {
				//do preloading after its loaded
				this._preloadIfPossible(mediaSource, videoVo)

				return this._addVo(mediaSource, mediaSourceVo, videoVo)
			})
	}

	_onManifestReceived(mediaSource, videoVo, manifest) {
		let _references = manifest.sidx.references
		this._videoVoUtils.setReferenceLength(videoVo, _references.length)

		//we override this in extensions
		this._chooseVoRefIndex(videoVo, mediaSource)
	}

	_createMediaSourceVo(manifest, videoVo, options) {
		return this._videoVoUtils.getMediaSourceVo(
			manifest,
			videoVo,
			options
		)
	}

	_onSegmentAdded(mediaSource) {
		console.log("segment Added");
	}

	/*
	Override this to get a copy of the vo as it its passed
	*/
	_onIndexAndBufferSuccess(vo) {}


	_onMediaSourceError(err, mediaSource) {
		console.log(err.name);
		console.log(err.message);
		let { EXHAUSED_VIDEO_REFERENCES, SIDX, APPEND_FAILED, MEDIASOURCE } = ERROR_TYPES
		switch (err.name) {
			case EXHAUSED_VIDEO_REFERENCES:
				/*
				thrown in the addvo chain
				*/
				return this.addVo().finally()
				break;
			//case SIDX:
			case APPEND_FAILED:
				this._setNextVideoId()
				return this.addVo().finally()
				break;
			case MEDIASOURCE:
				this._setNextVideoId()
				return mediaSource.resetMediasource()
					.then(() => {
						return this.addVo()
					}).finally()
				break;
			default:

		}
	}

	//!!!!!!!!!!!!!!!!!!!!
	//UNUSED
	//!!!!!!!!!!!!!!!!!!!!
	/*
	Know which videos we've requested
	*/
	_addToRequested(vo) {
		if (this._requestedIds.indexOf(vo.videoId) < 0) {
			this._requestedIds.push(vo.videoId)
		}
	}

	/*
	Save the indexBuffer on redis only once,
	UNUSED
	*/
	_saveIndexRange(vo) {
		if (this._requestedIds.indexOf(vo.videoId) < 0) {
			this._SocketService.saveIndexRangeRedis({
				uuid: _vo.uuid,
				value: _vo.indexBuffer
			})
		}
	}

	//****************
	//OVERRIDES
	/*
	Over ride these in the extensions
	*/
	//****************

	_onTimeupdateSignal(mediaSource){
		this._userEvents.updateVoPlaybackProgress(mediaSource)
	}

	/*
	By default it will play through a video and go to the next
	*/
	_chooseVoRefIndex(videoVo, mediaSource) {
		//passed the last ref, so choose next video
		//basic
		this._videoVoUtils.incrementRefIndex(videoVo, 1, (videoVo) => {
			this._chooseCurrentVideoIndex(videoVo)
		})
	}

	/*Override this too*/
	_chooseCurrentVideoIndex(videoVo) {
		//increase the youtube
		this._setNextVideoId()
			//so it starts the next

		throw Utils.getError(ERROR_TYPES.EXHAUSED_VIDEO_REFERENCES)
	}

	_onVideoPlayingSignal(mediaSource) {

	}

	_preloadIfPossible(mediaSource, videoVo) {
		//preload

	}

	//**************
	//fetching data
	//**************

	/*
	Something went wrong when trying to add the vo
	*/
	_handleVoError(err) {
		let { message } = err
		let _type = message.split(':')[0]
		let _videoId = message.split(':')[1]
		switch (_type) {
			case ERROR_TYPES.FATAL:
				this._currentRef = undefined
				this.youtubeItemIds = this._filterYoutubeResultsById(this.youtubeItemIds, _videoId)
				return this._mediaSource.resetMediasource()
					.then(() => {
						return this._loadNextSegment()
					})
				break
		}
	}





	/*
	The unique identifier to look up chached index range
	*/
	_getUUID(type, videoId) {
		return this._videoSocket.getUUID(type, videoId)
	}

	/*
	Get all the video Ids from playlists
	*/
	_getPlaylistVideoIds() {
		return this._videoPlaylist.getPlaylistVideoIds()
	}

	/*Remove any that dont conform*/
	_filterYoutubeResultsById(source, id) {
		return source.filter(item => {
			return !(item === id)
		})
	}

	_setRandomVideoIndex() {
		this.currentVideoIndex = Utils.getRandomNumberRange(this.youtubeItemIds.length - 1)
		return this.currentVideoIndex
	}

	/*
	DECIDE TO GO TO NEXT VIDEO OR NOT
	*/

	//!!!!!!!!!!!!!!
	//UNUSED
	//!!!!!!!!!!!!!!
	_checkVideoPlaybackPostion(mediaSource) {
		let _uuid = this._getUUID(mediaSource, this.currentVideoId)
		let _videoVo = this._getCurrentVideoVo(_uuid)
			//only once
		if (this.mediaSources.indexOf(mediaSource) === 0) {
			if (_videoVo.refIndex + 1 >= _videoVo.refLength) {
				this._setNextVideoId()
			}
		}
	}

	_onVoAdded(mediaSource, videoVo) {
		console.log(videoVo.timelineTotal);
	}

	/*_adjustAfterNewVideo(videoVo, oldId, newId) {
	  this.mediaSources.forEach(ms => {
	    ms.currentTime = ms.totalDuration - videoVo.currentRefDuration
	  })
	}*/

	_setNextVideoId() {
		this._videoPlaylist.next()
	}

	/*_setNextVideoId() {
	  let _c = this.currentVideoIndex
	  _c++
	  if (_c > this.youtubeItemIds.length - 1) {
	    _c = 0
	  }
	  this.currentVideoIndex = _c
	}

	_getNextVideoId() {
	  let _c = this.currentVideoIndex
	  _c++
	  if (_c > this.youtubeItemIds.length - 1) {
	    _c = 0
	  }
	  return this.youtubeItemIds[_c]
	}


	_setPreviousVideoId() {
	  let _c = this.currentVideoIndex
	  _c--
	  if (_c < 0) {
	    _c = this.youtubeItemIds.length - 1
	  }
	  this.currentVideoIndex = _c
	}*/

	get currentVideoId() {
		return this._videoPlaylist.current
	}

	get options() {
		return this._options
	}

	get videoPlaylist() {
		return this._videoPlaylist
	}

	get userEvents(){
		return this._userEvents
	}

	get videoVoUtils() {
		return this._videoVoUtils
	}

	get videoSocket() {
		return this._videoSocket
	}

	get state() {
		return this._state
	}

	set state(state){
		this.userEvents.mediaSourceState(state)
		this._state = state
	}

	//********************
	//API
	/*
	override methods in Base
	*/
	//********************

	get api() {
		return this._videoApi
	}

}

export default VideoController;
