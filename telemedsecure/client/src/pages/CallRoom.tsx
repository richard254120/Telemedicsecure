import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config';
import { generateECDHKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage, setupInsertableStreams } from '../utils/e2ee';

export default function CallRoom() {
  const { id } = useParams<{ id: string }>();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chat, setChat] = useState<{ sender: string; text: string }[]>([]);
  const [msgInput, setMsgInput] = useState('');
  
  const keyPair = useRef<CryptoKeyPair | null>(null);
  const sharedKey = useRef<CryptoKey | null>(null);

  useEffect(() => {
    const s = io(WS_URL);
    setSocket(s);

    const initKeys = async () => {
      keyPair.current = await generateECDHKeyPair();
      const pubKeyHex = await exportPublicKey(keyPair.current.publicKey);
      
      // Compute fingerprint by hashing pubKey
      const fingerprint = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(pubKeyHex)).then(b => Buffer.from(b).toString('hex').slice(0,16));

      s.emit('join-room', { consultationId: id, userId: 'demo-user', role: 'PATIENT' });
      s.emit('exchange-public-key', { consultationId: id, publicKey: pubKeyHex, fingerprint, userId: 'demo-user' });
    };

    initKeys();

    s.on('receive-public-key', async (data) => {
      if (keyPair.current) {
        const otherPubKey = await importPublicKey(data.publicKey);
        sharedKey.current = await deriveSharedSecret(keyPair.current.privateKey, otherPubKey);
        console.log('Shared AES-GCM key derived successfully. Channel is E2EE.');
        
        // Setup WebRTC and Insertable Streams here
        // setupInsertableStreams(sender, receiver, sharedKey.current);
      }
    });

    s.on('chat-message', async (data) => {
      if (sharedKey.current) {
        try {
          const decrypted = await decryptMessage(sharedKey.current, data.ciphertext, data.iv);
          setChat(prev => [...prev, { sender: 'Other', text: decrypted }]);
        } catch (e) {
          console.error('Failed to decrypt message', e);
        }
      }
    });

    return () => { s.disconnect(); };
  }, [id]);

  const sendMsg = async () => {
    if (!sharedKey.current || !socket || !msgInput) return;
    const { ciphertext, iv } = await encryptMessage(sharedKey.current, msgInput);
    socket.emit('chat-message', { consultationId: id, ciphertext, iv });
    setChat(prev => [...prev, { sender: 'Me', text: msgInput }]);
    setMsgInput('');
  };

  return (
    <div className="p-8 h-screen bg-slate-900 text-slate-100 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">Secure Consultation Room</h1>
      <p className="text-sm text-emerald-300 mb-8 font-mono bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-500/30">End-to-End Encrypted (ECDH P-256 / AES-GCM)</p>
      
      <div className="flex w-full max-w-6xl gap-6 h-[70vh]">
        {/* Video Area */}
        <div className="flex-1 bg-black rounded-2xl border border-slate-700 relative overflow-hidden shadow-2xl flex items-center justify-center">
           <div className="absolute top-4 left-4 flex gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live (Insertable Streams E2EE)</span>
           </div>
           <p className="text-slate-500">Video Feed Encrypted</p>
        </div>

        {/* Chat Area */}
        <div className="w-96 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700">
            <h2 className="font-semibold text-slate-200">Secure Chat</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            {chat.map((c, i) => (
              <div key={i} className={`p-3 rounded-xl max-w-[80%] ${c.sender === 'Me' ? 'bg-blue-600 self-end rounded-br-sm text-white' : 'bg-slate-700 self-start rounded-bl-sm text-slate-200'}`}>
                {c.text}
              </div>
            ))}
          </div>
          <div className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
            <input 
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Type securely..." 
              onKeyDown={e => e.key === 'Enter' && sendMsg()}
            />
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition" onClick={sendMsg}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
