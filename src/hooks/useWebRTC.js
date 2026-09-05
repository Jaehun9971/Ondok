import { useEffect, useRef, useState } from 'react'
import {
  addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export default function useWebRTC({ roomId, myUid, memberIds, localStream }) {
  const peersRef = useRef(new Map())
  const [remoteStreams, setRemoteStreams] = useState({})

  useEffect(() => {
    if (!roomId || !myUid) return undefined
    const remoteIds = (memberIds || []).filter((id) => id !== myUid)

    for (const [uid, peer] of peersRef.current) {
      if (!remoteIds.includes(uid)) {
        peer.unsubscribers.forEach((unsubscribe) => unsubscribe())
        peer.pc.close()
        peersRef.current.delete(uid)
        setRemoteStreams((previous) => {
          const next = { ...previous }
          delete next[uid]
          return next
        })
      }
    }

    remoteIds.forEach((remoteUid) => {
      if (peersRef.current.has(remoteUid)) return
      const pair = [myUid, remoteUid].sort()
      const initiator = pair[0] === myUid
      const callRef = doc(db, 'rooms', roomId, 'calls', pair.join('_'))
      const ownCandidates = collection(callRef, initiator ? 'offerCandidates' : 'answerCandidates')
      const otherCandidates = collection(callRef, initiator ? 'answerCandidates' : 'offerCandidates')
      const pc = new RTCPeerConnection(rtcConfig)
      const pendingCandidates = []
      let handledOffer = null
      let makingOffer = false

      const transceiver = pc.addTransceiver('video', { direction: 'sendrecv' })
      const track = localStream?.getVideoTracks()[0]
      if (track) transceiver.sender.replaceTrack(track)

      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track])
        setRemoteStreams((previous) => ({ ...previous, [remoteUid]: stream }))
      }
      pc.onicecandidate = (event) => {
        if (event.candidate) addDoc(ownCandidates, event.candidate.toJSON())
      }

      const flushCandidates = async () => {
        while (pendingCandidates.length) await pc.addIceCandidate(pendingCandidates.shift())
      }

      const unsubscribeCall = onSnapshot(callRef, async (snapshot) => {
        const data = snapshot.data()
        if (!data) return
        try {
          if (!initiator && data.offer && data.offerId !== handledOffer) {
            handledOffer = data.offerId
            await pc.setRemoteDescription(data.offer)
            await flushCandidates()
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await setDoc(callRef, { answer: { type: answer.type, sdp: answer.sdp }, answerId: crypto.randomUUID() }, { merge: true })
          }
          if (initiator && data.answer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(data.answer)
            await flushCandidates()
          }
        } catch (error) {
          console.error('WebRTC 신호 처리 오류:', error)
        }
      })

      const unsubscribeCandidates = onSnapshot(otherCandidates, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== 'added') return
          const candidate = new RTCIceCandidate(change.doc.data())
          if (pc.remoteDescription) await pc.addIceCandidate(candidate)
          else pendingCandidates.push(candidate)
        })
      })

      const createOffer = async () => {
        if (!initiator || makingOffer) return
        makingOffer = true
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await setDoc(callRef, {
            participants: pair,
            offer: { type: offer.type, sdp: offer.sdp },
            offerId: crypto.randomUUID(),
            answer: null,
            updatedAt: serverTimestamp(),
          }, { merge: true })
        } finally { makingOffer = false }
      }

      peersRef.current.set(remoteUid, { pc, transceiver, unsubscribers: [unsubscribeCall, unsubscribeCandidates], createOffer })
      if (initiator) createOffer()
    })

    return undefined
  }, [roomId, myUid, memberIds, localStream])

  useEffect(() => {
    const track = localStream?.getVideoTracks()[0] || null
    peersRef.current.forEach(({ transceiver }) => transceiver.sender.replaceTrack(track))
  }, [localStream])

  useEffect(() => () => {
    peersRef.current.forEach(({ pc, unsubscribers }) => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      pc.close()
    })
    peersRef.current.clear()
  }, [])

  return remoteStreams
}
