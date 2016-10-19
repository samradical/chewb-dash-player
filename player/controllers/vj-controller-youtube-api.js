import Q from 'bluebird';
import _ from 'lodash';

import {
	Utils,
	Constants,
	Cache
} from '../../utils'

const { ERROR_TYPES, CONTROLLER_STATE } = Constants;

class VideoControllerApi {

	constructor(controller) {
		this._controller = controller
	}

	get youtubeItemIds() {
		return this.controller.videoPlaylist.youtubeItemIds
	}

	get videoPlaylist() {
		return this._controller.videoPlaylist
	}

	get videoVideoUtils() {
		return this.controller.videoVoUtils
	}

	get controller() {
		return this._controller
	}

	/*
	{
		rush
	}
	*/
	unshiftNewVideo(value, options) {
		let _nextId = this.controller.videoPlaylist.nextVideoId
		this.controller.videoSocket.cancelPreload(_nextId)
		this.controller.videoPlaylist.next()
		this.youtubeItemIds.unshift(value)
		if (this.controller.state === CONTROLLER_STATE.IDLE) {
			this.controller.addVo().finally()
		}
		console.log(value);
	}

	set behavior(b) {
		this.controller.videoVoUtils.behavior = b
	}

	/*
	Push to front
	*/
	addPlaylistItems(youtubeResults) {
		this.videoPlaylist.updateYoutubeResults(youtubeResults)
	}

	removeIdFromPlaylist(videoId){
		this.videoPlaylist.removeId(videoId)
	}

	moveToFrontPlaylist(videoId){
		this.videoPlaylist.moveToFront(videoId)
	}

	/*
	assume there is only 1 mediasource
	*/
	stepForward(amount) {
		let ms = this.controller.mediaSources[0]
		let { currentTime, sourceBufferEnd } = ms
		ms.stepForward(amount)
	}

	stepBack(amount) {
		let ms = this.controller.mediaSources[0]
		ms.stepBack(amount)
	}

	nextVideo() {
			this.videoPlaylist.next()
		}
		//0-1
	seek(percent) {
		this.videoVideoUtils.seek(percent)
	}
}

export default VideoControllerApi;
