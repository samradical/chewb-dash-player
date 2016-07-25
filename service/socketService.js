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

  _onVideoSidx(data) {

  }

  _removeListener(string) {
    let _func = this.socket._callbacks[`$${string}`]
    if (_func) {
      this.socket.removeListener(string, _func)
    }
  }

  _appendBuffer(buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  }

  getSidx(options) {
    console.log("getSidx");
    console.log(options);
    return new Q((yes, no) => {
      let _existing = this.sidxs[options.id]
      if(_existing){
        return yes(_existing)
      }
      this._removeListener('rad:youtube:sidx:resp')
      this.socket.on('rad:youtube:sidx:resp', (data) => {
        if (typeof data !== 'Error' && data) {
          console.log(typeof data);
          console.log(data);
          if(typeof data === 'Array'){
            this.sidxs[options.id] = data[0]
            yes(data[0])
          }else{
            this.sidxs[options.id] = data
            yes(data)
          }
        } else {
          console.log(data);
          no(data)
        }
      })
      this.socket.emit('rad:youtube:sidx', options)
    })
  }

  getVideoRange(obj) {
    return new Q((yes, no) => {
      this._removeListener('rad:video:range:resp')
      this._removeListener('rad:video:range:end')

      let _buffer

      this.socket.on('rad:video:range:resp', (data) => {
        let _b = new Uint8Array(data)
        if (!_buffer) {
          _buffer = _b
        } else {
          _buffer = this._appendBuffer(_buffer, _b)
        }
      })
      this.socket.on('rad:video:range:end', (data) => {
        yes(_buffer)
      })
      this.socket.emit('rad:video:range', obj)
    })
  }
}
