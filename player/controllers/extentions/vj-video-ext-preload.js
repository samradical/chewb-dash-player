import VideoBase from './vj-video-ext-base'

export default class Preload extends VideoBase {
	constructor(controller, options) {
		super(controller, options)
		this._controller = controller
		this._controller._preloadIfPossible = this._preloadIfPossible.bind(this)
	}

	_preloadIfPossible(mediaSource, videoVo){
		if (this.videoVoUtils.isAtLastRef(videoVo)) {
			this.videoSocket.preload(mediaSource, this.videoPlaylist.nextVideoId)
		}
	}

	get videoSocket() {
		return this._controller.videoSocket
	}

	get videoVoUtils(){
		return this._controller.videoVoUtils
	}

	get videoPlaylist(){
		return this._controller.videoPlaylist
	}
}
