import _ from 'lodash';

const IndexBufferCache = new Map()
const MAX_CACHE = 100

const API = {
    copySetIndexBuffer(uuid, buffer){
        let _key = `${uuid}:indexBuffer`
        if(!IndexBufferCache.has(_key)){
            IndexBufferCache.set(_key, buffer.slice(0))
        }
        if(IndexBufferCache.size > MAX_CACHE){
            let _keys = IndexBufferCache.keys()
            IndexBufferCache.delete(_keys[0])
        }
    },
    getIndexBuffer(uuid){
        return IndexBufferCache.get(`${uuid}:indexBuffer`)
    }
}

export default API
