import IO from 'socket.io-client'
import Q from 'bluebird';
import Signals from 'signals';

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

      if (_existing.sidx) {
        return yes(_existing.sidx)
      }
      _existing.indexResp = (data) => {
        if (typeof data !== 'Error' && data) {
          if (data[0]) {
            _existing.sidx = data[0]
            yes(_existing.sidx)
          } else {
            _existing.sidx = data
            yes(_existing.sidx)
          }
        } else {
          console.log(data);
          no(data)
        }
      }
      this.socket.on(_s, _existing.indexResp)
      this.socket.emit('rad:youtube:sidx', options)
    })
  }

  getVideoRange(options) {
    return new Q((yes, no) => {
      let _buffer

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
}
