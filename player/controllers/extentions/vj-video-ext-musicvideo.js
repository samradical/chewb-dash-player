import ExtensionBase from './vj-video-ext-base'
import {
	Utils,
	Constants
} from '../../../utils'

const { ERROR_TYPES, BEHAVIORS,MEDIASOURCE_STATE } = Constants;

export default class ExtensionMusicVideo extends ExtensionBase {
	constructor(controller, options) {
		super(controller, options)
		let { emitter } = options
		this._controller = controller

		this._onBehaviorBound = this._onBehavior.bind(this)
		this._controller._onVideoUpdateStartedSignalBound = this._onVideoUpdateStartedSignal.bind(this)
		this._controller._onVideoUpdateEndedSignalBound = this._onVideoUpdateEndedSignal.bind(this)
		controller.behaviorSignal.add(this._onBehaviorBound)
		//this._controller._preloadIfPossible = this._preloadIfPossible.bind(this)
	}

	_onVideoUpdateStartedSignal(mediaSource){

	}

	_onVideoUpdateEndedSignal(mediaSource){
		//this._preloadIfPossible(mediaSource)
	}

	_preloadIfPossible(mediaSource) {
		let { currentTime, sourceBufferEnd } = mediaSource
		if (sourceBufferEnd - currentTime < 10) {

			let _uuid = this._controller._getUUID(mediaSource.type, this.videoPlaylist.nextVideoId)
			let _videoVo = this.videoVoUtils.getVideoVo(_uuid)
			return this.videoSocket.preload(mediaSource,
				this.videoPlaylist.nextVideoId
			).then(mediaSourceVo => {
				if(mediaSource.state !== MEDIASOURCE_STATE.BUSY){
					return this._controller._doRangeRequestAndAdd(mediaSource, mediaSourceVo, _videoVo)
				}
			}).finally()
		}
		/*if (this.videoVoUtils.isAtLastRef(videoVo)) {
			this.videoSocket.preload(mediaSource, this.videoPlaylist.nextVideoId)
		}*/
	}

	_onBehavior(type) {
		switch (type) {
			case BEHAVIORS.VIDEO_PASSED_DURATION:
				break;
		}
	}

	get videoVoUtils() {
		return this._controller.videoVoUtils
	}

	get videoSocket() {
		return this._controller.videoSocket
	}

	get videoPlaylist() {
		return this._controller.videoPlaylist
	}

	destroy() {
		super.destroy()
	}
}
