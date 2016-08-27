import Signals from 'signals';
import Q from 'bluebird';

const VERBOSE = true;
const INDEX_CACHING = false;
const INDEX_CACHE_SIZE = 20;

const EVENTS = {
  READY_STATE_CHANGE: 'readystatechange',
  LOAD_START: 'loadstart',
  PROGRESS: 'progress',
  ABORT: 'abort',
  ERROR: 'error',
  LOAD: 'load',
  TIMEOUT: 'timeout',
  LOAD_END: 'loadend',
};
const VjMediaSourceLoader = (() => {

  let _indexCaches = {}

  function _reject(xhr) {
    let responseText = '';
    if (xhr.responseText) {
      responseText = this.opts.json ? JSON.parse(xhr.responseText) : xhr.responseText;
    }
    console.log(`...failed on getting range`);
    return responseText;
  }

  function _xhr(vo, url, formData, headers = {}) {
    return new Q((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key,headers[key] )
      })

      function _onXhrError() {
        xhr.removeEventListener(EVENTS.ABORT, _onXhrError);
        xhr.removeEventListener(EVENTS.ERROR, _onXhrError);
        xhr.removeEventListener(EVENTS.TIMEOUT, _onXhrError);
        _reject(xhr)
      }

      function _onXhrReadyStateChanged() {
        if (xhr.readyState == xhr.DONE) { // wait for video to load
          xhr.removeEventListener(EVENTS.ABORT, _onXhrError);
          xhr.removeEventListener(EVENTS.ERROR, _onXhrError);
          xhr.removeEventListener(EVENTS.TIMEOUT, _onXhrError);
          xhr.removeEventListener(EVENTS.READY_STATE_CHANGE, _onXhrReadyStateChanged)
          let _resp = new Uint8Array(xhr.response)
          if (VERBOSE) {
            console.log(`...got range ${_resp.byteLength}`);
          }
          xhr = null
          formData = null
          resolve(_resp)
        }
      }

      xhr.addEventListener(EVENTS.ABORT, _onXhrError);
      xhr.addEventListener(EVENTS.ERROR, _onXhrError);
      xhr.addEventListener(EVENTS.TIMEOUT, _onXhrError);
      xhr.addEventListener(EVENTS.READY_STATE_CHANGE, _onXhrReadyStateChanged)
      xhr.send(formData);
    })
  }

  function indexRange(vo,url) {
    //****remove old cache
    let _videoCacheIds = Object.keys(_indexCaches)
    if (_videoCacheIds.length > INDEX_CACHE_SIZE) {
      delete _indexCaches[_videoCacheIds[0]]
      _indexCaches.shift()
    }

    let _indexCache = _indexCaches[vo.id]
    if (_indexCache) {
      if (VERBOSE) {
        console.log(`Got index range of ${vo.id} from cache`);
      }
      return Q.resolve(_indexCache)
    }
    let _headers = {
      'Range': 'bytes=' + vo.indexRange,
      'X-Accel-Buffering': 'no',
      //'Content-Length': vo.indexLength,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'multipart/form-data',
      "Access-Control-Allow-Origin": "*"
    }
    return _xhr(vo, url, null, _headers)
      .then((resp) => {
        if (INDEX_CACHING) {
          _indexCaches[vo.id] = resp
        }
        return resp
      })
  }

  function range(vo, url) {
    if (VERBOSE) {
      console.log(vo.byteRange, vo.byteLength, vo.duration);
    }
    let _headers = {
      'Range': 'bytes=' + vo.byteRange,
      'X-Accel-Buffering': 'no',
      //'Content-Length': vo.indexLength,
      'Accept-Ranges': 'bytes',
      'Content-Type': 'multipart/form-data',
      "Access-Control-Allow-Origin": "*"
    }
    return _xhr(vo, url, null, _headers)
  }

  return {
    indexRange,
    range 
  }
})()

export default VjMediaSourceLoader;
