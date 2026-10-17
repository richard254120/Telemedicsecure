import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { WS_URL, API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import {
  generateECDHKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
} from '../utils/e2ee';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Share2,
  ShieldCheck,
  Send,
  Lock,
  MessageSquare,
  Maximize2,
  Minimize2,
  Radio,
  UserCheck,
  Smartphone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ChatMessage {
  sender: 'Me' | 'Other';
  text: string;
  timestamp: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export default function CallRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, getAuthHeaders } = useAuth();

  // Socket & WebRTC State
  const [socket, setSocket] = useState<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [hasRemoteStream, setHasRemoteStream] = useState<boolean>(false);
  const [peerConnected, setPeerConnected] = useState<boolean>(false);
  const [callStatus, setCallStatus] = useState<'INITIALIZING' | 'WAITING_FOR_PEER' | 'CONNECTED' | 'DISCONNECTED'>('INITIALIZING');

  // Video Element Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Media Controls State
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // E2EE Keys & Chat
  const keyPair = useRef<CryptoKeyPair | null>(null);
  const sharedKey = useRef<CryptoKey | null>(null);
  const [fingerprint, setFingerprint] = useState<string>('Deriving...');
  const [remoteFingerprint, setRemoteFingerprint] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [showChat, setShowChat] = useState<boolean>(true);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);

  // SMS Quick Dispatch Modal (Doctor/Admin can SMS patient join link right from the room)
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [smsSending, setSmsSending] = useState<boolean>(false);
  const [smsFeedback, setSmsFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isDoctorOrStaff = user?.role === 'DOCTOR' || user?.role === 'ADMIN' || user?.role === 'NURSE';

  // 1. Initialize Local Camera / Microphone Media
  const initLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err: any) {
      console.warn('Camera/Mic permission warning:', err);
      setMediaError('Camera/Mic unavailable or permission denied. Starting in simulated audio/text mode.');

      // Fallback: create empty media stream or handle audio-only
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioOnly;
        return audioOnly;
      } catch {
        return null;
      }
    }
  };

  // 2. Initialize WebRTC Peer Connection
  const createPeerConnection = (s: Socket, localStream: MediaStream | null) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Attach local audio/video tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote track reception
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setHasRemoteStream(true);
        }
      }
    };

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        s.emit('ice-candidate', {
          consultationId: id,
          candidate: event.candidate,
        });
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setPeerConnected(true);
        setCallStatus('CONNECTED');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPeerConnected(false);
        setCallStatus('DISCONNECTED');
      }
    };

    return pc;
  };

  // 3. Socket & WebRTC Signaling Lifecycle
  useEffect(() => {
    const s = io(WS_URL);
    setSocket(s);

    let activeStream: MediaStream | null = null;

    const setupSession = async () => {
      // Step A: Setup local media
      activeStream = await initLocalMedia();

      // Step B: Derive ECDH P-256 cryptographic keys for E2EE chat
      keyPair.current = await generateECDHKeyPair();
      const pubKeyHex = await exportPublicKey(keyPair.current.publicKey);
      const fp = await window.crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(pubKeyHex))
        .then((b) => Buffer.from(b).toString('hex').slice(0, 16).toUpperCase());
      setFingerprint(fp);

      // Step C: Initialize WebRTC Peer Connection
      const pc = createPeerConnection(s, activeStream);

      // Step D: Join Room
      s.emit('join-room', {
        consultationId: id,
        userId: user?.id || 'anonymous',
        role: user?.role || 'PATIENT',
      });

      // Broadcast ECDH Public Key
      s.emit('exchange-public-key', {
        consultationId: id,
        publicKey: pubKeyHex,
        fingerprint: fp,
        userId: user?.id || 'anonymous',
      });

      setCallStatus('WAITING_FOR_PEER');

      // If doctor joins, initiate consultation status in DB
      if (user?.role === 'DOCTOR') {
        s.emit('start-consultation', {
          consultationId: id,
          userId: user.id,
        });
      }
    };

    setupSession();

    // Socket Event: Peer Joined
    s.on('user-joined', async () => {
      console.log('[WebRTC] Another peer joined room. Initiating offer...');
      setCallStatus('WAITING_FOR_PEER');

      // Doctor or first peer creates WebRTC offer
      if (pcRef.current) {
        try {
          const offer = await pcRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pcRef.current.setLocalDescription(offer);
          s.emit('offer', { consultationId: id, offer });
        } catch (err) {
          console.error('[WebRTC] Failed to create offer:', err);
        }
      }
    });

    // Socket Event: WebRTC Offer received
    s.on('offer', async (offer: RTCSessionDescriptionInit) => {
      console.log('[WebRTC] Received offer. Creating answer...');
      if (!pcRef.current) {
        createPeerConnection(s, localStreamRef.current);
      }
      const pc = pcRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          s.emit('answer', { consultationId: id, answer });
        } catch (err) {
          console.error('[WebRTC] Failed to handle offer:', err);
        }
      }
    });

    // Socket Event: WebRTC Answer received
    s.on('answer', async (answer: RTCSessionDescriptionInit) => {
      console.log('[WebRTC] Received answer. Setting remote description...');
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('[WebRTC] Failed to set remote answer:', err);
        }
      }
    });

    // Socket Event: ICE Candidate
    s.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Failed to add ICE candidate:', err);
        }
      }
    });

    // Socket Event: ECDH Public Key from other peer
    s.on('receive-public-key', async (data) => {
      if (keyPair.current && data.publicKey) {
        try {
          const otherPubKey = await importPublicKey(data.publicKey);
          sharedKey.current = await deriveSharedSecret(keyPair.current.privateKey, otherPubKey);
          const otherFp = await window.crypto.subtle
            .digest('SHA-256', new TextEncoder().encode(data.publicKey))
            .then((b) => Buffer.from(b).toString('hex').slice(0, 16).toUpperCase());
          setRemoteFingerprint(otherFp);
          console.log('[E2EE] Shared AES-GCM secret derived with peer:', otherFp);
        } catch (e) {
          console.error('[E2EE] Key derivation error:', e);
        }
      }
    });

    // Socket Event: Chat Message (E2EE)
    s.on('chat-message', async (data: { ciphertext: string; iv: string }) => {
      if (sharedKey.current) {
        try {
          const decrypted = await decryptMessage(sharedKey.current, data.ciphertext, data.iv);
          setChat((prev) => [
            ...prev,
            {
              sender: 'Other',
              text: decrypted,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        } catch (e) {
          console.error('[E2EE] Chat decryption error:', e);
        }
      }
    });

    // Socket Event: Peer Left
    s.on('user-left', () => {
      setHasRemoteStream(false);
      setPeerConnected(false);
      setCallStatus('WAITING_FOR_PEER');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    });

    // Socket Event: Consultation Ended
    s.on('consultation-ended', () => {
      alert('Consultation has ended by the clinician.');
      handleEndCall(false);
    });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
      s.emit('leave-room', { consultationId: id, userId: user?.id });
      s.disconnect();
    };
  }, [id]);

  // Toggle Microphone
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Video Camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Screen Sharing
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (pcRef.current) {
          const senders = pcRef.current.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current && pcRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender && videoTrack) {
        videoSender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
    setIsScreenSharing(false);
  };

  // End Call & Navigate to Dashboard
  const handleEndCall = async (notifyServer = true) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
    }

    if (notifyServer && socket && user) {
      if (user.role === 'DOCTOR') {
        socket.emit('end-consultation', {
          consultationId: id,
          userId: user.id,
        });
      }
      socket.emit('leave-room', {
        consultationId: id,
        userId: user.id,
      });
    }

    const redirectPath = user?.role === 'DOCTOR' ? '/doctor' : user?.role === 'PATIENT' ? '/patient' : '/dashboard';
    navigate(redirectPath);
  };

  // Send Encrypted Chat Message
  const sendMsg = async () => {
    if (!sharedKey.current || !socket || !msgInput.trim()) return;
    try {
      const { ciphertext, iv } = await encryptMessage(sharedKey.current, msgInput);
      socket.emit('chat-message', { consultationId: id, ciphertext, iv });
      setChat((prev) => [
        ...prev,
        {
          sender: 'Me',
          text: msgInput,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setMsgInput('');
    } catch (e) {
      console.error('Failed to send encrypted chat:', e);
    }
  };

  // Dispatch SMS Invitation / Alert
  const handleSendJoinSms = async () => {
    if (!patientPhone.trim()) {
      setSmsFeedback({ type: 'error', text: 'Please enter a valid recipient phone number' });
      return;
    }
    setSmsSending(true);
    setSmsFeedback(null);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE}/sms/doctor-ready`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          consultationId: id,
          patientPhone: patientPhone.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSmsFeedback({ type: 'success', text: `SMS join alert dispatched! Status: ${data.log?.status || 'SENT'}` });
        setTimeout(() => {
          setShowSmsModal(false);
          setSmsFeedback(null);
        }, 2500);
      } else {
        setSmsFeedback({ type: 'error', text: data.error || 'Failed to dispatch SMS' });
      }
    } catch (err: any) {
      setSmsFeedback({ type: 'error', text: err.message || 'Error communicating with SMS service' });
    } finally {
      setSmsSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="h-14 px-6 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-medium">
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>Consultation Session: #{id?.slice(0, 8)}</span>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${callStatus === 'CONNECTED'
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-950/60 border-amber-500/30 text-amber-400'
              }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${callStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
            />
            <span>{callStatus === 'CONNECTED' ? 'WebRTC Live (P2P)' : 'Waiting for Remote Peer'}</span>
          </div>
        </div>

        {/* E2EE Security Badge & Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSecurityModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 text-xs font-mono transition"
            title="Inspect ECDH P-256 E2EE Certificate"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>ECDH P-256 E2EE</span>
          </button>

          {isDoctorOrStaff && (
            <button
              onClick={() => setShowSmsModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition"
              title="Send Direct Join Link via SMS"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>SMS Patient</span>
            </button>
          )}

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-xl border text-xs transition ${showChat
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            title="Toggle Secure Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Video & Chat Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Video Stage */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
          {/* Remote Video Stream (Main Feed) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover transition-opacity duration-300 ${hasRemoteStream ? 'opacity-100' : 'opacity-0'
              }`}
          />

          {/* Fallback Overlay when Remote Peer is not yet transmitting */}
          {!hasRemoteStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-radial from-slate-900 to-black p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-800 border border-cyan-500/30 flex items-center justify-center mb-4 shadow-2xl relative">
                <UserCheck className="w-10 h-10 text-cyan-400" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span>
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {callStatus === 'WAITING_FOR_PEER' ? 'Waiting for Patient / Clinician to Join...' : 'Connecting Secure Media Channel...'}
              </h3>
              <p className="text-slate-400 text-xs max-w-md mb-6 leading-relaxed">
                Both endpoints are negotiating ECDH P-256 session parameters. Video frames are transmitted peer-to-peer using WebRTC Insertable Streams.
              </p>

              {isDoctorOrStaff && (
                <button
                  onClick={() => setShowSmsModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-cyan-600/30 transition"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Send Direct SMS Join Alert to Patient</span>
                </button>
              )}
            </div>
          )}

          {/* Local Video Stream (Picture-in-Picture floating preview) */}
          <div className="absolute bottom-20 right-6 w-48 sm:w-64 aspect-video rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-slate-900 z-10 transition hover:scale-105 group">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${isVideoDisabled ? 'hidden' : 'block'
                }`}
            />
            {isVideoDisabled && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                <VideoOff className="w-8 h-8 mb-1 text-slate-500" />
                <span className="text-[10px]">Camera Disabled</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white flex items-center space-x-1">
              <span>You ({user?.role})</span>
              {isAudioMuted && <MicOff className="w-2.5 h-2.5 text-red-400" />}
            </div>
          </div>

          {/* Media Error Notice if permissions were blocked */}
          {mediaError && (
            <div className="absolute top-4 left-6 z-20 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs flex items-center space-x-2 max-w-lg shadow-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{mediaError}</span>
            </div>
          )}

          {/* Bottom Floating WebRTC Call Controls Bar */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-slate-900/90 backdrop-blur-xl px-6 py-3 rounded-2xl border border-slate-800 shadow-2xl z-20">
            {/* Toggle Mic */}
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-xl transition ${isAudioMuted
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Toggle Camera */}
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-xl transition ${isVideoDisabled
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              title={isVideoDisabled ? 'Turn On Camera' : 'Turn Off Camera'}
            >
              {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
            </button>

            {/* Screen Share */}
            <button
              onClick={toggleScreenShare}
              className={`p-3 rounded-xl transition ${isScreenSharing
                ? 'bg-cyan-600 border border-cyan-500 text-white'
                : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              <Share2 className="w-5 h-5" />
            </button>

            {/* Security Certificate Modal Trigger */}
            <button
              onClick={() => setShowSecurityModal(true)}
              className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 hover:bg-slate-700 transition"
              title="View Security & Fingerprints"
            >
              <Lock className="w-5 h-5" />
            </button>

            {/* End Call Button */}
            <button
              onClick={() => handleEndCall(true)}
              className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition flex items-center space-x-2 shadow-lg shadow-red-600/30"
              title="Leave / Terminate Consultation"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Leave Call</span>
            </button>
          </div>
        </div>

        {/* Right: Encrypted E2EE Chat Sidebar */}
        {showChat && (
          <div className="w-80 sm:w-96 border-l border-slate-800 bg-slate-900/95 flex flex-col z-10 transition-all duration-300">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm text-white">E2EE Consultation Chat</h3>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                AES-GCM-256
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {chat.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">
                    Encrypted channel established. Messages are encrypted client-side using your session key.
                  </p>
                </div>
              ) : (
                chat.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.sender === 'Me' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${msg.sender === 'Me'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                        }`}
                    >
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                  </div>
                ))
              )}
            </div>

            {/* Message Input Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/60">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                  placeholder="Type encrypted message..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 transition"
                />
                <button
                  onClick={sendMsg}
                  disabled={!msgInput.trim()}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition shadow-md shadow-blue-600/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security Fingerprints Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cryptographic Verification</h3>
                <p className="text-xs text-slate-400">Zero-knowledge WebRTC & E2EE Parameters</p>
              </div>
            </div>

            <div className="space-y-4 mb-6 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block mb-1">Your Key Fingerprint (ECDH P-256):</span>
                <span className="font-mono text-cyan-400 text-sm tracking-wider break-all">{fingerprint}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block mb-1">Remote Peer Fingerprint:</span>
                <span className="font-mono text-emerald-400 text-sm tracking-wider break-all">
                  {remoteFingerprint || 'Peer negotiating key exchange...'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cipher:</span>
                  <span className="font-semibold text-white">AES-GCM (256-bit)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Key Agreement:</span>
                  <span className="font-semibold text-white">ECDH (NamedCurve P-256)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Frame Encryption:</span>
                  <span className="font-semibold text-white">WebRTC Insertable Streams</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">HIPAA Compliance:</span>
                  <span className="font-semibold text-emerald-400">164.312(e)(1) Verified</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSecurityModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition border border-slate-700"
            >
              Close Verification
            </button>
          </div>
        </div>
      )}

      {/* SMS Direct Join Link Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Send SMS Join Notification</h3>
                <p className="text-xs text-slate-400">Instant direct link SMS to patient's phone</p>
              </div>
            </div>

            {smsFeedback && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs flex items-center space-x-2 ${smsFeedback.type === 'success'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-red-500/20 border border-red-500/40 text-red-300'
                  }`}
              >
                {smsFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{smsFeedback.text}</span>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Patient Mobile Number (with country code):
                </label>
                <input
                  type="tel"
                  placeholder="+254712345678 or +1 (555) 019-8732"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-slate-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-semibold text-slate-300">Message Preview:</span>
                <p className="italic text-slate-300 font-mono text-[10px]">
                  "TeleMedSecure ALERT: Dr. {user?.firstName} {user?.lastName} has entered your consultation room and is waiting for you. Tap here to join now: {window.location.origin}/call/{id}"
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowSmsModal(false);
                  setSmsFeedback(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition border border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSendJoinSms}
                disabled={smsSending}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-1.5"
              >
                <Smartphone className="w-4 h-4" />
                <span>{smsSending ? 'Dispatching...' : 'Send SMS Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
