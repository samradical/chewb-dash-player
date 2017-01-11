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
		this.controller.tryPlay()
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

	removeIdFromPlaylist(videoId) {
		this.videoPlaylist.removeId(videoId)
	}

	moveToFrontPlaylist(videoId, youtubeItem) {
		this.videoPlaylist.moveToFront(videoId, youtubeItem)
		this.controller.tryPlay()
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

	previousVideo() {
			this.videoPlaylist.previous()
		}
		//0-1
	seek(percent) {
		this.videoVideoUtils.seek(percent)
	}

	seekTimeline(percent) {
		this.controller.seek(percent)
	}

	pause() {
		this.controller.pause()
	}

	resume() {
		this.controller.resume()
	}

}

export default VideoControllerApi;
