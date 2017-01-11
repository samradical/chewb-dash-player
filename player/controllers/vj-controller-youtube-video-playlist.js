import Q from 'bluebird';
import _ from 'lodash';

import {
	Utils,
	Constants,
	Cache
} from '../../utils'

const { ERROR_TYPES } = Constants;

/*
We only store videoIds
*/
class VideoControllerPlaylist {

	constructor(controller) {
		this.controller = controller
		this.youtubeItems = [];
		this.youtubeItemIds = [];
	}

	get videoVoUtils() {
		return this.controller.videoVoUtils
	}

	get userEvents() {
		return this.controller.userEvents
	}

	getPlaylistVideoIds() {
		return new Q((resolve, reject) => {
			if (this.youtubeItemIds.length) {
				resolve(this.youtubeItemIds)
			} else {
				if (!this.playlists.length) {
					let _err = new Error('No playlists')
					_err.name = ERROR_TYPES.NO_PLAYLISTS
					reject(_err)
				}
				return Q.map(this.playlists, (id) => {
					return this.socket.youtube.playlistItems({
							playlistId: id,
							force: this.options.forcePlaylistUpdate
						})
						.then(results => {
							this.updateYoutubeResults(results);
							return resolve(this.youtubeItemIds)
						});
				}, {
					concurrency: 10
				}).finally()
			}
		});
	}

	/*
		More items have come in
		Shuffle them and join them to the mix
		*/
	updateYoutubeResults(data) {
		let _ids = [];
		if (this.options.shufflePlaylist) {
			Utils.shuffle(data.items);
		}
		_.each(data.items, (item) => {
			_ids.push(Utils.getIdFromItem(item));
		});
		this.youtubeItems = [...data.items, ...this.youtubeItems];
		this.youtubeItemIds = _.uniq([..._ids, ...this.youtubeItemIds]);
		this._updateUserPlaylist()
			//was out
		if (this.playlistEmpty) {
			this.playlistEmpty = false
			return this.controller.addVo().finally()
		}
	}

	get playlists() {
		return this.controller._playlists
	}

	get socket() {
		return this.controller._SocketService
	}

	get options() {
		return this.controller._options
	}

	get current() {
		return this.youtubeItemIds[0]
	}

	get nextVideoId() {
		return this.youtubeItemIds[1]
	}

	getInfoById(videoId) {
		return this.youtubeItems.filter(item => {
			let id = Utils.getIdFromItem(item)
			return videoId === id
		})[0]
	}

	removeId(videoId) {
		this._removeVideoIdFromQueue(videoId)
		this._updateUserPlaylist()
	}

	moveToFront(videoId, youtubeItem) {
		let _i = this.youtubeItemIds.indexOf(videoId)
			//exists
		if (_i > -1) {
			let _id = this.youtubeItemIds.splice(_i, 1)[0]
			this.youtubeItemIds.unshift(_id)
			this._updateUserPlaylist()
		} else {
			this.youtubeItems.unshift(youtubeItem)
			this.youtubeItemIds.unshift(videoId)
			this._updateUserPlaylist()
		}
	}

	/*
	tell the video vo
	called by
	EXHAUSED_VIDEO_REFERENCES at _onMediaSourceError
	*/
	next() {
		//reset indexs
		let _vo = this.videoVoUtils.current
		if (this.videoVoUtils.isAtLastRef(_vo)) {
			this.videoVoUtils.resetVo(_vo)
		}
		//remove the front
		let _id = this.youtubeItemIds.shift()
			//move to end
		this.youtubeItemIds.push(_id)
			//out
		if (!this.youtubeItemIds.length) {
			this.playlistEmpty = true
		}
		let _currentVo = this.videoVoUtils.current
		this.videoVoUtils.videoVoFinished(_currentVo)
		this._updateUserPlaylist()
	}

	previous() {
		//remove the back
		let _id = this.youtubeItemIds.pop()
			//move to front
		this.youtubeItemIds.unshift(_id)
		this._updateUserPlaylist()
	}

	_getRandomVideoId() {
		return this.youtubeItemIds[Math.floor(Math.random() * this.youtubeItemIds.length - 1)]
	}

	_removeVideoIdFromQueue(id) {
		let _i = this.youtubeItemIds.indexOf(id)
		if (_i > -1) {
			this.youtubeItemIds.splice(_i, 1)
		}
		this._updateUserPlaylist()
	}

	_updateUserPlaylist() {
		this.userEvents.updatePlaylist(this.youtubeItemIds)
	}

}

export default VideoControllerPlaylist;
