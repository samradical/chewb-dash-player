import Video from './video'
import Config from './config'
import Socket from './socket'

class AudioTrack extends Component {

	constructor(props) {}

	componentDidMount() {

		this._player = new Video({ el: el, socket: Socket.localsocket })
		this._player.addSource(config)
		this._player.start()

		this._player.on('MEDIASOURCE_STATE', (state) => {})

		//the playlist items
		this._player.on('PLAYLIST', (items) => {})

		//a new vo chunk has been added
		this._player.on('VO_ADDED', (vo, msVo) => {})

		//over
		this._player.on('VIDEO_FINISHED', (item) => {})
	}

	//youtube query items []
	onInputQuery(results) {
		this.controller.addPlaylistItems(results)
	}

	//***********
	//UI API
	//***********

	//id exists in player
	_removeVideoFromQueue(videoId) {
		this.controller.removeIdFromPlaylist(videoId)
	}

	//add a new id
	_moveVideoToFrontQueue(videoId, item) {
		this.controller.moveToFrontPlaylist(videoId, item)
	}

	get controller() {
		return this._player.vjPlayer.controllers[0]
	}

	get mediasource() {
		return this._player.vjPlayer.mediaSources[0][0]
	}
}
