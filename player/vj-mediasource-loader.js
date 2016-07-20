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

  function _xhr(vo, url, formData) {
    return new Q((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'arraybuffer';

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

  function indexRange(vo) {
    //****remove old cache
    let _videoCacheIds = Object.keys(_indexCaches)
    if (_videoCacheIds.length > INDEX_CACHE_SIZE) {
      delete _indexCaches[_videoCacheIds[0]]
      _indexCaches.shift()
    }

    let _indexCache = _indexCaches[vo.videoId]
    if (_indexCache) {
      if (VERBOSE) {
        console.log(`Got index range of ${vo.videoId} from cache`);
      }
      return Q.resolve(_indexCache)
    }
    let formData = new FormData();
    formData.append('url', vo.url);
    formData.append('indexRange', vo.indexRange);
    formData.append('indexLength', vo.indexLength);
    return _xhr(vo, SERVER_BASE + 'getVideoIndex', formData)
      .then((resp) => {
        if (INDEX_CACHING) {
          _indexCaches[vo.videoId] = resp
        }
        return resp
      })
  }

  function range(vo) {
    let formData = new FormData();
    if (VERBOSE) {
      console.log(vo.byteRange, vo.byteLength, vo.duration);
    }
    formData.append('url', vo.url);
    formData.append('byteRange', vo.byteRange);
    formData.append('byteLength', vo.byteLength);

    return _xhr(vo, SERVER_BASE + 'getVideo', formData)
  }

  return {
    indexRange,
    range 
  }
})()

export default VjMediaSourceLoader;
