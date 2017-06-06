import $ from 'jquery';
import Xhr from 'xhr-request';
import Q from 'bluebird';
import _ from 'lodash';
import QS from 'query-string';
import fetch from 'isomorphic-fetch';

import BlueBirdQueue from './bluebirdQueue';

'use strict';


const SEARCH = "https://www.googleapis.com/youtube/v3/search";
const VIDEO = "https://www.googleapis.com/youtube/v3/videos";
const PLAYLISTS = "https://www.googleapis.com/youtube/v3/playlists";
const PLAYLIST_ITEMS = "https://www.googleapis.com/youtube/v3/playlistItems";
const COMMENT_THREADS = "https://www.googleapis.com/youtube/v3/commentThreads";

let _sidxQueue = new BlueBirdQueue({
	concurrency: 1 // optional, how many items to process at a time
});

function _addNextSidx(prom) {
	_sidxQueue.add(prom);
	_sidxQueue.start();
	return prom;
}

const DEFAULTS = {
	maxResults: 50
};

function _getAuth() {
	return { access_token: Session.youtube.auth.access_token };
}
const YT = {

	search(options = {}) {
		let params = QS.stringify(_.assign({}, {
			part: 'snippet',
			maxResults: 50,
			safeSearch: 'none'
		}, options));

		return fetch(`${SEARCH}?${params}`).then(response => {
			return response.json();
		});
	},

	video(options = {}) {
		let params = QS.stringify(_.assign({}, {
			part: 'contentDetails'
		}, DEFAULTS, _getAuth(), options));

		return fetch(`${VIDEO}?${params}`).then(response => {
			return response.json();
		});
	},

	userPlaylists(options = {}) {
		let params = QS.stringify(_.assign({}, {
			part: 'snippet',
			mine: true
		}, DEFAULTS, _getAuth(), options));

		return fetch(`${PLAYLISTS}?${params}`).then(response => {
			return response.json();
		});
	},

	relatedToVideo(options = {}) {
		let params = QS.stringify(_.assign({}, {
			part: 'snippet',
			relatedToVideoId: options.id,
			videoDuration: 'any',
			maxResults: 50,
			type: 'video',
			safeSearch: 'none'
		}, DEFAULTS, _getAuth(), options));

		return fetch(`${SEARCH}?${params}`).then(response => {
			return response.json();
		});
	},

	playlists(options = {}) {
		let params = QS.stringify(_.assign({}, {
			part: 'snippet'
		}, DEFAULTS, _getAuth(), options));

		return fetch(`${PLAYLISTS}?${params}`).then(response => {
			return response.json();
		});
	},

	playlistItems(options) {
		console.log(options);
		let params = QS.stringify(_.assign({}, {
			part: 'snippet',
			videoDuration: 'any',
			maxResults: 50,
			type: 'video',
			safeSearch: 'none'
		}, DEFAULTS, _getAuth(), options));

		return fetch(`${PLAYLIST_ITEMS}?${params}`).then(response => {
			return response.json();
		});
	},

	videoComments(options) {
		let params = QS.stringify(_.assign({}, {
			part: 'snippet',
		}, DEFAULTS, _getAuth(), options));

		return fetch(`${COMMENT_THREADS}?${params}`).then(response => {
			return response.json();
		});
	},

	serverRelated(id) {
		let p = new Q((resolve, reject) => {
			Xhr(process.env.SERVER_BASE + 'youtube/video/related', {
				json: true,
				query: { id: id }
			}, (err, data) => {
				if (err) {
					reject(err)
				} else {
					if (data.status === 500) {
						reject();
					} else {
						resolve(JSON.parse(data.body));
					}
				}
			})
		})
		return _addNextSidx(p);
	},

	serverPlaylistItems(id) {
		let p = new Q((resolve, reject) => {

			Xhr(process.env.SERVER_BASE + 'youtube/playlistitems', {
				json: true,
				query: { id: id }
			}, (err, data) => {
				if (err) {
					reject(err)
				} else {
					if (data.status === 500) {
						reject();
					} else {
						resolve(JSON.parse(data.body));
					}
				}
			})
		})
		return _addNextSidx(p);
	}

};
export default YT;
