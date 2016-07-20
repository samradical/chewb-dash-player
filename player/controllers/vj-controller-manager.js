import Q from 'bluebird';
import _ from 'lodash';

import Utils from '../utils/utils';
import Emitter from '../utils/emitter';

class ControllerManager {

    constructor(controllers) {
        this._controllers = controllers

        this._controllers.forEach(controller=>{
            if(controller.options.autoPlay){
                controller.addVo()
            }
            let _masterId = controller.options.isSlave
            if(_masterId){
                let _master = this._findById(_masterId)
                _master.addSlave(controller)
            }
        })
        Emitter.on('controller:srt:nextSub', (sub) => {
            this._onNextSub(sub)
        })
        this._init()
    }

    _findById(id){
        let _c = this._controllers.filter(con=>{
            return con.options.id === id
        })
        return _c[0]
    }

    _onNextSub(sub) {
        //this._videoController.nextVideo(sub)
    }

    _init() {}

}

export default ControllerManager;