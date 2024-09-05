let audioContext;
let processor;
let source;
let webSocket;
let audioStream;

// 512 samples 단위로 PCM 데이터 처리
const SAMPLE_SIZE = 512;
const SAMPLE_RATE = 16000;

async function initializeAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: SAMPLE_RATE,
        });
    }

    if (!audioStream) {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    source = audioContext.createMediaStreamSource(audioStream);
    processor = audioContext.createScriptProcessor(SAMPLE_SIZE, 1, 1);

    processor.onaudioprocess = audioProcess;
    
    source.connect(processor);
    processor.connect(audioContext.destination);
}

function audioProcess(event) {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        const output = new Int16Array(SAMPLE_SIZE);

        for (let i = 0; i < SAMPLE_SIZE; i++) {
            output[i] = Math.max(-1, Math.min(1, inputBuffer[i])) * 0x7FFF;
        }

        webSocket.send(output.buffer);
    }
}


document.getElementById('startRecording').addEventListener('click', async () => {
    await initializeAudio();

    //webSocket = new WebSocket('ws://13.124.62.252:8000/ws/audio');
    webSocket = new WebSocket('wss://robin-alert-lioness.ngrok-free.app/ws/audio');
    
    webSocket.onopen = () => {
        document.getElementById('startRecording').disabled = true;
        document.getElementById('stopRecording').disabled = false;
        statusElement.textContent = "Status: Connected to the server. Listening...";
    };

    const statusElement = document.getElementById('status');
    const conversationElement = document.getElementById('conversation');

    webSocket.onmessage = (event) => {
        const message = event.data;
        if (message.startsWith('status:')) {
            // 상태 메시지 처리
            const statusText = message.replace('status:', '');
            statusElement.textContent = `Status: ${statusText}`;
        } else if (message.startsWith('chat:')) {
            // 대화 메시지 처리
            const chatText = message.replace('chat:', '');
            const newMessageElement = document.createElement('div');
            newMessageElement.textContent = chatText;
            conversationElement.appendChild(newMessageElement);
            // conversationElement.insertBefore(newMessageElement, conversationElement.firstChild);
            statusElement.textContent = "Status: Listening...";
        }
    };

    webSocket.onclose = () => {
        // 스트림 및 프로세서 연결 해제
        processor.disconnect();
        source.disconnect();
        document.getElementById('startRecording').disabled = false;
        document.getElementById('stopRecording').disabled = true;
        statusElement.textContent = "Status: Disconnected from the server.";
    };
});

document.getElementById('stopRecording').addEventListener('click', () => {
    if (webSocket) {
        webSocket.close();
    }
    // 웹소켓 닫힌 후 프로세서 연결 해제
    processor.disconnect();
    source.disconnect();
});
