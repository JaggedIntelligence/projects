"use client";

import { useEffect, useRef, useState } from "react";

// Here 3.5 = 3 minutes 5 seconds , after dot it is seconds ...; the Code does the conversion 
// ---------------------------- code given by ChatGPT ------
export default function YoutubePage({ videoID, startTime1, endTime1 }) {
  const playerRef = useRef(null);
  const stopTimerRef = useRef(null);

  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=" + videoID
  );

  const [startTime, setStartTime] = useState(startTime1);
  const [endTime, setEndTime] = useState(endTime1);

  function extractVideoId(url) {
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/
    );

    return match ? match[1] : null;
  }

  // ---------------------
  function timeToSeconds(timeValue) {
    const value = String(timeValue).trim();

    const [minutesPart, secondsPart = "0"] = value.split(".");

    const minutes = Number(minutesPart);
    const seconds = Number(secondsPart);

    if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
      throw new Error("Invalid time format");
    }

    if (seconds >= 60) {
      throw new Error("Seconds must be below 60");
    }

    return minutes * 60 + seconds;
  }

  // -----------------------
  useEffect(() => {
    function createPlayer() {
      if (playerRef.current) return;

      playerRef.current = new window.YT.Player("youtube-player", {
        height: "420",
        width: "750",
        videoId: extractVideoId(videoUrl),
        playerVars: {
          controls: 1,
          rel: 0,
          playsinline: 1,
        },
      });
    }

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;

      if (!document.getElementById("youtube-iframe-api")) {
        const script = document.createElement("script");
        script.id = "youtube-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    }

    return () => {
      clearTimeout(stopTimerRef.current);

      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  // ---------------------------
  function playSegment() {
    if (!playerRef.current) {
      alert("YouTube player is not ready yet.");
      return;
    }

    const videoId = extractVideoId(videoUrl);

    if (!videoId) {
      alert("Invalid YouTube URL");
      return;
    }

    let startSeconds;
    let endSeconds;

    try {
      startSeconds = timeToSeconds(startTime);
      endSeconds = timeToSeconds(endTime);
    } catch (err) {
      alert(err.message);
      return;
    }

    if (endSeconds <= startSeconds) {
      alert("End time must be greater than start time");
      return;
    }

    clearTimeout(stopTimerRef.current);

    playerRef.current.loadVideoById({
      videoId,
      startSeconds,
    });

    playerRef.current.playVideo();

    stopTimerRef.current = setTimeout(() => {
      playerRef.current.pauseVideo();
    }, (endSeconds - startSeconds) * 1000);
  }

  // ---------- main return -------------------------
  return (
    <main style={{ padding: 30, fontFamily: "Arial" }}>
      <h1>YouTube Segment Player</h1>

      <input
        type="text"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="YouTube URL"
        style={{
          width: "100%",
          maxWidth: 750,
          padding: 10,
          marginBottom: 15,
        }}
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
      

        <button onClick={playSegment} style={{ padding: "10px 18px" }}>
          Play Segment
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div>3.5 = 3 minutes 5 seconds --- {startTime1}</div>
      </div>

      <div id="youtube-player" />
    </main>
  );
}
