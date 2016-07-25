const Utils = {};
/*
options
all
duration: in seconds
*/
import _ from 'lodash';

Utils.vo = {
  url: undefined,
  byteRange: undefined,
  byteRangeMax: undefined,
  codecs: undefined,
  firstOffset: undefined,
  indexRange: undefined,
  indexRangeMax: undefined,
  timestampOffset: undefined,
  durationSec: undefined,
  videoId: undefined
};

const DEFAULTS = {
  duration: 5
}

let SERVICE_SERVER_BASE = window.SERVER_BASE || 'http://0.0.0.0:8080/'

/*
if its youtube make adjustment
*/
const MERGE_DATA = (vo, item) => {
  vo.url = item.url || item.baseUrl;
  vo.codecs = item.codecs;
  vo.videoId = item.videoId;
  vo.indexRange = item.indexRange;
  vo.indexLength = sidx.firstOffset;
  if (item.videoId) {
    vo.indexUrl = SERVER_BASE + 'getVideoIndex'
    vo.segmentUrl = SERVER_BASE + 'getVideo'
  } else {
  	vo.indexUrl = vo.url
  	vo.segmentUrl = vo.url
  }
  return vo
}

Utils.createVo = (data, options = {}) => {
  var startIndex = 0;
  var totalSegments = Math.floor(Math.random() * 3) + 1;
  var endIndex = Math.floor(Math.random() * 3) + 1;
  var duration = 0;
  if (!data.sidx) {
    return;
  }
  var references = data.sidx.references;

  startIndex = Math.floor(references.length / 2) - Math.ceil(totalSegments / 2);
  startIndex = Math.max(startIndex, 0);

  endIndex = startIndex + Math.max(Math.floor(totalSegments / 2), 1);

  if (options.all) {
    startIndex = 0;
    endIndex = references.length - 1;
  }
  //startIndex = 0;
  //endIndex = 1;
  var sRef = references[startIndex];
  var eRef = references[endIndex];
  var size = 0;
  for (var j = startIndex; j < endIndex; j++) {
    duration += references[j]['durationSec'];
    size += references[j].size;
  }
  var brEnd = (parseInt(eRef['mediaRange'].split('-')[0], 10) - 1);
  var brMax = brEnd + 1;
  var videoVo = {};
  videoVo['url'] = data['url'] || data['baseUrl'];
  videoVo['byteRange'] = sRef['mediaRange'].split('-')[0] + '-' + brEnd;
  videoVo['byteLength'] = size;
  videoVo['codecs'] = data['codecs'];
  videoVo['firstOffset'] = data.sidx['firstOffset'];
  videoVo['indexRange'] = data['indexRange'];
  videoVo['indexLength'] = Number(videoVo['indexRange'].split('-')[1]) + 1;
  videoVo['timestampOffset'] = sRef['startTimeSec'];
  videoVo['duration'] = duration;
  videoVo['id'] = options.videoId;
  return videoVo;
}

Utils.combineRefs = (data, startIndex, endIndex, options = {}) => {
  var references = data.sidx.references;
  var sRef = references[startIndex];
  var eRef = references[endIndex] || sRef;
  var size = 0;
  var duration = 0;
  for (var j = startIndex; j <= endIndex; j++) {
    duration += references[j]['durationSec'];
    size += references[j].size;
  }
  var brEnd = (parseInt(eRef['mediaRange'].split('-')[1], 10));
  var brMax = brEnd + 1;
  var videoVo = {};
  videoVo['url'] = data['url'];
  videoVo['byteRange'] = sRef['mediaRange'].split('-')[0] + '-' + brEnd;
  videoVo['byteLength'] = size;
  videoVo['codecs'] = data['codecs'];
  videoVo['firstOffset'] = data.sidx['firstOffset'];
  videoVo['indexRange'] = data['indexRange'];
  videoVo['indexLength'] = Number(videoVo['indexRange'].split('-')[1]) + 1;
  videoVo['timestampOffset'] = sRef['startTimeSec'];
  videoVo['duration'] = duration;
  _.forIn(options, (val, key) => {
    videoVo[key] = val;
  })
  if(!data.youtubeDl){
    videoVo.url += '&range=' + videoVo.byteRange;
  }
  videoVo.videoId = data.videoId;
  videoVo.id = data.id || videoVo.videoId
  return videoVo;
}

/*
{duration}
*/
Utils.voFromRef = (item, ref, options = DEFAULTS) => {
  let sidx = item.sidx
  let references = sidx.references
  let vo = _.clone(Utils.vo);
  let indexOf = references.indexOf(ref)
  vo.byteRange = ref.mediaRange;
  vo.byteLength = ref.size;
  vo.duration = ref.durationSec;
  vo.timestampOffset = ref.startTimeSec;
  vo.url = item.url || item.baseUrl;
  vo.codecs = item.codecs;
  vo.videoId = item.videoId;
  vo.id = item.id || vo.videoId
  vo.youtubeDl = item.youtubeDl
  vo.indexRange = item.indexRange;
  vo.indexLength = sidx.firstOffset;
  if(!vo.youtubeDl){
    vo.url += '&range=' + obj.byteRange;
  }
  /*if (item.videoId) {
    vo.indexUrl = SERVICE_SERVER_BASE + 'getVideoIndex'
    vo.segmentUrl = SERVICE_SERVER_BASE + 'getVideo'
  } else {
  	vo.indexUrl = vo.url
  	vo.segmentUrl = vo.url
  }*/
  return vo;
}

Utils.getReferenceVo = (item, refIndex) => {
  let sidx = item.sidx;
  let ref = sidx.references[refIndex];
  return Utils.voFromRef(sidx, ref)
}

Utils.getReferenceVoFromIndex = (item, refIndex) => {
  let sidx = item.sidx;
  let ref = sidx.references[refIndex];
  return Utils.voFromRef(sidx, ref)
}


export default Utils;
