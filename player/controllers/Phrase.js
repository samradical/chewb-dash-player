import _ from 'lodash';
import Utils from '../utils/utils';
import VjUtils from '../vj-utils';
class PhraseHelper {
    constructor() {
        this._phrases = []
    }

    chooseSubs(subs, number = 2, startWithNewSentence = true) {
        //combine all the subs together
        let _subs = []
        _.each(subs, sub => {
            let _copy = sub.subs.slice(0)
            _subs = [..._subs, ..._copy]
            _copy.length = 0
            _copy = null
        })
        Utils.shuffle(_subs)
        let _chosen = []
        for (var i = 0; i < _subs.length; i++) {
            let _s = _subs[i]
            if (_chosen.length === 0) {
                if (startWithNewSentence) {
                    if (_s.isNewSentence) {
                        this._sliceSubIfUnused(_subs, _chosen, _s)
                    }
                } else {
                    this._sliceSubIfUnused(_subs, _chosen, _s)
                }
            } else {
                let _lastestFound = _chosen[_chosen.length - 1]
                let _nextSequential = this._findNextSequentialSub(subs, _lastestFound)
                if (_nextSequential) {
                    _chosen.push(_nextSequential)
                }
            }
            if (_chosen.length >= number) {
                break;
            }
        }
        _subs.length = 0
        _subs = null
        return _chosen
    }

    matchSubsToSidxReferences(subs, sidxs) {
        if (this._phrases.length) {
            return this._phrases.shift()
        }
        let _phrase = []
        _.each(subs, (sub, i) => {
            let _sidx = sidxs[i]
            let _references = _sidx.sidx.references

            let _subPhrase = {
                seekValue: undefined,
                duration: undefined,
                vo: undefined,
                refIndexs: [], //temp
            }

            _.each(_references, ref => {
                let _refS = ref.startTimeSec
                let _refD = ref.durationSec
                let _refE = _refS + _refD

                let _subS = sub.startTime
                let _subE = sub.endTime

                let _firstRefIndex
                if (_subS > _refS && _subS < _refE) {
                    _firstRefIndex = _references.indexOf(ref)
                        //***** make sure it is valid
                    _firstRefIndex = (_firstRefIndex < 0 || _firstRefIndex > _references.length - 2) ?
                        0 : _firstRefIndex

                    _subPhrase.refIndexs.push(_firstRefIndex)

                    _subPhrase.seekValue = _subS - _refS
                    _subPhrase.duration = sub.duration
                }

                let _nextRef = _references[_firstRefIndex + 1]
                if (_nextRef) {
                    if (_subE > _nextRef.startTimeSec) {
                        _subPhrase.refIndexs.push(_references.indexOf(_nextRef))
                    }
                }
            })

            _subPhrase.vo = VjUtils.combineRefs(_sidx,
                _subPhrase.refIndexs[0] || 0,
                _subPhrase.refIndexs[_subPhrase.refIndexs.length - 1] || 1, {
                    videoId: sub.videoId,
                    seekValue: _subPhrase.seekValue
                }
            )

            sub.used = true;

            _phrase.push(_subPhrase)
        })
        this._phrases = [..._phrase]
        return this._phrases.shift()
    }

    get phrases() {
        return this._phrases
    }

    _findNextSequentialSub(subs, targetSub) {
        let _toFind
        _.each(subs, sub => {
            let _exist = sub.subs.indexOf(targetSub)
            if (_exist > -1) {
                _toFind = sub.subs[_exist + 1]
            }
        })
        return _toFind
    }

    _sliceSubIfUnused(source, target, sub) {
        if (!sub.used) {
            let _i = source.indexOf(sub)
            target.push(source.slice(_i, _i + 1)[0])
        }
    }
}

export default PhraseHelper