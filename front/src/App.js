import React, { useState, useRef } from "react";
import {
  Input,
  Button,
  message,
  Select,
  Checkbox,
  Spin,
  Slider,
  Typography,
} from "antd";
import axios from "axios";
import { GlobalOutlined } from "@ant-design/icons";
import voices from "./constants/voicesList";
import "./App.css";

const { Option } = Select;

const App = () => {
  const [text, setText] = useState("");
  const [sentences, setSentences] = useState([]);
  const [translations, setTranslations] = useState({});
  const [hoveredSentence, setHoveredSentence] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSentences, setLoadingSentences] = useState({});
  const audioRef = useRef(null);
  const [selectedVoice, setSelectedVoice] = useState("en-US-BrianNeural");
  const [sequentialPlay, setSequentialPlay] = useState(false);
  const [curPlayingIndex, setCurPlayingIndex] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [allowTranslation, setIsAllowTranslation] = useState(false);
  const isPausedRef = useRef(false);
  const audioCache = useRef({});
  const currentIndexRef = useRef(0);

  const handleTextChange = (e) => setText(e.target.value);
  const handleVoiceChange = (value) => setSelectedVoice(value);
  const handleSequentialToggle = (e) => setSequentialPlay(e.target.checked);

  const handleSplitSentences = async () => {
    const response = await axios.post("http://127.0.0.1:5000/splitSentence", {
      passage: text,
    });
    const newSentences = response.data.filter((i) => i.trim().length);
    setSentences(newSentences);
    setTranslations({});

    // Preload audio if sequential play is enabled
    if (sequentialPlay) {
      preloadAudio(newSentences);
    }
  };

  const preloadAudio = async (sentencesToPreload) => {
    const newLoadingSentences = {}; // Initialize loading state object
    setLoadingSentences(newLoadingSentences); // Reset loading states

    for (const sentence of sentencesToPreload) {
      if (isPausedRef.current) {
        console.log("Audio preloading paused");
        return; // Break out of loop if paused
      }

      if (audioCache.current[sentence]) {
        console.log("sentence is cached already");
        continue;
      }

      newLoadingSentences[sentence] = true; // Set loading state for this sentence
      setLoadingSentences((prev) => ({ ...prev, [sentence]: true }));

      try {
        console.log("Start to preload sentence", sentence);
        const response = await axios.post(
          "http://127.0.0.1:5000/getAudioFromSentence",
          { sentence, voice: selectedVoice },
          { responseType: "blob" }
        );
        const url = URL.createObjectURL(
          new Blob([response.data], { type: "audio/mp3" })
        );
        audioCache.current[sentence] = url; // Cache the audio URL
      } catch (error) {
        message.error(`Error generating audio for sentence: ${sentence}`);
      } finally {
        newLoadingSentences[sentence] = false; // Mark sentence as loaded
        setLoadingSentences((prev) => ({ ...prev, [sentence]: false }));
      }
    }

    // Final update for loading states after the loop finishes
    setLoadingSentences(newLoadingSentences);
  };

  const togglePause = () => {
    isPausedRef.current = !isPausedRef.current; // Toggle the ref value
    console.log("Pause state:", isPausedRef.current);
    if (!isPausedRef.current) {
      preloadAudio(sentences);
    }
  };

  const handleSentenceClick = async (sentence, index) => {
    if (loading || loadingSentences[sentence]) return;

    if (audioRef.current) {
      stopAudioPlaying();
      audioRef.current.src = "";
    }

    currentIndexRef.current = index;
    setCurPlayingIndex(index);
    setLoading(true);

    if (audioCache.current[sentence]) {
      playAudio(audioCache.current[sentence]);
    } else {
      try {
        const response = await axios.post(
          "http://127.0.0.1:5000/getAudioFromSentence",
          { sentence, voice: selectedVoice },
          { responseType: "blob" }
        );
        const url = URL.createObjectURL(
          new Blob([response.data], { type: "audio/mp3" })
        );
        audioCache.current[sentence] = url;
        playAudio(url);
      } catch (error) {
        message.error("Error generating audio.");
      }
    }

    setLoading(false);
  };

  const playAudio = (url) => {
    audioRef.current = new Audio(url);
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.play();
    setIsAudioPlaying(true);
    if (sequentialPlay) {
      audioRef.current.onended = handlePlayNext;
    }
  };

  const stopAudioPlaying = () => {
    audioRef.current.pause();
    setIsAudioPlaying(false);
  };

  const toggleAudioPlaying = () => {
    if (isAudioPlaying) {
      stopAudioPlaying();
    } else {
      audioRef.current.play();
      setIsAudioPlaying(true);
    }
  };

  const handlePlayNext = () => {
    if (currentIndexRef.current + 1 < sentences.length) {
      currentIndexRef.current += 1;
      setCurPlayingIndex(currentIndexRef.current);
      handleSentenceClick(
        sentences[currentIndexRef.current],
        currentIndexRef.current
      );
    } else {
      message.success("Reached the end of selected sentences.");
    }
  };

  const handleReadAllClick = async () => {
    if (!text) {
      message.warning("Please enter a paragraph to read.");
      return;
    }

    if (audioRef.current) {
      stopAudioPlaying();
    }

    setLoading(true);

    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/getAudioFromSentence",
        { sentence: text, voice: selectedVoice },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(
        new Blob([response.data], { type: "audio/mp3" })
      );

      audioRef.current = new Audio(url);
      audioRef.current.play();
      setIsAudioPlaying(true);
    } catch (error) {
      message.error("Error generating audio for the entire passage.");
    }

    setLoading(false);
  };

  const toggleAllowTranslation = () => {
    setIsAllowTranslation((prev) => !prev);
  };

  const handleTranslateClick = async (sentence) => {
    setLoading(true);
    try {
      const response = await axios.post("http://127.0.0.1:5000/translate", {
        text: sentence,
        dest_lang: "zh-CN",
      });
      const translation = response.data.translated_text;

      setTranslations((prev) => ({
        ...prev,
        [sentence]: translation,
      }));

      message.success(`Translation: ${translation}`);
    } catch (error) {
      message.error("Error translating sentence.");
    }
    setLoading(false);
  };

  const handleStreamingReadClick = async () => {
    if (!text) {
      message.warning("Please enter a paragraph to stream.");
      return;
    }

    if (audioRef.current) {
      stopAudioPlaying();
    }

    setLoading(true);
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const source = audioContext.createBufferSource();
    source.connect(audioContext.destination);

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/getStreamingAudioFromSentence",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sentence: text, voice: selectedVoice }),
        }
      );

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body.getReader();
      const audioChunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        audioChunks.push(value);
      }

      const audioBlob = new Blob(audioChunks, { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);

      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();
      setIsAudioPlaying(true);

      audioRef.current.onended = () => {
        setLoading(false);
      };
    } catch (error) {
      message.error("Error in streaming audio.");
      setLoading(false);
    }
  };

  const handleSpeedChange = (value) => {
    setPlaybackRate(value);
    if (audioRef.current) {
      audioRef.current.playbackRate = value;
    }
  };

  const renderHighlightedPassage = () => {
    return sentences.map((sentence, index) => (
      <div key={index} style={{ marginBottom: "10px" }}>
        <span
          onMouseEnter={() => setHoveredSentence(sentence)}
          onMouseLeave={() => setHoveredSentence("")}
          onClick={() => handleSentenceClick(sentence, index)}
          className={
            hoveredSentence === sentence || curPlayingIndex === index
              ? "highlight break-reader-sentence"
              : "break-reader-sentence"
          }
          style={{ cursor: "pointer", display: "block" }}
        >
          {loadingSentences[sentence] ? (
            <Spin size="small" style={{ marginRight: "8px" }} />
          ) : null}
          {sentence}
          {allowTranslation ? (
            <GlobalOutlined
              style={{ marginLeft: "8px", cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                handleTranslateClick(sentence);
              }}
            />
          ) : null}
        </span>
        {translations[sentence] && (
          <div style={{ marginLeft: "20px", color: "#555" }}>
            Translation: {translations[sentence]}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="break-reader" style={{ padding: "20px", width: "760px" }}>
      <div className="break-reader-operations">
        <Select
          style={{ width: 250, marginBottom: "10px" }}
          defaultValue={selectedVoice}
          onChange={handleVoiceChange}
        >
          {voices.map((voice) => (
            <Option key={voice.value} value={voice.value}>
              {voice.label}
            </Option>
          ))}
        </Select>
        <Checkbox
          style={{ marginBottom: "10px", marginLeft: "10px" }}
          onChange={handleSequentialToggle}
        >
          Enable Sequential Reading
        </Checkbox>
        <Checkbox
          style={{ marginBottom: "10px", marginLeft: "10px" }}
          onChange={toggleAllowTranslation}
        >
          Enable Translation
        </Checkbox>
        <Input.TextArea
          rows={4}
          value={text}
          onChange={handleTextChange}
          placeholder="Enter your paragraph here"
        />
        <Button
          type="primary"
          onClick={handleSplitSentences}
          style={{ marginTop: "10px" }}
        >
          Split Sentences
        </Button>
        <Button
          type="default"
          onClick={handleReadAllClick}
          style={{ marginTop: "10px", marginLeft: "10px" }}
        >
          Read All
        </Button>
        <Button
          type="default"
          onClick={handleStreamingReadClick}
          style={{ marginTop: "10px", marginLeft: "10px" }}
        >
          Stream Read
        </Button>
        <Button
          type="default"
          color="default"
          variant="filled"
          onClick={toggleAudioPlaying}
          style={{ marginTop: "10px", marginLeft: "10px" }}
        >
          Pause
        </Button>
        <Button
          type="default"
          color="default"
          variant="filled"
          onClick={togglePause}
          style={{ marginTop: "10px", marginLeft: "10px" }}
        >
          {isPausedRef.current ? "Resume Preloading" : "Pause Preloading"}
        </Button>
        <div style={{ width: 300, marginTop: "20px" }}>
          <Typography.Text>Playback Speed: {playbackRate}x</Typography.Text>
          <Slider
            min={0.5}
            max={2.0}
            step={0.1}
            value={playbackRate}
            onChange={handleSpeedChange}
            tooltip={{ formatter: (value) => `${value}x` }}
          />
        </div>
      </div>

      <div className="break-reader-mainContent" style={{ marginTop: "20px" }}>
        {renderHighlightedPassage()}
      </div>
    </div>
  );
};

export default App;
