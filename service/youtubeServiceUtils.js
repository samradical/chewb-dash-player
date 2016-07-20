import Q from 'bluebird';
import QS from 'query-string';
import _ from 'lodash';
import S  from 'string';

import youtubeApi from './youtubeService';
import fetch from 'isomorphic-fetch';

const queryObject = {
	q: '',
	duration: 0,
	access_token: ''
};
//***********************
//HELPERS
//***********************
const MAX_TRACK_DIFF_SEC = 15;
const ITERATIONS_BEFORE_ACCEPT = 30;
const ITERATIONS_BEFORE_REJECT = 30;

function _hasFoundMatchingYoutube(trackObj, item) {
	let ytDuration = _parseDuration(item.contentDetails.duration);
	let title = S(item.snippet.title).stripPunctuation().s.toLowerCase();
	let trackTitle = S(trackObj.title).stripPunctuation().s.toLowerCase();
	var lastword = trackTitle.split("-").pop();
	let diff = Math.abs(trackObj.duration - ytDuration);
	var matcher = new RegExp(lastword);
	let hasTitle = matcher.test(title);
	return diff <= MAX_TRACK_DIFF_SEC && hasTitle;
}

function _parseDuration(ytDur) {
	var formattedTime = ytDur.replace("PT", "").replace("H", ":").replace("M", ":").replace("S", "");
	var split = formattedTime.split(':');
	var durSeconds = 0;
	if (split.length === 1) {
		durSeconds = parseInt(split[0], 10);
	} else if (split.length === 2) {
		durSeconds = parseInt(split[0], 10) * 60 + parseInt(split[1], 10);
	} else if (split.length === 3) {
		durSeconds = parseInt(split[0], 10) * 60 * 60 + parseInt(split[0], 10) * 60 + parseInt(split[1], 10);
	}
	return durSeconds;
}

function _idFromItem(item) {
	return item.id.videoId;
}

function _createQueryObject(query, accessToken) {
	return _.assign({}, query, {
		access_token: accessToken
	});
}

function _search(options) {
	return youtubeApi.search(options);
}

function _findYoutubeVideo(queryObject) {
	return new Q((resolve, reject) => {

		let firstVideoData;
		let pageResults;
		let counter = 0;
		let {
			q
		} = queryObject;
		let {
			access_token
		} = queryObject;

		function _getNext() {
			counter++;
			if (counter < pageResults.length - 1) {
				_getVideoInfo(_idFromItem(pageResults[counter]));
			} else {
				resolve({
					queryObject
				});
			}
		}

		function _getVideoInfo(id) {
			console.log("getting video info for ", id)
			return youtubeApi.video({
					id, access_token,part: 'contentDetails, snippet',
					order:'relevance'
				})
				.then(results => {
					let item = results.items[0];
					if(!firstVideoData){
						firstVideoData = item;
					}
					if (item) {
						let found = _hasFoundMatchingYoutube(queryObject, item);
						console.log("Found: ", queryObject.title, found, counter,"/", pageResults.length);
						if(!found && counter > ITERATIONS_BEFORE_REJECT){
							reject({msg:`Couldnt find youtube for ${queryObject.title}`});
						}else if(found){
							resolve({
								queryObject, item
							});
						}else{
							_getNext();
						}
					} else {
						_getNext();
					}
				});
		}

		_search({
			q, access_token,type:'video'
		}).then(results => {
			pageResults = results.items;
			console.log("Got ", pageResults.length , "for ", queryObject.title);
			_getVideoInfo(_idFromItem(pageResults[counter]));
		});
	});
}



//*********
//formatters
//*********
function _extractQueryFromTracks(tracks) {
	let queries = [];
	_.each(tracks, item => {
		let {track} = item;
		queries.push({
			title:`${track.name}`,
			artist:`${track.artists[0].name}`,
			q: `${track.name} ${track.artists[0].name}`,
			duration: track.duration_ms / 1000,
			uri: track.uri
		});
	});
	return queries;
}


//***********************
//API
//***********************
// export function youtubePlaylistFromSpotifyPlaylistId(playlistId) {
//   return function(dispatch, getState) {
//     //send authenticating
//     dispatch(actionCreate.creatingPlaylistFromTracks());

//     //open the popup
//     return youtubeApi.login().then((payload) => {
//       //sucess, need failed handler
//       dispatch(actionCreate.setAuthentication(payload));

//     }).done();
//   }
// }
