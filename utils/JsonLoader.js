import _ from 'lodash'
import Q from 'bluebird'
import load from 'load-json-xhr'

const LOADJSON = Q.promisify(load)

const P = (() => {
  function load(paths) {
    return Q.map(paths, src => {
      return LOADJSON(src).then(json => {
        return json
      })
    }, {
      concurrency: 10
    }).then(results => {
      return results
    })
  }
  return { load, }
})()
export default P
