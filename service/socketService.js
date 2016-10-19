import IO from 'socket.io-client'
import Q from 'bluebird';
import Signals from 'signals';

/*
DEAD CODE

*/

const YOUTUBE_DEFAULTS = {
	maxResults: 50
};

import {
	Cache,
	Utils,
	Constants,
} from '../utils'
const { ERROR_TYPES } = Constants;

export default class Socket {

	constructor(server = "http://0.0.0.0:8080") {
		const socket = IO(server)
		this.socket = socket
		this.handshakeSignal = new Signals()
		socket.on('handshake', (data) => {
			console.log("Socket Handshake");
			console.log(data);
			this.handshakeSignal.dispatch(data)
		});
		this.sidxs = {}
	}

	_getCacheKey(options) {
		return options.uuid
	}

	_getCache(options) {
		let key = this._getCacheKey(options)
		let _s = this.sidxs[key] || {}
		this.sidxs[key] = _s
		return this.sidxs[key]
	}

	_appendBuffer(buffer1, buffer2) {
		var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
		tmp.set(new Uint8Array(buffer1), 0);
		tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
		return tmp.buffer;
	}

	getSidx(options) {
		return new Q((yes, no) => {
			let _s = `rad:youtube:sidx:${options.uuid}:resp`
			let _existing = this._getCache(options)
			this.socket.removeListener(_s, _existing.indexResp)

			if (_existing.sidx) {
				return yes(_existing.sidx)
			}
			_existing.indexResp = (data) => {
				this.socket.removeListener(_s, _existing.indexResp)
				console.log(data);
				if (!data.error && data) {
					if (data) {
						_existing.sidx = data
						yes(_existing.sidx)
					} else {
						_existing.sidx = data
						yes(_existing.sidx)
					}
				} else {
					console.log(data);
					no(Utils.getError(ERROR_TYPES.SIDX, JSON.stringify(data)))
				}
			}
			this.socket.on(_s, _existing.indexResp)
			this.socket.emit('rad:youtube:sidx', options)
		})
	}

	getVideoRange(options) {
		return new Q((yes, no) => {
			let _buffer

			/*
			Get from cache
			*/
			/*if (options.isIndexRange) {
				let _indexBuffer = Cache.getIndexBuffer(options.uuid)
				if (_indexBuffer) {
					yes(_indexBuffer)
					return
				}
			}*/

			let _existing = this._getCache(options)
			let _s = `rad:video:range:${options.uuid}:resp`
			let _e = `rad:video:range:${options.uuid}:end`
			this.socket.removeListener(_s, _existing.rangeResp)
			this.socket.removeListener(_e, _existing.rangeEnd)

			_existing.rangeResp = (data) => {
				let _b = new Uint8Array(data)
				if (!_buffer) {
					_buffer = _b
				} else {
					_buffer = this._appendBuffer(_buffer, _b)
				}
			}

			_existing.rangeEnd = () => {
				yes(_buffer)
			}

			this.socket.on(_s, _existing.rangeResp)
			this.socket.on(_e, _existing.rangeEnd)
			this.socket.emit('rad:video:range', options)
		})
	}

	saveIndexRangeRedis(obj) {
		console.log(obj);
		//this.socket.emit('rad:redis:set:indexRange', obj)
	}

	playlistItems(options) {
		return new Q((yes, no) => {
			let params = _.assign({}, {
				part: 'snippet',
				videoDuration: 'any',
				maxResults: 50,
				type: 'video',
				safeSearch: 'none'
			}, YOUTUBE_DEFAULTS, options)

			let _s = `rad:youtube:playlist:items:resp`
			let _existing = this._getCache(options)
			this.socket.removeListener(_s, _existing.playlistItemsResponse)
			_existing.playlistItemsResponse = (data) => {
				yes(data)
			}
			this.socket.on(_s, _existing.playlistItemsResponse)
			this.socket.emit('rad:youtube:playlist:items', options)
		})
	}

	addVideo(obj) {
		this.socket.emit('rad:video:save', obj)
	}

	saveVideo() {
		this.socket.emit('rad:video:save:end')
	}
}
