import TWEEN from 'tween.js';
import _ from 'lodash';
import Q from 'bluebird';

import {
  Utils,
  Emitter,
} from '../utils'

import YoutubeService from './service/youtubeService';
import ServerService from './service/serverService';
import PlaylistUtils from './vj-youtube-playlist-utils';
import ControlPerameters from './vj-control-perameters';
import VjUtils from './vj-utils';

class MediaPlaylist {
	constructor(mediaSource, options) {

		this.mediaSource = mediaSource;
		this.options = options;

		this.playlistUtils = new PlaylistUtils();

		//waiting on more data
		this._waiting = false;

		this.playlistReferenceIndex = 0;
		this.sidxIndexReferences = this.playlistUtils.referenceIndexs;

		this.youtubeItems = [];
		this.youtubeItemsIds = [];
		this.sidxResults = [];

		this.mediaSource.endingSignal.add(() => {
			//this._getNext();
			/*this.mediaSource.pause()
			let index = this.options.index
			Emitter.emit(`playother`, index)*/
		});

		if (this.mediaSource.getReadyState() !== 'open') {
			this.mediaSource.readySignal.addOnce(() => {
				this._init();
			});
		} else {
			this._init();
		}

		this.options.videoStartedSignal.add((currentVo) => {
			this.currentVo = currentVo;
			Emitter.emit('videostarted', this._getTitleFromId(currentVo.videoId));
		});
	}

	//***************
	//PUBLIC
	//***************

	//addAudioSource

	//***************
	//PRIVATE
	//***************

	_init() {
		console.log(this.options.playlists);
		if (this.options.playlists) {
			return Q.map(this.options.playlists, (id) => {
				return ServerService.playlistItems({
						playlistId: id
					})
					.then(results => {
						this._updateYoutubeResults(results);
						return Q.map(this.youtubeItems, (item) => {
							let vId = Utils.getIdFromItem(item);
							return this._getSidx(vId).catch(err => {
								console.log(err);
								return undefined;
							});
						}, {
							concurrency: 1
						}).then(results => {
							//clean
							results = _.compact(results);

							if (results.length) {
								this.sidxResults = [...this.sidxResults, ...results];
							}
							return this._createReferenceIndexFromResults(results);
						});
					});
			}, {
				concurrency: 1
			}).then((referenceIndexs) => {
				this._start();
			});
		}
	}

	_start() {
		//Emitter.on('addrelatedtocurrent', this._getRelatedTo, this);
		//Emitter.on('adddeeper', this._getDeeper, this);
		this._getNext();
	}

	_getDeeper() {
		return YoutubeService.videoComments({
			videoId: this.currentVo.videoId
		}).then((results) => {
			if (results.items.length) {
				let userProfile = {
					uploads: [],
					likes: []
				};
				return ServerService.channelUploadsFromComments(results, userProfile, this.youtubeItemsIds)
					.finally(() => {
						let _ups = userProfile.uploads;
						let _likes = userProfile.likes;
						let indexOf = _ups.indexOf(this.currentVo.videoId);
						if (indexOf > -1) {
							_ups.splice(indexOf, 1);
						}
						let _chosen = _ups.length ? _ups : _likes;
						//sort by lowest viewcount
						let _sorted = _chosen.sort(Utils.sortByView)[0];
						if(!_sorted){
							return this._getRelatedToAndCheck();
						}
						let newVideoId = _sorted.videoId;
						if (!newVideoId) {
							return this._getRelatedToAndCheck();
						} else {
							return YoutubeService.video({ id: newVideoId, part: 'snippet' })
								.then(data => {
									Utils.standardizeYoutubeVideoInfoFormat(data.items[0]);
									this._updateYoutubeResults(data);
									return this._getSidxAndAdd(newVideoId)
										.then(() => {
											this._checkAfterNewVideoFound();
										})
										.catch(err => {
											console.log(err);
										});
								});
						}
					});
			} else {
				console.log("No comments for ", this.currentVo.videoId);
				return this._getRelatedToAndCheck();
			}
		});
	}

	_getRelatedToAndCheck() {
		return this._getRelatedTo().then(() => {
			return this._checkAfterNewVideoFound();
		});
	}

	_getRelatedTo() {
		return YoutubeService.relatedToVideo({
				part: 'snippet',
				id: this.currentVo.videoId,
				order: 'relevance',
			})
			.then(data => {
				this._updateYoutubeResults(data);
				return this._onRelatedVideos(data);
			});

	}

	_onRelatedVideos(data) {
		console.log(data);
		var item = Utils.getRandom(data.items);
		var vId = Utils.getIdFromItem(item);
		return this._getSidxAndAdd(vId)
		.catch(err => {
			console.log(err);
			return this._onRelatedVideos(data);
		});
	}

	_getSidxAndAdd(vId) {
		return this._getSidx(vId)
			.then((sidx) => {
				this.sidxResults = [...this.sidxResults, sidx];
				return this._createReferenceIndexFromResults([sidx]);
			});
	}

	_checkAfterNewVideoFound() {
		if (this._waiting) {
			this._waiting = false;
			this._getNext();
		}
	}

	_getNext() {
		console.log(this.sidxIndexReferences);
		let referenceIndex = this.sidxIndexReferences[this.playlistReferenceIndex];
		if (!referenceIndex) {
			this._waiting = true;
			this._getDeeper();
			return;
		}
		console.log(this.playlistReferenceIndex, referenceIndex);
		let split = referenceIndex.split('_');
		let playlistItemIndex = split[0];
		let playlistItemReferenceIndex = split[1];
		let sidxPlaylistItem = this.sidxResults[playlistItemIndex];
		let vo = VjUtils.getReferenceVo(sidxPlaylistItem, playlistItemReferenceIndex);
		this.mediaSource.addVo(vo);
		this.playlistReferenceIndex++;
	}

	// _mixInSidxReferences(references){
	//     this.playlistItemIndex++;
	//     if(this.playlistItemIndex > 2){
	//         return;
	//     }
	//     PlaylistUtils.mixSidxReferences(this.sidxIndexReferences, this.playlistItemIndex, references);
	// }

	_updateYoutubeResults(data) {
		let _ids = [];
		if(this.options.shufflePlaylist){
			Utils.shuffle(data.items);
		}
		_.each(data.items, (item) => {
			_ids.push(Utils.getIdFromItem(item));
		});
		this.youtubeItems = [...this.youtubeItems, ...data.items];
		this.youtubeItemsIds = [...this.youtubeItemsIds, ..._ids];
	}

	_getTitleFromId(vId) {
		var ytItem;
		_.each(this.youtubeItemsIds, (id, i) => {
			if (id === vId) {
				ytItem = this.youtubeItems[i];
			}
		});
		return ytItem;
	}

	_createReferenceIndexFromResults(results) {
		_.each(results, (item) => {
			this.playlistUtils.mix(item, this.playlistReferenceIndex, this.options);
		});
		return this.sidxIndexReferences;
	}

	_getSidx(vId, options = {}) {
		options.quality = this.options.quality
		return ServerService.getSidx(vId, options);
	}
}

export default MediaPlaylist;
