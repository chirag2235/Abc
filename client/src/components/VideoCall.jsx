import React, { useCallback, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import peer from "../services/peer";

const VideoCall = ({ socket, from, to, call, failCall, receiveOffer }) => {
  const [userAccept, setUserAccept] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const terminateCall = () => {
    call(false);
    setMyStream(null);
    setRemoteStream(null);
    peer.peer.close();
    
  };

  const sendStream = useCallback(
    (stream) => {
      stream.getTracks().forEach((track) => {
        peer.peer.addTrack(track, stream);
      });
    },
    [peer]
  );

  const acceptCall = useCallback(async () => {
    console.log("Accept call clicked");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      sendStream(stream);
      setMyStream(stream);
      const answer = await peer.getAnswer(receiveOffer);
      console.log("Answer:", answer);
      socket.current.emit("call:accept", { from, to, ans: answer });
      setUserAccept(true);
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  }, [receiveOffer, from, to, sendStream, socket]);

  const calling = useCallback(async () => {
    try {
      // Ensure media stream is obtained
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setMyStream(stream);
      sendStream(stream);

      // Wait for the offer to be created
      const offer = await peer.getOffer();
      socket.current.emit("call:ringing", { from, to, offer });
    } catch (error) {
      console.error("Error initiating call:", error);
    }
  }, [from, to, sendStream, socket]);

  const handleTrackEvent = useCallback((event) => {
    const [stream] = event.streams;
    setRemoteStream(stream);
  }, []);

  const handleNegotiationNeeded = useCallback(async () => {
    const offer = peer.peer.localDescription;
    if (offer) {
      socket.current.emit("peer:nego:needed", { from, to, off: offer });
    }
  }, [from, to, socket]);

  const handleCallAccepted = useCallback(async ({ ans }) => {
    try {
      await peer.setRemoteAns(ans);
      setUserAccept(true);
    } catch (error) {
      console.error("Error handling call acceptance:", error);
    }
  }, []);

  const handleCallFailed = useCallback(() => {
    failCall(true);
    terminateCall();
  }, [failCall]);

  useEffect(() => {
    peer.peer.addEventListener("track", handleTrackEvent);
    peer.peer.addEventListener("negotiationneeded", handleNegotiationNeeded);
    return () => {
      peer.peer.removeEventListener("track", handleTrackEvent);
      peer.peer.removeEventListener("negotiationneeded", handleNegotiationNeeded);
    };
  }, [handleTrackEvent, handleNegotiationNeeded]);

  useEffect(() => {
    if (socket.current) {
      socket.current.on("call:accepted", handleCallAccepted);
      socket.current.on("call:failed", handleCallFailed);
      socket.current.on("peer:nego:final",handleCallAccepted);
      return () => {
        socket.current.off("call:accepted", handleCallAccepted);
        socket.current.off("call:failed", handleCallFailed);
        socket.current.off("peer:nego:final",handleCallAccepted);
      };
    }
  }, [socket, handleCallAccepted, handleCallFailed]);

  useEffect(() => {
    if (!receiveOffer) {
      calling();
    }
  }, [receiveOffer, calling]);

  return (
    <div>
      <h1>Video Call</h1>
      {!userAccept &&
        (receiveOffer ? (
          <>
            <h3>Incoming Call</h3>
            <button onClick={acceptCall}>Accept</button>
          </>
        ) : (
          <h2>Calling...</h2>
        ))}

      {myStream && (
        <>
          <ReactPlayer playing muted height="300px" width="300px" url={myStream} />
        </>
      )}
      <button onClick={terminateCall}>End Call</button>
      {remoteStream && (
        <>
          <h3>Remote Stream</h3>
          <ReactPlayer playing muted height="300px" width="300px" url={remoteStream} />
        </>
      )}
    </div>
  );
};

export default VideoCall;
