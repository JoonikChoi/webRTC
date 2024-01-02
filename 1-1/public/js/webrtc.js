import { io } from "socket.io-client";

const VERSION = "webRTC_V0" // 소켓 서버의 path와 일치시켜야 함
const config =
{
    iceServers: [
        {
          urls: "turn:x.xx.xxx.xxx",
          username: "username",
          credential: "password",
        }, // turn 서버 설정
        {
          urls: "stun:stun.l.google.com:19302",
        }, // stun 서버 설정
      ],
    };
const constraints = { audio: false, video: true }; // 비디오만 사용
const stream = await navigator.mediaDevices.getUserMedia(constraints); // 비디오 스트림 생성
document.getElementById("localVideo").srcObject = stream; // localVideo에 스트림 추가

// 아래는 peer connection 생성과 signaling을 위한 변수들
let pc = undefined;
let makingOffer = false;
let ignoreOffer = false;
let polite = false;

let socket = io("/", { transports: ["websocket"], path: `/${VERSION}` }); // socket 서버에 연결

socket.on("connect", () => {
    console.log("Connected to server");
}); // 연결되면 로그 출력

socket.on("disconnect", () => {
    console.log("Disconnected from server");
}); // 연결이 끊기면 로그 출력

socket.on("webrtc:signaling", async (signalMessage) => { // 소켓서버로 부터 webrtc:signaling 이벤트를 받을 때
    console.log("Signal received: ", signalMessage); // 로그 출력
    try {
        if (signalMessage.type === 'offer' || signalMessage.type === 'answer') { // 받은 메세지가 offer 혹은 answer를 라면
            if (!pc && signalMessage.type === 'offer') pc = await createPeerConnection(); // pc가 없고 offer를 받았다면 pc를 생성
            
            const description = signalMessage.data;
            const offerCollision =
                description.type === "offer" &&
                (makingOffer || pc.signalingState !== "stable");
            // offer를 받았는데 makingOffer가 true거나 pc의 signalingState가 stable이 아니라면
            // offerCollision을 true로 설정 (오퍼 충돌이 일어났다는 뜻)

            ignoreOffer = !polite && offerCollision;
            if (ignoreOffer) {
                return;
            } // polite가 false이고 offerCollision이 true라면 ignoreOffer를 true로 설정.
              // 즉 polite는 어느 피어가 offer를 보낼지 결정하는 변수

            await pc.setRemoteDescription(description);
            if (description.type === "offer") {

                await pc.setLocalDescription();
                let signalMessage = {
                    type: pc.localDescription.type,
                    data: pc.localDescription
                }
                socket.emit("webrtc:signaling", signalMessage);
            }
        } else if (signalMessage.type === 'candidate') {
            const candidate = new RTCIceCandidate(signalMessage.data);
            try {
                await pc.addIceCandidate(candidate);
            } catch (err) {
                if (!ignoreOffer) {
                    throw err;
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
});

const createPeerConnection = async () => { // peer connection 생성

    const pc = new RTCPeerConnection(config); // config에 따른 peer connection 생성

    for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
    } // stream의 track들을 peer connection에 추가. 근데 이 경우 stream은 하나의 track만 가지고 있음

    // 아래는 모두 peer connection의 이벤트 핸들러들을 등록하는 과정
    pc.onnegotiationneeded = async () => { // negotiation이 필요할 때 (offer 보내야 할 때)
        try {
            makingOffer = true;
            await pc.setLocalDescription(); // local description 설정
            let signalMessage = {
                type: pc.localDescription.type,
                data: pc.localDescription
            } // local description을 signalMessage로 만들어서
            socket.emit("webrtc:signaling", signalMessage); // 소켓서버로 보냄
        } catch (err) {
            console.error(err);
        } finally {
            makingOffer = false;
        }
    };

    pc.onicecandidate = ({ candidate }) => { // ice candidate가 생성되면
        if (candidate) {
            let signalMessage = {
                type: 'candidate',
                data: candidate
            } // candidate를 signalMessage로 만들어서
            socket.emit("webrtc:signaling", signalMessage); // 소켓서버로 보냄
        }
    };

    pc.ontrack = (event) => { // 다른 피어로 부터 track이 도착하면
        document.getElementById("remoteVideo").srcObject = event.streams[0]; // remoteVideo에 track을 추가
    };

    return pc;
}

document.getElementById("startBtn").addEventListener("click", async () => {
    pc = await createPeerConnection();
    polite = true;
}); // start 버튼을 누르면 peer connection 생성, polite를 true로 설정
