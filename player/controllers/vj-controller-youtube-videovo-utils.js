import Q from 'bluebird';
import _ from 'lodash';

let VIDEO_VO = {
  currentRefIndexs: null,
  currentRefDuration: 0,
  watchedRefs: null,
  timelineTotal: 0,
  type: null, //audio, video
  referencesLength: undefined
}

const getTypeFromUUID = (uuid) => {
  return uuid.split(':')[0]
}
const generateVideoVo = (uuid) => {
  let _vo = _.clone(VIDEO_VO)
  _vo.currentRefIndexs = Array(0)
  _vo.currentRefIndexs.push(-1)
  _vo.uuid = uuid
  _vo.type = getTypeFromUUID(uuid)
  _vo.watchedRefs = new Set()
  return _vo
}

class ArrayExtended extends Array {
  last(arr) {
    return arr[arr.length - 1]
  }
  first(arr) {
    return arr[0]
  }
}

import {
  Constants,
} from '../../utils'

const { ERROR_TYPES } = Constants;

class VideoVOUtils {

  constructor(controller) {
    this._controller = controller
  }

  //***************
  // VIDEO VO UUID 
  //***************

  //*****
  //PUBLIC
  //*****
  getVideoVo(uuid) {
    let _vo = this._getPlayedVideoVo(uuid)
    return _vo
  }

  setReferenceLength(vo, l) {
    vo.referencesLength = l
  }

  addRefToWatchedVideoVo(vo) {
    vo.currentRefIndexs.forEach(index => {
      vo.watchedRefs.add(index)
      console.log('watched', index);
    })
  }

  incrementRefIndex(vo, amount = 1, callback) {
    let _refs = vo.currentRefIndexs
    let _firstRefIndex = _refs[_refs.length - 1] + 1
    vo.currentRefIndexs = [...Array(amount).keys()]
      .map(i => {
        return i + _firstRefIndex
      }).filter(index => {
        //make all the indexs greater than the length false
        return (index < vo.referencesLength)
      })

    //too many, so do something, will already be finishing the last, no time
    if (!vo.currentRefIndexs.length) {
      callback(vo)
    }
  }

  isAtLastRef(vo) {
    let { currentRefIndexs, referencesLength } = vo
    let _lastRefIndex = currentRefIndexs[currentRefIndexs.length - 1]
    return (_lastRefIndex === referencesLength - 1)
  }


  //*****
  //PRIVATE
  //*****

  _getPlayedVideoVo(uuid) {
    let _vo = this._controller._getPlayedVideoVo(uuid)
    if (!_vo) {
      _vo = generateVideoVo(uuid)
      this._controller._setPlayedVideoVo(uuid, _vo)
    }
    return _vo
  }


  //***************
  // SIDX 
  //***************

  getMediaSourceVo(manifest, vo, options = {}) {
    let { sidx } = manifest
    let { references } = sidx
    if (!manifest || !sidx) {
      let _err = new Error('No Manifest')
      _err.name = ERROR_TYPES.VIDEO_VO
      throw _err
      return
    }
    let { currentRefIndexs } = vo
    let startIndex = currentRefIndexs[0] || 0
    let endIndex = currentRefIndexs[currentRefIndexs.length - 1]
    let sRef = references[startIndex]
    let eRef = references[endIndex]
    var size = 0;
    var duration = 0;
    for (var j = startIndex; j <= endIndex; j++) {
      duration += references[j]['durationSec'];
      size += references[j].size;
    }
    var brEnd = (parseInt(eRef['mediaRange'].split('-')[1], 10));
    var brMax = brEnd;
    var videoVo = {};
    videoVo['url'] = manifest['url'] || manifest.baseUrl;
    videoVo['byteRange'] = sRef['mediaRange'].split('-')[0] + '-' + brEnd;
    videoVo['byteLength'] = size;
    videoVo['codecs'] = manifest['codecs'];
    videoVo['firstOffset'] = sidx['firstOffset'];
    videoVo.indexRange = manifest.indexRange;
    videoVo.indexLength = sidx.firstOffset;
    videoVo['timestampOffset'] = sRef['startTimeSec'];
    videoVo['duration'] = duration;
    /*_.forIn(options, (val, key) => {
      videoVo[key] = val;
    })
    if(!manifest.youtubeDl){
      videoVo.url += '&range=' + videoVo.byteRange;
    }
    console.log(videoVo);*/
    videoVo.videoId = manifest.videoId;
    videoVo.id = manifest.id || videoVo.videoId
    videoVo.indexUrl = videoVo.url + `?range=${videoVo.indexRange}`
    videoVo.rangeUrl = videoVo.url + `?range=${videoVo.byteRange}`
    return videoVo;
  }


  getManifestUrl(manifest) {
    return manifest.url
  }

  getManifestIndexRange(manifest) {
    return manifest.indexRange
  }


}

export default VideoVOUtils