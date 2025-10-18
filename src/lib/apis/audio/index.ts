import { AUDIO_API_BASE_URL } from '$lib/constants';

export const getAudioConfig = async (token: string) => {
	let error = null;

	const res = await fetch(`${AUDIO_API_BASE_URL}/config`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

type OpenAIConfigForm = {
	url: string;
	key: string;
	model: string;
	speaker: string;
};

export const updateAudioConfig = async (token: string, payload: OpenAIConfigForm) => {
	let error = null;

	const res = await fetch(`${AUDIO_API_BASE_URL}/config/update`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			...payload
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			console.error(err);
			error = err.detail;
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const transcribeAudio = async (token: string, file: File, language?: string) => {
	const data = new FormData();
	data.append('file', file);
	if (language) {
		data.append('language', language);
	}

	let error = null;
	const res = await fetch(`${AUDIO_API_BASE_URL}/transcriptions`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			authorization: `Bearer ${token}`
		},
		body: data
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);
			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const synthesizeOpenAISpeech = async (
	token: string = '',
	speaker: string = 'alloy',
	text: string = '',
	model?: string
) => {
	let error = null;

	const res = await fetch(`${AUDIO_API_BASE_URL}/speech`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			input: text,
			voice: speaker,
			...(model && { model })
		})
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res;
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);

			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

interface AvailableModelsResponse {
	models: { name: string; id: string }[] | { id: string }[];
}

export const getModels = async (token: string = ''): Promise<AvailableModelsResponse> => {
	let error = null;

	const res = await fetch(`${AUDIO_API_BASE_URL}/models`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);

			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

export const getVoices = async (token: string = '') => {
	let error = null;

	const res = await fetch(`${AUDIO_API_BASE_URL}/voices`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}
	})
		.then(async (res) => {
			if (!res.ok) throw await res.json();
			return res.json();
		})
		.catch((err) => {
			error = err.detail;
			console.error(err);

			return null;
		});

	if (error) {
		throw error;
	}

	return res;
};

/**
 * Creates a WebSocket connection for real-time speech-to-text transcription using Azure Speech Service
 * @param token - Authentication token
 * @param onPartialResult - Callback for partial transcription results
 * @param onFinalResult - Callback for final transcription results
 * @param onError - Callback for errors
 * @param apiKey - Azure Speech API key
 * @param region - Azure region (default: 'eastus')
 * @param language - Language code (default: 'nl-NL')
 * @returns Object with methods to control the WebSocket connection
 */
export const createRealtimeTranscriptionStream = (
	token: string,
	onPartialResult: (text: string) => void,
	onFinalResult: (text: string) => void,
	onError: (error: string) => void,
	apiKey: string = 'beNKOhW4yokhToiUY0yc0pQc84Ag0ulHCtrw3jVIjxogVuP4VNVRJQQJ99BJACfhMk5XJ3w3AAAYACOG3R7c',
	region: string = 'swedencentral',
	language: string = 'nl-NL'
) => {
	const wsUrl = AUDIO_API_BASE_URL.replace('http', 'ws') + '/transcriptions/stream';
	let ws: WebSocket | null = null;
	let isReady = false;

	const connect = () => {
		return new Promise<void>((resolve, reject) => {
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				console.log('🎤 Real-time transcription WebSocket connected');
				// Send initialization message
				ws?.send(
					JSON.stringify({
						type: 'init',
						api_key: apiKey,
						region: region,
						language: language
					})
				);
			};

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					switch (data.type) {
						case 'ready':
							console.log('✅ Real-time transcription ready');
							isReady = true;
							resolve();
							break;

						case 'partial':
							console.log('📝 Partial transcription:', data.text);
							onPartialResult(data.text);
							break;

						case 'final':
							console.log('✅ Final transcription:', data.text);
							onFinalResult(data.text);
							break;

						case 'error':
							console.error('❌ Transcription error:', data.message);
							onError(data.message);
							reject(new Error(data.message));
							break;

						default:
							console.log('Unknown message type:', data.type);
					}
				} catch (error) {
					console.error('Error parsing WebSocket message:', error);
					onError('Failed to parse server message');
				}
			};

			ws.onerror = (error) => {
				console.error('❌ WebSocket error:', error);
				onError('WebSocket connection error');
				reject(error);
			};

			ws.onclose = () => {
				console.log('🔌 Real-time transcription WebSocket closed');
				isReady = false;
			};
		});
	};

	const sendAudio = (audioData: ArrayBuffer) => {
		if (ws && ws.readyState === WebSocket.OPEN && isReady) {
			ws.send(audioData);
		} else {
			console.warn('WebSocket not ready, cannot send audio');
		}
	};

	const stop = () => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'stop' }));
			ws.close();
		}
		ws = null;
		isReady = false;
	};

	const isConnected = () => {
		return ws !== null && ws.readyState === WebSocket.OPEN && isReady;
	};

	return {
		connect,
		sendAudio,
		stop,
		isConnected
	};
};
