import Q from 'bluebird';
import _ from 'lodash';

import {
	Utils,
	Constants,
	Cache
} from '../../utils'

const { USER_EVENTS } = Constants

const getVideoIdFromUUID = (uuid) => {
	return uuid.split(':')[1]
}

class UserEvents {

	constructor(controller) {
		this._conntroller = controller
	}

	get videoPlaylist() {
		return this._conntroller.videoPlaylist
	}

	get emitter() {
		return this._conntroller.emitter
	}

	mediaSourceState(state) {
		this.emitter.emit(`user:${USER_EVENTS.MEDIASOURCE_STATE}`, state)
	}

	voAdded(vo, mediasourceVo) {
		this.emitter.emit(`user:${USER_EVENTS.VO_ADDED}`, vo,mediasourceVo)
	}

	newVideo(vo) {
		let videoId  = getVideoIdFromUUID(vo.uuid)
		let ytItem = this.videoPlaylist.getInfoById(videoId)
		console.log(ytItem);
		this.emitter.emit(`user:${USER_EVENTS.VIDEO_FINISHED}`, ytItem)
	}

	updateVoPlaybackProgress(mediasource) {
		let { currentVo, currentTime } = mediasource
		let _s = currentVo.timestampOffset
		let _e = _s + currentVo.duration

		let _p = (currentTime - _s) / _e
		this.emitter.emit(`user:${USER_EVENTS.VO_PLAYBACK_PROGRESS}`, _p)
	}

	updatePlaylist(ids) {
		this.emitter.emit(`user:${USER_EVENTS.PLAYLIST}`, ids)
	}

}

export default UserEvents;
